'use client';

import { useState } from 'react';
import type { StepImage } from '../types';

export interface StepPhotoProps {
  /** L image, deja verifiee : HTTPS, auteur, licence et page de source. */
  readonly image: StepImage;
  /** Le lieu affiche juste au-dessus, quand la source en a rendu un. */
  readonly placeName: string | null;
  /** Le titre de l etape, dernier recours pour nommer ce qu on montre. */
  readonly title: string;
}

/** Les classes de `.prep-step` visent du texte de bloc : on leve le inline. */
const AS_BLOCK = { display: 'block' } as const;

/**
 * La photo d une etape, avec son credit, ou RIEN du tout.
 *
 * Trois decisions, toutes dictees par le meme principe : une image de lieu est
 * une affirmation, donc elle se montre entiere ou pas du tout.
 *
 * 1. LE CREDIT EST VISIBLE, jamais un attribut. `credit`, `license` et le lien
 *    vers la page de source sont ecrits sous la photo, en clair. Une attribution
 *    cachee dans un `title` ou un `alt` n en est pas une : personne ne la lit,
 *    et la licence libre n est alors pas respectee. Le preparateur a retire une
 *    promesse « hors ligne » qu il ne tenait pas ; il n oubliera pas celle-ci,
 *    qui est une obligation legale et pas un agrement.
 *
 * 2. `alt` EST VIDE, deliberement. Le nom du lieu est deja affiche juste au
 *    dessus, en texte. Le repeter en `alt` ferait entendre deux fois la meme
 *    chose a un lecteur d ecran ; ce que la photo apporte de propre, son
 *    credit, passe par le `figcaption`, qui se lui, se lit.
 *
 * 3. UNE IMAGE CASSEE DISPARAIT. Le fichier peut avoir disparu de la source
 *    depuis la reponse, ou le reseau peut le refuser. Un cadre vide promettrait
 *    une photo absente : exactement le mensonge que les garde-fous E8-02 et
 *    E8-03 interdisaient tant que la source n etait pas reelle. Une fois l
 *    erreur constatee, on ne rend plus rien, pas de cadre et pas d icone de
 *    remplacement.
 *
 * L absence d image, elle, ne se signale pas : une etape sans photo porte
 * exactement le meme texte qu avant. Il n y a pas de reserve a afficher, parce
 * qu il n y a rien a dire, on ne sait pas ce qu il y a la.
 */
export function StepPhoto({ image, placeName, title }: StepPhotoProps) {
  const [sourceInjoignable, setSourceInjoignable] = useState(false);

  // Un fichier absent de la source ne se remplace pas : il disparait.
  if (sourceInjoignable) return null;

  return (
    <figure className="prep-step__photo" style={AS_BLOCK}>
      <img
        className="prep-step__photo-img"
        src={image.url}
        alt=""
        loading="lazy"
        decoding="async"
        width={640}
        height={480}
        onError={() => setSourceInjoignable(true)}
      />
      <figcaption className="prep-step__photo-credit" style={AS_BLOCK}>
        <span>{placeName ?? title}</span>
        {' - '}
        <span>{image.credit}</span>
        {' - '}
        <span>{image.license}</span>
        {' - '}
        <a
          className="prep-step__photo-source"
          href={image.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          source
        </a>
      </figcaption>
    </figure>
  );
}