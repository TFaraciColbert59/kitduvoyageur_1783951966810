'use client';

import React from 'react';

/**
 * Aperçu de ce qui sera publié, sur la dernière étape : image, nom, repères.
 * Rien n'est inventé : chaque ligne vient de la saisie.
 */
export function PreviewCard({
  kicker,
  title,
  meta,
  text,
  image,
  round = false,
}: {
  kicker: string;
  title: string;
  meta: Array<string | null | false | undefined>;
  text?: string;
  image?: string | null;
  round?: boolean;
}) {
  const lines = meta.filter((line): line is string => Boolean(line && line.trim()));
  return (
    <figure className="lkdv-wz-preview" data-round={round ? 'true' : 'false'} aria-label="Aperçu">
      <div className="lkdv-wz-preview-media" aria-hidden="true">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
          <img src={image} alt="" />
        ) : (
          <span>{(title.trim()[0] ?? '?').toUpperCase()}</span>
        )}
      </div>
      <figcaption>
        <small>{kicker}</small>
        <b>{title.trim() || 'Sans titre'}</b>
        {lines.length > 0 ? <span>{lines.join(' · ')}</span> : null}
        {text?.trim() ? <p>{text.trim()}</p> : null}
      </figcaption>
    </figure>
  );
}

export default PreviewCard;
