'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundaryWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundaryWrapper caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--lkv-primary)] p-[var(--space-8)] text-center text-[color:var(--lkv-text-inverted)]">
          <h1 className="mb-[var(--space-4)]">Une erreur est survenue</h1>
          <p className="mb-[var(--space-8)] text-[color:var(--lkv-forest-100)]">L'application a rencontré un problème inattendu.</p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[var(--lkv-touch-min)] cursor-pointer rounded-[var(--lkv-radius-sm)] border-none bg-[color:var(--lkv-surface-paper)] px-[var(--space-6)] py-3 font-semibold text-[color:var(--lkv-primary)]"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
