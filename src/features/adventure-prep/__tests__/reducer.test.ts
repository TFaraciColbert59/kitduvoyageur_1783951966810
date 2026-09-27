import { describe, expect, it } from 'vitest';
import { draftActions } from '../store/reducer';
import { buildItinerary } from '../engine/itinerary';
import { emptyDraft } from '../engine/emptyDraft';
import { fullDraft } from './fixtures';

describe('brouillon autosave', () => {
  it('remonte a chaque mutation pour la reprise', () => {
    const base = emptyDraft();
    const next = draftActions.setGroup(base, { ...base.group, adults: 3 });
    expect(next.version).toBe(base.version + 1);
    expect(base.group.adults).toBe(1);
  });

  it('horodate a la premiere mutation, jamais a la construction', () => {
    expect(emptyDraft().updatedAt).toBeNull();
    expect(draftActions.setGroup(emptyDraft(), emptyDraft().group).updatedAt).toBeTypeOf('number');
  });

  it('jette le parcours quand l\'destination ou le calendrier change', () => {
    const draft = fullDraft();
    const withModel = draftActions.setItinerary(draft, buildItinerary(draft));
    expect(withModel.itinerary).not.toBeNull();
    const changed = draftActions.setCalendar(withModel, { ...withModel.calendar, durationDays: 5 });
    expect(changed.itinerary).toBeNull();
  });

  it('ajoute une etape sans muter le modele', () => {
    const draft = draftActions.setItinerary(fullDraft(), buildItinerary(fullDraft()));
    const before = JSON.stringify(draft.itinerary);
    const next = draftActions.addItineraryStep(draft, 1, 'arret', { title: 'Pause' });
    expect(JSON.stringify(draft.itinerary)).toBe(before);
    expect(next.itinerary?.steps).toHaveLength((draft.itinerary?.steps.length ?? 0) + 1);
  });

  it('coche un objet et le retire de la liste des manques', () => {
    const draft = draftActions.setItinerary(fullDraft(), buildItinerary(fullDraft()));
    const withGear = draftActions.refreshGear(draft);
    const cible = withGear.gear[0];
    expect(cible.packed).toBe(false);
    const packed = draftActions.setPacked(withGear, cible.id, true);
    expect(packed.packedGearIds).toContain(cible.id);
    expect(packed.gear.find((item) => item.id === cible.id)?.packed).toBe(true);
  });

  it('conserve poids et proprietaire quand l\'equipement est recalcule', () => {
    const draft = draftActions.setItinerary(fullDraft(), buildItinerary(fullDraft()));
    let withGear = draftActions.refreshGear(draft);
    const cible = withGear.gear[0].id;
    withGear = draftActions.setGearWeight(withGear, cible, 850);
    withGear = draftActions.assignGear(withGear, cible, 'membre-1');
    const again = draftActions.refreshGear(withGear);
    const item = again.gear.find((entry) => entry.id === cible);
    expect(item?.weightGrams).toBe(850);
    expect(item?.ownerId).toBe('membre-1');
    expect(item?.packed).toBe(false);
  });

  it('avance d\'une etape et n\'ajoute pas de doublon', () => {
    const draft = fullDraft();
    const once = draftActions.completeStep(draft, 'destination');
    const twice = draftActions.completeStep(once, 'destination');
    expect(twice.completedSteps.filter((id) => id === 'destination')).toHaveLength(1);
    expect(twice.currentStep).toBe('itinerary');
  });

  it('ignore les actions de parcours quand aucun parcours n\'existe', () => {
    const draft = fullDraft({ itinerary: null });
    const version = draft.version;
    expect(draftActions.addItineraryStep(draft, 1, 'arret', { title: 'x' })).toBe(draft);
    expect(draftActions.applyAdjustment(draft, 'moins_cher')).toBe(draft);
    expect(draft.version).toBe(version);
  });
});
