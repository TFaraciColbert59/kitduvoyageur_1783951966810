"use client";

import React from 'react';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { useAuth } from '@/contexts/AuthContext';
import { MessageInbox } from '@/features/messaging/components/MessageInbox';

export default function MessageriePage() {
  const { user, profile, loading } = useAuth();
  const [hasActiveConv, setHasActiveConv] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: hasActiveConv } })
      );
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } })
        );
      }
    };
  }, [hasActiveConv]);

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col bg-[#FAF8F5] relative">
      {/* Ambiance Liquid Glass LKDV — brume & dégradés climatiques */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse_at_top_left,rgba(148,181,161,0.18),transparent_55%)' }} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse_at_bottom_right,rgba(91,127,85,0.12),transparent_50%)' }} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse_at_50%_15%,rgba(168,200,160,0.14),transparent_60%)' }} />

      {/* Header global desktop */}
      <div className="hidden md:block relative z-10">
        <Header />
      </div>

      <MobilePageShell safeTop={false} hasBottomNav={!hasActiveConv}>
        <main
          className={`w-full relative z-10 ${
            hasActiveConv
              ? 'h-dvh md:h-[calc(100dvh-80px)]'
              : 'h-[calc(100dvh-var(--bottom-nav-height))] md:h-[calc(100dvh-80px)]'
          } overflow-hidden flex flex-col items-center justify-center pt-0 md:pt-2 pb-0 md:pb-2 px-0 md:px-6`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-10 h-10 border-4 border-[#17402C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !user ? (
            <div className="max-w-md w-full mx-auto text-center glass rounded-3xl p-8 shadow-sm m-4">
              <div className="w-16 h-16 bg-[#17402C]/10 text-[#17402C] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                💬
              </div>
              <h2 className="text-xl font-bold text-[#17402C]">Connexion Requise</h2>
              <p className="text-xs text-[#5A574E] mt-2 mb-6">
                Veuillez vous connecter pour accéder à vos discussions et échanger avec les membres de la communauté LKDV.
              </p>
              <a
                href="/auth/login"
                className="glass-capsule-btn primary inline-flex px-6 py-3 text-xs font-bold shadow-md"
              >
                Se connecter
              </a>
            </div>
          ) : (
            <MessageInbox
              currentUserId={user.id}
              currentUserProfile={
                profile
                  ? {
                      id: profile.id,
                      full_name: profile.full_name,
                      avatar_url: profile.avatar_url,
                      username: profile.username,
                    }
                  : null
              }
              onActiveConversationChange={setHasActiveConv}
            />
          )}
        </main>
      </MobilePageShell>
    </div>
  );
}
