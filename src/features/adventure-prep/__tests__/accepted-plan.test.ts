import { describe, it, expect } from 'vitest';
import {
  acceptedPlanSchema,
  draftFromAcceptedPlan,
  parseAcceptedPlan,
  MAX_PLAN_STEPS,
} from '../acceptedPlan';
import { buildAcceptedPlan } from '../adventureRequest';
import { buildItinerary } from '../engine/itinerary';
import { emptyDraft } from '../engine/emptyDraft';
import { resolvedGear } from '../engine/gear';
import { canOpenStep } from '../engine/steps';
import { fullDraft, CHAMONIX } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/** Un voyage d'un mois complet, avec sac affecte et etapes gardees. */
function monthDraft(): AdventurePrepDraft {
  const base = fullDraft({
    coverName: 'Un mois au Japon',
    activities: { primary: 'rando-refuge', extra: ['course'], nights: ['bivouac'] },
    calendar: {
      startDate: '2027-04-01',
      durationDays: 30,
      durationIsSuggested: false,
      returnDate: '2027-04-30',
    },
  });
  const itinerary = buildItinerary(base);
  if (!itinerary) throw new Error('fixture: itineraire non constructible');
  const steps = itinerary.steps.map((step, index) =>
    index === 2 ? { ...step, kept: true, startTime: '08:30', lat: 45.9, lon: 6.9 } : step,
  );
  const withItinerary: AdventurePrepDraft = {
    ...base,
    itinerary: { ...itinerary, steps },
    currentStep: 'departure',
    completedSteps: ['destination', 'itinerary'],
  };
  const gear = resolvedGear(withItinerary).map((item, index) =>
    index === 0 ? { ...item, ownerId: 'camille', weightGrams: 250 } : item,
  );
  return { ...withItinerary, gear, packedGearIds: [gear[0].id] };
}

describe('acceptedPlan — contrat v1 partagé client / serveur', () => {
  it('AP-01: un plan construit par le brouillon passe le schéma strict', () => {
    expect(acceptedPlanSchema.safeParse(buildAcceptedPlan(monthDraft())).success).toBe(true);
    expect(acceptedPlanSchema.safeParse(buildAcceptedPlan(emptyDraft())).success).toBe(true);
  });

  it('AP-02: une clé inconnue est refusée, à tous les niveaux', () => {
    const plan = buildAcceptedPlan(monthDraft());
    expect(parseAcceptedPlan({ ...plan, extra: 1 })).toBeNull();
    expect(parseAcceptedPlan({ ...plan, group: { ...plan.group, role: 'admin' } })).toBeNull();
    const steps = plan.itinerary!.steps.map((step, i) => (i === 0 ? { ...step, html: '<b>' } : step));
    expect(parseAcceptedPlan({ ...plan, itinerary: { ...plan.itinerary!, steps } })).toBeNull();
  });

  it('AP-03: valeurs hors domaine refusées (date, heure, coordonnées, énumérations)', () => {
    const plan = buildAcceptedPlan(monthDraft());
    expect(parseAcceptedPlan({ ...plan, calendar: { ...plan.calendar, startDate: 'demain' } })).toBeNull();
    expect(
      parseAcceptedPlan({ ...plan, route: { ...plan.route, origin: { ...CHAMONIX, lat: 120 } } }),
    ).toBeNull();
    expect(parseAcceptedPlan({ ...plan, preferences: { ...plan.preferences, pace: 'turbo' } })).toBeNull();
    const steps = plan.itinerary!.steps.map((step, i) => (i === 0 ? { ...step, startTime: '25:00' } : step));
    expect(parseAcceptedPlan({ ...plan, itinerary: { ...plan.itinerary!, steps } })).toBeNull();
  });

  it('AP-04: taille bornée — trop d’étapes est refusé', () => {
    const plan = buildAcceptedPlan(monthDraft());
    const step = plan.itinerary!.steps[0];
    const steps = Array.from({ length: MAX_PLAN_STEPS + 1 }, (_, i) => ({ ...step, id: `s${i}` }));
    expect(parseAcceptedPlan({ ...plan, itinerary: { days: 30, steps } })).toBeNull();
  });

  it('AP-05: version de contrat inconnue refusée', () => {
    expect(parseAcceptedPlan({ ...buildAcceptedPlan(monthDraft()), schemaVersion: 2 })).toBeNull();
    expect(parseAcceptedPlan(null)).toBeNull();
    expect(parseAcceptedPlan('plan')).toBeNull();
  });
});

describe('draftFromAcceptedPlan — relecture identique (L0.6)', () => {
  it('AP-10: 30 jours relus = plan validé, à l’identique', () => {
    const plan = buildAcceptedPlan(monthDraft());
    const reread = parseAcceptedPlan(JSON.parse(JSON.stringify(plan)));
    expect(reread).not.toBeNull();
    const draft = draftFromAcceptedPlan(reread!);
    expect(buildAcceptedPlan(draft)).toEqual(plan);
  });

  it('AP-11: durée, étapes gardées, sac et groupe survivent', () => {
    const draft = draftFromAcceptedPlan(buildAcceptedPlan(monthDraft()));
    expect(draft.calendar.durationDays).toBe(30);
    expect(draft.itinerary?.days).toBe(30);
    expect(draft.itinerary?.steps.filter((step) => step.kept)).toHaveLength(1);
    expect(draft.itinerary?.steps.find((step) => step.kept)?.startTime).toBe('08:30');
    expect(draft.group.knownMembers).toEqual(['Camille']);
    expect(draft.packedGearIds).toHaveLength(1);
    expect(draft.gear[0]).toMatchObject({ ownerId: 'camille', weightGrams: 250, packed: true });
  });

  it('AP-12: le brouillon relu rouvre l’écran de départ, sans étape fermée', () => {
    const draft = draftFromAcceptedPlan(buildAcceptedPlan(monthDraft()));
    expect(draft.currentStep).toBe('departure');
    expect(canOpenStep(draft, 'departure')).toBe(true);
    expect(draft.generation.status).toBe('termine');
  });

  it('AP-13: sans parcours enregistré, on reprend à l’étape Parcours', () => {
    const base = monthDraft();
    const draft = draftFromAcceptedPlan(buildAcceptedPlan({ ...base, itinerary: null }));
    expect(draft.itinerary).toBeNull();
    expect(draft.currentStep).toBe('itinerary');
    expect(draft.generation.status).toBe('idle');
  });

  it('AP-14: rien n’est inventé — totaux inconnus restent inconnus', () => {
    const draft = draftFromAcceptedPlan(buildAcceptedPlan(monthDraft()));
    expect(draft.itinerary?.totals.distanceKm).toBeNull();
    expect(draft.itinerary?.perDay).toHaveLength(30);
    expect(draft.itinerary?.perDay.every((day) => day.elevGainM === null)).toBe(true);
  });
});
