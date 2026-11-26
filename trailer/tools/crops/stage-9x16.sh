#!/usr/bin/env bash
# Prépare un dossier de projet dont index.html est film/index-9x16.html : lint, check, snapshot et render visent
# le index.html d'un dossier. compositions/ et lib/ sont COPIÉS (le bundler de la CLI ignore les compositions
# derrière un lien symbolique : il les lit vides), assets/ est un lien (180 Mo).
#   node tools/crops/build-9x16.mjs && tools/crops/stage-9x16.sh <dossier>
#   cd <dossier> && npx hyperframes check --json      (CLI du dépôt : trailer/node_modules/.bin/hyperframes)
set -euo pipefail
FILM="$(cd "$(dirname "$0")/../../film" && pwd)"
DIR="${1:?dossier cible}"
mkdir -p "$DIR"
rm -rf "$DIR/compositions" "$DIR/lib"
cp -r "$FILM/compositions" "$FILM/lib" "$DIR/"
for f in hyperframes.json meta.json package.json; do cp "$FILM/$f" "$DIR/$f"; done
ln -sfn "$FILM/assets" "$DIR/assets"
# film/index-9x16.html écrit l'attribut « data-hf9x16-composition-id » (voir build-9x16.mjs) : on rétablit le vrai nom
sed 's/data-hf9x16-composition-id/data-composition-id/g' "$FILM/index-9x16.html" > "$DIR/index.html"
echo "$DIR prêt (index.html = film/index-9x16.html)"
