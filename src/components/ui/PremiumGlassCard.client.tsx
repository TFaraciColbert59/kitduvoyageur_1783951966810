'use client';

import { Component, type ReactNode } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { useGlassCapabilities } from '@/components/dev/glass/useGlassCapabilities';
import { resolveGlassEngine } from '@/components/dev/glass/glassLabPolicy';

// ---------------------------------------------------------------------------
// Error boundary — silently swallows any rdev render failure
// ---------------------------------------------------------------------------
class OpticalBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('[PremiumGlassCard] optical renderer failed:', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Stationary mouse values — no cursor tracking for production cards
// ---------------------------------------------------------------------------
const STATIONARY = { x: 0, y: 0 } as const;

// ---------------------------------------------------------------------------
// Inner layer — uses capabilities hook, bails early on weak devices
// ---------------------------------------------------------------------------
interface PremiumOpticalLayerProps {
  refractionScale: number;
  variant: string;
}

function PremiumOpticalLayerInner({ refractionScale }: PremiumOpticalLayerProps) {
  const capabilities = useGlassCapabilities(false);
  const { engine } = resolveGlassEngine('rdev', capabilities);

  // Fall back to standard → render nothing (GlassCard CSS handles the look)
  if (engine !== 'rdev') return null;

  return (
    // aria-hidden + inert: accessible DOM lives in the parent GlassCard.
    // pointer-events-none: never intercepts touch/click.
    <div
      aria-hidden="true"
      // @ts-expect-error — `inert` is a valid HTML attribute; React types lag behind
      inert=""
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <LiquidGlass
        mode="standard"
        displacementScale={refractionScale}
        aberrationIntensity={0.25}
        elasticity={0}
        blurAmount={0}
        padding="0"
        saturation={0}
        globalMousePos={STATIONARY}
        mouseOffset={STATIONARY}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          borderRadius: 'inherit',
          pointerEvents: 'none',
        }}
      >
        {/* LiquidGlass requires children; empty span satisfies the constraint */}
        <span />
      </LiquidGlass>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — wraps inner layer with the optical error boundary
// ---------------------------------------------------------------------------
export default function PremiumOpticalLayer(props: PremiumOpticalLayerProps) {
  return (
    <OpticalBoundary>
      <PremiumOpticalLayerInner {...props} />
    </OpticalBoundary>
  );
}
