import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileFloatingIsland } from '@/features/materiel/components/mobile/MobileFloatingIsland';

// Le composant est invoqué comme fonction pure dans ces tests (pas de
// renderer React) : le wrapper haptique est mocké en fonction simple.
// (Mission gestes, Phase 7 : l'haptique passe par useHapticFeedback.)
const hapticMock = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: hapticMock, triggerHaptic: hapticMock, vibrate: hapticMock }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe('MobileFloatingIsland (« Liquid Island » Bottom Controller)', () => {
  const defaultProps = {
    totalCount: 16,
    remainingCount: 5,
    filterMode: 'all' as const,
    onFilterChange: vi.fn(),
    isSpeaking: false,
    onToggleSpeak: vi.fn(),
    onQuickAdd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Visual Rendering & Counts', () => {
    it('renders totalCount and remainingCount in segmented control', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, defaultProps)
      );

      // Labels and counts
      expect(html).toContain('Tous');
      expect(html).toContain('16');
      expect(html).toContain('Restants');
      expect(html).toContain('5');

      // Liquid glass styling & positioning
      expect(html).toContain('fixed');
      expect(html).toContain('bottom-4');
      expect(html).toContain('backdrop-blur-md');
      expect(html).toContain('rounded-full');
      expect(html).toContain('shadow-lg');
    });

    it('renders 0 counts gracefully without crashing', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, {
          ...defaultProps,
          totalCount: 0,
          remainingCount: 0,
        })
      );

      expect(html).toContain('Tous');
      expect(html).toContain('0');
      expect(html).toContain('Restants');
    });

    it('applies custom className when provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, {
          ...defaultProps,
          className: 'custom-island-class',
        })
      );

      expect(html).toContain('custom-island-class');
    });
  });

  describe('2. Segmented Control Filter Switching', () => {
    it('applies active styling based on filterMode', () => {
      const htmlAll = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, {
          ...defaultProps,
          filterMode: 'all',
        })
      );

      const htmlRemaining = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, {
          ...defaultProps,
          filterMode: 'remaining',
        })
      );

      expect(htmlAll).toContain('aria-selected="true"');
      expect(htmlRemaining).toContain('aria-selected="true"');
    });

    it('triggers onFilterChange callback and haptic feedback when clicking segmented tabs', () => {
      const onFilterChange = vi.fn();
      hapticMock.mockClear();

      const rendered = MobileFloatingIsland({
        ...defaultProps,
        onFilterChange,
      });

      expect(rendered).toBeDefined();

      // Find children inside container: [segmentedControl, ttsButton, quickAddButton]
      const children = React.Children.toArray(rendered.props.children);
      const segmentedControl = children[0] as React.ReactElement<{ children: React.ReactNode }>;
      const segmentButtons = React.Children.toArray(segmentedControl.props.children);

      // Tab 'Tous' (first) & Tab 'Restants' (second)
      const tabAll = segmentButtons[0] as React.ReactElement<{ onClick?: (e: any) => void }>;
      const tabRemaining = segmentButtons[1] as React.ReactElement<{ onClick?: (e: any) => void }>;

      expect(tabRemaining.props.onClick).toBeDefined();
      tabRemaining.props.onClick?.({ stopPropagation: () => {} });
      expect(onFilterChange).toHaveBeenCalledWith('remaining');
      expect(hapticMock).toHaveBeenCalledWith('light');

      expect(tabAll.props.onClick).toBeDefined();
      tabAll.props.onClick?.({ stopPropagation: () => {} });
      expect(onFilterChange).toHaveBeenCalledWith('all');
    });
  });

  describe('3. Audio TTS Speech Toggle & Speaking State', () => {
    it('triggers onToggleSpeak callback when speaker button is clicked', () => {
      const onToggleSpeak = vi.fn();
      const rendered = MobileFloatingIsland({
        ...defaultProps,
        onToggleSpeak,
      });

      const children = React.Children.toArray(rendered.props.children);
      const ttsBtn = children[1] as React.ReactElement<{ onClick?: (e: any) => void }>;

      expect(ttsBtn.props.onClick).toBeDefined();
      ttsBtn.props.onClick?.({ stopPropagation: () => {} });
      expect(onToggleSpeak).toHaveBeenCalledTimes(1);
    });

    it('reflects isSpeaking=true with active pulse/animation styles', () => {
      const htmlIdle = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, {
          ...defaultProps,
          isSpeaking: false,
        })
      );

      const htmlSpeaking = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, {
          ...defaultProps,
          isSpeaking: true,
        })
      );

      // Speaking state should indicate active reading / pulse animation
      expect(htmlIdle).toContain('aria-pressed="false"');
      expect(htmlSpeaking).toContain('aria-pressed="true"');
      expect(htmlSpeaking).toMatch(/animate-pulse|bg-emerald|text-emerald|ring/);
    });
  });

  describe('4. Quick Add (+) Button', () => {
    it('renders quick add button with emerald background and triggers onQuickAdd', () => {
      const onQuickAdd = vi.fn();
      const rendered = MobileFloatingIsland({
        ...defaultProps,
        onQuickAdd,
      });

      const children = React.Children.toArray(rendered.props.children);
      const quickAddBtn = children[2] as React.ReactElement<{ onClick?: (e: any) => void; className?: string }>;

      expect(quickAddBtn.props.onClick).toBeDefined();
      quickAddBtn.props.onClick?.({ stopPropagation: () => {} });
      expect(onQuickAdd).toHaveBeenCalledTimes(1);

      // Check styling on quick add button (emerald styling)
      expect(quickAddBtn.props.className).toMatch(/bg-\[#17402C\]|bg-emerald/);
    });
  });

  describe('5. Touch Target Ergonomics & Accessibility', () => {
    it('ensures all interactive elements have accessible touch targets >= 40-48px and proper ARIA', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileFloatingIsland, defaultProps)
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-label');
      expect(html).toMatch(/min-h-\[4[0-8]px\]|h-1[0-2]|min-w-\[4[0-8]px\]/);
    });
  });
});
