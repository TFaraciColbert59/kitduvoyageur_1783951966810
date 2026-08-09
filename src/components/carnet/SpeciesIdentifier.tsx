'use client';

import React, { useState, useCallback, useRef } from 'react';

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
  /** Callback si on veut remonter le résultat au parent */
  onIdentified?: (species: SpeciesResult) => void;
}

const CONFIDENCE_COLORS: Record<SpeciesResult['confidence'], string> = {
  haute: 'text-green-600 bg-green-50 border-green-200',
  moyenne: 'text-amber-600 bg-amber-50 border-amber-200',
  faible: 'text-red-500 bg-red-50 border-red-200',
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
      // Retirer le préfixe data:...;base64,
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * SpeciesIdentifier — bouton photo + appel API + affichage résultat.
 * Usage : <SpeciesIdentifier momentId={moment.id} onIdentified={...} />
 */
export default function SpeciesIdentifier({ momentId, onIdentified }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [species, setSpecies] = useState<SpeciesResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    // Prévisualisation locale
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
  }, [momentId, onIdentified]);

  const reset = useCallback(() => {
    setState('idle');
    setSpecies(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return (
    <div className="mt-2">
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
        <button
          id="identify-species-btn"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-2.5 py-2.5 px-3 border border-dashed border-[#C8C0A8] rounded-xl text-sm text-[#7A8A7D] hover:border-[#2D5A27] hover:text-[#2D5A27] hover:bg-[#EDF7F0] transition-all"
        >
          <span className="text-lg">📸</span>
          <span className="font-medium">Identifier une espèce</span>
          <span className="ml-auto text-[11px] text-[#A0A89D]">Prends une photo</span>
        </button>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2.5 py-3 px-3 bg-[#F5F2EA] rounded-xl border border-[#E8E4D8]">
          <span className="text-lg animate-spin inline-block">🔍</span>
          <span className="text-sm text-[#5A6A5D]">Identification en cours…</span>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2.5 py-2.5 px-3 bg-red-50 rounded-xl border border-red-200">
          <span className="text-lg">⚠️</span>
          <span className="text-sm text-red-500 flex-1">Identification impossible.</span>
          <button onClick={reset} className="text-xs text-red-400 underline">Réessayer</button>
        </div>
      )}

      {state === 'done' && species && (
        <div className="bg-white rounded-xl border border-[#E8E4D8] overflow-hidden">
          {preview && (
            <div className="h-28 bg-[#F5F2EA] overflow-hidden">
              {/* Image preview est pas rechargée depuis objectUrl car on l'a révoqué */}
            </div>
          )}
          <div className="p-3">
            <div className="flex items-start gap-2 mb-1.5">
              <span className="text-xl">{GROUP_ICONS[species.group]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1C2620] leading-tight">{species.common_name}</p>
                <p className="text-[11px] text-[#A0A89D] italic">{species.name}</p>
              </div>
              <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${CONFIDENCE_COLORS[species.confidence]}`}>
                {species.confidence}
              </span>
            </div>
            <p className="text-xs text-[#5A6A5D] leading-relaxed">{species.description}</p>
            {species.is_protected && (
              <p className="text-[11px] text-amber-600 font-semibold mt-1.5">
                ⚠️ Espèce protégée — ne pas cueillir/capturer
              </p>
            )}
            <button
              onClick={reset}
              className="mt-2 text-[11px] text-[#A0A89D] underline"
            >
              Identifier une autre photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
