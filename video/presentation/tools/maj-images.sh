#!/usr/bin/env bash
# Intègre les images arrivées : préparation, profondeur (nouvelles seulement), puis plans animés manquants.
set -e
cd "$(dirname "$0")/.."
PY=${PY:-python3}
$PY tools/prep.py | grep -v ATTENTE || true
new=$(for f in assets/prep/[0-9][0-9].jpg; do n=$(basename $f .jpg); [ -e "$f.attente" ] && continue; [ -e assets/depth/$n.png ] || echo $n; done)
[ -n "$new" ] && $PY tools/depth.py $new 2>&1 | grep " ok" || true
$PY tools/anim.py
