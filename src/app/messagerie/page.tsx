"use client";

import React from 'react';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { useAuth } from '@/contexts/AuthContext';
import { MessageInbox } from '@/features/messaging/components/MessageInbox';

export default function MessageriePage() {
  const { user, profile, loading } = useAuth();

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#F5F2EC]">
      <Header />

      <MobilePageShell>
        <main className="flex-1 overflow-hidden flex items-center justify-center pt-16 pb-16 md:pb-4 px-2 sm:px-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !user ? (
            <div className="max-w-md w-full mx-auto text-center bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl p-8 shadow-sm">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                💬
              </div>
              <h2 className="text-xl font-bold text-stone-900">Connexion Requise</h2>
              <p className="text-xs text-stone-500 mt-2 mb-6">
                Veuillez vous connecter pour accéder à vos discussions et échanger avec les membres de la communauté LKDV.
              </p>
              <a
                href="/auth/login"
                className="inline-block px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md"
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
            />
          )}
        </main>
      </MobilePageShell>
    </div>
  );
}
