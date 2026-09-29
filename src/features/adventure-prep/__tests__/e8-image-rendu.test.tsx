/**
 * E8 - la photo RENDUE, et le cable qui l amene.
 *
 * `e8-image-etape.test.ts` pose le contrat de la DONNEE : ce que la source
 * accepte, ce qu elle refuse, comment on la memorise. Ce fichier pose le
 * contrat du RENDU et du CABLE, qui sont deux questions distinctes et
 * faiblessees distinctes :
 *
 *   - une source honnete branchee a rien ne produit aucune image, et le
 *     chantier se declare termine quand meme. C est le defaut le plus cher,
 *     parce qu il est VERT ;
 *   - une image posee dans le modele et jamais rendue laisse les gens croire
 *     que la photo existe. Ca ne se voit pas dans les tests de donnee.
 *
 * D ou le TEMOIN E8-R0 : il pose la MEME carte deux fois, une fois sans image
 * et une fois avec, et exige que les deux rendus diffèrent. Sans lui, un
 * fichier entierement vert pourrait l etre parce que le composant n affiche
 * jamais rien — ce qui est precisement le defaut qu on cherche a attraper.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdventurePrepDraft, ItineraryModel, StepImage } from '../types';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
// `vi.mock` est HOISTE au-dessus des imports : un import statique voit donc
// deja le double du store. C est ce qu on veut ici — un `require` tardif
// echouerait, et surtout contournerait le mock.
import { ItineraryStepScreen } from '../components/ItineraryStep';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

/** Une image deja verifiee, telle que `engine/stepImages` les rend. */
const IMAGE: StepImage = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1x.jpg/640px-1x.jpg',
  credit: 'Wikimedian',
  license: 'CC BY-SA 4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Refuge_du_Gouter.jpg',
};

/** Le programme de reference, avec une place nommee — donc photoable. */
function programmeAvecImage(image: StepImage | null): ItineraryModel {
  const model = buildItinerary(fullDraft());
  if (model === null) throw new Error('le brouillon de test ne construit plus de parcours');
  const cible = model.steps[0];
  if (cible === null) throw new Error('le programme de test ne porte aucune etape');
  return { ...model, steps: model.steps.map((s) => (s.id === cible.id ? { ...s, image } : s)) };
}

const racineFeature = () => join(process.cwd(), 'src', 'features', 'adventure-prep');

/** La carte d etape focalisee, et rien d autre. */
function carte(image: StepImage | null): string {
  state.current = { draft: { ...fullDraft(), itinerary: programmeAvecImage(image) } };
  return renderToStaticMarkup(
    React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }),
  );
}

describe('E8 - la photo, du modele a l ecran', () => {
  beforeEach(() => {
    state.current = null;
  });

  it('E8-R0 - TEMOIN : le harnais distingue « pas de photo » de « photo »', () => {
    const sansPhoto = carte(null);
    const avecPhoto = carte(IMAGE);

    expect(sansPhoto).not.toMatch(/<img/);
    expect(avecPhoto).toMatch(/<img/);

    // Une fixture qui n aurait rien change ne ferait pas echouer ce test. On
    // exige donc que les DEUX rendus soient reellement differents, et pas
    // seulement que l un des deux contienne une balise.
    expect(avecPhoto).not.toBe(sansPhoto);
  });

  it('E8-R1 - sans source, la carte ne rend NI image NI cadre', () => {
    const html = carte(null);
    // Pas de balise, pas de classe de photo : une carte sans photo doit etre
    // indiscernable d une carte qui n a jamais connu la photo. Ni cadre vide,
    // ni icone tenant lieu d image, ni mention « photo indisponible ».
    expect(html).not.toMatch(/<img/);
    expect(html).not.toContain('prep-step__photo');
    expect(html).not.toContain('photo indisponible');
  });

  it('E8-R2 - avec une source, la carte rend l image ET son auteur', () => {
    const html = carte(IMAGE);
    expect(html).toContain(IMAGE.url);
    // L auteur et la licence sont ecrits, en clair. Une attribution cachee
    // dans un `title` n est pas une attribution, et la licence libre n est
    // alors pas respectee.
    expect(html).toContain('Wikimedian');
    expect(html).toContain('CC BY-SA 4.0');
  });

  it('E8-R3 - le lien de source part en HTTPS et s ouvre proprement', () => {
    const html = carte(IMAGE);
    expect(html).toContain(`href="${IMAGE.sourceUrl}"`);
    // Une cible `_blank` sans `noopener` donne a la page ouverte la main sur
    // `window.opener`. C est une page tierce : on ne lui confie pas la notre.
    expect(html).toMatch(/target="_blank"[^>]*rel="noopener noreferrer"/);
  });

  it('E8-R4 - la photo ne se fait pas passer pour une icone, ni l inverse', () => {
    const html = carte(IMAGE);
    // Aucune image fabriquee : une `data:` est un dessin porte par une
    // etiquette, donc une invention, pas une source.
    expect(html).not.toMatch(/data:image/);
    // Aucune icone ne vient se placer la ou la photo est attendue — c etait
    // exactement la forme du placeholder retire, un `role="img"` en pale vert.
    // On borne la lecture a la seule figure de photo : la carte rendue contient
    // par ailleurs des icones legitimes (boutons, carte, pied de page) qui,
    // elles, sont des masques et non des photos.
    const debut = html.indexOf('<figure class="prep-step__photo"');
    const fin = html.indexOf('</figure>', debut);
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    const photo = html.slice(debut, fin);
    expect(photo).not.toContain('role="img"');
    expect(photo).not.toMatch(/mask-image|background-image/);
  });

  it('E8-R5 - le nom du lieu reste en TEXTE, et non seulement dans la photo', () => {
    const html = carte(IMAGE);
    // `alt` est vide par choix : le lieu est deja annonce juste au-dessus, et
    // le repeter ferait entendre deux fois la meme chose. Ce test verrouille
    // ce choix pour qu on ne le retourne pas en douce.
    expect(html).toMatch(/<img[^>]*alt=""/);
  });

  it('E8-R6 - le composant de photo est branche, et la carte lui passe l image', () => {
    const composant = readFileSync(
      join(racineFeature(), 'components', 'ItineraryStep.tsx'),
      'utf-8',
    );
    // Sans ce branchement, `ItineraryStep` porte bien le champ et n affiche
    // rien : le chantier serait vert et le produit muet.
    expect(composant).toContain('StepPhoto');
    expect(composant).toMatch(/step\.image\s*\?/);

    // Et le composant existe vraiment, avec son credit.
    const photo = readFileSync(join(racineFeature(), 'components', 'StepPhoto.tsx'), 'utf-8');
    expect(photo).toContain('image.credit');
    expect(photo).toContain('image.license');
    expect(photo).toContain('image.sourceUrl');
  });
});