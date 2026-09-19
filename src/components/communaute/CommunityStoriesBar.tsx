'use client';

import React, { useState } from 'react';
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
      <div className="community-stories">
        <div className="story-track">
          {/* Votre story */}
          <button type="button" className="story-item" aria-label="Ajouter une story">
            <span className="story-ring story-ring--self">
              <span className="story-avatar story-avatar--self">+</span>
            </span>
            <span className="story-name">Votre story</span>
          </button>

          {DEMO_STORIES.map((user, i) => (
            <button
              key={user.id}
              type="button"
              className="story-item"
              aria-label={`Voir la story de ${user.name}`}
              onClick={() => setViewerStart(i)}
            >
              <span className="story-ring">
                <span className="story-avatar">{user.name.charAt(0)}</span>
              </span>
              <span className="story-name">{user.name}</span>
            </button>
          ))}
        </div>
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
