import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileVitalAlertBanner } from '@/features/materiel/components/mobile/MobileVitalAlertBanner';
import type { ActionableAlert } from '@/features/materiel/services/generateSmartPrompts';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe('MobileVitalAlertBanner (Retractable Vital Safety Notification Banner)', () => {
  const criticalAlert: ActionableAlert = {
    id: 'alert-vital-gear',
    category: 'checklist',
    severity: 'critical',
    title: '1 équipement vital manquant : Filtre à eau',
    message: 'Filtre Katadyn BeFree pas encore prêt dans votre sac.',
    targetSection: 'checklist',
    targetItemId: 'item-filter-1',
    actionLabel: "Voir l'article",
    actionType: 'scroll_checklist',
    whyExplanation: 'Cet article est indispensable pour purifier votre eau en autonomie.',
  };

  const warningAlert: ActionableAlert = {
    id: 'alert-weather-rain',
    category: 'weather',
    severity: 'warning',
    title: 'Pluie prévue (Samedi : 70%)',
    message: 'Averses attendues. Emportez votre veste imperméable.',
    targetSection: 'checklist',
    targetItemId: 'item-jacket-1',
    actionLabel: 'Cocher veste',
    actionType: 'check_item',
  };

  const infoAlert: ActionableAlert = {
    id: 'alert-water-trail',
    category: 'water',
    severity: 'info',
    title: 'Ravitaillement Eau (24 km)',
    message: 'Parcours long : prévoyez 3L minimum.',
    targetSection: 'checklist',
    actionLabel: 'Marquer comme prévu',
    actionType: 'mark_planned',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Visual Rendering & iOS Notification Ergonomics', () => {
    it('renders critical alert with title, message, icon and action button', () => {
      const onAction = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [criticalAlert],
          onAction,
        })
      );

      // Title & Message
      expect(html).toContain('1 équipement vital manquant : Filtre à eau');
      expect(html).toContain('Filtre Katadyn BeFree pas encore prêt dans votre sac.');

      // Action capsule
      expect(html).toContain("Voir l&#x27;article");
      expect(html).toContain('bg-[#8A241B]');

      // iOS Notification styling
      expect(html).toContain('rounded-2xl');
      expect(html).toContain('bg-rose-50');
      expect(html).toContain('border-rose-200');
      expect(html).toContain('text-[#8A241B]');
    });

    it('renders warning alert when only warning alert is present', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [warningAlert],
        })
      );

      expect(html).toContain('Pluie prévue (Samedi : 70%)');
      expect(html).toContain('Averses attendues. Emportez votre veste imperméable.');
      expect(html).toContain('Cocher veste');
    });

    it('prioritizes most critical alert when multiple alerts with different severities are passed', () => {
      // Pass info, then critical, then warning in mixed order
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [infoAlert, criticalAlert, warningAlert],
        })
      );

      // Should display critical alert first
      expect(html).toContain('1 équipement vital manquant : Filtre à eau');
      expect(html).not.toContain('Ravitaillement Eau (24 km)');
    });

    it('applies custom className when provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [criticalAlert],
          className: 'custom-banner-test',
        })
      );

      expect(html).toContain('custom-banner-test');
    });
  });

  describe('2. Hiding & Empty State Behavior', () => {
    it('returns null/empty when alerts array is empty', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [],
        })
      );

      expect(html).toBe('');
    });

    it('returns null/empty when alerts is undefined or null', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: undefined as unknown as ActionableAlert[],
        })
      );

      expect(html).toBe('');
    });
  });

  describe('3. Action & Dismiss Callbacks', () => {
    it('triggers onAction callback with the current alert when action button is clicked', () => {
      const onAction = vi.fn();
      const rendered = MobileVitalAlertBanner({
        alerts: [criticalAlert],
        onAction,
      });

      expect(rendered).not.toBeNull();

      const findActionBtn = (node: any): any => {
        if (!node || typeof node !== 'object') return null;
        if (
          node.props?.['data-testid'] === 'vital-alert-action' ||
          (node.type === 'button' &&
            node.props?.onClick &&
            !node.props?.['aria-label']?.toLowerCase().includes('masquer') &&
            !node.props?.['aria-label']?.toLowerCase().includes('fermer'))
        ) {
          return node;
        }
        if (node.props?.children) {
          const kids = React.Children.toArray(node.props.children);
          for (const kid of kids) {
            const found = findActionBtn(kid);
            if (found) return found;
          }
        }
        return null;
      };

      const actionBtn = findActionBtn(rendered);
      expect(actionBtn).toBeDefined();
      expect(actionBtn.props.onClick).toBeDefined();
      actionBtn.props.onClick({ stopPropagation: () => {} });
      expect(onAction).toHaveBeenCalledWith(criticalAlert);
    });

    it('dismisses the alert and triggers onDismiss callback when close button is clicked', () => {
      const onDismiss = vi.fn();
      const rendered = MobileVitalAlertBanner({
        alerts: [criticalAlert],
        onDismiss,
      });

      expect(rendered).not.toBeNull();

      const findDismissBtn = (node: any): any => {
        if (!node || typeof node !== 'object') return null;
        if (
          node.props?.['data-testid'] === 'vital-alert-dismiss' ||
          (node.type === 'button' &&
            (node.props?.['aria-label']?.toLowerCase().includes('masquer') ||
              node.props?.['aria-label']?.toLowerCase().includes('fermer')))
        ) {
          return node;
        }
        if (node.props?.children) {
          const kids = React.Children.toArray(node.props.children);
          for (const kid of kids) {
            const found = findDismissBtn(kid);
            if (found) return found;
          }
        }
        return null;
      };

      const dismissBtn = findDismissBtn(rendered);
      expect(dismissBtn).toBeDefined();
      expect(dismissBtn.props.onClick).toBeDefined();
      dismissBtn.props.onClick({ stopPropagation: () => {} });
      expect(onDismiss).toHaveBeenCalledWith(criticalAlert);
    });
    it('filters out alerts present in dismissedIds', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [criticalAlert, warningAlert],
          dismissedIds: ['alert-vital-gear'],
        })
      );

      // Critical alert is dismissed, should show warning alert
      expect(html).not.toContain('1 équipement vital manquant');
      expect(html).toContain('Pluie prévue (Samedi : 70%)');
    });

    it('triggers haptic feedback on dismiss and action interactions', () => {
      const vibrateMock = vi.fn();
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: {
          ...originalNavigator,
          vibrate: vibrateMock,
        },
        configurable: true,
        writable: true,
      });

      const onAction = vi.fn();
      const rendered = MobileVitalAlertBanner({
        alerts: [criticalAlert],
        onAction,
      });

      // Find motion.aside -> find action button
      const findActionBtn = (node: any): any => {
        if (!node || typeof node !== 'object') return null;
        if (node.props?.['data-testid'] === 'vital-alert-action') return node;
        if (node.props?.children) {
          const kids = React.Children.toArray(node.props.children);
          for (const kid of kids) {
            const found = findActionBtn(kid);
            if (found) return found;
          }
        }
        return null;
      };

      const actionBtn = findActionBtn(rendered);
      actionBtn?.props.onClick?.({ stopPropagation: () => {} });
      expect(vibrateMock).toHaveBeenCalledWith(8);

      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });
  });

  describe('4. Accessibility & Touch Targets', () => {
    it('provides accessible role and touch targets for interactive elements', () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileVitalAlertBanner, {
          alerts: [criticalAlert],
        })
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-label');
    });
  });
});
