// PROJ-17 — Mock-Daten + Mock-API fuer die KI-Chat-UI.
//
// WICHTIG: Dieses Modul ist eine VOLLSTAENDIGE Attrappe fuer die
// Frontend-Iteration. Sobald das Backend gebaut ist, ersetzt der
// Backend-Agent jede `mock*`-Funktion durch einen echten `fetch()`-Aufruf
// auf die in der Spec definierten Endpoints.
//
// Suche im Repo nach "TODO Backend" — alle Stellen, an denen der echte
// Backend-Endpoint ranmuss, sind dort markiert.

import type {
  ChatAktion,
  ChatKonversation,
  ChatNachricht,
  ChatNachrichtRolle,
  ToolBadge,
} from "./typen";

const JETZT = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Konversationen
// ---------------------------------------------------------------------------

const MOCK_KONVERSATIONEN: ChatKonversation[] = [
  {
    id: "konv-1",
    titel: "Software-Ausgaben Mai 2026",
    aktualisiert_am: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    erstellt_am: new Date(
      Date.now() - 1000 * 60 * 60 * 2 - 1000 * 60 * 10,
    ).toISOString(),
    vorschau:
      "Im Mai 2026 hast du insgesamt 487,32 EUR für Software ausgegeben…",
  },
  {
    id: "konv-2",
    titel: "Amazon-Buchungen März",
    aktualisiert_am: new Date(
      Date.now() - 1000 * 60 * 60 * 24,
    ).toISOString(),
    erstellt_am: new Date(
      Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 20,
    ).toISOString(),
    vorschau: "Hier sind alle 12 Amazon-Buchungen im März 2026…",
  },
  {
    id: "konv-3",
    titel: "Abos & Vertragspflege",
    aktualisiert_am: new Date(
      Date.now() - 1000 * 60 * 60 * 24 * 3,
    ).toISOString(),
    erstellt_am: new Date(
      Date.now() - 1000 * 60 * 60 * 24 * 3 - 1000 * 60 * 30,
    ).toISOString(),
    vorschau:
      "Du hast 9 aktive Abonnements mit einem Jahresvolumen von 1.846 €…",
  },
];

export function mockKonversationen(): ChatKonversation[] {
  // TODO Backend: ersetze durch GET /api/chat/konversationen
  return [...MOCK_KONVERSATIONEN].sort((a, b) =>
    b.aktualisiert_am.localeCompare(a.aktualisiert_am),
  );
}

export function mockKonversationLaden(
  konversation_id: string,
): ChatKonversation | null {
  // TODO Backend: ersetze durch GET /api/chat/[konversation_id]
  return MOCK_KONVERSATIONEN.find((k) => k.id === konversation_id) ?? null;
}

export function mockNeueKonversation(): ChatKonversation {
  // TODO Backend: ersetze durch POST /api/chat/konversationen
  const id = `konv-neu-${Date.now()}`;
  const k: ChatKonversation = {
    id,
    titel: "Neuer Chat",
    aktualisiert_am: JETZT(),
    erstellt_am: JETZT(),
    vorschau: null,
  };
  MOCK_KONVERSATIONEN.unshift(k);
  return k;
}

export function mockKonversationUmbenennen(
  konversation_id: string,
  neuer_titel: string,
): ChatKonversation | null {
  // TODO Backend: ersetze durch PATCH /api/chat/[konversation_id]
  const k = MOCK_KONVERSATIONEN.find((x) => x.id === konversation_id);
  if (!k) return null;
  k.titel = neuer_titel;
  k.aktualisiert_am = JETZT();
  return k;
}

export function mockKonversationLoeschen(konversation_id: string): boolean {
  // TODO Backend: ersetze durch DELETE /api/chat/[konversation_id]
  const idx = MOCK_KONVERSATIONEN.findIndex((k) => k.id === konversation_id);
  if (idx === -1) return false;
  MOCK_KONVERSATIONEN.splice(idx, 1);
  return true;
}

// ---------------------------------------------------------------------------
// Nachrichten je Konversation
// ---------------------------------------------------------------------------

