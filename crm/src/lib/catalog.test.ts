import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMANDS,
  COMMAND_COUNT,
  COMMANDS_BY_POLE,
  POLES,
  commandById,
  commandByCommand,
  type CommandDef,
  type PoleCode
} from './catalog';

/**
 * Couche 2 (07_VERIFICATION) : le catalogue est la source du registre `admin.commands`,
 * de la barre de commande, du serveur MCP et des tests E2E. Ces tests comparent le
 * fichier généré `catalog.ts` au tableau du bundle (04_CATALOGUE_ACTIONS.md) :
 * toute différence est un écart (07_VERIFICATION § 3).
 */

const BUNDLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../bundle/04_CATALOGUE_ACTIONS.md');

/** Codes de pôle connus, dans l'ordre du bundle — sert aussi à ignorer « (RGPD) ». */
const POLE_CODES: PoleCode[] = ['CONF', 'MEMB', 'COMM', 'CONT', 'PRIA', 'CROI', 'TECH'];
const ROLE_LABELS: Record<string, CommandDef['roleMin']> = { membre: 'membre', 'resp.': 'responsable', SA: 'super_admin' };

/**
 * Lit le tableau du bundle : une ligne par action, le pôle venant de l'en-tête de
 * domaine, sauf mention explicite en fin de libellé (« … (TECH) »).
 */
export function parseCatalogueDoc(markdown: string): CommandDef[] {
  const rows: CommandDef[] = [];
  let domain = '';
  let domainPole: PoleCode | null = null;
  for (const line of markdown.split('\n')) {
    const header = line.match(new RegExp(`^## (D\\d+) — .+? \\((${POLE_CODES.join('|')})(?:, sauf mention)?\\)$`));
    if (header) {
      domain = header[1]!;
      domainPole = header[2] as PoleCode;
      continue;
    }
    const row = line.match(
      /^\| (ACT-\d{3}) \| ([a-z][a-z0-9_]*) \| (.+?) \| (membre|resp\.|SA) \| (oui|—) \| (oui|—) \| (oui|—) \| (propose|lit|—) \| (P[123]) \|$/
    );
    if (!row || !domain || !domainPole) continue;
    const [, id, command, label, role, twoPeople, reason, undo, agent, realtime] = row as unknown as string[];
    const suffix = label!.match(new RegExp(`\\((${POLE_CODES.join('|')})\\)$`));
    rows.push({
      id: id!,
      command: command!,
      label: label!,
      domain,
      pole: (suffix ? suffix[1] : domainPole) as PoleCode,
      roleMin: ROLE_LABELS[role!]!,
      needsValidation: twoPeople === 'oui',
      reasonRequired: reason === 'oui',
      undoable: undo === 'oui',
      agent: agent === 'propose' ? 'propose' : agent === 'lit' ? 'read' : 'never',
      realtime: realtime as CommandDef['realtime']
    });
  }
  return rows;
}

const DOC = parseCatalogueDoc(readFileSync(BUNDLE, 'utf8'));

