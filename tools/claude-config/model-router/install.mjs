#!/usr/bin/env node
// Installe le routage des modèles dans la configuration Claude Code de l'utilisateur (~/.claude).
// Idempotent, multiplateforme (Linux, macOS, Windows). Ne touche qu'à ses propres fichiers :
//   ~/.claude/skills/model-router/SKILL.md
//   ~/.claude/agents/mr-*.md
//   ~/.claude/CLAUDE.md          (bloc entre marqueurs model-router, le reste est conservé)
//   ~/.claude/settings.json      (model si absent + modelSettings.claude-opus-5-5.effortLevel = high)
// Usage : node install.mjs [--check] [--dry-run] [--emit-setup-script]
//   --check    vérifie que l'installation est à jour, code de sortie 1 sinon
//   --dry-run  affiche ce qui serait fait sans rien écrire
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const DRY = args.has('--dry-run') || CHECK;
const MAIN_MODEL = 'claude-opus-5-5';
const START = '<!-- model-router:start -->';
const END = '<!-- model-router:end -->';

// --emit-setup-script : imprime un script Bash autonome (fichiers embarqués en base64) à coller
// dans le « Setup script » d'un environnement cloud Claude Code, où ~/.claude ne persiste pas.
if (args.has('--emit-setup-script')) {
  const files = ['install.mjs', 'CLAUDE.snippet.md', 'skills/model-router/SKILL.md',
    ...fs.readdirSync(path.join(SRC, 'agents')).filter((n) => n.endsWith('.md')).sort().map((n) => `agents/${n}`)];
  const out = ['#!/bin/bash', '# Routage des modèles Claude Code : installe ~/.claude/{skills/model-router,agents/mr-*,CLAUDE.md,settings.json}.',
    '# Généré par tools/claude-config/model-router/install.mjs --emit-setup-script. Ne bloque jamais le démarrage.',
    'D=$(mktemp -d)'];
  for (const f of files) {
    out.push(`mkdir -p "$D/${path.posix.dirname(f)}" && echo '${fs.readFileSync(path.join(SRC, f)).toString('base64')}' | base64 -d > "$D/${f}"`);
  }
  out.push('node "$D/install.mjs" || echo "model-router: installation échouée (non bloquant)"', 'rm -rf "$D"', 'true', '');
  process.stdout.write(out.join('\n'));
  process.exit(0);
}

let drift = 0;
const log = (s) => console.info(s);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

function writeIfChanged(dest, content, label) {
  const prev = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
  if (prev === content) return log(`= ${label} (à jour)`);
  drift++;
  if (DRY) return log(`~ ${label} (${prev === null ? 'à créer' : 'à mettre à jour'})`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (prev !== null) {
    // Sauvegarde hors des dossiers chargés par Claude Code (pas de doublon d'agent ou de Skill)
    const bak = path.join(HOME, 'backups', 'model-router', stamp, path.relative(HOME, dest));
    fs.mkdirSync(path.dirname(bak), { recursive: true });
    fs.copyFileSync(dest, bak);
  }
  fs.writeFileSync(dest, content);
  log(`+ ${label} (${prev === null ? 'créé' : 'mis à jour, ancienne version dans backups/model-router/'})`);
}

// 1. Skill
writeIfChanged(
  path.join(HOME, 'skills', 'model-router', 'SKILL.md'),
  fs.readFileSync(path.join(SRC, 'skills', 'model-router', 'SKILL.md'), 'utf8'),
  'skills/model-router/SKILL.md',
);

// 2. Sous-agents (préfixe mr- réservé à ce routage ; aucun autre agent n'est touché)
for (const f of fs.readdirSync(path.join(SRC, 'agents')).filter((n) => n.endsWith('.md')).sort()) {
  writeIfChanged(path.join(HOME, 'agents', f), fs.readFileSync(path.join(SRC, 'agents', f), 'utf8'), `agents/${f}`);
}

// 3. CLAUDE.md utilisateur : remplace ou ajoute le bloc balisé, conserve tout le reste
{
  const dest = path.join(HOME, 'CLAUDE.md');
  const block = `${START}\n${fs.readFileSync(path.join(SRC, 'CLAUDE.snippet.md'), 'utf8').trim()}\n${END}`;
  const prev = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  const next = re.test(prev) ? prev.replace(re, block) : `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}${prev ? '\n' : ''}${block}\n`;
  writeIfChanged(dest, next, 'CLAUDE.md (bloc model-router)');
}

// 4. settings.json utilisateur : fusion minimale, hooks/permissions/env existants conservés
{
  const dest = path.join(HOME, 'settings.json');
  let cur = {};
  if (fs.existsSync(dest)) {
    try {
      cur = JSON.parse(fs.readFileSync(dest, 'utf8'));
    } catch (e) {
      console.error(`! ${dest} n'est pas un JSON valide, rien n'est modifié : ${e.message}`);
      process.exit(2);
    }
  }
  const next = structuredClone(cur);
  if (!next.model) next.model = MAIN_MODEL;
  else if (next.model !== MAIN_MODEL && next.model !== 'opus') log(`! settings.json "model" vaut "${next.model}" : conservé (choix existant). Lance /model ${MAIN_MODEL} si besoin.`);
  next.modelSettings ??= {};
  next.modelSettings[MAIN_MODEL] = { ...(next.modelSettings[MAIN_MODEL] || {}), effortLevel: 'high' };
  writeIfChanged(dest, `${JSON.stringify(next, null, 2)}\n`, 'settings.json (model, modelSettings)');

  // Alertes : réglages qui annuleraient le routage
  const env = { ...(next.env || {}) };
  for (const k of ['CLAUDE_CODE_SUBAGENT_MODEL_FORCE', 'CLAUDE_CODE_EFFORT_LEVEL', 'CLAUDE_CODE_SUBAGENT_MODEL']) {
    if (env[k] !== undefined) log(`! settings.json env.${k}=${env[k]} : annule ou fausse le routage par agent, à retirer.`);
    if (process.env[k] !== undefined) log(`! variable d'environnement ${k}=${process.env[k]} active : annule ou fausse le routage par agent.`);
  }
  if (typeof next.effortLevel === 'string') log(`i settings.json effortLevel=${next.effortLevel} (niveau par défaut des modèles sans entrée modelSettings ; les sous-agents gardent leur propre effort).`);
}

if (CHECK) {
  log(drift ? `\n✗ ${drift} élément(s) à installer ou mettre à jour.` : '\n✓ Installation à jour.');
  process.exit(drift ? 1 : 0);
}
log(DRY ? `\n(dry-run) ${drift} changement(s) prévu(s).` : `\n✓ Terminé (${drift} changement(s)) dans ${HOME}.`);
if (!DRY && drift) log("i Si ~/.claude/agents n'existait pas avant le lancement de la session en cours, redémarre Claude Code pour charger les agents.");
