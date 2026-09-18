'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { GlassEngine } from './glassLabPolicy';
import styles from './glassLab.module.css';

const Samasante = dynamic(() => import('./SamasanteLayer'), { ssr: false });

class OpticalBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.error('Glass laboratory optical renderer failed', error);
    this.props.onError();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export function GlassLabSurface({ engine, children, onError, selected, critical }: {
  engine: GlassEngine;
  children: ReactNode;
  onError: () => void;
  selected?: boolean;
  critical?: boolean;
}) {
  return (
    <GlassCard
      as="article"
      variant={critical ? 'critical' : selected ? 'selected' : 'base'}
      tier={engine === 'rdev' ? 'premium' : 'standard'}
      className={styles.surface}
      data-lab-surface=""
      data-lab-engine={engine}
    >
      {engine === 'samasante' && (
        <div aria-hidden="true" inert className={styles.opticalLayer}>
          <OpticalBoundary key={engine} onError={onError}>
            <Samasante />
          </OpticalBoundary>
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </GlassCard>
  );
}
