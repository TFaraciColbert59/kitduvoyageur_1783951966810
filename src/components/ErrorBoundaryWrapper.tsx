'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const CHUNK_RELOAD_KEY = 'lkdv:boundary-chunk-reload';

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = `${error.name || ''} ${error.message || ''}`;
  return /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module/i.test(msg);
}

export default class ErrorBoundaryWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private retried = false;

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundaryWrapper caught:', error, errorInfo);
    try {
      fetch('/api/dev/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error?.message ?? String(error),
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
          href: typeof window !== 'undefined' ? window.location.href : '',
        }),
      }).catch(() => {});
    } catch {}

    // ChunkLoadError après déploiement/rebuild : 1 seul rechargement silencieux.
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      try {
        const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
        if (Date.now() - last > 15_000) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        window.location.reload();
        return;
      }
    }

    // Erreur transitoire (navigation, carte, hydratation) : 1 tentative de rendu.
    if (!this.retried) {
      this.retried = true;
      window.setTimeout(() => this.setState({ hasError: false, error: null }), 600);
    }
  }

  render() {
    if (this.state.hasError) {
      const chunkErr = isChunkLoadError(this.state.error);
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            minHeight: '100dvh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#FBFAF6',
            color: '#172B24',
          }}
        >
          <div
            style={{
              width: 'min(100%, 400px)',
              padding: '28px 24px',
              borderRadius: '26px',
              background: 'rgba(255, 255, 255, 0.86)',
              backdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(23, 43, 36, 0.1)',
              boxShadow: '0 12px 32px rgba(23, 64, 44, 0.12)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 750, color: '#172B24' }}>
              {chunkErr ? 'Mise à jour disponible' : 'Une erreur est survenue'}
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#56665D', lineHeight: 1.45 }}>
              {chunkErr
                ? 'Une nouvelle version de LKDV vient d’être chargée. Recharge la page pour continuer.'
                : 'L’application a rencontré un imprévu. Tu peux réessayer ou recharger la page.'}
            </p>
            <button
              type="button"
              onClick={() =>
                chunkErr
                  ? window.location.reload()
                  : this.setState({ hasError: false, error: null })
              }
              style={{
                marginTop: '8px',
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '9999px',
                border: 'none',
                background: '#17402C',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {chunkErr ? 'Recharger' : 'Réessayer'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
