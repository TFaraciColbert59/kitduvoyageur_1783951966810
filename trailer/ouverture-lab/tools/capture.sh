#!/bin/bash
# Capture des images (numéros à 24 i/s) via `hyperframes snapshot`, renommées f-NN.png.
# Usage : tools/capture.sh <dossier-sortie> <image> [image ...]   (depuis trailer/ouverture-lab/)
set -euo pipefail
OUT="$1"; shift
mkdir -p "$OUT"
AT=""
for f in "$@"; do
  t=$(node -e "process.stdout.write(String(+(($f)/24).toFixed(6)))")
  AT="${AT:+$AT,}$t"
done
TMP="$OUT/.raw"
rm -rf "$TMP"
npx hyperframes snapshot --at "$AT" --no-end --keep -o "$TMP" --timeout 120000 . >/dev/null
for f in "$@"; do
  t=$(node -e "process.stdout.write(String(+(($f)/24).toFixed(6)))")
  # nom de --keep : at-<secondes>s.png sans zéros finaux
  src=$(node -e "const t=+process.argv[1];process.stdout.write('at-'+String(+t.toFixed(3))+'s.png')" "$t")
  if [ -f "$TMP/$src" ]; then mv "$TMP/$src" "$OUT/f-$(printf %02d "$f").png"; else echo "manque $src" >&2; ls "$TMP" >&2; fi
done
rm -rf "$TMP"
