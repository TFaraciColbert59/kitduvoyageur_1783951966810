/**
 * coverage.mjs — Rapport de couverture i18n LKDV (P6).
 *
 * Scanne src/app et src/components à la recherche de chaînes françaises
 * « en dur » évidentes (JSX texte et littéraux de chaînes) et écrit
 * docs/i18n/COVERAGE.md : fichiers scannés, fichiers avec chaînes restantes,
 * clés du dictionnaire, préparation RTL et limites honnêtes.
 *
 * Heuristique assumée : des faux positifs/négatifs sont possibles (segments
 * sans accent ni mot-clé français non détectés). FR reste la langue source.
 *
 * Exécution : node scripts/i18n/coverage.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIRS = ['src/app', 'src/components'];
const OUTPUT = path.join(ROOT, 'docs', 'i18n', 'COVERAGE.md');
const EXPANSION_LABEL = '+40 %';

/** Mots français à fort signal (bornes de mot, insensibles à la casse). */
const FRENCH_WORDS = [
  'votre', 'vos', 'notre', 'nos', 'aucun', 'aucune', 'chargement', 'connexion',
  'inscription', 'compte', 'voyage', 'voyages', 'explorer', 'matériel',
  'communauté', 'rejoindre', 'connectez', 'prochain', 'prochaine', 'points',
  'niveau', 'défi', 'défis', 'classement', 'distinction', 'distinctions',
  'saison', 'récompense', 'récompenses', 'fidélité', 'progression',
  'enregistré', 'enregistrée', 'disponible', 'indisponible', 'erreur',
  'veuillez', 'ajouter', 'supprimer', 'enregistrer', 'continuer', 'retour',
  'ville', 'région', 'pays', 'monde', 'vous', 'êtes', 'pas', 'plus', 'moins',
  'tous', 'toutes', 'mes', 'mon', 'ma', 'sans', 'avec', 'pour', 'dans',
];

const FRENCH_WORD_RE = new RegExp(`\\b(${FRENCH_WORDS.join('|')})\\b`, 'i');
const ACCENTED_RE = /[àâäéèêëîïôöùûüçœÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒ]/;

/** Fichiers touchés par P6 (vérification RTL ciblée). */
const P6_TOUCHED_FILES = [
  'src/app/connexion/page.tsx',
  'src/app/compte/page.tsx',
  'src/components/progression/MaProgressionView.tsx',
  'src/components/compte/TabsCompte.tsx',
  'src/components/compte/CompteLeftSidebar.tsx',
  'src/components/mobile-nav/destinationRegistry.ts',
];

function norm(file) {
  return file.split(path.sep).join('/');
}

function collectFiles(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const files = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(relative));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(norm(relative));
    }
  }
  return files;
}

/** Extrait les segments textuels candidats d'une ligne (JSX texte + chaînes). */
function findTextSegments(line) {
  const segments = [];
  for (const match of line.matchAll(/>([^<>{}]+)</g)) {
    segments.push(match[1]);
  }
  for (const match of line.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`/g)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    if (value) segments.push(value);
  }
  return segments;
}

function looksFrench(segment) {
  const value = segment.trim();
  if (value.length < 3) return false;
  if (ACCENTED_RE.test(value)) return true;
  return FRENCH_WORD_RE.test(value);
}

function scanFile(file) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const hits = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    for (const segment of findTextSegments(line)) {
      if (looksFrench(segment)) {
        hits.push({ line: index + 1, extract: segment.trim().slice(0, 100) });
      }
    }
  }
  return hits;
}

/** Clés pointées d'un fichier de dictionnaire TS (parseur simple, suffisant). */
function extractDictionaryKeys(source) {
  const keys = [];
  const stack = [];
  let pending = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    if (trimmed.startsWith('}')) {
      const indent = line.length - line.trimStart().length;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      pending = null;
      continue;
    }
    const match = line.match(/^(\s*)([A-Za-z_$][\w$]*)\s*:\s*(.*)$/);
    if (!match) {
      // Valeur multi-ligne : la chaîne est sur la ligne suivante.
      if (pending && /^['"`]/.test(trimmed)) {
        while (stack.length && stack[stack.length - 1].indent >= pending.indent) stack.pop();
        keys.push([...stack.map((item) => item.name), pending.name].join('.'));
        pending = null;
      }
      continue;
    }
    const indent = match[1].length;
    const name = match[2];
    const rest = match[3];
    if (rest === '') {
      pending = { name, indent };
      continue;
    }
    pending = null;
    if (/^['"`]/.test(rest)) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      keys.push([...stack.map((item) => item.name), name].join('.'));
    } else if (rest.startsWith('{')) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      stack.push({ name, indent });
    }
  }
  return keys;
}

