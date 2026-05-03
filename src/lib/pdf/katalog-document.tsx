/* eslint-disable jsx-a11y/alt-text -- Image hier ist @react-pdf/renderer (PDF), nicht <img>. alt-Attribut existiert nicht. */
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { getSpaltenDefinition, formatSpaltenWert } from "@/lib/katalog-column-map";
import { htmlToPlainText, isHtmlContent } from "@/lib/rich-text/sanitize";

// ===========================================================================
// Types
// ===========================================================================

export type KatalogParams = {
  layout: "lichtengros" | "eisenkeil";
  /**
   * Preisspur, die im Katalog gedruckt wird.
   * Drei Spuren (PROJ-37). Backwards-Compat: Alt-Jobs mit `"ek"` werden vom
   * Job-Runner auf `"lichtengros"` gemappt.
   */
  preisauswahl: "lichtengros" | "eisenkeil" | "listenpreis";
  preisAenderung: "plus" | "minus";
  preisProzent: number;
  waehrung: "EUR" | "CHF";
  wechselkurs: number;
  sprache?: "de";
  /**
   * Whitelist der zu druckenden Produkte (PROJ-37). NULL/undefined = alle.
   * Job-Runner entfernt Bereiche/Kategorien aus den Maps, deren Produkte
   * komplett rausgefiltert wurden — der Renderer iteriert nur über sichtbare.
   */
  produktIds?: string[] | null;
};

export type PdfImage = { data: Buffer; format: "jpg" | "png" } | null;

/**
 * Drei Preisspuren pro Produkt (siehe `aktuelle_preise_flat`).
 * Beibehaltene Legacy-Spalten:
 *   - `ek` ist Alias für `lichtengros` (Backwards-Compat zur alten `"ek"`-Spur).
 */
export type ProduktPreise = {
  listenpreis: number | null;
  lichtengros: number | null;
  eisenkeil: number | null;
  /** Alias für `lichtengros` — Renderer-Backwards-Compat. */
  ek: number | null;
};

export type KatalogData = {
  params: KatalogParams;
  bereiche: any[];
  kategorienByBereich: Map<string, any[]>;
  produkteByKategorie: Map<string, any[]>;
  preisByProdukt: Map<string, ProduktPreise | null>;
  hauptbildByProdukt: Map<string, PdfImage>;
  iconLabelsByProdukt: Map<string, string[]>;
  kategorieIconsByKategorie: Map<string, { label: string; url: PdfImage }[]>;
  bereichBildUrl: Map<string, PdfImage>;
  /**
   * Pro Kategorie bis zu 4 Bilder (Slot 1–4). Layout auf Katalog-Seite:
   *   Bild1 = breit mittig, Bild2 = breit unten links,
   *   Bild3 = hochkant rechts oben, Bild4 = rechts unten.
   */
  kategorieBilderByKategorie: Map<string, Record<1 | 2 | 3 | 4, PdfImage>>;
  logoUrl: PdfImage;
  coverVorneUrl: PdfImage;
  coverHintenUrl: PdfImage;
  copyrightText: string;
  filialenText: string;
  generatedAt: Date;
};

// ===========================================================================
// Styling — am Original-Katalog orientiert
// ===========================================================================

const DARK = "#3a3a3a";       // Cover- und Back-Cover-Hintergrund
const TEXT_DARK = "#1a1a1a";
const TEXT_MUTED = "#666";
const TEXT_LIGHT = "#ffffff";
const LINE = "#d4d4d4";
const LINE_DARK = "#1a1a1a";

