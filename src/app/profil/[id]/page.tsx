'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { LoadingState } from '@/components/ui';
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
import {
  getPreloadedPublicProfile,
  setPreloadedPublicProfile,
} from '@/features/community/reels/reelsPreloadService';

/**
 * Profil public voyageur.
 *
 * Résout automatiquement par UUID ou par handle (@pseudo).
 * En cas de profil introuvable ou inexistant, aucune page morte 404 :
 * redirection automatique vers /communaute avec notification toast en haut.
 */
export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const rawParam = typeof params?.id === 'string' ? decodeURIComponent(params.id).trim() : '';
  const cleanParam = rawParam.replace(/^@/, '');
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanParam);

  const initialBundle = cleanParam ? getPreloadedPublicProfile(cleanParam) : null;

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(
    () => initialBundle?.targetId || null,
  );
  const [profile, setProfile] = useState<CompteUserProfile | null>(
    () => initialBundle?.profile || null,
  );
  const [carnets, setCarnets] = useState<CompteCarnet[]>(() => initialBundle?.carnets || []);
  const [clubs, setClubs] = useState<CompteClubItem[]>(() => initialBundle?.clubs || []);
  const [badges, setBadges] = useState<CompteBadgeItem[]>(() => initialBundle?.badges || []);
  const [activite, setActivite] = useState<CompteActiviteItem[]>(() => initialBundle?.activite || []);
  const [loading, setLoading] = useState<boolean>(() => !initialBundle);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const hasRedirectedRef = useRef(false);

  const triggerNotFoundRedirect = () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    toast('Ce profil voyageur est introuvable ou privé. Retour au flux communauté.', 'info');
    router.replace('/communaute');
  };

  useEffect(() => {
    if (!cleanParam) {
      triggerNotFoundRedirect();
      return;
    }

    let cancelled = false;

    async function resolveAndLoad() {
      // Si nous n'avions pas de bundle préchargé, afficher l'état de chargement
      if (!initialBundle) {
        setLoading(true);
      }
      try {
        const supabase = createClient();

        let targetId: string | null = null;

        if (isUUID) {
          targetId = cleanParam;
        } else {
          // 1. Recherche par handle exact
          let { data: byHandle } = await supabase
            .from(PUBLIC_PROFILES_VIEW)
            .select('id, handle')
            .ilike('handle', cleanParam)
            .maybeSingle();

          // 2. Recherche avec conversion '_' <-> '.'
          if (!byHandle) {
            const dotted = cleanParam.replace(/_/g, '.');
            const { data: byDotted } = await supabase
              .from(PUBLIC_PROFILES_VIEW)
              .select('id, handle')
              .ilike('handle', dotted)
              .maybeSingle();
            if (byDotted) byHandle = byDotted;
          }

          // 3. Aliases créateurs Freedom
          if (!byHandle && (cleanParam === 'thomas_mountains' || cleanParam === 'author-thomas-alps')) {
            const { data: byThomas } = await supabase
              .from(PUBLIC_PROFILES_VIEW)
              .select('id, handle')
              .ilike('handle', 'thomas.mercier')
              .maybeSingle();
            if (byThomas) byHandle = byThomas;
          }

          if (byHandle?.id) {
            targetId = byHandle.id;
          }
        }

        if (!targetId) {
          if (!cancelled) triggerNotFoundRedirect();
          return;
        }

        // Vérification de visibilité dans public_profiles
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        const effectiveViewerId = currentUser?.id || authUser?.id;

        if (effectiveViewerId !== targetId) {
          const { data: visible, error } = await supabase
            .from(PUBLIC_PROFILES_VIEW)
            .select('id')
            .eq('id', targetId)
            .maybeSingle();

          if (cancelled) return;
          if (error || !visible) {
            triggerNotFoundRedirect();
            return;
          }
        }

        setResolvedUserId(targetId);

        // Chargement des données réelles du profil
        const [profileData, carnetsData, clubsData, badgesData, activiteData] =
          await Promise.all([
            fetchFullProfile(targetId),
            fetchUserCarnets(targetId),
            fetchUserClubs(targetId),
            fetchUserBadges(targetId),
            fetchUserActivities(targetId),
          ]);

        if (cancelled) return;
        if (!profileData) {
          triggerNotFoundRedirect();
          return;
        }

        setProfile(profileData);
        setCarnets(carnetsData);
        setClubs(clubsData);
        setBadges(badgesData);
        setActivite(activiteData);

        // Met à jour le cache de préchargement
        setPreloadedPublicProfile(cleanParam, {
          targetId,
          cleanKey: cleanParam,
          profile: profileData,
          carnets: carnetsData,
          clubs: clubsData,
          badges: badgesData,
          activite: activiteData,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('[PublicProfilePage] Error loading profile:', err);
        // Si nous avons déjà les données préchargées affichées, ne pas expulser l'utilisateur
        if (!initialBundle && !cancelled) {
          triggerNotFoundRedirect();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void resolveAndLoad();
    return () => {
      cancelled = true;
    };
  }, [cleanParam, isUUID, currentUser?.id]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--sand-100)]">
        <LoadingState label="Chargement du profil voyageur…" />
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
            toast('Lien du profil copié', 'success');
          }
        }}
        onReport={
          currentUser?.id && currentUser.id !== resolvedUserId
            ? () =>
                setReportTarget({
                  userId: resolvedUserId || '',
                  userName:
                    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
                    'Voyageur',
                })
            : undefined
        }
      />

      <ReportBlockModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSuccess={() => {
          setReportTarget(null);
          toast('Merci, ton signalement a été transmis.', 'success');
        }}
      />
    </>
  );
}
