#!/usr/bin/env node
/**
 * gen-commands.mjs — génère l'amorçage de `admin.commands` (M03) depuis
 * crm/bundle/04_CATALOGUE_ACTIONS.md.
 *
 * Source unique : le tableau du bundle. Parsing identique à gen-catalog.mjs
 * (même expression régulière, mêmes pôles, mêmes dérogations) pour que
 * `crm/src/lib/catalog.ts` et la base ne puissent pas diverger.
 *
 * Sortie : supabase/migrations/20261109090300_crm_commands_registry.sql
 *   (fichier complet, idempotent : insert … on conflict (id) do update).
 *
 * Usage :
 *   node crm/scripts/gen-commands.mjs            # écrit la migration
 *   node crm/scripts/gen-commands.mjs --check    # n'écrit rien, code 1 si le
 *                                                # fichier sur disque diffère
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const crmRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(crmRoot, '..');
const MD_PATH = path.join(crmRoot, 'bundle/04_CATALOGUE_ACTIONS.md');
const OUT_PATH = path.join(repoRoot, 'supabase/migrations/20261109090300_crm_commands_registry.sql');

/** Pôles par domaine (04_CATALOGUE_ACTIONS.md § Pôles). */
const POLES = {
  D1: 'MEMB', D2: 'CONF', D3: 'CONF', D4: 'CONF', D5: 'CONF', D6: 'CONF', D7: 'CONT',
  D8: 'CONF', D9: 'COMM', D10: 'COMM', D11: 'COMM', D12: 'CROI', D13: 'COMM', D14: 'CONF',
  D15: 'CONT', D16: 'CROI', D17: 'PRIA', D18: 'MEMB', D19: 'TECH'
};
/** Dérogations explicites du catalogue (« D14 — … (TECH) »). */
const OVERRIDES = { 'ACT-112': 'TECH', 'ACT-113': 'TECH', 'ACT-134': 'CROI', 'ACT-136': 'TECH' };

const ROW_RE = /^\| (ACT-\d{3}) \| ([a-z0-9_]+) \| (.+?) \| (membre|resp\.|SA) \| (oui|—) \| (oui|—) \| (oui|—) \| (propose|lit|—) \| (P\d) \|$/;

