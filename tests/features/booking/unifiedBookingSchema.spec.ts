import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCHEMA_MIGRATION = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260926020000_unified_booking_schema.sql',
);
const SEED_MIGRATION = path.join(
  ROOT,
  'supabase',
  'migrations',
  '20260926030000_seed_activity_catalog.sql',
);
const SCHEMA_DOWN = path.join(
  ROOT,
  'supabase',
  'migrations_down',
  '20260926020000_unified_booking_schema.down.sql',
);
const SEED_DOWN = path.join(
  ROOT,
  'supabase',
  'migrations_down',
  '20260926030000_seed_activity_catalog.down.sql',
);

const read = (file: string) => fs.readFileSync(file, 'utf8');

/**
 * Extrait uniquement les slugs du premier VALUES de catalog_seed.
 * Compter toutes les chaînes du fichier compterait aussi les tags, liberals
 * et libellés de métriques : on veut garantir l'exactitude du jeu inséré.
 */
const extractSeedSlugs = (sql: string): string[] => {
  const valuesBlock = sql.match(
    /WITH\s+catalog_seed\s*\([\s\S]*?\)\s+AS\s*\(\s*VALUES([\s\S]*?)\n\)\s*\nINSERT\s+INTO\s+public\.activity_catalog\b/i,
  )?.[1];

  if (!valuesBlock) {
    throw new Error('Catalogue seed : premier CTE VALUES introuvable');
  }

  return [
    ...valuesBlock.matchAll(/\(\s*'([a-z0-9]+(?:-[a-z0-9]+)+)'\s*,/gi),
  ].map((match) => match[1].toLowerCase());
};

/** Extrait chaque liste slug IN (...) du rollback du seed. */
const extractSeedDownLists = (sql: string): string[][] =>
  [...sql.matchAll(/\bIN\s*\(([\s\S]*?)\)/gi)].map((match) =>
    [...match[1].matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/gi)].map(
      (slug) => slug[1].toLowerCase(),
    ),
  );

/**
 * Le moteur unifié est volontairement additif :
 * - public.activities reste la table des sessions/historique ;
 * - public.trips reste le voyage ;
 * - le catalogue, le panier, les réservations et les promotions sont séparés.
 */
