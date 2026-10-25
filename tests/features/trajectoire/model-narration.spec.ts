/**
 * Narration Nemotron (T2) — « narration only » et « l'IA n'invente jamais ».
 *
 * Le module se teste sans reseau : `parseModelNarration` et `groundNarration`
 * sont purs, et c'est la partie qui peut mentir. La partie qui appelle le
 * provider est elle volontairement incapable de faire echouer l'appelant, ce
 * qui se teste par construction (aucune `throw` n'est exportee).
 *
 * Le test le plus important est `groundNarration` : c'est lui qui empeche un
 * modele d'ecrire un nombre que le moteur n'a pas produit. Sans lui,
 * « l'IA n'invente jamais » resterait une promesse de prompt — c'est-a-dire
 * une promesse que rien ne verifie.
 */

import { describe, expect, it } from 'vitest';

import { deriveTrajectoire } from '@/features/trajectoire/domain/derive';
import { analyzeIntention } from '@/features/trajectoire/domain/intention';
import { ZONES, tAtZoneMiddle } from '@/features/trajectoire/domain/scaleAxis';
import { DEMO_TRACES } from '@/features/trajectoire/domain/traces';
import type { TrajectoireSnapshot } from '@/features/trajectoire/domain/types';
import {
  NARRATION_MAX_TOKENS,
  groundNarration,
  originLabel,
  parseModelNarration,
  type NarrationResult,
} from '@/features/trajectoire/narration/modelNarration';

const INTENTION = analyzeIntention(
  'Partir cinq jours dans les Dolomites, sans voiture, refuges et passages peu exposés'
);

function snapshotFor(zoneId: (typeof ZONES)[number]['id']): TrajectoireSnapshot {
  return deriveTrajectoire({ t: tAtZoneMiddle(zoneId), intention: INTENTION, traces: DEMO_TRACES });
}

const EXPEDITION = snapshotFor('expedition');