export function parseCatalog(md) {
  const rows = [];
  let domain = null;
  for (const line of md.split('\n')) {
    const dm = line.match(/^## (D\d+) — (.+)$/);
    if (dm) { domain = dm[1]; continue; }
    const m = line.match(ROW_RE);
    if (!m || !domain) continue;
    const [, id, command, label, role, two, reason, undo, agent, rt] = m;
    const pole = OVERRIDES[id] ?? POLES[domain];
    if (!pole) throw new Error(`catalogue: pôle inconnu pour ${id} (domaine ${domain})`);
    rows.push({
      id,
      command,
      label: label.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(),
      domain,
      pole,
      roleMin: role === 'resp.' ? 'responsable' : role === 'SA' ? 'super_admin' : 'membre',
      needsValidation: two === 'oui',
      reasonRequired: reason === 'oui',
      undoable: undo === 'oui',
      agent: agent === 'propose' ? 'propose' : agent === 'lit' ? 'read' : 'never',
      realtime: rt
    });
  }
  return rows;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function buildSql(rows) {
  const values = rows.map((r, i) =>
    `  (${q(r.id)}, ${q(r.command)}, ${q(r.label)}, ${q(r.domain)}, ${q(r.pole)}, ${q(r.roleMin)}, ` +
    `${r.needsValidation}, ${r.reasonRequired}, ${r.undoable}, ${q(r.agent)}, ${q(r.realtime)}, ${(i + 1) * 10})`
  ).join(',\n');

  const byPole = rows.reduce((acc, r) => ((acc[r.pole] = (acc[r.pole] ?? 0) + 1), acc), {});
  const poleCheck = Object.entries(byPole)
    .map(([p, n]) => `    if (select count(*) from admin.commands where pole_code = ${q(p)}) <> ${n} then\n      raise exception 'M03 : ${p} attendu ${n} commandes';\n    end if;`)
    .join('\n');

  return `-- ═══════════════════════════════════════════════════════════════════════════
-- M03 — crm_commands_registry  (03_MODELE_DE_DONNEES.md § 2)
-- GÉNÉRÉ par crm/scripts/gen-commands.mjs depuis crm/bundle/04_CATALOGUE_ACTIONS.md.
-- NE PAS ÉDITER À LA MAIN : régénérer le script (source unique du registre).
--
-- Le registre pilote tout : la barre de commande, les formulaires, le serveur
-- MCP et les tests. Toute différence entre ce fichier et le catalogue est un
-- écart (07_VERIFICATION.md § 3, crm/scripts/catalog-diff.mjs).
--
-- ${rows.length} commandes, ${Object.keys(byPole).length} pôles.
-- Idempotent : insert … on conflict (id) do update.
-- ═══════════════════════════════════════════════════════════════════════════

insert into admin.commands (
  id, command, label, domain, pole_code, role_min,
  needs_validation, reason_required, undoable, agent_allowed, realtime, sort
) values
${values}
on conflict (id) do update set
  command          = excluded.command,
  label            = excluded.label,
  domain           = excluded.domain,
  pole_code        = excluded.pole_code,
  role_min         = excluded.role_min,
  needs_validation = excluded.needs_validation,
  reason_required  = excluded.reason_required,
  undoable         = excluded.undoable,
  agent_allowed    = excluded.agent_allowed,
  realtime         = excluded.realtime,
  sort             = excluded.sort,
  updated_at       = now();

-- Contrôle d'amorçage : le registre doit contenir exactement les 144 actions.
do $$
begin
  if (select count(*) from admin.commands) <> ${rows.length} then
    raise exception 'M03 : % commandes en base, ${rows.length} attendues',
      (select count(*) from admin.commands);
  end if;
${poleCheck}
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Catalogue exposé à l'interface (contrat : admin.commands_catalog())
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.commands_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  return jsonb_build_object(
    'commands', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'command', c.command,
               'label', c.label,
               'domain', c.domain,
               'pole', c.pole_code,
               'roleMin', c.role_min,
               'needsValidation', c.needs_validation,
               'reasonRequired', c.reason_required,
               'undoable', c.undoable,
               'agent', c.agent_allowed,
               'realtime', c.realtime,
               'enabled', c.enabled,
               'allowed', admin.can((select auth.uid()), c.command)
             ) order by c.sort, c.id)
        from admin.commands c
    ), '[]'::jsonb),
    'poles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', p.code,
               'label', p.label,
               'count', (select count(*) from admin.commands c where c.pole_code = p.code),
               'role', (select max(sm.role) from admin.staff_memberships sm
                         where sm.user_id = (select auth.uid()) and sm.revoked_at is null
                           and sm.pole_code = p.code)
             ) order by p.sort)
        from admin.poles p
    ), '[]'::jsonb),
    'count', (select count(*) from admin.commands),
    'reasons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', rc.code, 'label', rc.label, 'severity', rc.severity,
               'zeroTolerance', rc.zero_tolerance)
             order by rc.sort)
        from admin.reason_codes rc where rc.active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function admin.commands_catalog() from public, anon;
grant execute on function admin.commands_catalog() to authenticated, service_role;

comment on table admin.commands is
  'LKDV Control : registre des 144 commandes (source : 04_CATALOGUE_ACTIONS.md). Le registre pilote le moteur (M13), la barre de commande, le serveur MCP et les tests.';
comment on function admin.commands_catalog() is
  'LKDV Control : catalogue + pôles + motifs pour l''interface. Réservé à l''équipe (aucune MFA requise ici : le middleware la vérifie déjà).';
`;
}

const md = readFileSync(MD_PATH, 'utf8');
const rows = parseCatalog(md);

if (rows.length !== 144) {
  console.error(`gen-commands: ${rows.length} actions trouvées, 144 attendues (${MD_PATH})`);
  process.exit(1);
}
const ids = new Set(rows.map((r) => r.id));
const names = new Set(rows.map((r) => r.command));
if (ids.size !== 144 || names.size !== 144) {
  console.error('gen-commands: identifiants ou noms de commande en double');
  process.exit(1);
}

const sql = buildSql(rows);
const check = process.argv.includes('--check');

if (check) {
  const current = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : '';
  if (current !== sql) {
    console.error(`gen-commands: ${path.relative(repoRoot, OUT_PATH)} n'est pas à jour (relancer sans --check)`);
    process.exit(1);
  }
  console.log(`gen-commands --check : ${rows.length} commandes, fichier à jour`);
} else {
  writeFileSync(OUT_PATH, sql);
  const byPole = rows.reduce((acc, r) => ((acc[r.pole] = (acc[r.pole] ?? 0) + 1), acc), {});
  console.log(
    `gen-commands: ${rows.length} commandes → ${path.relative(repoRoot, OUT_PATH)} ` +
    `(${Object.entries(byPole).map(([k, v]) => `${k}:${v}`).join(' ')})`
  );
}
