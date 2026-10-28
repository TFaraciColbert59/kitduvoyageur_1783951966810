'use client';

import React from 'react';
import type { SlotId } from './SlotShell';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

const iconProps = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: 'false',
} as const;

/**
 * Icônes uniques des 5 slots, partagées par le sélecteur `.ig-tabs` et
 * l'en-tête de la coquille. Une seule source pour éviter deux tracés
 * divergents ; la taille est pilotée par la CSS locale.
 */
export const SLOT_ICONS: Record<SlotId, React.ReactNode> = {
  vitrine: (
    <LKDVIcon name="boutique" {...iconProps} />
  ),
  kit: (
    <LKDVIcon name="sac" {...iconProps} />
  ),
  prets: (
    <LKDVIcon name="van" {...iconProps} />
  ),
  souvenirs: (
    <LKDVIcon name="photo" {...iconProps} />
  ),
  communaute: (
    <LKDVIcon name="communaute" {...iconProps} />
  ),
};
