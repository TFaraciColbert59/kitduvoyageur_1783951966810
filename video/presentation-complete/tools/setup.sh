#!/usr/bin/env bash
# Installe tout ce qu'il faut pour fabriquer le film de présentation LKDV (Linux ou macOS). Idempotent.
# Usage : bash video/presentation-complete/tools/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Node ≥ 20, ffmpeg, Python 3 =="
command -v node >/dev/null || { echo "Installe Node 20+ (https://nodejs.org)"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Installe ffmpeg (brew install ffmpeg / apt-get install -y ffmpeg)"; exit 1; }
command -v python3 >/dev/null || { echo "Installe Python 3"; exit 1; }

echo "== HyperFrames : CLI + skills (hyperframes, hyperframes-cli, hyperframes-registry, media-use, reverse-any-video, style-sampling) =="
npx --yes hyperframes --version || true
npx --yes hyperframes skills update || echo "Si ça échoue : suivre le README de github.com/heygen-com/hyperframes (plugin Claude Code)."

echo "== Playwright + Chromium (captures et enregistrements de l'app) =="
npm i -g playwright@1 >/dev/null 2>&1 || npm i playwright@1
npx --yes playwright install chromium

echo "== Python : numpy, scipy, Pillow (musique, analyse de tempo, découpes) =="
python3 -m venv .venv 2>/dev/null || true
. .venv/bin/activate
pip install -q numpy scipy pillow

echo "== yt-dlp (étudier les vidéos de référence, jamais les réutiliser) =="
pip install -q yt-dlp

echo "== Vérifications =="
node -e "require('playwright'); console.log('playwright ok')" 2>/dev/null || echo "playwright : utiliser npx"
python3 -c "import numpy, scipy, PIL; print('python ok')"
ffmpeg -version | head -1
echo "Prêt. Lance l'app : à la racine du dépôt, NODE_OPTIONS=--max-old-space-size=6144 npx next dev -p 3000"
