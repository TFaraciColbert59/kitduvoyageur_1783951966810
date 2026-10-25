/**
 * E8 — l image d etape. RED avant implementation.
 *
 * La tuile d etape portait un horaire, une duree, un prix et des badges de
 * confiance, mais PAS de photo : `ItineraryStep` n avait aucun champ image, et
 * trois tests interdisaient explicitement toute balise `<img>`. Ce n etait donc
 * pas un rendu manque, c etait une DONNEE absente du modele.
 *
 * Ce fichier pose le contrat avant que le code existe. La doctrine du
 * preparateur est simple et non negociable : il prefere avouer plutot que
 * d inventer. Une image de lieu est une AFFIRMATION — « voici ce que vous
 * allez voir » — donc elle doit etre reelle, verifiable et attribuee. Tout le
 * reste, c est du bruit.
 *
 * Le TEMOIN de ce fichier est E8-T1 : il prouve que les gardes Aqua
 * distinguent bien « pas de photo » de « photo », et qu un simple ajustement de
 * fixture ne ferait pas passer le fichier en vert par accident.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetStepImageCache,
  fetchStepImage,
  stepImageQuery,
  type StepImage,
} from '../engine/stepImages';
import { buildItinerary, withStepImage } from '../engine/itinerary';
import type { ItineraryModel } from '../types';
import { fullDraft } from './fixtures';

/**
 * `buildItinerary` rend `null` quand le brouillon n est pas exploitable. Ici il
 * l est toujours — donc un `null` ne serait pas une information, ce serait un
 * fixture qui a cesse de convenir. On le dit plutot que de le laisser passer en
 * `any` et faire echouer le test ailleurs, sur un symptome.
 */
function build(): ItineraryModel {
  const model = buildItinerary(fullDraft());
  if (model === null) throw new Error('le brouillon de test ne construit plus de parcours');
  return model;
}

/** Une reponse Commons plausible, avec tout ce que l on attend d elle. */
function commonsAvecImage(surclasse = {}): unknown {
  return {
    query: {
      pages: {
        1: {
          pageid: 1,
          title: 'File:Refuge du Gouter.jpg',
          imageinfo: [
            {
              thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1x.jpg/640px-1x.jpg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Refuge_du_Gouter.jpg',
              extmetadata: sansVides({
                Artist: { value: 'Wikimedian' },
                LicenseShortName: { value: 'CC BY-SA 4.0' },
                ...surclasse,
              }),
            },
          ],
        },
      },
    },
  };
}

/**
 * Un spread superficiel ne SUPPRIME pas une cle, il l ecrase. Or le contrat
 * E8-03 porte sur une ABSENCE de licence, pas sur une licence differente : sans
 * cette evasion, la fixture garderait `LicenseShortName` et le test verifierait
 * autre chose que ce qu il annonce.
 */
function sansVides<T extends Record<string, unknown>>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, valeur]) => valeur !== undefined),
  ) as Partial<T>;
}

/** Un fetch qui repond `corps` une seule fois, et compte ses appels. */
function fetchQuiRepond(corps: unknown) {
  const spy = vi.fn(async () => new Response(JSON.stringify(corps), { status: 200 }));
  return { spy, signal: new AbortController().signal };
}

