/**
 * LE KIT DU VOYAGEUR — CACHE & RÉSILIENCE OVERPASS
 * Cache mémoire borné (LRU/TTL) et disjoncteur (Circuit Breaker)
 * Garantit l'absence de freeze, protège les quotas fournisseurs
 * et offre une dégradation gracieuse en cas de panne réseau.
 */

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private maxItems: number;
  private defaultTtlMs: number;

  constructor(maxItems = 250, defaultTtlMs = 10 * 60 * 1000) {
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): { data: T; isStale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isStale = now > entry.expiresAt;

    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);

    return { data: entry.data, isStale };
  }

  set(key: string, data: T, ttlMs?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttlMs ?? this.defaultTtlMs);

    // Eviction LRU si limite atteinte
    if (this.store.size >= this.maxItems && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, { data, createdAt: now, expiresAt });
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * Disjoncteur pour protéger le service contre les pannes et les 429 Overpass
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  private threshold: number;
  private resetTimeoutMs: number;

  constructor(threshold = 5, resetTimeoutMs = 15_000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

// Instances singleton pour le backend
export const osmRouteSummaryCache = new MemoryCache<any>(200, 5 * 60 * 1000); // 5 min TTL
export const osmRouteDetailCache = new MemoryCache<any>(100, 30 * 60 * 1000); // 30 min TTL
export const osmPoiCache = new MemoryCache<any>(200, 10 * 60 * 1000); // 10 min TTL

export const overpassCircuitBreaker = new CircuitBreaker(5, 15_000);

/**
 * Single-flight deduplication : regroupe les requêtes identiques concurrentes
 * en un seul appel amont partagé.
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<any>>();

  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  clear(): void {
    this.inFlight.clear();
  }
}

/**
 * Limiteur amont global pour Overpass (single upstream limiter)
 * - Empêche les rafales (espacement minimum entre appels sur un même canal)
 * - Plafonne à maxRequestsPerMinute (ex: 30 appels amont/minute max au niveau serveur)
 * - Supporte la séparation par canal pour que les routes et POIs simultanés ne se bloquent pas
 * - Respecte le Retry-After d'Overpass
 */
export class UpstreamRateLimiter {
  private callTimestamps: number[] = [];
  private retryAfterUntil = 0;
  private lastCallTimeByChannel = new Map<string, number>();
  private maxRequestsPerMinute: number;
  private minIntervalMs: number;

  constructor(
    maxRequestsPerMinute = 30,
    minIntervalMs = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 100
  ) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.minIntervalMs = minIntervalMs;
  }

  canExecute(channel = 'default'): { allowed: boolean; retryAfterSeconds?: number; reason?: string } {
    const now = Date.now();

    if (now < this.retryAfterUntil) {
      const waitSeconds = Math.ceil((this.retryAfterUntil - now) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: waitSeconds,
        reason: `Respect du Retry-After amont (${waitSeconds}s restantes)`,
      };
    }

    // Nettoyer les timestamps de plus d'une minute
    const oneMinAgo = now - 60_000;
    this.callTimestamps = this.callTimestamps.filter((t) => t > oneMinAgo);

    if (this.callTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestInWindow = this.callTimestamps[0];
      const waitSeconds = Math.ceil((oldestInWindow + 60_000 - now) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, waitSeconds),
        reason: `Quota amont Overpass saturé (${this.callTimestamps.length}/${this.maxRequestsPerMinute} req/min)`,
      };
    }

    const lastCallTime = this.lastCallTimeByChannel.get(channel) || 0;
    if (now - lastCallTime < this.minIntervalMs) {
      return {
        allowed: false,
        retryAfterSeconds: 1,
        reason: `Anti-rafale actif (intervalle minimum ${this.minIntervalMs}ms)`,
      };
    }

    return { allowed: true };
  }

  recordCall(channel = 'default'): void {
    const now = Date.now();
    this.lastCallTimeByChannel.set(channel, now);
    this.callTimestamps.push(now);
  }

  setRetryAfter(seconds: number): void {
    const safeSec = Math.max(1, Math.min(seconds, 300));
    this.retryAfterUntil = Date.now() + safeSec * 1000;
  }

  reset(): void {
    this.callTimestamps = [];
    this.retryAfterUntil = 0;
    this.lastCallTimeByChannel.clear();
  }
}

export const upstreamSingleFlight = new SingleFlight();
export const upstreamRateLimiter = new UpstreamRateLimiter(
  30,
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 100
);
