"use client";

import React from 'react';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { useAuth } from '@/contexts/AuthContext';
import { MessageInbox } from '@/features/messaging/components/MessageInbox';
import { useKeyboardInset } from '@/features/messaging/hooks/useKeyboardInset';
import { Button, Card, LoadingState } from '@/components/ui';
import Link from 'next/link';

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
      className="relative flex min-h-[100dvh] w-full flex-1 flex-col overflow-hidden bg-[color:var(--lkv-surface)]/75 backdrop-blur-[var(--blur-md)]"
      style={{ ['--kb-inset' as string]: `${kbInset}px` }}
    >
      {/* Ambiance Liquid Glass LKDV — dégradés climatiques (tokens) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--lkv-app-bg-glow-sage),transparent_55%),radial-gradient(ellipse_at_bottom_right,var(--lkv-app-bg-glow-forest),transparent_50%),radial-gradient(ellipse_at_50%_15%,rgba(168,200,160,0.14),transparent_60%)]"
      />

      {/* Header global desktop */}
      <div className="relative z-10 hidden md:block">
        <Header />
      </div>

      {/*
        safeTop={false} : ConversationList gère lui-même la safe-area top
        dans son header sticky (cf. .msg-safe-top). videoBackground={false} :
        le chat est opaque plein écran, la vidéo de fond serait un coût pur.
      */}
      <MobilePageShell safeTop={false} hasBottomNav={!hasActiveConv} videoBackground={false}>
        <main
          className="relative z-10 flex w-full flex-1 flex-col items-center justify-center overflow-hidden md:px-6 md:pb-2 md:pt-2"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <LoadingState label="Chargement de la messagerie" />
            </div>
          ) : !user ? (
            <Card className="m-[var(--space-4)] w-full max-w-md text-center">
              <div className="mx-auto mb-[var(--space-4)] flex size-16 items-center justify-center rounded-full bg-[color:var(--lkv-primary)]/10 text-2xl text-[color:var(--lkv-primary)]">
                💬
              </div>
              <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">
                Connexion requise
              </h2>
              <p className="mb-[var(--space-6)] mt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                Connectez-vous pour accéder à vos discussions et échanger avec les
                membres de la communauté LKDV.
              </p>
              <Link href="/connexion" className="block w-full">
                <Button variant="primary" size="lg" fullWidth>
                  Se connecter
                </Button>
              </Link>
            </Card>
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
