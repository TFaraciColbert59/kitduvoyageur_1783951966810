import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 100, 2.12 : tests d'autorisation réels de `requireEditor`, sans simulation.
 *
 * Ce qui est RÉEL : `requireEditor` (jamais remplacé ni espionné) et, plus bas,
 * l'action `compasSetBudgetAction` qui l'appelle. Seule la base est remplacée,
 * par le client Supabase en mémoire (`helpers/memorySupabase.ts`).
 *
 * Ce que le client en mémoire NE rejoue PAS : la RLS. Elle est portée à la main
 * depuis la migration (`helpers/tripRls.ts` : `can_read_trip`, `can_edit_trip`,
 * `trips_select_policy`) et alimentée par les vraies tables en mémoire
 * (`trips`, `trip_collaborators`) : le rôle, la visibilité et le propriétaire
 * décident, rien n'est écrit en dur par voyage et par personne. Le dernier bloc
 * garde ce portage fidèle au SQL du dépôt. La base elle-même (rôles PostgreSQL,
 * transactions, autres politiques) reste éprouvée par les tests pgTAP (plan 2.4),
 * pas ici.
 *
 * Personnes : propriétaire, co-propriétaire (rôle « owner » transmis), éditeur,
 * lecteur, étranger au voyage, anonyme (aucune session) et session d'essai sans
 * compte (`is_anonymous`, qui est une session comme une autre pour la base).
 */
const h = vi.hoisted(() => ({
  session: null as { id: string; is_anonymous?: boolean } | null,
  rpcDown: false,
  queries: 0,
  db: null as unknown as MemorySupabase,
  rls: null as unknown as TripRls,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/observability/appErrors', () => ({
  reportServerError: vi.fn(async () => undefined),
}));

import { compasSetBudgetAction } from '../server/compasActions';
import { requireEditor } from '../server/compasServer';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';
import { tripRls, type TripRls } from './helpers/tripRls';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const COOWNER = 'aaaaaaaa-0000-4000-8000-000000000002';
const EDITOR = 'aaaaaaaa-0000-4000-8000-000000000003';
const VIEWER = 'aaaaaaaa-0000-4000-8000-000000000004';
const STRANGER = 'aaaaaaaa-0000-4000-8000-000000000005';
const TRIAL = 'aaaaaaaa-0000-4000-8000-000000000006';

const T_PRIVATE = '11111111-1111-4111-8111-111111111111';
const T_PUBLIC = '22222222-2222-4222-8222-222222222222';
const T_UNLISTED = '33333333-3333-4333-8333-333333333333';
const T_OTHER = '44444444-4444-4444-8444-444444444444';
const T_TRIAL = '55555555-5555-4555-8555-555555555555';
const T_MISSING = '66666666-6666-4666-8666-666666666666';

const NOT_SIGNED_IN = 'Connecte-toi pour modifier le voyage.';
const NOT_FOUND = 'Voyage introuvable ou non autorisé.';
const NOT_EDITOR = 'Seuls les organisateurs et éditeurs peuvent modifier le kit.';

function trip(id: string, owner: string, visibility: 'private' | 'public' | 'unlisted') {
  return {
    id,
    user_id: owner,
    title: 'Trek',
    start_date: null,
    end_date: null,
    destination_name: null,
    destination_country_code: null,
    party_size: 1,
    budget_currency: 'EUR',
    estimated_budget: null,
    visibility,
    metadata: {},
    updated_at: '2026-10-09T08:00:00.000000+00:00',
  };
}

const collab = (tripId: string, userId: string, role: 'owner' | 'editor' | 'viewer') => ({
  trip_id: tripId,
  user_id: userId,
  role,
});

