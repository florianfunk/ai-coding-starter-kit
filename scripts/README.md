# Migration & Wartungs-Skripte

## `apply-migrations.ts`
Wendet alle SQL-Dateien aus `supabase/migrations/` auf die Supabase-DB an.
Idempotent — fertige Migrations werden in `public._migrations` getrackt.

```bash
npx tsx scripts/apply-migrations.ts
```

## `verify-schema.ts`
Listet Tabellen, Storage-Buckets und RLS-Policies in der DB auf.

## `inspect-fmp-xml.ts`
Liest eine FileMaker-XML-Datei und gibt Tabellen + Felder aus (zur Schema-Inspektion).

```bash
npx tsx scripts/inspect-fmp-xml.ts daten/Lichtengross\ Produktkatalog_fmp12.xml
```

## `migrate-filemaker.ts`
Importiert Bereiche, Kategorien, Produkte, Preise, Filialen und Einstellungen
aus einer **Datenexport-XML** (FileMaker `Datensätze als XML exportieren`,
nicht „Datenbankbericht"!).

```bash
npx tsx scripts/migrate-filemaker.ts daten/Datenexport.xml
```

### ⚠️ Wichtig: Welche XML-Variante?
Die mitgelieferte Datei `Lichtengross Produktkatalog_fmp12.xml` ist ein
**Database Design Report (DDR)** — sie enthält nur die Schema-Definition,
**keine Datensätze**.

Für die Migration brauchen wir einen **Datensatz-Export**. In FileMaker:

1. Tabelle öffnen (z.B. `Bereiche`, `Kategorien`, `Artikel`, `Preise`, `System`)
2. Menü `Datei → Export → Datensätze`
3. Format: **XML** (FMPXMLRESULT.xsl oder FMPDSORESULT.xsl)
4. Alle Felder auswählen
5. Vorgang für jede Tabelle wiederholen

Alternativ: ein einziges `FMPXMLRESULT`-Export pro Tabelle, dann das Skript
um `--table=...` erweitern. Das Skript `migrate-filemaker.ts` erwartet
aktuell ein `FMPReport` mit `<ResultSet table="...">` Blöcken (FileMaker
"Datenbankbericht mit Daten").

### Ergebnis
Nach erfolgreichem Import steht in `scripts/migrate-report.json`:
- Anzahl Insert/Update pro Tabelle
- Warnungen (fehlende Referenzen)
- Bilder upload/failed