const styles = StyleSheet.create({
  // ─── Cover (S.1) ─────────────────────────────────────────
  cover: {
    backgroundColor: DARK,
    padding: 0,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  coverImage: { width: "100%", height: "100%", objectFit: "cover" },
  coverTitle: {
    fontSize: 24,
    fontFamily: "Helvetica",
    color: TEXT_LIGHT,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 14,
    fontFamily: "Helvetica",
    color: TEXT_LIGHT,
    letterSpacing: 3,
    textAlign: "center",
    opacity: 0.85,
    marginBottom: 40,
  },
  coverSmall: {
    fontSize: 8,
    color: TEXT_LIGHT,
    letterSpacing: 1.5,
    opacity: 0.7,
    marginTop: 180,
    textAlign: "center",
  },
  coverSmallText: {
    fontSize: 7,
    color: TEXT_LIGHT,
    opacity: 0.6,
    marginTop: 4,
    textAlign: "center",
  },

  // ─── Dunkle leere Rückseite (S.2) ────────────────────────
  emptyDark: { backgroundColor: DARK, flex: 1 },

  // ─── Index (S.3) ─────────────────────────────────────────
  indexPage: { padding: "50 50 50 50", fontFamily: "Helvetica" },
  indexTitle: {
    fontSize: 28,
    fontWeight: 400,
    color: TEXT_DARK,
    letterSpacing: 2,
    marginBottom: 22,
  },
  indexSeparator: { borderTopWidth: 0.75, borderColor: LINE_DARK, marginBottom: 2 },
  indexRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: LINE,
  },
  indexName: {
    flex: 1,
    fontSize: 10,
    color: TEXT_DARK,
    letterSpacing: 0.8,
  },
  indexPages: {
    fontSize: 10,
    color: TEXT_DARK,
    width: 90,
    textAlign: "right",
    paddingRight: 18,
  },
  indexDot: { width: 12, height: 12, borderRadius: 6 },

  // ─── Bereich-Intro (Vollbild + Label-Band) ───────────────
  bereichIntro: { padding: 0, position: "relative", flex: 1 },
  bereichBild: { width: "100%", height: "100%", objectFit: "cover" },
  bereichLabelBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 120,
    height: 60,
    backgroundColor: "rgba(20,20,20,0.55)",
    justifyContent: "center",
    paddingRight: 50,
  },
  bereichLabelText: {
    color: TEXT_LIGHT,
    fontSize: 22,
    letterSpacing: 2,
    fontWeight: 700,
    textAlign: "right",
  },
  bereichFallback: {
    flex: 1,
    backgroundColor: DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  bereichFallbackText: {
    color: TEXT_LIGHT,
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: 4,
  },

  // ─── Kategorie-Seite ─────────────────────────────────────
  kategoriePage: {
    padding: "34 34 40 34",
    fontFamily: "Helvetica",
    fontSize: 8.5,
  },
  kategorieHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  kategorieHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  pageNumBox: { fontSize: 9, color: TEXT_DARK },
  bereichMarkerBox: { width: 10, height: 10, marginRight: 4 },
  bereichLabelTop: {
    fontSize: 9,
    color: TEXT_DARK,
    letterSpacing: 1,
  },

  kategorieTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  kategorieTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: TEXT_DARK,
    letterSpacing: 0.5,
  },
  iconBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    maxWidth: "60%",
    justifyContent: "flex-end",
  },
  iconBox: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImg: { width: 32, height: 32, objectFit: "contain" },
  iconLabel: {
    fontSize: 6,
    color: TEXT_DARK,
    textAlign: "center",
    marginTop: 2,
  },

  descriptionBlock: { marginBottom: 10 },
  descriptionText: { fontSize: 9, lineHeight: 1.4, color: TEXT_DARK },
  techDatenTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: TEXT_DARK,
    marginTop: 4,
    marginBottom: 2,
  },
  bulletLine: { fontSize: 9, color: TEXT_DARK, lineHeight: 1.4 },

  topSplit: { flexDirection: "row", gap: 14, marginBottom: 14 },
  leftColumn: { flex: 1 },
  rightColumn: { width: 200, gap: 8 },
  mainImage: { width: "100%", height: 130, objectFit: "cover" },
  secondaryImage: { width: "100%", height: 110, objectFit: "cover" },

  // 4-Bild-Block (FileMaker-Anordnung) — unter Beschreibung+Icons, über der Tabelle
  bilderBlock: {
    flexDirection: "row",
    gap: 4,
    height: 150,
    marginBottom: 12,
  },
  bilderLeftColumn: {
    flex: 3,
    flexDirection: "column",
    gap: 4,
  },
  bilderRightColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  bildWide: { width: "100%", flex: 1, objectFit: "cover", backgroundColor: "#f3f3f3" },
  bildTall: { width: "100%", flex: 2, objectFit: "cover", backgroundColor: "#f3f3f3" },
  bildSmall: { width: "100%", flex: 1, objectFit: "cover", backgroundColor: "#f3f3f3" },
  bildEmpty: { backgroundColor: "#f3f3f3" },

  technicalDrawing: {
    width: "100%",
    height: 100,
    marginBottom: 14,
    objectFit: "contain",
  },

  // Varianten-Tabelle
  table: { marginTop: 6 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 7,
    color: TEXT_LIGHT,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.3,
    borderColor: LINE,
    minHeight: 24,
  },
  tableCell: { fontSize: 7.5, color: TEXT_DARK },
  thumbCell: { width: 32, paddingRight: 4 },
  thumbImg: { width: 28, height: 20, objectFit: "contain" },

  // Seitenfuß
  footer: {
    position: "absolute",
    bottom: 14,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: TEXT_MUTED },

  // ─── Copyright + Back-Cover ──────────────────────────────
  copyrightPage: {
    backgroundColor: DARK,
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 50,
  },
  copyrightText: {
    fontSize: 8,
    color: TEXT_LIGHT,
    opacity: 0.7,
    textAlign: "center",
    lineHeight: 1.6,
    marginBottom: 40,
  },
  backCoverText: {
    fontSize: 9,
    color: TEXT_LIGHT,
    opacity: 0.6,
    textAlign: "center",
  },
});

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Berechnet den im Katalog gedruckten Preis.
 *
 * Rückgabewert:
 *   - `number` → kommerziell auf 2 Nachkommastellen gerundet, ≥ 0
 *   - `null`   → keine Preisspalte in der gewählten Spur gesetzt → "auf Anfrage"
 *
 * Backwards-Compat: Eingabe-Spur `"ek"` (Alt-Schema) wird auf `"lichtengros"` gemappt.
 *
 * Rundungs-Strategie: Erst Faktor + Währungs-Konversion, dann eine einzige Rundung
 * am Ende (kommerziell, half-up). Negative Endwerte werden auf `0.00` gekappt
 * (Edge-Case bei großem Minus-Aufschlag).
 */