const MOCK_NACHRICHTEN: Record<string, ChatNachricht[]> = {
  "konv-1": [
    {
      id: "n-1-1",
      konversation_id: "konv-1",
      rolle: "user",
      inhalt: "Wie viel habe ich diesen Monat für Software ausgegeben?",
      tools: [],
      aktion: null,
      erstellt_am: new Date(
        Date.now() - 1000 * 60 * 60 * 2 - 1000 * 60 * 5,
      ).toISOString(),
    },
    {
      id: "n-1-2",
      konversation_id: "konv-1",
      rolle: "assistant",
      inhalt:
        "Im **Mai 2026** hast du insgesamt **487,32 €** für Software-Lizenzen ausgegeben — verteilt auf 8 Buchungen.\n\n| Empfänger | Betrag | Datum |\n|---|---:|---|\n| Adobe Creative Cloud | 71,39 € | 03.05.2026 |\n| GitHub Copilot | 19,90 € | 05.05.2026 |\n| JetBrains | 23,90 € | 07.05.2026 |\n| Notion Labs | 9,99 € | 10.05.2026 |\n| Figma | 14,25 € | 12.05.2026 |\n| 1Password | 4,99 € | 14.05.2026 |\n| Linear | 7,90 € | 18.05.2026 |\n| Anthropic API | 335,00 € | 20.05.2026 |\n\nDamit liegst du ~12 % unter dem 6-Monats-Durchschnitt von 552 €.",
      tools: [
        {
          name: "suche_buchungen",
          parameter: {
            kategorie_id: "kat-software",
            von: "2026-05-01",
            bis: "2026-05-31",
            limit: 100,
          },
          ergebnis_zusammenfassung: "8 Buchungen gefunden, Summe 487,32 €",
        },
        {
          name: "aggregat_kategorien",
          parameter: { von: "2025-12-01", bis: "2026-05-31" },
          ergebnis_zusammenfassung: "Software-Schnitt: 552,03 €/Monat",
        },
      ],
      aktion: null,
      erstellt_am: new Date(
        Date.now() - 1000 * 60 * 60 * 2 - 1000 * 60 * 4,
      ).toISOString(),
    },
  ],
  "konv-2": [
    {
      id: "n-2-1",
      konversation_id: "konv-2",
      rolle: "user",
      inhalt:
        "Buche die drei Accenture-Buchungen aus März auf 'Privat: Lohn/Gehalt'",
      tools: [],
      aktion: null,
      erstellt_am: new Date(
        Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 8,
      ).toISOString(),
    },
    {
      id: "n-2-2",
      konversation_id: "konv-2",
      rolle: "assistant",
      inhalt:
        "Ich habe **3 Accenture-Buchungen im März 2026** gefunden. Bitte bestätige die Umbuchung auf **„Privat: Lohn/Gehalt“** in der Karte unten.",
      tools: [
        {
          name: "suche_buchungen",
          parameter: {
            empfaenger: "Accenture",
            von: "2026-03-01",
            bis: "2026-03-31",
          },
          ergebnis_zusammenfassung: "3 Buchungen gefunden, Summe 12.430,00 €",
        },
        {
          name: "kategorien_liste",
          parameter: {},
          ergebnis_zusammenfassung:
            "Kategorie 'Privat: Lohn/Gehalt' gefunden (kat-privat-lohn)",
        },
      ],
      aktion: {
        id: "akt-2-1",
        aktion: "bucheBuchungenUm",
        titel: "3 Buchungen umbuchen",
        vorschau:
          "3 Accenture-Buchungen aus März 2026 werden auf „Privat: Lohn/Gehalt“ umgebucht. Steuerrelevanz wird auf „nein“ gesetzt.",
        parameter: {
          buchung_ids: ["b-1", "b-2", "b-3"],
          neue_kategorie_id: "kat-privat-lohn",
          neue_klassifikation: "privat",
        },
        vorher_nachher: [
          {
            id: "b-1",
            datum: "03.03.2026",
            empfaenger: "Accenture GmbH",
            betrag: "4.143,33 €",
            vorher: "Unklar",
            nachher: "Privat: Lohn/Gehalt",
          },
          {
            id: "b-2",
            datum: "15.03.2026",
            empfaenger: "Accenture GmbH",
            betrag: "4.143,33 €",
            vorher: "Unklar",
            nachher: "Privat: Lohn/Gehalt",
          },
          {
            id: "b-3",
            datum: "28.03.2026",
            empfaenger: "Accenture GmbH",
            betrag: "4.143,34 €",
            vorher: "Unklar",
            nachher: "Privat: Lohn/Gehalt",
          },
        ],
        status: "pending_confirm",
        ausgefuehrt_am: null,
        fehler_text: null,
      },
      erstellt_am: new Date(
        Date.now() - 1000 * 60 * 60 * 24 - 1000 * 60 * 7,
      ).toISOString(),
    },
  ],
  "konv-3": [
    {
      id: "n-3-1",
      konversation_id: "konv-3",
      rolle: "user",
      inhalt: "Welche Abos kosten mich am meisten?",
      tools: [],
      aktion: null,
      erstellt_am: new Date(
        Date.now() - 1000 * 60 * 60 * 24 * 3 - 1000 * 60 * 12,
      ).toISOString(),
    },
    {
      id: "n-3-2",
      konversation_id: "konv-3",
      rolle: "assistant",
      inhalt:
        "Du hast **9 aktive Abonnements** mit einem Jahresvolumen von **1.846 €**. Die drei teuersten:\n\n1. **Anthropic API** — 335 €/Monat (4.020 €/Jahr)\n2. **Adobe Creative Cloud** — 71,39 €/Monat (856,68 €/Jahr)\n3. **JetBrains All Products** — 23,90 €/Monat (286,80 €/Jahr)\n\nWichtig: Das Anthropic-Abo hat *nutzungsbasierte* Buchungen, die Höhe schwankt monatlich.",
      tools: [
        {
          name: "wiederkehrende_buchungen",
          parameter: { aktiv_nur: true },
          ergebnis_zusammenfassung: "9 aktive, Jahresvolumen 1.846,28 €",
        },
      ],
      aktion: null,
      erstellt_am: new Date(
        Date.now() - 1000 * 60 * 60 * 24 * 3 - 1000 * 60 * 11,
      ).toISOString(),
    },
  ],
};

