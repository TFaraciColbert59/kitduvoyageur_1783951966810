import { describe, expect, it } from 'vitest';
import {
  canOpenStep,
  hasEngineMinimum,
  isStepSatisfied,
  stepCountDone,
} from '../engine/steps';
import { canCreateStepOne, stepOneMissing } from '../components/stepOneProfile';
import { isBuildable } from '../engine/itinerary';
import { shouldLaunchGeneration } from '../engine/stepTransition';
import { draftActions } from '../store/reducer';
import { ARGENTIERE, CHAMONIX, fullDraft } from './fixtures';
import type { AdventurePrepDraft, PrepStepId } from '../types';
import type { StepOneProfileId } from '../components/stepOneProfile';

/**
 * D2 — UN SEUL PREDICAT pour le CTA, le rail et le clic.
 *
 * Mesure du 2026-09-28, 393x852, navigateur reel, depart propose par la
 * geolocalisation, aucune date, aucune duree :
 *
 *   AVANT — « Creer mon parcours » : `disabled` absent, ligne « L IA
 *   completera : lieu d arrivee, date, temps disponible ». Un CLAIC REEL ne
 *   changeait RIEN : meme etape, meme ligne, aucun appel /api, aucun ecran de
 *   chargement. Le bouton etait actif et mort.
 *
 * La cause n etait pas le CSS : `handleCreate` appelle `completeStep` puis
 * `goToStep`, et les deux passent par `isStepSatisfied('destination')`, qui
 * exigeait encore `durationDays > 0`. Le lot D1 avait libere le CTA sans
 * toucher cette condition — le mensonge avait change de forme, pas de place.
 *
 * Ces tests portent sur le CLIQUE, pas sur l attribut : c est lui qui etait
 * faux, et un attribut ne l aurait pas vu.
 */

const SANS_DATE_NI_DUREE = {
  startDate: null,
  startDateIsSuggested: false,
  durationDays: null,
  durationIsSuggested: false,
  returnDate: null,
} as const;

function deuxLieuxSansDateNiDuree(): AdventurePrepDraft {
  const base = fullDraft();
  return fullDraft({
    route: {
      origin: base.route.origin,
      destination: base.route.destination,
      shape: base.route.shape,
    },
    calendar: SANS_DATE_NI_DUREE,
  });
}

