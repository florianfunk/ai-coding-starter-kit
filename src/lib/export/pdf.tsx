// PROJ-11: PDF-Generatoren (server-only) via @react-pdf/renderer.
//
// Erzeugt formatierte Aufstellungen mit Firmenkopf (PROJ-1):
//  - EÜR-Aufstellung (Wirtschaftsjahr)
//  - USt-VA (Periode), inkl. ELSTER-Kennzahlen
//  - Privatentnahmen-Aufstellung (dedizierter, privater Export)
//
// Wichtig: NUR serverseitig verwenden (renderToBuffer). Bei nicht
// abgeschlossener Periode/Jahr wird ein deutlicher „vorläufig"-Vermerk
// (Wasserzeichen + Kopfhinweis) gerendert, damit weitergegebene Dateien
// erkennbar nicht final sind. Reproduzierbar: gleicher Input → gleicher
// inhaltlicher Output.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { JSX } from "react";
import type { EuerErgebnis } from "@/lib/tax/euer";
import type { UstBerechnung } from "@/lib/tax/ust";

/** Firmenstammdaten für den Kopf (Teilmenge des Firmenprofils, PROJ-1). */
export interface FirmenKopf {
  firmenname: string;
  inhaber: string;
  steuernummer: string | null;
  ust_idnr: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  finanzamt: string | null;
}

