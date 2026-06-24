// PROJ-32 (AC2): Mail-Adapter (dünne Abstraktion über Resend).
//
// WICHTIG (outward-facing): Ohne gesetzten RESEND_API_KEY ist `sendMail` ein
// NO-OP + console-Log — KEIN Fehler, KEIN Netzwerk-Call. Der eigentliche
// Versand über Resend läuft erst, wenn Florian Key + verifizierte Absender-
// Domain konfiguriert hat. Der Import von `resend` erfolgt DYNAMISCH und nur,
// wenn ein Key vorhanden ist, damit tsc/build auch ohne installiertes Paket
// nicht hart bricht.
//
// Testbar per Dependency-Injection: `sendMail` nimmt optional einen
// `Versender` entgegen, der im Test gemockt wird (kein echter Call).

export interface MailNachricht {
  an: string;
  betreff: string;
  text: string;
  html: string;
}

export interface VersandErgebnis {
  /** true, wenn tatsächlich versendet wurde (Key gesetzt + Versand ok). */
  gesendet: boolean;
  /** Grund bei Nicht-Versand bzw. "ok" / Fehlertext. */
  grund: string;
}

/** Funktions-Signatur des eigentlichen Versenders (für DI/Mock im Test). */
export type Versender = (nachricht: MailNachricht) => Promise<VersandErgebnis>;

function absender(): string {
  const f = process.env.FRISTEN_MAIL_FROM?.trim();
  return f && f.length > 0 ? f : "STEUERAGENT <onboarding@resend.dev>";
}

/**
 * Realer Resend-Versender. Wird NUR aufgerufen, wenn RESEND_API_KEY gesetzt
 * ist. Import dynamisch, damit das Paket optional bleibt.
 */
async function resendVersender(nachricht: MailNachricht): Promise<VersandErgebnis> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  try {
    // Dynamischer Import: bricht den Build nicht, falls `resend` (noch) nicht
    // installiert ist. Variable verhindert statische Auflösung durch den Bundler.
    const modName = "resend";
    const mod: { Resend: new (key: string) => unknown } = await import(
      /* webpackIgnore: true */ modName
    );
    const ResendCtor = mod.Resend as new (key: string) => {
      emails: {
        send: (args: {
          from: string;
          to: string;
          subject: string;
          text: string;
          html: string;
        }) => Promise<{ error?: { message?: string } | null }>;
      };
    };
    const client = new ResendCtor(apiKey);
    const res = await client.emails.send({
      from: absender(),
      to: nachricht.an,
      subject: nachricht.betreff,
      text: nachricht.text,
      html: nachricht.html,
    });
    if (res?.error) {
      return { gesendet: false, grund: res.error.message ?? "resend_fehler" };
    }
    return { gesendet: true, grund: "ok" };
  } catch (e) {
    return {
      gesendet: false,
      grund: e instanceof Error ? e.message : "resend_ausnahme",
    };
  }
}

/**
 * Versendet eine E-Mail — oder no-opt, wenn kein RESEND_API_KEY gesetzt ist.
 *
 * @param nachricht Empfänger + Inhalt.
 * @param versender Optionaler Versender (DI für Tests). Default: Resend, sofern
 *                  RESEND_API_KEY gesetzt ist.
 * @returns VersandErgebnis. Bei fehlendem Key: { gesendet:false, grund }.
 *
 * NIE Fehler werfen: bei fehlendem Key wird geloggt und sauber zurückgegeben.
 */
export async function sendMail(
  nachricht: MailNachricht,
  versender?: Versender,
): Promise<VersandErgebnis> {
  const keyGesetzt = !!process.env.RESEND_API_KEY?.trim();

  if (!versender && !keyGesetzt) {
    // No-op: kein Key, kein expliziter Versender → nur loggen.
    console.info(
      `[fristen-mail] no-op (RESEND_API_KEY nicht gesetzt) — an=${nachricht.an} betreff=${nachricht.betreff}`,
    );
    return { gesendet: false, grund: "kein_api_key" };
  }

  const fn = versender ?? resendVersender;
  return fn(nachricht);
}
