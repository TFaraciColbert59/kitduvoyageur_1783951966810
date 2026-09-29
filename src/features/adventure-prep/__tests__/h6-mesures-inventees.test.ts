/**
 * H6 — AUCUNE valeur inventee sur une MESURE, dans tout le perimetre du moteur.
 *
 * `h6-zero-fallback.test.ts` verifie les trois valeurs nommees par la
 * checklist (`?? 18`, `tempC: 14`, `?? 0`). Ce fichier couvre ce qui
 * restait hors de ce trio, et il elargit la REGLE au lieu d'ajouter des
 * cas :
 *
 *   1. une amplitude ne se deduit pas d'un point. C'est le defaut trouve en
 *      Measures `H6-4a` ci-dessous, et il etait invisible parce qu'aucun
 *      ecran ne consomme encore `weatherSummary` : un contrat non affiche
 *      continue de fabriquer un nombre ;
 *   2. le balayage porte sur TOUS les fichiers du moteur et sur les deux
 *      moteurs de profil, pas sur trois noms ecrits a la main. Une valeur
 *      inventee qui apparait dans un fichier nouveau fait donc rouge
 *      immediatement, sans qu personne ait a penser a ajouter un test.
 *
 * Regle de fer, rappelee parce qu elle est plus large qu elle n en a l'air :
 * un repli CHIFFRE pose sur une MESURE est un mensonge qui ressemble a une
 * mesure. Un repli pose sur un COMPTEUR (nombre de jours, indice de boucle)
 * n en est pas un : sans nombre de jours il n y a pas de modele du tout.
 * Les tests M-09 et `aiItinerary.ts` relevent de la deuxieme famille.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { resolveDeparturePlan, type DepartureHikeContext } from '@/lib/preparation/SmartDepartureEngine';

const srcDir = join(__dirname, '..', '..', '..');
const engineDir = join(srcDir, 'features', 'adventure-prep', 'engine');

/** Les fichiers de moteur que la regle doit surveiller. */
function engineSources(): Array<{ file: string; source: string }> {
  return readdirSync(engineDir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({
      file: name,
      source: readFileSync(join(engineDir, name), 'utf8'),
    }));
}

function dryContext(overrides: Partial<DepartureHikeContext> = {}): DepartureHikeContext {
  return { id: 'h1', name: 'Sortie test', distanceKm: 10, durationHours: 4, ...overrides };
}

function meteo(tempC: number): NonNullable<DepartureHikeContext['weather']> {
  return {
    tempC,
    condition: 'Mesure',
    windKmH: 10,
    precipitationProbability: 0,
    isAlert: false,
    fetchedAt: '2026-09-29T07:00:00.000Z',
  };
}

describe('H6-4 — une amplitude ne se deduit JAMAIS d un point mesure', () => {
  it('H6-4a : une temperature reelle donne la temperature, pas une fourchette', () => {
    const plan = resolveDeparturePlan(dryContext({ weather: meteo(14) }), [], []);
    expect(plan.weatherSummary.measured).toBe(true);
    // Ce que le moteur sait : 14 degres, a cet instant. Ce qu il ne sait
    // pas : l amplitude de la journee. L ancienne version sortait
    // « 11 °C — 16 °C », c est a dire `tempC - 3` et `tempC + 2`.
    expect(plan.weatherSummary.tempC).toBe(14);
  });

  it('H6-4b : aucune fourchette n est deduite, meme avec une mesure pleine', () => {
    const plan = resolveDeparturePlan(dryContext({ weather: meteo(14) }), [], []);
    expect(plan.weatherSummary.tempMinMax).toBeNull();
  });

  it('H6-4c : sans mesure, la temperature reste absente elle aussi', () => {
    const plan = resolveDeparturePlan(dryContext(), [], []);
    expect(plan.weatherSummary.tempC).toBeNull();
    expect(plan.weatherSummary.tempMinMax).toBeNull();
  });

  it('H6-4d : le code ne contient plus de decalage fige autour d une temperature', () => {
    // Le motif est ecrit pour ne pas exister dans un commentaire : il nomme
    // `Math.round(temp …`, ce qu aucun texte ne fait. Un garde-fou qui
    // pourrait etre neutralise par un commentaire n en est pas un.
    const source = readFileSync(
      join(srcDir, 'lib', 'preparation', 'SmartDepartureEngine.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/Math\.round\(\s*temp\s*[-+]/);
    expect(source).not.toMatch(/temp\s*[-+]\s*\d/);
  });
});

describe('H6-5 — balayage du perimetre, pas liste de noms', () => {
  it('H6-5a : aucun repli CHIFFRE sur un nom de mesure, dans tout le moteur', () => {
    // Le nom de mesure est exige a gauche du `??` : c est ce qui distingue
    // un repli sur une MESURE d un repli sur un compteur ou un defaut de
    // configuration. La liste est fermee pour qu un nom nouveau ne passe
    // pas sous le radar.
    const noms =
      'tempC|tMinC|tMaxC|windKmH|windKmh|precipitationProbability|precipMm|precipPct|uvIndex|elevationGain|elevationLoss|gainM|lossM|distanceKm|durationMin|price|weightG|weightGrams|altitudeM';
    const interdit = new RegExp(
      '(' + noms + ')\\??\\.\\??\\s*\\?\\?\\s*-?\\d',
      'gs',
    );
    const coupables = engineSources()
      .filter((entry) => interdit.test(entry.source))
      .map((entry) => entry.file);
    expect(coupables, 'repli chiffre sur une mesure dans : ' + coupables.join(', ')).toEqual([]);
  });

  it('H6-5b : les deux moteurs de profil sont dans le meme balayage', () => {
    const nommes = [
      'tempC',
      'windKmH',
      'precipitationProbability',
      'uvIndex',
      'elevationGain',
      'weightG',
    ];
    const fichiers = [
      join(srcDir, 'lib', 'preparation', 'SmartDepartureEngine.ts'),
      join(srcDir, 'lib', 'preparation', 'plannedHikes.ts'),
    ];
    for (const fichier of fichiers) {
      const source = readFileSync(fichier, 'utf8');
      for (const nom of nommes) {
        const motif = new RegExp(nom + '\\s*\\?\\?\\s*-?\\d', 'gs');
        expect(motif.test(source), fichier + ' : ' + nom + ' a un repli chiffre').toBe(false);
      }
    }
  });

  it('H6-5c : le balayage voit vraiment les fichiers (garde-fou du garde-fou)', () => {
    // Un `engine/` vide, ou un motif casse par une edition, ferait passer
    // H6-5a par automatisme. Ce test echoue des que le perimetre surveille
    // disparait — c est lui qui donne leur valeur aux autres.
    const fichiers = engineSources().map((entry) => entry.file);
    expect(fichiers.length).toBeGreaterThan(10);
    expect(fichiers).toContain('measurements.ts');
    expect(fichiers).toContain('provenance.ts');
  });
});
