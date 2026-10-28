'use client';

import React, { useCallback, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

interface SpeciesResult {
  name: string;
  common_name: string;
  confidence: 'haute' | 'moyenne' | 'faible';
  description: string;
  is_protected: boolean;
}

export interface CarnetNaturePaneProps {
  canWrite: boolean;
  onRequireAuth?: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CarnetNaturePane({ canWrite, onRequireAuth }: CarnetNaturePaneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [species, setSpecies] = useState<SpeciesResult | null>(null);

  const setFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/') || !canWrite) return;
      setState('loading');
      setSpecies(null);
      try {
        const base64 = await fileToBase64(file);
        const response = await fetch('/api/carnet/identify-species', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        if (!response.ok) throw new Error('identify failed');
        setSpecies((await response.json()) as SpeciesResult);
        setState('done');
      } catch {
        setState('error');
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [canWrite],
  );

  return (
    <div className="ckp-pane">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Photo d’une espèce à identifier"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void setFile(file);
        }}
      />

      {state === 'done' && species ? (
        <div className="ckp-species">
          <b>{species.common_name || species.name}</b>
          <i>{species.name}</i>
          <div className="ckp-day-meta">
            <span>Confiance {species.confidence}</span>
            {species.is_protected ? <span>Espèce protégée</span> : null}
          </div>
          <p>{species.description}</p>
          <button type="button" className="ckp-link" onClick={() => setState('idle')} style={{ marginTop: 6 }}>
            Identifier une autre espèce
          </button>
        </div>
      ) : (
        <div className="ckp-drop">
          <Icon name="compass" size={24} aria-hidden="true" />
          <p>
            {state === 'loading'
              ? 'Identification en cours…'
              : state === 'error'
                ? 'Identification impossible. Réessayez avec une photo nette.'
                : 'Photographiez une plante, un champignon ou un animal pour l’identifier.'}
          </p>
          <button
            type="button"
            className="ckp-pill ckp-pill--primary"
            disabled={state === 'loading'}
            onClick={() => {
              if (!canWrite) {
                onRequireAuth?.();
                return;
              }
              inputRef.current?.click();
            }}
          >
            <Icon name="image-plus" size={16} aria-hidden="true" />
            {canWrite ? 'Prendre une photo' : 'Se connecter pour identifier'}
          </button>
        </div>
      )}
    </div>
  );
}

export default CarnetNaturePane;
