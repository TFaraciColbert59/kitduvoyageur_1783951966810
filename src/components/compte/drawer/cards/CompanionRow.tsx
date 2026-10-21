'use client';

import React from 'react';
import { communityInitial } from './communityFormat';

export interface CommunityPerson {
  id: string;
  n?: string | null;
  ps?: string | null;
  i?: string | null;
  avatar?: string | null;
}

export interface Companion extends CommunityPerson {
  outings?: number | null;
  massif?: string | null;
  /** Alias normalisé du bootstrap (`mass` = `massif`). */
  mass?: string | null;
}

export interface CompanionRowProps {
  companion: Companion;
}

function outingsLabel(outings: number): string {
  if (outings <= 0) return 'Aucune sortie commune';
  return outings === 1 ? '1 sortie commune' : `${outings} sorties communes`;
}

function handleLabel(handle?: string | null): string {
  const trimmed = handle?.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

/**
 * Ligne compagnon : avatar, nom, @handle, sorties communes et dernier massif.
 * Le handle et le massif ne sont jamais fabriqués quand la donnée manque.
 */
export function CompanionRow({ companion }: CompanionRowProps) {
  const name = companion.n?.trim() || 'Voyageur';
  const handle = handleLabel(companion.ps);
  const outings = Math.max(0, Number(companion.outings ?? 0));
  const massif = companion.massif?.trim() || companion.mass?.trim() || '';
  const initial = companion.i?.trim() || communityInitial(name);
  const avatar = companion.avatar?.trim();

  return (
    <li className="lkdv-companion">
      <span className="lkdv-companion-avatar" aria-hidden="true">
        <span className="lkdv-companion-initial">{initial}</span>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar distant fourni par Supabase, dimensions fixes
          <img
            src={avatar}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
      </span>

      <span className="lkdv-companion-txt">
        <b className="lkdv-companion-name">{name}</b>
        {handle ? <small className="lkdv-companion-handle">{handle}</small> : null}
      </span>

      <span className="lkdv-companion-meta">
        <span className="lkdv-companion-outings">{outingsLabel(outings)}</span>
        {massif ? <small className="lkdv-companion-massif">Dernier massif : {massif}</small> : null}
      </span>
    </li>
  );
}

export default CompanionRow;
