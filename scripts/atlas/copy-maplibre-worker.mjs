/**
 * CHANTIER ATLAS — Phase 2
 * Copie le worker MapLibre GL v6 (+ son chunk partagé) dans public/maplibre.
 *
 * Pourquoi : maplibre-gl v6 calcule par défaut l'URL de son worker via
 * `import.meta.url` ; une fois bundlé par webpack/Next, cette URL pointe vers
 * un fichier inexistant → le worker ne démarre jamais silencieusement et AUCUNE
 * source GeoJSON/vectorielle n'est rendue (tuiles raster OK, calques invisibles).
 * Solution documentée MapLibre : servir le worker et appeler `setWorkerUrl()`
 * avant la création de la carte (voir UnifiedExplorerMap).
 *
 * Les fichiers sont versionnés dans public/maplibre (même convention que
 * public/icons) ET re-générés par predev/prebuild pour rester alignés sur la
 * version installée de maplibre-gl.
 *
 * Usage: node scripts/atlas/copy-maplibre-worker.mjs
 */
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, 'node_modules', 'maplibre-gl', 'dist');
const DEST_DIR = join(ROOT, 'public', 'maplibre');

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

function main() {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`[atlas:worker] maplibre-gl introuvable dans ${SOURCE_DIR}`);
    process.exit(1);
  }
  mkdirSync(DEST_DIR, { recursive: true });

  for (const file of FILES) {
    const source = join(SOURCE_DIR, file);
    const dest = join(DEST_DIR, file);
    if (!existsSync(source)) {
      console.error(`[atlas:worker] fichier source manquant: ${source}`);
      process.exit(1);
    }
    const sourceSize = statSync(source).size;
    const destExists = existsSync(dest) && statSync(dest).size === sourceSize;
    if (destExists) {
      console.log(`[atlas:worker] ${file} déjà à jour (${sourceSize} octets)`);
      continue;
    }
    copyFileSync(source, dest);
    console.log(`[atlas:worker] ${file} copié (${sourceSize} octets)`);
  }
}

main();
