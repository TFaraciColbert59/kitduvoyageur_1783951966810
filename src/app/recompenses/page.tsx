'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppShell from '@/components/shell/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { useRewardsWallet } from '@/features/rewards/client/useRewardsWallet';
import { hasLegacyRights } from '@/features/rewards/domain/wallet';
import { RewardsHistory, RewardsOverview, type RewardsController } from '@/components/rewards/RewardsPanel';
import { LegacyRightsSection } from '@/components/rewards/LegacyRightsSection';
import '@/components/rewards/rewards.css';

/**
 * /recompenses — points dépensables, objectif choisi, catalogue et historique.
 *
 * Remplace l'ancienne page « Partage de valeur / Reward Pool » qui promettait
 * une part de revenus non financée (pool enregistré à 0 €). Les droits cash et
 * crédit créateur déjà acquis restent visibles et utilisables dans une section
 * distincte, affichée seulement s'ils existent. Le tiroir Compte
 * (`?tab=recompenses`) montre les mêmes composants.
 */

function SignedOut() {
  return (
    <div className="lkdv-rw-card" role="status">
      <p className="lkdv-rw-eyebrow">Récompenses</p>
      <p className="lkdv-rw-note" style={{ marginTop: 6 }}>
        Connectez-vous pour voir vos points, votre objectif et votre historique. Ces informations sont privées.
      </p>
      <div className="lkdv-rw-actions">
        <Link className="lkdv-rw-btn primary" href="/connexion?redirect=/recompenses">
          Se connecter
        </Link>
      </div>
    </div>
  );
}

function Content({ controller }: { controller: RewardsController }) {
  const wallet = controller.view.state === 'ready' || controller.view.state === 'offline' ? controller.view.wallet : null;
  return (
    <>
      <header style={{ margin: '0 0 14px' }}>
        <p className="lkdv-rw-eyebrow">Compte</p>
        <h1 style={{ margin: '4px 0 6px', font: '700 26px/1.15 var(--sf, -apple-system, system-ui, sans-serif)', color: 'var(--rw-ink)' }}>
          Récompenses
        </h1>
        <p className="lkdv-rw-note" style={{ maxWidth: 620 }}>
          Vos points se dépensent contre des avantages réellement disponibles. Ils sont distincts de vos XP de{' '}
          <Link className="lkdv-rw-link" href="/progression">
            Progression
          </Link>
          , qui ne s’achètent ni ne se convertissent.
        </p>
      </header>
      {controller.view.state === 'unauthenticated' ? (
        <SignedOut />
      ) : (
        <div className="lkdv-rw-page-grid">
          <div>
            <RewardsOverview controller={controller} />
          </div>
          <div className="lkdv-rw" style={{ gap: 10 }}>
            <h2 className="lkdv-rw-h" style={{ marginTop: 0 }}>Historique</h2>
            <RewardsHistory controller={controller} />
            {wallet && hasLegacyRights(wallet.legacy) ? (
              <LegacyRightsSection legacy={wallet.legacy} onWithdrawn={controller.refetch} />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

export default function RecompensesPage() {
  const { user, loading } = useAuth();
  const controller = useRewardsWallet(user?.id ?? null, loading);

  return (
    <div className="lkdv-rw-page">
      <div className="hidden md:block">
        <Header />
        <main className="mx-auto max-w-6xl px-8 pb-16 pt-24">
          <Content controller={controller} />
        </main>
        <Footer />
      </div>
      <div className="block md:hidden">
        <AppShell background="transparent">
          <main style={{ padding: '16px 16px 0' }}>
            <Content controller={controller} />
          </main>
        </AppShell>
      </div>
    </div>
  );
}
