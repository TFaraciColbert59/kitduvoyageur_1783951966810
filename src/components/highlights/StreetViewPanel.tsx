'use client';

import React from 'react';
import type { StreetViewResult } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  buttonStyle,
  helperStyle,
  labelStyle,
  primaryButtonStyle,
  sectionGapStyle,
} from './styles';

const DIRECTION_LABEL: Record<NonNullable<StreetViewResult['direction']>, string> = {
  front: 'face à la marche',
  left: 'à gauche du tracé',
  right: 'à droite du tracé',
  back: 'derrière toi',
};

const REASON_LABEL: Record<StreetViewResult['reason'], string> = {
  ok: 'Vue disponible',
  'no-coverage': 'Aucune vue de rue à proximité.',
  'invalid-point': 'Point invalide.',
  'provider-absent': 'Fournisseur de vue de rue non configuré.',
};

export interface StreetViewPanelProps {
  result: StreetViewResult;
  onClose: () => void;
  onOpen?: (panoId: string) => void;
  onFallback?: () => void;
}

/**
 * K2.25 — vue de rue au point choisi. Sans fournisseur, on l'annonce et on
 * renvoie vers Trail View ; aucune clé ni URL tierce n'est inventée.
 */
export function StreetViewPanel({ result, onClose, onOpen, onFallback }: StreetViewPanelProps) {
  return (
    <DrawerFrame
      eyebrow="Vue de rue"
      title="Autour du point"
      onClose={onClose}
      testId="street-view-panel"
    >
      <div style={sectionGapStyle}>
        {result.available && result.panoId ? (
          <>
            <p style={labelStyle}>Vue disponible</p>
            <p style={helperStyle}>
              Panorama orienté {result.headingDeg}°, {DIRECTION_LABEL[result.direction ?? 'front']}{' '}
              · {result.distanceM != null ? `${Math.round(result.distanceM)} m` : ''}
            </p>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => onOpen?.(result.panoId as string)}
            >
              Ouvrir la vue de rue
            </button>
          </>
        ) : (
          <>
            <p style={helperStyle} data-testid="street-view-unavailable">
              {REASON_LABEL[result.reason]}
            </p>
            {onFallback ? (
              <button type="button" style={buttonStyle} onClick={onFallback}>
                Voir les photos du tracé
              </button>
            ) : null}
          </>
        )}
        <p style={helperStyle}>
          La position exacte du point reste dans la carte : ce panneau ne la réexpose pas.
        </p>
      </div>
    </DrawerFrame>
  );
}
