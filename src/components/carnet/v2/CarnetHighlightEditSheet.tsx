'use client';

import React, { useState } from 'react';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { lkvConfirm } from '@/components/ui/dialogs';
import type { CarnetHighlight } from '@/features/carnet/detail/highlights';

export interface CarnetHighlightEditSheetProps {
  highlight: CarnetHighlight;
  onSave: (label: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Tiroir d'édition d'une pastille « À la une » (appui long 500 ms, participant) :
 * renommer, ou retirer — la seule action qui demande une confirmation modale.
 */
export function CarnetHighlightEditSheet({
  highlight,
  onSave,
  onRemove,
  onClose,
}: CarnetHighlightEditSheetProps) {
  const [label, setLabel] = useState(highlight.label);

  const remove = async () => {
    const ok = await lkvConfirm({
      title: 'Retirer cette pastille ?',
      message: `« ${highlight.label} » ne sera plus à la une de ce carnet.`,
      confirmLabel: 'Retirer',
      variant: 'destructive',
    });
    if (ok) onRemove();
  };

  return (
    <OverlaySheet
      title="Modifier la sélection"
      subtitle={highlight.kind === 'crew' ? 'Voyageur' : 'Étape clé'}
      onClose={onClose}
    >
      <label className="lkdv-overlay-field">
        <span>Titre</span>
        <input
          type="text"
          value={label}
          maxLength={24}
          aria-label="Titre de la sélection"
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      {highlight.hint ? <p className="lkdv-mute">{highlight.hint}</p> : null}
      <button
        type="button"
        className="lkdv-carnet-create-cta"
        disabled={!label.trim()}
        onClick={() => onSave(label.trim())}
      >
        Enregistrer
      </button>
      <button
        type="button"
        className="lkdv-carnet-create-cta lkdv-carnet-cta-danger"
        onClick={() => void remove()}
      >
        Retirer des stories à la une
      </button>
    </OverlaySheet>
  );
}
