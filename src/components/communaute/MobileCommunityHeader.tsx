'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';

export default function MobileCommunityHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  return (
    <header className="community-mobile-header">
      <div>
        <span className="community-kicker">LE KIT DU VOYAGEUR</span>
        <h1>Communauté</h1>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="community-icon-button" aria-label="Rechercher dans la communauté" onClick={() => { triggerHaptic('light'); (onSearchClick || openSearch)(); }}>
          <Icon name="search" size={20} />
        </button>
        <Link href="/carnets/nouveau" onClick={() => triggerHaptic('light')} className="community-icon-button community-publish" aria-label="Publier un récit">
          <Icon name="plus" size={22} />
        </Link>
      </div>
    </header>
  );
}