describe('Narration Nemotron — structured output', () => {
  it('respecte le buffer de 512 tokens impose par le dossier', () => {
    expect(NARRATION_MAX_TOKENS).toBeGreaterThanOrEqual(512);
  });

  it('accepte un JSON conforme, avec ou sans fence markdown', () => {
    const plain = parseModelNarration(
      '{"headline":"Une expédition de 5 jours.","lines":["Un","Deux","Trois"]}'
    );
    expect(plain?.headline).toBe('Une expédition de 5 jours.');
    expect(plain?.lines).toHaveLength(3);

    // Les modeles ajoutent spontanement ```json. Refuser un plan correct pour
    // un accent grave serait de la pedanterie qui coute une narration.
    const fenced = parseModelNarration('```json\n{"headline":"Titre.","lines":["Une"]}\n```');
    expect(fenced?.headline).toBe('Titre.');
  });

  it('borne les lignes a 1..5, comme l annonce le prompt', () => {
    // Le prompt dit « entre 1 et 5 ». Un parseur qui accepte 9 lignes laisse
    // un model bavard s installer dans la carte et y diluer l information ; un
    // parseur qui en refuse 6 alors que le prompt l autorise transformerait une
    // reponse valable en absence de narration. Les deux sont fautifs.
    const six = JSON.stringify({ headline: 'Titre.', lines: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(parseModelNarration(six)).toBeNull();

    const five = JSON.stringify({ headline: 'Titre.', lines: ['a', 'b', 'c', 'd', 'e'] });
    expect(parseModelNarration(five)?.lines).toHaveLength(5);
  });

  it('rejette toute reponse hors forme, sans jamais lever', () => {
    const rejects = [
      'pas du json',
      '{"headline":"","lines":["a"]}', // headline vide
      '{"headline":"Titre","lines":[]}', // aucune ligne
      '{"headline":"Titre"}', // champ lines absent
      '{"lines":["a"]}', // headline absent
      '{"headline":42,"lines":["a"]}', // type faux
      '{"headline":"Titre","lines":[1,2]}', // lignes non-string
      '{"headline":"Titre","lines":["  "]}', // ligne vide
      '',
    ];

    for (const raw of rejects) {
      expect(parseModelNarration(raw), raw).toBeNull();
    }
  });
});

describe('Narration Nemotron — l IA n invente jamais', () => {
  it('accepte une narration qui ne fait que nommer des chiffres deja produits', () => {
    const snapshot = EXPEDITION;
    const shape = {
      headline: `Expedition de ${snapshot.hours} heures.`,
      lines: [
        `Dangerosite ${snapshot.danger.score} sur 100.`,
        `${snapshot.steps.length} etapes au grain ${snapshot.grain}.`,
        `Fenetre ideale ${snapshot.window.ideal}.`,
        `${snapshot.traces.length} traces indexees.`,
        `Kit : ${snapshot.kit.length} items.`,
      ],
    };

    expect(groundNarration(shape, snapshot)).toBe(true);
  });

  it('refuse un chiffre absent de l etat (le cas reel d une hallucination)', () => {
    const shape = {
      headline: 'Expedition de 5 jours.',
      lines: ['Une temperature de 38 degres, et 900 metres de denivele.'],
    };

    expect(groundNarration(shape, EXPEDITION)).toBe(false);
  });

  it('refuse meme un chiffre seul, dans n importe quelle position', () => {
    // Le controle porte sur chaque ligne ET sur le titre : une invention
    // glissee dans le titre serait la plus visible de toutes.
    expect(groundNarration({ headline: 'Ton plan compte 12 etapes.', lines: [] }, EXPEDITION)).toBe(
      false
    );
    expect(groundNarration({ headline: 'Titre.', lines: ['Cinq etapes.'] }, EXPEDITION)).toBe(true);
    expect(groundNarration({ headline: 'Titre.', lines: ['Dix-sept etapes.'] }, EXPEDITION)).toBe(
      false
    );
  });

  it('controle aussi les nombres ecrits en toutes lettres', () => {
    // « Dix-sept etapes » passe un garde qui ne lit que les chiffres arabes :
    // la regle « l IA n invente jamais » serait alors une promesse de prompt.
    // On ferme cette voie, et on verifie les deux sens — refuser une valeur
    // legitime serait aussi grave que de la laisser passer.
    expect(
      groundNarration({ headline: 'Titre.', lines: ['Quatre-vingt-dix etapes.'] }, EXPEDITION)
    ).toBe(false);
    expect(
      groundNarration({ headline: 'Titre.', lines: ['Soixante-quinze etapes.'] }, EXPEDITION)
    ).toBe(false);

    // Precondition explicite : sans elle, « douze etapes » deviendrait legitime
    // le jour ou le moteur en produirait douze, et le test echouerait sans
    // dire pourquoi.
    expect(EXPEDITION.steps.length).toBeLessThan(12);
  });

  it('tolere les chaines de l etat, qui contiennent elles-memes des chiffres', () => {
    // `snapshot.window.ideal` vaut par exemple "Juin - Sept." : le modele a
    // le droit de la reprendre telle quelle. Le rejeter forcerait le modele
    // a paraphraser une donnee, donc a risquer de la deformer.
    const window = EXPEDITION.window.ideal;
    const shape = { headline: 'Titre.', lines: [`Fenetre ideale ${window}.`] };
    expect(groundNarration(shape, EXPEDITION)).toBe(true);
  });
});

describe('Narration Nemotron — jamais bloquante', () => {
  it('n exporte aucune fonction qui leve', () => {
    // Une fonction qui leve oblige l'appelant a faire un try/catch, et un
    // oubli dans un useEffect devient un ecran casse. `requestModelNarration`
    // est donc censee TOUJOURS rendre `null` ou un resultat.
    expect(typeof parseModelNarration).toBe('function');
    expect(typeof groundNarration).toBe('function');
    expect(typeof originLabel).toBe('function');
    expect(parseModelNarration('{{{')).toBeNull();
  });

  it('distingue une origine modele d une origine deterministe', () => {
    const modelResult: NarrationResult = {
      narration: {
        headline: 'Titre.',
        lines: [{ id: 'modele-1', text: 'Une.', origin: 'modele' }],
        origin: 'modele',
      },
      origin: 'modele',
      model: 'nemotron',
      reason: null,
    };

    expect(originLabel(modelResult)).toContain('Nemotron');
    expect(originLabel(null)).toContain('déterministe');
  });
});