export function mockNachrichten(konversation_id: string): ChatNachricht[] {
  // TODO Backend: ersetze durch GET /api/chat/[konversation_id]
  const liste = MOCK_NACHRICHTEN[konversation_id];
  if (!liste) return [];
  // Defensive Kopie, damit Aufrufer mutieren darf, ohne den Cache zu kippen.
  return liste.map((n) => ({
    ...n,
    aktion: n.aktion ? { ...n.aktion } : null,
    tools: [...n.tools],
  }));
}

// ---------------------------------------------------------------------------
// Beispielfragen-Bubbles fuer den Leerzustand
// ---------------------------------------------------------------------------

export function mockBeispielfragen(): string[] {
  return [
    "Wie viel habe ich diesen Monat für Software ausgegeben?",
    "Zeig mir alle Buchungen von Amazon im März",
    "Wie viel Umsatzsteuer schulde ich aktuell?",
    "Welche Buchungen sind noch in der Prüfliste?",
    "Welche Abos kosten mich am meisten?",
    "Hat sich mein Einkommen seit Januar verändert?",
  ];
}

// ---------------------------------------------------------------------------
// Streaming-Antwort
// ---------------------------------------------------------------------------

const BASIS_ANTWORT_LESE =
  "Ich habe deine Daten geprüft. Hier ist die Antwort: Im aktuellen Zeitraum siehst du eine **klare Tendenz nach unten** — die Software-Kosten sind um 12 % gefallen, während die Reise-Ausgaben um 23 % gestiegen sind. Wenn du magst, kann ich dir die Detail-Buchungen pro Kategorie anzeigen oder eine Lernregel vorschlagen, die ähnliche Fälle künftig automatisch zuordnet.";

const BASIS_ANTWORT_SCHREIB =
  "Ich habe die betroffenen Buchungen gefunden und einen Aktions-Vorschlag vorbereitet. Bitte prüfe die Übersicht in der Aktions-Karte unten und bestätige, wenn alles passt. **Erst nach deiner Bestätigung** werden die Änderungen gespeichert.";

/**
 * Simuliert einen Token-Stream. Spuckt Wort-Tokens mit ~40-60 ms Pause aus.
 *
 * TODO Backend: ersetze diesen Aufruf durch einen echten Stream aus
 * `POST /api/chat/[konversation_id]/nachricht` ueber das Vercel AI SDK
 * (`useChat`-Hook oder `streamText`-Response).
 */
export async function* mockAntwortStream(
  eingabe: string,
): AsyncIterable<string> {
  const istSchreibAnweisung = /\b(buche|lege|loesche|lösche|aendere|ändere|bestätige|bestaetige)\b/i.test(
    eingabe,
  );
  const text = istSchreibAnweisung ? BASIS_ANTWORT_SCHREIB : BASIS_ANTWORT_LESE;
  // Token-weise (Wort + nachfolgendes Whitespace) ausspielen.
  const tokens = text.match(/\S+\s*/g) ?? [];
  for (const tok of tokens) {
    await pause(40 + Math.random() * 30);
    yield tok;
  }
}

/**
 * Liefert nach einem Stream eventuell entstandene "Side-Effects":
 * Tool-Badges und (bei Schreib-Anweisungen) einen Aktions-Vorschlag.
 *
 * TODO Backend: kommt in der echten Welt aus den `tool_calls` und
 * `tool_results` des LLM-Streams. Diese Funktion entfaellt dann komplett.
 */
