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
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--lkv-primary)', color: 'var(--lkv-surface)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ marginBottom: '1rem' }}>Une erreur est survenue</h1>
          <p style={{ marginBottom: '2rem', color: 'var(--lkv-text-muted)' }}>L'application a rencontré un problème inattendu.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ backgroundColor: 'var(--lkv-primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