describe('catalogue des 144 actions', () => {
  it('contient exactement 144 actions, toutes domaines et pôles confondus', () => {
    expect(COMMAND_COUNT).toBe(144);
    expect(COMMANDS).toHaveLength(144);
    expect(DOC).toHaveLength(144);
  });

  it('numérote les identifiants ACT-001 à ACT-144 sans trou ni doublon', () => {
    const expected = Array.from({ length: 144 }, (_, i) => `ACT-${String(i + 1).padStart(3, '0')}`);
    expect(COMMANDS.map((c) => c.id)).toEqual(expected);
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(144);
    expect(COMMANDS.map((c) => c.command)).toEqual([...new Set(COMMANDS.map((c) => c.command))]);
  });

  it('donne à chaque action un pôle, un rôle minimal, un mode agent et une priorité valides', () => {
    const bad: string[] = [];
    for (const c of COMMANDS) {
      if (!POLE_CODES.includes(c.pole)) bad.push(`${c.id}: pôle inconnu « ${c.pole} »`);
      if (!['membre', 'responsable', 'super_admin'].includes(c.roleMin)) bad.push(`${c.id}: rôle inconnu « ${c.roleMin} »`);
      if (!['propose', 'read', 'never'].includes(c.agent)) bad.push(`${c.id}: mode agent inconnu « ${c.agent} »`);
      if (!['P1', 'P2', 'P3'].includes(c.realtime)) bad.push(`${c.id}: priorité temps réel inconnue « ${c.realtime} »`);
      if (!/^D([1-9]|1[0-9])$/.test(c.domain)) bad.push(`${c.id}: domaine inconnu « ${c.domain} »`);
      if (!/^[a-z][a-z0-9_]*$/.test(c.command)) bad.push(`${c.id}: nom de commande « ${c.command} » hors snake_case`);
      if (!c.label.trim()) bad.push(`${c.id}: libellé vide`);
      if (c.label !== c.label.trim() || /\s{2,}/.test(c.label)) bad.push(`${c.id}: libellé mal espacé`);
      for (const flag of ['needsValidation', 'reasonRequired', 'undoable'] as const) {
        if (typeof c[flag] !== 'boolean') bad.push(`${c.id}: ${flag} n'est pas un booléen`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('reste identique au tableau du bundle, champ par champ (source unique)', () => {
    const diffs: string[] = [];
    for (let i = 0; i < Math.max(DOC.length, COMMANDS.length); i += 1) {
      const doc = DOC[i];
      const code = COMMANDS[i];
      if (!doc || !code) {
        diffs.push(`rang ${i}: bundle « ${doc?.id ?? '—'} » / catalogue « ${code?.id ?? '—'} »`);
        continue;
      }
      for (const field of Object.keys(doc) as (keyof CommandDef)[]) {
        if (doc[field] !== code[field]) {
          diffs.push(`${doc.id} ${field}: bundle « ${String(doc[field])} » / catalogue « ${String(code[field])} »`);
        }
      }
    }
    expect(diffs).toEqual([]);
  });

  it('déclare 19 domaines et 7 pôles dont les libellés viennent du bundle', () => {
    expect(new Set(COMMANDS.map((c) => c.domain)).size).toBe(19);
    expect(POLES.map((p) => p.code)).toEqual(POLE_CODES);
    const expectedLabels: Record<PoleCode, string> = {
      CONF: 'Confiance',
      MEMB: 'Membres',
      COMM: 'Commerce',
      CONT: 'Contenus',
      PRIA: 'Produit et IA',
      CROI: 'Croissance',
      TECH: 'Technique'
    };
    expect(Object.fromEntries(POLES.map((p) => [p.code, p.label]))).toEqual(expectedLabels);
  });

  it('compte les actions par pôle, total 144', () => {
    const computed: Record<string, number> = {};
    for (const c of COMMANDS) computed[c.pole] = (computed[c.pole] ?? 0) + 1;
    expect(COMMANDS_BY_POLE).toEqual(computed);
    expect(Object.values(COMMANDS_BY_POLE).reduce((a, b) => a + b, 0)).toBe(144);
    expect(Object.keys(COMMANDS_BY_POLE).sort()).toEqual([...POLE_CODES].sort());
  });

  it('retrouve chaque action par identifiant et par nom, et rien pour un inconnu', () => {
    for (const c of COMMANDS) {
      expect(commandById(c.id)?.command).toBe(c.command);
      expect(commandByCommand(c.command)?.id).toBe(c.id);
    }
    expect(commandById('ACT-000')).toBeUndefined();
    expect(commandById('ACT-145')).toBeUndefined();
    expect(commandById('act-001')).toBeUndefined();
    expect(commandByCommand('does_not_exist')).toBeUndefined();
    expect(commandByCommand('ACT-001')).toBeUndefined();
  });

  it('impose deux personnes et interdit l’annulation pour l’argent et l’irréversible (garde-fous § 1)', () => {
    const sensitive = [
      'member_ban',
      'member_delete_gdpr',
      'member_set_staff_role',
      'staff_manage',
      'order_refund',
      'product_price_set',
      'promo_code_manage'
    ];
    for (const name of sensitive) {
      const c = commandByCommand(name);
      expect(c, `${name} doit exister au catalogue`).toBeDefined();
      expect(c!.needsValidation, `${name} exige une validation à deux personnes`).toBe(true);
      expect(c!.undoable, `${name} n’est pas annulable en un clic`).toBe(false);
    }
  });

  it('n’accorde jamais une action super admin à un rôle de pôle inférieur', () => {
    const sa = COMMANDS.filter((c) => c.roleMin === 'super_admin');
    expect(sa.length).toBeGreaterThanOrEqual(3);
    for (const c of sa) expect(POLE_CODES).toContain(c.pole);
  });
});
