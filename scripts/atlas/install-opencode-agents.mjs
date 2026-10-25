/**
 * CHANTIER ATLAS — Phase 0
 * Installe les agents du pack SkillsForOpenCode + pays-conformite-lg dans .opencode/agent/
 * pour qu'OpenCode les découvre comme sous-agents (copie, jamais déplacement).
 *
 * Conversion de frontmatter : les fichiers source utilisent le format Claude Code
 * (`name`, `model: opus`, `tools: { "Read": true }`) ; OpenCode attend
 * `description` + `mode`. Le corps est conservé à l'identique.
 *
 * Usage: node scripts/atlas/install-opencode-agents.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = process.cwd();
const DEST = join(ROOT, '.opencode', 'agent');

/** Agents à copier depuis le pack SkillsForOpenCode. */
const PACK_AGENTS = [
  'architect',
  'security-reviewer',
  'database-reviewer',
  'performance-optimizer',
  'code-reviewer',
  'silent-failure-hunter',
  'a11y-architect',
];

/** Agents projet LKDV. */
const PROJECT_AGENTS = [
  {
    name: 'pays-conformite-lg',
    source: join(ROOT, '.agents', 'agents', 'pays-conformite-lg.md'),
  },
];

const PACK_DIR = join(
  ROOT,
  '.agents',
  'skills',
  'SkillsForOpenCode',
  '.opencode',
  'agents'
);

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { frontmatter: '', body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: raw };
  const frontmatter = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\r?\n/, '');
  return { frontmatter, body };
}

function extractDescription(frontmatter) {
  const match = frontmatter.match(/^description:\s*(.+)$/m);
  if (!match) return null;
  return match[1].trim().replace(/^["'](.*)["']$/, '$1');
}

function toOpencodeAgent(sourcePath, explicitName) {
  const raw = readFileSync(sourcePath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const description = extractDescription(frontmatter);
  if (!description) {
    throw new Error(`Description introuvable dans ${sourcePath}`);
  }
  const name = explicitName ?? basename(sourcePath, '.md');
  const converted = `---\ndescription: ${description}\nmode: subagent\n---\n\n${body}`;
  return { name, converted };
}

function writeAgent(name, content) {
  const target = join(DEST, `${name}.md`);
  writeFileSync(target, content, 'utf8');
  return target;
}

function main() {
  mkdirSync(DEST, { recursive: true });
  const created = [];

  for (const agent of PACK_AGENTS) {
    const source = join(PACK_DIR, `${agent}.md`);
    if (!existsSync(source)) {
      throw new Error(`Agent pack introuvable: ${source}`);
    }
    const { name, converted } = toOpencodeAgent(source);
    created.push(writeAgent(name, converted));
  }

  for (const { name, source } of PROJECT_AGENTS) {
    if (!existsSync(source)) {
      throw new Error(`Agent projet introuvable: ${source}`);
    }
    const { converted } = toOpencodeAgent(source, name);
    created.push(writeAgent(name, converted));
  }

  console.log(`Agents installés dans ${DEST}:`);
  for (const file of created) {
    console.log(`  - ${basename(file)}`);
  }
}

main();
