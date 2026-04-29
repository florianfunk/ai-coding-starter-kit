import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { ALL_PRODUKT_FIELDS } from "@/app/produkte/fields";
import { RichTextPdf } from "@/lib/pdf/rich-text-pdf";
import { ensureHtml, isHtmlContent, htmlToPlainText } from "@/lib/rich-text/sanitize";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IconPdf = {
  label: string;
  /** signed URL für das Icon-Symbol — null wenn kein Bild hinterlegt */
  url: string | null;
  /** Freitext-Wert unter dem Icon (z.B. "4,8", "24VDC", "2700K") */
  wert: string | null;
};

export type DatenblattData = {
  produkt: any;
  hauptbildUrl: string | null;
  /** Bis zu 3 Detail-/Zeichnungsbilder (Detail1, Detail2, Zeichnung1) */
  detailUrls: (string | null)[];
  /** Technische Zeichnung mit Maßangaben (Zeichnung2 im FM-Original) */
  zeichnungUrl: string | null;
  energielabelUrl: string | null;
  icons: IconPdf[];
  layout: "lichtengros" | "eisenkeil";
  logoUrl: string | null;
  filialeFooter: string;
};

// ---------------------------------------------------------------------------
// Styling — am FileMaker-Original orientiert
// ---------------------------------------------------------------------------

