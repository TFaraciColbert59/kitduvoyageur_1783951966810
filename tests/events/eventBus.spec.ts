import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  lkvEventSchema,
  isEventExpiredForGdpr,
  type CreateEventInput,
  type LkvEvent,
} from '@/lib/events/types';
import { EventBus } from '@/lib/events/eventBus';
import { handleActivityFeedEvent } from '@/lib/events/handlers/activityFeedHandler';
import { handleNotificationEvent } from '@/lib/events/handlers/notificationHandler';
import { handleScoringEvent } from '@/lib/events/handlers/scoringHandler';

describe('Phase 7.1 & 7.3 — Schéma canonique et validation Zod du Bus lkv_events', () => {
  const validEventInput: CreateEventInput = {
    event_type: 'trip.created',
    actor_id: '00000000-0000-4000-a000-000000000001',
    entity_type: 'trip',
    entity_id: '00000000-0000-4000-a000-000000000002',
    visibility: 'crew',
    crew_id: '00000000-0000-4000-a000-000000000003',
    metadata: { title: 'Trek Islande' },
  };

  it('TEST-BUS-01: valide un événement conforme et initialise les valeurs par défaut', () => {
    const parsed = lkvEventSchema.parse(validEventInput);
    expect(parsed.event_type).toBe('trip.created');
    expect(parsed.visibility).toBe('crew');
    expect(parsed.metadata).toEqual({ title: 'Trek Islande' });
  });

  it('TEST-BUS-02: applique les valeurs par défaut (visibility: private, metadata: {})', () => {
    const minimalInput = {
      event_type: 'gear.packed',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'gear',
      entity_id: '00000000-0000-4000-a000-000000000002',
    };
    const parsed = lkvEventSchema.parse(minimalInput);
    expect(parsed.visibility).toBe('private');
    expect(parsed.metadata).toEqual({});
  });

  it('TEST-BUS-03: rejette un événement avec un type d’entité ou d’événement invalide', () => {
    const invalid = {
      ...validEventInput,
      event_type: '',
    };
    expect(() => lkvEventSchema.parse(invalid)).toThrow();
  });

  it('TEST-BUS-04: rejette une visibilité inconnue hors de (private, crew, public)', () => {
    const invalidVis = {
      ...validEventInput,
      visibility: 'super-secret',
    };
    expect(() => lkvEventSchema.parse(invalidVis)).toThrow();
  });

  it('TEST-BUS-05: vérifie la règle RGPD de rétention (13 mois maximum)', () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000); // 1 mois
    const expiredDate = new Date(now.getTime() - 400 * 24 * 3600 * 1000); // ~13.3 mois (> 13 mois)

    expect(isEventExpiredForGdpr(recentDate.toISOString())).toBe(false);
    expect(isEventExpiredForGdpr(expiredDate.toISOString())).toBe(true);
  });
});

describe('Phase 7.1 — Fonction d’émission emitEvent et souscriptions in-process', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus({ persistToDatabase: false });
  });

  it('TEST-BUS-06: émet un événement valide avec succès et génère un UUID', async () => {
    const res = await bus.emit({
      event_type: 'trip.created',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'trip',
      entity_id: '00000000-0000-4000-a000-000000000002',
      visibility: 'public',
      metadata: { title: 'Mont Blanc' },
    });

    expect(res.success).toBe(true);
    expect(res.event?.id).toBeDefined();
    expect(res.event?.created_at).toBeDefined();
    expect(res.event?.metadata.title).toBe('Mont Blanc');
  });

  it('TEST-BUS-07: ne lève jamais d’exception en cas de payload erroné (safe fail)', async () => {
    const res = await bus.emit({
      event_type: '',
      actor_id: 'invalid-uuid',
      entity_type: 'trip',
      entity_id: 'invalid-uuid',
    } as any);

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('TEST-BUS-08: notifie les abonnés enregistrés (wildcard et type spécifique)', async () => {
    const allListener = vi.fn();
    const tripListener = vi.fn();
    const gearListener = vi.fn();

    bus.subscribe('*', allListener);
    bus.subscribe('trip.phase_changed', tripListener);
    bus.subscribe('gear.packed', gearListener);

    await bus.emit({
      event_type: 'trip.phase_changed',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'trip',
      entity_id: '00000000-0000-4000-a000-000000000002',
      metadata: { from: 'prepare', to: 'live' },
    });

    expect(allListener).toHaveBeenCalledTimes(1);
    expect(tripListener).toHaveBeenCalledTimes(1);
    expect(gearListener).not.toHaveBeenCalled();
  });

  it('TEST-BUS-09: permet le désabonnement propre (unsubscribe)', async () => {
    const listener = vi.fn();
    const unsubscribe = bus.subscribe('place.reviewed', listener);

    await bus.emit({
      event_type: 'place.reviewed',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'place',
      entity_id: '00000000-0000-4000-a000-000000000002',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    await bus.emit({
      event_type: 'place.reviewed',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'place',
      entity_id: '00000000-0000-4000-a000-000000000002',
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 7.2 — Consommateurs d’événements (Activity, Notifications, Scoring)', () => {
  it('TEST-BUS-10: activityFeedHandler formate un élément lisible pour le fil d’activité', () => {
    const event: LkvEvent = {
      id: '00000000-0000-4000-a000-000000000010',
      event_type: 'trip.completed',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'trip',
      entity_id: '00000000-0000-4000-a000-000000000002',
      visibility: 'public',
      crew_id: null,
      metadata: { tripTitle: 'GR20 Sud', totalKm: 85 },
      created_at: new Date().toISOString(),
    };

    const item = handleActivityFeedEvent(event);
    expect(item).not.toBeNull();
    expect(item?.headline).toContain('a terminé l’expédition');
    expect(item?.badge).toBe('Expédition terminée');
  });

  it('TEST-BUS-11: notificationHandler convertit un événement crew.joined en notification pour les équipiers', () => {
    const event: LkvEvent = {
      id: '00000000-0000-4000-a000-000000000011',
      event_type: 'crew.joined',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'crew',
      entity_id: '00000000-0000-4000-a000-000000000003',
      visibility: 'crew',
      crew_id: '00000000-0000-4000-a000-000000000003',
      metadata: { memberName: 'Alexandre', crewName: 'Équipe Alpinistes' },
      created_at: new Date().toISOString(),
    };

    const notif = handleNotificationEvent(event);
    expect(notif).not.toBeNull();
    expect(notif?.title).toContain('Nouvel équipier');
    expect(notif?.message).toContain('Alexandre');
  });

  it('TEST-BUS-12: scoringHandler attribue des points d’expérience pour un avis terrain certifié', () => {
    const event: LkvEvent = {
      id: '00000000-0000-4000-a000-000000000012',
      event_type: 'place.reviewed',
      actor_id: '00000000-0000-4000-a000-000000000001',
      entity_type: 'place',
      entity_id: '00000000-0000-4000-a000-000000000005',
      visibility: 'public',
      crew_id: null,
      metadata: { hasFieldProof: true, placeName: 'Refuge du Goûter' },
      created_at: new Date().toISOString(),
    };

    const points = handleScoringEvent(event);
    expect(points.pointsEarned).toBe(50); // 50 pts pour avis vérifié terrain
    expect(points.badgeEarned).toBe('Sentinelle des Refuges');
  });
});
