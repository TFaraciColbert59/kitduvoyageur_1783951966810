import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileChecklistItem } from '@/features/materiel/components/mobile/MobileChecklistItem';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

// Le composant est invoqué comme fonction pure dans ces tests (pas de
// renderer React) : le wrapper haptique est mocké en fonction simple.
// (Mission gestes, Phase 7 : l'haptique passe par useHapticFeedback.)
const hapticMock = vi.fn();
vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: hapticMock, triggerHaptic: hapticMock, vibrate: hapticMock }),
}));

describe('MobileChecklistItem (Apple Reminders Style)', () => {
  const mockItem: ChecklistItem = {
    id: 'item-1',
    name: 'Tente Big Agnes Copper Spur',
    category: 'Bivouac',
    weight_g: 1420,
    is_checked: false,
    is_vital: true,
    is_consumable: false,
    is_worn: false,
    quantity: 1,
  };

  const consumableItem: ChecklistItem = {
    id: 'item-2',
    name: 'Lyophilisé Bœuf Curry',
    category: 'Vivres & Eau',
    weight_g: 160,
    is_checked: true,
    is_vital: false,
    is_consumable: true,
    is_worn: false,
    quantity: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Visual Rendering & SF Pro Typography', () => {
    it('renders item name, formatted weight, vital badge, and thumbnail', () => {
      const onToggle = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: mockItem,
          onToggle,
        })
      );

      // Name & Weight
      expect(html).toContain('Tente Big Agnes Copper Spur');
      expect(html).toContain('1.4 kg');

      // Vital badge
      expect(html).toContain('Vital');

      // Image thumbnail
      expect(html).toContain('<img');
      expect(html).toContain('alt="Tente Big Agnes Copper Spur"');
      expect(html).toContain('w-9 h-9');
    });

    it('renders consumable and checked item with line-through styling', () => {
      const onToggle = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: consumableItem,
          onToggle,
        })
      );

      expect(html).toContain('Lyophilisé Bœuf Curry');
      expect(html).toContain('160 g');
      expect(html).toContain('Consommable');
      expect(html).toContain('line-through');
    });

    it('applies prominent highlight styles when isHighlighted is true', () => {
      const onToggle = vi.fn();
      const htmlNormal = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: mockItem,
          onToggle,
          isHighlighted: false,
        })
      );

      const htmlHighlighted = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: mockItem,
          onToggle,
          isHighlighted: true,
        })
      );

      expect(htmlNormal).not.toContain('ring-[#8A241B]');
      expect(htmlHighlighted).toContain('ring-[#8A241B]');
    });
  });

  describe('2. Ergonomics: 48px Hit-Box & Haptic Feedback', () => {
    it('provides minimum 48px hit-box and 32px circular check button', () => {
      const onToggle = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: mockItem,
          onToggle,
        })
      );

      // 48px hit-box
      expect(html).toContain('min-w-[48px]');
      expect(html).toContain('min-h-[48px]');

      // 32px circular check indicator
      expect(html).toContain('w-8 h-8');
      expect(html).toContain('rounded-full');
    });

    it('triggers onToggle callback and haptic feedback on toggle interaction', () => {
      const onToggle = vi.fn();
      hapticMock.mockClear();

      const rendered = MobileChecklistItem({
        item: mockItem,
        onToggle,
      });

      expect(rendered).toBeDefined();

      // Find the motion.div (second child) -> button (first child)
      const children = React.Children.toArray(rendered.props.children);
      const motionDiv = children[1] as React.ReactElement<{ children: React.ReactNode }>;
      const rowChildren = React.Children.toArray(motionDiv.props.children);
      const checkBtn = rowChildren[0] as React.ReactElement<{ onClick?: (e: any) => void }>;

      expect(checkBtn.props.onClick).toBeDefined();
      checkBtn.props.onClick?.({ stopPropagation: () => {} });

      expect(onToggle).toHaveBeenCalledWith(mockItem);
      expect(hapticMock).toHaveBeenCalledWith('light');
    });
  });

  describe('3. Accessibility (ARIA)', () => {
    it('sets proper ARIA role and state for unchecked and checked items', () => {
      const onToggle = vi.fn();
      const htmlUnchecked = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: mockItem,
          onToggle,
        })
      );

      const htmlChecked = renderToStaticMarkup(
        React.createElement(MobileChecklistItem, {
          item: consumableItem,
          onToggle,
        })
      );

      expect(htmlUnchecked).toContain('aria-checked="false"');
      expect(htmlChecked).toContain('aria-checked="true"');
      expect(htmlUnchecked).toContain('role="checkbox"');
      expect(htmlUnchecked).toContain('aria-label');
    });
  });

  describe('4. Delete Action Callback', () => {
    it('calls onDelete when delete button is present and clicked', () => {
      const onToggle = vi.fn();
      const onDelete = vi.fn();

      const rendered = MobileChecklistItem({
        item: mockItem,
        onToggle,
        onDelete,
      });

      expect(rendered).toBeDefined();

      const children = React.Children.toArray(rendered.props.children);
      const motionDiv = children[1] as React.ReactElement<{ children: React.ReactNode }>;
      const rowChildren = React.Children.toArray(motionDiv.props.children);
      const rightArea = rowChildren[2] as React.ReactElement<{ children: React.ReactNode }>;
      const rightChildren = React.Children.toArray(rightArea.props.children);
      const deleteBtn = rightChildren[0] as React.ReactElement<{ onClick?: (e: any) => void }>;

      expect(deleteBtn.props.onClick).toBeDefined();
      deleteBtn.props.onClick?.({ stopPropagation: () => {} });

      expect(onDelete).toHaveBeenCalledWith(mockItem);
    });
  });
});
