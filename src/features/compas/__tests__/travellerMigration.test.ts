import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le profil voyageur est privé par la base elle-même : RLS de la personne seule,
 * aucun droit pour anon, aucun essai sans compte, domicile arrondi à 0,01° par le type.
 * La preuve en base est la sonde `scripts/verify/user_traveller_rls_probe.sql`.
 */
const SQL = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261010100000_user_traveller.sql'), 'utf8');
/** Le SQL sans ses commentaires : un mot dans un commentaire ne prouve rien. */
const code = SQL.replace(/--.*$/gm, '');
const policy = (name: string) => code.match(new RegExp(`CREATE POLICY "${name}"[\\s\\S]*?;`))?.[0] ?? '';

describe('migration user_traveller : privée, additive, rejouable', () => {
  it('une ligne par personne, effacée avec le compte', () => {
    expect(code).toContain('CREATE TABLE IF NOT EXISTS public.user_traveller (');
    expect(code).toMatch(/user_id\s+uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  });

  it('formats contrôlés par la base, domicile arrondi à 0,01° par son type', () => {
    expect(code).toMatch(/nationality\s+text CHECK \(nationality ~ '\^\[A-Z\]\{2\}\$'\)/);
    expect(code).toMatch(/residence_country\s+text CHECK \(residence_country ~ '\^\[A-Z\]\{2\}\$'\)/);
    expect(code).toMatch(/currency\s+text CHECK \(currency ~ '\^\[A-Z\]\{3\}\$'\)/);
    expect(code).toMatch(/home_lat\s+numeric\(4,2\) CHECK \(home_lat BETWEEN -90 AND 90\)/);
    expect(code).toMatch(/home_lon\s+numeric\(5,2\) CHECK \(home_lon BETWEEN -180 AND 180\)/);
    expect(code).toContain('CONSTRAINT user_traveller_home_complete CHECK');
  });

  it('RLS : la personne seule, pour les quatre gestes, chaque policy rejouable', () => {
    expect(code).toContain('ALTER TABLE public.user_traveller ENABLE ROW LEVEL SECURITY;');
    for (const op of ['select', 'insert', 'update', 'delete']) {
      const p = policy(`traveller_${op}_own`);
      expect(p, op).toContain(`FOR ${op.toUpperCase()}`);
      expect(p, op).toContain('TO authenticated');
      expect(p, op).toContain('user_id = (select auth.uid())');
      expect(code).toContain(`DROP POLICY IF EXISTS "traveller_${op}_own" ON public.user_traveller;`);
    }
  });

  it('essai sans compte (session anonyme) : aucune écriture', () => {
    expect(policy('traveller_essai_sans_ecriture')).toMatch(
      /AS RESTRICTIVE\s+FOR INSERT\s+TO authenticated\s+WITH CHECK \(NOT public\.is_anonymous_session\(\)\)/
    );
    expect(code).toContain('DROP POLICY IF EXISTS "traveller_essai_sans_ecriture" ON public.user_traveller;');
  });

  it('aucune policy ni aucun droit pour anon ou public', () => {
    expect(code).not.toMatch(/\bTO\s+(anon|public)\b/i);
    expect(code).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_traveller TO authenticated;');
    expect(code).toContain('REVOKE ALL ON public.user_traveller FROM anon;');
    expect(code.match(/CREATE POLICY/g)).toHaveLength(5);
  });

  it('additive : rien de détruit, rien d’ajouté au profil public', () => {
    expect(code).not.toMatch(/\b(DROP TABLE|TRUNCATE|DELETE FROM|DROP COLUMN)\b/i);
    expect(code).not.toMatch(/user_profiles|public_profiles/);
  });
});
