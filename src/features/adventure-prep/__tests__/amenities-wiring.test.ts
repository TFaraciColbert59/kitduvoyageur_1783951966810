/**
 * Overpass met 5 a 25 s. Brancher l amenite directement sur la phase LIEUX
 * allongerait la generation de tout ce delai, APRES la redaction.
 *
 * Le rechauffement doit donc demarrer AVANT l appel au modele : la requete
 * court en parallele de la redaction, et la resolution des lieux la
 * consomme. Ces tests verrouillent l ORDRE, qui est tout l interet de
 * l operation, et le raccordement depuis l ecran.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runItineraryGeneration } from '../engine/itineraryPhases';
import { fullDraft } from './fixtures';

const flowPath = join(__dirname, '..', 'components', 'PrepFlow.tsx');
const flow = readFileSync(flowPath, 'utf8');

describe('AM-W — le rechauffement court AVANT la redaction', () => {
  it('AM-W1 : le rechauffement est declenche avant l appel au proposeur', async () => {
    const ordre: string[] = [];
    const controller = new AbortController();

    const outcome = await runItineraryGeneration(
      fullDraft(),
      controller.signal,
      async () => {
        ordre.push('redaction');
        return { drafted: null, failure: 'provider_indisponible' };
      },
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      () => {
        ordre.push('rechauffement');
      },
    );

    expect(outcome).toBeTruthy();
    expect(ordre).toEqual(['rechauffement', 'redaction']);
  });

  it('AM-W2 : l absence de rechauffement ne casse pas la generation', async () => {
    const controller = new AbortController();
    const outcome = await runItineraryGeneration(
      fullDraft(),
      controller.signal,
      async () => ({ drafted: null, failure: 'provider_indisponible' }),
      () => {},
    );
    expect(outcome.model).toBeTruthy();
  });

  it('AM-W3 : l ecran branche le rechauffement sur la source des amenites', () => {
    expect(flow).toContain('warmPlaces');
    expect(flow).toContain('warmAmenitiesFor');
  });
});
