'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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

    // Une erreur transitoire (navigation, carte, hydratation) ne doit pas
    // condamner toute l'application : on retente un rendu une seule fois.
    if (!this.retried) {
      this.retried = true;
      window.setTimeout(() => this.setState({ hasError: false, error: null }), 600);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--glass-bg-dark)] p-[var(--space-8)] text-center text-[color:var(--lkv-text-inverted)]">
          <h1 className="mb-[var(--space-4)]">Une erreur est survenue</h1>
          <p className="mb-[var(--space-8)] text-[color:var(--lkv-forest-100)]">L'application a rencontré un problème inattendu.</p>
          {this.state.error?.message && (
            <div className="mb-4 max-w-lg overflow-auto rounded bg-red-950/80 p-3 text-left text-xs font-mono text-red-200">
              <p className="font-bold">{this.state.error.message}</p>
              {this.state.error.stack && (
                <pre className="mt-2 text-[10px] opacity-80 whitespace-pre-wrap">{this.state.error.stack}</pre>
              )}
            </div>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="min-h-[var(--lkv-touch-min)] cursor-pointer rounded-[var(--lkv-radius-sm)] border-none bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-6)] py-3 font-semibold text-[color:var(--lkv-text-primary)]"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
