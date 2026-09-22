'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui';
import StoriesViewer, { type StoryUser } from './StoriesViewer';

/**
 * Stories du terrain — barre horizontale + visionneur plein écran.
 * Exemples locaux (assets du repo, aucun réseau requis) en attendant
 * les stories serveur ; remplacés dès que l'API existe.
 */
const DEMO_STORIES: StoryUser[] = [
  {
    id: 'story-demo-1',
    name: 'Tony',
    time: '12 min',
    slides: [
      { image: '/assets/images/community-hikers.jpg', caption: 'Crête des Mélèzes — 6h12, -2°C, lumière incroyable.' },
    ],
  },
  {
    id: 'story-demo-2',
    name: 'Claire',
    time: '1 h',
    slides: [
      { image: '/assets/images/community-morning.jpg', caption: 'Bivouac au lever du jour, lac encore gelé.' },
      { image: '/assets/images/community-hikers.jpg', caption: 'Descente par la combe nord, la neige tient encore.' },
    ],
  },
  {
    id: 'story-demo-3',
    name: 'Marc',
    time: '3 h',
    slides: [
      { image: '/assets/images/community-morning.jpg', caption: 'Lac gelé — rive nord, un miroir parfait.' },
    ],
  },
];

export default function CommunityStoriesBar({ currentUser }: { currentUser?: any }) {
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  return (
    <>
      {/* P2 — fade iOS en fin de rail : la dernière story (« M ») s'estompe
          au lieu d'être tronquée nette ; `pr` de fin de course. */}
      <div className="flex w-full items-center gap-[var(--space-2)] overflow-x-auto pb-[var(--space-1)] pr-[28px] [scrollbar-width:none] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-label="Ajouter une story"
          icon={
            <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[color:var(--lkv-border-strong)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-primary)]">
              +
            </span>
          }
        >
          Votre story
        </Button>

        {DEMO_STORIES.map((user, i) => (
          <Button
            key={user.id}
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            aria-label={`Voir la story de ${user.name}`}
            onClick={() => setViewerStart(i)}
            icon={
              <span className="flex size-7 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-footnote)] font-bold uppercase text-[color:var(--lkv-text-primary)]">
                {user.name.charAt(0)}
              </span>
            }
          >
            {user.name}
          </Button>
        ))}
      </div>

      {viewerStart !== null && (
        <StoriesViewer
          users={DEMO_STORIES}
          startUser={viewerStart}
          onClose={() => setViewerStart(null)}
        />
      )}
    </>
  );
}
