'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import './ai-improve.css';

/** Bouton de réécriture du récit via le routeur Nemotron LKDV. */
export function AiImproveButton({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const improve = async () => {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'fast',
          stream: false,
          maxTokens: 700,
          system: 'Tu es un éditeur de récits de voyage. Réécris en français, garde les faits, le ton personnel et la concision. Ne rajoute aucun lieu, chiffre ou événement inventé. Rends uniquement le texte final, sans préambule.',
          prompt: `Réécris ce récit de carnet de voyage en 120 à 220 mots, plus fluide et évocateur, sans inventer de faits :\n\n${text}`,
        }),
      });
      const payload = await response.json();
      const next = typeof payload.text === 'string' ? payload.text.trim() : '';
      if (!response.ok || !next) {
        throw new Error(payload.details || 'Amélioration indisponible.');
      }
      if (payload.degraded === true || /momentanément indisponible/i.test(next)) {
        throw new Error('IA momentanément indisponible. Ton texte est conservé.');
      }
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Amélioration indisponible.');
    } finally {
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
