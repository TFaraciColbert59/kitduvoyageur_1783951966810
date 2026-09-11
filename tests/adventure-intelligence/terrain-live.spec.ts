import { describe, it, expect } from 'vitest';
import {
  TERMINAL_REPORT_STATUSES,
  CONFIRMATIONS_TO_ACTIVATE,
  CONTRADICTIONS_TO_RESOLVE,
  DEDUP_MAX_DISTANCE_M,
  DEDUP_WINDOW_HOURS,
  MAX_DESCRIPTION_LENGTH,
  MAX_REPORTS_PER_HOUR,
  MAX_CONFIRMATIONS_COOLDOWN,
  MODERATION_REASONS,
  REPORT_CONFIDENCE_METHOD,
  shouldExpire,
  nextReportStatus,
  computeReportConfidence,
  deduplicateReports,
  moderationDecision,
  type DedupCandidate,
  type LifecycleContext,
  type ModerationInput,
  type ReportConfidenceInput,
} from '@/features/adventure-intelligence/domain/terrainLive';

const NOW = '2026-09-11T12:00:00.000Z';

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 3600000).toISOString();
}

function context(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    now: NOW,
    expiresAt: hoursAgo(-24),
    confirmationsPresent: 0,
    contradicts: 0,
    ...overrides,
  };
}

function confidenceInput(overrides: Partial<ReportConfidenceInput> = {}): ReportConfidenceInput {
  return {
    presentCount: 3,
    goneCount: 0,
    unknownCount: 0,
    distinctUsers: 3,
    ageHours: 2,
    gpsAccuracyM: 10,
    hasPhoto: false,
    officialSource: false,
    traceCorroboration: false,
    ...overrides,
  };
}

function candidate(overrides: Partial<DedupCandidate> = {}): DedupCandidate {
  return {
    id: 'candidat-1',
    category: 'obstacle',
    segmentId: 42,
    lat: 42.8,
    lng: 0.15,
    createdAt: hoursAgo(1),
    ...overrides,
  };
}

function moderationInput(overrides: Partial<ModerationInput> = {}): ModerationInput {
  return {
    reportsLastHour: 0,
    confirmationsLastHour: 0,
    accountAgeDays: 30,
    reputation: 50,
    hasPhoto: false,
    descriptionLength: 100,
    ...overrides,
  };
}

