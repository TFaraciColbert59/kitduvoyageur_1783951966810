'use client';

import React, { useState, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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

const CONFIDENCE_COLORS: Record<SpeciesResult['confidence'], string> = {
  haute: 'text-emerald-900 bg-emerald-50 border-emerald-200',
  moyenne: 'text-amber-900 bg-amber-50 border-amber-200',
  faible: 'text-rose-900 bg-rose-50 border-rose-200',
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
    <div className="glass bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-xs space-y-3">
      {/* Input caché */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        id="species-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {state === 'idle' && (
        <div className="text-center py-4 space-y-3">
          <span className="text-3xl block">🌿</span>
          <div>
            <h4 className="font-display font-bold text-sm text-[#17402C]">
              Identifier une espèce sur votre parcours
            </h4>
            <p className="text-xs text-[#5C6B5E] max-w-xs mx-auto leading-relaxed mt-0.5">
              Prenez une photo de fleur, champignon, arbre ou animal rencontré pour analyse IA instantanée.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              inputRef.current?.click();
            }}
            className="glass-capsule-btn primary !min-h-[38px] !py-2 !px-5 !text-xs !font-bold !gap-2"
          >
            <span>📸</span>
            <span>Prendre une photo</span>
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#17402C] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono font-bold text-[#17402C]">
            Analyse taxonomique IA en cours...
          </p>
        </div>
      )}

      {state === 'done' && species && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
                {GROUP_ICONS[species.group] || '🌿'}
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-[#17402C]">
                  {species.common_name || species.name}
                </h4>
                <p className="text-[10px] font-mono italic text-[#5C6B5E]">
                  {species.name}
                </p>
              </div>
            </div>

            <span
              className={`glass-pill text-[9px] font-mono font-bold shrink-0 border ${
                CONFIDENCE_COLORS[species.confidence]
              }`}
            >
              Confiance {species.confidence}
            </span>
          </div>

          <p className="text-xs text-[#2D4536] leading-relaxed pl-1">
            {species.description}
          </p>

          {species.is_protected && (
            <div className="p-2 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center gap-2 text-xs text-amber-900 font-medium">
              <span>⚠️</span>
              <span>Espèce protégée — Ne pas cueillir ni déranger.</span>
            </div>
          )}

          <div className="pt-2 border-t border-[#17402C]/10 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="glass-capsule-btn !min-h-[30px] !py-1 !px-3 !text-xs !font-bold"
            >
              <span>Nouvelle analyse</span>
            </button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center py-4 space-y-2 text-rose-700">
          <span className="text-2xl block">⚠️</span>
          <p className="text-xs font-bold">Impossible d'identifier cette photo.</p>
          <button
            type="button"
            onClick={reset}
            className="glass-capsule-btn !min-h-[30px] !py-1 !px-3 !text-xs !font-bold"
          >
            <span>Réessayer</span>
          </button>
        </div>
      )}
    </div>
  );
}
