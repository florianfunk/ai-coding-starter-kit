import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { ALL_PRODUKT_FIELDS } from "@/app/produkte/fields";

export type KatalogParams = {
  layout: "lichtengros" | "eisenkeil";
  preisauswahl: "listenpreis" | "ek";
  preisAenderung: "plus" | "minus";
  preisProzent: number;
  waehrung: "EUR" | "CHF";
  wechselkurs: number; // EUR -> CHF
};

export type KatalogData = {
  params: KatalogParams;
  bereiche: any[];           // ordered
  kategorienByBereich: Map<string, any[]>;
  produkteByKategorie: Map<string, any[]>;
  preisByProdukt: Map<string, { listenpreis: number; ek: number | null } | null>;
  hauptbildByProdukt: Map<string, string | null>;
  iconLabelsByProdukt: Map<string, string[]>;
  bereichBildUrl: Map<string, string | null>;
  logoUrl: string | null;
  coverVorneUrl: string | null;
  coverHintenUrl: string | null;
  copyrightText: string;
  filialenText: string;
  generatedAt: Date;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  cover: { padding: 0, justifyContent: "center", alignItems: "center", flex: 1 },
  coverImg: { width: "100%", height: "100%", objectFit: "cover" },
  coverFallback: { fontSize: 38, fontWeight: 700, letterSpacing: 4 },
  bereichPage: { padding: 28, justifyContent: "center", alignItems: "center" },
  bereichBild: { width: "80%", height: 320, objectFit: "contain", marginBottom: 18 },
  bereichTitel: { fontSize: 30, fontWeight: 700, letterSpacing: 2 },
  kategorieHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, paddingBottom: 4, marginBottom: 8 },
  kategorieTitle: { fontSize: 14, fontWeight: 700, letterSpacing: 1 },
  artikelRow: { flexDirection: "row", borderBottomWidth: 0.3, borderColor: "#ddd", paddingVertical: 3, fontSize: 8 },
  artNo: { width: "30%", fontFamily: "Courier" },
  artName: { width: "55%" },
  artPreis: { width: "15%", textAlign: "right" },
  toc: { padding: 28 },
  tocLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5, fontSize: 9 },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, fontSize: 7, color: "#888", flexDirection: "row", justifyContent: "space-between" },
  pageNumber: { position: "absolute", bottom: 14, right: 28, fontSize: 7, color: "#888" },
  produktPage: { padding: 28 },
  prodHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.5, paddingBottom: 4, marginBottom: 8 },
  topRow: { flexDirection: "row", gap: 12 },
  hauptbild: { width: "55%", height: 160, objectFit: "contain", backgroundColor: "#f5f5f5" },
  techCol: { width: "45%" },
  techRow: { fontSize: 8, marginBottom: 1 },
  iconBar: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 3 },
  iconBadge: { borderWidth: 0.5, paddingHorizontal: 4, paddingVertical: 2, fontSize: 7 },
  preisLine: { fontSize: 11, fontWeight: 700, marginTop: 8 },
});

function calcPrice(p: { listenpreis: number; ek: number | null } | null | undefined, params: KatalogParams) {
  if (!p) return null;
  const base = params.preisauswahl === "ek" ? (p.ek ?? p.listenpreis) : p.listenpreis;
  const factor = 1 + (params.preisAenderung === "plus" ? 1 : -1) * (params.preisProzent / 100);
  let final = base * factor;
  if (params.waehrung === "CHF") final *= params.wechselkurs;
  return final;
}

function formatPrice(value: number | null, currency: "EUR" | "CHF") {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value);
}

