// Compas — phase 7 : construction de l'inventaire (lecture des fichiers, du
// dictionnaire français et des tables du Compas), autour du cœur pur
// `inventory-core.mjs`. Utilisé par le script `inventory-controls.mjs` et par
// le test Vitest du registre de couverture.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createJITI from 'jiti';
import ts from 'typescript';
import { extractControls } from './inventory-core.mjs';
import { classifyControl, SCANNED_FILES, SCANNED_DIRS } from './inventory-config.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const INVENTORY_JSON = 'docs/compas/phase7/inventaire-controles.json';
export const INVENTORY_MD = 'docs/compas/phase7/inventaire-controles.md';
export const REGISTRY_JSON = 'tests/e2e-compas-full/coverage-registry.json';

/** Les fichiers parcourus, relatifs à la racine, triés (sortie déterministe). */
export function scannedFiles(root = ROOT) {
  const files = new Set(SCANNED_FILES);
  for (const dir of SCANNED_DIRS) {
    for (const f of fs.readdirSync(path.join(root, dir))) {
      if (f.endsWith('.tsx')) files.add(`${dir}/${f}`);
    }
  }
  return [...files].filter((f) => fs.existsSync(path.join(root, f))).sort();
}

/** Lit une table `export const NOM = [...]` de chaînes dans une source TS. */
function readStringArray(file, name, root) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let out = null;
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText() === name && n.initializer) {
      const init = ts.isAsExpression(n.initializer) ? n.initializer.expression : n.initializer;
      if (ts.isArrayLiteralExpression(init)) out = init.elements.filter(ts.isStringLiteral).map((e) => e.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!out) throw new Error(`[inventaire] table ${name} introuvable dans ${file}`);
  return out;
}

/** Dictionnaire, étapes, parcours de tiroir et activités : les vraies tables du Compas. */
export function loadTables(root = ROOT) {
  const jiti = createJITI(path.join(root, 'scripts/compas/lib/inventory-build.mjs'), {
    interopDefault: true,
    alias: { '@': path.join(root, 'src') },
  });
  const { translations } = jiti(path.join(root, 'src/lib/i18n/translations/index.ts'));
  const { getTranslation } = jiti(path.join(root, 'src/lib/i18n/translate.ts'));
  const { COMPAS_STEPS } = jiti(path.join(root, 'src/features/compas/engine/compasModel.ts'));
  const { STEP_FLOWS } = jiti(path.join(root, 'src/features/compas/components/compasTypes.ts'));
  const { activityName } = jiti(path.join(root, 'src/features/compas/engine/compasI18n.ts'));
  const fr = translations.fr;
  const resolve = (key) => getTranslation(fr, key);
  const activities = readStringArray('src/features/compas/components/CompasOuFlows.tsx', 'ACTIVITY_ORDER', root);
  const steps = COMPAS_STEPS.map((s) => ({ key: s.id, name: resolve(`compas.steps.${s.id}`) ?? s.label, etape: s.id }));
  const flows = Object.entries(STEP_FLOWS).flatMap(([step, list]) =>
    list.map((f) => ({ key: `${step}.${f.id}`, name: resolve(f.labelKey) ?? f.label, etape: step, ecran: `tiroir ${step} › ${resolve(f.labelKey) ?? f.label}` }))
  );
  const acts = activities.map((a) => ({ key: a, name: activityName(a, 'fr') ?? a }));
  return { resolve, steps, flows, activities: acts };
}

/** Les expansions : une ligne de table du Compas = un contrôle distinct. */
export function expansionsFrom(tables) {
  return [
    // Capsule d'étapes : sur l'écran du Compas, chaque bouton ouvre son étape ;
    // sur le Compas vide, ils sont verrouillés (sauf « Où ») et restent au départ.
    { receiver: 'COMPAS_STEPS', component: 'CompasScreen', items: tables.steps },
    { receiver: 'COMPAS_STEPS', component: 'CompasStart', items: tables.steps.map((s) => ({ ...s, etape: undefined })) },
    // Onglets du tiroir de chaque étape (26 parcours).
    { receiver: 'flows', component: 'StepSheet', items: tables.flows },
    // Tuiles d'activité : Compas vide (« Préciser ») et parcours « Activité ».
    { receiver: 'ACTIVITY_ORDER', items: tables.activities.map((a) => ({ ...a, etape: undefined })) },
  ];
}

/** Inventaire complet, trié par fichier puis ligne. */
export function buildInventory(root = ROOT) {
  const tables = loadTables(root);
  const expansions = expansionsFrom(tables);
  const missingKeys = new Set();
  const controls = [];
  const files = scannedFiles(root);
  for (const file of files) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    controls.push(
      ...extractControls(src, {
        file,
        resolve: tables.resolve,
        classify: classifyControl,
        expansions,
        onMissingKeys: (keys) => keys.forEach((k) => missingKeys.add(`${file}: ${k}`)),
      })
    );
  }
  return { files, controls, missingKeys: [...missingKeys].sort() };
}

