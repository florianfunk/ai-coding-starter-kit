/**
 * Seeds demo data: 3 Bereiche, 5 Kategorien, 10 Produkte, Preise, Icons, Filialen.
 * Usage: npx tsx scripts/seed-demo.ts
 */
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Icons
  const iconLabels = ["2700K", "3000K", "4000K", "IP20", "IP65", "Dimmable", "RoHS", "CE", "SMD/mt", "LM80"];
  const iconIds: Record<string, string> = {};
  for (const label of iconLabels) {
    const r = await client.query(
      `INSERT INTO icons (label, sortierung) VALUES ($1, 0)
       ON CONFLICT (label) DO UPDATE SET label=excluded.label
       RETURNING id`, [label]);
    iconIds[label] = r.rows[0].id;
  }
  console.log(`✓ ${iconLabels.length} Icons`);

  // Bereiche
  const bereiche = [
    { name: "LED STRIP", beschreibung: "Hochflexible LED-Streifen für Grund- und Akzentbeleuchtung", sortierung: 1, startseite: 4 },
    { name: "LED EINBAUSTRAHLER", beschreibung: "Einbauleuchten für Deckeninstallation", sortierung: 2, startseite: 30 },
    { name: "PENDELLEUCHTEN", beschreibung: "Hängende Designleuchten für Büro und Wohnraum", sortierung: 3, startseite: 50 },
  ];
  const bereichIds: string[] = [];
  for (const b of bereiche) {
    const r = await client.query(
      `INSERT INTO bereiche (name, beschreibung, sortierung, startseite, seitenzahl)
       VALUES ($1, $2, $3, $4, 10)
       ON CONFLICT DO NOTHING
       RETURNING id`, [b.name, b.beschreibung, b.sortierung, b.startseite]);
    if (r.rows[0]) bereichIds.push(r.rows[0].id);
    else {
      const e = await client.query(`SELECT id FROM bereiche WHERE name=$1`, [b.name]);
      bereichIds.push(e.rows[0].id);
    }
  }
  console.log(`✓ ${bereiche.length} Bereiche`);

  // Kategorien
  const kategorien = [
    { name: "60 SMD/MT", bereich_idx: 0, sortierung: 1, beschreibung: "LED-Streifen 60 LEDs pro Meter, gleichmäßige Lichtverteilung" },
    { name: "120 SMD/MT", bereich_idx: 0, sortierung: 2, beschreibung: "LED-Streifen 120 LEDs pro Meter, high density" },
    { name: "NEON FLEX", bereich_idx: 0, sortierung: 3, beschreibung: "Neon-Flex-Streifen für dekorative Lichtlinien" },
    { name: "RUNDE EINBAUSTRAHLER", bereich_idx: 1, sortierung: 1, beschreibung: "Runde LED-Einbauleuchten" },
    { name: "LINEARE PENDELLEUCHTEN", bereich_idx: 2, sortierung: 1, beschreibung: "Lineare Pendel für Bürobeleuchtung" },
  ];
  const katIds: string[] = [];
  for (const k of kategorien) {
    const r = await client.query(
      `INSERT INTO kategorien (name, bereich_id, sortierung, beschreibung)
       VALUES ($1, $2, $3, $4)
       RETURNING id`, [k.name, bereichIds[k.bereich_idx], k.sortierung, k.beschreibung]);
    katIds.push(r.rows[0].id);
    // Assign some icons
    const someIcons = iconLabels.slice(0, 4 + (katIds.length % 3));
    for (const il of someIcons) {
      await client.query(`INSERT INTO kategorie_icons (kategorie_id, icon_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.rows[0].id, iconIds[il]]);
    }
  }
  console.log(`✓ ${kategorien.length} Kategorien`);

  // Produkte
  const produkte = [
    { artikelnummer: "BL13528-60-4.8-2700-90-20", name: "LED-FLEXBAND 4,8W/m 24V 2700°K 430lm Ra90 IP20 60LED/m (5m-Rolle)", kat_idx: 0, ber_idx: 0, leistung_w: 4.8, nennspannung_v: 24, lichtstrom_lm: 430, farbtemperatur_k: 2700, farbwiedergabeindex_cri: 90, schutzart_ip: "IP20", led_chip: "3528", anzahl_led_pro_meter: 60, laenge_mm: 5000, breite_mm: 8, hoehe_mm: 2.1, lebensdauer_h: 50000, zertifikate: "CE, RoHS", rollenlaenge_m: 5, maximale_laenge_m: 5, abstand_led_zu_led_mm: 16.66, laenge_abschnitte_mm: 100, kleinster_biegeradius_mm: 60, spannungsart: "DC", schutzklasse: "SK III", gesamteffizienz_lm_w: 90, farbkonsistenz_sdcm: "SDCM 3", energieeffizienzklasse: "F", abstrahlwinkel_grad: 120, datenblatt_titel: "LED-FLEXBAND 4,8W/m 24V 2700°K 430lm Ra90 IP20 60LED/m (5m-Rolle)", datenblatt_text: "Der LED-Strip darf nur mit einem Kühlprofil verwendet werden und muss Abstand zu leicht entflammbaren Materialien haben.\nDie Rollenlänge beträgt 5 Meter, Anschluss max Länge 5 Tnt.\nZollnummer: 94054090.", listenpreis: 40.22, ek: 7.13 },
    { artikelnummer: "BL13528-60-4.8-2700-90-65", name: "LED-FLEXBAND 4,8W/m 24V 2700°K 430lm Ra90 IP65 60LED/m (5m-Rolle)", kat_idx: 0, ber_idx: 0, leistung_w: 4.8, nennspannung_v: 24, lichtstrom_lm: 430, farbtemperatur_k: 2700, farbwiedergabeindex_cri: 90, schutzart_ip: "IP65", led_chip: "3528", anzahl_led_pro_meter: 60, laenge_mm: 5000, breite_mm: 10, hoehe_mm: 4, lebensdauer_h: 50000, zertifikate: "CE, RoHS", datenblatt_titel: "LED-FLEXBAND 4,8W/m IP65", datenblatt_text: "Feuchtraumausführung mit Silikonbeschichtung.", listenpreis: 52.80, ek: 9.50 },
    { artikelnummer: "BL13528-60-4.8-3000-90-20", name: "LED-FLEXBAND 4,8W/m 24V 3000°K 430lm Ra90 IP20 60LED/m", kat_idx: 0, ber_idx: 0, leistung_w: 4.8, nennspannung_v: 24, lichtstrom_lm: 430, farbtemperatur_k: 3000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP20", led_chip: "3528", anzahl_led_pro_meter: 60, laenge_mm: 5000, lebensdauer_h: 50000, zertifikate: "CE, RoHS", datenblatt_titel: "LED-FLEXBAND 4,8W/m 3000K IP20", listenpreis: 40.22, ek: 7.13 },
    { artikelnummer: "BL2835-120-9.6-3000-90-20", name: "LED-FLEXBAND 9,6W/m 24V 3000°K 1100lm Ra90 IP20 120LED/m", kat_idx: 1, ber_idx: 0, leistung_w: 9.6, nennspannung_v: 24, lichtstrom_lm: 1100, farbtemperatur_k: 3000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP20", led_chip: "2835", anzahl_led_pro_meter: 120, laenge_mm: 5000, lebensdauer_h: 50000, zertifikate: "CE, RoHS", datenblatt_titel: "LED-FLEXBAND High Density 120 LED/m", listenpreis: 68.50, ek: 12.80 },
    { artikelnummer: "NF-1220-3000-IP67", name: "NEON FLEX 12W/m 24V 3000K IP67", kat_idx: 2, ber_idx: 0, leistung_w: 12, nennspannung_v: 24, lichtstrom_lm: 950, farbtemperatur_k: 3000, farbwiedergabeindex_cri: 80, schutzart_ip: "IP67", lebensdauer_h: 30000, zertifikate: "CE, RoHS", datenblatt_titel: "NEON FLEX 12W/m 3000K", datenblatt_text: "Biegsames Neon-Flex-Profil für dekorative Anwendungen. UV-beständig.", listenpreis: 24.50, ek: 8.90 },
    { artikelnummer: "EBR-8W-3000-WH", name: "LED-Einbaustrahler rund 8W 3000K weiß", kat_idx: 3, ber_idx: 1, leistung_w: 8, nennspannung_v: 230, lichtstrom_lm: 680, farbtemperatur_k: 3000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP44", einbaudurchmesser_mm: 68, aussendurchmesser_mm: 83, hoehe_mm: 35, gehaeusefarbe: "weiß", montageart: "Deckeneinbau", lebensdauer_h: 40000, zertifikate: "CE", datenblatt_titel: "LED-Einbaustrahler 8W 3000K", listenpreis: 18.90, ek: 6.20 },
    { artikelnummer: "EBR-12W-4000-BK", name: "LED-Einbaustrahler rund 12W 4000K schwarz", kat_idx: 3, ber_idx: 1, leistung_w: 12, nennspannung_v: 230, lichtstrom_lm: 1020, farbtemperatur_k: 4000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP44", einbaudurchmesser_mm: 90, aussendurchmesser_mm: 110, hoehe_mm: 40, gehaeusefarbe: "schwarz", montageart: "Deckeneinbau", lebensdauer_h: 40000, zertifikate: "CE, RoHS", datenblatt_titel: "LED-Einbaustrahler 12W 4000K schwarz", listenpreis: 24.50, ek: 8.40 },
    { artikelnummer: "PL-LINEAR-36W-4000", name: "Pendelleuchte Linear 36W 4000K 1200mm", kat_idx: 4, ber_idx: 2, leistung_w: 36, nennspannung_v: 230, lichtstrom_lm: 4200, farbtemperatur_k: 4000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP20", laenge_mm: 1200, breite_mm: 70, hoehe_mm: 55, gehaeusefarbe: "weiß", montageart: "Pendelabhängung", lebensdauer_h: 50000, zertifikate: "CE, RoHS", datenblatt_titel: "Pendelleuchte Linear 36W", datenblatt_text: "Elegante lineare Büroleuchte mit UGR<19. Inklusive Seilabhängung 1,5m.", listenpreis: 189.00, ek: 62.00 },
    { artikelnummer: "PL-LINEAR-54W-3000", name: "Pendelleuchte Linear 54W 3000K 1800mm", kat_idx: 4, ber_idx: 2, leistung_w: 54, nennspannung_v: 230, lichtstrom_lm: 6100, farbtemperatur_k: 3000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP20", laenge_mm: 1800, breite_mm: 70, hoehe_mm: 55, gehaeusefarbe: "schwarz", montageart: "Pendelabhängung", lebensdauer_h: 50000, zertifikate: "CE, RoHS", datenblatt_titel: "Pendelleuchte Linear 54W", listenpreis: 269.00, ek: 89.00 },
    { artikelnummer: "PL-RING-48W-3000", name: "Pendelleuchte Ring 48W 3000K Ø600mm", kat_idx: 4, ber_idx: 2, leistung_w: 48, nennspannung_v: 230, lichtstrom_lm: 5400, farbtemperatur_k: 3000, farbwiedergabeindex_cri: 90, schutzart_ip: "IP20", aussendurchmesser_mm: 600, hoehe_mm: 60, gehaeusefarbe: "gold", montageart: "Pendelabhängung", lebensdauer_h: 50000, zertifikate: "CE, RoHS", datenblatt_titel: "Pendelleuchte Ring 48W", datenblatt_text: "Designring-Leuchte für gehobene Innenarchitektur.", listenpreis: 349.00, ek: 115.00 },
  ];

  const produktIds: string[] = [];
  for (const p of produkte) {
    const { artikelnummer, name, kat_idx, ber_idx, listenpreis, ek, datenblatt_titel, datenblatt_text, ...tech } = p;
    const r = await client.query(
      `INSERT INTO produkte (
        artikelnummer, name, kategorie_id, bereich_id, sortierung, artikel_bearbeitet,
        datenblatt_titel, datenblatt_text,
        leistung_w, nennspannung_v, lichtstrom_lm, farbtemperatur_k, farbwiedergabeindex_cri,
        schutzart_ip, led_chip, anzahl_led_pro_meter, laenge_mm, breite_mm, hoehe_mm,
        lebensdauer_h, zertifikate, rollenlaenge_m, maximale_laenge_m,
        abstand_led_zu_led_mm, laenge_abschnitte_mm, kleinster_biegeradius_mm,
        spannungsart, schutzklasse, gesamteffizienz_lm_w, farbkonsistenz_sdcm,
        energieeffizienzklasse, abstrahlwinkel_grad, einbaudurchmesser_mm,
        aussendurchmesser_mm, gehaeusefarbe, montageart
      ) VALUES (
        $1,$2,$3,$4, $5, true,
        $6, $7,
        $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
      ) ON CONFLICT (artikelnummer) DO UPDATE SET name=excluded.name
      RETURNING id`,
      [
        artikelnummer, name, katIds[kat_idx], bereichIds[ber_idx],
        produktIds.length + 1,
        datenblatt_titel ?? null, datenblatt_text ?? null,
        tech.leistung_w ?? null, tech.nennspannung_v ?? null, tech.lichtstrom_lm ?? null,
        tech.farbtemperatur_k ?? null, tech.farbwiedergabeindex_cri ?? null,
        tech.schutzart_ip ?? null, tech.led_chip ?? null, tech.anzahl_led_pro_meter ?? null,
        tech.laenge_mm ?? null, tech.breite_mm ?? null, tech.hoehe_mm ?? null,
        tech.lebensdauer_h ?? null, tech.zertifikate ?? null, tech.rollenlaenge_m ?? null,
        tech.maximale_laenge_m ?? null, tech.abstand_led_zu_led_mm ?? null,
        tech.laenge_abschnitte_mm ?? null, tech.kleinster_biegeradius_mm ?? null,
        tech.spannungsart ?? null, tech.schutzklasse ?? null, tech.gesamteffizienz_lm_w ?? null,
        tech.farbkonsistenz_sdcm ?? null, tech.energieeffizienzklasse ?? null,
        tech.abstrahlwinkel_grad ?? null, tech.einbaudurchmesser_mm ?? null,
        tech.aussendurchmesser_mm ?? null, tech.gehaeusefarbe ?? null, tech.montageart ?? null,
      ]);
    produktIds.push(r.rows[0].id);

    // Icons for the product
    const productIcons = ["CE", "RoHS"];
    if ((tech.farbtemperatur_k ?? 0) <= 2700) productIcons.push("2700K");
    else if ((tech.farbtemperatur_k ?? 0) <= 3000) productIcons.push("3000K");
    else productIcons.push("4000K");
    if (tech.schutzart_ip === "IP20") productIcons.push("IP20");
    else if (tech.schutzart_ip === "IP65" || tech.schutzart_ip === "IP67") productIcons.push("IP65");

    for (let si = 0; si < productIcons.length; si++) {
      const iid = iconIds[productIcons[si]];
      if (iid) await client.query(`INSERT INTO produkt_icons (produkt_id, icon_id, sortierung) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [r.rows[0].id, iid, si]);
    }
  }
  console.log(`✓ ${produkte.length} Produkte`);

  // Preise
  for (let i = 0; i < produkte.length; i++) {
    await client.query(
      `INSERT INTO preise (produkt_id, gueltig_ab, listenpreis, ek, status)
       VALUES ($1, '2026-01-01', $2, $3, 'aktiv')`,
      [produktIds[i], produkte[i].listenpreis, produkte[i].ek]);
  }
  console.log(`✓ ${produkte.length} Preise`);

  // Filialen
  const filialen = [
    { marke: "lichtengros", name: "MARLING", land: "IT", adresse: "Gampenstraße 60\n39020 Marling\nTel: +39 0473 016100" },
    { marke: "lichtengros", name: "KLAUSEN", land: "IT", adresse: "Brennerstraße 2\n39043 Klausen\nTel: +39 0472 849300" },
    { marke: "eisenkeil", name: "VOMP", land: "AT", adresse: "Industriestraße 5\n6134 Vomp\nTel: +43 44 568 72 65" },
  ];
  for (let i = 0; i < filialen.length; i++) {
    const f = filialen[i];
    await client.query(
      `INSERT INTO filialen (marke, name, land, adresse, sortierung)
       VALUES ($1::marke, $2, $3, $4, $5)`,
      [f.marke, f.name, f.land, f.adresse, i + 1]);
  }
  console.log(`✓ ${filialen.length} Filialen`);

  // Katalog-Einstellungen
  await client.query(`
    UPDATE katalog_einstellungen SET
      copyright_lichtengros = 'Copyright © 2025 LICHT.ENGROS S.R.L.\nDas Unternehmen behält sich das Recht vor, die Produkte und Preise jederzeit ohne Ankündigung zu ändern.\nGültig bis 31.12.2026',
      copyright_eisenkeil = 'Copyright © 2025 Eisenkeil GmbH\nGültig bis 31.12.2026',
      gueltig_bis = '2026-12-31',
      wechselkurs_eur_chf = 0.9350
    WHERE id = 1
  `);
  console.log(`✓ Katalog-Einstellungen`);

  await client.end();
  console.log("\nDone! Demo data seeded.");
}

main().catch((e) => { console.error(e); process.exit(1); });
