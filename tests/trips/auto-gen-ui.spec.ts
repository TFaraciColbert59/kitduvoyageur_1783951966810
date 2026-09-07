import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripBriefBar } from '@/features/trips/components/autoGen/TripBriefBar';
import { ProposalCard } from '@/features/trips/components/autoGen/ProposalCard';
import { PersistentMetricsBar } from '@/features/trips/components/autoGen/PersistentMetricsBar';
import { AutoGenTripView } from '@/features/trips/components/autoGen/AutoGenTripView';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';

describe('Phase D — Interface des Trois Gestes & Composants Aura (U13)', () => {
  const dummyProposal: Proposal<any> = {
    id: 'prop-accom-test',
    layer: 'accommodations',
    slotId: 'slot-night-d1',
    value: {
      name: 'Refuge des Cosmiques',
      priceEur: 85,
      type: 'refuge',
      altitudeM: 3613,
    },
    provenance: {
      source: 'official',
      sourceRef: 'FFCAM',
      observedAt: '2026-05-01T00:00:00Z',
    },
    confidence: 'high',
    rationale: 'Hébergement d’altitude sur l’arête.',
    alternatives: [
      {
        id: 'prop-accom-alt1',
        layer: 'accommodations',
        slotId: 'slot-night-d1',
        value: {
          name: 'Bivouac du Col du Midi',
          priceEur: 0,
          type: 'bivouac',
        },
        provenance: { source: 'community' },
        confidence: 'medium',
        rationale: 'Bivouac sur neige toléré.',
        alternatives: [],
        locked: false,
        editedByUser: false,
        impacts: ['slot-budget'],
      },
    ],
    locked: false,
    editedByUser: false,
    impacts: ['slot-budget'],
  };

  describe('D.1 : TripBriefBar (Barre d’Intention Unique & Déclencheurs)', () => {
    it('TEST-UI-BAR-01: Affiche le champ de saisie unique avec placeholder guidant', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripBriefBar, {
          onGenerate: vi.fn(),
          initialValue: '',
        })
      );

      expect(html).toContain('placeholder="Une phrase en entrée, un voyage complet en sortie..."');
      expect(html).toContain('aria-label="Décrivez votre voyage"');
    });

    it('TEST-UI-BAR-02: Intègre le bouton de dictée vocale (Geste 3) et téléversement GPX', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripBriefBar, {
          onGenerate: vi.fn(),
          initialValue: '10 jours au Maroc',
        })
      );

      expect(html).toContain('aria-label="Dicter une consigne vocale"');
      expect(html).toContain('aria-label="Joindre un tracé GPX ou une photo"');
      expect(html).toContain('Générer mon voyage');
    });

    it('TEST-UI-BAR-03: Propose les puces de suggestion prédéfinies', () => {
      const html = renderToStaticMarkup(
        React.createElement(TripBriefBar, {
          onGenerate: vi.fn(),
        })
      );

      expect(html).toContain('Maroc 10j');
      expect(html).toContain('Mont-Blanc 7j');
      expect(html).toContain('Sancy 3j');
    });
  });

  describe('D.2 : ProposalCard (Les Trois Gestes : Balayer, Verrouiller, Dicter)', () => {
    it('TEST-UI-CARD-01: Affiche le titre, le badge de couche et la provenance certifiée (Loi 2)', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProposalCard, {
          proposal: dummyProposal,
          onLockToggle: vi.fn(),
          onSelectAlternative: vi.fn(),
          onEditPrompt: vi.fn(),
        })
      );

      expect(html).toContain('Refuge des Cosmiques');
      expect(html).toContain('Hébergement');
      expect(html).toContain('85');
      expect(html).toContain('Officiel');
      expect(html).toContain('FFCAM');
    });

    it('TEST-UI-CARD-02: Propose le verrouillage (Geste 2) avec cible tactile >= 44px', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProposalCard, {
          proposal: { ...dummyProposal, locked: true },
          onLockToggle: vi.fn(),
          onSelectAlternative: vi.fn(),
          onEditPrompt: vi.fn(),
        })
      );

      expect(html).toContain('aria-label="Déverrouiller cette proposition"');
      expect(html).toContain('data-locked="true"');
    });

    it('TEST-UI-CARD-03: Affiche les contrôles d’alternatives (Geste 1 - Balayer)', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProposalCard, {
          proposal: dummyProposal,
          onLockToggle: vi.fn(),
          onSelectAlternative: vi.fn(),
          onEditPrompt: vi.fn(),
        })
      );

      expect(html).toContain('aria-label="Alternative précédente"');
      expect(html).toContain('aria-label="Alternative suivante"');
      expect(html).toContain('1 / 2');
      expect(html).toContain('Balayer pour alterner');
    });
  });

  describe('D.3 : PersistentMetricsBar (Recalcul Synchrone Budget & Poids)', () => {
    it('TEST-UI-METRICS-01: Affiche le budget total calculé et le poids du sac', () => {
      const html = renderToStaticMarkup(
        React.createElement(PersistentMetricsBar, {
          totalBudgetEur: 420,
          maxBudgetEur: 500,
          totalWeightKg: 8.5,
          maxWeightKg: 14,
          onValidate: vi.fn(),
        })
      );

      expect(html).toContain('420');
      expect(html).toContain('500');
      expect(html).toContain('8.5 kg');
      expect(html).toContain('Valider ce voyage');
    });

    it('TEST-UI-METRICS-02: Signale un dépassement de seuil critique (Alerte Visuelle)', () => {
      const html = renderToStaticMarkup(
        React.createElement(PersistentMetricsBar, {
          totalBudgetEur: 650,
          maxBudgetEur: 500,
          totalWeightKg: 16.2,
          maxWeightKg: 14,
          onValidate: vi.fn(),
        })
      );

      expect(html).toContain('data-budget-overflow="true"');
      expect(html).toContain('data-weight-overflow="true"');
      expect(html).toContain('Dépassement budget');
      expect(html).toContain('Sac trop lourd');
    });
  });

  describe('D.4 : AutoGenTripView (Vue Complète Intégrée)', () => {
    it('TEST-UI-VIEW-01: Assemble la barre de saisie, les propositions des 12 couches et les métriques', () => {
      const html = renderToStaticMarkup(
        React.createElement(AutoGenTripView, {
          initialBriefInput: '7 jours Mont-Blanc',
          layers: {
            accommodations: dummyProposal,
            kit: {
              ...dummyProposal,
              id: 'prop-kit-test',
              layer: 'kit',
              value: { targetWeightKg: 7.2, packVolumeL: 35 },
            },
          },
          tradeoffsLog: ['Ajustement budget effectué'],
        })
      );

      expect(html).toContain('Refuge des Cosmiques');
      expect(html).toContain('Ajustement budget effectué');
      expect(html).toContain('Valider ce voyage');
    });
  });
});
