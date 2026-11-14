#!/bin/sh
# Rend les images clés des propositions dans qa/snapshots/motion/. Depuis trailer/ : sh motion-lab/stills.sh [nom…]
set -e
cd "$(dirname "$0")/.."
O=qa/snapshots/motion
r() { node motion-lab/render.mjs still "$1" 0 "$O/$1.jpg" "${2:-{}}" | grep -v '^\[page\]' || true; }
ALL="idee-01-fil-soleil idee-01-fil-seceda idee-01-fil-epingle idee-01-fil-tofana idee-02-point-sorapis idee-03-cadre idee-05-courbes-tre-cime idee-06-constellation idee-07-donnee-tre-cime idee-08-poids-lit idee-09-verbes-rever idee-09-verbes-raconter idee-10-logo-crete idee-10-logo-signature idee-11-carte idee-12-point-soleil"
for s in ${@:-$ALL}; do r "$s"; done
# images tirées des essais (rendus par essais.sh)
if [ -z "$1" ]; then
  node motion-lab/render.mjs still png 0 "$O/idee-04-iris.jpg" '{"src":"work/essai2/f0244.png"}' | grep -v '^\[page\]' || true
  node motion-lab/render.mjs still png 0 "$O/idee-07-donnee-coureur.jpg" '{"src":"work/essai3B/f0810.png"}' | grep -v '^\[page\]' || true
fi
