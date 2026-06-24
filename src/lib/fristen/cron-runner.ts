// PROJ-32 (AC4/AC5): Orchestrierung des Fristen-Erinnerungs-Laufs.
//
// Lädt für den (einzigen, Single-Tenant) Inhaber: Firmenprofil (Rhythmus,
// Dauerfristverlängerung, Opt-in), bereits abgeschlossene USt-VA-Perioden und
// bereits versendete Erinnerungen. Berechnet die nächste Frist (PROJ-27,
// naechsteUstFrist), bestimmt die fällige Stufe (erinnerung.ts), rendert die
// Mail (template.ts) und versendet über den Adapter (mailer.ts) — NUR wenn
// Opt-in aktiv und Mailadresse vorhanden. Schreibt anschließend einen
// Versand-Log-Eintrag (Idempotenz via unique(owner_id,periode_key,stufe)).
//
// Der eigentliche Cron-Endpoint (route.ts) bleibt dünn und delegiert hierher.
// Diese Funktion bekommt Supabase-Client + Mail-Versender injiziert → testbar
// ohne echten Versand und ohne echte DB (Client mockbar).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UstRhythmus } from "@/lib/tax/perioden";
import { naechsteUstFrist } from "@/lib/dashboard/fristen";
import {
  bestimmeFaelligeErinnerung,
  idempotenzSchluessel,
} from "./erinnerung";
import { rendereErinnerungMail } from "./template";
import { sendMail, type Versender } from "./mailer";

export interface CronRunnerArgs {
  /** Service-Role-Client (Cron hat keine Nutzer-Session). */
  supabase: SupabaseClient;
  /** Heutiges Datum ISO yyyy-MM-dd — als Parameter, damit testbar. */
  heute: string;
  /** Basis-URL des Tools für den Mail-Link. */
  appUrl: string;
  /** Optionaler Mail-Versender (DI für Tests). Default: Resend-Adapter. */
  versender?: Versender;
}

export interface CronRunnerSummary {
  /** Anzahl betrachteter Inhaber (Single-Tenant: 0 oder 1). */
  geprueft: number;
  /** Wurde eine Mail tatsächlich versendet? */
  gesendet: boolean;
  /** Maschinenlesbarer Status für die JSON-Antwort. */
  status:
    | "kein_profil"
    | "opt_out"
    | "keine_mailadresse"
    | "keine_frist_faellig"
    | "bereits_gesendet"
    | "versendet"
    | "versand_uebersprungen";
  /** Mensch-lesbares Detail (Stufe/Periode/Grund). */
  detail: string;
  /**
   * Gesetzt, wenn die Mail versendet wurde, aber der Idempotenz-Log-Eintrag
   * NICHT geschrieben werden konnte (transienter DB-Fehler). Dann fehlt die
   * Sperre gegen einen Doppelversand im nächsten Lauf — der Endpoint soll das
   * sichtbar machen (QA-W2). Die unique-Constraint bleibt letzte Verteidigung.
   */
  warnung?: string;
}

interface ProfilRow {
  owner_id: string;
  ust_va_rhythmus: UstRhythmus | null;
  dauerfristverlaengerung: boolean | null;
  fristen_mail_aktiv: boolean | null;
}

/**
 * Führt einen kompletten Erinnerungs-Lauf aus und liefert eine Zusammenfassung.
 * Sendet höchstens eine Mail pro Lauf (Single-Tenant, eine fällige Stufe).
 */
