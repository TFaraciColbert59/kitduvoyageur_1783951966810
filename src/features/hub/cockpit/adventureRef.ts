/**
 * Identité canonique d'aventure (AdventureRef) unifiant sortie, collectif
 * et activité libre, et contrat de mutation partagée idempotente (P02-01, P02-06, P02-14).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdventureNature = 'sortie' | 'collectif' | 'activite_libre';

export interface CanonicalAdventureRef {
  nature: AdventureNature;
  id: string;
  slug: string;
  title: string;
  routeRevision?: number | null;
  planUpdatedAt?: string | null;
}

export function parseAdventureRef(raw: unknown): CanonicalAdventureRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const nature = obj.nature;
  if (nature !== 'sortie' && nature !== 'collectif' && nature !== 'activite_libre') return null;
  if (typeof obj.id !== 'string' || !UUID_RE.test(obj.id)) return null;
  const slug = typeof obj.slug === 'string' ? obj.slug.trim().slice(0, 160) : '';
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim().slice(0, 160) : 'Aventure';
  const routeRevision = typeof obj.routeRevision === 'number' && Number.isInteger(obj.routeRevision) && obj.routeRevision >= 1
    ? obj.routeRevision
    : null;
  const planUpdatedAt = typeof obj.planUpdatedAt === 'string' ? obj.planUpdatedAt : null;

  return { nature, id: obj.id, slug, title, routeRevision, planUpdatedAt };
}

export interface SharedMutationEnvelope<TPayload> {
  adventureId: string;
  operationId: string;
  expectedVersion: number;
  planRevision?: string | null;
  source: 'hub' | 'compas' | 'offline_replay';
  payload: TPayload;
}

export function validateMutationEnvelope<TPayload>(
  envelope: SharedMutationEnvelope<TPayload>,
): { ok: true } | { ok: false; reason: string } {
  if (!UUID_RE.test(envelope.adventureId)) return { ok: false, reason: 'invalid_adventure_id' };
  if (!UUID_RE.test(envelope.operationId)) return { ok: false, reason: 'invalid_operation_id' };
  if (!Number.isInteger(envelope.expectedVersion) || envelope.expectedVersion < 0) {
    return { ok: false, reason: 'invalid_expected_version' };
  }
  return { ok: true };
}
