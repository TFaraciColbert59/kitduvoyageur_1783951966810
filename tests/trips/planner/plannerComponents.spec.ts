import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepCard } from '@/features/trips/planner/StepCard';
import { DayNavigator } from '@/features/trips/planner/DayNavigator';
import { DayView } from '@/features/trips/planner/DayView';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';

describe('Chantier 3 — Planner UI Components (Unit Tests)', () => {
  const sampleStep: PlannerStep = {
    id: 'step-1',
    trip_id: 'trip-1',
    day_number: 1,
    order_index: 0,
    title: 'Traversée du plateau',
    description: 'Sentier bien balisé avec vue panoramique',
    location_name: 'Massif du Vercors',
    transport_mode: 'hiking',
    distance_km: 14.5,
    elevation_gain_m: 650,
    elevation_loss_m: 200,
    accommodation_name: 'Refuge des Chaumes',
  };

  describe('StepCard', () => {
    it('affiche correctement les informations de l’étape', () => {
      const html = renderToStaticMarkup(
        React.createElement(StepCard, {
          step: sampleStep,
          isFirst: false,
          isLast: false,
          canEdit: true,
          onMoveUp: vi.fn(),
          onMoveDown: vi.fn(),
          onEdit: vi.fn(),
          onMoveToDay: vi.fn(),
          onDelete: vi.fn(),
        })
      );

      expect(html).toContain('Traversée du plateau');
      expect(html).toContain('Massif du Vercors');
      expect(html).toContain('14.5 km');
      expect(html).toContain('+650m D+');
      expect(html).toContain('-200m D-');
      expect(html).toContain('Refuge des Chaumes');
      expect(html).toContain('Monter cette étape');
      expect(html).toContain('Descendre cette étape');
    });

    it('masque les contrôles d’édition si canEdit est false', () => {
      const html = renderToStaticMarkup(
        React.createElement(StepCard, {
          step: sampleStep,
          isFirst: false,
          isLast: false,
          canEdit: false,
          onMoveUp: vi.fn(),
          onMoveDown: vi.fn(),
          onEdit: vi.fn(),
          onMoveToDay: vi.fn(),
          onDelete: vi.fn(),
        })
      );

      expect(html).toContain('Traversée du plateau');
      expect(html).not.toContain('Monter cette étape');
      expect(html).not.toContain('Supprimer l’étape');
    });
  });

  describe('DayNavigator', () => {
    it('affiche tous les jours avec compte d’étapes', () => {
      const html = renderToStaticMarkup(
        React.createElement(DayNavigator, {
          daysCount: 3,
          selectedDay: 2,
          onSelectDay: vi.fn(),
          onAddDay: vi.fn(),
          startDate: '2026-07-10',
          steps: [sampleStep],
          canEdit: true,
        })
      );

      expect(html).toContain('Jour 1');
      expect(html).toContain('Jour 2');
      expect(html).toContain('Jour 3');
      expect(html).toContain('Ajouter jour');
    });
  });

  describe('DayView', () => {
    it('affiche les métriques calculées du jour', () => {
      const html = renderToStaticMarkup(
        React.createElement(DayView, {
          dayNumber: 1,
          startDate: '2026-07-10',
          steps: [sampleStep],
          canEdit: true,
          onAddStep: vi.fn(),
          onEditStep: vi.fn(),
          onDeleteStep: vi.fn(),
          onMoveUpStep: vi.fn(),
          onMoveDownStep: vi.fn(),
          onMoveToDay: vi.fn(),
          onInsertDayAfter: vi.fn(),
          onDuplicateDay: vi.fn(),
          onDeleteDay: vi.fn(),
        })
      );

      expect(html).toContain('14.5 km');
      expect(html).toContain('+650m');
      expect(html).toContain('Traversée du plateau');
      expect(html).toContain('Ajouter étape');
    });

    it('affiche un état vide élégant si aucune étape', () => {
      const html = renderToStaticMarkup(
        React.createElement(DayView, {
          dayNumber: 2,
          steps: [],
          canEdit: true,
          onAddStep: vi.fn(),
          onEditStep: vi.fn(),
          onDeleteStep: vi.fn(),
          onMoveUpStep: vi.fn(),
          onMoveDownStep: vi.fn(),
          onMoveToDay: vi.fn(),
          onInsertDayAfter: vi.fn(),
          onDuplicateDay: vi.fn(),
          onDeleteDay: vi.fn(),
        })
      );

      expect(html).toContain('Aucune étape pour cette journée');
      expect(html).toContain('Ajouter la première étape');
    });
  });
});
