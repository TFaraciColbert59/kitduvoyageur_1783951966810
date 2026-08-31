import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileWeightHeader } from '@/features/materiel/components/mobile/MobileWeightHeader';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe('MobileWeightHeader (Apple Health Style)', () => {
  it('renders readiness percentage in center with SVG progress ring', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileWeightHeader, {
        readinessPercentage: 69,
        baseWeightG: 4800,
        wornWeightG: 1200,
        consumablesWeightG: 2500,
      })
    );

    // Should render percentage text
    expect(html).toContain('69%');

    // Should include SVG circle with progress ring attributes
    expect(html).toContain('<svg');
    expect(html).toContain('circle');
    expect(html).toContain('stroke-dasharray');
  });

  it('renders the 3 formatted weight pills with emojis and formatted values', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileWeightHeader, {
        readinessPercentage: 85,
        baseWeightG: 4800,
        wornWeightG: 1200,
        consumablesWeightG: 2500,
      })
    );

    // Base Weight pill
    expect(html).toContain('🎒');
    expect(html).toContain('4.8 kg');

    // Porté / Worn Weight pill
    expect(html).toContain('🥾');
    expect(html).toContain('1.2 kg');

    // Consommables Weight pill
    expect(html).toContain('💧');
    expect(html).toContain('2.5 kg');
  });

  it('handles edge case weights (0g, grams under 1kg)', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileWeightHeader, {
        readinessPercentage: 100,
        baseWeightG: 850,
        wornWeightG: 0,
        consumablesWeightG: 1500,
      })
    );

    expect(html).toContain('850 g');
    expect(html).toContain('--');
    expect(html).toContain('1.5 kg');
    expect(html).toContain('100%');
  });

  it('provides interactive touch targets >= 48px and proper aria-labels', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileWeightHeader, {
        readinessPercentage: 69,
        baseWeightG: 4800,
        wornWeightG: 1200,
        consumablesWeightG: 2500,
      })
    );

    // Check for min-h-[48px] or min-w-[48px] touch targets
    expect(html).toContain('min-h-[48px]');
    expect(html).toContain('aria-label');
  });

  it('triggers onOpenDetails callback when interacting with elements', () => {
    const onOpenDetails = vi.fn();
    const rendered = MobileWeightHeader({
      readinessPercentage: 69,
      baseWeightG: 4800,
      wornWeightG: 1200,
      consumablesWeightG: 2500,
      onOpenDetails,
    });

    expect(rendered).toBeDefined();

    // Verify ring button click triggers onOpenDetails
    const children = React.Children.toArray(rendered.props.children);
    const ringButton = children[0] as React.ReactElement<{ onClick?: () => void }>;
    expect(ringButton.props.onClick).toBeDefined();
    ringButton.props.onClick?.();
    expect(onOpenDetails).toHaveBeenCalledTimes(1);

    // Verify pills trigger onOpenDetails
    const pillsContainer = children[1] as React.ReactElement<{ children: React.ReactNode }>;
    const pills = React.Children.toArray(pillsContainer.props.children);
    expect(pills.length).toBe(3);

    const basePill = pills[0] as React.ReactElement<{ onClick?: () => void }>;
    basePill.props.onClick?.();
    expect(onOpenDetails).toHaveBeenCalledTimes(2);

    const wornPill = pills[1] as React.ReactElement<{ onClick?: () => void }>;
    wornPill.props.onClick?.();
    expect(onOpenDetails).toHaveBeenCalledTimes(3);

    const consumablesPill = pills[2] as React.ReactElement<{ onClick?: () => void }>;
    consumablesPill.props.onClick?.();
    expect(onOpenDetails).toHaveBeenCalledTimes(4);
  });
});
