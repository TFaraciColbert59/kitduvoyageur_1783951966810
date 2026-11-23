import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyWorkspaceOperation,
  computeRouteImpact,
  publishWorkspaceRevision,
  stableHash,
  type ApplyOperationCommand,
} from '../engine';
import { hasRoutePermission } from '../permissions';
import { prunePresence } from '../serverStore';
import { DEFAULT_PRIVATE_START_RADIUS_M, sanitizeWorkspaceForShareLink } from '../shareSanitize';
import type {
  ApplyOperationResult,
  CollaborativeKitItem,
  GeometryAnchor,
  PresenceEntry,
  RouteComment,
  RouteOperationInput,
  RouteOperationRecord,
  RouteProposal,
  RouteWorkspaceState,
  ShareLinkConfig,
} from '../types';
import {
  RouteCollabStoreError,
  type GroupedRouteNotification,
  type RouteCollabStore,
} from './types';

/**
 * Store Supabase de l'itinéraire collaboratif (architecture décidée, voir la migration
 * 20261118120000_route_collab_20_10.sql) :
 *  - l'état complet `RouteWorkspaceState` vit dans `route_workspaces.state_snapshot` ;
 *  - la lecture passe par le client Supabase de l'UTILISATEUR (RLS active) ;
 *  - l'état suivant est calculé avec les fonctions pures du moteur, puis écrit UNIQUEMENT via les
 *    RPC SECURITY DEFINER, qui revérifient le droit en base (les contrôles `hasRoutePermission`
 *    faits ici donnent des messages précis mais ne sont jamais la seule barrière) ;
 *  - concurrence optimiste : chaque écriture porte la `head_seq` / `state_version` lues ; si la base
 *    répond `conflict`, on relit et on recalcule (MAX_ATTEMPTS essais, puis 409).
 *
 * Limites connues :
 *  - présence : en mémoire process (comme `serverStore.ts`), elle passera par Supabase Realtime
 *    Broadcast plus tard (non fiable entre instances serverless en attendant) ;
 *  - les droits fins des parties comments / proposals / kitItems / participantPacks / notifications sont
 *    contrôlés ici (messages précis) ET par rôle dans `write_route_workspace_part_tx` (trip_viewer et
 *    external_viewer refusés, `p_expected_version` obligatoire) ; la liste est toutefois remplacée en
 *    bloc : le contrôle par auteur reste côté Next ;
 *  - lecteurs externes (lien de partage ou membre `external_viewer`) : ils ne lisent jamais les tables
 *    (RLS) ; la base renvoie une vue assainie (RPC `get_shared_route_workspace_tx` /
 *    `get_route_external_view_tx`) que `sanitizeWorkspaceForShareLink` revérifie ici ;
 *  - le jeton de partage est généré et haché en base : `manageShareLink` le renvoie UNE fois à la
 *    création ; une relecture ultérieure du lien ne le contient plus (`token` vide) ;
 *  - un collaborateur du voyage absent de `state_snapshot.members` voit l'itinéraire (RLS) mais le
 *    moteur ne lui accorde aucun droit d'écriture tant qu'il n'est pas inscrit comme membre ;
 *  - l'identité vient de la session Supabase : le cookie signé de repli (`LKDV_COLLAB_SESSION_SECRET`)
 *    n'ouvre aucun accès en base.
 */

const MAX_ATTEMPTS = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATION_LIST_LIMIT = 1000;
const WORKSPACE_LIST_LIMIT = 50;

type Json = Record<string, unknown>;


