import type { KatalogParams } from "@/lib/pdf/katalog-document";

/**
 * Normalisiert die in `katalog_jobs.parameter` gespeicherten Wizard-Parameter.
 *
 * Backwards-Compat (PROJ-37):
 *   - Alt-Schema: `preisauswahl: "listenpreis" | "ek"`. Wert `"ek"` → `"lichtengros"`.
 *   - Neue Felder werden mit Defaults aufgefüllt, wenn sie im JSON fehlen.
 *
 * Wirft eine sprechende Fehlermeldung, wenn das Layout-Feld unbrauchbar ist —
 * der Renderer kann ohne Layout nicht arbeiten.
 */
export function normalizeParams(raw: any, log: (msg: string) => void = () => {}): KatalogParams {
  if (!raw || typeof raw !== "object") {
    throw new Error("Job hat keine Parameter (parameter ist leer oder kein Objekt).");
  }

  const layout =
    raw.layout === "eisenkeil" ? "eisenkeil" :
    raw.layout === "lichtengros" ? "lichtengros" :
    null;
  if (!layout) {
    throw new Error(`Ungültiges Layout: ${JSON.stringify(raw.layout)}`);
  }

  let preisauswahl: KatalogParams["preisauswahl"];
  if (raw.preisauswahl === "lichtengros" || raw.preisauswahl === "eisenkeil" || raw.preisauswahl === "listenpreis") {
    preisauswahl = raw.preisauswahl;
  } else if (raw.preisauswahl === "ek") {
    log("Backwards-Compat: alte Spur 'ek' → 'lichtengros'");
    preisauswahl = "lichtengros";
  } else {
    log(`Unbekannte Preisspur ${JSON.stringify(raw.preisauswahl)} → fallback auf 'listenpreis'`);
    preisauswahl = "listenpreis";
  }

  const preisAenderung = raw.preisAenderung === "minus" ? "minus" : "plus";
  const preisProzent = Number.isFinite(Number(raw.preisProzent)) ? Number(raw.preisProzent) : 0;
  const waehrung = raw.waehrung === "CHF" ? "CHF" : "EUR";
  const wechselkurs = Number.isFinite(Number(raw.wechselkurs)) && Number(raw.wechselkurs) > 0
    ? Number(raw.wechselkurs)
    : 1;

  // Inhaltsauswahl: NULL/undefined oder leeres Array = alle Produkte.
  // Im Zweifel "alles" — Wizard schickt ohnehin null, wenn alles ausgewählt ist.
  const produktIds: string[] | null = Array.isArray(raw.produktIds) && raw.produktIds.length > 0
    ? raw.produktIds.filter((x: unknown) => typeof x === "string")
    : null;

  return {
    layout,
    preisauswahl,
    preisAenderung,
    preisProzent,
    waehrung,
    wechselkurs,
    sprache: "de",
    produktIds,
  };
}
