'use client';

// src/features/messaging/components/TraceOverlay.tsx
//
// Pastilles posées sur la carte d'un tracé : nom, distance et dénivelé (quand
// ils sont connus), « Tracé indicatif » pour un tracé schématique. Même
// composant dans l'aperçu avant envoi (randonnée et GPX) et dans le tiroir.

import React from 'react';
import { formatTraceStats, type TraceStats } from '../lib/traceFormat';

export interface TraceOverlayProps extends TraceStats {
  name?: string;
  indicative?: boolean;
  /** Marge gauche/droite (px) : laisse la place aux boutons retour et fermer du tiroir. */
  insetX?: number;
}

export function TraceOverlay({ name, distanceKm, elevationGainM, indicative = false, insetX = 14 }: TraceOverlayProps) {
  const stats = formatTraceStats({ distanceKm, elevationGainM });
  return (
    <>
      {name || stats ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: insetX,
            right: insetX,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: name ? 'space-between' : 'flex-start',
            gap: 8,
            minHeight: 44,
            pointerEvents: 'none',
          }}
        >
          {name ? (
            <div
              style={{
                background: 'rgba(23, 43, 36, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '6px 14px',
                borderRadius: 999,
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 2px 10px rgba(11, 31, 23, 0.22)',
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>
          ) : null}
          {stats ? (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                padding: '4px 10px',
                borderRadius: 999,
                color: '#17402C',
                fontSize: 11.5,
                fontWeight: 700,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {stats}
            </div>
          ) : null}
        </div>
      ) : null}
      {indicative ? (
        <div
          style={{
            position: 'absolute',
            left: 14,
            bottom: 62,
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#56665d',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          Tracé indicatif
        </div>
      ) : null}
    </>
  );
}
