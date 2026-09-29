import { describe, it, expect } from 'vitest';
import { draftActions } from '../store/reducer';
import { emptyDraft } from '../engine/emptyDraft';
import { activityById } from '../catalog';
import { briefRequestedDays } from '../engine/briefDays';
import { daysFromSuggestedHours } from '../engine/calendar';
import { validateDrafted } from '../engine/itineraryEngine';
import type { AdventurePrepDraft } from '../types';

/**
 * P0.19 — un bandeau « Échec : Vérification des étapes » pour un parcours
 * réellement généré.
 *
 * LE FAIT MESURÉ, avant toute correctif : le catalogue et le brief se
 * contredisaient sur le meme parcours, et le bandeau n'était que lemessager
 * d'une contradiction qui existait AVANT l'appel réseau.
 *
 *   - `rando-refuge` vaut `suggestedDurationHours: 24` (relevé dans
 *     `catalog.ts`), donc `daysFromSuggestedHours(24) === 1` : choisir
 *     l'activité écrivait `durationDays: 1`.
 *   - `briefRequestedDays` lit « week-end » et rend 2
 *     (`engine/briefDays.ts`).
 *   - `aiItinerary.ts:142` demandait déjà 2 jours au modele.
 *
 * Le meme parcours etait donc decrit deux fois, contradictoirement : l'écran
 * montrait 1 jour, le prompt en annoncait 2. Le garde-fou
 * `validateDrafted(..., { briefDays: 2 })` recevait un plan d'un jour et le
 * refusait — d'où un bandeau « Échec : Vérification des étapes » alors que le
 * parcours etait REELLEMENT généré. Le bandeau ne mentait pas : il annonçait
 * une contradiction dont il n'etait pas la cause.
 *
 * La règle qui coupe la contradiction : dans `setActivities` (le SEUL appelant
 * de production de `suggestDuration`), un brief qui NOMME une durée prime sur
 * les heures du catalogue. Un brief muet laisse la main au catalogue.
 *
 * Ces tests verrouillent la règle ET soninverse. Un test qui ne verifierait que
 * « 2 jours » passerait aussi avec un catalogue qui ecrirait toujours 1 jour au
 * tout premier coup ; on verrouille donc aussi que le catalogue reste à 1 jour
 * pour lui-meme, sinon la correction pourrait etre un simple écrasement du
 * catalogue — qui casserait les parcours SANS brief.
 */
describe('P0.19 — le catalogue et le brief ne se contredisent plus', () => {
  const BRIEF_WEEKEND = 'Week-end de randonnée au départ de Chamonix, refuge la première nuit';

  const avecBrief = (brief: string | null): AdventurePrepDraft => ({ ...emptyDraft(), brief });

  const choisirRandoRefuge = (draft: AdventurePrepDraft): AdventurePrepDraft =>
    draftActions.setActivities(draft, { primary: 'rando-refuge', extra: [], nights: [] });

  it('LE RELEVE : le catalogue seul vaut bien 1 jour pour un refuge', () => {
    // Ce test est le garde-fou du piege. Si quelqu'un « corrige » la
    // contradiction en changeant la valeur du catalogue, CE test passe encore
    // mais le suivant casse : le catalogue doit rester à 1 jour, parce que
    // c'est sa vraie valeur de travail (24 h).
    const activity = activityById('rando-refuge');
    expect(activity?.suggestedDurationHours).toBe(24);
    expect(daysFromSuggestedHours(activity?.suggestedDurationHours ?? null)).toBe(1);
  });

  it('avec un brief nommant une durée, la durée du brief gagne', () => {
    const next = choisirRandoRefuge(avecBrief(BRIEF_WEEKEND));
    expect(next.calendar.durationDays).toBe(2);
  });

  it('la contradiction exacte du P0.19 a disparu : brief et écran disent 2', () => {
    const next = choisirRandoRefuge(avecBrief(BRIEF_WEEKEND));
    // Ce que demandait deja l'IA, et ce que montrait le catalogue : les deux
    // doivent dire le meme nombre, sinon le bandeau peut encore apparaitre.
    const demandeParLeModele = briefRequestedDays(next.brief);
    const afficheParLEcran = next.calendar.durationDays;
    expect({ demandeParLeModele, afficheParLEcran }).toEqual({
      demandeParLeModele: 2,
      afficheParLEcran: 2,
    });
  });

  it('sans brief, le catalogue garde la main : 1 jour', () => {
    // L'inverse de la règle. Un brief muet ne doit jamais devenir « un jour »
    // par accident de parsing, mais ici on ne parse rien : le catalogue parle.
    const next = choisirRandoRefuge(avecBrief(null));
    expect(next.calendar.durationDays).toBe(1);
  });

  it('un brief muet SUR LA DUREE laisse le catalogue parler : 1 jour', () => {
    // « randonnee au depart de Chamonix » ne nomme aucune durée. Le brief
    // n'a donc rien à dire, et le catalogue doit rester audible.
    const next = choisirRandoRefuge(avecBrief('randonnée au départ de Chamonix'));
    expect(briefRequestedDays(next.brief)).toBeNull();
    expect(next.calendar.durationDays).toBe(1);
  });

  it('une durée saisie à la main reste intouchable, même avec un brief de 2 jours', () => {
    const choisi: AdventurePrepDraft = {
      ...avecBrief(BRIEF_WEEKEND),
      calendar: { ...emptyDraft().calendar, durationDays: 5, durationIsSuggested: false },
    };
    // Un fait que la personne a posé ne se renégocie pas.
    expect(choisirRandoRefuge(choisi).calendar.durationDays).toBe(5);
  });

  it('la garde du garde-fou reproduit le bandeau P0.19 quand le plan est plus court', () => {
    // Le bandeau P0.19 ne s affichait que si le garde-fou recevait un plan
    // couvrant MOINS de jours que le brief n en demandait. La regle compare
    // exactement ca : `coveredDays < briefDays`.
    //
    // 1 jour couvert, brief de 2 : refuse — c est le bandeau, et il avait
    // raison. 2 jours couverts, brief de 2 : passe.
    const unJour = {
      title: 'Randonnee refuge au Mont-Blanc',
      days: 1,
      steps: [
        {
          day: 1,
          kind: 'arret',
          title: 'Depart centre-ville Chamonix',
          placeName: 'Chamonix-Mont-Blanc',
          startTime: '08:00',
          durationMin: 120,
          reason: 'Mise en route depuis le village',
        },
      ],
      hypotheses: [],
    };
    expect(validateDrafted(unJour as never, { briefDays: 2 }).reason).toBe('brief_non_honore');
    expect(validateDrafted(unJour as never, { briefDays: 1 }).ok).toBe(true);

    const deuxJours = {
      ...unJour,
      days: 2,
      steps: [
        ...unJour.steps,
        {
          day: 2,
          kind: 'nuit',
          title: 'Nuit au refuge du Goûter',
          placeName: 'Refuge du Goûter',
          startTime: '17:00',
          durationMin: 720,
          reason: 'Nuit de refuge demandee',
        },
      ],
    };
    // Le plan que le modele rend quand il a bien recu les 2 jours : passe.
    expect(validateDrafted(deuxJours as never, { briefDays: 2 }).ok).toBe(true);
  });
});