const ETAPE_ORDER = ['depart', 'commun', 'ou', 'nous', 'resa', 'verdict', 'kit'];
export const ETAPE_LABEL = {
  depart: 'Départ (Compas vide, choix du voyage)',
  commun: 'Commun (capsule, tiroirs, carte, affichage)',
  ou: 'Où',
  nous: 'Nous',
  resa: 'Résa',
  verdict: 'Verdict',
  kit: 'Kit',
};
export { ETAPE_ORDER };

/** Le JSON versionné : rien qui change d'une machine à l'autre (pas de date). */
export function inventoryJson(inv) {
  const counted = inv.controls.filter((c) => !c.delegue);
  const byEtape = Object.fromEntries(ETAPE_ORDER.map((e) => [e, counted.filter((c) => c.etape === e).length]));
  return {
    description:
      "Inventaire statique des contrôles interactifs du Compas (phase 7). Généré par scripts/compas/inventory-controls.mjs : ne pas modifier à la main.",
    fichiers: inv.files,
    total: counted.length,
    delegues: inv.controls.length - counted.length,
    par_etape: byEtape,
    controles: inv.controls.map((c) => ({
      id: c.id,
      etape: c.etape,
      ecran: c.ecran,
      type: c.kind,
      ...(c.gesture ? { geste: c.gesture } : {}),
      nom: c.name,
      ...(c.variants.length > 1 ? { variantes: c.variants } : {}),
      motif: c.matcher,
      balise: c.tag,
      ...(c.role ? { role: c.role } : {}),
      ...(c.type ? { input: c.type } : {}),
      classes: c.classes,
      ancetres: c.ancestors,
      fichier: c.file,
      ligne: c.line,
      composant: c.component,
      ...(c.groupe ? { groupe: c.groupe } : {}),
      ...(c.disabled ? { desactive: c.disabled } : {}),
      ...(c.delegue ? { delegue: true } : {}),
      gestionnaires: c.handlers,
    })),
  };
}

export function inventoryMarkdown(json) {
  const lines = [
    '# Compas — inventaire des contrôles (phase 7)',
    '',
    '> Généré par `node scripts/compas/inventory-controls.mjs` — ne pas modifier à la main.',
    '> Source de vérité lisible par machine : `inventaire-controles.json`.',
    '',
    `**${json.total} contrôles** dans ${json.fichiers.length} fichiers (plus ${json.delegues} bouton(s) générique(s) de primitive, comptés à chaque usage).`,
    '',
    '| Étape | Contrôles |',
    '|---|---:|',
    ...ETAPE_ORDER.map((e) => `| ${ETAPE_LABEL[e]} | ${json.par_etape[e]} |`),
    '',
  ];
  for (const e of ETAPE_ORDER) {
    const list = json.controles.filter((c) => c.etape === e && !c.delegue);
    if (!list.length) continue;
    lines.push(`## ${ETAPE_LABEL[e]} — ${list.length}`, '', '| Nom accessible | Type | Écran | Source |', '|---|---|---|---|');
    for (const c of list) {
      const name = (c.nom || '').replace(/\|/g, '\\|');
      const type = c.geste ? `geste (${c.geste})` : c.type;
      const dis = c.desactive ? ` · désactivé ${c.desactive}` : '';
      lines.push(`| ${name} | ${type}${dis} | ${c.ecran} | \`${c.fichier}:${c.ligne}\` |`);
    }
    lines.push('');
  }
  const deleg = json.controles.filter((c) => c.delegue);
  if (deleg.length) {
    lines.push('## Primitives (non comptées : chaque usage est inventorié)', '');
    for (const c of deleg) lines.push(`- \`${c.fichier}:${c.ligne}\` ${c.composant} › ${c.type}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Lot de scénarios chargé de chaque étape (répartition de la phase 7). */
export const LOTS = {
  depart: 'lot Où',
  ou: 'lot Où',
  nous: 'lot Nous+Résa',
  resa: 'lot Nous+Résa',
  verdict: 'lot Verdict+Kit',
  kit: 'lot Verdict+Kit',
  commun: 'lot commun (banc)',
};

/**
 * Registre aligné sur l'inventaire : chaque contrôle compté y a une entrée,
 * aucune entrée orpheline. Les entrées existantes sont gardées telles quelles.
 */
export function syncRegistry(before, controls) {
  const registry = {};
  const added = [];
  for (const c of controls) {
    if (c.delegue) continue;
    if (before[c.id]) registry[c.id] = before[c.id];
    else {
      registry[c.id] = { en_attente: LOTS[c.etape] ?? 'lot à définir' };
      added.push(c.id);
    }
  }
  const removed = Object.keys(before).filter((id) => !(id in registry));
  return { registry, added, removed };
}