export function calcPrice(
  p: ProduktPreise | null | undefined,
  params: KatalogParams,
): number | null {
  if (!p) return null;

  const spur =
    (params.preisauswahl as string) === "ek" ? "lichtengros" : params.preisauswahl;
  const base =
    spur === "lichtengros" ? p.lichtengros :
    spur === "eisenkeil"   ? p.eisenkeil   :
    /* listenpreis */        p.listenpreis;

  if (base == null) return null;

  const factor = 1 + (params.preisAenderung === "plus" ? 1 : -1) * (params.preisProzent / 100);
  let final = base * factor;
  if (params.waehrung === "CHF") final *= params.wechselkurs;

  if (!Number.isFinite(final)) return null;
  if (final < 0) final = 0;

  // Kommerzielle Rundung (half-up), 2 Nachkommastellen
  return Math.round(final * 100) / 100;
}

function spaltenOf(kategorie: any): (string | null)[] {
  return [
    kategorie.spalte_1, kategorie.spalte_2, kategorie.spalte_3,
    kategorie.spalte_4, kategorie.spalte_5, kategorie.spalte_6,
    kategorie.spalte_7, kategorie.spalte_8, kategorie.spalte_9,
  ];
}

function activeSpalten(kategorie: any): { index: number; label: string; def: ReturnType<typeof getSpaltenDefinition> }[] {
  const result: { index: number; label: string; def: ReturnType<typeof getSpaltenDefinition> }[] = [];
  spaltenOf(kategorie).forEach((label, i) => {
    if (!label) return;
    const def = getSpaltenDefinition(label);
    if (!def) return;
    result.push({ index: i, label, def });
  });
  return result;
}

// Bullet-Liste aus Beschreibung bauen (Zeilen mit "•" werden als Bullets dargestellt)
function parseBeschreibung(text: string | null | undefined): { intro: string | null; bullets: string[] } {
  if (!text) return { intro: null, bullets: [] };
  const plain = isHtmlContent(text) ? htmlToPlainText(text) : text;
  const lines = plain.split(/\r?\n/);
  const bullets: string[] = [];
  const introLines: string[] = [];
  let hitBullet = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
      hitBullet = true;
      bullets.push(trimmed.replace(/^[•\-*]\s*/, ""));
    } else if (!hitBullet) {
      introLines.push(trimmed);
    } else {
      bullets.push(trimmed);
    }
  }
  return { intro: introLines.join(" ") || null, bullets };
}

// ===========================================================================
// Document
// ===========================================================================

