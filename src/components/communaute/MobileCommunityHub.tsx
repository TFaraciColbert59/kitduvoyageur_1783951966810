'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import PostCard, { PostItem } from '@/components/social/PostCard';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface MobileCommunityHubProps {
  posts: PostItem[];
  loading: boolean;
  user: any;
  onLikePost: (postId: string, liked: boolean) => Promise<void>;
  onSavePost: (postId: string, saved: boolean) => Promise<void>;
  onOpenPublishModal: () => void;
  onRefresh?: () => void;
}

export default function MobileCommunityHub({
  posts,
  loading,
  user,
  onLikePost,
  onSavePost,
  onOpenPublishModal,
  onRefresh,
}: MobileCommunityHubProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [activeFilter, setActiveFilter] = useState<'tous' | 'populaires' | 'conseils' | 'recents'>('tous');

  const filteredPosts = posts.filter(p => {
    if (activeFilter === 'populaires') return (p.likes_count || 0) > 5;
    if (activeFilter === 'conseils') return p.content?.toLowerCase().includes('conseil') || p.content?.toLowerCase().includes('astuce');
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[#FBFAF6] pb-24">
      {/* Hero Header - Mobile Friendly */}
      <div className="relative px-4 pt-5 pb-4 bg-gradient-to-b from-[#17402C] to-[#122E20] text-white rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold tracking-wider uppercase text-[#A8C4A2] border border-white/10">
            🌲 Le Fil Voyageur
          </span>
          <span className="text-[11px] font-mono text-white/70">
            {posts.length} récits partagés
          </span>
        </div>

        <h1 className="font-display font-bold text-2xl leading-tight">
          La communauté,<br />
          <em className="font-serif italic font-normal text-[#A8C4A2]">à hauteur de sentier.</em>
        </h1>

        {/* Exact Reference Composer Card */}
        <div
          onClick={() => {
            triggerHaptic('selection');
            onOpenPublishModal();
          }}
          className="mt-4 p-3 bg-white text-[#1C2620] rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#1C2620]/6 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#17402C] to-[#2D6B4A] text-white flex items-center justify-center font-serif italic text-base shrink-0 shadow-sm">
              {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <p className="text-xs text-[#5C6B5E] font-normal truncate">
              Partager un <em className="font-serif italic text-[#17402C]">récit</em> ou une photo...
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className="w-8 h-8 rounded-xl bg-[#F5F2E8] text-[#17402C] flex items-center justify-center hover:bg-[#EAE6DF] transition-colors"
              aria-label="Ajouter une photo"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-xl bg-[#F5F2E8] text-[#17402C] flex items-center justify-center hover:bg-[#EAE6DF] transition-colors"
              aria-label="Ajouter un lieu"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 1 8 8c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 8-8z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Posts Stream */}
      <div className="px-3 space-y-3 pt-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-[#1C2620]/5 animate-pulse space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="space-y-1 flex-1">
                    <div className="w-28 h-3 bg-gray-200 rounded" />
                    <div className="w-16 h-2 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-12 bg-gray-100 rounded-xl" />
                <div className="w-full h-44 bg-gray-200 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl p-6 border border-[#1C2620]/5">
            <span className="text-3xl">🏕️</span>
            <h3 className="font-bold text-[#1C2620] text-sm mt-2">Aucun post dans cette section</h3>
            <p className="text-xs text-[#5C6B5E] mt-1">Soyez le premier à partager votre expérience !</p>
            <button
              onClick={onOpenPublishModal}
              className="mt-4 px-5 py-2 bg-[#17402C] text-white rounded-xl text-xs font-bold shadow-md"
            >
              Créer une publication
            </button>
          </div>
        ) : (
          filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onLike={(liked) => onLikePost(post.id, liked)}
              onSave={(saved) => onSavePost(post.id, saved)}
            />
          ))
        )}
      </div>
    </div>
  );
}
