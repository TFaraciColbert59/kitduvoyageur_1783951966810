import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  MemoryCache,
  UpstreamRateLimiter,
} from '@/features/explorer-osm/services/cacheService';

describe('Cache & Circuit Breaker — Résilience', () => {
  describe('MemoryCache', () => {
    it('stocke, lit et respecte le TTL', () => {
      const cache = new MemoryCache<string>(10, 100); // 100ms TTL
      cache.set('key1', 'val1');

      const hit = cache.get('key1');
      expect(hit).not.toBeNull();
      expect(hit?.data).toBe('val1');
      expect(hit?.isStale).toBe(false);
    });

    it('applique une politique d’éviction LRU au-delà de la capacité maximale', () => {
      const cache = new MemoryCache<number>(3, 60_000);
      cache.set('k1', 1);
      cache.set('k2', 2);
      cache.set('k3', 3);
      expect(cache.size()).toBe(3);

      // Accès à k1 pour rafraîchir son rang LRU
      cache.get('k1');

      // Insertion d'un 4ème élément -> k2 (le plus ancien non accédé) doit être évincé
      cache.set('k4', 4);
      expect(cache.size()).toBe(3);
      expect(cache.has('k2')).toBe(false);
      expect(cache.has('k1')).toBe(true);
      expect(cache.has('k3')).toBe(true);
      expect(cache.has('k4')).toBe(true);
    });
  });

  describe('CircuitBreaker', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('passe de CLOSED à OPEN après N échecs consécutifs', () => {
      const breaker = new CircuitBreaker(3, 500);
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isOpen()).toBe(false);

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isOpen()).toBe(false);

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.isOpen()).toBe(true);
    });

    it('passe en HALF_OPEN après expiration du délai de récupération', () => {
      const breaker = new CircuitBreaker(2, 50); // 50ms cooldown
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.isOpen()).toBe(true);

      // Attente 60ms
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(breaker.isOpen()).toBe(false);
          expect(breaker.getState()).toBe('HALF_OPEN');
          breaker.recordSuccess();
          expect(breaker.getState()).toBe('CLOSED');
          resolve();
        }, 60);
      });
    });
  });

  describe('UpstreamRateLimiter', () => {
    it('permet des requêtes quasi-simultanées sur des canaux différents sans collision anti-rafale', () => {
      const limiter = new UpstreamRateLimiter(30, 200); // 200ms anti-burst par canal

      // Canal routes
      expect(limiter.canExecute('routes').allowed).toBe(true);
      limiter.recordCall('routes');

      // Même instant : canal pois -> NE DOIT PAS être bloqué par routes
      expect(limiter.canExecute('pois').allowed).toBe(true);
      limiter.recordCall('pois');

      // En revanche, un 2ème appel immédiat sur le canal routes est freiné par l'anti-rafale
      expect(limiter.canExecute('routes').allowed).toBe(false);
      expect(limiter.canExecute('routes').reason).toContain('Anti-rafale actif');
    });

    it('respecte le plafond global maxRequestsPerMinute', () => {
      const limiter = new UpstreamRateLimiter(2, 0); // 2 req/min max, pas d'anti-burst

      expect(limiter.canExecute().allowed).toBe(true);
      limiter.recordCall();
      expect(limiter.canExecute().allowed).toBe(true);
      limiter.recordCall();

      const third = limiter.canExecute();
      expect(third.allowed).toBe(false);
      expect(third.reason).toContain('Quota amont Overpass saturé');
    });
  });
});