/** Rayon de la zone de départ privée renvoyé par get_shared_route_workspace_tx (repli : 500 m). */
function radiusFromShared(shared: Record<string, unknown>): number {
  const r = Number(shared.hideRadiusM);
  return Number.isFinite(r) && r >= 0 ? r : DEFAULT_PRIVATE_START_RADIUS_M;
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON à clés triées : compare deux objets sans dépendre de l'ordre des clés (jsonb le réordonne). */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/* ---------- Présence (mémoire process, voir limites) ---------- */

const globalForPresence = globalThis as unknown as {
  __lkdvRouteCollabSupabasePresence?: Map<string, Record<string, PresenceEntry>>;
};

function presenceFor(workspaceId: string): Record<string, PresenceEntry> {
  if (!globalForPresence.__lkdvRouteCollabSupabasePresence) {
    globalForPresence.__lkdvRouteCollabSupabasePresence = new Map();
  }
  const map = globalForPresence.__lkdvRouteCollabSupabasePresence;
  let entry = map.get(workspaceId);
  if (!entry) {
    entry = {};
    map.set(workspaceId, entry);
  }
  return entry;
}

/* ---------- Messages de refus des RPC ---------- */

const DENIED_MESSAGES: Readonly<Record<string, string>> = {
  auth_required: 'Authentification requise.',
  insufficient_permissions_or_revoked: 'Accès insuffisant ou révoqué pour cette action.',
  member_management_requires_owner_or_co_organizer: 'Gestion des membres réservée au responsable.',
  owner_protected: 'Seul un responsable peut nommer ou révoquer un responsable.',
  creator_immutable: 'Le créateur de l’itinéraire ne peut pas être révoqué ni rétrogradé.',
  delegated_publish_requires_owner: 'La délégation de publication est réservée au responsable.',
  share_management_requires_owner_or_co_organizer: 'Gestion du partage réservée au responsable.',
  idempotency_payload_mismatch: 'Clé d’idempotence réutilisée avec un contenu différent.',
  not_eligible: 'Cette personne ne peut pas être ajoutée à cet itinéraire (collaborateur du voyage requis).',
  reactivation_requires_owner: 'Seul un responsable peut réactiver un membre révoqué.',
  workspace_archived: 'Cet itinéraire est archivé : il est en lecture seule.',
  payload_too_large: 'Contenu trop volumineux.',
  invalid_snapshot_shape: 'Contenu de l’itinéraire invalide.',
  invalid_radius: 'Rayon de la zone de départ privée invalide (200 m minimum).',
  invalid_expiry: 'Date d’expiration du lien invalide.',
  expected_version_required: 'Version attendue manquante.',
  snapshot_head_mismatch: 'L’instantané à publier ne correspond plus à la tête de l’itinéraire.',
  snapshot_content_mismatch: 'L’instantané à publier ne correspond pas au contenu enregistré.',
};

function deniedMessage(reason: unknown): string {
  return (typeof reason === 'string' && DENIED_MESSAGES[reason]) || 'Action refusée.';
}

/* ---------- Lignes et état ---------- */

interface LoadedWorkspace {
  readonly workspace: RouteWorkspaceState;
  readonly notifications: GroupedRouteNotification[];
  readonly headSeq: number;
  readonly stateVersion: number;
}

function hydrate(
  id: string,
  headSeq: number,
  stateVersion: number,
  snapshot: unknown,
): LoadedWorkspace | null {
  if (!isRecord(snapshot)) return null;
  const { notifications, ...rest } = snapshot;
  const workspace = {
    ...rest,
    id,
    headSeq,
    // Le jeton n'est jamais relu depuis la base (seul son hash y est) : `token` vide hors création.
    shareLink: isRecord(rest.shareLink) ? { ...rest.shareLink, token: '' } : null,
    routingOptions: isRecord(rest.routingOptions) ? rest.routingOptions : {},
    points: asArray(rest.points),
    sections: asArray(rest.sections),
    stages: asArray(rest.stages),
    variants: asArray(rest.variants),
    proposals: asArray(rest.proposals),
    comments: asArray(rest.comments),
    kitItems: asArray(rest.kitItems),
    members: asArray(rest.members),
    revisions: asArray(rest.revisions),
    packs: asArray(rest.packs),
    participantPacks: asArray(rest.participantPacks),
  } as unknown as RouteWorkspaceState;
  return {
    workspace,
    notifications: asArray<GroupedRouteNotification>(notifications),
    headSeq,
    stateVersion,
  };
}

function hydrateRow(row: unknown): LoadedWorkspace | null {
  if (!isRecord(row) || typeof row.id !== 'string') return null;
  return hydrate(row.id, Number(row.head_seq), Number(row.state_version ?? 0), row.state_snapshot);
}

/** Ne transmet à la RPC que les clés propres aux opérations (la base fusionne de toute façon). */
function operationKeys(workspace: RouteWorkspaceState): Json {
  return {
    sport: workspace.sport,
    shapeMode: workspace.shapeMode,
    routingOptions: workspace.routingOptions,
    points: workspace.points,
    sections: workspace.sections,
    stages: workspace.stages,
    variants: workspace.variants,
    comments: workspace.comments,
    kitItems: workspace.kitItems,
    updatedAt: workspace.updatedAt,
  };
}

function publicationKeys(workspace: RouteWorkspaceState): Json {
  return {
    status: workspace.status,
    reviewedSeq: workspace.reviewedSeq,
    publishedRevisionId: workspace.publishedRevisionId,
    publishedRevisionNo: workspace.publishedRevisionNo,
    revisions: workspace.revisions,
    packs: workspace.packs,
    participantPacks: workspace.participantPacks,
    updatedAt: workspace.updatedAt,
  };
}

function rekeyWorkspace(initial: RouteWorkspaceState, id: string): RouteWorkspaceState {
  const rekey = <T extends { workspaceId?: string }>(items: readonly T[]): T[] =>
    items.map((item) => ('workspaceId' in item ? { ...item, workspaceId: id } : item));
  return {
    ...initial,
    id,
    points: rekey(initial.points),
    sections: rekey(initial.sections),
    stages: rekey(initial.stages),
    comments: rekey(initial.comments),
    proposals: rekey(initial.proposals),
  };
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

type PartName = 'comments' | 'proposals' | 'kitItems' | 'participantPacks' | 'notifications';

type PartPlan<T, S extends 403 | 404 | 409> =
  | { readonly write: true; readonly value: readonly unknown[]; readonly result: T }
  | { readonly write: false; readonly status: S; readonly error: string };

type PartOutcome<T, S extends 403 | 404 | 409> =
  | { readonly ok: true; readonly result: T; readonly workspace: RouteWorkspaceState }
  | { readonly ok: false; readonly status: S | 403 | 404; readonly error: string };

export function createSupabaseRouteCollabStore(supabase: SupabaseClient): RouteCollabStore {
  /* ---------- Accès base ---------- */

  async function rpc(name: string, args: Json): Promise<Json> {
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      if (error.code === '42501') {
        throw new RouteCollabStoreError(403, 'Accès refusé.');
      }
      if (error.code === '22023') {
        throw new RouteCollabStoreError(400, 'Requête invalide.');
      }
      if (error.code === '23505') {
        throw new RouteCollabStoreError(409, 'Cet itinéraire existe déjà.');
      }
      throw new RouteCollabStoreError(500, `Erreur de stockage (${name}).`);
    }
    return isRecord(data) ? data : { status: 'ok', value: data };
  }

  type LoadResult =
    | { readonly ok: true; readonly loaded: LoadedWorkspace }
    | { readonly ok: false; readonly reason: 'invalid_id' | 'not_visible' };

  async function loadRow(workspaceId: string): Promise<LoadResult> {
    // Un identifiant non UUID ne peut pas exister (colonne uuid) : évite l'erreur 22P02 de Postgres.
    if (!UUID_RE.test(workspaceId)) return { ok: false, reason: 'invalid_id' };
    const { data, error } = await supabase
      .from('route_workspaces')
      .select('id, head_seq, state_version, state_snapshot')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw new RouteCollabStoreError(500, 'Lecture de l’itinéraire impossible.');
    const loaded = data ? hydrateRow(data) : null;
    // RLS : une ligne invisible (inexistante, non membre ou révoqué) n'est pas distinguable.
    return loaded ? { ok: true, loaded } : { ok: false, reason: 'not_visible' };
  }

  async function loadOperationById(
    workspaceId: string,
    opId: string,
    workspace: RouteWorkspaceState,
    expectedOperation: RouteOperationInput,
  ): Promise<RouteOperationRecord | null> {
    const { data, error } = await supabase
      .from('route_operations')
      .select('seq, op_id, actor_id, base_seq, payload, payload_hash, entity_versions, created_at')
      .eq('workspace_id', workspaceId)
      .eq('op_id', opId)
      .maybeSingle();
    if (error) throw new RouteCollabStoreError(500, 'Lecture du journal d’opérations impossible.');
    return data ? toOperationRecord(data, workspaceId, workspace, expectedOperation) : null;
  }

  function toOperationRecord(
    row: unknown,
    workspaceId: string,
    workspace: RouteWorkspaceState,
    expectedOperation?: RouteOperationInput,
  ): RouteOperationRecord | null {
    if (!isRecord(row) || !isRecord(row.payload)) return null;
    const actorId = String(row.actor_id);
    const actor = workspace.members.find((m) => m.userId === actorId);
    return {
      seq: Number(row.seq),
      opId: String(row.op_id),
      workspaceId,
      actorId,
      actorName: actor?.displayName ?? `Voyageur ${actorId.slice(0, 6)}`,
      baseSeq: Number(row.base_seq),
      // Le hash stocké est un SHA-256 calculé en base. Le moteur compare des `stableHash` : on le recalcule
      // ici ; si le contenu stocké est identique (à l'ordre des clés près, jsonb les réordonne) à
      // l'opération rejouée, on renvoie le hash de CELLE-CI pour que la rejouabilité soit reconnue.
      payloadHash:
        expectedOperation && canonicalJson(row.payload) === canonicalJson(expectedOperation)
          ? stableHash(expectedOperation)
          : stableHash(row.payload),
      operation: row.payload as unknown as RouteOperationInput,
      expectedVersions: isRecord(row.entity_versions)
        ? (row.entity_versions as Record<string, number>)
        : {},
      createdAt: String(row.created_at),
    };
  }

  /**
   * Lecture-calcul-écriture d'UNE partie du snapshot, avec relecture si la base signale une
   * modification concurrente. `plan` est pur : il est rejoué sur l'état relu à chaque essai.
   */
  async function mutatePart<T, S extends 403 | 404 | 409>(
    workspaceId: string,
    part: PartName,
    plan: (loaded: LoadedWorkspace) => PartPlan<T, S>,
  ): Promise<PartOutcome<T, S>> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const read = await loadRow(workspaceId);
      if (!read.ok) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      const planned = plan(read.loaded);
      if (!planned.write) return { ok: false, status: planned.status, error: planned.error };

      const res = await rpc('write_route_workspace_part_tx', {
        p_workspace_id: workspaceId,
        p_part: part,
        p_value: planned.value,
        p_expected_version: read.loaded.stateVersion,
      });
      if (res.status === 'ok') {
        const workspace =
          part === 'notifications'
            ? read.loaded.workspace
            : ({ ...read.loaded.workspace, [part]: planned.value } as unknown as RouteWorkspaceState);
        return { ok: true, result: planned.result, workspace };
      }
      if (res.status === 'conflict') continue;
      if (res.status === 'not_found') {
        return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      }
      return { ok: false, status: 403, error: deniedMessage(res.reason) };
    }
    throw new RouteCollabStoreError(409, 'Itinéraire modifié en parallèle : réessayez.');
  }

  /** Applique UNE opération (moteur pur + RPC), avec relecture en cas de concurrence. */
  async function applyOperation(
    workspaceId: string,
    command: ApplyOperationCommand,
    nowIso: string,
  ): Promise<ApplyOperationResult | { readonly status: 'not_found' }> {
    let last: LoadedWorkspace | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const read = await loadRow(workspaceId);
      if (!read.ok) return { status: 'not_found' };
      const { loaded } = read;
      last = loaded;

      const existing = await loadOperationById(workspaceId, command.opId, loaded.workspace, command.operation);
      const { result } = applyWorkspaceOperation(
        loaded.workspace,
        existing ? [existing] : [],
        command,
        nowIso,
      );
      if (result.status !== 'accepted') return result;

      const res = await rpc('apply_route_operation_tx', {
        p_workspace_id: workspaceId,
        p_op_id: command.opId,
        // Jeton de concurrence : head_seq lu avant le calcul (pas la vue du client).
        p_base_seq: loaded.headSeq,
        p_operation_type: command.operation.type,
        p_payload: command.operation,
        p_payload_hash: stableHash(command.operation),
        p_entity_versions: command.expectedVersions ?? {},
        p_next_snapshot: operationKeys(result.workspace),
        p_expected_version: loaded.stateVersion,
      });

      switch (res.status) {
        case 'accepted':
          return { ...result, seq: Number(res.seq) };
        case 'already_applied':
          return { status: 'already_applied', seq: Number(res.seq), workspace: loaded.workspace };
        case 'not_found':
          return { status: 'not_found' };
        case 'conflict':
          continue;
        default:
          return { status: 'denied', reason: deniedMessage(res.reason) };
      }
    }

    // Concurrence persistante : on rend l'état courant pour que le client rebase.
    const fresh = await loadRow(workspaceId);
    const current = fresh.ok ? fresh.loaded.workspace : (last as LoadedWorkspace).workspace;
    return {
      status: 'conflict',
      currentSeq: current.headSeq,
      currentWorkspace: current,
      conflicts: [
        {
          entityId: workspaceId,
          entityType: 'workspace',
          entityLabel: current.title,
          expectedVersion: command.baseSeq,
          currentVersion: current.headSeq,
          message: 'Le brouillon a été modifié en parallèle : relisez-le avant de réessayer.',
          yourSummary: 'Votre modification',
          currentSummary: 'Brouillon mis à jour par un collaborateur',
        },
      ],
    };
  }

  async function reloadWorkspace(workspaceId: string, fallback: RouteWorkspaceState) {
    const read = await loadRow(workspaceId);
    return read.ok ? read.loaded.workspace : fallback;
  }

  /** Vue assainie renvoyée par la base (lien de partage ou external_viewer), revérifiée côté Next. */
  function readSanitizedView(workspaceId: string, res: Json) {
    if (res.status !== 'ok') return null;
    const snapshot = isRecord(res.snapshot) ? res.snapshot : null;
    const loaded = snapshot ? hydrate(workspaceId, Number(snapshot.headSeq ?? 0), 0, snapshot) : null;
    if (!loaded) return null;
    return {
      ok: true as const,
      workspace: sanitizeWorkspaceForShareLink(loaded.workspace, radiusFromShared(res)),
      notifications: [] as GroupedRouteNotification[],
      presence: [] as PresenceEntry[],
      accessMode: 'share_link' as const,
    };
  }

  /* ---------- Implémentation du contrat ---------- */

  const store: RouteCollabStore = {
    kind: 'supabase',

    async createWorkspaceRecord(initial) {
      const id = UUID_RE.test(initial.id) ? initial.id : crypto.randomUUID();
      const snapshot = rekeyWorkspace(initial, id);
      const tripId = UUID_RE.test(initial.tripId) ? initial.tripId : null;
      const res = await rpc('create_route_workspace_tx', {
        p_trip_id: tripId,
        p_title: initial.title,
        p_sport: initial.sport,
        p_snapshot: snapshot,
        p_id: id,
      });
      const createdId = typeof res.value === 'string' ? res.value : id;
      const read = await loadRow(createdId);
      return read.ok ? read.loaded.workspace : { ...snapshot, id: createdId };
    },

    async listWorkspacesForActor(actorId) {
      if (!actorId) return [];
      const { data, error } = await supabase
        .from('route_workspaces')
        .select('id, head_seq, state_version, state_snapshot')
        .order('updated_at', { ascending: false })
        .limit(WORKSPACE_LIST_LIMIT);
      if (error) throw new RouteCollabStoreError(500, 'Lecture des itinéraires impossible.');
      return asArray(data)
        .map((row) => hydrateRow(row)?.workspace)
        .filter((ws): ws is RouteWorkspaceState => Boolean(ws));
    },

    async getWorkspaceForActor(workspaceId, actorId, shareToken) {
      const read = await loadRow(workspaceId);
      if (read.ok) {
        const { workspace } = read.loaded;
        // Défense en profondeur : un lecteur externe ne devrait pas voir la ligne (RLS), mais s'il la voit,
        // il reçoit la même vue assainie que par le lien de partage.
        const me = actorId ? workspace.members.find((m) => m.userId === actorId) : undefined;
        if (me?.role === 'external_viewer' && !me.revokedAt) {
          return {
            ok: true,
            workspace: sanitizeWorkspaceForShareLink(workspace, workspace.shareLink?.hidePrivateStartRadiusM),
            notifications: [],
            presence: [],
            accessMode: 'share_link',
          };
        }
        return {
          ok: true,
          workspace,
          notifications: read.loaded.notifications,
          presence: prunePresence(presenceFor(workspaceId)),
          accessMode: 'member',
        };
      }
      if (read.reason === 'invalid_id') {
        return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      }

      // Lien de partage lecture seule : RPC publique, assainie côté base (jeton exact, non révoqué, non expiré).
      if (shareToken) {
        const shared = await rpc('get_shared_route_workspace_tx', {
          p_workspace_id: workspaceId,
          p_token: shareToken,
        });
        const view = readSanitizedView(workspaceId, shared);
        if (view) return view;
        if (shared.status === 'revoked') {
          return { ok: false, status: 403, error: 'Ce lien de partage a été révoqué.' };
        }
        if (shared.status === 'expired') {
          return { ok: false, status: 403, error: 'Ce lien de partage a expiré.' };
        }
      }

      // Membre external_viewer : pas de lecture des tables, uniquement la vue assainie de la base.
      if (actorId) {
        const external = await rpc('get_route_external_view_tx', { p_workspace_id: workspaceId });
        const view = readSanitizedView(workspaceId, external);
        if (view) return view;
      }

      if (!actorId) return { ok: false, status: 401, error: 'Authentification requise.' };
      return { ok: false, status: 403, error: 'Accès refusé ou révoqué.' };
    },

    async getWorkspaceChangesAfter(workspaceId, actorId, afterSeq, shareToken) {
      const read = await store.getWorkspaceForActor(workspaceId, actorId, shareToken);
      if (!read.ok) return read;
      const headSeq = read.workspace.headSeq;

      // Le journal est protégé par RLS : un lecteur par lien de partage recharge l'itinéraire entier.
      if (read.accessMode === 'share_link') {
        return {
          ok: true,
          headSeq,
          resyncRequired: afterSeq < headSeq,
          operations: [],
          workspace: read.workspace,
          presence: read.presence,
          notifications: read.notifications,
        };
      }

      if (headSeq - afterSeq > OPERATION_LIST_LIMIT) {
        return {
          ok: true,
          headSeq,
          resyncRequired: true,
          operations: [],
          workspace: read.workspace,
          presence: read.presence,
          notifications: read.notifications,
        };
      }

      const { data, error } = await supabase
        .from('route_operations')
        .select('seq, op_id, actor_id, base_seq, payload, payload_hash, entity_versions, created_at')
        .eq('workspace_id', workspaceId)
        .gt('seq', afterSeq)
        .order('seq', { ascending: true })
        .limit(OPERATION_LIST_LIMIT);
      if (error) throw new RouteCollabStoreError(500, 'Lecture du journal d’opérations impossible.');
      const operations = asArray(data)
        .map((row) => toOperationRecord(row, workspaceId, read.workspace))
        .filter((op): op is RouteOperationRecord => Boolean(op));
      return {
        ok: true,
        headSeq,
        resyncRequired: false,
        operations,
        workspace: read.workspace,
        presence: read.presence,
        notifications: read.notifications,
      };
    },

    async updateWorkspacePresence(params) {
      const read = await loadRow(params.workspaceId);
      if (!read.ok) {
        return read.reason === 'invalid_id'
          ? { ok: false, status: 404, error: 'Itinéraire introuvable.' }
          : { ok: false, status: 403, error: 'Accès refusé.' };
      }
      const member = read.loaded.workspace.members.find((m) => m.userId === params.actorId);
      if (member?.revokedAt) return { ok: false, status: 403, error: 'Accès refusé.' };

      // Mémoire process en attendant Supabase Realtime Broadcast.
      const presence = presenceFor(params.workspaceId);
      const nowMs = params.nowIso ? Date.parse(params.nowIso) : Date.now();
      presence[params.actorId] = {
        userId: params.actorId,
        displayName: params.actorName,
        activeStageId: params.activeStageId ?? null,
        selectedEntityId: params.selectedEntityId ?? null,
        softLockEntityId: params.softLockEntityId ?? null,
        softLockExpiresAt: params.softLockEntityId ? new Date(nowMs + 15_000).toISOString() : null,
        mode: params.mode ?? 'viewing',
        lastSeenAt: new Date(nowMs).toISOString(),
      };
      return { ok: true, presence: prunePresence(presence, nowMs) };
    },

    async submitWorkspaceOperation(workspaceId, command, nowIso = new Date().toISOString()) {
      return applyOperation(workspaceId, command, nowIso);
    },

    async createWorkspaceProposal(params) {
      const nowIso = params.nowIso ?? new Date().toISOString();
      const outcome = await mutatePart<RouteProposal, 403>(params.workspaceId, 'proposals', (loaded) => {
        const { workspace } = loaded;
        const member = workspace.members.find((m) => m.userId === params.actorId);
        if (!hasRoutePermission(member, 'route.propose')) {
          return { write: false, status: 403, error: 'Permission de proposition requise.' };
        }
        // Aperçu d'impact sans muter le brouillon (simulé comme propriétaire).
        let previewState = workspace;
        let tempLog: readonly RouteOperationRecord[] = [];
        const ownerId = workspace.members.find((m) => m.role === 'owner')?.userId ?? params.actorId;
        for (let i = 0; i < params.operations.length; i += 1) {
          const sim = applyWorkspaceOperation(
            previewState,
            tempLog,
            {
              opId: `sim-${Date.now()}-${i}`,
              baseSeq: previewState.headSeq,
              actorId: ownerId,
              actorName: params.actorName,
              operation: params.operations[i],
            },
            nowIso,
          );
          if (sim.result.status === 'accepted') {
            previewState = sim.result.workspace;
            tempLog = sim.nextOpLog;
          }
        }
        const scopeIds = Array.from(
          new Set(
            params.operations.flatMap((op) => {
              if ('pointId' in op) return [op.pointId];
              if ('sectionId' in op) return [op.sectionId];
              if ('stageId' in op) return [op.stageId];
              return [];
            }),
          ),
        );
        const proposal: RouteProposal = {
          id: newId('prop'),
          workspaceId: params.workspaceId,
          baseSeq: workspace.headSeq,
          createdBy: params.actorId,
          authorName: params.actorName,
          title: params.title,
          rationale: params.rationale,
          scopeEntityIds: scopeIds,
          operations: params.operations,
          impactPreview: computeRouteImpact(workspace, previewState),
          status: 'open',
          votes: {},
          createdAt: nowIso,
        };
        return { write: true, value: [...workspace.proposals, proposal], result: proposal };
      });
      if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.error };
      return { ok: true, proposal: outcome.result, workspace: outcome.workspace };
    },

    async voteWorkspaceProposal(params) {
      const outcome = await mutatePart<RouteProposal, 403 | 404>(
        params.workspaceId,
        'proposals',
        ({ workspace }) => {
          const member = workspace.members.find((m) => m.userId === params.actorId);
          if (!hasRoutePermission(member, 'route.comment')) {
            return { write: false, status: 403, error: 'Permission de vote insuffisante.' };
          }
          const proposal = workspace.proposals.find((p) => p.id === params.proposalId);
          if (!proposal) return { write: false, status: 404, error: 'Proposition introuvable.' };
          const updated: RouteProposal = {
            ...proposal,
            votes: { ...proposal.votes, [params.actorId]: params.vote },
          };
          return {
            write: true,
            value: workspace.proposals.map((p) => (p.id === proposal.id ? updated : p)),
            result: updated,
          };
        },
      );
      if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.error };
      return { ok: true, proposal: outcome.result, workspace: outcome.workspace };
    },

    async decideWorkspaceProposal(params) {
      const nowIso = params.nowIso ?? new Date().toISOString();
      const read = await loadRow(params.workspaceId);
      if (!read.ok) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      const { workspace } = read.loaded;
      const member = workspace.members.find((m) => m.userId === params.actorId);
      if (!hasRoutePermission(member, 'route.review')) {
        return { ok: false, status: 403, error: 'Permission de validation requise.' };
      }
      const proposal = workspace.proposals.find((p) => p.id === params.proposalId);
      if (!proposal) return { ok: false, status: 404, error: 'Proposition introuvable.' };
      if (proposal.status !== 'open') {
        return { ok: false, status: 409, error: `Proposition déjà traitée (${proposal.status}).` };
      }

      const setStatus = (status: RouteProposal['status'], review: boolean) =>
        mutatePart<RouteProposal, 404 | 409>(params.workspaceId, 'proposals', (loaded) => {
          const current = loaded.workspace.proposals.find((p) => p.id === params.proposalId);
          if (!current) return { write: false, status: 404, error: 'Proposition introuvable.' };
          if (current.status !== 'open') {
            return {
              write: false,
              status: 409,
              error: `Proposition déjà traitée (${current.status}).`,
            };
          }
          const updated: RouteProposal = review
            ? { ...current, status, reviewedBy: params.actorId, reviewedAt: nowIso }
            : { ...current, status };
          return {
            write: true,
            value: loaded.workspace.proposals.map((p) => (p.id === current.id ? updated : p)),
            result: updated,
          };
        });

      if (params.decision === 'reject') {
        const outcome = await setStatus('rejected', true);
        if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.error };
        return { ok: true, proposal: outcome.result, workspace: outcome.workspace };
      }

      if (params.expectedHeadSeq !== undefined && params.expectedHeadSeq !== workspace.headSeq) {
        return {
          ok: false,
          status: 409,
          error: `Le brouillon a changé (seq ${workspace.headSeq} vs ${params.expectedHeadSeq}) : relisez la proposition avant acceptation.`,
        };
      }
      if (proposal.baseSeq !== workspace.headSeq && params.expectedHeadSeq === undefined) {
        await setStatus('superseded', false);
        return {
          ok: false,
          status: 409,
          error: `Proposition basée sur seq ${proposal.baseSeq}, mais le brouillon est à seq ${workspace.headSeq}. Revalidez avant d'appliquer.`,
        };
      }

      // Simulation complète avant toute écriture : aucune application partielle si une opération échoue.
      let simState = workspace;
      let simLog: readonly RouteOperationRecord[] = [];
      for (let i = 0; i < proposal.operations.length; i += 1) {
        const sim = applyWorkspaceOperation(
          simState,
          simLog,
          {
            opId: `accept-${proposal.id}-${i}`,
            baseSeq: simState.headSeq,
            actorId: params.actorId,
            actorName: params.actorName,
            operation: proposal.operations[i],
          },
          nowIso,
        );
        if (sim.result.status !== 'accepted') {
          return { ok: false, status: 409, error: 'Impossible d’appliquer la proposition sur l’état courant.' };
        }
        simState = sim.result.workspace;
        simLog = sim.nextOpLog;
      }

      // Application réelle : identifiants d'opération déterministes => rejouable sans doublon.
      for (let i = 0; i < proposal.operations.length; i += 1) {
        const live = await loadRow(params.workspaceId);
        const baseSeq = live.ok ? live.loaded.headSeq : workspace.headSeq;
        const applied = await applyOperation(
          params.workspaceId,
          {
            opId: `accept-${proposal.id}-${i}`,
            baseSeq,
            actorId: params.actorId,
            actorName: params.actorName,
            operation: proposal.operations[i],
          },
          nowIso,
        );
        if (applied.status === 'not_found') {
          return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
        }
        if (applied.status !== 'accepted' && applied.status !== 'already_applied') {
          return { ok: false, status: 409, error: 'Impossible d’appliquer la proposition sur l’état courant.' };
        }
      }

      const outcome = await mutatePart<RouteProposal, 404 | 409>(params.workspaceId, 'proposals', (loaded) => {
        const current = loaded.workspace.proposals.find((p) => p.id === params.proposalId);
        if (!current) return { write: false, status: 404, error: 'Proposition introuvable.' };
        const accepted: RouteProposal = {
          ...current,
          status: 'accepted',
          reviewedBy: params.actorId,
          reviewedAt: nowIso,
        };
        return {
          write: true,
          value: loaded.workspace.proposals.map((p) => (p.id === current.id ? accepted : p)),
          result: accepted,
        };
      });
      if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.error };
      return {
        ok: true,
        proposal: outcome.result,
        workspace: await reloadWorkspace(params.workspaceId, outcome.workspace),
      };
    },

    async addWorkspaceComment(params) {
      const nowIso = params.nowIso ?? new Date().toISOString();
      const outcome = await mutatePart<RouteComment, 403>(
        params.workspaceId,
        'comments',
        ({ workspace }) => {
          const member = workspace.members.find((m) => m.userId === params.actorId);
          if (!hasRoutePermission(member, 'route.comment')) {
            return { write: false, status: 403, error: 'Permission de commentaire requise.' };
          }
          const comment: RouteComment = {
            id: newId('cmt'),
            workspaceId: params.workspaceId,
            createdBy: params.actorId,
            authorName: params.actorName,
            body: params.body,
            anchor: params.anchor,
            baseRevisionNo: workspace.publishedRevisionNo ?? 0,
            status: 'open',
            createdAt: nowIso,
          };
          return { write: true, value: [...workspace.comments, comment], result: comment };
        },
      );
      if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.error };
      return { ok: true, comment: outcome.result, workspace: outcome.workspace };
    },

    async relocateWorkspaceComment(params) {
      const outcome = await mutatePart<RouteComment, 403 | 404>(
        params.workspaceId,
        'comments',
        ({ workspace }) => {
          const member = workspace.members.find((m) => m.userId === params.actorId);
          if (!hasRoutePermission(member, 'route.comment')) {
            return { write: false, status: 403, error: 'Permission insuffisante.' };
          }
          const comment = workspace.comments.find((c) => c.id === params.commentId);
          if (!comment) return { write: false, status: 404, error: 'Commentaire introuvable.' };
          const updated: RouteComment = {
            ...comment,
            anchor: params.newAnchor as GeometryAnchor,
            status: 'open',
          };
          return {
            write: true,
            value: workspace.comments.map((c) => (c.id === comment.id ? updated : c)),
            result: updated,
          };
        },
      );
      if (!outcome.ok) return { ok: false, status: outcome.status, error: outcome.error };
      return { ok: true, comment: outcome.result, workspace: outcome.workspace };
    },

    async publishWorkspace(params) {
      const nowIso = params.nowIso ?? new Date().toISOString();
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const read = await loadRow(params.workspaceId);
        if (!read.ok) return { status: 'not_found' };
        const { loaded } = read;
        const prevState = loaded.workspace;
        const res = publishWorkspaceRevision({
          workspace: prevState,
          actorId: params.actorId,
          actorName: params.actorName,
          expectedHeadSeq: params.expectedHeadSeq,
          summary: params.summary,
          acknowledgedUnknowns: params.acknowledgedUnknowns,
          nowIso,
        });
        if (res.status !== 'published') return res;

        const db = await rpc('publish_route_revision_tx', {
          p_workspace_id: params.workspaceId,
          // La tête lue avant le calcul : si elle a bougé, la base bloque la publication.
          p_expected_head_seq: loaded.headSeq,
          p_summary: res.revision.summary,
          p_snapshot: res.revision,
          p_checksum: res.pack.checksum,
          p_manifest: res.pack,
          p_next_snapshot: publicationKeys(res.workspace),
          p_expected_version: loaded.stateVersion,
        });

        if (db.status === 'conflict') continue;
        if (db.status === 'not_found') return { status: 'not_found' };
        if (db.status === 'blocked') {
          if (db.reason === 'head_changed_requires_review') {
            return {
              status: 'blocked',
              reason: `Le brouillon a avancé (séquence ${String(db.currentHeadSeq)} vs ${params.expectedHeadSeq} relue) : une nouvelle vérification est requise avant publication.`,
              blockingIssues: ['head_changed_requires_review'],
            };
          }
          if (db.reason === 'publish_permission_required') {
            return {
              status: 'blocked',
              reason: 'Permission de publication requise.',
              blockingIssues: ['permission_denied'],
            };
          }
          return {
            status: 'blocked',
            reason: deniedMessage(db.reason),
            blockingIssues: [String(db.reason ?? 'blocked')],
          };
        }
        if (db.status !== 'published') {
          return { status: 'blocked', reason: 'Publication refusée.', blockingIssues: ['blocked'] };
        }

        await notifyPublication({
          workspaceId: params.workspaceId,
          actorId: params.actorId,
          prevState,
          published: res,
          nowIso,
        });
        return res;
      }
      throw new RouteCollabStoreError(409, 'Itinéraire modifié en parallèle : réessayez.');
    },

    async markParticipantPackState(params) {
      const outcome = await mutatePart<null, 403>(params.workspaceId, 'participantPacks', ({ workspace }) => {
        const member = workspace.members.find((m) => m.userId === params.userId);
        if (!hasRoutePermission(member, 'route.download_pack')) {
          return { write: false, status: 403, error: 'Accès au pack refusé.' };
        }
        const existing = workspace.participantPacks.find((p) => p.userId === params.userId);
        const nextEntry = {
          userId: params.userId,
          displayName: params.displayName,
          preparedRevisionNo:
            params.preparedRevisionNo !== undefined
              ? params.preparedRevisionNo
              : existing?.preparedRevisionNo ?? null,
          downloadedRevisionNo:
            params.downloadedRevisionNo !== undefined
              ? params.downloadedRevisionNo
              : existing?.downloadedRevisionNo ?? null,
          verifiedLocalAt:
            params.verifiedLocalAt !== undefined
              ? params.verifiedLocalAt
              : existing?.verifiedLocalAt ?? null,
          status: params.status,
        };
        const nextPacks = existing
          ? workspace.participantPacks.map((p) => (p.userId === params.userId ? nextEntry : p))
          : [...workspace.participantPacks, nextEntry];
        return { write: true, value: nextPacks, result: null };
      });
      if (!outcome.ok) return { ok: false, error: outcome.error };
      return { ok: true, workspace: outcome.workspace };
    },

    async updateWorkspaceKitItem(params) {
      const outcome = await mutatePart<null, 403>(params.workspaceId, 'kitItems', ({ workspace }) => {
        const member = workspace.members.find((m) => m.userId === params.actorId);
        if (!hasRoutePermission(member, 'route.edit_stages') && !hasRoutePermission(member, 'route.edit_geometry')) {
          return { write: false, status: 403, error: 'Permission d’édition du kit requise.' };
        }
        let nextKit: CollaborativeKitItem[] = workspace.kitItems.slice();
        if (params.action === 'add' && params.newItem) {
          nextKit = [...nextKit, params.newItem];
        } else if (params.action === 'assign' && params.itemId) {
          const assignee = workspace.members.find((m) => m.userId === params.assigneeUserId);
          nextKit = nextKit.map((item) =>
            item.id === params.itemId
              ? {
                  ...item,
                  assigneeUserId: params.assigneeUserId ?? null,
                  assigneeName: assignee?.displayName ?? null,
                  status: params.assigneeUserId ? 'confirmed' : 'unassigned',
                }
              : item,
          );
        } else if (params.action === 'revalidate' && params.itemId) {
          nextKit = nextKit.map((item) =>
            item.id === params.itemId ? { ...item, status: 'confirmed', revalidationReason: null } : item,
          );
        }
        return { write: true, value: nextKit, result: null };
      });
      if (!outcome.ok) return { ok: false, status: outcome.status === 404 ? 404 : 403, error: outcome.error };
      return { ok: true, workspace: outcome.workspace };
    },

    async updateMemberRoleOrRevoke(params) {
      const read = await loadRow(params.workspaceId);
      if (!read.ok) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      const actor = read.loaded.workspace.members.find((m) => m.userId === params.actorId);
      if (!hasRoutePermission(actor, 'route.manage_members')) {
        return { ok: false, status: 403, error: 'Gestion des membres réservée au responsable.' };
      }
      // 8.3 : `set_route_member_tx` n'écrit pas `stage_scope_ids` (la migration 20261118120000 est figée). On refuse
      // franchement plutôt que d'annoncer une étape confiée qui ne serait pas enregistrée.
      if (params.stageScopeIds !== undefined) {
        return {
          ok: false,
          status: 501,
          error: 'Confier une étape n’est pas encore enregistrable en base (la fonction set_route_member_tx n’accepte pas de portée).',
        };
      }
      // route_workspace_members référence auth.users : seul un identifiant utilisateur (UUID) est valide.
      if (!UUID_RE.test(params.targetUserId)) {
        return { ok: false, status: 404, error: 'Utilisateur introuvable.' };
      }
      const res = await rpc('set_route_member_tx', {
        p_workspace_id: params.workspaceId,
        p_user_id: params.targetUserId,
        p_role: params.role ?? null,
        p_revoke: params.revoke ?? false,
        p_delegated_publish: params.delegatedPublish ?? null,
        p_display_name: params.displayName ?? null,
      });
      if (res.status === 'not_found') {
        return { ok: false, status: 404, error: 'Itinéraire ou utilisateur introuvable.' };
      }
      if (res.status !== 'ok') {
        return { ok: false, status: 403, error: deniedMessage(res.reason) };
      }
      if (params.revoke) delete presenceFor(params.workspaceId)[params.targetUserId];
      return {
        ok: true,
        workspace: await reloadWorkspace(params.workspaceId, read.loaded.workspace),
      };
    },

    async manageShareLink(params) {
      const read = await loadRow(params.workspaceId);
      if (!read.ok) return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      const actor = read.loaded.workspace.members.find((m) => m.userId === params.actorId);
      if (!hasRoutePermission(actor, 'route.manage_privacy')) {
        return { ok: false, status: 403, error: 'Gestion du partage réservée au responsable.' };
      }
      const now = Date.now();
      const create = params.action === 'create';
      // Le jeton est généré en base (256 bits) : seul son SHA-256 y est conservé, et il n'est renvoyé
      // qu'ici, une seule fois. Le rayon (200 à 5000 m) est validé par la base.
      const res = await rpc('manage_route_share_link_tx', {
        p_workspace_id: params.workspaceId,
        p_action: params.action,
        p_expires_at:
          create && params.expiresInHours
            ? new Date(now + params.expiresInHours * 3600_000).toISOString()
            : null,
        p_hide_radius_m: Math.round(params.hidePrivateStartRadiusM ?? DEFAULT_PRIVATE_START_RADIUS_M),
      });
      if (res.status === 'not_found') {
        return { ok: false, status: 404, error: 'Itinéraire introuvable.' };
      }
      if (res.status !== 'ok') {
        return { ok: false, status: 403, error: deniedMessage(res.reason) };
      }
      const reloaded = await reloadWorkspace(params.workspaceId, read.loaded.workspace);
      const token = create && typeof res.token === 'string' ? res.token : '';
      const shareLink: ShareLinkConfig | null = isRecord(res.shareLink)
        ? ({ ...res.shareLink, token } as unknown as ShareLinkConfig)
        : reloaded.shareLink ?? null;
      // Le jeton figure dans la réponse de création uniquement (jamais relu depuis la base ensuite).
      const workspace = create && shareLink ? { ...reloaded, shareLink } : reloaded;
      return { ok: true, shareLink, workspace };
    },

    async getPackManifestForRevision(workspaceId, actorId, revisionNo) {
      const read = await store.getWorkspaceForActor(workspaceId, actorId);
      if (!read.ok) return read;
      const pack =
        revisionNo != null
          ? read.workspace.packs.find((p) => p.revisionNo === revisionNo)
          : read.workspace.packs[read.workspace.packs.length - 1];
      if (!pack) return { ok: false, status: 404, error: 'Pack introuvable pour cette révision.' };
      return { ok: true, manifest: pack };
    },
  };

  /** Notification groupée après publication (même logique que le store mémoire), stockée dans snapshot.notifications. */
  async function notifyPublication(input: {
    workspaceId: string;
    actorId: string;
    prevState: RouteWorkspaceState;
    published: Extract<ReturnType<typeof publishWorkspaceRevision>, { status: 'published' }>;
    nowIso: string;
  }): Promise<void> {
    const { published, prevState, actorId, nowIso, workspaceId } = input;
    const reasonsByUserId: Record<string, string> = {};
    const affectedIds = new Set<string>();
    for (const pp of published.workspace.participantPacks) {
      if (pp.userId !== actorId && pp.downloadedRevisionNo !== published.revision.revisionNo) {
        affectedIds.add(pp.userId);
        reasonsByUserId[pp.userId] = `Version ${published.revision.revisionNo} publiée — pack à mettre à jour`;
      }
    }
    const impact = computeRouteImpact(prevState, published.workspace);
    for (const am of impact.affectedMembers) {
      affectedIds.add(am.userId);
      reasonsByUserId[am.userId] = reasonsByUserId[am.userId]
        ? `${reasonsByUserId[am.userId]} · ${am.reason}`
        : am.reason;
    }
    if (affectedIds.size === 0) return;
    const notification: GroupedRouteNotification = {
      id: `notif-${published.revision.id}`,
      workspaceId,
      revisionNo: published.revision.revisionNo,
      title: `Version ${published.revision.revisionNo} publiée : ${published.revision.summary}`,
      summary: `${affectedIds.size} équipier(s) concerné(s)`,
      affectedUserIds: Array.from(affectedIds),
      reasonsByUserId,
      createdAt: nowIso,
    };
    try {
      await mutatePart<null, 403>(workspaceId, 'notifications', (loaded) => ({
        write: true,
        value: [...loaded.notifications, notification],
        result: null,
      }));
    } catch {
      // La révision est déjà publiée et immuable : l'échec de la notification ne doit pas la masquer.
    }
  }

  return store;
}
