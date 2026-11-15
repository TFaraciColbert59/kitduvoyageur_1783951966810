import {
  ALL_HEALTH_CONSENT_SCOPES,
  P01_CONSENT_POLICY_VERSION,
  createDefaultHealthConsentState,
} from '@/features/sensors';
import type { HealthConsentGrant, HealthConsentScope, HealthConsentState } from '@/features/sensors';

const STORAGE_KEY = 'lkdv.health_consent.v1';

export interface ConsentTransport {
  load(): Promise<HealthConsentState | null>;
  /** Retourne l'état canonique du serveur, ou `null` si le serveur est indisponible. */
  save(state: HealthConsentState): Promise<HealthConsentState | null>;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isGrant(value: unknown, scope: HealthConsentScope): value is HealthConsentGrant {
  if (typeof value !== 'object' || value === null) return false;
  const grant = value as Partial<HealthConsentGrant>;
  return (
    grant.scope === scope &&
    typeof grant.granted === 'boolean' &&
    typeof grant.updatedAtMs === 'number' &&
    Number.isFinite(grant.updatedAtMs) &&
    typeof grant.policyVersion === 'string' &&
    (grant.source === 'user_prompt' ||
      grant.source === 'settings' ||
      grant.source === 'system_revoked')
  );
}

export function isHealthConsentState(value: unknown): value is HealthConsentState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<HealthConsentState>;
  if (typeof state.policyVersion !== 'string' || !state.grants) return false;
  return ALL_HEALTH_CONSENT_SCOPES.every((scope) =>
    isGrant((state.grants as Partial<HealthConsentState['grants']>)[scope], scope),
  );
}

export function readLocalHealthConsent(): HealthConsentState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isHealthConsentState(parsed)) return null;
    if (parsed.policyVersion !== P01_CONSENT_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalHealthConsent(state: HealthConsentState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / mode privé : le serveur reste la source de vérité */
  }
}

async function readServerConsent(): Promise<HealthConsentState | null> {
  try {
    const response = await fetch('/api/sensors/health/consent', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const state = (payload as { state?: unknown } | null)?.state;
    return isHealthConsentState(state) ? state : null;
  } catch {
    return null;
  }
}

async function writeServerConsent(state: HealthConsentState): Promise<HealthConsentState | null> {
  try {
    const response = await fetch('/api/sensors/health/consent', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ action: 'replace', state }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const next = (payload as { state?: unknown } | null)?.state;
    return isHealthConsentState(next) ? next : null;
  } catch {
    return null;
  }
}

/** Transport par défaut : cookie HttpOnly côté serveur, copie locale en secours. */
export function createConsentTransport(): ConsentTransport {
  return {
    async load() {
      const server = await readServerConsent();
      if (server) {
        writeLocalHealthConsent(server);
        return server;
      }
      return readLocalHealthConsent();
    },
    async save(state) {
      writeLocalHealthConsent(state);
      const server = await writeServerConsent(state);
      if (server) writeLocalHealthConsent(server);
      return server;
    },
  };
}

export function initialHealthConsent(): HealthConsentState {
  return readLocalHealthConsent() ?? createDefaultHealthConsentState();
}
