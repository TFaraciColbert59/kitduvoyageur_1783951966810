'use client';

import React from 'react';
import type { CompteMapPayload } from '@/features/compte/map/types';

export type CompteMapStateKind = 'guest' | 'empty' | 'no-tracks' | 'neutral' | 'error';

export function CompteMapState({
  kind,
  onRetry,
  data,
  count,
  onOpenOutings,
  title,
  hint,
}: {
  kind: CompteMapStateKind;
  onRetry?: () => void;
  data?: CompteMapPayload;
  count?: number;
  onOpenOutings?: () => void;
  title?: string;
  hint?: string;
}) {
  const state = {
    guest: {
      title: 'Connecte-toi pour voir ta carte.',
      hint: 'Tes traces, tes massifs et tes carnets restent privés.',
      cta: <a href="/connexion?redirect=/compte">Se connecter</a>,
    },
    empty: {
      title: 'Ta carte se dessine à ta première sortie.',
      hint: 'Enregistre une sortie pour voir ta trace, tes massifs et tes kilomètres.',
      cta: <a href="/compas">Enregistrer une sortie</a>,
    },
    neutral: {
      title: title ?? '',
      hint: hint ?? '',
      cta: null,
    },
    'no-tracks': {
      title: `${count ?? 0} sortie(s) enregistrée(s), aucune trace GPS.`,
      hint: 'Les sorties sans trace restent dans tes Souvenirs, mais ne peuvent pas être dessinées.',
      cta: (
        <button type="button" onClick={onOpenOutings}>
          Voir mes sorties
        </button>
      ),
    },
    error: {
      title: 'Impossible de charger ta carte.',
      hint: 'Vérifie ta connexion, puis réessaie.',
      cta: (
        <button type="button" onClick={onRetry}>
          Réessayer
        </button>
      ),
    },
  }[kind];

  return (
    <div className="lkdv-map-state" data-kind={kind} data-has-data={data ? 'true' : 'false'}>
      <b>{state.title}</b>
      <p>{state.hint}</p>
      {state.cta}
    </div>
  );
}

export default CompteMapState;
