import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartAlertsBanner } from '@/features/materiel/components/depart/DepartAlertsBanner';
import type { ActionableAlert } from '@/features/materiel/services/generateSmartPrompts';

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: vi.fn(), triggerHaptic: vi.fn(), vibrate: vi.fn() }),
}));
vi.mock('framer-motion', async () => ({
  ...(await vi.importActual('framer-motion')),
  useReducedMotion: () => false,
}));

const alert: ActionableAlert = {
  id: 'a1',
  category: 'checklist',
  severity: 'critical',
  title: '1 équipement vital manquant',
  message: 'Filtre à eau',
  actionLabel: "Voir l'article vital",
  actionType: 'scroll_checklist',
  targetSection: 'checklist',
  whyExplanation: 'x',
} as ActionableAlert;

const infoAlert: ActionableAlert = {
  ...alert,
  id: 'a2',
  severity: 'info',
  title: 'Ravitaillement eau à prévoir',
  actionLabel: 'Marquer comme prévu',
  actionType: 'mark_planned',
};

describe('DepartAlertsBanner', () => {
  it('aucune alerte ⇒ ligne sobre « Tout est prêt », pas de carte vide', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartAlertsBanner, {
        alerts: [],
        onAction: () => {},
        onDismiss: () => {},
      })
    );
    expect(html).toContain('Tout est prêt');
    expect(html).not.toContain('vital-alert-action');
  });

  it('alerte ⇒ une seule surface avec testids stables', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartAlertsBanner, {
        alerts: [alert],
        onAction: () => {},
        onDismiss: (_alert: ActionableAlert) => {},
      })
    );
    expect(html).toContain('data-testid="vital-alert-action"');
    expect(html).toContain('data-testid="vital-alert-dismiss"');
    expect(html.match(/data-testid="vital-alert-action"/g)?.length).toBe(1);
  });

  it('plusieurs alertes ⇒ le tableau est passé tel quel (tri de sévérité conservé, une seule surface)', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartAlertsBanner, {
        alerts: [infoAlert, alert],
        onAction: () => {},
        onDismiss: (_alert: ActionableAlert) => {},
      })
    );
    expect(html).toContain('1 équipement vital manquant');
    expect(html).not.toContain('Ravitaillement eau à prévoir');
    expect(html.match(/data-testid="vital-alert-action"/g)?.length).toBe(1);
  });
});
