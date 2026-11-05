'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { streamChatCompletion } from '@/lib/ai/chatCompletion';
import './ai-improve.css';

/** Bouton de réécriture du récit via le routeur Nemotron LKDV. */
export function AiImproveButton({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const improve = async () => {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    const original = value;
    let accumulated = '';
    let degraded = false;
    // Le formulaire valide à chaque `setValue` : on plafonne les mises à jour
    // à une par frame au lieu d'une par token.
    let frame: number | null = null;
    const controller = new AbortController();
    abortRef.current = controller;
    const flush = () => {
      frame = null;
      onChange(accumulated);
    };
    try {
      // Le texte apparaît au fil du flux ; un échec en cours de route rend le
      // texte d'origine, jamais un mélange des deux.
      await streamChatCompletion(
        {
          task: 'fast',
          maxTokens: 700,
          system: 'Tu es un éditeur de récits de voyage. Réécris en français, garde les faits, le ton personnel et la concision. Ne rajoute aucun lieu, chiffre ou événement inventé. Rends uniquement le texte final, sans préambule.',
          prompt: `Réécris ce récit de carnet de voyage en 120 à 220 mots, plus fluide et évocateur, sans inventer de faits :\n\n${text}`,
        },
        {
          onDelta: (delta) => {
            accumulated += delta;
            if (frame === null) frame = window.requestAnimationFrame(flush);
          },
          onDone: (meta) => {
            degraded = meta.degraded;
          },
          signal: controller.signal,
        },
      );
      const next = accumulated.trim();
      if (!next || degraded || /momentanément indisponible/i.test(next)) {
        throw new Error('IA momentanément indisponible. Ton texte est conservé.');
      }
      onChange(next);
    } catch (err) {
      onChange(original);
      setError(err instanceof Error ? err.message : 'Amélioration indisponible.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
      setLoading(false);
    }
  };

  return (
    <div className="lkdv-ai-improve">
      <button type="button" onClick={() => void improve()} disabled={!value.trim() || loading}>
        {loading ? <Loader2 size={13} className="lkdv-ai-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
        {loading ? 'Amélioration…' : 'Améliorer avec l’IA'}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

export default AiImproveButton;
