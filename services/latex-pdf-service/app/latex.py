"""LaTeX helpers: Jinja2 environment configured for .tex files and a
subprocess wrapper for Tectonic.

Why the custom delimiters? In LaTeX, ``{`` and ``}`` carry semantic meaning
(argument grouping, scopes). Jinja2's defaults (``{{ }}``, ``{% %}``) collide
with that and make templates unreadable. We use BracketExtension-style
delimiters that don't appear in LaTeX source.
"""

from __future__ import annotations

import hashlib
import mimetypes
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from jinja2 import Environment, FileSystemLoader, StrictUndefined

# ─── Jinja2 environment for LaTeX templates ─────────────────────────────────

# Characters in user-provided strings that need escaping before they land in
# a .tex file. Order matters — backslash must come first so we don't double-
# escape the replacements of later characters.
_LATEX_ESCAPES: list[tuple[str, str]] = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]


def latex_escape(value: Any) -> str:
    """Escape a value for safe insertion into LaTeX source."""
    if value is None:
        return ""
    s = str(value)
    for needle, replacement in _LATEX_ESCAPES:
        s = s.replace(needle, replacement)
    return s


def _build_env() -> Environment:
    templates_dir = Path(__file__).resolve().parent.parent / "templates"
    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        block_start_string="((*",
        block_end_string="*))",
        variable_start_string="(((",
        variable_end_string=")))",
        comment_start_string="((#",
        comment_end_string="#))",
        trim_blocks=True,
        lstrip_blocks=True,
        autoescape=False,
        undefined=StrictUndefined,
    )
    env.filters["e"] = latex_escape  # short alias used in templates
    env.filters["latex"] = latex_escape
    return env


JINJA_ENV = _build_env()


# ─── Image fetching ────────────────────────────────────────────────────────

IMAGE_CACHE = Path("/var/cache/image-fetch")


def _safe_name(url: str, content_type: str | None) -> str:
    """Derive a stable, LaTeX-friendly file name from a URL."""
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]

    suffix = ""
    if content_type:
        suffix = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ""
    if not suffix:
        path = urlparse(url).path
        if "." in path:
            suffix = "." + path.rsplit(".", 1)[-1].lower()
    # LaTeX's graphicx is picky about extensions — normalise.
    if suffix in (".jpg", ".jpeg"):
        suffix = ".jpg"
    elif suffix not in (".png", ".pdf", ".jpg"):
        suffix = ".png"
    return f"{digest}{suffix}"


def fetch_image(url: str, dest_dir: Path) -> str | None:
    """Download ``url`` into ``dest_dir`` and return the local file name.

    Uses a persistent on-disk cache keyed by URL so repeat renders don't
    re-download the same Supabase image. Returns ``None`` if the URL is
    empty or fetching fails — templates guard against missing paths.
    """
    if not url:
        return None
    try:
        IMAGE_CACHE.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    cached = next(IMAGE_CACHE.glob(f"{digest}.*"), None) if IMAGE_CACHE.exists() else None

    if cached is not None:
        target = dest_dir / cached.name
        target.write_bytes(cached.read_bytes())
        return cached.name

    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
    except Exception:
        return None

    name = _safe_name(url, r.headers.get("content-type"))
    try:
        (IMAGE_CACHE / name).write_bytes(r.content)
    except Exception:
        pass
    (dest_dir / name).write_bytes(r.content)
    return name


# ─── Tectonic compile wrapper ───────────────────────────────────────────────


class CompileError(RuntimeError):
    """Raised when Tectonic fails to produce a PDF."""


# Capture the first really useful log line after the error ("! LaTeX Error: …",
# "Missing \\begin{document}", etc.) so we can surface it to the client.
_ERR_PATTERN = re.compile(r"^(!.*|.*Error:.*|.*Fatal.*|.*Missing.*)$", re.MULTILINE)


def compile_latex(
    tex_source: str,
    assets_dir: Path,
    workdir_extras: Path | None = None,
    template_dir: Path | None = None,
) -> bytes:
    """Compile a LaTeX source string via Tectonic and return the PDF bytes.

    ``assets_dir`` is the working directory — templates reference shared
    assets (logo, fonts) via absolute paths under ``/srv/assets``.
    ``workdir_extras`` is an optional directory whose contents get copied
    next to the .tex source so LaTeX's default search path finds them (used
    for per-request images that were fetched beforehand).
    ``template_dir`` is the template's own folder; non-template files in it
    (e.g. ``.cls`` and ``.sty``) are also copied so ``\\documentclass{...}``
    can resolve a template-local class.
    """
    with tempfile.TemporaryDirectory(prefix="tectonic-") as tmp:
        tmp_path = Path(tmp)
        src_path = tmp_path / "document.tex"

        if template_dir and template_dir.exists():
            for f in template_dir.iterdir():
                if f.is_file() and f.suffix.lower() in (".cls", ".sty", ".def"):
                    (tmp_path / f.name).write_bytes(f.read_bytes())

        if workdir_extras and workdir_extras.exists():
            for f in workdir_extras.iterdir():
                if f.is_file():
                    (tmp_path / f.name).write_bytes(f.read_bytes())

        src_path.write_text(tex_source, encoding="utf-8")

        # Persist the rendered source before compiling so we can post-mortem
        # whatever the template produced.
        try:
            Path("/tmp/last-render.tex").write_text(tex_source, encoding="utf-8")
        except Exception:
            pass

        cmd = [
            "tectonic",
            "--chatter=minimal",
            "--keep-logs",
            f"--outdir={tmp_path}",
            str(src_path),
        ]

        try:
            # Run with the temp dir as cwd so per-request images (fetched hero,
            # etc.) are picked up by \includegraphics. The template's
            # \graphicspath includes /srv/assets so the bundled logo and other
            # shared assets still resolve.
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(tmp_path),
                timeout=45,
            )
        except subprocess.TimeoutExpired as exc:
            raise CompileError(
                f"Tectonic timed out after {exc.timeout}s — likely a LaTeX "
                f"error left the compiler in an interactive prompt. "
                f"See /tmp/last-render.tex for the source."
            )

        pdf_path = tmp_path / "document.pdf"

        # Tectonic can exit non-zero on recoverable warnings while still
        # producing a valid PDF. Treat the presence of the output file as
        # the ground truth.
        if pdf_path.exists():
            return pdf_path.read_bytes()

        # Persist the source for post-mortem debugging.
        try:
            Path("/tmp/last-fail.tex").write_text(tex_source, encoding="utf-8")
            Path("/tmp/last-fail.log").write_text(
                (result.stdout or "") + "\n---\n" + (result.stderr or ""),
                encoding="utf-8",
            )
        except Exception:
            pass

        log = (result.stderr or "") + "\n" + (result.stdout or "")
        matches = _ERR_PATTERN.findall(log)
        detail = "\n".join(matches[:5]) or log[-800:]
        raise CompileError(f"Tectonic failed:\n{detail}")
