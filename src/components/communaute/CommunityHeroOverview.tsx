import React from 'react';

interface Props {
  carnetsCount: number;
  clubsCount: number;
  groupsCount: number;
  onNavigateTab: (tab: any) => void;
}

export default function CommunityHeroOverview({
  carnetsCount,
  clubsCount,
  groupsCount,
  onNavigateTab,
}: Props) {
  return (
    <div className="glass rounded-[1.5rem] p-4 border border-white/50 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
      <div>
        <h2 className="font-display font-bold text-xl text-[var(--lkv-primary)]">Le Camp de Base</h2>
        <p className="text-sm text-[var(--lkv-text-muted)] mt-1">
          Découvrez {carnetsCount} carnets, rejoignez {clubsCount} clubs ou intégrez {groupsCount} groupes.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onNavigateTab('carnets')} className="glass-capsule-btn text-xs font-bold px-3 py-1.5">
          Voir les carnets
        </button>
        <button onClick={() => onNavigateTab('clubs')} className="glass-capsule-btn text-xs font-bold px-3 py-1.5">
          Voir les clubs
        </button>
      </div>
    </div>
  );
}
