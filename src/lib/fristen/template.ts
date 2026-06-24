// PROJ-32 (AC3): Reine Render-Funktion für die Fristen-Erinnerungs-Mail.
//
// Erzeugt Betreff + Text- und HTML-Body (deutsch). Enthält Periode,
// Resttage bzw. Überfälligkeit, Abgabefrist und einen Link ins Tool.
// KEINE Mail-, DB- oder UI-Abhängigkeit — rein und getestet.

import type { UstFristInfo } from "@/lib/dashboard/fristen";
import type { ErinnerungStufe } from "./erinnerung";

export interface MailInhalt {
  betreff: string;
  text: string;
  html: string;
}

export interface RenderArgs {
  frist: UstFristInfo;
  stufe: ErinnerungStufe;
  /** Basis-URL des Tools (ohne abschließenden Slash), z. B. https://app.example.de */
  appUrl: string;
}

/** HTML-escapen für sicheren Einbau dynamischer Werte in den HTML-Body. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Menschlicher Dringlichkeits-Satz je nach Stufe / Resttagen. */
function dringlichkeit(frist: UstFristInfo, stufe: ErinnerungStufe): string {
  if (stufe === "ueberfaellig") {
    const tage = Math.abs(frist.tage_bis_frist);
    return `Die Frist ist seit ${tage} Tag${tage === 1 ? "" : "en"} überfällig.`;
  }
  const tage = frist.tage_bis_frist;
  if (tage <= 0) return "Die Frist ist heute fällig.";
  return `Es verbleiben noch ${tage} Tag${tage === 1 ? "" : "e"} bis zur Frist.`;
}

/** Betreff-Präfix je Stufe. */
function betreffPraefix(stufe: ErinnerungStufe): string {
  switch (stufe) {
    case "ueberfaellig":
      return "Überfällig";
    case "3_tage":
      return "Dringend";
    case "14_tage":
      return "Erinnerung";
  }
}

/** Link auf die USt-VA-Seite des Tools (Frist-Kontext). */
function toolLink(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/ust-voranmeldung`;
}

/**
 * Rendert die komplette Erinnerungs-Mail (Betreff + Text + HTML).
 * Deterministisch und rein — gleiche Eingaben ergeben gleiche Ausgabe.
 */
export function rendereErinnerungMail(args: RenderArgs): MailInhalt {
  const { frist, stufe, appUrl } = args;
  const periode = frist.periode.label;
  const dring = dringlichkeit(frist, stufe);
  const link = toolLink(appUrl);

  const betreff = `[STEUERAGENT] ${betreffPraefix(stufe)}: USt-VA ${periode} — Abgabefrist ${frist.abgabefrist}`;

  const text = [
    `Hallo,`,
    ``,
    `dies ist eine automatische Erinnerung an deine Umsatzsteuer-Voranmeldung.`,
    ``,
    `Zeitraum: ${periode}`,
    `Abgabefrist: ${frist.abgabefrist}`,
    dring,
    ``,
    `Zur USt-VA im STEUERAGENT: ${link}`,
    ``,
    `Hinweis: Diese E-Mail ist ein unverbindlicher Hinweis. Die finale`,
    `Übermittlung ans Finanzamt liegt in deiner Verantwortung.`,
  ].join("\n");

  const html = [
    `<div style="font-family:system-ui,Arial,sans-serif;line-height:1.5;color:#111">`,
    `<p>Hallo,</p>`,
    `<p>dies ist eine automatische Erinnerung an deine <strong>Umsatzsteuer-Voranmeldung</strong>.</p>`,
    `<table style="border-collapse:collapse;margin:12px 0">`,
    `<tr><td style="padding:2px 12px 2px 0;color:#555">Zeitraum</td><td><strong>${esc(periode)}</strong></td></tr>`,
    `<tr><td style="padding:2px 12px 2px 0;color:#555">Abgabefrist</td><td><strong>${esc(frist.abgabefrist)}</strong></td></tr>`,
    `</table>`,
    `<p>${esc(dring)}</p>`,
    `<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Zur USt-VA im STEUERAGENT</a></p>`,
    `<p style="color:#777;font-size:12px">Hinweis: Diese E-Mail ist ein unverbindlicher Hinweis. Die finale Übermittlung ans Finanzamt liegt in deiner Verantwortung.</p>`,
    `</div>`,
  ].join("");

  return { betreff, text, html };
}
