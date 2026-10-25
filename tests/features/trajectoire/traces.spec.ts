/**
 * T3 - Le gate de sortie, verifie sur les traces REELLEMENT LIVREES.
 *
 * `seeds.spec.ts` verifie deja le gate sur des fixtures construites par
 * `buildTraceSeeds`. Ces fixtures prouvent que le moteur sait produire une
 * graine a ton echelle ; elles ne prouvent pas que la page en affiche une.
 *
 * C'etait exactement l'ecart qui a laisse passer le bug : `DEMO_TRACES` ne
 * contenait aucune graine dans la bande journee (3-12 h). Comme le badge exige
 * la MEME zone que la position courante, la journee ne pouvait structurellement
 * jamais afficher de match - le gate « 1 trace a ton echelle sur 3 zones »
 * tenait en domaine et echouait a l'ecran.
 *
 * Ce fichier ferme la boucle sur les donnees livrees, parce que c'est la
 * seule que l'utilisateur voit.
 */

import { describe, expect, it } from 'vitest';

import {
  hoursFromT,
  tAtZoneMiddle,
  zoneForHours,
  ZONES,
  type TrajectoireZone,
} from '@/features/trajectoire/domain/scaleAxis';
import {
  AT_SCALE_THRESHOLD,
  countAtYourScale,
  DEMO_TRACES,
  matchTraces,
} from '@/features/trajectoire/domain/traces';

/** Les trois zones representatives exigees par le gate du dossier. */
const GATE_ZONES: readonly TrajectoireZone[] = ['journee', 'raid', 'expedition'];

describe('T3 - gate de sortie sur les traces livrees', () => {
  it('GATE T3 : au moins 1 trace "a ton echelle" sur journee, raid et expedition', () => {
    for (const zone of GATE_ZONES) {
      const hours = hoursFromT(tAtZoneMiddle(zone));
      const matches = matchTraces(DEMO_TRACES, { hours, zone });

      expect({ zone, atYourScale: countAtYourScale(matches) }).toEqual({
        zone,
        atYourScale: expect.any(Number),
      });
      expect(countAtYourScale(matches)).toBeGreaterThanOrEqual(1);
    }
  });

  it('la bande journee est couverte sur TOUTE sa largeur, pas seulement au milieu', () => {
    // La regression du badge : une graine qui ne marche qu'au milieu de la
    // zone laisserait un trou de 3 h a 6 h ou de 9 h a 12 h. On balaie donc la
    // bande entiere, pas un point.
    for (let hours = 3; hours <= 12; hours += 0.5) {
      const matches = matchTraces(DEMO_TRACES, { hours, zone: 'journee' });
      expect(countAtYourScale(matches)).toBeGreaterThanOrEqual(1);
    }
  });

  it('chaque zone de l axe porte au moins une graine de sa propre bande', () => {
    // Le gate du dossier demande 3 zones ; le produit, lui, propose 5 puces.
    // Une zone sans graine afficherait un badge « 0 a ton echelle » : pas un
    // echec bruyant, juste une carte qui ne sert a rien.
    for (const def of ZONES) {
      const hours = hoursFromT(tAtZoneMiddle(def.id));
      const matches = matchTraces(DEMO_TRACES, { hours, zone: def.id });

      expect({ zone: def.id, atYourScale: countAtYourScale(matches) }).toEqual({
        zone: def.id,
        atYourScale: expect.any(Number),
      });
      expect(countAtYourScale(matches)).toBeGreaterThanOrEqual(1);
    }
  });

  it('la zone saisie d une graine livree ne contredit jamais ses heures', () => {
    // `zone` est tape a la main dans DEMO_TRACES, alors que buildTraceSeeds la
    // derive. C est donc le seul endroit ou les deux peuvent diverger - et le
    // badge compare les zones, donc une faute ici etait silencieuse.
    for (const seed of DEMO_TRACES) {
      expect({ id: seed.id, zone: seed.zone }).toEqual({
        id: seed.id,
        zone: zoneForHours(seed.hours).id,
      });
    }
  });

  it('le badge ne peut pas etre accorde par la seule proximity : la zone compte', () => {
    // Une trace tres proche en heures mais dans une autre zone ne doit pas
    // etre badgee. C est ce qui rend le badge informatif au lieu d'ornemental.
    const journeeSeed = DEMO_TRACES.find((seed) => seed.zone === 'journee');
    expect(journeeSeed).toBeDefined();

    const hours = hoursFromT(tAtZoneMiddle('journee'));
    const depuisRaid = matchTraces(DEMO_TRACES, { hours, zone: 'raid' });
    const forgees = depuisRaid.filter(
      (match) => match.hours === journeeSeed?.hours && match.atYourScale
    );
    expect(forgees).toEqual([]);

    // Et la trace de journee est bien au-dessus du seuil a cette position.
    const match = matchTraces(DEMO_TRACES, { hours, zone: 'journee' }).find(
      (entry) => entry.id === journeeSeed?.id
    );
    expect(match?.scaleMatch).toBeGreaterThanOrEqual(AT_SCALE_THRESHOLD);
  });
});