export async function laufFristenErinnerung(
  args: CronRunnerArgs,
): Promise<CronRunnerSummary> {
  const { supabase, heute, appUrl, versender } = args;

  // 1) Firmenprofil (Single-Tenant → erstes/einziges Profil).
  const { data: profil } = await supabase
    .from("firmenprofil")
    .select(
      "owner_id, ust_va_rhythmus, dauerfristverlaengerung, fristen_mail_aktiv",
    )
    .limit(1)
    .maybeSingle();

  const p = profil as ProfilRow | null;
  if (!p?.owner_id) {
    return { geprueft: 0, gesendet: false, status: "kein_profil", detail: "Kein Firmenprofil vorhanden." };
  }

  const ownerId = p.owner_id;
  const rhythmus: UstRhythmus = p.ust_va_rhythmus ?? "monatlich";
  const dauerfrist = p.dauerfristverlaengerung ?? false;
  const optIn = p.fristen_mail_aktiv ?? false;

  if (!optIn) {
    return { geprueft: 1, gesendet: false, status: "opt_out", detail: "Fristen-Mail nicht aktiviert (Opt-in aus)." };
  }

  // 2) Mailadresse aus Supabase-Auth-User.
  let mailadresse: string | null = null;
  try {
    const { data: userRes } = await supabase.auth.admin.getUserById(ownerId);
    mailadresse = userRes?.user?.email ?? null;
  } catch {
    mailadresse = null;
  }
  if (!mailadresse) {
    return { geprueft: 1, gesendet: false, status: "keine_mailadresse", detail: "Keine Mailadresse für den Inhaber gefunden." };
  }

  // 3) Abgeschlossene USt-VA-Perioden (für naechsteUstFrist).
  const { data: periodenData } = await supabase
    .from("steuerperiode")
    .select("jahr, periode, status")
    .eq("owner_id", ownerId)
    .eq("art", "ust_va")
    .eq("status", "abgeschlossen")
    .limit(500);
  const abgeschlossene = ((periodenData ?? []) as Array<{
    jahr: number;
    periode: number | null;
  }>).map((r) => ({ jahr: r.jahr, periode: r.periode ?? 0 }));

  const frist = naechsteUstFrist({
    rhythmus,
    heute,
    abgeschlossene_perioden: abgeschlossene,
    dauerfristverlaengerung: dauerfrist,
  });

  // 4) Bereits versendete Erinnerungen → Idempotenz-Set.
  const { data: gesendetData } = await supabase
    .from("fristen_erinnerung")
    .select("periode_key, stufe")
    .eq("owner_id", ownerId)
    .limit(1000);
  const gesendetSet = new Set(
    ((gesendetData ?? []) as Array<{ periode_key: string; stufe: string }>).map(
      (r) => idempotenzSchluessel(r.periode_key, r.stufe as never),
    ),
  );

  const faellig = bestimmeFaelligeErinnerung(frist, gesendetSet);
  if (!faellig || !frist) {
    return { geprueft: 1, gesendet: false, status: "keine_frist_faellig", detail: "Keine fällige Erinnerungs-Stufe." };
  }

  // 5) Mail rendern + versenden.
  const inhalt = rendereErinnerungMail({ frist, stufe: faellig.stufe, appUrl });
  const ergebnis = await sendMail(
    {
      an: mailadresse,
      betreff: inhalt.betreff,
      text: inhalt.text,
      html: inhalt.html,
    },
    versender,
  );

  // 6) Log schreiben (Idempotenz). unique(owner_id,periode_key,stufe)
  // verhindert Doppelversand bei parallelen/wiederholten Läufen. Wir loggen
  // den Versuch nur, wenn tatsächlich versendet wurde — so kann ein no-op
  // (kein Key) später bei scharfgeschaltetem Versand nachgeholt werden.
  if (ergebnis.gesendet) {
    // Insert-Fehler NICHT verschlucken (QA-W2): scheitert der Log-Eintrag nach
    // erfolgreichem Versand (transienter DB-Fehler), fehlt die Idempotenz-Sperre
    // → nächster Lauf könnte erneut mailen. Das machen wir über `warnung`
    // sichtbar (der Endpoint surfaced es). Bei einer echten Duplikat-Verletzung
    // (Code 23505) ist alles in Ordnung — die unique-Constraint hat gegriffen.
    const { error: insertErr } = await supabase
      .from("fristen_erinnerung")
      .insert({
        owner_id: ownerId,
        periode_key: faellig.periode_key,
        stufe: faellig.stufe,
      });
    const warnung =
      insertErr && (insertErr as { code?: string }).code !== "23505"
        ? `Versand-Log konnte nicht geschrieben werden (${insertErr.message}) — Doppelversand im nächsten Lauf möglich.`
        : undefined;
    return {
      geprueft: 1,
      gesendet: true,
      status: "versendet",
      detail: `Stufe ${faellig.stufe} für Periode ${faellig.periode_key} versendet.`,
      ...(warnung ? { warnung } : {}),
    };
  }

  return {
    geprueft: 1,
    gesendet: false,
    status: "versand_uebersprungen",
    detail: `Versand übersprungen (${ergebnis.grund}) — Stufe ${faellig.stufe}, Periode ${faellig.periode_key}.`,
  };
}
