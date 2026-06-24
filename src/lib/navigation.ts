// PROJ-29: Gemeinsame Navigations-Quelle für Sidebar und Command-Palette.
//
// Hier liegt die hartkodierte Navigationsstruktur, die zuvor in
// app-sidebar.tsx wohnte. Sidebar (AppSidebar) UND Command-Palette beziehen
// ihre Einträge aus dieser einen Datei — kein Duplikat (AC3).
//
// Bereichs-Trennung mit klarem Workflow-Fokus:
//   Heute   — täglich/wöchentlich angefasste Ansichten
//   Bücher  — Buchhaltung: Buchungen, Belege, Analyse
//   Steuer  — Steuer-Endprodukte
//   Setup   — Stammdaten + System-Konfiguration

export interface NavEintrag {
  href: string;
  label: string;
}

export interface NavSektion {
  titel: string;
  eintraege: NavEintrag[];
}

const NAV_HEUTE: NavEintrag[] = [
  { href: "/dashboard", label: "Dashboard" },
  // PROJ-17 — KI-Chat: prominenter Einstiegspunkt im Bereich "Heute",
  // weil die tägliche Interaktion mit dem Agenten über den Chat läuft.
  { href: "/chat", label: "KI-Chat" },
  { href: "/pruefliste", label: "Prüfliste" },
  { href: "/merkliste", label: "Merkliste" },
  { href: "/kuendigungen", label: "Kündigungen" },
];

const NAV_BUECHER: NavEintrag[] = [
  { href: "/buchungen", label: "Buchungen" },
  { href: "/klassifizierung", label: "Klassifizierung" },
  // PROJ-15 P2 (#3): Kandidatenliste für neue Lernregeln.
  { href: "/klassifizierung/haeufige-empfaenger", label: "Häufige Empfänger" },
  { href: "/kategorien-analyse", label: "Kategorien-Analyse" },
  { href: "/lieferanten-notizen", label: "Lieferanten-Notizen" },
  { href: "/abgleich", label: "Beleg-Abgleich" },
  { href: "/belege", label: "Belege" },
];

const NAV_STEUER: NavEintrag[] = [
  { href: "/ust-voranmeldung", label: "USt-Voranmeldung" },
  { href: "/euer", label: "EÜR" },
  { href: "/einkommensteuer", label: "Einkommensteuer" },
  { href: "/export", label: "Export" },
];

const SETTINGS: NavEintrag[] = [
  { href: "/profil", label: "Mein Profil" },
  { href: "/einstellungen/firma", label: "Firma & Steuerprofil" },
  { href: "/einstellungen/kontenrahmen", label: "Kontenrahmen" },
  { href: "/einstellungen/konten", label: "Bankkonten" },
  { href: "/einstellungen/paperless", label: "Paperless" },
  { href: "/einstellungen/regeln", label: "Lernregeln" },
  { href: "/einstellungen/admin", label: "Admin" },
];

// Block-Reihenfolge der Sidebar. Titel + zugehörige Einträge werden je
// als eigener Container gerendert — so bleibt der Abstand zwischen den
// Blöcken groß, die Einträge innerhalb eines Blocks aber eng zusammen.
export const NAV_SEKTIONEN: NavSektion[] = [
  { titel: "Heute", eintraege: NAV_HEUTE },
  { titel: "Bücher", eintraege: NAV_BUECHER },
  { titel: "Steuer", eintraege: NAV_STEUER },
  { titel: "Setup", eintraege: SETTINGS },
];

// Pro Bereich eine eigene Akzentfarbe — macht die Sidebar-Navigation auf
// einen Blick scanbar und greift die Marken-Palette aus globals.css auf.
export const SECTION_COLORS: Record<string, string> = {
  Heute: "var(--brand-violet)",
  "Bücher": "var(--brand-cyan)",
  Steuer: "var(--brand-cerise)",
  Setup: "var(--brand-shaft)",
};