export function mockNachrichtenNachtrag(eingabe: string): {
  tools: ToolBadge[];
  aktion: ChatAktion | null;
} {
  const tools: ToolBadge[] = [];
  const istSchreib = /\b(buche|lege|loesche|lösche|aendere|ändere|bestätige|bestaetige)\b/i.test(
    eingabe,
  );

  // Heuristik: bei Datums-Stichwoertern simulieren wir suche_buchungen.
  if (/\b(monat|märz|maerz|woche|jahr|2026|januar|mai|quartal)\b/i.test(eingabe)) {
    tools.push({
      name: "suche_buchungen",
      parameter: { begriff: eingabe.slice(0, 40), limit: 100 },
      ergebnis_zusammenfassung: "42 Buchungen gefunden",
    });
  }
  if (/\b(kategorie|software|reise|büro|buero|miete|abo)\b/i.test(eingabe)) {
    tools.push({
      name: "aggregat_kategorien",
      parameter: { von: "2026-01-01", bis: "2026-12-31" },
      ergebnis_zusammenfassung: "8 Kategorien, Top: Software 487,32 €",
    });
  }
  if (/\b(umsatzsteuer|ust|vorsteuer)\b/i.test(eingabe)) {
    tools.push({
      name: "umsatzsteuer_stand",
      parameter: { periode: "Q2-2026" },
      ergebnis_zusammenfassung: "Zahllast Q2: 1.337,42 €",
    });
  }
  if (tools.length === 0) {
    tools.push({
      name: "cockpit_kennzahlen",
      parameter: { von: "2026-01-01", bis: "2026-12-31" },
      ergebnis_zusammenfassung: "YTD: +12.840 € Saldo",
    });
  }

  let aktion: ChatAktion | null = null;
  if (istSchreib) {
    const istUmbuchen = /\bbuche\b/i.test(eingabe);
    const istLoeschen = /\b(loesche|lösche)\b/i.test(eingabe);
    aktion = {
      id: `akt-${Date.now()}`,
      aktion: istLoeschen
        ? "loesche_kategorie"
        : istUmbuchen
          ? "bucheBuchungenUm"
          : "lege_kategorie_an",
      titel: istLoeschen
        ? "Kategorie löschen"
        : istUmbuchen
          ? "Buchungen umbuchen"
          : "Neue Kategorie anlegen",
      vorschau: istLoeschen
        ? "Die Kategorie wird gelöscht. 7 Buchungen verlieren ihre Zuordnung und fallen zurück in die Prüfliste."
        : istUmbuchen
          ? "Die markierten Buchungen werden auf die neue Kategorie umgebucht. Steuerrelevanz wird entsprechend angepasst."
          : "Eine neue Kategorie wird angelegt und steht ab sofort für die Klassifizierung zur Verfügung.",
      parameter: { quelle: "mock", eingabe },
      vorher_nachher: istUmbuchen
        ? [
            {
              id: "b-mock-1",
              datum: "12.05.2026",
              empfaenger: "Beispiel GmbH",
              betrag: "199,00 €",
              vorher: "Unklar",
              nachher: "Software",
            },
            {
              id: "b-mock-2",
              datum: "18.05.2026",
              empfaenger: "Beispiel GmbH",
              betrag: "199,00 €",
              vorher: "Unklar",
              nachher: "Software",
            },
          ]
        : null,
      status: "pending_confirm",
      ausgefuehrt_am: null,
      fehler_text: null,
    };
  }

  return { tools, aktion };
}

// ---------------------------------------------------------------------------
// Aktions-Bestaetigung / Abbruch (Confirm-Flow)
// ---------------------------------------------------------------------------

/**
 * Simuliert das Bestaetigen einer Aktion. 800 ms Verzoegerung + zufaelliger
 * 5 % Fehler-Fall, damit der Error-State im UI getestet werden kann.
 *
 * TODO Backend: ersetze durch
 *   POST /api/chat/[konversation_id]/aktion/[aktion_id]/bestaetigen
 */
export async function mockAktionBestaetigen(
  aktion_id: string,
): Promise<{ ok: true; ausgefuehrt_am: string } | { ok: false; fehler: string }> {
  await pause(800);
  // Deterministisch: aktion_id endet mit "fehler" -> Fehler-Pfad
  if (aktion_id.endsWith("fehler")) {
    return { ok: false, fehler: "Datensatz wurde zwischenzeitlich geändert." };
  }
  return { ok: true, ausgefuehrt_am: JETZT() };
}

/**
 * Simuliert das Abbrechen einer Aktion.
 *
 * TODO Backend: ersetze durch
 *   POST /api/chat/[konversation_id]/aktion/[aktion_id]/abbrechen
 */
export async function mockAktionAbbrechen(
  _aktion_id: string,
): Promise<{ ok: true }> {
  await pause(300);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type {
  ChatAktion,
  ChatKonversation,
  ChatNachricht,
  ChatNachrichtRolle,
  ToolBadge,
};
