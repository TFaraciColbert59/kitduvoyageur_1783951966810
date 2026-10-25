'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { EmptyState, LoadingState } from '@/components/ui';
import ReportBlockModal, { type ReportTarget } from '@/components/ui/ReportBlockModal';
import PublicProfileV2 from '@/components/profile/PublicProfileV2';
import { PUBLIC_PROFILES_VIEW } from '@/lib/queries/publicProfilesCore';
import {
  fetchFullProfile,
  fetchUserCarnets,
  fetchUserClubs,
  fetchUserBadges,
  fetchUserActivities,
  type CompteUserProfile,
  type CompteCarnet,
  type CompteClubItem,
  type CompteBadgeItem,
  type CompteActiviteItem,
} from '@/lib/supabase/queries-compte';

/**
 * Profil public — même langage visuel que le drawer Profil.
 *
 * La page ne fait que charger les données réelles ; toute la présentation est
 * portée par `PublicProfileV2` et le shell partagé du drawer. Aucun mock,
 * aucune fuite d'un profil privé : la visibilité est tranchée avant les
 * requêtes de contenu.
 */
export default function PublicProfilePage() {
  const params = useParams();
  const profileId = typeof params?.id === 'string' ? params.id : '';
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<CompteUserProfile | null>(null);
  const [carnets, setCarnets] = useState<CompteCarnet[]>([]);
  const [clubs, setClubs] = useState<CompteClubItem[]>([]);
  const [badges, setBadges] = useState<CompteBadgeItem[]>([]);
  const [activite, setActivite] = useState<CompteActiviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setNotFound(false);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.id !== profileId) {
          const { data: visibleProfile, error } = await supabase
            .from(PUBLIC_PROFILES_VIEW)
            .select('id')
            .eq('id', profileId)
            .maybeSingle();
          if (cancelled) return;
          if (error || !visibleProfile) {
            setNotFound(true);
            return;
          }
        }

        const [profileData, carnetsData, clubsData, badgesData, activiteData] =
          await Promise.all([
            fetchFullProfile(profileId),
            fetchUserCarnets(profileId),
            fetchUserClubs(profileId),
            fetchUserBadges(profileId),
            fetchUserActivities(profileId),
          ]);
        if (cancelled) return;
        if (!profileData) {
          setNotFound(true);
          return;
        }
        setProfile(profileData);
        setCarnets(carnetsData);
        setClubs(clubsData);
        setBadges(badgesData);
        setActivite(activiteData);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Chargement du profil voyageur…" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-8 text-center backdrop-blur-[var(--blur-lg)]">
          <EmptyState
            title="Profil introuvable"
            description="Ce voyageur n’existe pas ou son profil est privé."
            actionLabel="Explorer la communauté"
            actionHref="/communaute"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <PublicProfileV2
        profile={profile}
        carnets={carnets}
        clubs={clubs}
        badges={badges}
        activite={activite}
        onShare={() => {
          if (typeof window === 'undefined') return;
          const share = { title: profile.first_name || 'Profil voyageur', url: window.location.href };
          if (navigator.share) {
            void navigator.share(share).catch(() => undefined);
          } else {
            void navigator.clipboard?.writeText(window.location.href);
            showToast('Lien du profil copié');
          }
        }}
        onReport={
          currentUser?.id && currentUser.id !== profileId
            ? () =>
                setReportTarget({
                  userId: profileId,
                  userName:
                    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
                    'Voyageur',
                })
            : undefined
        }
      />

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-[var(--z-toast)] -translate-x-1/2 rounded-full border border-white/20 bg-[var(--lkv-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      <ReportBlockModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSuccess={() => {
          setReportTarget(null);
          showToast('Merci, ton signalement a été transmis.');
        }}
      />
    </>
  );
}