/** Eine Privatentnahme-Zeile für die dedizierte Aufstellung. */
export interface PrivatentnahmeZeile {
  datum: string;
  betrag: number;
  bezeichnung: string;
  verwendungszweck: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    paddingBottom: 8,
    marginBottom: 16,
  },
  firma: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  metaZeile: { fontSize: 9, color: "#555555", marginTop: 2 },
  titel: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  untertitel: { fontSize: 10, color: "#555555", marginBottom: 16 },
  vorlaeufig: {
    backgroundColor: "#fdecea",
    borderWidth: 1,
    borderColor: "#d93025",
    color: "#a50e0e",
    padding: 6,
    marginBottom: 14,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  abschnittTitel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  tabelle: { width: "100%" },
  zeile: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
    paddingVertical: 3,
  },
  zeileKopf: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },
  zeileSumme: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#999999",
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  colText: { flex: 1, paddingRight: 6 },
  colSchmal: { width: 70, paddingRight: 6 },
  colBetrag: { width: 90, textAlign: "right" },
  watermark: {
    position: "absolute",
    top: 320,
    left: 90,
    fontSize: 70,
    color: "#d93025",
    opacity: 0.12,
    transform: "rotate(-30deg)",
    fontFamily: "Helvetica-Bold",
  },
  fuss: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#999999",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#dddddd",
    paddingTop: 4,
  },
});

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
function euro(n: number): string {
  return EUR.format(n);
}
function datum(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function Kopf({
  firma,
  titel,
  untertitel,
  vorlaeufig,
}: {
  firma: FirmenKopf;
  titel: string;
  untertitel: string;
  vorlaeufig: boolean;
}): JSX.Element {
  const adresse = [
    firma.strasse,
    [firma.plz, firma.ort].filter(Boolean).join(" "),
  ]
    .filter((s) => s && s.length > 0)
    .join(", ");
  const steuer = [
    firma.steuernummer ? `St-Nr.: ${firma.steuernummer}` : null,
    firma.ust_idnr ? `USt-IdNr.: ${firma.ust_idnr}` : null,
    firma.finanzamt ? `Finanzamt: ${firma.finanzamt}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.firma}>{firma.firmenname}</Text>
        <Text style={styles.metaZeile}>Inhaber/in: {firma.inhaber}</Text>
        {adresse ? (
          <Text style={styles.metaZeile}>{adresse}</Text>
        ) : null}
        {steuer ? <Text style={styles.metaZeile}>{steuer}</Text> : null}
      </View>
      <Text style={styles.titel}>{titel}</Text>
      <Text style={styles.untertitel}>{untertitel}</Text>
      {vorlaeufig ? (
        <Text style={styles.vorlaeufig}>
          VORLÄUFIG – Periode/Jahr ist nicht abgeschlossen. Die Zahlen
          können sich noch ändern und sind nicht zur endgültigen
          Weitergabe/Einreichung bestimmt.
        </Text>
      ) : null}
    </View>
  );
}

function Fuss({ erstelltAm }: { erstelltAm: string }): JSX.Element {
  return (
    <Text
      style={styles.fuss}
      fixed
      render={({ pageNumber, totalPages }) =>
        `STEUERAGENT · erstellt am ${erstelltAm} · Seite ${pageNumber}/${totalPages}`
      }
    />
  );
}

function Wasserzeichen(): JSX.Element {
  return (
    <Text style={styles.watermark} fixed>
      VORLÄUFIG
    </Text>
  );
}

const ERSTELLT = () =>
  new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

// ---------------------------------------------------------------------------
// EÜR-Aufstellung
// ---------------------------------------------------------------------------

function EuerGruppe({
  titel,
  gruppen,
  summe,
  summenLabel,
}: {
  titel: string;
  gruppen: EuerErgebnis["betriebseinnahmen"];
  summe: number;
  summenLabel: string;
}): JSX.Element {
  return (
    <View wrap={false}>
      <Text style={styles.abschnittTitel}>{titel}</Text>
      <View style={styles.tabelle}>
        <View style={styles.zeileKopf}>
          <Text style={styles.colSchmal}>EÜR-Zeile</Text>
          <Text style={styles.colText}>Position</Text>
          <Text style={styles.colSchmal}>Anzahl</Text>
          <Text style={styles.colBetrag}>Betrag</Text>
        </View>
        {gruppen.length === 0 ? (
          <View style={styles.zeile}>
            <Text style={styles.colText}>Keine Positionen.</Text>
          </View>
        ) : (
          gruppen.map((g) => (
            <View style={styles.zeile} key={g.kategorie_id}>
              <Text style={styles.colSchmal}>{g.euer_zeile ?? "—"}</Text>
              <Text style={styles.colText}>{g.bezeichnung}</Text>
              <Text style={styles.colSchmal}>{g.anzahl}</Text>
              <Text style={styles.colBetrag}>{euro(g.summe)}</Text>
            </View>
          ))
        )}
        <View style={styles.zeileSumme}>
          <Text style={styles.colText}>{summenLabel}</Text>
          <Text style={styles.colBetrag}>{euro(summe)}</Text>
        </View>
      </View>
    </View>
  );
}

function EuerDokument({
  firma,
  ergebnis,
  vorlaeufig,
}: {
  firma: FirmenKopf;
  ergebnis: EuerErgebnis;
  vorlaeufig: boolean;
}): JSX.Element {
  const erstellt = ERSTELLT();
  return (
    <Document
      title={`EÜR ${ergebnis.jahr} – ${firma.firmenname}`}
      author={firma.inhaber}
    >
      <Page size="A4" style={styles.page} wrap>
        {vorlaeufig ? <Wasserzeichen /> : null}
        <Kopf
          firma={firma}
          titel="Einnahmenüberschussrechnung (§ 4 Abs. 3 EStG)"
          untertitel={`Wirtschaftsjahr ${ergebnis.jahr} · Zeitraum ${datum(
            ergebnis.zeitraum.von,
          )} – ${datum(ergebnis.zeitraum.bis)}`}
          vorlaeufig={vorlaeufig}
        />
        <EuerGruppe
          titel="Betriebseinnahmen"
          gruppen={ergebnis.betriebseinnahmen}
          summe={ergebnis.summe_einnahmen}
          summenLabel="Summe Betriebseinnahmen"
        />
        <EuerGruppe
          titel="Betriebsausgaben"
          gruppen={ergebnis.betriebsausgaben}
          summe={ergebnis.summe_ausgaben}
          summenLabel="Summe Betriebsausgaben"
        />
        <View style={styles.zeileSumme} wrap={false}>
          <Text style={styles.colText}>
            {ergebnis.gewinn >= 0
              ? "Steuerlicher Gewinn"
              : "Steuerlicher Verlust"}
          </Text>
          <Text style={styles.colBetrag}>{euro(ergebnis.gewinn)}</Text>
        </View>
        {ergebnis.ohne_kategorie.anzahl > 0 ? (
          <Text style={[styles.untertitel, { marginTop: 14 }]}>
            Hinweis: {ergebnis.ohne_kategorie.anzahl} geschäftliche
            Buchung(en) ohne zuordenbare Kategorie sind NICHT in den
            Positionssummen enthalten (Einnahmen{" "}
            {euro(ergebnis.ohne_kategorie.summe_einnahmen)}, Ausgaben{" "}
            {euro(ergebnis.ohne_kategorie.summe_ausgaben)}). Bitte
            zuordnen.
          </Text>
        ) : null}
        <Fuss erstelltAm={erstellt} />
      </Page>
    </Document>
  );
}

export function euerPdf(
  firma: FirmenKopf,
  ergebnis: EuerErgebnis,
  vorlaeufig: boolean,
): Promise<Buffer> {
  return renderToBuffer(
    <EuerDokument
      firma={firma}
      ergebnis={ergebnis}
      vorlaeufig={vorlaeufig}
    />,
  );
}

// ---------------------------------------------------------------------------
// USt-VA-Aufstellung (inkl. ELSTER-Kennzahlen)
// ---------------------------------------------------------------------------

function UstvaDokument({
  firma,
  berechnung,
  periodeLabel,
  vorlaeufig,
}: {
  firma: FirmenKopf;
  berechnung: UstBerechnung;
  periodeLabel: string;
  vorlaeufig: boolean;
}): JSX.Element {
  const erstellt = ERSTELLT();
  return (
    <Document
      title={`USt-VA ${periodeLabel} – ${firma.firmenname}`}
      author={firma.inhaber}
    >
      <Page size="A4" style={styles.page} wrap>
        {vorlaeufig ? <Wasserzeichen /> : null}
        <Kopf
          firma={firma}
          titel="Umsatzsteuer-Voranmeldung"
          untertitel={`Voranmeldungszeitraum: ${periodeLabel}`}
          vorlaeufig={vorlaeufig}
        />
        {berechnung.kleinunternehmer && berechnung.hinweis ? (
          <Text style={[styles.untertitel, { marginBottom: 12 }]}>
            {berechnung.hinweis}
          </Text>
        ) : null}
        <Text style={styles.abschnittTitel}>
          ELSTER-Kennzahlen (zum Übertragen in das ELSTER-Formular)
        </Text>
        <View style={styles.tabelle}>
          <View style={styles.zeileKopf}>
            <Text style={styles.colSchmal}>Kz</Text>
            <Text style={styles.colText}>Bezeichnung</Text>
            <Text style={styles.colBetrag}>Bemessung</Text>
            <Text style={styles.colBetrag}>Steuer</Text>
          </View>
          {berechnung.zeilen.map((z) => (
            <View style={styles.zeile} key={z.schluessel}>
              <Text style={styles.colSchmal}>{z.kennzahl}</Text>
              <Text style={styles.colText}>{z.bezeichnung}</Text>
              <Text style={styles.colBetrag}>{euro(z.betrag)}</Text>
              <Text style={styles.colBetrag}>
                {z.steuer === null ? "—" : euro(z.steuer)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.abschnittTitel}>Zusammenfassung</Text>
        <View style={styles.tabelle}>
          <View style={styles.zeile}>
            <Text style={styles.colText}>Umsatz (netto)</Text>
            <Text style={styles.colBetrag}>
              {euro(berechnung.summe.umsatz_netto)}
            </Text>
          </View>
          <View style={styles.zeile}>
            <Text style={styles.colText}>Umsatzsteuer</Text>
            <Text style={styles.colBetrag}>
              {euro(berechnung.summe.umsatzsteuer)}
            </Text>
          </View>
          <View style={styles.zeile}>
            <Text style={styles.colText}>Abziehbare Vorsteuer</Text>
            <Text style={styles.colBetrag}>
              {euro(berechnung.summe.vorsteuer_abziehbar)}
            </Text>
          </View>
          <View style={styles.zeileSumme}>
            <Text style={styles.colText}>
              {berechnung.summe.zahllast >= 0
                ? "Zahllast (an Finanzamt)"
                : "Erstattung (vom Finanzamt)"}
            </Text>
            <Text style={styles.colBetrag}>
              {euro(Math.abs(berechnung.summe.zahllast))}
            </Text>
          </View>
        </View>
        {berechnung.diagnostik.vorsteuer_ohne_beleg_anzahl > 0 ? (
          <Text style={[styles.untertitel, { marginTop: 14 }]}>
            Hinweis: In Kz 66 sind{" "}
            {euro(berechnung.diagnostik.vorsteuer_ohne_beleg_betrag)} Vorsteuer
            aus {berechnung.diagnostik.vorsteuer_ohne_beleg_anzahl} Ausgabe(n)
            ohne Beleg vorläufig enthalten. Für die finale USt-VA müssen die
            Belege nachgereicht werden, sonst ist dieser Anteil nicht abziehbar.
          </Text>
        ) : null}
        <Fuss erstelltAm={erstellt} />
      </Page>
    </Document>
  );
}

export function ustvaPdf(
  firma: FirmenKopf,
  berechnung: UstBerechnung,
  periodeLabel: string,
  vorlaeufig: boolean,
): Promise<Buffer> {
  return renderToBuffer(
    <UstvaDokument
      firma={firma}
      berechnung={berechnung}
      periodeLabel={periodeLabel}
      vorlaeufig={vorlaeufig}
    />,
  );
}

// ---------------------------------------------------------------------------
// Privatentnahmen-Aufstellung (dedizierter, privater Export)
// ---------------------------------------------------------------------------

function PrivatentnahmenDokument({
  firma,
  jahr,
  zeitraum,
  zeilen,
}: {
  firma: FirmenKopf;
  jahr: number;
  zeitraum: { von: string; bis: string };
  zeilen: PrivatentnahmeZeile[];
}): JSX.Element {
  const erstellt = ERSTELLT();
  const summe =
    Math.round(zeilen.reduce((s, z) => s + Math.abs(z.betrag), 0) * 100) /
    100;
  return (
    <Document
      title={`Privatentnahmen ${jahr} – ${firma.firmenname}`}
      author={firma.inhaber}
    >
      <Page size="A4" style={styles.page} wrap>
        <Kopf
          firma={firma}
          titel="Aufstellung Privatentnahmen"
          untertitel={`Jahr ${jahr} · Zeitraum ${datum(
            zeitraum.von,
          )} – ${datum(zeitraum.bis)} · nur private Posten`}
          vorlaeufig={false}
        />
        <View style={styles.tabelle}>
          <View style={styles.zeileKopf}>
            <Text style={styles.colSchmal}>Datum</Text>
            <Text style={styles.colText}>Bezeichnung / Zweck</Text>
            <Text style={styles.colBetrag}>Betrag</Text>
          </View>
          {zeilen.length === 0 ? (
            <View style={styles.zeile}>
              <Text style={styles.colText}>
                Keine Privatentnahmen im Zeitraum erfasst.
              </Text>
            </View>
          ) : (
            zeilen.map((z, i) => (
              <View style={styles.zeile} key={`${z.datum}-${i}`}>
                <Text style={styles.colSchmal}>{datum(z.datum)}</Text>
                <Text style={styles.colText}>
                  {z.bezeichnung}
                  {z.verwendungszweck ? ` · ${z.verwendungszweck}` : ""}
                </Text>
                <Text style={styles.colBetrag}>
                  {euro(Math.abs(z.betrag))}
                </Text>
              </View>
            ))
          )}
          <View style={styles.zeileSumme}>
            <Text style={styles.colText}>Summe Privatentnahmen</Text>
            <Text style={styles.colBetrag}>{euro(summe)}</Text>
          </View>
        </View>
        <Text style={[styles.untertitel, { marginTop: 14 }]}>
          Dieser Auszug enthält ausschließlich private Posten und ist
          getrennt von den betrieblichen Auswertungen (EÜR/USt-VA) zu
          behandeln.
        </Text>
        <Fuss erstelltAm={erstellt} />
      </Page>
    </Document>
  );
}

export function privatentnahmenPdf(
  firma: FirmenKopf,
  jahr: number,
  zeitraum: { von: string; bis: string },
  zeilen: PrivatentnahmeZeile[],
): Promise<Buffer> {
  return renderToBuffer(
    <PrivatentnahmenDokument
      firma={firma}
      jahr={jahr}
      zeitraum={zeitraum}
      zeilen={zeilen}
    />,
  );
}

// ---------------------------------------------------------------------------
// ELSTER-Kennzahlen als kompaktes PDF (reines Übertragungsblatt)
// ---------------------------------------------------------------------------

function ElsterDokument({
  firma,
  berechnung,
  periodeLabel,
  vorlaeufig,
}: {
  firma: FirmenKopf;
  berechnung: UstBerechnung;
  periodeLabel: string;
  vorlaeufig: boolean;
}): JSX.Element {
  const erstellt = ERSTELLT();
  return (
    <Document
      title={`ELSTER-Kennzahlen ${periodeLabel} – ${firma.firmenname}`}
      author={firma.inhaber}
    >
      <Page size="A4" style={styles.page} wrap>
        {vorlaeufig ? <Wasserzeichen /> : null}
        <Kopf
          firma={firma}
          titel="ELSTER-Kennzahlen (USt-Voranmeldung)"
          untertitel={`Zeitraum: ${periodeLabel} · Werte nur in ELSTER eintragen`}
          vorlaeufig={vorlaeufig}
        />
        <View style={styles.tabelle}>
          <View style={styles.zeileKopf}>
            <Text style={styles.colSchmal}>Kennzahl</Text>
            <Text style={styles.colText}>Bezeichnung</Text>
            <Text style={styles.colBetrag}>Betrag</Text>
            <Text style={styles.colBetrag}>Steuer</Text>
          </View>
          {berechnung.zeilen.map((z) => (
            <View style={styles.zeile} key={z.schluessel}>
              <Text style={styles.colSchmal}>{z.kennzahl}</Text>
              <Text style={styles.colText}>{z.bezeichnung}</Text>
              <Text style={styles.colBetrag}>{euro(z.betrag)}</Text>
              <Text style={styles.colBetrag}>
                {z.steuer === null ? "—" : euro(z.steuer)}
              </Text>
            </View>
          ))}
        </View>
        <Fuss erstelltAm={erstellt} />
      </Page>
    </Document>
  );
}

export function elsterPdf(
  firma: FirmenKopf,
  berechnung: UstBerechnung,
  periodeLabel: string,
  vorlaeufig: boolean,
): Promise<Buffer> {
  return renderToBuffer(
    <ElsterDokument
      firma={firma}
      berechnung={berechnung}
      periodeLabel={periodeLabel}
      vorlaeufig={vorlaeufig}
    />,
  );
}