describe('D2 — le clic fait ce que le bouton promet', () => {
const profilsLocaux = (): readonly StepOneProfileId[] => ['trajet', 'voyage', 'sejour', 'local'];

  it('D2-01: le cas mesure avance enfin a l etape 3', () => {
    const draft = deuxLieuxSansDateNiDuree();
    const apres = draftActions.completeStep(draft, 'destination');
    // AVANT : `currentStep` restait 'destination'. Le store renvoyait le MEME
    // objet, donc ni re-rendu ni ecriture : un clic sans effet, sans erreur.
    expect(apres.currentStep).toBe('itinerary');
    expect(apres.completedSteps).toContain('destination');
  });

  it('D2-02: le rail ouvre l etape 3 dans le meme cas', () => {
    expect(canOpenStep(deuxLieuxSansDateNiDuree(), 'itinerary')).toBe(true);
  });

  it('D2-03: une seule condition decide, pour le clic ET pour la peinture', () => {
    // La relation qui rend le bug de structure : si ces trois reponses
    // divergent, un bouton ou un segment ment encore. Elle ne peut pas
    // diverger parce qu elles lisent le meme predicat.
    const d = deuxLieuxSansDateNiDuree();
    expect(hasEngineMinimum(d)).toBe(true);
    expect(isStepSatisfied(d, 'destination')).toBe(hasEngineMinimum(d));
    expect(canCreateStepOne(d)).toBe(hasEngineMinimum(d));
  });

  it('D2-04: l invariant tient sur une matrice de profils et de brouillons', () => {
    const base = fullDraft();
    const profils: readonly StepOneProfileId[] = ['trajet', 'voyage', 'sejour', 'local'];
    const brouillons: readonly [string, AdventurePrepDraft][] = [
      ['complet', base],
      ['sans date ni duree', deuxLieuxSansDateNiDuree()],
      [
        'sans depart',
        fullDraft({ route: { origin: null, destination: ARGENTIERE, shape: 'boucle' } }),
      ],
      [
        'ni activite ni liberation',
        fullDraft({ activities: { primary: null, extra: [], nights: [] } }),
      ],
      [
        'liberation sans depart',
        fullDraft({
          activities: { primary: null, extra: [], nights: [] },
          pickerDismissed: true,
          route: { origin: null, destination: null, shape: 'boucle' },
        }),
      ],
      [
        'liberation avec depart',
        fullDraft({
          activities: { primary: null, extra: [], nights: [] },
          pickerDismissed: true,
          route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
          calendar: SANS_DATE_NI_DUREE,
        }),
      ],
      [
        'sejour sans depart',
        fullDraft({ route: { origin: null, destination: ARGENTIERE, shape: 'boucle' } }),
      ],
    ];

    for (const [nom, draft] of brouillons) {
      const attendu = !!draft.route.origin && (!!draft.activities.primary || draft.pickerDismissed);
      expect(hasEngineMinimum(draft), `moteur — ${nom}`).toBe(attendu);
      expect(isStepSatisfied(draft, 'destination'), `rail — ${nom}`).toBe(attendu);
      for (const profil of profils) {
        // Le profil ne change plus le verdict : il ne change que le libelle.
        expect(canCreateStepOne(draft), `CTA ${profil} — ${nom}`).toBe(attendu);
        const annonce = stepOneMissing(draft, profil).blocking.length > 0;
        expect(annonce, `ligne ${profil} — ${nom}`).toBe(!attendu);
      }
    }
  });

  it('D2-05: aucun libelle ne manque sans dire pourquoi, et rien ne ment quand tout est complet', () => {
    const profils: readonly StepOneProfileId[] = ['trajet', 'voyage', 'sejour', 'local'];
    for (const profil of profils) {
      const vide = fullDraft({
        activities: { primary: null, extra: [], nights: [] },
        route: { origin: null, destination: null, shape: 'boucle' },
        calendar: SANS_DATE_NI_DUREE,
      });
      // Un bloqueur existe -> la ligne nomme le depart avec LE MOT de l ecran :
      // « lieu de pratique » sur une sortie locale, « lieu de depart » ailleurs.
      const bloque = stepOneMissing(vide, profil);
      expect(bloque.blocking.length, profil).toBeGreaterThan(0);
      expect(bloque.blocking, profil).toContain(
        profil === 'local' ? 'lieu de pratique' : 'lieu de départ',
      );
      // Depart present, tout le reste complet : plus rien a annoncer.
      const complet = fullDraft();
      const { blocking, optional } = stepOneMissing(complet, profil);
      expect(blocking, profil).toEqual([]);
      expect(optional, profil).toEqual([]);
    }
  });

  it('D2-06: le compteur d etapes suit la meme condition', () => {
    const d = deuxLieuxSansDateNiDuree();
    // AVANT : 0 etape satisfaite, donc le rail peignait « En avant ! » en
    // verrouille sous un bouton actif.
    expect(stepCountDone(d)).toBe(1);
    expect(stepCountDone(fullDraft())).toBe(1);
  });

  it('D2-08: le troisieme verdict existe encore — isBuildable suit le meme predicat', () => {
    // C'etait le TROISIEME endroit qui exigeait la duree. Deux patches
    // corrects l'un apres l'autre, et le bouton restait mort : la lecon est
    // qu'un invariant nomme mais non branche ne protege rien. Ce test existe
    // pour attraper le prochain `isBuildable` redefini ailleurs.
    const base = fullDraft();
    const cas: readonly AdventurePrepDraft[] = [
      base,
      deuxLieuxSansDateNiDuree(),
      fullDraft({
        route: { origin: null, destination: ARGENTIERE, shape: 'boucle' },
        calendar: SANS_DATE_NI_DUREE,
      }),
      fullDraft({
        activities: { primary: null, extra: [], nights: [] },
        calendar: SANS_DATE_NI_DUREE,
      }),
      fullDraft({
        activities: { primary: null, extra: [], nights: [] },
        pickerDismissed: true,
        route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
        calendar: SANS_DATE_NI_DUREE,
      }),
    ];
    for (const draft of cas) {
      expect(isBuildable(draft)).toBe(hasEngineMinimum(draft));
    }
  });

  it('D2-09: le cas mesure demarre vraiment la generation en arrivant sur l etape 3', () => {
    // La generation ne demarre pas au clic : elle demarre au MONTAGE de
    // l'etape 2, par `shouldLaunchGeneration`. Le bug mesure etait donc
    // double : le clic n'avancait pas, puis une fois qu'il avancait, l'ecran
    // d'etape 2 refusait de lancer quoi que ce soit.
    expect(shouldLaunchGeneration(deuxLieuxSansDateNiDuree())).toBe(true);
    // Et il refuse quand le minimum moteur manque — un ecran de generation
    // qui echouerait aussitos vaut moins que l'explication de l'etape 1.
    expect(
      shouldLaunchGeneration(
        fullDraft({ route: { origin: null, destination: ARGENTIERE, shape: 'boucle' } }),
      ),
    ).toBe(false);
  });

  it('D2-10: le refus du catalogue promet quand meme ce que l IA va faire', () => {
    // « Partir librement » : pas d'activite de catalogue, et c'est VOLONTAIRE.
    // `isMissing('activity')` renvoie alors false — la ligne ne promettait
    // donc plus rien, alors que le moteur travaille avec l'invite libre.
    const liberte = fullDraft({
      activities: { primary: null, extra: [], nights: [] },
      pickerDismissed: true,
      route: { origin: CHAMONIX, destination: null, shape: 'boucle' },
      calendar: SANS_DATE_NI_DUREE,
    });
    for (const profil of profilsLocaux()) {
      const { blocking, optional } = stepOneMissing(liberte, profil);
      expect(blocking, profil).toEqual([]);
      // La ligne doit nommer ce que l'IA prend en charge, sinon l'ecran
      // passe de « il manque : … » a un silence total.
      expect(optional.join(' '), profil).toContain('activité');
    }
    // Avec une vraie activite et rien d'autre, la ligne reste muette.
    const complet = fullDraft();
    expect(stepOneMissing(complet, 'trajet').optional).toEqual([]);
  });

  it('D2-07: le refus reste un refus quand le depart manque', () => {
    const sansDepart = fullDraft({
      route: { origin: null, destination: ARGENTIERE, shape: 'boucle' },
    });
    expect(canCreateStepOne(sansDepart)).toBe(false);
    // Renvoie le MEME objet : ni re-rendu ni autosave pour un clic refuse.
    expect(draftActions.completeStep(sansDepart, 'destination')).toBe(sansDepart);
    expect(draftActions.goToStep(sansDepart, 'itinerary')).toBe(sansDepart);
  });
});