describe('Terrain Live — cycle de vie (TEST-A5-LIFE)', () => {
  it('TEST-A5-LIFE-01: le cycle nominal pending → confirmed → active', () => {
    expect(nextReportStatus('pending', 'confirm', context({ confirmationsPresent: 1 }))).toBe(
      'confirmed'
    );
    expect(
      nextReportStatus(
        'confirmed',
        'confirm',
        context({ confirmationsPresent: CONFIRMATIONS_TO_ACTIVATE })
      )
    ).toBe('active');
    // Une confirmation insuffisante ne publie pas encore.
    expect(nextReportStatus('confirmed', 'confirm', context({ confirmationsPresent: 1 }))).toBe(
      'confirmed'
    );
  });

  it('TEST-A5-LIFE-02: auto_confirm suit le même chemin que confirm', () => {
    expect(
      nextReportStatus('pending', 'auto_confirm', context({ confirmationsPresent: 1 }))
    ).toBe('confirmed');
    expect(
      nextReportStatus('confirmed', 'auto_confirm', context({ confirmationsPresent: 2 }))
    ).toBe('active');
    expect(nextReportStatus('active', 'auto_confirm', context())).toBe('active');
  });

  it('TEST-A5-LIFE-03: age fait vieillir active → stale → verify, jamais un pending', () => {
    expect(nextReportStatus('active', 'age', context())).toBe('stale');
    expect(nextReportStatus('stale', 'age', context())).toBe('verify');
    expect(nextReportStatus('verify', 'age', context())).toBe('verify');
    expect(nextReportStatus('pending', 'age', context())).toBe('pending');
    expect(nextReportStatus('confirmed', 'age', context())).toBe('stale');
  });

  it('TEST-A5-LIFE-04: une confirmation ranime stale et verify', () => {
    expect(nextReportStatus('stale', 'confirm', context({ confirmationsPresent: 3 }))).toBe(
      'active'
    );
    expect(nextReportStatus('verify', 'confirm', context({ confirmationsPresent: 4 }))).toBe(
      'active'
    );
    expect(nextReportStatus('verify', 'auto_confirm', context({ confirmationsPresent: 4 }))).toBe(
      'active'
    );
  });

  it('TEST-A5-LIFE-05: resolve exige au moins 3 contradictions « disparu » et plus que de présents', () => {
    expect(
      nextReportStatus(
        'active',
        'resolve',
        context({ confirmationsPresent: 5, contradicts: CONTRADICTIONS_TO_RESOLVE - 1 })
      )
    ).toBe('active');
    expect(
      nextReportStatus(
        'active',
        'resolve',
        context({ confirmationsPresent: 5, contradicts: CONTRADICTIONS_TO_RESOLVE })
      )
    ).toBe('active');
    expect(
      nextReportStatus(
        'active',
        'resolve',
        context({ confirmationsPresent: 2, contradicts: CONTRADICTIONS_TO_RESOLVE })
      )
    ).toBe('resolved');
    // Un pending non publié ne peut pas être résolu.
    expect(
      nextReportStatus('pending', 'resolve', context({ confirmationsPresent: 0, contradicts: 9 }))
    ).toBe('pending');
  });

  it('TEST-A5-LIFE-06: reject est immédiat et terminal', () => {
    expect(nextReportStatus('pending', 'reject', context())).toBe('rejected');
    expect(nextReportStatus('active', 'reject', context())).toBe('rejected');
    expect(nextReportStatus('verify', 'reject', context())).toBe('rejected');
    expect(nextReportStatus('rejected', 'reject', context())).toBe('rejected');
  });

  it('TEST-A5-LIFE-07: l’expiration est interdite avant expiresAt, effective après', () => {
    const report = { status: 'active' as const, expiresAt: hoursAgo(-1) };

    expect(shouldExpire(report, NOW)).toBe(false);
    expect(
      nextReportStatus(
        'active',
        'expire',
        context({ expiresAt: hoursAgo(-1) })
      )
    ).toBe('active');

    expect(shouldExpire(report, hoursAgo(-2))).toBe(true);
    expect(
      nextReportStatus('active', 'expire', context({ expiresAt: hoursAgo(-1), now: hoursAgo(-2) }))
    ).toBe('expired');
    // age constate aussi l'expiration dépassée.
    expect(
      nextReportStatus('active', 'age', context({ expiresAt: hoursAgo(-1), now: hoursAgo(-2) }))
    ).toBe('expired');
    // Un rapport sans expiration ne peut expirer que sur événement explicite.
    expect(shouldExpire({ status: 'active', expiresAt: null }, NOW)).toBe(false);
    expect(nextReportStatus('active', 'expire', context({ expiresAt: null }))).toBe('expired');
  });

  it('TEST-A5-LIFE-08: les statuts terminaux sont immuables', () => {
    expect([...TERMINAL_REPORT_STATUSES]).toEqual(['resolved', 'expired', 'rejected']);
    for (const terminal of TERMINAL_REPORT_STATUSES) {
      expect(nextReportStatus(terminal, 'confirm', context({ confirmationsPresent: 9 }))).toBe(
        terminal
      );
      expect(nextReportStatus(terminal, 'age', context({ now: hoursAgo(-48) }))).toBe(terminal);
      expect(
        nextReportStatus(terminal, 'resolve', context({ contradicts: 9, confirmationsPresent: 0 }))
      ).toBe(terminal);
      expect(nextReportStatus(terminal, 'expire', context())).toBe(terminal);
      expect(shouldExpire({ status: terminal, expiresAt: hoursAgo(1) }, NOW)).toBe(false);
    }
  });
});

