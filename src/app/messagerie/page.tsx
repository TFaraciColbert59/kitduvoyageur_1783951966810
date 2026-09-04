"use client";

import React from 'react';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { useAuth } from '@/contexts/AuthContext';
import { MessageInbox } from '@/features/messaging/components/MessageInbox';
import { useKeyboardInset } from '@/features/messaging/hooks/useKeyboardInset';

export default function MessageriePage() {
  const { user, profile, loading } = useAuth();
  const [hasActiveConv, setHasActiveConv] = React.useState(false);
  const kbInset = useKeyboardInset();

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

  // Empêche le rubber-band du document sous le chat (iOS).
  React.useEffect(() => {
    const prev = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      document.body.style.overscrollBehaviorY = prev;
    };
  }, []);

  return (
    <div
      className="w-full min-h-[100dvh] flex-1 overflow-hidden flex flex-col bg-[#FBFAF6] relative"
      style={{ ['--kb-inset' as string]: `${kbInset}px` }}
    >
      {/* Ambiance Liquid Glass LKDV — dégradés climatiques (CSS valide, cf. audit 1.1c) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top left, rgba(148,181,161,0.18), transparent 55%),' +
            'radial-gradient(ellipse at bottom right, rgba(91,127,85,0.12), transparent 50%),' +
            'radial-gradient(ellipse at 50% 15%, rgba(168,200,160,0.14), transparent 60%)',
        }}
      />

      {/* Header global desktop */}
      <div className="hidden md:block relative z-10">
        <Header />
      </div>

      {/*
        safeTop={false} : ConversationList gère lui-même env(safe-area-inset-top)
        dans son header sticky (cf. .msg-safe-top). videoBackground={false} :
        le chat est opaque plein écran, la vidéo de fond serait un coût pur.
      */}
      <MobilePageShell safeTop={false} hasBottomNav={!hasActiveConv} videoBackground={false}>
        <main
          className="w-full flex-1 min-h-0 relative z-10 overflow-hidden flex flex-col items-center justify-center md:pt-2 md:pb-2 md:px-6"
        >
          {loading ? (
            <div
              className="flex items-center justify-center h-full"
              role="status"
              aria-label="Chargement de la messagerie"
            >
              <div className="w-10 h-10 border-4 border-[#17402C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !user ? (
            <div className="max-w-md w-full mx-auto text-center glass rounded-3xl p-8 shadow-sm m-4">
              <div className="w-16 h-16 bg-[#17402C]/10 text-[#17402C] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                💬
              </div>
              <h2 className="text-xl font-bold text-[#17402C]">Connexion requise</h2>
              <p className="text-sm text-[#5A574E] mt-2 mb-6 leading-relaxed">
                Connectez-vous pour accéder à vos discussions et échanger avec les
                membres de la communauté LKDV.
              </p>
              <a
                href="/connexion"
                className="glass-capsule-btn primary inline-flex px-6 min-h-[48px] text-sm font-bold shadow-md"
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