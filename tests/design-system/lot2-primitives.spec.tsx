import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PriceTag,
  formatCurrencyEur,
  StepIndicator,
  InsetGroupedList,
  InsetGroupedItem,
  SubTabBar,
  CountryFlag,
  EmptyState,
  ErrorState,
} from '@/components/ui';

describe('Lot 2 Extended Primitives — Liquid Glass iOS 27', () => {
  describe('PriceTag & formatCurrencyEur', () => {
    it('formate les devises au standard français', () => {
      expect(formatCurrencyEur(59.9)).toMatch(/59,90\s*€/);
      expect(formatCurrencyEur(120)).toMatch(/120\s*€/);
    });

    it('affiche le prix courant et le prix barré', () => {
      const html = renderToStaticMarkup(
        <PriceTag amountEur={89.9} originalAmountEur={119.9} period="/ mois" />
      );
      expect(html).toContain('89,90');
      expect(html).toContain('119,90');
      expect(html).toContain('/ mois');
      expect(html).toContain('line-through');
    });

    it('gère le label gratuit lorsque spécifié', () => {
      const html = renderToStaticMarkup(<PriceTag amountEur={0} freeLabel="Offert" />);
      expect(html).toContain('Offert');
    });
  });

  describe('StepIndicator', () => {
    it('rend un progressbar accessible avec les attributs aria requis', () => {
      const html = renderToStaticMarkup(
        <StepIndicator totalSteps={4} currentStep={2} />
      );
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="3"');
      expect(html).toContain('aria-valuemax="4"');
      expect(html).toContain('aria-valuemin="1"');
      expect(html).toContain('3 / 4');
    });

    it('affiche les libellés personnalisés', () => {
      const html = renderToStaticMarkup(
        <StepIndicator
          totalSteps={3}
          currentStep={1}
          stepLabels={['Équipement', 'Destination', 'Confirmation']}
        />
      );
      expect(html).toContain('Destination');
      expect(html).toContain('2 / 3');
    });
  });

  describe('InsetGroupedList & InsetGroupedItem', () => {
    it('rend une liste groupée avec header, footer et items', () => {
      const html = renderToStaticMarkup(
        <InsetGroupedList header="Préférences" footer="Ces réglages sont synchronisés.">
          <InsetGroupedItem title="Notifications" trailing="Activées" chevron />
          <InsetGroupedItem title="Supprimer le compte" destructive />
        </InsetGroupedList>
      );
      expect(html).toContain('Préférences');
      expect(html).toContain('Ces réglages sont synchronisés.');
      expect(html).toContain('Notifications');
      expect(html).toContain('Activées');
      expect(html).toContain('Supprimer le compte');
      expect(html).toContain('text-[color:var(--lkv-danger)]');
    });
  });

  describe('SubTabBar', () => {
    it('rend un plateau d’onglets capsule avec rôles tablist et tab', () => {
      const tabs = [
        { id: 'tous', label: 'Tous' },
        { id: 'en-cours', label: 'En cours', badge: 2 },
        { id: 'archives', label: 'Archivés' },
      ];
      const html = renderToStaticMarkup(
        <SubTabBar tabs={tabs} activeTab="en-cours" onTabChange={() => {}} />
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
      expect(html).toContain('En cours');
      expect(html).toContain('2');
    });
  });

  describe('CountryFlag', () => {
    it('rend un drapeau sans plantage avec code pays valide', () => {
      const html = renderToStaticMarkup(<CountryFlag code="fr" name="France" />);
      expect(html).toContain('flagcdn.com/fr.svg');
      expect(html).toContain('alt="France"');
    });

    it('gère le repli sans emoji pour un code invalide ou manquant', () => {
      const html = renderToStaticMarkup(<CountryFlag code="" />);
      expect(html).toContain('<svg');
      expect(html).not.toContain('🌐');
    });
  });

  describe('EmptyState & ErrorState', () => {
    it('rend un EmptyState accessible en Liquid Glass', () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="Aucun voyage"
          description="Créez votre première aventure."
          actionLabel="Nouveau voyage"
          actionHref="/voyages/nouveau"
        />
      );
      expect(html).toContain('Aucun voyage');
      expect(html).toContain('Créez votre première aventure.');
      expect(html).toContain('Nouveau voyage');
      expect(html).toContain('/voyages/nouveau');
    });

    it('rend un ErrorState avec bouton Réessayer', () => {
      const html = renderToStaticMarkup(
        <ErrorState
          title="Échec de connexion"
          message="Impossible de charger le flux."
          onRetry={() => {}}
        />
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Échec de connexion');
      expect(html).toContain('Impossible de charger le flux.');
      expect(html).toContain('Réessayer');
    });
  });
});
