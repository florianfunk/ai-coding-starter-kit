# Datierter Wechsel zur monatlichen USt-Voranmeldung

Der erste Wechsel von quartalsweiser auf monatliche Abgabe wird mit dem
bisherigen Rhythmus und einem Quartalsbeginn gespeichert. Beispiel 01.04.2026:
Q1 bleibt quartalsweise; April bis Dezember sind Monatsperioden. Vorjahre
bleiben unverändert. Der Wechseltermin kann korrigiert werden, solange kein
abgeschlossener Zeitraum verändert würde. Weitere Rhythmuswechsel werden zunächst abgewiesen.

## Release

1. Die additive Migration `20261115225406_ust_rhythmuswechsel.sql` zuerst in
   einer Testdatenbank prüfen; Schutztests: `supabase/tests/ust_rhythmuswechsel.sql`.
   Die Tests rollen ihre Testdaten zurück und gehören nicht in die Produktion.
2. Vor der Produktionsmigration Firmenprofil und Steuerperioden sichern.
   Migration vor der neuen Anwendungsversion anwenden und Schema/Advisors prüfen.
3. Der Release selbst ändert keinen Abgaberhythmus. Die Umstellung erfolgt
   explizit unter USt-Voranmeldung → Abgaberhythmus ändern mit dem Datum laut Finanzamt.
4. Q1 und April nach der Umstellung prüfen, einschließlich Export und Fristanzeige.
   Die Anwendung übermittelt weiterhin keine Anmeldung automatisch ans Finanzamt.

Abgeschlossene Zeiträume ab dem Wechseltermin blockieren die Umstellung.
Sie werden weder gelöscht noch umgedeutet. Profil- und Abschlusstrigger
serialisieren konkurrierende Änderungen über eine Sperre auf dem Firmenprofil.

## Rückweg

Vor der ersten Umstellung kann die Anwendung zurückgerollt werden; die zusätzliche
Spalte darf bestehen bleiben. Nach einer gespeicherten Umstellung würde die alte
Anwendung frühere Quartale wieder als Monate behandeln. Dann eine korrigierte
Version mit derselben Periodenlogik ausrollen, statt die Historie oder Snapshots
zu löschen oder die alte Anwendung unverändert wiederherzustellen.
