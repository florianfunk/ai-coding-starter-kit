# Tectonic-based LaTeX PDF service.
#
# Runs a small FastAPI app that takes JSON, renders it through a Jinja2
# LaTeX template, compiles with Tectonic, and returns the resulting PDF.
#
# Tectonic is a modern LaTeX engine (Rust) that resolves packages on demand
# from TeXLive's CTAN mirror and produces deterministic output. First render
# is slow (downloads ~30-80 MB of packages into the bundle cache); every
# subsequent render hits the cache and completes in 1-3 seconds.

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TECTONIC_CACHE_DIR=/var/cache/tectonic

# System deps:
#   - ca-certificates, curl: needed to download Tectonic + CTAN packages
#   - xz-utils:              Tectonic release is tar.xz
#   - fontconfig:            Tectonic finds system fonts via fc-match
#   - fonts-inter:           Inter font family (matches the website typography)
#   - libfontconfig1 etc.:   runtime deps for Tectonic
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      xz-utils \
      fontconfig \
      fonts-inter \
      libfontconfig1 \
      libgraphite2-3 \
      libharfbuzz0b \
      libicu72 \
    && rm -rf /var/lib/apt/lists/*

# Install Tectonic (pinned version for reproducibility).
ARG TECTONIC_VERSION=0.15.0
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) tarball="tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" ;; \
      arm64) tarball="tectonic-${TECTONIC_VERSION}-aarch64-unknown-linux-musl.tar.gz" ;; \
      *) echo "unsupported arch: $arch"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic@${TECTONIC_VERSION}/${tarball}" \
      | tar -xz -C /usr/local/bin tectonic; \
    chmod +x /usr/local/bin/tectonic; \
    tectonic --version

WORKDIR /srv

# Python deps first (layer cache)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code. Templates and assets are bind-mounted via docker-compose.
COPY app ./app

# Warm Tectonic's bundle cache with a minimal compile so the first real
# request doesn't spend 30s downloading CTAN packages.
RUN mkdir -p /var/cache/tectonic && cat > /tmp/warm.tex <<'EOF'
\documentclass{article}
\usepackage{fontspec}
\setmainfont{Inter}
\begin{document}
warm
\end{document}
EOF
RUN tectonic --chatter=minimal --outdir=/tmp /tmp/warm.tex && rm /tmp/warm.*

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
