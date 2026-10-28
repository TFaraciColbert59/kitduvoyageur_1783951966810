'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRewardsWallet } from '@/features/rewards/client/useRewardsWallet';
import { DRAWER_SHELL_CSS, DrawerShell, type DrawerTab } from '@/components/compte/drawer/shell/DrawerShell';
import { DrawerAuthRequired } from '@/components/compte/drawer/shell/DrawerAuthRequired';
import { RewardsHistory, RewardsOverview } from './RewardsPanel';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Tiroir « Récompenses » du Compte : deux volets (récompenses, historique)
 * dans la coquille commune `DrawerShell`, monté par l'hôte React du runtime v8
 * (`REACT_DRAWERS.rewards_drawer`). Aucune nouvelle navigation générale.
 */
export function RewardsDrawer({ initialTab = 0 }: { initialTab?: number }) {
  const { user, loading } = useAuth();
  const controller = useRewardsWallet(user?.id ?? null, loading);
  const [index, setIndex] = useState(initialTab === 1 ? 1 : 0);

  if (!loading && !user) {
    return (
      <div className="lkdv-drawer-shell">
        <style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS }} />
        <DrawerAuthRequired
          title="Connectez-vous pour voir vos points"
          hint="Votre solde, votre objectif et votre historique sont privés."
        />
      </div>
    );
  }

  const tabs: DrawerTab[] = [
    {
      id: 'recompenses',
      label: 'Récompenses',
      icon: <LKDVIcon name="cadeau" size={18} aria-hidden="true" />,
      render: () => (
        <>
          <RewardsOverview controller={controller} />
          <p className="lkdv-rw-note" style={{ margin: '10px 4px 4px', fontSize: 12 }}>
            <Link className="lkdv-rw-link" href="/recompenses">
              Ouvrir la page Récompenses
            </Link>
          </p>
        </>
      ),
    },
    {
      id: 'historique',
      label: 'Historique',
      icon: <LKDVIcon name="historique" size={18} aria-hidden="true" />,
      render: () => <RewardsHistory controller={controller} />,
    },
  ];

  return <DrawerShell tabs={tabs} activeIndex={index} onIndexChange={setIndex} />;
}

export default RewardsDrawer;