beforeEach(() => {
  h.session = null;
  h.rpcDown = false;
  h.queries = 0;
  h.rls = tripRls(
    (table) => h.db.rows(table),
    () => h.session?.id ?? null
  );
  h.db = memorySupabase({
    user: () => h.session,
    onQuery: () => {
      h.queries += 1;
    },
    // Le rôle PostgreSQL et la RLS ne sont pas rejoués : voir `helpers/tripRls.ts`.
    rpc: (fn, args) =>
      h.rpcDown && fn === 'can_edit_trip'
        ? { data: null, error: { code: '57P03', message: 'base en panne' } }
        : h.rls.rpc(fn, args),
    canSelect: (table, row) => h.rls.canSelect(table, row),
  });
  // Comme le trigger `trg_trips_insert_owner`, le propriétaire est aussi collaborateur « owner ».
  h.db
    .rows('trips')
    .push(
      trip(T_PRIVATE, OWNER, 'private'),
      trip(T_PUBLIC, OWNER, 'public'),
      trip(T_UNLISTED, OWNER, 'unlisted'),
      trip(T_OTHER, STRANGER, 'private'),
      trip(T_TRIAL, TRIAL, 'private')
    );
  h.db.rows('trip_collaborators').push(
    collab(T_PRIVATE, OWNER, 'owner'),
    collab(T_PRIVATE, COOWNER, 'owner'),
    collab(T_PRIVATE, EDITOR, 'editor'),
    collab(T_PRIVATE, VIEWER, 'viewer'),
    collab(T_PUBLIC, OWNER, 'owner'),
    collab(T_UNLISTED, OWNER, 'owner'),
    collab(T_OTHER, STRANGER, 'owner'),
    // Le rôle est propre à chaque voyage : éditeur ici, simple lecteur là.
    collab(T_OTHER, EDITOR, 'viewer'),
    collab(T_TRIAL, TRIAL, 'owner')
  );
});

const asUser = (id: string | null, anonymous = false) => {
  h.session = id ? { id, ...(anonymous ? { is_anonymous: true } : {}) } : null;
};

describe('requireEditor : seuls le propriétaire et l’éditeur passent', () => {
  it.each([
    ['le propriétaire', OWNER, T_PRIVATE],
    ['le propriétaire d’un voyage public', OWNER, T_PUBLIC],
    ['le propriétaire d’un voyage non répertorié', OWNER, T_UNLISTED],
    ['un co-propriétaire (rôle « owner » du voyage, sans en être l’auteur)', COOWNER, T_PRIVATE],
    ['l’éditeur', EDITOR, T_PRIVATE],
  ])('%s : accès accordé', async (_who, userId, tripId) => {
    asUser(userId);
    const res = await requireEditor(tripId);
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.userId).toBe(userId);
    expect(res.trip.id).toBe(tripId);
    expect(res.anonymous).toBe(false);
  });

  it('une session d’essai sans compte propriétaire de son voyage passe, signalée « anonymous »', async () => {
    asUser(TRIAL, true);
    const res = await requireEditor(T_TRIAL);
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.userId).toBe(TRIAL);
    expect(res.anonymous).toBe(true);
  });

  it.each([
    ['le lecteur', VIEWER, T_PRIVATE, NOT_EDITOR],
    ['l’éditeur d’un autre voyage, lecteur de celui-ci', EDITOR, T_OTHER, NOT_EDITOR],
    ['un étranger au voyage privé : il ne le voit même pas', STRANGER, T_PRIVATE, NOT_FOUND],
    [
      'un étranger devant un voyage public (lisible, pas modifiable)',
      STRANGER,
      T_PUBLIC,
      NOT_EDITOR,
    ],
    [
      'un étranger devant un voyage non répertorié (lisible, pas modifiable)',
      STRANGER,
      T_UNLISTED,
      NOT_EDITOR,
    ],
    ['le lecteur devant un voyage public', VIEWER, T_PUBLIC, NOT_EDITOR],
    [
      'l’éditeur d’un voyage, devant le voyage privé d’une autre personne',
      EDITOR,
      T_TRIAL,
      NOT_FOUND,
    ],
    ['une session d’essai étrangère au voyage', TRIAL, T_PRIVATE, NOT_FOUND],
    ['un voyage qui n’existe pas', OWNER, T_MISSING, NOT_FOUND],
  ])('%s : accès refusé', async (_who, userId, tripId, message) => {
    asUser(userId, userId === TRIAL);
    const res = await requireEditor(tripId);
    // Rien d’autre que l’erreur : ni client, ni ligne du voyage rendus.
    expect(res).toEqual({ error: message });
  });

  it('aucune session : refus avant toute lecture, même sur un voyage public', async () => {
    asUser(null);
    for (const tripId of [T_PRIVATE, T_PUBLIC, T_UNLISTED, T_MISSING]) {
      expect(await requireEditor(tripId)).toEqual({ error: NOT_SIGNED_IN });
    }
    expect(h.queries).toBe(0);
    expect(h.rls.rpcCalls).toEqual([]);
  });

  it('le droit est relu à chaque appel : retiré, il ne passe plus', async () => {
    asUser(EDITOR);
    expect('error' in (await requireEditor(T_PRIVATE))).toBe(false);

    // Rétrogradé en lecteur.
    h.db
      .rows('trip_collaborators')
      .find((c) => c.trip_id === T_PRIVATE && c.user_id === EDITOR)!.role = 'viewer';
    expect(await requireEditor(T_PRIVATE)).toEqual({ error: NOT_EDITOR });

    // Rétabli, puis retiré du voyage.
    h.db
      .rows('trip_collaborators')
      .find((c) => c.trip_id === T_PRIVATE && c.user_id === EDITOR)!.role = 'editor';
    expect('error' in (await requireEditor(T_PRIVATE))).toBe(false);
    const rows = h.db.rows('trip_collaborators');
    rows.splice(
      rows.findIndex((c) => c.trip_id === T_PRIVATE && c.user_id === EDITOR),
      1
    );
    expect(await requireEditor(T_PRIVATE)).toEqual({ error: NOT_FOUND });
  });

  it('la base en panne : l’éditeur est refusé (fermé), le propriétaire reste servi', async () => {
    h.rpcDown = true;
    asUser(EDITOR);
    expect(await requireEditor(T_PRIVATE)).toEqual({ error: NOT_EDITOR });
    asUser(OWNER);
    const res = await requireEditor(T_PRIVATE);
    expect('error' in res).toBe(false);
  });

  it('le voyage demandé décide, pas un identifiant glissé ailleurs : le droit sur un voyage ne vaut pas pour un autre', async () => {
    asUser(OWNER);
    expect('error' in (await requireEditor(T_PRIVATE))).toBe(false);
    expect(await requireEditor(T_OTHER)).toEqual({ error: NOT_FOUND });
    expect(await requireEditor(T_TRIAL)).toEqual({ error: NOT_FOUND });
  });
});

