/**
 * E11 — la suppression d une etape : elle part vraiment du modele, et elle
 * declenche le remesurage quand — et seulement quand — l objet du parcours a
 * change.
 *
 * Le constat qui a ouvert cet item : `dropStep` etait cable partout (le bouton
 * du tiroir d etape l appelle) et teste nulle part. Les quatre suites qui
 * le touchaient le stubaient toutes par `vi.fn()` : le vrai travail — filtrer
 * le modele, renumeroter la journee, decider s il faut remesurer — n avait
 * jamais tourne en test.
 *
 * Ce que ces tests verrouillent :
 *
 *   - l etape demandee disparait, les autres restent, la journee se renumerote ;
 *   - le modele d avant n est PAS modifie sur place (les valeurs derivees
 *    lisibles doivent rester celles de l instant d avant) ;
 *   - le remesurage part avec le bon motif ;
 *   - SANS itineraire, rien n explose et surtout RIEN ne se remesure : on ne
 *     paie pas un aller-retour reseau pour decrire un parcours qui n existe pas ;
 *   - le motif du remesurage est fixe, donc un test ne peut pas passer par
 *     hasard en portant un autre appel.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildItinerary, removeStep } from '../engine/itinerary';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

function programme(): ItineraryModel {
  const model = buildItinerary(fullDraft());
  // `buildItinerary` peut ne rien produire si le cahier des charges est
  // incomplet : ici il ne l est pas, donc un modele est attendu.
  if (model === null) throw new Error('le programme doit se construire');
  return model;
}

function store() {
  return useAdventurePrepStore.getState();
}

function poserItineraire(model: ItineraryModel) {
  useAdventurePrepStore.setState({ draft: { ...fullDraft(), itinerary: model } });
}

function etapes(model: ItineraryModel) {
  return model.steps.map((step) => step.id);
}

describe('E11 — supprimer une etape agit sur le modele et sur le remesurage', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().startNewAdventure();
  });

  it('E11-01: l etape demandee disparait, les autres restent en place', async () => {
    const model = programme();
    const cible = model.steps[2];
    if (!cible) throw new Error('le programme doit avoir des etapes');
    poserItineraire(model);

    await store().dropStep(cible.id);

    const apres = store().draft.itinerary;
    if (!apres) throw new Error('le parcours doit toujours etre la');
    expect(etapes(apres)).not.toContain(cible.id);
    expect(apres.steps).toHaveLength(model.steps.length - 1);
    // Les etapes voisines ont survive, et dans le meme ordre : on ne touche
    // qu a la ligne demandee.
    expect(etapes(apres)).toEqual(etapes(model).filter((id) => id !== cible.id));
  });

  it('E11-02: la journee se renumerote apres le retrait', async () => {
    const model = programme();
    const cible = model.steps[1];
    if (!cible) throw new Error('le programme doit avoir des etapes');
    poserItineraire(model);

    await store().dropStep(cible.id);

    const apres = store().draft.itinerary;
    if (!apres) throw new Error('le parcours doit toujours etre la');
    // On ne laisse pas de trou dans la numerotation d une journee : c est
    // l ordre que la carte et les tiroirs lisent.
    for (const jour of new Set(apres.steps.map((step) => step.day))) {
      const ordres = apres.steps
        .filter((step) => step.day === jour)
        .map((step) => step.order);
      expect(ordres).toEqual(ordres.map((_, index) => index));
    }
  });

  it('E11-03: le modele d avant reste intact (pas de mutation)', async () => {
    const model = programme();
    const avantIds = etapes(model);
    const avantRef = model;
    poserItineraire(model);

    await store().dropStep(model.steps[0]?.id ?? '');

    // L objet d avant n a pas ete reecrit : si le store avait mute en place,
    // ces deux lectures verraient le retrait. C est la regle du projet
    // (immuabilite) et la condition pour que la comparaison d identite du
    // remesurage ait un sens.
    expect(etapes(avantRef)).toEqual(avantIds);
    expect(store().draft.itinerary).not.toBe(avantRef);
  });

  it('E11-04: le remesurage part, avec le motif de la suppression', async () => {
    const model = programme();
    poserItineraire(model);
    const remeasure = vi.fn(async () => undefined);
    useAdventurePrepStore.setState({ remeasure });

    await store().dropStep(model.steps[0]?.id ?? '');

    // Le motif n est pas decoratif : c est lui qui dit au reste du produit
    // POURQUOI on redemande des distances.
    expect(remeasure).toHaveBeenCalledTimes(1);
    expect(remeasure).toHaveBeenCalledWith('suppression-etape');
  });

  it('E11-05: sans itineraire, rien n explose et RIEN ne se remesure', async () => {
    // Le tiroir peut s ouvrir sur un brouillon dont la generation n a pas
    // encore depose de parcours.
    useAdventurePrepStore.setState({ draft: { ...fullDraft(), itinerary: null } });
    const remeasure = vi.fn(async () => undefined);
    useAdventurePrepStore.setState({ remeasure });

    await store().dropStep('etape-quinexiste');

    // On ne paie pas un aller-retour reseau pour decrire un parcours qui
    // n existe pas : c est exactement ce que la garde d identite protege.
    expect(remeasure).not.toHaveBeenCalled();
    expect(store().draft.itinerary).toBeNull();
  });

  it('E11-06: un identifiant inconnu ne corrompt pas le parcours', async () => {
    const model = programme();
    poserItineraire(model);
    const remeasure = vi.fn(async () => undefined);
    useAdventurePrepStore.setState({ remeasure });

    await store().dropStep('etape-quinexiste');

    const apres = store().draft.itinerary;
    if (!apres) throw new Error('le parcours doit toujours etre la');
    // Aucune etape n disparait, et surtout AUCUNE n est ajoutee : on ne
    // fabrique pas un trou en oubliant de retirer l element demande.
    expect(etapes(apres)).toEqual(etapes(model));
    expect(apres.steps).toHaveLength(model.steps.length);
  });
});

describe('E11 — le moteur seul, sans passer par le store', () => {
  it('E11-07: `removeStep` renvoie un NOUVEAU modele', () => {
    const model = programme();
    const cible = model.steps[0];
    if (!cible) throw new Error('le programme doit avoir des etapes');

    const apres = removeStep(model, cible.id);

    // Le store compare les identites pour deciding si un remesurage est
    // justifie. Cette comparaison n a de sens que si le moteur rend bien un
    // objet neuf quand il agit : c est ce test qui le verrouille.
    expect(apres).not.toBe(model);
    expect(model.steps).toHaveLength(apres.steps.length + 1);
  });
});