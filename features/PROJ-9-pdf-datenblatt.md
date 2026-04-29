# PROJ-9: PDF-Export Einzel-Datenblatt

## Status: Approved
**Created:** 2026-04-16
**Last Updated:** 2026-04-29

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-5 (Produkte)
- Requires: PROJ-6 (Preise)
- Requires: PROJ-8 (Logos/Einstellungen)

## User Stories
- Als Nutzer möchte ich aus der Produkt-Detailseite per Klick auf „Datenblatt" ein PDF generieren und herunterladen, das optisch dem bestehenden FileMaker-Datenblatt entspricht.
- Als Nutzer möchte ich zwischen Layout „Lichtengros" und „Eisenkeil" wählen, damit der jeweilige Markenauftritt gedruckt wird.
- Als Nutzer möchte ich eine Vorschau sehen, bevor ich das PDF herunterlade.
- Als Nutzer möchte ich das PDF mit korrektem Dateinamen (z.B. `Datenblatt-BL13528-60-4.8-2700-90-20.pdf`) bekommen.

## Acceptance Criteria
- [x] Layout-Auswahl (Lichtengros / Eisenkeil) in Vorschau-Page
- [x] Live-PDF-Vorschau im Browser via iframe
- [x] PDF-Layout 1:1 zur Vorlage `daten/Datenblatt.pdf`
- [x] Seitenformat A4 Hochformat
- [x] Schriftarten + Farben aus Vorlage übernommen (Inter Variable)
- [x] Umlaute und Sonderzeichen korrekt
- [x] Download mit Dateiname `Datenblatt-{Artikelnummer}.pdf`
- [x] Generierungszeit < 3 s

## Tech Design (final, 2026-04-29)

### Architektur
- LaTeX/Tectonic statt React-PDF: pixelgenaue Druckqualität, native Font-Embedding, exaktes Spaltenraster.
- Dedizierter Render-Worker auf Hostinger-VPS unter `pdf.lichtengross.funk.solutions` (Container `lichtengross-pdf-service`).
- Bewusst getrennt vom Sustec-Worker (`pdf.funk.solutions`): eigene Codebase, eigene Update-Zyklen, kein Cross-Impact.
- Single Template mit Brand-Switch — Layout identisch für beide Marken, Logo + Footer-Firmenname per `meta.brand` zur Laufzeit injiziert.
- Bilder als base64 im Payload (`images_b64`-Feld); Worker entpackt sie pro Request, braucht keinen Supabase-Zugriff.
- Bild-Komprimierung serverseitig mit sharp (Hauptbild 1200 px / JPEG 82, Detail 800 px, Icon 200 px). PDF-Größe ~250 KB.
- Filiale aus DB (`filialen.marke = lichtengros|eisenkeil`).

### Dateien
- `services/latex-pdf-service/` — Repo-Spiegel des VPS-Workers (FastAPI + Tectonic)
- `services/latex-pdf-service/templates/lichtengross-datenblatt/` — Template + LaTeX-Klasse
- `src/lib/latex/datenblatt-payload.ts` — Payload-Builder mit Komprimierung + Brand-Konfig
- `src/app/produkte/[id]/datenblatt/raw/route.ts` — Next.js Route, ruft Worker, streamt PDF
- `scripts/deploy-latex-template.sh` — Hot-Deploy von Template/Assets per rsync (`--rebuild` für App-Code)
- `scripts/preview-datenblatt-latex.ts` — CLI für lokales Visual-QA

### Env-Variablen
- `LATEX_WORKER_URL=https://pdf.lichtengross.funk.solutions`
- `LATEX_WORKER_TOKEN` — pro Container generiert; Worker erwartet `X-Worker-Token`-Header

## QA Test Results
- ✅ Render Lichtengros (BL13528-60-4.8-2700-90-20): einseitig, Logo "LICHT.ENGROS", Footer "LICHT.ENGROS S.R.L."
- ✅ Render Eisenkeil: einseitig, Logo "LICHTSTUDIO", Footer "EISENKEIL"
- ✅ Visueller Abgleich mit FileMaker-Vorlage `daten/Datenblatt.pdf`
- ✅ Icons: eine Box pro Eintrag, Label klein oben + Wert groß unten (FM-Layout); 2700K mit gelbem Highlight
- ✅ DETAILS-Bilder ohne Plate-Hintergrund
- ✅ PDF-Größe < 300 KB durch sharp-Komprimierung
- ✅ Generierungszeit < 3 s

## Deployment
- VPS-Container `lichtengross-pdf-service` läuft mit Traefik + Let's-Encrypt-Cert auf `pdf.lichtengross.funk.solutions`.
- Vercel-Production: `LATEX_WORKER_URL` + `LATEX_WORKER_TOKEN` als Encrypted Env-Vars gesetzt.
- Template-Updates: `./scripts/deploy-latex-template.sh` (Hot-Deploy ohne Container-Restart).
- Worker-Code-Updates: `./scripts/deploy-latex-template.sh --rebuild` (Container-Rebuild).
