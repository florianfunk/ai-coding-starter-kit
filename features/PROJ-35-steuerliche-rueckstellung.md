# Steuerliche Rückstellung einzelner Buchungen

Buchungsdetails bieten „Für Steuer zurückstellen“ mit Pflichtgrund (1–1000 Zeichen) und „Wieder aufnehmen“. Ein Filter „Steuerstatus“ findet zurückgestellte Buchungen wieder. Die Kennzeichnung gehört nur zur einzelnen Buchung, nicht zum Lieferanten. Kategorie, Klassifikation, Steuerrelevant und Geldbewegung bleiben erhalten.

## Daten und Schutz

- Vier additive Felder auf `buchung`: `steuer_zurueckgestellt`, `_grund`, `_am`, `steuer_zurueckstellung_version`.
- Eigener owner-scoped POST-Endpunkt mit Versionsvergleich. Zeitstempel und Audit werden atomar durch DB-Trigger geführt. Bestehende Klassifikations- und Bulk-Endpunkte können die Rückstellung nicht ändern.
- Geschlossene Wirtschaftsjahre/USt-Perioden verhindern Hold und Resume; bestehende Snapshots bleiben unverändert. Neue USt-Snapshots speichern feste Zeitraumgrenzen. Historische Grenzen werden nur aus eindeutigen enthaltenen Buchungsdaten ergänzt; ohne belastbare Grenzen sperrt der Guard konservativ das Kalenderjahr.
- Audit-Einträge sind für normale Benutzer nur lesbar/ergänzbar, nicht veränder- oder löschbar.
- Split-Klammern können nicht zurückgestellt werden; Teilbuchungen einzeln. Eine zurückgestellte Buchung kann bis zur Wiederaufnahme nicht neu aufgeteilt werden.
- Abschluss-Snapshots tragen die vor der Berechnung gelesene Anzahl unveränderlicher Rückstellungs-Auditereignisse. Ein gemeinsamer Datenbank-Lock und Versionsprüfung verhindern einen veralteten Abschluss bei parallelem Hold/Resume.

## Auswertungen

Ausgeschlossen aus EÜR, Einkommensteuer-Gewinn/Privatentnahmen, Umsatzsteuer, steuerlichen PDF/CSV/ELSTER-Exporten, steuerlichen Dashboard-Kennzahlen und Chat-Steuerauswertungen. Kontoansichten und Bank-Salden bleiben vollständig. Steuerrelevant=Nein wird nun auch in der EÜR berücksichtigt.

## Migration und Rückweg

Migration vor App-Deployment anwenden. Altcode bleibt kompatibel, solange noch keine Rückstellungen gesetzt wurden. Nach erster Verwendung keinen vollständigen Rollback auf eine App ohne Ausschlussfilter durchführen: Stattdessen Forward-Fix oder Oberfläche zurückrollen und Steuerfilter beibehalten. Rückstellungen sind durch Wiederaufnahme reversibel; Grund und Historie bleiben im Audit. Vorhandene Beträge, Kategorien und Klassifikationen werden nicht migriert.

## Prüfung

Unit-/Komponententests für Berechnung, Pflichtgrund, Bedienung, API/Auth/CAS; DB-Transaktionsprobe mit vollständigem Rollback für Hold/Resume/Audit, Leergrund, RLS/Fremdzugriff, Split und abgeschlossene Perioden. Anschließend Live-Probe mit temporärer Rückstellung und Wiederaufnahme; Steuerwerte/Exporte vor/während/nach vergleichen.
