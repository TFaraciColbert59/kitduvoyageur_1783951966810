import { describe, it, expect } from 'vitest';
import {
  authError,
  configError,
  quotaError,
  redactKey,
  timeoutError,
} from '@/features/discovery/providers/tripadvisor/tripadvisorErrors';

describe('tripadvisor error taxonomy + redaction', () => {
  it('ne journalise jamais la clé d’une URL', () => {
    const url =
      'https://api.content.tripadvisor.com/api/v1/location/search?searchQuery=Islande&key=SECRET-123&language=fr';
    const redacted = redactKey(url);
    expect(redacted).not.toContain('SECRET-123');
    expect(redacted).toContain('key=***');
    expect(redacted).toContain('language=fr');
  });

  it('mappe chaque code vers une raison et un statut', () => {
    expect(configError().reason).toBe('missing_config');
    expect(quotaError().code).toBe('quota');
    expect(quotaError().status).toBe(429);
    expect(authError(403).status).toBe(403);
    expect(authError(401).reason).toBe('auth');
    expect(timeoutError().reason).toBe('timeout');
  });
});
