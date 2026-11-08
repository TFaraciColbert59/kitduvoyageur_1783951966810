'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import type { SearchHitVM } from '../../shared/types';
import { initialsFromName } from '../../shared/format';
import { ExploreIcon } from '../ExploreIcons';
import { useLongPress } from '../useLongPress';

export interface MemberRowProps {
  hit: SearchHitVM;
  onPeek?: (hit: SearchHitVM, opener: HTMLElement) => void;
}

/**
 * Ligne « Membre » des résultats de recherche (Recherche#13 : lien profond vers
 * `/profil/<handle>`). Un seul lien, libellé complet, appui long → Peek.
 */
export function MemberRow({ hit, onPeek }: MemberRowProps) {
  const longPress = useLongPress({
    onLongPress: (element) => onPeek?.(hit, element),
    enabled: Boolean(onPeek),
  });
  const initials = initialsFromName(hit.title);
  const handle = hit.subtitle.startsWith('@') ? hit.subtitle : hit.subtitle ? `@${hit.subtitle}` : '';
  return (
    <Link
      className="lkdv-cv2x-member-row"
      href={hit.href}
      aria-label={[hit.title, handle, hit.distanceKm != null ? `à ${hit.distanceKm} km` : ''].filter(Boolean).join(', ')}
      data-testid="cv2-tile-membre"
      data-id={hit.id}
      {...longPress}
    >
      <span className="lkdv-cv2x-member-avatar" aria-hidden="true">
        {hit.cover ? (
          <AppImage src={hit.cover} alt="" width={40} height={40} className="lkdv-cv2x-avatar-img" />
        ) : (
          initials
        )}
      </span>
      <span className="lkdv-cv2x-member-body">
        <span className="lkdv-cv2x-member-name">{hit.title}</span>
        {handle ? <span className="lkdv-cv2-meta">{handle}</span> : null}
      </span>
      <ExploreIcon name="chevron-right" size={16} />
    </Link>
  );
}

export default MemberRow;
