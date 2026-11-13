import { cookies } from 'next/headers';
import {
  HEALTH_CONSENT_COOKIE,
  normalizeHealthConsentState,
  parseHealthConsentState,
} from './consent';
import type { HealthConsentState } from '@/features/sensors';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Consentement P01 stocké dans un cookie HttpOnly de première partie.
 *
 * Ce lot UI n'ajoute aucune table : le consentement granulaire est conservé
 * côté appareil, sans jamais exposer les scopes au JavaScript client. Une
 * future migration pourra déplacer ce stockage côté compte sans changer le
 * contrat HTTP.
 */
export async function readConsentCookie(nowMs: number = Date.now()): Promise<HealthConsentState> {
  const store = await cookies();
  const raw = store.get(HEALTH_CONSENT_COOKIE)?.value;
  if (!raw) return normalizeHealthConsentState(null, nowMs);

  try {
    return parseHealthConsentState(JSON.parse(decodeURIComponent(raw)), nowMs) ??
      normalizeHealthConsentState(null, nowMs);
  } catch {
    return normalizeHealthConsentState(null, nowMs);
  }
}

export async function writeConsentCookie(state: HealthConsentState): Promise<void> {
  const store = await cookies();
  store.set(HEALTH_CONSENT_COOKIE, encodeURIComponent(JSON.stringify(state)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function clearConsentCookie(): Promise<void> {
  const store = await cookies();
  store.set(HEALTH_CONSENT_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