describe('une vraie action derrière requireEditor : le refus arrête l’écriture (compasSetBudgetAction)', () => {
  const budget = (tripId: string) =>
    compasSetBudgetAction({ tripId, tripSlug: 'trek', amount: 1500 });
  const stored = (tripId: string) =>
    h.db.rows('trips').find((t) => t.id === tripId)?.estimated_budget;

  it.each([
    ['le propriétaire', OWNER],
    ['le co-propriétaire', COOWNER],
    ['l’éditeur', EDITOR],
  ])('%s fixe l’enveloppe', async (_who, userId) => {
    asUser(userId);
    expect(await budget(T_PRIVATE)).toEqual({ success: true });
    expect(stored(T_PRIVATE)).toBe(1500);
    expect(h.db.writes).toHaveLength(1);
    expect(h.db.writes[0]).toMatchObject({ table: 'trips', op: 'update', ids: [T_PRIVATE] });
  });

  it.each([
    ['le lecteur', VIEWER, T_PRIVATE, NOT_EDITOR],
    ['un étranger au voyage privé', STRANGER, T_PRIVATE, NOT_FOUND],
    ['un étranger devant un voyage public', STRANGER, T_PUBLIC, NOT_EDITOR],
    ['une session d’essai étrangère', TRIAL, T_PRIVATE, NOT_FOUND],
    ['aucune session', null, T_PRIVATE, NOT_SIGNED_IN],
    ['aucune session, voyage public', null, T_PUBLIC, NOT_SIGNED_IN],
  ])('%s : refusé, rien n’est écrit', async (_who, userId, tripId, message) => {
    asUser(userId, userId === TRIAL);
    expect(await budget(tripId)).toEqual({ success: false, error: message });
    expect(h.db.writes).toEqual([]);
    expect(stored(tripId)).toBeNull();
  });
});

