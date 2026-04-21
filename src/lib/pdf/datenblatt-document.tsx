import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { ALL_PRODUKT_FIELDS } from "@/app/produkte/fields";
import { RichTextPdf } from "@/lib/pdf/rich-text-pdf";
import { ensureHtml } from "@/lib/rich-text/sanitize";

export type DatenblattData = {
  produkt: any;
  hauptbildUrl: string | null;
  galerieUrls: string[];
  iconLabels: string[];
  layout: "lichtengros" | "eisenkeil";
  logoUrl: string | null;
  filialeFooter: string;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#000" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headerLeft: { fontSize: 9, color: "#444", letterSpacing: 1 },
  logo: { width: 110, height: 22, objectFit: "contain" },
  artNr: { fontSize: 10, color: "#333", marginTop: 2 },
  produktTitel: { fontSize: 9, color: "#333", marginBottom: 8 },
  hr: { borderTopWidth: 0.5, borderTopColor: "#999", marginVertical: 6 },
  topRow: { flexDirection: "row", gap: 12 },
  hauptbild: { width: "55%", height: 170, objectFit: "contain", backgroundColor: "#f5f5f5" },
  techCol: { width: "45%" },
  techTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4, letterSpacing: 1 },
  techRow: { flexDirection: "row", marginBottom: 1.5 },
  techLabel: { color: "#222" },
  iconBar: { flexDirection: "row", flexWrap: "wrap", marginVertical: 8, gap: 3 },
  iconBadge: { borderWidth: 0.5, borderColor: "#888", paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, color: "#222" },
  detailsTitle: { fontSize: 8, marginTop: 10, marginBottom: 6, color: "#666", letterSpacing: 1 },
  galleryGrid: { flexDirection: "row", gap: 6 },
  galleryItem: { width: "32%", height: 95, objectFit: "cover", backgroundColor: "#f5f5f5" },
  beschreibung: { marginTop: 12, fontSize: 8, lineHeight: 1.4, color: "#222" },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 7, color: "#888", flexDirection: "row", justifyContent: "space-between" },
});

export function DatenblattDocument(props: DatenblattData) {
  const { produkt, hauptbildUrl, galerieUrls, iconLabels, layout, logoUrl, filialeFooter } = props;
  const themeColor = layout === "lichtengros" ? "#2b6c8c" : "#7a3e3e";
  const today = new Date().toLocaleDateString("de-DE");

  const techRows = ALL_PRODUKT_FIELDS
    .map((f) => {
      const v = produkt[f.col];
      if (v == null || v === "") return null;
      const valStr = f.type === "bool" ? (v ? "Ja" : "Nein") : String(v);
      const unit = f.unit ? ` ${f.unit}` : "";
      return { label: f.label, value: `${valStr}${unit}` };
    })
    .filter(Boolean) as { label: string; value: string }[];

  return (
    <Document title={`Datenblatt ${produkt.artikelnummer}`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: themeColor, paddingBottom: 4 }]}>
          <Text style={styles.headerLeft}>PRODUKTDATENBLATT</Text>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : <Text style={{ fontSize: 14, fontWeight: 700 }}>{layout.toUpperCase()}</Text>}
        </View>

        <Text style={styles.artNr}>Artikelnummer: <Text style={{ fontWeight: 700 }}>{produkt.artikelnummer}</Text></Text>
        {produkt.datenblatt_titel && <Text style={styles.produktTitel}>{produkt.datenblatt_titel}</Text>}

        <View style={styles.topRow}>
          {hauptbildUrl
            ? <Image src={hauptbildUrl} style={styles.hauptbild} />
            : <View style={styles.hauptbild}><Text style={{ textAlign: "center", marginTop: 70, color: "#aaa" }}>kein Bild</Text></View>
          }
          <View style={styles.techCol}>
            <Text style={[styles.techTitle, { color: themeColor }]}>TECHNISCHE DATEN</Text>
            {techRows.map((r) => (
              <View style={styles.techRow} key={r.label}>
                <Text style={styles.techLabel}>• {r.label}: <Text style={{ color: "#444" }}>{r.value}</Text></Text>
              </View>
            ))}
            {techRows.length === 0 && <Text style={{ color: "#aaa", fontStyle: "italic" }}>(keine technischen Daten)</Text>}
          </View>
        </View>

        {iconLabels.length > 0 && (
          <View style={styles.iconBar}>
            {iconLabels.map((l) => (
              <Text key={l} style={[styles.iconBadge, { borderColor: themeColor }]}>{l}</Text>
            ))}
          </View>
        )}

        {galerieUrls.length > 0 && (
          <>
            <Text style={styles.detailsTitle}>DETAILS</Text>
            <View style={styles.galleryGrid}>
              {galerieUrls.slice(0, 3).map((url, i) => (
                <Image key={i} src={url} style={styles.galleryItem} />
              ))}
            </View>
          </>
        )}

        {produkt.datenblatt_text && (
          <View style={styles.beschreibung}>
            <RichTextPdf html={ensureHtml(produkt.datenblatt_text)} options={{ fontSize: 8, color: "#222" }} />
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{filialeFooter}</Text>
          <Text>Stand: {today}</Text>
        </View>
      </Page>
    </Document>
  );
}