describe('Terrain Live — confiance (TEST-A5-CONF)', () => {
  it('TEST-A5-CONF-01: plus de confirmations et d’utilisateurs distincts élèvent la confiance', () => {
    const single = computeReportConfidence(
      confidenceInput({ presentCount: 1, distinctUsers: 1 })
    );
    const collective = computeReportConfidence(
      confidenceInput({ presentCount: 6, distinctUsers: 6 })
    );

    expect(collective.score).toBeGreaterThan(single.score);
    expect(collective.sampleCount).toBe(6);
    expect(collective.method).toBe(REPORT_CONFIDENCE_METHOD);
    expect(collective.reasons).toContain('confirmations_presentes_6');
    expect(collective.reasons).toContain('utilisateurs_distincts_6');
  });

  it('TEST-A5-CONF-02: la récence augmente la confiance', () => {
    const fresh = computeReportConfidence(confidenceInput({ ageHours: 1 }));
    const old = computeReportConfidence(confidenceInput({ ageHours: 100 }));

    expect(fresh.score).toBeGreaterThan(old.score);
    expect(fresh.reasons).toContain('signalement_recent');
  });

  it('TEST-A5-CONF-03: les contradictions « disparu » font chuter la confiance', () => {
    const consistent = computeReportConfidence(
      confidenceInput({ presentCount: 5, goneCount: 0, distinctUsers: 5 })
    );
    const contradicted = computeReportConfidence(
      confidenceInput({ presentCount: 5, goneCount: 5, distinctUsers: 10 })
    );

    expect(contradicted.score).toBeLessThan(consistent.score);
    expect(contradicted.reasons).toContain('contradictions_disparu_5');
  });

  it('TEST-A5-CONF-04: l’ancienneté pénalise au-delà de trois jours', () => {
    const recent = computeReportConfidence(confidenceInput({ ageHours: 10 }));
    const ancient = computeReportConfidence(confidenceInput({ ageHours: 300 }));

    expect(recent.score).toBeGreaterThan(ancient.score);
    expect(ancient.reasons).toContain('signalement_ancien');
  });

  it('TEST-A5-CONF-05: une source officielle est plus fiable qu’un signalement utilisateur', () => {
    const user = computeReportConfidence(confidenceInput({ officialSource: false }));
    const official = computeReportConfidence(confidenceInput({ officialSource: true }));

    expect(official.score).toBeGreaterThan(user.score);
    expect(official.reasons).toContain('source_officielle');
  });

  it('TEST-A5-CONF-06: photo, GPS précis et corroboration de trace consolident le score, borné [0,1]', () => {
    const weak = computeReportConfidence(
      confidenceInput({ hasPhoto: false, gpsAccuracyM: 150, traceCorroboration: false })
    );
    const strong = computeReportConfidence(
      confidenceInput({ hasPhoto: true, gpsAccuracyM: 8, traceCorroboration: true })
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.reasons).toContain('photo_fournie');
    expect(strong.reasons).toContain('gps_precis');
    expect(strong.reasons).toContain('corroboration_trace');
    expect(weak.reasons).toContain('gps_imprecis');

    const bounded = computeReportConfidence(
      confidenceInput({
        presentCount: 500,
        distinctUsers: 500,
        ageHours: 0,
        hasPhoto: true,
        officialSource: true,
        traceCorroboration: true,
      })
    );
    expect(bounded.score).toBeLessThanOrEqual(1);
    expect(bounded.score).toBeGreaterThanOrEqual(0);
    expect(bounded.sampleCount).toBe(500);
  });
});

describe('Terrain Live — déduplication (TEST-A5-DEDUP)', () => {
  it('TEST-A5-DEDUP-01: fusionne un signalement du même segment dans la fenêtre', () => {
    const result = deduplicateReports(
      [candidate({ id: 'existant', segmentId: 42, createdAt: hoursAgo(2) })],
      candidate({ id: 'nouveau', segmentId: 42, createdAt: NOW })
    );

    expect(result.mergedWith).toBe('existant');
    expect(result.reason).toBe('doublon_meme_segment');
  });

  it('TEST-A5-DEDUP-02: fusionne à moins de 150 m même sans segment identique', () => {
    const result = deduplicateReports(
      [candidate({ id: 'existant-proche', segmentId: null, lat: 42.8005, lng: 0.1505 })],
      candidate({ id: 'nouveau', segmentId: null, lat: 42.8, lng: 0.15 })
    );

    expect(result.mergedWith).toBe('existant-proche');
    expect(result.reason).toBe('doublon_proximite');
  });

  it('TEST-A5-DEDUP-03: rejette la fusion hors de la fenêtre de 6 h', () => {
    const result = deduplicateReports(
      [candidate({ id: 'vieux', segmentId: 42, createdAt: hoursAgo(DEDUP_WINDOW_HOURS + 2) })],
      candidate({ id: 'nouveau', segmentId: 42, createdAt: NOW })
    );

    expect(result.mergedWith).toBeNull();
    expect(result.reason).toBe('aucun_doublon_hors_fenetre');
  });

  it('TEST-A5-DEDUP-04: jamais de fusion entre catégories différentes ni au-delà de 150 m', () => {
    const otherCategory = deduplicateReports(
      [candidate({ id: 'boue', category: 'mud', segmentId: 42, createdAt: hoursAgo(1) })],
      candidate({ id: 'nouveau', category: 'obstacle', createdAt: NOW })
    );
    expect(otherCategory.mergedWith).toBeNull();
    expect(otherCategory.reason).toBe('aucun_doublon_categorie_differente');

    const tooFar = deduplicateReports(
      [candidate({ id: 'loin', segmentId: null, lat: 43.5, lng: 1.2, createdAt: hoursAgo(1) })],
      candidate({ id: 'nouveau', segmentId: null, createdAt: NOW })
    );
    expect(tooFar.mergedWith).toBeNull();
    expect(tooFar.reason).toBe('aucun_doublon_hors_distance');
    expect(DEDUP_MAX_DISTANCE_M).toBe(150);
  });
});

