import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Revue des fonctions `SECURITY DEFINER` (plan 2.4), version statique et rejouable sans
 * base : lit les migrations dans l'ordre et vérifie, pour la définition FINALE de chaque
 * fonction :
 *   1. `search_path` verrouillé (sinon un schéma écrit par un utilisateur peut masquer
 *      une table ou un opérateur et faire exécuter son code avec les droits du propriétaire) ;
 *   2. pour les migrations postérieures au 20 octobre 2026 : un `revoke ... on function`
 *      explicite (PUBLIC garde `EXECUTE` par défaut en PostgreSQL ; `anon` est déjà retiré
 *      des privilèges par défaut depuis 20261014090000).
 * L'état réel de la base reste contrôlé par `supabase/tests/database/compas_security_definer_review.test.sql`
 * et par le conseiller Supabase (`get_advisors`).
 */

const MIGRATIONS = path.join(process.cwd(), 'supabase/migrations');
/** Première version soumise à la règle 2 (les anciennes ont été revues à la main, 2.4). */
const STRICT_FROM = '20261020000000';

/** Exceptions connues de la règle 1, avec la raison. Ne s'allonge pas : on corrige à la place. */
const SEARCH_PATH_EXCEPTIONS: Record<string, string> = {
  // Créée sans search_path le 15 juillet, verrouillée par un bloc DO dynamique
  // (20260903030000_stripe_fix.sql, § 3) que l'analyse statique ne voit pas.
  decrement_stock_on_order: '20260903030000_stripe_fix.sql',
};

interface FnState {
  definer: boolean;
  searchPath: boolean;
  file: string;
  line: number;
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, (m) => ' '.repeat(m.length));
}

const norm = (raw: string) =>
  raw.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();

/** Dernier état de chaque fonction après rejeu des fichiers (triés) donnés. */
export function analyse(files: Array<{ name: string; sql: string }>) {
  const fns = new Map<string, FnState>();
  const revokes: Array<{ name: string; file: string }> = [];
  for (const { name: file, sql: raw } of files) {
    const sql = stripComments(raw);
    const create = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = create.exec(sql))) {
      const fname = norm(m[1]);
      const rest = sql.slice(m.index);
      const open = rest.search(/\$[\w]*\$/);
      let header = rest.slice(0, 600);
      let tail = '';
      if (open >= 0) {
        const tag = /^\$[\w]*\$/.exec(rest.slice(open))![0];
        const close = rest.indexOf(tag, open + tag.length);
        header = rest.slice(0, open);
        tail = close > 0 ? rest.slice(close + tag.length, close + tag.length + 300).split(';')[0] : '';
      }
      const h = `${header} ${tail}`.toLowerCase();
      fns.set(fname, {
        definer: /security\s+definer/.test(h),
        searchPath: /set\s+search_path/.test(h),
        file,
        line: sql.slice(0, m.index).split('\n').length,
      });
    }
    const alter = /alter\s+function\s+([\w."]+)\s*\([^)]*\)\s+set\s+search_path/gi;
    while ((m = alter.exec(sql))) {
      const s = fns.get(norm(m[1]));
      if (s) s.searchPath = true;
    }
    const revoke = /revoke\s+(?:all|execute)[\s\S]{0,80}?\bon\s+function\s+([\w."]+)\s*\(/gi;
    while ((m = revoke.exec(sql))) revokes.push({ name: norm(m[1]), file });
  }
  return { fns, revokes };
}

export function violations(files: Array<{ name: string; sql: string }>) {
  const { fns, revokes } = analyse(files);
  const noSearchPath: string[] = [];
  const noRevoke: string[] = [];
  for (const [name, s] of fns) {
    if (!s.definer) continue;
    if (!s.searchPath && !(name in SEARCH_PATH_EXCEPTIONS)) {
      noSearchPath.push(`${name} (${s.file}:${s.line})`);
    }
    if (s.file >= STRICT_FROM && !revokes.some((r) => r.name === name && r.file >= s.file)) {
      noRevoke.push(`${name} (${s.file}:${s.line})`);
    }
  }
  return { noSearchPath, noRevoke, definerCount: [...fns.values()].filter((s) => s.definer).length };
}

function loadMigrations() {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS, name), 'utf8') }));
}

describe('revue statique des fonctions SECURITY DEFINER (plan 2.4)', () => {
  it('toutes les fonctions SECURITY DEFINER des migrations verrouillent leur search_path', () => {
    const r = violations(loadMigrations());
    expect(r.definerCount).toBeGreaterThan(100); // garde : l'analyse lit bien les migrations
    expect(r.noSearchPath).toEqual([]);
  });

  it('les fonctions SECURITY DEFINER créées après le 20 octobre 2026 retirent EXECUTE à PUBLIC', () => {
    expect(violations(loadMigrations()).noRevoke).toEqual([]);
  });

  it('les exceptions déclarées existent encore (la liste ne pourrit pas)', () => {
    const { fns } = analyse(loadMigrations());
    for (const name of Object.keys(SEARCH_PATH_EXCEPTIONS)) expect(fns.has(name)).toBe(true);
  });

  describe('l’analyse détecte bien les écarts (mutations)', () => {
    const ok = `create or replace function public.f1() returns int language sql security definer set search_path = '' as $$ select 1 $$;`;
    const noSp = `create or replace function public.f2() returns int language sql security definer as $$ select 1 $$;`;
    const spAfterBody = `create function public.f3() returns int as $$ select 1 $$ language sql security definer set search_path = pg_catalog;`;
    const invoker = `create function public.f4() returns int language sql as $$ select 1 $$;`;

    it('refuse une fonction DEFINER sans search_path', () => {
      const r = violations([{ name: '20261001000000_a.sql', sql: noSp }]);
      expect(r.noSearchPath).toHaveLength(1);
    });

    it('accepte search_path posé avant ou après le corps, et les fonctions INVOKER', () => {
      const r = violations([{ name: '20261001000000_a.sql', sql: [ok, spAfterBody, invoker].join('\n') }]);
      expect(r.noSearchPath).toEqual([]);
      expect(r.definerCount).toBe(2);
    });

    it('un ALTER FUNCTION ... SET search_path ultérieur corrige la définition', () => {
      const r = violations([
        { name: '20261001000000_a.sql', sql: noSp },
        { name: '20261002000000_b.sql', sql: 'alter function public.f2() set search_path = \'\';' },
      ]);
      expect(r.noSearchPath).toEqual([]);
    });

    it('une redéfinition sans search_path annule le verrou précédent', () => {
      const r = violations([
        { name: '20261001000000_a.sql', sql: ok },
        { name: '20261002000000_b.sql', sql: ok.replace("set search_path = ''", '') },
      ]);
      expect(r.noSearchPath).toHaveLength(1);
    });

    it('après le 20 octobre : un REVOKE est exigé, pris en compte seulement après la création', () => {
      const file = '20261021000000_c.sql';
      expect(violations([{ name: file, sql: ok }]).noRevoke).toHaveLength(1);
      const revoked = `${ok}\nrevoke all on function public.f1() from public, anon, authenticated;`;
      expect(violations([{ name: file, sql: revoked }]).noRevoke).toEqual([]);
      // Un REVOKE antérieur à la (re)création ne couvre pas la nouvelle définition.
      const before = [
        { name: '20261021000000_c.sql', sql: 'revoke all on function public.f1() from public;' },
        { name: '20261022000000_d.sql', sql: ok },
      ];
      expect(violations(before).noRevoke).toHaveLength(1);
    });
  });
});
