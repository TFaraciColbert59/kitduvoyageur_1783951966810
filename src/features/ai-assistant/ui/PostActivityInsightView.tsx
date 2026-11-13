'use client';

/**
 * S2.37 — vue de présentation du bilan post-activité.
 *
 * Composant volontairement sans requête : le drawer parent (ExplorerV2 /
 * SheetContent, non modifiés dans ce lot) fournit `insight` et déclenche
 * l'appel API sur action explicite. Le bilan déterministe reste lisible même
 * quand l'IA est indisponible.
 */

import React from 'react';
import type { PostActivityInsight } from '../activity/postActivityInsight';

export interface PostActivityInsightViewProps {
  insight: PostActivityInsight | null;
  loading?: boolean;
  error?: string | null;
  aiLoading?: boolean;
  onRetry?: () => void;
  onRequestAi?: () => void;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--lkv-border-subtle)',
  borderRadius: 20,
  background: 'var(--lkv-surface, var(--lkv-app-bg-fallback))',
  padding: 16,
  display: 'grid',
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--lkv-ink-500)',
};

export function PostActivityInsightView({
  insight,
  loading = false,
  error = null,
  aiLoading = false,
  onRetry,
  onRequestAi,
}: PostActivityInsightViewProps) {
  if (loading) {
    return (
      <div style={cardStyle} aria-busy="true" aria-live="polite">
        <p style={{ margin: 0, color: 'var(--lkv-ink-700)' }}>Calcul du bilan…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={cardStyle} role="alert">
        <p style={{ margin: 0, color: 'var(--lkv-danger)' }}>⚠️ {error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              minHeight: 44,
              borderRadius: 999,
              border: '1px solid var(--lkv-border)',
              background: 'transparent',
              color: 'var(--lkv-ink-900)',
              padding: '0 16px',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        ) : null}
      </div>
    );
  }

  if (!insight) {
    return (
      <div style={cardStyle}>
        <p style={{ margin: 0, color: 'var(--lkv-ink-700)' }}>Aucune sortie à résumer.</p>
      </div>
    );
  }

  const { deterministic, ai } = insight;

  return (
    <section style={cardStyle} aria-label="Comprendre ma sortie">
      <header style={{ display: 'grid', gap: 4 }}>
        <p style={labelStyle}>Comprendre ma sortie</p>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--lkv-ink-900)' }}>{deterministic.headline}</h2>
      </header>

      {deterministic.facts.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'var(--lkv-ink-700)' }}>
          {deterministic.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, color: 'var(--lkv-ink-700)' }}>Aucune métrique exploitable pour cette sortie.</p>
      )}

      {deterministic.missing.length > 0 ? (
        <details>
          <summary style={{ cursor: 'pointer', color: 'var(--lkv-ink-700)' }}>Données indisponibles</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 4, color: 'var(--lkv-ink-500)' }}>
            {deterministic.missing.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {ai.status === 'available' ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <p style={labelStyle}>Lecture assistée · {ai.provider}</p>
          <p style={{ margin: 0, color: 'var(--lkv-ink-700)', lineHeight: 1.5 }}>{ai.text}</p>
        </div>
      ) : ai.reason === 'not_requested' && onRequestAi ? (
        <button
          type="button"
          onClick={onRequestAi}
          disabled={aiLoading}
          style={{
            minHeight: 44,
            borderRadius: 999,
            border: '1px solid var(--lkv-border-strong)',
            background: 'var(--lkv-action)',
            color: 'var(--lkv-on-action)',
            padding: '0 18px',
            cursor: aiLoading ? 'progress' : 'pointer',
          }}
        >
          {aiLoading ? 'Interprétation en cours…' : 'Comprendre ma sortie'}
        </button>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--lkv-ink-500)' }}>{ai.message}</p>
      )}
    </section>
  );
}
