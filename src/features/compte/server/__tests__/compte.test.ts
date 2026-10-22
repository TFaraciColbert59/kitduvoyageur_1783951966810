import { describe, expect, it } from 'vitest';
import {
  notificationGroup,
  orderStage,
  orderStageLabel,
  ORDER_STEPS,
} from '../compte';

describe('compte — commandes', () => {
  it('normalise les statuts réels vers les étapes du stepper', () => {
    expect(orderStage('confirmed')).toBe('confirmed');
    expect(orderStage('preparing')).toBe('prepared');
    expect(orderStage('shipped')).toBe('shipped');
    expect(orderStage('delivered')).toBe('delivered');
    expect(orderStage('cancelled')).toBe('cancelled');
  });

  it('ne prétend jamais qu’une commande inconnue est livrée', () => {
    expect(orderStage('statut_mystere')).toBe('confirmed');
    expect(orderStage(null)).toBe('confirmed');
  });

  it('expose les quatre étapes dans l’ordre', () => {
    expect(ORDER_STEPS.map((step) => step.id)).toEqual([
      'confirmed',
      'prepared',
      'shipped',
      'delivered',
    ]);
    expect(orderStageLabel('shipped')).toBe('Expédiée');
  });
});

describe('compte — notifications', () => {
  it('respecte le groupe stocké quand il est valide', () => {
    expect(notificationGroup('post_liked', 'orders')).toBe('orders');
  });

  it('déduit le groupe du type quand la colonne est vide', () => {
    expect(notificationGroup('post_liked', null)).toBe('social');
    expect(notificationGroup('loan_request', null)).toBe('loans');
    expect(notificationGroup('order_shipped', null)).toBe('orders');
    expect(notificationGroup('sos_alert', null)).toBe('system');
  });
});