export function KatalogDocument(d: KatalogData) {
  const isLichtengros = d.params.layout === "lichtengros";
  const brandName = isLichtengros ? "LICHT.ENGROS" : "EISENKEIL";
  const subtitle = "ARCHITECTURAL";

  return (
    <Document title={`${brandName} Katalog`}>
      {/* ═════════ COVER S.1 ═════════ */}
      <Page size="A4" style={styles.cover}>
        {d.coverVorneUrl ? (
          <Image src={d.coverVorneUrl} style={styles.coverImage} />
        ) : (
          <View style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}>
            <Text style={styles.coverTitle}>{brandName}</Text>
            <Text style={styles.coverSubtitle}>{subtitle}</Text>
            <Text style={styles.coverSmall}>PRICELIST</Text>
            <Text style={styles.coverSmallText}>
              {d.params.waehrung === "EUR" ? "Preisangaben in Euro" : "Preisangaben in Schweizer Franken"}
            </Text>
          </View>
        )}
      </Page>

      {/* ═════════ S.2: Leere dunkle Seite ═════════ */}
      <Page size="A4" style={styles.emptyDark} />

      {/* ═════════ S.3: INDEX ═════════ */}
      <Page size="A4" style={styles.indexPage}>
        <Text style={styles.indexTitle}>INDEX</Text>
        <View style={styles.indexSeparator} />
        {d.bereiche.map((b) => {
          const kategorien = d.kategorienByBereich.get(b.id) ?? [];
          const first = b.startseite ?? kategorien[0]?.startseite ?? null;
          const last = b.endseite ?? kategorien[kategorien.length - 1]?.endseite ?? null;
          const pageRange = first && last ? `${first} - ${last}` : first ? `${first}` : "—";
          return (
            <View key={b.id} style={styles.indexRow}>
              <Text style={styles.indexName}>{(b.name ?? "").toUpperCase()}</Text>
              <Text style={styles.indexPages}>{pageRange}</Text>
              <View style={[styles.indexDot, { backgroundColor: b.farbe || "#ddd" }]} />
            </View>
          );
        })}
        <Text
          style={[styles.footerText, { position: "absolute", bottom: 18, right: 34 }]}
          render={({ pageNumber }) => `${pageNumber}`}
          fixed
        />
      </Page>

      {/* ═════════ Pro Bereich ═════════ */}
      {d.bereiche.map((b) => {
        const kategorien = d.kategorienByBereich.get(b.id) ?? [];
        const bereichBild = d.bereichBildUrl.get(b.id);
        return (
          <React.Fragment key={b.id}>
            {/* Bereich-Intro-Seite (Vollbild) */}
            <Page size="A4" style={styles.bereichIntro}>
              {bereichBild ? (
                <>
                  <Image src={bereichBild} style={styles.bereichBild} />
                  <View style={styles.bereichLabelBand}>
                    <Text style={styles.bereichLabelText}>{(b.name ?? "").toUpperCase()}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.bereichFallback}>
                  <Text style={styles.bereichFallbackText}>{(b.name ?? "").toUpperCase()}</Text>
                </View>
              )}
            </Page>

            {/* Für jede Kategorie: Hauptseite + ggf. Fortsetzungsseiten */}
            {kategorien.map((k) => (
              <KategorieSeiten
                key={k.id}
                bereich={b}
                kategorie={k}
                produkte={d.produkteByKategorie.get(k.id) ?? []}
                preisByProdukt={d.preisByProdukt}
                hauptbildByProdukt={d.hauptbildByProdukt}
                kategorieIcons={d.kategorieIconsByKategorie.get(k.id) ?? []}
                kategorieBilder={d.kategorieBilderByKategorie.get(k.id) ?? { 1: null, 2: null, 3: null, 4: null }}
                params={d.params}
              />
            ))}
          </React.Fragment>
        );
      })}

      {/* ═════════ Copyright-Seite (dunkel) ═════════ */}
      <Page size="A4" style={styles.copyrightPage}>
        <View style={{ flex: 1 }} />
        <Text style={styles.copyrightText}>
          {d.copyrightText || "Copyright © von LICHT.ENGROS S.R.L."}
          {"\n"}LICHT.ENGROS S.R.L übernimmt keine Verantwortung für Druckfehler, Abmessungen, Beschreibungen oder falsche technische Daten.
          {"\n"}Das Unternehmen behält sich das Recht vor, die im vorliegenden Katalog enthaltenen Produkte und Preise jederzeit und ohne
          {"\n"}vorherige Ankündigung zu ändern. Jede unbefugte Vervielfältigung oder Kopie ist untersagt.
          {"\n"}Die angegebenen Preise sind exklusive Mehrwertsteuer.
        </Text>
      </Page>

      {/* ═════════ Back-Cover ═════════ */}
      <Page size="A4" style={styles.copyrightPage}>
        <View style={{ flex: 1 }} />
        <Text style={styles.backCoverText}>{isLichtengros ? "Lichtengros S.R.L." : "Eisenkeil GmbH"}</Text>
        <View style={{ flex: 1 }} />
      </Page>
    </Document>
  );
}