describe('fidélité du portage de la RLS (le client en mémoire ne la rejoue pas)', () => {
  const ROOT = join(__dirname, '..', '..', '..', '..');
  const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
  const norm = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
  const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
  const migrations = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'));

  /** Corps (entre `$$` et `$$`) de la fonction `name` définie dans `sql`. */
  function functionBody(sql: string, name: string): string {
    const start = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION "?public"?\\."?${name}"?\\(`));
    expect(start, `définition de ${name} introuvable`).toBeGreaterThanOrEqual(0);
    const open = sql.indexOf('$$', start) + 2;
    return norm(sql.slice(open, sql.indexOf('$$', open)));
  }

  const CORE = '20260904050000_trips_core.sql';
  const core = () => read(`supabase/migrations/${CORE}`);
  const baseline = () => read('supabase/baseline/prod_schema_20260911.sql');

  it.each(['can_edit_trip', 'can_read_trip'])(
    '%s n’est défini qu’une seule fois dans les migrations',
    (name) => {
      const definers = migrations.filter((f) =>
        new RegExp(
          `CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+(public\\.)?${name}\\s*\\(`,
          'i'
        ).test(read(`supabase/migrations/${f}`))
      );
      expect(definers).toEqual([CORE]);
    }
  );

  it('can_edit_trip : propriétaire, ou rôle « owner » / « editor » du voyage — jamais « viewer »', () => {
    for (const body of [
      functionBody(core(), 'can_edit_trip'),
      functionBody(baseline(), 'can_edit_trip'),
    ]) {
      expect(body).toContain(
        'IF p_trip_id IS NULL OR v_user_id IS NULL THEN RETURN false; END IF;'
      );
      expect(body).toContain(
        'SELECT user_id INTO v_owner_id FROM public.trips WHERE id = p_trip_id; IF NOT FOUND THEN RETURN false;'
      );
      expect(body).toContain('IF v_owner_id = v_user_id THEN RETURN true; END IF;');
      expect(body).toContain(
        "SELECT role INTO v_role FROM public.trip_collaborators WHERE trip_id = p_trip_id AND user_id = v_user_id; IF FOUND AND v_role IN ('owner', 'editor') THEN RETURN true; END IF; RETURN false;"
      );
      expect(body).not.toContain('viewer');
    }
  });

  it('can_read_trip : public ou non répertorié, sinon propriétaire ou collaborateur (tout rôle)', () => {
    for (const body of [
      functionBody(core(), 'can_read_trip'),
      functionBody(baseline(), 'can_read_trip'),
    ]) {
      expect(body).toContain('IF p_trip_id IS NULL THEN RETURN false; END IF;');
      expect(body).toContain("IF v_visibility IN ('public', 'unlisted') THEN RETURN true; END IF;");
      expect(body).toContain('IF v_user_id IS NULL THEN RETURN false; END IF;');
      expect(body).toContain('IF v_owner_id = v_user_id THEN RETURN true; END IF;');
      expect(body).toContain(
        'SELECT EXISTS ( SELECT 1 FROM public.trip_collaborators WHERE trip_id = p_trip_id AND user_id = v_user_id ) INTO v_is_collab; RETURN v_is_collab;'
      );
    }
  });

  it('trips_select_policy : public / non répertorié, propriétaire, ou can_read_trip(id)', () => {
    const sql = norm(core());
    expect(sql).toContain(
      "CREATE POLICY \"trips_select_policy\" ON public.trips FOR SELECT USING ( visibility IN ('public', 'unlisted') OR (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR public.can_read_trip(id) );"
    );
    // Seule autre migration qui la touche : la mise en cache de auth.uid(), qui « préserve
    // chaque autre partie de l’expression » et échoue si la politique a changé.
    const touching = migrations.filter((f) =>
      /trips_select_policy/.test(read(`supabase/migrations/${f}`))
    );
    expect(touching, 'une migration touche trips_select_policy : relis helpers/tripRls.ts').toEqual(
      [CORE, '20260925020000_core_rls_auth_initplan.sql']
    );
  });

  it('les appels sans session n’exécutent plus ces fonctions (REVOKE … FROM anon) et rien ne le rétablit', () => {
    const revoke = norm(read('supabase/migrations/20260917010000_phase1_security_fixes.sql'));
    expect(revoke).toContain('REVOKE EXECUTE ON FUNCTION public.can_edit_trip(uuid) FROM anon;');
    expect(revoke).toContain('REVOKE EXECUTE ON FUNCTION public.can_read_trip(uuid) FROM anon;');
    // Exception unique et documentée (13 oct. 2026) : les policies de LECTURE
    // PUBLIQUE (voyages partagés, groupes publics) sont évaluées PAR LE RÔLE
    // appelant — PostgreSQL exige alors EXECUTE pour ce rôle. Le hotfix a été
    // constaté nécessaire en production (permission denied pour un visiteur).
    const REGRANT_DOCUMENTED = '20261014080000_anon_rls_predicates_regrant.sql';
    const after = migrations.filter((f) => f.slice(0, 14) > '20260917010000');
    for (const f of after) {
      if (f === REGRANT_DOCUMENTED) {
        const regrant = norm(read(`supabase/migrations/${f}`));
        expect(regrant).toMatch(/grant execute on function public\.can_read_trip\(uuid\) to anon;/);
        expect(regrant).toMatch(/grant execute on function public\.can_edit_trip\(uuid\) to anon;/);
        continue;
      }
      expect(read(`supabase/migrations/${f}`), f).not.toMatch(
        /GRANT\s+[^;]*(can_edit_trip|can_read_trip)[^;]*TO\s+(anon|public)\b/i
      );
    }
  });
});