function sectionCounts(keys) {
  const counts = new Map();
  for (const key of keys) {
    const section = key.split('.')[0];
    counts.set(section, (counts.get(section) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Détecte les classes physiques ml-/mr-/pl-/pr- dans un fichier TS/TSX. */
function scanLogicalProperties(file) {
  if (!fs.existsSync(path.join(ROOT, file))) return null;
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const matches = content.match(/(?:^|[\s"'`])(?:ml|mr|pl|pr)-[a-z0-9[]/g) ?? [];
  return matches.length;
}

function tableRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

function main() {
  const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir));
  const fileHits = [];
  let totalSegments = 0;
  for (const file of files) {
    const hits = scanFile(file);
    if (hits.length > 0) {
      fileHits.push({ file, hits });
      totalSegments += hits.length;
    }
  }
  fileHits.sort((a, b) => b.hits.length - a.hits.length);

  const frSource = fs.readFileSync(
    path.join(ROOT, 'src/lib/i18n/translations/fr.ts'),
    'utf8'
  );
  const enSource = fs.readFileSync(
    path.join(ROOT, 'src/lib/i18n/translations/en.ts'),
    'utf8'
  );
  const frKeys = extractDictionaryKeys(frSource);
  const enKeys = extractDictionaryKeys(enSource);
  const parity = frKeys.length === enKeys.length && frKeys.every((key, index) => key === enKeys[index]);

  const logicalPropertyRows = P6_TOUCHED_FILES.map((file) => {
    const count = scanLogicalProperties(file);
    return tableRow([
      `\`${file}\``,
      count === null ? 'absent' : String(count),
    ]);
  });

  const lines = [];
  lines.push('# Rapport de couverture i18n — P6');
  lines.push('');
  lines.push(`Généré le ${new Date().toISOString().slice(0, 10)} par \`node scripts/i18n/coverage.mjs\`.`);
  lines.push('');
  lines.push("## 1. Portée et méthode");
  lines.push('');
  lines.push("- **FR reste la langue source.** L'anglais ne couvre que les surfaces listées en §3 ; les autres composants restent en français.");
  lines.push(`- Dossiers scannés : ${SCAN_DIRS.map((dir) => `\`${dir}\``).join(', ')} (fichiers \`.ts\`/\`.tsx\`).`);
  lines.push('- Heuristique : segments JSX texte et littéraux de chaînes contenant un caractère accentué ou un mot français courant. Faux positifs/négatifs possibles (chaînes courtes sans accent non détectées).');
  lines.push('');
  lines.push("## 2. Chiffres clés");
  lines.push('');
  lines.push("- Fichiers scannés : **" + files.length + "**");
  lines.push("- Fichiers contenant au moins un segment français évident : **" + fileHits.length + "**");
  lines.push("- Segments français détectés : **" + totalSegments + "**");
  lines.push("- Clés du dictionnaire FR : **" + frKeys.length + "** — clés EN : **" + enKeys.length + "** — parité FR/EN : **" + (parity ? 'oui' : 'NON') + "**");
  lines.push('');
  lines.push('| Section | Clés |');
  lines.push('| --- | ---: |');
  for (const [section, count] of sectionCounts(frKeys)) {
    lines.push(tableRow([section, String(count)]));
  }
  lines.push('');
  lines.push('## 3. Surfaces couvertes par l’anglais (P6)');
  lines.push('');
  lines.push('| Surface | Fichier(s) | Détail |');
  lines.push('| --- | --- | --- |');
  lines.push(tableRow([
    'Navigation mobile (libellés)',
    '`src/components/mobile-nav/destinationRegistry.ts`',
    'Helper `getDestinationLabel(id, locale)` sur les libellés FR/EN existants (barre inférieure non modifiée).',
  ]));
  lines.push(tableRow([
    'Connexion / inscription / mot de passe oublié',
    '`src/app/connexion/page.tsx`',
    'Titres, champs, placeholders, boutons, erreurs, toasts, aria de mot de passe.',
  ]));
  lines.push(tableRow([
    'Ma progression',
    '`src/components/progression/MaProgressionView.tsx`',
    'En-tête, compétences, classement (5 filtres), défis, distinctions, gains, solde, états chargement/vide/erreur.',
  ]));
  lines.push(tableRow([
    'Entrées du compte',
    '`src/components/compte/TabsCompte.tsx`, `src/components/compte/CompteLeftSidebar.tsx`, `src/app/compte/page.tsx`',
    'Entrées « Ma progression », « Gains & Récompenses », « Paramètres », navigation, titres d’état connecté.',
  ]));
  lines.push(tableRow([
    'États communs',
    '`src/lib/i18n/translations/{fr,en}.ts`',
    'chargement, vide, erreur, hors-ligne, indisponible, réessayer.',
  ]));
  lines.push('');
  lines.push('## 4. Chaînes françaises restantes');
  lines.push('');
  lines.push(`**${fileHits.length} fichiers sur ${files.length}** contiennent encore des chaînes françaises évidentes. Liste complète (triée par volume) :`);
  lines.push('');
  lines.push('| Fichier | Segments |');
  lines.push('| --- | ---: |');
  for (const { file, hits } of fileHits) {
    lines.push(tableRow([`\`${file}\``, String(hits.length)]));
  }
  lines.push('');
  const top = fileHits.slice(0, 15);
  if (top.length > 0) {
    lines.push('Exemples (15 fichiers les plus denses) :');
    lines.push('');
    for (const { file, hits } of top) {
      lines.push(`- \`${file}\``);
      for (const hit of hits.slice(0, 3)) {
        lines.push(`  - L${hit.line} : « ${hit.extract} »`);
      }
    }
    lines.push('');
  }
  lines.push('## 5. Préparation RTL');
  lines.push('');
  lines.push('**Règle permanente** : pour tout nouveau composant ou toute modification, utiliser les propriétés logiques Tailwind `ms-*` / `me-*` / `ps-*` / `pe-*` (et `start-*` / `end-*`) au lieu de `ml-*` / `mr-*` / `pl-*` / `pr-*` / `left-*` / `right-*`. Aucune feuille `src/styles/**` n’est modifiée par P6.');
  lines.push('');
  lines.push('Vérification des fichiers touchés par P6 (classes physiques `ml-/mr-/pl-/pr-`) :');
  lines.push('');
  lines.push('| Fichier P6 | Occurrences |');
  lines.push('| --- | ---: |');
  for (const row of logicalPropertyRows) lines.push(row);
  lines.push('');
  lines.push('Les occurrences restantes ailleurs dans le dépôt constituent une dette RTL documentée, hors périmètre P6 — à convertir lors des prochaines refontes.');
  lines.push('');
  lines.push('## 6. Limites honnêtes');
  lines.push('');
  lines.push(`- L’expansion pseudo-localisée (${EXPANSION_LABEL}) est testée au niveau des données (\`tests/i18n/pseudo-localization.spec.ts\`) : longueurs, parité et placeholders. Aucun rendu pixel ni mesure de troncature visuelle n’est revendiqué.`);
  lines.push('- La traduction EN ne prétend pas couvrir les 400+ composants : seules les surfaces listées en §3 sont garanties. Le reste est listé en §4.');
  lines.push('- Certaines chaînes visibles proviennent de données serveur (titres de niveau, noms de badges, descriptions de défis, alias de classement) : elles restent en français tant que les données ne sont pas traduites.');
  lines.push('- L’heuristique de détection (§1) sous-estime probablement le volume réel (chaînes sans accent ni mot-clé) et peut surévaluer certains fichiers (libellés techniques).');
  lines.push('- Aucun audit de rendu réel (390×844, 430×932, etc.) n’a été exécuté pour P6 : le test de pseudo-localisation est un test de données, pas un test visuel.');
  lines.push('');

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');

  console.log(`[i18n] Fichiers scannés : ${files.length}`);
  console.log(`[i18n] Fichiers avec FR restant : ${fileHits.length} (${totalSegments} segments)`);
  console.log(`[i18n] Clés FR : ${frKeys.length} / EN : ${enKeys.length} — parité : ${parity ? 'oui' : 'NON'}`);
  console.log(`[i18n] Écrit : ${norm(path.relative(ROOT, OUTPUT))}`);
}

main();