describe('E8 - l image d etape, posee avant de l ecrire', () => {
  beforeEach(() => {
    __resetStepImageCache();
  });

  it('E8-T1 - TEMOIN : le harnais distingue « pas de photo » de « photo »', async () => {
    // Une source qui ne repond rien ne doit RIEN produire. Si le contrat
    // acceptait une image fabriquee, ce test passerait aussi — c est donc lui
    // qui interdit de faire passer le fichier entier en vert a cote.
    const { spy, signal } = fetchQuiRepond({});
    expect(await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal })).toBeNull();

    // Le cache memorise les DEUX reponses, y compris les refus. Sans cette
    // remise a zero entre les deux sondes, la seconde relirait le `null` cache
    // et le TEMOIN ne prouverait plus rien : il passerait meme face a une
    // implementation qui ne rend jamais d image.
    __resetStepImageCache();

    const { spy: spy2, signal: signal2 } = fetchQuiRepond(commonsAvecImage());
    const trouvee = await fetchStepImage('Refuge du Gouter', { fetchImpl: spy2, signal: signal2 });
    expect(trouvee).not.toBeNull();
    expect(trouvee?.url).toMatch(/^https:\/\//);
  });

  it('E8-01 - la requete porte le NOM REEL du lieu, rien de plus', () => {
    const q = stepImageQuery('Refuge du Gouter');
    expect(q).toContain('Refuge');
    expect(q).toContain('Gouter');
    // La source est Wikimedia Commons, explicitement : une image d ailleurs
    // serait une autre base de donnees, donc une autre question de licence.
    expect(q).toContain('commons.wikimedia.org');
  });

  it('E8-02 - une image sans ATTRIBUTION est refusee : elle vaut mieux pas d image', async () => {
    const { spy, signal } = fetchQuiRepond(commonsAvecImage({ Artist: { value: '' } }));
    expect(await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal })).toBeNull();
  });

  it('E8-03 - une image sans LICENCE connue est refusee pour la meme raison', async () => {
    // `undefined` fait DISPARAITRE la cle, au lieu de l ecraser par une autre
    // licence — c est l absence que le contrat refuse, pas une licence voisine.
    const sansLicence = { Artist: { value: 'Quelqu un' }, LicenseShortName: undefined };
    const { spy, signal } = fetchQuiRepond(commonsAvecImage(sansLicence));
    expect(await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal })).toBeNull();
  });

  it('E8-04 - HTTPS obligatoire : une URL en clair ne part jamais vers un lecteur', async () => {
    const corps = commonsAvecImage();
    const enClair = JSON.parse(JSON.stringify(corps));
    enClair.query.pages[1].imageinfo[0].thumburl = 'http://upload.wikimedia.org/insecure.jpg';
    const { spy, signal } = fetchQuiRepond(enClair);
    expect(await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal })).toBeNull();
  });

  it('E8-05 - une source muete ne leve rien et ne fabrique rien', async () => {
    const spy = vi.fn(async () => {
      throw new Error('reseau');
    });
    await expect(
      fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal: new AbortController().signal }),
    ).resolves.toBeNull();
  });

  it('E8-06 - un nom vide ne part jamais sur le reseau', async () => {
    const spy = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(
      await fetchStepImage('   ', { fetchImpl: spy, signal: new AbortController().signal }),
    ).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('E8-07 - le credit et la licence voyagent AVEC l image', async () => {
    const { spy, signal } = fetchQuiRepond(commonsAvecImage());
    const image = await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal });
    const attendue: StepImage = {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1x.jpg/640px-1x.jpg',
      credit: 'Wikimedian',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Refuge_du_Gouter.jpg',
    };
    expect(image).toEqual(attendue);
  });

  it('E8-08 - le HTML de l artiste est retire : un credit est du texte, pas du markup', async () => {
    const { spy, signal } = fetchQuiRepond(
      commonsAvecImage({ Artist: { value: '<a href="//x">Wikimedian</a>' } }),
    );
    const image = await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal });
    expect(image?.credit).toBe('Wikimedian');
  });

  it('E8-09 - le cache evite la seconde requete, et se vide a la demande', async () => {
    const { spy, signal } = fetchQuiRepond(commonsAvecImage());
    const premier = await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal });
    const second = await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(second).toEqual(premier);

    __resetStepImageCache();
    await fetchStepImage('Refuge du Gouter', { fetchImpl: spy, signal });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('E8-10 - poser une image NE MUTE PAS le modele et ne repete pas le travail', () => {
    const model = build();
    const cible = model.steps[0];

    const image: StepImage = {
      url: 'https://upload.wikimedia.org/a.jpg',
      credit: 'Quelqu un',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    };
    const posee = withStepImage(model, cible.id, image);
    expect(posee).not.toBe(model);
    expect(posee.steps.find((s) => s.id === cible.id)?.image).toEqual(image);
    // Le modele d origine ne bouge pas : une image posee est un nouvel objet.
    expect(model.steps.find((s) => s.id === cible.id)?.image ?? null).toBeNull();

    // Une image deja posee n est pas ecrasee par une image moins verifiable.
    const identique = withStepImage(posee, cible.id, { ...image, credit: 'Remplace' });
    expect(identique.steps.find((s) => s.id === cible.id)?.image?.credit).toBe('Quelqu un');
  });

  it('E8-11 - un stepId inconnu ne deforme rien', () => {
    const model = build();
    expect(withStepImage(model, 'd1-introuvable', null)).toBe(model);
  });
});