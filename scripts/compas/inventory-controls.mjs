// Compas — phase 7 : inventaire statique EXHAUSTIF des contrôles interactifs.
//
// Parcourt src/features/compas/components, src/app/compas et les composants
// partagés rendus dans le Compas (voir lib/inventory-config.mjs), et écrit :
//   docs/compas/phase7/inventaire-controles.json  (machine : id, nom, étape, motif…)
//   docs/compas/phase7/inventaire-controles.md    (lecture humaine, par étape)
//
// Usage :
//   node scripts/compas/inventory-controls.mjs           écrit les deux fichiers
//   node scripts/compas/inventory-controls.mjs --check   échoue si les fichiers sont périmés
//   node scripts/compas/inventory-controls.mjs --sync-registry
//       ajoute au registre de couverture chaque nouveau contrôle (« en_attente » de
//       son lot) et retire ceux qui n'existent plus. Un contrôle « en attente »
//       reste NON couvert dans le rapport : il faut lui écrire un scénario, ou
//       justifier `raison_non_testable`.
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  INVENTORY_JSON,
  INVENTORY_MD,
  REGISTRY_JSON,
  buildInventory,
  inventoryJson,
  inventoryMarkdown,
  syncRegistry,
  ETAPE_ORDER,
} from './lib/inventory-build.mjs';

const check = process.argv.includes('--check');
const inv = buildInventory(ROOT);
const json = inventoryJson(inv);
const jsonText = JSON.stringify(json, null, 2) + '\n';
const mdText = inventoryMarkdown(json) + '\n';

if (inv.missingKeys.length) {
  console.warn(`[inventaire] ${inv.missingKeys.length} clé(s) i18n introuvable(s) :`);
  for (const k of inv.missingKeys) console.warn('  ', k);
}

if (process.argv.includes('--sync-registry')) {
  const file = path.join(ROOT, REGISTRY_JSON);
  const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const { registry, added, removed } = syncRegistry(before, inv.controls);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2) + '\n');
  console.info(`[registre] +${added.length} en attente, −${removed.length} retirés → ${REGISTRY_JSON}`);
  for (const id of removed) console.info('   retiré :', id);
}

if (check) {
  const same = (rel, text) =>
    fs.existsSync(path.join(ROOT, rel)) && fs.readFileSync(path.join(ROOT, rel), 'utf8') === text;
  if (!same(INVENTORY_JSON, jsonText) || !same(INVENTORY_MD, mdText)) {
    console.error('[inventaire] périmé : relancer `node scripts/compas/inventory-controls.mjs`.');
    process.exit(1);
  }
  console.info(`[inventaire] à jour : ${json.total} contrôles.`);
} else {
  fs.mkdirSync(path.join(ROOT, path.dirname(INVENTORY_JSON)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, INVENTORY_JSON), jsonText);
  fs.writeFileSync(path.join(ROOT, INVENTORY_MD), mdText);
  console.info(
    `[inventaire] ${json.total} contrôles (${ETAPE_ORDER.map((e) => `${e} ${json.par_etape[e]}`).join(', ')}) → ${INVENTORY_JSON}`
  );
}