describe('Terrain Live — modération (TEST-A5-MOD)', () => {
  it('TEST-A5-MOD-01: rate limit de 10 signalements par heure', () => {
    const blocked = moderationDecision(moderationInput({ reportsLastHour: MAX_REPORTS_PER_HOUR }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain(MODERATION_REASONS.rateLimit);

    const allowed = moderationDecision(
      moderationInput({ reportsLastHour: MAX_REPORTS_PER_HOUR - 1 })
    );
    expect(allowed.allowed).toBe(true);
    expect(allowed.reasons).toHaveLength(0);
  });

  it('TEST-A5-MOD-02: cooldown de 2 confirmations par fenêtre courte', () => {
    const blocked = moderationDecision(
      moderationInput({ confirmationsLastHour: MAX_CONFIRMATIONS_COOLDOWN })
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain(MODERATION_REASONS.cooldown);

    const allowed = moderationDecision(moderationInput({ confirmationsLastHour: 1 }));
    expect(allowed.allowed).toBe(true);
  });

  it('TEST-A5-MOD-03: la réputation est plafonnée à 100 et plancher à 0', () => {
    const low = moderationDecision(moderationInput({ reputation: 5 }));
    expect(low.allowed).toBe(true);
    expect(low.reasons).toContain(MODERATION_REASONS.lowReputation);

    const capped = moderationDecision(moderationInput({ reputation: 100 }));
    const beyond = moderationDecision(moderationInput({ reputation: 10_000 }));
    expect(beyond).toEqual(capped);
    expect(capped.reasons).toHaveLength(0);

    const floor = moderationDecision(moderationInput({ reputation: 0 }));
    const negative = moderationDecision(moderationInput({ reputation: -50 }));
    expect(negative).toEqual(floor);
    expect(floor.reasons).toContain(MODERATION_REASONS.lowReputation);
  });

  it('TEST-A5-MOD-04: description limitée à 1000 caractères', () => {
    const blocked = moderationDecision(
      moderationInput({ descriptionLength: MAX_DESCRIPTION_LENGTH + 1 })
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain(MODERATION_REASONS.description);

    const allowed = moderationDecision(
      moderationInput({ descriptionLength: MAX_DESCRIPTION_LENGTH })
    );
    expect(allowed.allowed).toBe(true);
  });

  it('TEST-A5-MOD-05: une photo déclarée doit avoir une URL valide et une taille bornée', () => {
    const missing = moderationDecision(moderationInput({ hasPhoto: true }));
    expect(missing.allowed).toBe(false);
    expect(missing.reasons).toContain(MODERATION_REASONS.photo);

    const invalidUrl = moderationDecision(
      moderationInput({
        hasPhoto: true,
        photoUrl: 'pas-une-url',
        photoSizeBytes: 1024,
      })
    );
    expect(invalidUrl.allowed).toBe(false);

    const tooBig = moderationDecision(
      moderationInput({
        hasPhoto: true,
        photoUrl: 'https://exemple.test/photo.jpg',
        photoSizeBytes: 20 * 1024 * 1024,
      })
    );
    expect(tooBig.allowed).toBe(false);

    const valid = moderationDecision(
      moderationInput({
        hasPhoto: true,
        photoUrl: 'https://exemple.test/photo.jpg',
        photoSizeBytes: 1024 * 1024,
      })
    );
    expect(valid.allowed).toBe(true);
  });

  it('TEST-A5-MOD-06: une source officielle est prioritaire mais reste validée', () => {
    const stressed = moderationInput({
      reportsLastHour: 99,
      confirmationsLastHour: 99,
      reputation: 0,
      officialSource: true,
    });

    const official = moderationDecision(stressed);
    expect(official.allowed).toBe(true);
    expect(official.reasons).toContain(MODERATION_REASONS.official);

    const user = moderationDecision({ ...stressed, officialSource: false });
    expect(user.allowed).toBe(false);

    const invalidOfficial = moderationDecision({
      ...stressed,
      descriptionLength: MAX_DESCRIPTION_LENGTH + 1,
    });
    expect(invalidOfficial.allowed).toBe(false);
  });
});