// ===========================================================================
// Kategorie-Seiten (Hauptseite + Fortsetzungen)
// ===========================================================================

function KategorieSeiten({
  bereich,
  kategorie,
  produkte,
  preisByProdukt,
  hauptbildByProdukt,
  kategorieIcons,
  kategorieBilder,
  params,
}: {
  bereich: any;
  kategorie: any;
  produkte: any[];
  preisByProdukt: Map<string, ProduktPreise | null>;
  hauptbildByProdukt: Map<string, PdfImage>;
  kategorieIcons: { label: string; url: PdfImage }[];
  kategorieBilder: Record<1 | 2 | 3 | 4, PdfImage>;
  params: KatalogParams;
}) {
  const spalten = activeSpalten(kategorie);
  const { intro, bullets } = parseBeschreibung(kategorie.beschreibung);

  // Auf erste Seite passen ~8 Zeilen (weil Hauptseite Beschreibung + Bilder + 8 Zeilen Platz),
  // Fortsetzungsseiten haben ~30 Zeilen
  const FIRST_PAGE_ROWS = 8;
  const CONTINUATION_ROWS = 30;

  const firstPageProdukte = produkte.slice(0, FIRST_PAGE_ROWS);
  const remaining = produkte.slice(FIRST_PAGE_ROWS);
  const continuationPages: any[][] = [];
  for (let i = 0; i < remaining.length; i += CONTINUATION_ROWS) {
    continuationPages.push(remaining.slice(i, i + CONTINUATION_ROWS));
  }

  return (
    <>
      {/* ─── Hauptseite ─── */}
      <Page size="A4" style={styles.kategoriePage}>
        {/* Top bar: Seitenzahl + Bereich-Marker + Bereich-Name */}
        <View style={styles.kategorieHeaderRow}>
          <View style={styles.kategorieHeaderLeft}>
            <Text style={styles.pageNumBox} render={({ pageNumber }) => `${pageNumber}`} fixed />
            <View style={[styles.bereichMarkerBox, { backgroundColor: bereich.farbe || "#ddd", marginLeft: 6 }]} />
          </View>
          <Text style={styles.bereichLabelTop}>{(bereich.name ?? "").toUpperCase()}</Text>
        </View>

        {/* Titel + Icons */}
        <View style={styles.kategorieTitleRow}>
          <Text style={styles.kategorieTitle}>{kategorie.name}</Text>
          {kategorieIcons.length > 0 && (
            <View style={styles.iconBar}>
              {kategorieIcons.slice(0, 10).map((ic, idx) => (
                <View key={idx} style={styles.iconBox}>
                  {ic.url ? <Image src={ic.url} style={styles.iconImg} /> : <Text style={styles.iconLabel}>{ic.label}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Beschreibung */}
        <View style={styles.leftColumn}>
          {intro && (
            <View style={styles.descriptionBlock}>
              <Text style={styles.descriptionText}>{intro}</Text>
            </View>
          )}
          {bullets.length > 0 && (
            <>
              <Text style={styles.techDatenTitle}>Technische Daten:</Text>
              {bullets.map((b, i) => (
                <Text key={i} style={styles.bulletLine}>• {b}</Text>
              ))}
            </>
          )}
        </View>

        {/* Bild-Block: FileMaker-Anordnung
              ┌──────────────────────┬──────┐
              │      Bild 1 (15×3)   │      │
              ├──────────────────────┤Bild3 │
              │      Bild 2 (15×3)   │(5×3) │
              │                      ├──────┤
              │                      │Bild4 │
              └──────────────────────┴──────┘
            Tatsächlich: linke Spalte enthält Bild1+Bild2 (je 1 Einheit hoch),
            rechte Spalte enthält Bild3 (2 Einheiten hoch) über Bild4 (1 Einheit hoch).
            Die Originalvorlage macht Bild3 doppelt so hoch wie Bild4.
        */}
        <View style={styles.bilderBlock}>
          <View style={styles.bilderLeftColumn}>
            {kategorieBilder[1]
              ? <Image src={kategorieBilder[1]} style={styles.bildWide} />
              : <View style={[styles.bildWide, styles.bildEmpty]} />}
            {kategorieBilder[2]
              ? <Image src={kategorieBilder[2]} style={styles.bildWide} />
              : <View style={[styles.bildWide, styles.bildEmpty]} />}
          </View>
          <View style={styles.bilderRightColumn}>
            {kategorieBilder[3]
              ? <Image src={kategorieBilder[3]} style={styles.bildTall} />
              : <View style={[styles.bildTall, styles.bildEmpty]} />}
            {kategorieBilder[4]
              ? <Image src={kategorieBilder[4]} style={styles.bildSmall} />
              : <View style={[styles.bildSmall, styles.bildEmpty]} />}
          </View>
        </View>

        {/* Tabelle der Varianten (erste N Zeilen) */}
        <VariantenTabelle
          spalten={spalten}
          produkte={firstPageProdukte}
          preisByProdukt={preisByProdukt}
          hauptbildByProdukt={hauptbildByProdukt}
          params={params}
          showHeader
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText} />
          <Text style={styles.footerText}>{(bereich.name ?? "").toUpperCase()}</Text>
        </View>
      </Page>

      {/* ─── Fortsetzungsseiten ─── */}
      {continuationPages.map((pageProdukte, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.kategoriePage}>
          <View style={styles.kategorieHeaderRow}>
            <View style={styles.kategorieHeaderLeft}>
              <Text style={styles.pageNumBox} render={({ pageNumber }) => `${pageNumber}`} fixed />
              <View style={[styles.bereichMarkerBox, { backgroundColor: bereich.farbe || "#ddd", marginLeft: 6 }]} />
            </View>
            <Text style={styles.bereichLabelTop}>{(bereich.name ?? "").toUpperCase()}</Text>
          </View>

          <VariantenTabelle
            spalten={spalten}
            produkte={pageProdukte}
            preisByProdukt={preisByProdukt}
            hauptbildByProdukt={hauptbildByProdukt}
            params={params}
            showHeader
          />

          <View style={styles.footer}>
            <Text style={styles.footerText} />
            <Text style={styles.footerText}>{(bereich.name ?? "").toUpperCase()}</Text>
          </View>
        </Page>
      ))}
    </>
  );
}

// ===========================================================================
// Varianten-Tabelle
// ===========================================================================

function VariantenTabelle({
  spalten,
  produkte,
  preisByProdukt,
  hauptbildByProdukt,
  params,
  showHeader,
}: {
  spalten: { index: number; label: string; def: ReturnType<typeof getSpaltenDefinition> }[];
  produkte: any[];
  preisByProdukt: Map<string, ProduktPreise | null>;
  hauptbildByProdukt: Map<string, PdfImage>;
  params: KatalogParams;
  showHeader: boolean;
}) {
  if (produkte.length === 0) return null;

  // Breiten berechnen: Thumb 32 + Artikel 130 + Spalten gleich verteilt auf Rest
  const reservedWidth = 32 + 130;
  const remainingSpalten = spalten.length || 1;
  const colWidth = `${Math.max(8, 80 / remainingSpalten)}%`;

  return (
    <View style={styles.table}>
      {showHeader && (
        <View style={styles.tableHeader}>
          <View style={styles.thumbCell} />
          <Text style={[styles.tableHeaderCell, { width: 130 }]}>Artikel</Text>
          {spalten.map((s) => (
            <Text
              key={s.index}
              style={[
                styles.tableHeaderCell,
                { flex: 1, textAlign: s.def?.align ?? "left", paddingHorizontal: 2 },
              ]}
            >
              {s.label}
            </Text>
          ))}
        </View>
      )}
      {produkte.map((p) => {
        const price = calcPrice(preisByProdukt.get(p.id), params);
        const thumb = hauptbildByProdukt.get(p.id);
        return (
          <View key={p.id} style={styles.tableRow} wrap={false}>
            <View style={styles.thumbCell}>
              {thumb ? <Image src={thumb} style={styles.thumbImg} /> : <View style={styles.thumbImg} />}
            </View>
            <Text style={[styles.tableCell, { width: 130 }]}>{p.artikelnummer}</Text>
            {spalten.map((s) => (
              <Text
                key={s.index}
                style={[
                  styles.tableCell,
                  { flex: 1, textAlign: s.def?.align ?? "left", paddingHorizontal: 2 },
                ]}
              >
                {s.def ? formatSpaltenWert(p, s.def, price, params.waehrung) : ""}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// Needed for React.Fragment usage above
import React from "react";
