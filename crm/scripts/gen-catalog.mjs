#!/usr/bin/env node
/**
 * Génère src/lib/catalog.ts depuis crm/bundle/04_CATALOGUE_ACTIONS.md.
 * Source unique : le tableau du bundle. Toute différence = écart (07_VERIFICATION § 3).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(path.join(root, 'bundle/04_CATALOGUE_ACTIONS.md'), 'utf8');

const POLES = {
  D1: 'MEMB', D2: 'CONF', D3: 'CONF', D4: 'CONF', D5: 'CONF', D6: 'CONF', D7: 'CONT',
  D8: 'CONF', D9: 'COMM', D10: 'COMM', D11: 'COMM', D12: 'CROI', D13: 'COMM', D14: 'CONF',
  D15: 'CONT', D16: 'CROI', D17: 'PRIA', D18: 'MEMB', D19: 'TECH'
};
const OVERRIDES = { 'ACT-112': 'TECH', 'ACT-113': 'TECH', 'ACT-134': 'CROI', 'ACT-136': 'TECH' };

const rows = [];
let domain = null;
for (const line of md.split('\n')) {
  const dm = line.match(/^## (D\d+) — (.+)$/);
  if (dm) { domain = dm[1]; continue; }
  const m = line.match(/^\| (ACT-\d{3}) \| ([a-z0-9_]+) \| (.+?) \| (membre|resp\.|SA) \| (oui|—) \| (oui|—) \| (oui|—) \| (propose|lit|—) \| (P\d) \|$/);
  if (!m || !domain) continue;
  const [, id, command, action, role, two, reason, undo, agent, rt] = m;
  rows.push({
    id, command, label: action, domain,
    pole: OVERRIDES[id] ?? POLES[domain],
    roleMin: role === 'resp.' ? 'responsable' : role === 'SA' ? 'super_admin' : 'membre',
    needsValidation: two === 'oui',
    reasonRequired: reason === 'oui',
    undoable: undo === 'oui',
    agent: agent === 'propose' ? 'propose' : agent === 'lit' ? 'read' : 'never',
    realtime: rt
  });
}

if (rows.length !== 144) {
  console.error(`catalogue: ${rows.length} actions trouvées, 144 attendues`);
  process.exit(1);
}
const byPole = rows.reduce((acc, r) => ((acc[r.pole] = (acc[r.pole] ?? 0) + 1), acc), {});
const ts = `// GÉNÉRÉ par scripts/gen-catalog.mjs depuis bundle/04_CATALOGUE_ACTIONS.md — ne pas éditer.
export type PoleCode = 'CONF' | 'MEMB' | 'COMM' | 'CONT' | 'PRIA' | 'CROI' | 'TECH';
export type RoleMin = 'membre' | 'responsable' | 'super_admin';
export type AgentMode = 'propose' | 'read' | 'never';
export type CommandDef = {
  id: string; command: string; label: string; domain: string; pole: PoleCode;
  roleMin: RoleMin; needsValidation: boolean; reasonRequired: boolean; undoable: boolean;
  agent: AgentMode; realtime: 'P1' | 'P2' | 'P3';
};
export const POLES: { code: PoleCode; label: string }[] = [
  { code: 'CONF', label: 'Confiance' }, { code: 'MEMB', label: 'Membres' }, { code: 'COMM', label: 'Commerce' },
  { code: 'CONT', label: 'Contenus' }, { code: 'PRIA', label: 'Produit et IA' }, { code: 'CROI', label: 'Croissance' },
  { code: 'TECH', label: 'Technique' }
];
export const COMMANDS: CommandDef[] = ${JSON.stringify(rows, null, 2)} as CommandDef[];
export const COMMAND_COUNT = COMMANDS.length;
export const COMMANDS_BY_POLE = ${JSON.stringify(byPole, null, 2)} as Record<PoleCode, number>;
export function commandByCommand(name: string): CommandDef | undefined { return COMMANDS.find((c) => c.command === name); }
export function commandById(id: string): CommandDef | undefined { return COMMANDS.find((c) => c.id === id); }
`;
writeFileSync(path.join(root, 'src/lib/catalog.ts'), ts);
console.log(`catalog.ts: ${rows.length} actions, ${Object.entries(byPole).map(([k, v]) => `${k}:${v}`).join(' ')}`);
