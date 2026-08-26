'use client';

import React from 'react';
import BadgesCard from '@/components/compte/BadgesCard';
import ConstanceCard from '@/components/compte/ConstanceCard';
import ActiviteCard from '@/components/compte/ActiviteCard';
import AbonnementCard from '@/components/compte/AbonnementCard';
import { BadgeItem, ActiviteItem } from '@/lib/mock/compte-marceline';

interface CompteRightSidebarProps {
  badges: BadgeItem[];
  trustScore: number;
  constance: any;
  activite: ActiviteItem[];
  abonnement: any;
}

export default function CompteRightSidebar({
  badges,
  trustScore,
  constance,
  activite,
  abonnement,
}: CompteRightSidebarProps) {
  return (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3.5 pb-6 font-sans">
      <BadgesCard badges={badges} trustScore={trustScore} />
      <ConstanceCard constance={constance} />
      <ActiviteCard activites={activite} />
      <AbonnementCard subscription={abonnement} />
    </aside>
  );
}
