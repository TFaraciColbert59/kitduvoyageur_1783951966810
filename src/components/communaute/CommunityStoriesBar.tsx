'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface ExplorerStory {
  id: string;
  name: string;
  avatar: string;
  location: string;
  altitude?: number;
  timeAgo: string;
  status: string;
  storyImage: string;
  hasUnseenStory?: boolean;
}

const DEFAULT_STORIES: ExplorerStory[] = [
  {
    id: 's-1',
    name: 'Marceline',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200',
    location: 'Charmant Som',
    altitude: 1867,
    timeAgo: 'Il y a 35 min',
    status: '⛺ Bivouac sous les étoiles',
    storyImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200',
    hasUnseenStory: true,
  },
  {
    id: 's-2',
    name: 'Antoine',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200',
    location: 'Col Vert · Vercors',
    altitude: 1766,
    timeAgo: 'Il y a 1h',
    status: '☕ Pause réchaud au col',
    storyImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200',
    hasUnseenStory: true,
  },
  {
    id: 's-3',
    name: 'Léna',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200',
    location: 'Lac Blanc · Belledonne',
    altitude: 2150,
    timeAgo: 'Il y a 2h',
    status: '🏔️ Arrivée au refuge',
    storyImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200',
    hasUnseenStory: true,
  },
  {
    id: 's-4',
    name: 'Julien',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200',
    location: 'Aiguilles Rouges',
    altitude: 2352,
    timeAgo: 'Il y a 3h',
    status: '🦅 Observation gypaète',
    storyImage: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?q=80&w=1200',
    hasUnseenStory: false,
  },
  {
    id: 's-5',
    name: 'Camille',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200',
    location: 'Pointe Percée',
    altitude: 2750,
    timeAgo: 'Il y a 4h',
    status: '🥾 Crêtes aériennes',
    storyImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200',
    hasUnseenStory: false,
  },
];

export default function CommunityStoriesBar({ currentUser }: { currentUser?: any }) {
  const [stories, setStories] = useState<ExplorerStory[]>(DEFAULT_STORIES);
  const [activeStory, setActiveStory] = useState<ExplorerStory | null>(null);

  const handleOpenStory = (story: ExplorerStory) => {
    setActiveStory(story);
    setStories(prev => prev.map(s => s.id === story.id ? { ...s, hasUnseenStory: false } : s));
  };

  return (
    <>
      <div className="glass p-3 rounded-2xl overflow-hidden border border-white/60 bg-white/80 shadow-xs">
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1">
          {/* Add story button for current user */}
          <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#17402C]/30 group-hover:border-[#17402C] bg-white/70 flex items-center justify-center transition-all">
              <span className="w-8 h-8 rounded-full bg-[#17402C] text-white flex items-center justify-center text-sm font-bold shadow-xs">
                +
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#17402C] truncate max-w-[64px]">
              En direct
            </span>
          </div>

          {/* Explorer stories */}
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => handleOpenStory(story)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group text-center"
            >
              <div
                className={`p-0.5 rounded-full transition-transform duration-300 group-hover:scale-105 ${
                  story.hasUnseenStory
                    ? 'bg-gradient-to-tr from-emerald-600 via-teal-400 to-amber-300'
                    : 'bg-black/10'
                }`}
              >
                <div className="p-0.5 bg-white rounded-full">
                  <img
                    src={story.avatar}
                    alt={story.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#17402C] truncate max-w-[64px]">
                {story.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Story Lightbox / Modal */}
      {activeStory && (
        <div
          onClick={() => setActiveStory(null)}
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md aspect-[9/16] max-h-[85vh] rounded-3xl overflow-hidden relative shadow-2xl flex flex-col justify-between p-5 bg-black"
          >
            {/* Story Background Image */}
            <img
              src={activeStory.storyImage}
              alt="Story"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />

            {/* Top Bar */}
            <div className="relative z-10 space-y-2">
              <div className="w-full bg-white/30 h-1 rounded-full overflow-hidden">
                <div className="bg-white h-full animate-pulse rounded-full w-3/4" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={activeStory.avatar}
                    alt={activeStory.name}
                    className="w-9 h-9 rounded-full object-cover border-2 border-white"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">{activeStory.name}</span>
                    <span className="text-[10px] text-white/80 font-mono">{activeStory.timeAgo}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStory(null)}
                  className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center font-bold text-sm hover:bg-black/60 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Bottom Caption */}
            <div className="relative z-10 space-y-2 text-white">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-mono font-bold text-white">
                  📍 {activeStory.location}
                </span>
                {activeStory.altitude && (
                  <span className="px-2 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-mono font-bold text-emerald-200">
                    ⛰️ {activeStory.altitude}m
                  </span>
                )}
              </div>

              <p className="font-display font-bold text-sm leading-snug">
                {activeStory.status}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
