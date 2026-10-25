import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Sécurité du moteur de réservation unifié (chantier 2 routes).
 *
 * Ces contrôles sont STATIQUES : ils analysent la migration plutôt que la base,
 * pour que la garantie soit vérifiable avant même l'application. La preuve en
 * base vivante est collée dans FINAL_REPORT.md (W8) ; ce fichier garantit que
 * la migration ne peut pas être régressée en silence.
 *
 * Modèle de menace : `anon` (clé publique NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * ne doit jamais pouvoir écrire une réservation, une ligne de panier ou une
 * promotion. Un `INSERT` anonyme sur `bookings` reviendrait à laisser n'importe
 * quel visiteur s'attribuer la réservation d'un voyage.
 */

const ROOT = process.cwd();
const MIGRATIONS = [
  'supabase/migrations/20260926020000_unified_booking_schema.sql',
  'supabase/migrations/20260926050000_model_promotions_lifecycle.sql',
] as const;

const sql = MIGRATIONS.map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');

/** Tables dont l'écriture ne doit jamais être ouverte au public. */
const PRIVATE_TABLES = ['bookings', 'cart_lines', 'model_promotions'] as const;

interface Policy {
  name: string;
  table: string;
  command: string;
  roles: string;
  body: string;
}

/** Découpe les `CREATE POLICY` en enregistrements exploitables. */
function parsePolicies(source: string): Policy[] {
  const policies: Policy[] = [];
  const pattern =
    /CREATE POLICY\s+(\w+)\s+ON\s+public\.(\w+)\s+FOR\s+(\w+)\s+TO\s+([\s\S]*?);/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    // La capture `TO ... ;` avale le corps USING/WITH CHECK qui suit la liste de
    // rôles. On la coupe au premier prédicat, sinon `USING (... public.can_edit_trip
    // ...)` ferait matcher `\bpublic\b` et contredirait les politiques saines.
    const roles = match[4].split(/\b(?:USING|WITH CHECK)\b/i)[0].replace(/\s+/g, ' ').trim();
    policies.push({
      name: match[1],
      table: match[2],
      command: match[3].toUpperCase(),
      roles,
      body: match[0],
    });
  }
  return policies;
}

const policies = parsePolicies(sql);

/** Bloc `GRANT ... ON TABLE public.<table> ... TO <roles>` (avec continuation). */
function grantsFor(table: string): string[] {
  const pattern = new RegExp(
    `GRANT[^;]*?ON\\s+TABLE\\s+(?:public\\.\\w+\\s*,\\s*)*public\\.${table}[\\s\\S]*?;`,
    'gi',
  );
  return sourceMatches(pattern);
}

function sourceMatches(pattern: RegExp): string[] {
  const out: string[] = [];
  const flat = sql.replace(/\s+/g, ' ');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(flat)) !== null) out.push(match[0]);
  return out;
}

const WRITE_COMMANDS = ['INSERT', 'UPDATE', 'DELETE', 'ALL'];

describe('RLS — le moteur de réservation est fermé au rôle anon', () => {
  it('la migration déclare bien des politiques (un parseur vide ne prouverait rien)', () => {
    expect(policies.length).toBeGreaterThanOrEqual(8);
  });

  it.each(PRIVATE_TABLES)('RLS est activé sur %s', (table) => {
    expect(sql).toMatch(
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i'),
    );
  });

  it.each(PRIVATE_TABLES)('aucune politique sur %s ne s’adresse à anon', (table) => {
    const offenders = policies
      .filter((policy) => policy.table === table)
      .filter((policy) => /\banon\b|\bpublic\b/i.test(policy.roles))
      .map((policy) => `${policy.name} TO ${policy.roles}`);
    expect(offenders).toEqual([]);
  });

  it.each(PRIVATE_TABLES)('aucune écriture n’est accordée à anon sur %s', (table) => {
    const grants = grantsFor(table);
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      const [privileges, roles] = grant.split(/\s+TO\s+/i);
      expect(privileges, `${table} : ${grant}`).not.toMatch(/\banon\b/i);
      expect(roles, `${table} : ${grant}`).not.toMatch(/\banon\b/i);
    }
  });

  it.each(['bookings', 'cart_lines'] as const)(
    'toute écriture sur %s exige auth.uid() dans son WITH CHECK',
    (table) => {
      const writers = policies.filter(
        (policy) => policy.table === table && WRITE_COMMANDS.includes(policy.command),
      );
      expect(writers.length).toBeGreaterThan(0);
      for (const policy of writers) {
        expect(policy.body, policy.name).toMatch(/WITH CHECK/i);
        expect(policy.body, policy.name).toMatch(/auth\.uid\(\)/i);
        expect(policy.body, policy.name).toMatch(/can_edit_trip/i);
      }
    },
  );

  it('model_promotions n’a aucune politique d’écriture, pour aucun rôle', () => {
    const writers = policies.filter(
      (policy) => policy.table === 'model_promotions' && WRITE_COMMANDS.includes(policy.command),
    );
    expect(writers).toEqual([]);
  });

  it('les écritures sur model_promotions passent par service_role', () => {
    const grants = grantsFor('model_promotions').join(' ');
    expect(grants).toMatch(/service_role/i);
    // Le rôle authentifié ne lit que : la promotion est un enjeu de confiance.
    expect(grants).not.toMatch(/INSERT[^;]*TO[^;]*authenticated/i);
  });
});

describe('Adaptateurs serveur — un import client doit échouer', () => {
  const ADAPTERS = [
    'src/features/booking/server/providerCredentials.ts',
    'src/features/booking/server/bookingProvider.ts',
    'src/features/booking/server/routeStackBookingProvider.ts',
    'src/features/booking/server/viatorBookingProvider.ts',
    'src/features/booking/server/viatorAttribution.ts',
    'src/features/booking/server/checkoutService.ts',
    'src/features/promotions/server/promotionService.ts',
    'src/features/hub/server/getTripBookingOverview.ts',
  ] as const;

  it.each(ADAPTERS)('%s est verrouillé côté serveur', (file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const firstImport = source.match(/^import\s+'server-only';/m);
    expect(firstImport, `${file} doit porter server-only`).not.toBeNull();
    // Doit être la PREMIÈRE instruction : un adaptateur qui importe d'abord un
    // module client est déjà contaminé avant d'atteindre son garde-fou.
    const firstStatement = source.trimStart();
    expect(firstStatement.startsWith("import 'server-only';")).toBe(true);
  });

  it('aucun adaptateur de réservation n’est importé depuis un composant client', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const source = fs.readFileSync(full, 'utf8');
        if (!source.includes("'server-only'")) continue;
        if (!/booking\/server\/(routeStackBookingProvider|viatorBookingProvider|providerCredentials|viatorAttribution|checkoutService)/.test(source)) {
          continue;
        }
        if (/^['"]use client['"]/m.test(source)) offenders.push(full);
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });
});