describe('schéma du préparateur unifié', () => {
  it('SCHEMA-1: crée les cinq tables additives sans modifier activities/trips', () => {
    const sql = read(SCHEMA_MIGRATION);

    for (const table of [
      'activity_catalog',
      'activity_catalog_metrics',
      'bookings',
      'cart_lines',
      'model_promotions',
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, 'i'),
      );
    }

    expect(sql).not.toMatch(/ALTER TABLE public\.activities\b/i);
    expect(sql).not.toMatch(/ALTER TABLE public\.trips\b/i);
    expect(sql).not.toMatch(/DROP TABLE\s+(IF EXISTS\s+)?public\.(activities|trips)/i);
  });

  it('SCHEMA-2: active RLS et des politiques explicites par rôle', () => {
    const sql = read(SCHEMA_MIGRATION);

    for (const table of [
      'activity_catalog',
      'activity_catalog_metrics',
      'bookings',
      'cart_lines',
      'model_promotions',
    ]) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i'),
      );
    }

    expect(sql).toMatch(/CREATE POLICY activity_catalog_public_read/i);
    expect(sql).toMatch(/CREATE POLICY activity_catalog_admin_write/i);
    expect(sql).toMatch(/CREATE POLICY activity_catalog_metrics_public_read/i);
    expect(sql).toMatch(/CREATE POLICY bookings_owner_read/i);
    expect(sql).toMatch(/CREATE POLICY bookings_trip_editor_write/i);
    expect(sql).toMatch(/CREATE POLICY cart_lines_owner_read/i);
    expect(sql).toMatch(/CREATE POLICY cart_lines_trip_editor_write/i);
    expect(sql).toMatch(/CREATE POLICY model_promotions_authenticated_read/i);

    expect(sql).toMatch(
      /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.activity_catalog,\s*public\.activity_catalog_metrics\s+TO\s+anon,\s*authenticated;/i,
    );
    expect(sql).toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+public\.bookings,\s*public\.cart_lines\s+TO\s+authenticated,\s*service_role;/i,
    );
    expect(sql).not.toMatch(/GRANT[\s\S]*model_promotions[\s\S]* TO anon/i);
  });

  it('SCHEMA-3: fournit les index métier et les contraintes d’unicité', () => {
    const sql = read(SCHEMA_MIGRATION);

    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS activity_catalog_slug_uniq/i,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS activity_catalog_metrics_activity_key_uniq/i,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS cart_lines_owner_trip_kind_ref_uniq/i,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS bookings_provider_external_ref_uniq/i,
    );
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS bookings_trip_id_idx/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS bookings_user_id_idx/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS cart_lines_trip_id_idx/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS cart_lines_user_id_idx/i);
  });

  it('SCHEMA-4: expose activities_by_scope, valide le panier et rend le replay sûr', () => {
    const sql = read(SCHEMA_MIGRATION);

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.activities_by_scope\s*\(\s*p_scope\s+public\.activity_logistics_scope\s*\)/i,
    );
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.activities_by_scope/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS .* ON public\.activity_catalog;/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_activity_catalog_updated_at/i);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.validate_cart_line_reference\(\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/i,
    );
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.validate_cart_line_reference\(\)/i);
    expect(sql).toMatch(/CREATE TRIGGER cart_lines_validate_reference/i);
  });

  it('SEED-1: livre un catalogue multi-familles couvrant les quatre scopes', () => {
    const sql = read(SEED_MIGRATION);
    const seedSlugs = extractSeedSlugs(sql);

    expect(seedSlugs).toHaveLength(43);
    expect(new Set(seedSlugs).size).toBe(43);
    for (const scope of ['none', 'access', 'stages', 'full']) {
      expect(sql).toMatch(
        new RegExp(`'${scope}'::public\\.activity_logistics_scope`, 'i'),
      );
    }
    for (const family of ['running', 'hiking', 'bivouac', 'roadtrip']) {
      expect(sql).toMatch(new RegExp(`'${family}'`, 'i'));
    }
    expect(sql).toMatch(/ON CONFLICT \(slug\) DO UPDATE/i);
  });

  it('SEED-2: associe des métriques réelles à chaque activité du catalogue', () => {
    const sql = read(SEED_MIGRATION);
    const metricKeys = new Set(
      [...sql.matchAll(/'([a-z][a-z0-9_]*)'::text/gi)].map((match) => match[1]),
    );

    expect(metricKeys.size).toBeGreaterThanOrEqual(7);
    for (const key of [
      'duration_minutes',
      'distance_km',
      'elevation_gain_m',
      'technicality',
      'stage_count',
      'day_count',
      'budget_eur',
    ]) {
      expect(metricKeys).toContain(key);
    }
    expect(sql).toMatch(/ON CONFLICT \(activity_id, metric_key\) DO UPDATE/i);
  });

  it('SEED-3: garde les 43 slugs du seed et son rollback strictement symétriques', () => {
    const seedSlugs = extractSeedSlugs(read(SEED_MIGRATION));
    const rollbackLists = extractSeedDownLists(read(SEED_DOWN));
    const expectedSlugs = [...seedSlugs].sort();

    expect(rollbackLists).toHaveLength(2);
    for (const rollbackSlugs of rollbackLists) {
      expect(new Set(rollbackSlugs).size).toBe(43);
      expect([...rollbackSlugs].sort()).toEqual(expectedSlugs);
    }
  });

  it('DOWN: annule uniquement les objets du moteur unifié', () => {
    const schemaDown = read(SCHEMA_DOWN);
    const seedDown = read(SEED_DOWN);

    expect(seedDown).toMatch(/DELETE FROM public\.activity_catalog_metrics/i);
    expect(seedDown).toMatch(/DELETE FROM public\.activity_catalog/i);
    expect(schemaDown).toMatch(
      /DROP FUNCTION IF EXISTS public\.activities_by_scope/i,
    );
    expect(schemaDown).toMatch(/DROP TABLE IF EXISTS public\.model_promotions/i);
    expect(schemaDown).not.toMatch(
      /DROP TABLE IF EXISTS public\.(activities|trips)/i,
    );
  });
});
