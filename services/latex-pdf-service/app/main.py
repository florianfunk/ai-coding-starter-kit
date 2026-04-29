"""LaTeX PDF rendering service.

Endpoints:
    GET  /healthz                       → liveness probe
    POST /render/<template_name>        → render the named template with the
                                           posted JSON payload and stream back
                                           the resulting PDF.

Auth: all /render/* endpoints require the WORKER_TOKEN env var to match the
``X-Worker-Token`` request header. /healthz is unauthenticated.

Templates live in /srv/templates/<name>/document.tex.j2. Shared assets are in
/srv/assets (the logo, etc). Both get read-only bind-access from Tectonic.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from .latex import JINJA_ENV, compile_latex, fetch_image, CompileError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("latex-pdf-service")

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "")

app = FastAPI(title="sustec latex-pdf-service", docs_url=None, redoc_url=None)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    available = sorted(
        p.name for p in TEMPLATES_DIR.iterdir() if p.is_dir()
    ) if TEMPLATES_DIR.exists() else []
    return {"ok": True, "templates": available}


@app.post("/render/{template_name}")
async def render(template_name: str, request: Request) -> Response:
    if WORKER_TOKEN:
        if request.headers.get("x-worker-token") != WORKER_TOKEN:
            raise HTTPException(status_code=401, detail="unauthorized")

    # Guard against path traversal via template_name.
    if not template_name.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="invalid template name")

    template_path = TEMPLATES_DIR / template_name / "document.tex.j2"
    if not template_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"unknown template: {template_name}",
        )

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid JSON: {exc}")

    # Fetch remote images once and stage them in a per-request workdir.
    # The template receives *local file names* through the ``_path`` fields
    # and references them via ``\includegraphics{...}``.
    with tempfile.TemporaryDirectory(prefix="assets-") as workdir:
        workdir_path = Path(workdir)

        if isinstance(payload, dict):
            hero_url = payload.get("hero_image_url")
            if hero_url:
                name = fetch_image(hero_url, workdir_path)
                if name:
                    payload["hero_image_path"] = name
                    log.info("fetched hero image: %s -> %s", hero_url, name)
                else:
                    log.warning("hero image fetch failed: %s", hero_url)
                    payload["hero_image_path"] = None

            drawings = payload.get("drawings")
            if isinstance(drawings, dict):
                urls = drawings.get("image_urls") or []
                local: list[str] = []
                for url in urls:
                    if not url:
                        continue
                    name = fetch_image(url, workdir_path)
                    if name:
                        local.append(name)
                        log.info("fetched drawing: %s -> %s", url, name)
                    else:
                        log.warning("drawing fetch failed: %s", url)
                drawings["images"] = local
            else:
                # Ensure templates can safely test `drawings.images`.
                payload["drawings"] = {"images": []}

        # ─── images_b64: generischer base64-Bilder-Mechanismus ───────────
        # Templates duerfen ein ``images_b64: { filename: base64-string }``
        # mitschicken; die Dateien werden ins per-request workdir entpackt
        # und stehen \\includegraphics als lokale Files zur Verfuegung.
        if isinstance(payload, dict):
            images_b64 = payload.get("images_b64")
            if isinstance(images_b64, dict):
                import base64 as _b64, re as _re
                for fname, content in images_b64.items():
                    if not isinstance(fname, str) or not isinstance(content, str):
                        continue
                    if not _re.match(r"^[A-Za-z0-9_.-]+$", fname):
                        log.warning("rejecting unsafe images_b64 key: %s", fname)
                        continue
                    try:
                        (workdir_path / fname).write_bytes(_b64.b64decode(content))
                    except Exception as e:
                        log.warning("images_b64 decode failed for %s: %s", fname, e)
                payload.pop("images_b64", None)

        # Jinja2 loads relative to templates/, so we must pass the subpath.
        template = JINJA_ENV.get_template(f"{template_name}/document.tex.j2")
        try:
            tex_source = template.render(**payload)
        except Exception as exc:
            log.exception("template render failed")
            raise HTTPException(status_code=400, detail=f"template error: {exc}")

        log.info(
            "rendering template=%s tex_chars=%d payload_keys=%s",
            template_name,
            len(tex_source),
            sorted(payload.keys()) if isinstance(payload, dict) else "<not-dict>",
        )

        try:
            pdf_bytes = compile_latex(
                tex_source,
                ASSETS_DIR,
                workdir_extras=workdir_path,
                template_dir=template_path.parent,
            )
        except CompileError as exc:
            log.warning("tectonic compile failed: %s", exc)
            return JSONResponse(
                status_code=422,
                content={"ok": False, "error": str(exc)},
            )

    log.info("rendered template=%s pdf_bytes=%d", template_name, len(pdf_bytes))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Length": str(len(pdf_bytes)),
            "Content-Disposition": f'inline; filename="{template_name}.pdf"',
        },
    )