export function KatalogDocument(d: KatalogData) {
  const themeColor = d.params.layout === "lichtengros" ? "#2b6c8c" : "#7a3e3e";

  return (
    <Document title={`Lichtstudio Katalog ${d.params.layout}`}>
      {/* COVER vorne */}
      <Page size="A4" style={styles.cover}>
        {d.coverVorneUrl
          ? <Image src={d.coverVorneUrl} style={styles.coverImg} />
          : <Text style={styles.coverFallback}>{d.params.layout === "lichtengros" ? "LICHT.ENGROS" : "EISENKEIL"}</Text>}
      </Page>

      {/* INHALTSVERZEICHNIS */}
      <Page size="A4" style={styles.toc}>
        <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: themeColor }}>INHALT</Text>
        {d.bereiche.map((b, i) => (
          <View style={styles.tocLine} key={b.id}>
            <Text>{i + 1}. {b.name}</Text>
            <Text>{b.startseite ?? "—"}</Text>
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Pro Bereich */}
      {d.bereiche.map((b) => {
        const kategorien = d.kategorienByBereich.get(b.id) ?? [];
        return (
          <View key={b.id} wrap={false}>
            {/* Bereich-Startseite */}
            <Page size="A4" style={styles.bereichPage}>
              {d.bereichBildUrl.get(b.id) && (
                <Image src={d.bereichBildUrl.get(b.id)!} style={styles.bereichBild} />
              )}
              <Text style={[styles.bereichTitel, { color: themeColor }]}>{b.name?.toUpperCase()}</Text>
              <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
            </Page>

            {/* Pro Kategorie: Liste der Artikel + danach Datenblätter */}
            {kategorien.map((k) => {
              const produkte = d.produkteByKategorie.get(k.id) ?? [];
              return (
                <View key={k.id}>
                  <Page size="A4" style={styles.produktPage}>
                    <View style={[styles.kategorieHeader, { borderColor: themeColor }]}>
                      <Text style={[styles.kategorieTitle, { color: themeColor }]}>{k.name}</Text>
                      <Text>{b.name}</Text>
                    </View>
                    {k.beschreibung && <Text style={{ fontSize: 9, marginBottom: 6 }}>{k.beschreibung}</Text>}
                    {produkte.map((p) => {
                      const price = calcPrice(d.preisByProdukt.get(p.id), d.params);
                      return (
                        <View style={styles.artikelRow} key={p.id}>
                          <Text style={styles.artNo}>{p.artikelnummer}</Text>
                          <Text style={styles.artName}>{p.name ?? p.datenblatt_titel ?? ""}</Text>
                          <Text style={styles.artPreis}>{formatPrice(price, d.params.waehrung)}</Text>
                        </View>
                      );
                    })}
                    <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
                  </Page>

                  {/* Datenblätter */}
                  {produkte.map((p) => {
                    const techRows = ALL_PRODUKT_FIELDS
                      .map((f) => {
                        const v = (p as any)[f.col];
                        if (v == null || v === "") return null;
                        const valStr = f.type === "bool" ? (v ? "Ja" : "Nein") : String(v);
                        return { label: f.label, value: `${valStr}${f.unit ? ` ${f.unit}` : ""}` };
                      })
                      .filter(Boolean) as { label: string; value: string }[];
                    const price = calcPrice(d.preisByProdukt.get(p.id), d.params);
                    const hb = d.hauptbildByProdukt.get(p.id);
                    const icons = d.iconLabelsByProdukt.get(p.id) ?? [];
                    return (
                      <Page key={p.id} size="A4" style={styles.produktPage}>
                        <View style={[styles.prodHeader, { borderColor: themeColor }]}>
                          <Text style={{ fontFamily: "Courier", fontWeight: 700 }}>{p.artikelnummer}</Text>
                          <Text>{k.name}</Text>
                        </View>
                        {p.datenblatt_titel && <Text style={{ marginBottom: 6 }}>{p.datenblatt_titel}</Text>}
                        <View style={styles.topRow}>
                          {hb
                            ? <Image src={hb} style={styles.hauptbild} />
                            : <View style={styles.hauptbild} />}
                          <View style={styles.techCol}>
                            {techRows.slice(0, 22).map((r) => (
                              <Text style={styles.techRow} key={r.label}>• {r.label}: {r.value}</Text>
                            ))}
                          </View>
                        </View>
                        {icons.length > 0 && (
                          <View style={styles.iconBar}>
                            {icons.map((l) => <Text key={l} style={[styles.iconBadge, { borderColor: themeColor }]}>{l}</Text>)}
                          </View>
                        )}
                        <Text style={styles.preisLine}>Preis: {formatPrice(price, d.params.waehrung)}</Text>
                        {p.datenblatt_text && (
                          <Text style={{ fontSize: 8, marginTop: 8, lineHeight: 1.4 }}>{p.datenblatt_text}</Text>
                        )}
                        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
                      </Page>
                    );
                  })}
                </View>
              );
            })}
          </View>
        );
      })}

      {/* Copyright + Filialen */}
      <Page size="A4" style={styles.toc}>
        <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: themeColor }}>FILIALEN</Text>
        <Text style={{ fontSize: 9, whiteSpace: "pre-wrap" } as any}>{d.filialenText}</Text>
        <Text style={{ fontSize: 8, marginTop: 24, color: "#666" }}>{d.copyrightText}</Text>
        <Text style={{ fontSize: 7, marginTop: 12, color: "#aaa" }}>
          Stand: {d.generatedAt.toLocaleDateString("de-DE")}
        </Text>
      </Page>

      {/* COVER hinten */}
      {d.coverHintenUrl && (
        <Page size="A4" style={styles.cover}>
          <Image src={d.coverHintenUrl} style={styles.coverImg} />
        </Page>
      )}
    </Document>
  );
}