const COLORS = {
  text: "#1a1a1a",
  muted: "#555",
  line: "#cfcfcf",
  lineDark: "#1a1a1a",
  iconActive: "#f2b71c", // warmes Gelb wie bei „2700K" im FM-Original
  iconBox: "#ffffff",
  iconBorder: "#1a1a1a",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontSize: 8.2,
    fontFamily: "Helvetica",
    color: COLORS.text,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.lineDark,
  },
  headerTitle: { fontSize: 9, letterSpacing: 1.4, color: COLORS.text },
  headerLogo: { height: 20, width: 130, objectFit: "contain" },
  headerLogoFallback: { fontSize: 12, fontWeight: 700, letterSpacing: 1 },

  // Titel-Block
  artNrLabel: { fontSize: 9, color: COLORS.muted },
  artNr: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
  produktUntertitel: { fontSize: 9, color: COLORS.text, marginTop: 2 },

  // Haupt-Split: Bild links, Tech rechts
  topRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  hauptbildWrap: {
    width: "58%",
    height: 160,
    backgroundColor: "#f7f7f7",
    borderWidth: 0.4,
    borderColor: COLORS.line,
  },
  hauptbild: { width: "100%", height: "100%", objectFit: "contain" },
  hauptbildEmpty: {
    textAlign: "center",
    marginTop: 75,
    color: "#bbb",
    fontStyle: "italic",
  },

  techCol: { width: "42%" },
  techTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  techRow: {
    flexDirection: "row",
    marginBottom: 0.8,
    fontSize: 7.6,
    lineHeight: 1.28,
  },
  techBullet: { width: 7, color: COLORS.text },
  techLabel: { flex: 1, color: COLORS.text },
  techValue: { color: COLORS.text },

  // Icon-Leiste
  iconRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    marginBottom: 2,
  },
  iconCell: {
    flex: 1,
    alignItems: "center",
  },
  iconBox: {
    width: "100%",
    aspectRatio: 1,
    borderWidth: 0.6,
    borderColor: COLORS.iconBorder,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.iconBox,
    padding: 4,
  },
  iconBoxActive: {
    backgroundColor: COLORS.iconActive,
    borderColor: COLORS.iconBorder,
  },
  iconImg: {
    width: "80%",
    height: "80%",
    objectFit: "contain",
  },
  iconFallbackLabel: {
    fontSize: 7,
    fontWeight: 700,
    textAlign: "center",
  },
  iconWertBox: {
    marginTop: 3,
    width: "100%",
    height: 12,
    borderWidth: 0.4,
    borderColor: COLORS.line,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWertBoxEmpty: {
    borderColor: "#ececec",
    backgroundColor: "#fff",
  },
  iconWert: { fontSize: 7.2, color: COLORS.text },

  // Energielabel rechts neben Icons (nur wenn vorhanden) — schlankes Feld
  iconEnergielabel: {
    width: 34,
    height: 44,
    objectFit: "contain",
    marginLeft: 4,
  },

  // DETAILS
  detailsTitle: {
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: 700,
  },
  detailsRow: { flexDirection: "row", gap: 6 },
  detailsCell: {
    width: "32%",
    height: 82,
    backgroundColor: "#f7f7f7",
    borderWidth: 0.4,
    borderColor: COLORS.line,
  },
  detailsImg: { width: "100%", height: "100%", objectFit: "cover" },
  detailsEmpty: {
    textAlign: "center",
    marginTop: 38,
    color: "#c0c0c0",
    fontStyle: "italic",
    fontSize: 7,
  },

  // Technische Zeichnung (Maßangaben) — volle Breite
  zeichnungWrap: {
    marginTop: 4,
    width: "100%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  zeichnungImg: { width: "100%", height: "100%", objectFit: "contain" },

  // Beschreibung
  beschreibung: {
    marginTop: 6,
    fontSize: 6.6,
    lineHeight: 1.35,
    color: COLORS.text,
  },

  // Warnhinweis
  warnung: {
    marginTop: 4,
    paddingTop: 3,
    borderTopWidth: 0.4,
    borderTopColor: COLORS.line,
    fontSize: 6.6,
    fontWeight: 700,
    lineHeight: 1.3,
    color: COLORS.text,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.line,
    paddingTop: 4,
  },
  footerBold: { fontWeight: 700, letterSpacing: 0.8 },
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Tech-Daten zu Bullet-Rows zusammenbauen, leere Felder überspringen */
function buildTechRows(produkt: any): { label: string; value: string }[] {
  return ALL_PRODUKT_FIELDS.map((f) => {
    const v = produkt[f.col];
    if (v == null || v === "") return null;
    const valStr = f.type === "bool" ? (v ? "Ja" : "Nein") : String(v);
    const unit = f.unit ? ` ${f.unit}` : "";
    return { label: f.label, value: `${valStr}${unit}` };
  }).filter(Boolean) as { label: string; value: string }[];
}

/** Datenblatt-Text in Fließtext + ACHTUNG-Block splitten.
 *  Im FM-Export enden die Beschreibungen oft mit einem Großbuchstaben-Hinweis
 *  („DIE INSTALLATION … DARF NUR DURCH …"). Alles, was ab dieser Zeile kommt,
 *  rendern wir fett am Fußende. */
function splitBeschreibung(raw: string | null | undefined): {
  body: string;
  warnung: string | null;
} {
  if (!raw) return { body: "", warnung: null };
  const plain = isHtmlContent(raw) ? htmlToPlainText(raw) : raw;
  // FileMaker verwendet \r als Absatztrenner — normalisieren
  const normalised = plain.replace(/\r\n?/g, "\n");
  const lines = normalised.split("\n");
  const warnIdx = lines.findIndex((l) => {
    const t = l.trim();
    if (!t) return false;
    // typische FM-Warnzeilen: "ACHTUNG:" oder Großbuchstaben-Installationshinweis
    if (/^ACHTUNG\b/i.test(t)) return true;
    if (/INSTALLATION.*ELEKTROFACHKRAFT/i.test(t)) return true;
    if (/LAIENHAFTE VORGEHENSWEISE/i.test(t)) return true;
    return false;
  });
  if (warnIdx < 0) {
    return { body: normalised.trim(), warnung: null };
  }
  const body = lines.slice(0, warnIdx).join("\n").trim();
  const warnung = lines
    .slice(warnIdx)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  return { body, warnung };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatenblattDocument(props: DatenblattData) {
  const {
    produkt,
    hauptbildUrl,
    detailUrls,
    zeichnungUrl,
    energielabelUrl,
    icons,
    layout,
    logoUrl,
    filialeFooter,
  } = props;

  const techRows = buildTechRows(produkt);
  const today = new Date().toLocaleDateString("de-DE");
  const { body: beschreibungBody, warnung } = splitBeschreibung(produkt.datenblatt_text);

  // Icons auf genau 10 Slots auffüllen, damit das Raster bündig ist
  const iconSlots: (IconPdf | null)[] = Array.from({ length: 10 }, (_, i) => icons[i] ?? null);

  const detailsSafe: (string | null)[] = [detailUrls[0] ?? null, detailUrls[1] ?? null, detailUrls[2] ?? null];

  return (
    <Document title={`Datenblatt ${produkt.artikelnummer}`}>
      <Page size="A4" style={styles.page}>
        {/* ─── Header ─── */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>PRODUKTDATENBLATT</Text>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.headerLogo} />
          ) : (
            <Text style={styles.headerLogoFallback}>
              {layout === "lichtengros" ? "LICHT.ENGROS" : "EISENKEIL"}
            </Text>
          )}
        </View>

        {/* ─── Artikelnummer + Untertitel ─── */}
        <View>
          <Text>
            <Text style={styles.artNrLabel}>Artikelnummer: </Text>
            <Text style={styles.artNr}>{produkt.artikelnummer}</Text>
          </Text>
          {(produkt.info_kurz || produkt.datenblatt_titel) && (
            <Text style={styles.produktUntertitel}>
              {produkt.info_kurz || produkt.datenblatt_titel}
            </Text>
          )}
        </View>

        {/* ─── Hauptbild links / Tech-Daten rechts ─── */}
        <View style={styles.topRow}>
          <View style={styles.hauptbildWrap}>
            {hauptbildUrl ? (
              <Image src={hauptbildUrl} style={styles.hauptbild} />
            ) : (
              <Text style={styles.hauptbildEmpty}>(kein Bild)</Text>
            )}
          </View>

          <View style={styles.techCol}>
            <Text style={styles.techTitle}>TECHNISCHE DATEN</Text>
            {techRows.map((r) => (
              <View style={styles.techRow} key={r.label}>
                <Text style={styles.techBullet}>• </Text>
                <Text style={styles.techLabel}>
                  {r.label}: <Text style={styles.techValue}>{r.value}</Text>
                </Text>
              </View>
            ))}
            {techRows.length === 0 && (
              <Text style={{ color: "#aaa", fontStyle: "italic", fontSize: 8 }}>
                (keine technischen Daten)
              </Text>
            )}
          </View>
        </View>

        {/* ─── Icon-Leiste: Symbol oben, Wert darunter — FileMaker-Look ─── */}
        <View style={styles.iconRow}>
          {iconSlots.map((ic, idx) => {
            if (!ic) {
              // leerer Slot — schmales Platzhalter-Feld für Raster-Balance
              return <View key={`empty-${idx}`} style={styles.iconCell} />;
            }
            const isLichtfarbe = /^\d{4}\s*K?$/i.test(ic.label.trim());
            return (
              <View key={`${ic.label}-${idx}`} style={styles.iconCell}>
                <View style={isLichtfarbe ? [styles.iconBox, styles.iconBoxActive] : styles.iconBox}>
                  {ic.url ? (
                    <Image src={ic.url} style={styles.iconImg} />
                  ) : (
                    <Text style={styles.iconFallbackLabel}>{ic.label}</Text>
                  )}
                </View>
                <View
                  style={ic.wert ? styles.iconWertBox : [styles.iconWertBox, styles.iconWertBoxEmpty]}
                >
                  {ic.wert ? <Text style={styles.iconWert}>{ic.wert}</Text> : null}
                </View>
              </View>
            );
          })}
          {energielabelUrl && (
            <Image src={energielabelUrl} style={styles.iconEnergielabel} />
          )}
        </View>

        {/* ─── DETAILS: bis zu 3 Bilder ─── */}
        <Text style={styles.detailsTitle}>DETAILS</Text>
        <View style={styles.detailsRow}>
          {detailsSafe.map((url, i) => (
            <View key={i} style={styles.detailsCell}>
              {url ? (
                <Image src={url} style={styles.detailsImg} />
              ) : (
                <Text style={styles.detailsEmpty}>—</Text>
              )}
            </View>
          ))}
        </View>

        {/* ─── Technische Zeichnung mit Maßangaben ─── */}
        {zeichnungUrl && (
          <View style={styles.zeichnungWrap}>
            <Image src={zeichnungUrl} style={styles.zeichnungImg} />
          </View>
        )}

        {/* ─── Beschreibung + Warnhinweis ─── */}
        {beschreibungBody && (
          <View style={styles.beschreibung}>
            <RichTextPdf
              html={ensureHtml(beschreibungBody)}
              options={{ fontSize: 6.6, color: COLORS.text }}
            />
          </View>
        )}
        {warnung && <Text style={styles.warnung}>{warnung}</Text>}

        {/* ─── Footer ─── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerBold}>{filialeFooter}</Text>
          <Text>Stand: {today}</Text>
        </View>
      </Page>
    </Document>
  );
}
