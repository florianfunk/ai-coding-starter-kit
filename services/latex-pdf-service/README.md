# Lichtengross LaTeX PDF Service

Dedizierter LaTeX-Renderer für Lichtengross/Eisenkeil-Datenblätter. Läuft als Container `lichtengross-pdf-service` auf dem Hostinger-VPS und ist erreichbar unter https://pdf.lichtengross.funk.solutions.

**Trennung von Sustec:** Sustec hat einen eigenen, baugleichen Container `latex-pdf-service` unter `pdf.funk.solutions`. Beide teilen sich keine Code-Dateien, keine Templates und keine Volumes. Änderungen hier wirken sich nicht auf Sustec aus und umgekehrt.

## Aufbau

```
services/latex-pdf-service/
├── Dockerfile                 Tectonic + Python + Inter-Fonts
├── docker-compose.yml         Container-Definition (Traefik-Labels)
├── requirements.txt           FastAPI, Jinja2, httpx
├── app/
│   ├── main.py                FastAPI-Endpoints (/healthz, /render/<template>)
│   └── latex.py               Jinja2-Env, Image-Fetcher, Tectonic-Wrapper
├── assets/
│   ├── fonts/                 Inter Variable Font Files (eingebettet)
│   └── lichtengross/          Markenlogos (von deploy-Script befüllt)
└── templates/
    └── lichtengross-datenblatt/
        ├── document.tex.j2    Jinja2-Template (Variablen: ((( ))) / ((* *)))
        └── lichtengross-datenblatt.cls  LaTeX-Klasse (Geometrie, Farben, Macros)
```

## Deploy

Editorische Änderungen am Template (`.tex.j2` / `.cls`) werden ohne Rebuild aktiv — der Worker mountet `./templates` und `./assets` read-only:

```bash
./scripts/deploy-latex-template.sh
```

Bei Änderungen an `app/`, `Dockerfile` oder `requirements.txt`:

```bash
./scripts/deploy-latex-template.sh --rebuild
```

## API

`POST /render/lichtengross-datenblatt`

Header: `X-Worker-Token: <LATEX_WORKER_TOKEN>` (siehe `.env.local`)

Body: JSON, vom Helper `src/lib/latex/datenblatt-payload.ts` aus dem Produkt-Datensatz aufgebaut. Bilder werden als `images_b64` (Dictionary `{filename: base64-string}`) mitgeliefert; das Template referenziert sie via `\includegraphics{filename}`.

Response: `application/pdf` (Stream)
