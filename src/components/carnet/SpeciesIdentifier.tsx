'use client';

import React, { useState, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card, ErrorState, LoadingState } from '@/components/ui';

interface SpeciesResult {
  name: string;
  common_name: string;
  confidence: 'haute' | 'moyenne' | 'faible';
  description: string;
  is_protected: boolean;
  group: 'plante' | 'champignon' | 'animal' | 'insecte' | 'inconnu';
}

interface Props {
  momentId?: string;
  onIdentified?: (species: SpeciesResult) => void;
}

const CONFIDENCE_TONE: Record<SpeciesResult['confidence'], 'sage' | 'warn' | 'danger'> = {
  haute: 'sage',
  moyenne: 'warn',
  faible: 'danger',
};

const GROUP_ICONS: Record<SpeciesResult['group'], string> = {
  plante: '🌿',
  champignon: '🍄',
  animal: '🦊',
  insecte: '🦋',
  inconnu: '❓',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SpeciesIdentifier({ momentId, onIdentified }: Props) {
  const { triggerHaptic } = useHapticFeedback();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [species, setSpecies] = useState<SpeciesResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
      triggerHaptic('medium');

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setState('loading');
      setSpecies(null);

      try {
        const base64 = await fileToBase64(file);
        const res = await fetch('/api/carnet/identify-species', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            momentId: momentId || null,
            imageBase64: base64,
            mimeType: file.type,
          }),
        });

        if (!res.ok) throw new Error('Erreur API');
        const data: SpeciesResult = await res.json();
        setSpecies(data);
        setState('done');
        onIdentified?.(data);
      } catch {
        setState('error');
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [momentId, onIdentified, triggerHaptic]
  );

  const reset = useCallback(() => {
    setState('idle');
    setSpecies(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <Card className="space-y-[var(--space-3)] p-[var(--space-4)]">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        id="species-photo-input"
        aria-label="Photo d'une espèce à identifier"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {state === 'idle' && (
        <div className="space-y-[var(--space-3)] py-[var(--space-4)] text-center">
          <span className="block text-[length:var(--lkv-text-title-sm)]" aria-hidden>🌿</span>
          <div>
            <h4 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              Identifier une espèce sur votre parcours
            </h4>
            <p className="mx-auto mt-[var(--space-1)] max-w-xs text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
              Prenez une photo de fleur, champignon, arbre ou animal rencontré pour analyse IA instantanée.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              inputRef.current?.click();
            }}
            icon={<span aria-hidden>📸</span>}
          >
            Prendre une photo
          </Button>
        </div>
      )}

      {state === 'loading' && (
        <LoadingState compact label="Analyse taxonomique IA en cours..." />
      )}

      {state === 'done' && species && (
        <div className="space-y-[var(--space-3)]">
          <div className="flex items-start justify-between gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[length:var(--lkv-text-title-sm)]" aria-hidden>
                {GROUP_ICONS[species.group] || '🌿'}
              </div>
              <div>
                <h4 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                  {species.common_name || species.name}
                </h4>
                <p className="font-mono text-[length:var(--lkv-text-caption-2)] italic text-[color:var(--lkv-text-muted)]">
                  {species.name}
                </p>
              </div>
            </div>

            <Badge tone={CONFIDENCE_TONE[species.confidence]} className="shrink-0 font-mono font-bold">
              Confiance {species.confidence}
            </Badge>
          </div>

          <p className="pl-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
            {species.description}
          </p>

          {species.is_protected && (
            <div className="flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-2xl)] border border-[color:var(--sand-200)]/60 bg-[color:var(--sand-50)] p-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--sand-900)]">
              <span aria-hidden>⚠️</span>
              <span>Espèce protégée — Ne pas cueillir ni déranger.</span>
            </div>
          )}

          <div className="flex justify-end border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
            <Button type="button" variant="secondary" size="sm" onClick={reset}>
              Nouvelle analyse
            </Button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <ErrorState
          title="Identification impossible"
          message="Impossible d'identifier cette photo."
          onRetry={reset}
        />
      )}
    </Card>
  );
}
