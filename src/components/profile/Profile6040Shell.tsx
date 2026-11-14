'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Flag,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { followErrorMessage, loadFollowState, setFollow } from '@/features/compte/client/followClient';
import type {
  CompteActiviteItem,
  CompteBadgeItem,
  CompteCarnet,
  CompteClubItem,
  CompteUserProfile,
} from '@/lib/supabase/queries-compte';
import { buildPublicProfilePayload } from './publicProfilePayload';
import { DRAWER_V2_CSS } from '@/components/compte/drawer/SlotShell';
import { CompteLiquidGlassV8 } from '@/components/compte/CompteLiquidGlassV8';

const CompteMap = dynamic(
  () => import('@/components/compte/map/CompteMap').then((mod) => mod.CompteMap),
  { ssr: false }
);

const ProfileDrawerHost = dynamic(
  () => import('@/components/compte/drawer/ProfileDrawerHost').then((mod) => mod.ProfileDrawerHost),
  { ssr: false }
);

export interface PublicOutingItem {
  id: string;
  title: string;
  km?: number;
  dplus?: number;
  date?: string;
  visibility?: string;
  cover?: string;
}

export interface Profile6040ShellProps {
  mode: 'owner' | 'visitor';
  profile?: CompteUserProfile | null;
  carnets?: CompteCarnet[];
  clubs?: CompteClubItem[];
  badges?: CompteBadgeItem[];
  activite?: CompteActiviteItem[];
  outings?: PublicOutingItem[];
  targetUserId?: string;
  onShare?: () => void;
  onReport?: () => void;
  // Spécifique owner (/compte)
  onEditProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenCreate?: () => void;
  initialTab?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Profile6040Shell({
  mode,
  profile,
  carnets = [],
  clubs = [],
  badges = [],
  activite = [],
  outings,
  onShare,
  onReport,
  initialTab,
}: Profile6040ShellProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Mode Propriétaire : délègue à la coque complète CompteLiquidGlassV8
  if (mode === 'owner' || (user?.id && profile?.id && user.id === profile.id)) {
    return <CompteLiquidGlassV8 initialTab={initialTab} />;
  }

  return (
    <VisitorProfile6040
      profile={profile}
      carnets={carnets}
      clubs={clubs}
      badges={badges}
      activite={activite}
      outings={outings}
      onShare={onShare}
      onReport={onReport}
      router={router}
      currentUserId={user?.id}
    />
  );
}

interface VisitorProfile6040Props {
  profile?: CompteUserProfile | null;
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  badges: CompteBadgeItem[];
  activite: CompteActiviteItem[];
  outings?: PublicOutingItem[];
  onShare?: () => void;
  onReport?: () => void;
  router: ReturnType<typeof useRouter>;
  currentUserId?: string;
}

function VisitorProfile6040({
  profile,
  carnets,
  clubs,
  badges,
  activite,
  outings,
  onShare,
  onReport,
  router,
  currentUserId,
}: VisitorProfile6040Props) {
  const [following, setFollowing] = useState(false);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const readEpochRef = useRef(0);

  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Voyageur'
    : 'Voyageur';
  const handle = profile
    ? (profile.handle || profile.first_name || 'voyageur')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 24)
    : 'voyageur';

  const rawSigVis = (profile as unknown as { signature_visibility?: string })?.signature_visibility;
  const isSignaturePrivate = rawSigVis === 'prive';
  const visibility =
    ((profile as unknown as { profile_visibility?: string })?.profile_visibility === 'prive'
      ? 'prive'
      : 'public') as 'public' | 'prive';
  const trust = Number(profile?.trust_score ?? 0);

  const payload = useMemo(
    () =>
      profile
        ? buildPublicProfilePayload({
            profile,
            carnets,
            clubs,
            badges,
            activite,
            outings,
            viewer: 'visitor',
            visibility,
          })
        : null,
    [activite, badges, carnets, clubs, outings, profile, visibility]
  );

  useEffect(() => {
    if (!profile?.id || !currentUserId) return;
    let active = true;
    const epoch = ++readEpochRef.current;
    setFollowing(false);
    setRequested(false);
    setBusy(false);

    void loadFollowState(createClient(), currentUserId, profile.id)
      .then((state) => {
        if (!active || epoch !== readEpochRef.current) return;
        setFollowing(state === 'following');
        setRequested(state === 'requested');
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [currentUserId, profile?.id]);

  const toggleFollow = useCallback(async () => {
    if (busy || !profile?.id) return;
    if (!currentUserId) {
      router.push(`/connexion?redirect=${encodeURIComponent(`/profil/${profile.id}`)}`);
      return;
    }
    const epoch = ++readEpochRef.current;
    setBusy(true);
    setMessage(null);
    const wasFollowing = following;
    const wasRequested = requested;
    const action = following || requested ? 'unfollow' : 'follow';
    setFollowing(action === 'follow');
    setRequested(false);
    try {
      const status = await setFollow(profile.id, action);
      if (epoch !== readEpochRef.current) return;
      setFollowing(status === 'following');
      setRequested(status === 'requested');
      setMessage(
        status === 'following'
          ? 'Tu suis ce voyageur.'
          : status === 'requested'
            ? 'Demande de suivi envoyée.'
            : wasRequested
              ? 'Demande de suivi annulée.'
              : 'Tu ne suis plus ce voyageur.'
      );
      window.setTimeout(() => setMessage(null), 2400);
    } catch (error) {
      if (epoch !== readEpochRef.current) return;
      setFollowing(wasFollowing);
      setRequested(wasRequested);
      setMessage(followErrorMessage(error, 'Abonnement non enregistré. Réessaie.'));
    } finally {
      if (epoch === readEpochRef.current) setBusy(false);
    }
  }, [busy, currentUserId, following, profile?.id, requested, router]);

  const share = useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage('Lien copié');
        window.setTimeout(() => setMessage(null), 2000);
      }
    } catch {
      /* annulation */
    }
  }, [name, onShare]);

  const mapContext = useMemo(
    () => ({
      mode: 'overview' as const,
      outingId: null,
    }),
    []
  );

  return (
    <div className="lkdv-6040-root" data-testid="profile-6040-shell">
      {/* ── ZONE HAUTE 60% : Identité, Sceau, Stats, Vitrine ── */}
      <section className="lkdv-6040-top" id="top">
        <header className="lkdv-6040-head">
          <div className="lkdv-6040-topbar">
            <button
              type="button"
              className="lkdv-6040-icon"
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/communaute'))}
              aria-label="Retour"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <span className="lkdv-6040-toplabel">Profil voyageur</span>
            <div className="lkdv-6040-topactions">
              <button
                type="button"
                className="lkdv-6040-icon"
                onClick={() => void share()}
                aria-label="Partager le profil"
              >
                <Share2 size={17} aria-hidden="true" />
              </button>
              {onReport ? (
                <button
                  type="button"
                  className="lkdv-6040-icon"
                  onClick={onReport}
                  aria-label="Signaler ou bloquer"
                >
                  <Flag size={16} aria-hidden="true" />
                </button>
              ) : (
                <Link href="/compte" className="lkdv-6040-icon" aria-label="Mon compte">
                  <MoreHorizontal size={18} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          <div className="lkdv-6040-identity" data-testid="hero-profil">
            <span className="lkdv-6040-avatar" aria-hidden="true">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" loading="lazy" />
              ) : (
                initials(name)
              )}
            </span>
            <div className="lkdv-6040-idtext">
              <div className="lkdv-6040-name">
                <b>{name}</b>
                {trust >= 70 ? (
                  <span className="lkdv-6040-trust" title={`Confiance ${trust}/100`}>
                    <ShieldCheck size={12} aria-hidden="true" /> {trust}
                  </span>
                ) : null}
              </div>
              <span className="lkdv-6040-handle">@{handle}</span>
              <span className="lkdv-6040-place">
                {profile?.location || 'Massif non renseigné'}
                {profile?.level?.title ? ` · ${profile.level.title}` : ''}
              </span>
            </div>
          </div>

          <div className="lkdv-6040-actions">
            <button
              type="button"
              className={`lkdv-6040-follow ${following || requested ? 'on' : ''}`}
              onClick={() => void toggleFollow()}
              disabled={busy}
              aria-pressed={following || requested}
              title={requested ? 'Annuler la demande' : undefined}
            >
              {following || requested ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
              {requested ? 'Demande envoyée' : following ? 'Abonné' : 'Suivre'}
            </button>
            <Link className="lkdv-6040-secondary" href={`/messagerie?to=${encodeURIComponent(handle)}`}>
              <MessageCircle size={15} aria-hidden="true" /> Message
            </Link>
          </div>

          <div className="lkdv-6040-stats" aria-label="Statistiques du profil">
            <span>
              <b>{profile?.stats?.sorties ?? profile?.sorties_count ?? 0}</b> sorties
            </span>
            <span>
              <b>{carnets.length}</b> carnets
            </span>
            <span>
              <b>{clubs.length}</b> clubs
            </span>
            <span>
              <b>{badges.filter((b) => b.earned).length}</b> badges
            </span>
          </div>

          {message ? <p className="lkdv-6040-message" role="status">{message}</p> : null}
        </header>

        {/* Highlights réels (basés exclusivement sur les carnets réels) */}
        {carnets.length > 0 ? (
          <div className="lkdv-6040-highlights-wrap" aria-label="Highlights et carnets réels">
            <div className="lkdv-6040-highlights">
              {carnets.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  href={`/carnets/${c.id}`}
                  className="lkdv-6040-hl-item"
                  title={c.title || 'Carnet'}
                >
                  <span className="lkdv-6040-hl-ring">
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" loading="lazy" />
                    ) : (
                      <span className="lkdv-6040-hl-fallback">{initials(c.title || 'C')}</span>
                    )}
                  </span>
                  <span className="lkdv-6040-hl-title">{c.title || 'Carnet'}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Tiroir / Vitrine React */}
        {payload ? (
          <div className="lkdv-6040-drawer">
            <ProfileDrawerHost
              viewer="visitor"
              visibility={visibility}
              invited={visibility === 'public'}
              payload={payload}
              activeSlot="vitrine"
              state="ready"
            />
          </div>
        ) : null}
      </section>

      {/* ── ZONE BASSE 40% : Carte 3D Liquid Glass (respecte signature_visibility) ── */}
      <section className="lkdv-6040-mapzone" id="mapzone">
        {isSignaturePrivate ? (
          <div className="lkdv-6040-map-private">
            <div className="lkdv-6040-map-private-card">
              <b>Empreinte confidentielle</b>
              <p>Ce voyageur a choisi de garder ses traces et coordonnées GPS privées.</p>
            </div>
          </div>
        ) : (
          <CompteMap
            authState="guest"
            context={mapContext}
            emptyTitle="Carte de l'empreinte publique"
            emptyHint="Seules les traces publiques sont projetées."
          />
        )}
      </section>

      <style dangerouslySetInnerHTML={{ __html: PROFILE_6040_CSS + '\n' + DRAWER_V2_CSS }} />
    </div>
  );
}

export const PROFILE_6040_CSS = `
.lkdv-6040-root {
  --label: #172B24 !important;
  --label2: #56665D !important;
  --label3: #6A786F !important;
  --glass-label: #172B24 !important;
  --glass-label-secondary: #56665D !important;
  --glass-bg-medium: rgba(255, 255, 255, 0.62) !important;
  --accent: #5B7F55 !important;
  --tint: #17402C !important;
  position: relative !important;
  width: 100% !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  background: radial-gradient(120% 70% at 20% 0%, rgba(175, 205, 168, 0.55), transparent 55%),
              linear-gradient(165deg, #EAF2E5 0%, #DCEAD7 48%, #C9DDC6 100%) !important;
  color: #172B24 !important;
}

.lkdv-6040-top {
  position: relative !important;
  height: 60% !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  z-index: 10 !important;
  background: rgba(255, 255, 255, 0.42) !important;
  -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
  backdrop-filter: blur(24px) saturate(160%) !important;
  border-bottom: 0.5px solid rgba(23, 43, 36, 0.12) !important;
  box-shadow: 0 4px 20px rgba(23, 43, 36, 0.08) !important;
}

.lkdv-6040-head {
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  padding: calc(10px + env(safe-area-inset-top, 0px)) 14px 6px !important;
  flex: none !important;
}

.lkdv-6040-topbar {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.lkdv-6040-icon {
  width: 36px !important;
  height: 36px !important;
  border: 0 !important;
  border-radius: 50% !important;
  display: grid !important;
  place-items: center !important;
  background: rgba(255, 255, 255, 0.72) !important;
  color: #17402C !important;
  box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23, 43, 36, 0.1) !important;
  cursor: pointer !important;
  text-decoration: none !important;
  flex: none !important;
}

.lkdv-6040-toplabel {
  flex: 1 !important;
  text-align: center !important;
  font: 600 11px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #56665D !important;
  letter-spacing: 0.02em !important;
}

.lkdv-6040-topactions {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.lkdv-6040-identity {
  display: grid !important;
  grid-template-columns: 54px minmax(0, 1fr) !important;
  align-items: center !important;
  gap: 10px !important;
}

.lkdv-6040-avatar {
  width: 54px !important;
  height: 54px !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  display: grid !important;
  place-items: center !important;
  background: linear-gradient(155deg, #fff, #DDEBD8) !important;
  color: #17402C !important;
  font: 700 17px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23, 43, 36, 0.12), 0 6px 18px rgba(23, 43, 36, 0.1) !important;
}

.lkdv-6040-avatar img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

.lkdv-6040-idtext {
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 1px !important;
}

.lkdv-6040-name {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  min-width: 0 !important;
}

.lkdv-6040-name b {
  font: 650 18px/1.15 -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  letter-spacing: -0.02em !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.lkdv-6040-trust {
  display: inline-flex !important;
  align-items: center !important;
  gap: 2px !important;
  height: 18px !important;
  padding: 0 6px !important;
  border-radius: 999px !important;
  background: rgba(61, 122, 82, 0.14) !important;
  color: #2C5E3E !important;
  font: 600 9.5px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  flex: none !important;
}

.lkdv-6040-handle {
  font: 500 11.5px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #56665D !important;
}

.lkdv-6040-place {
  font: 500 10.5px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #6A786F !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.lkdv-6040-actions {
  display: flex !important;
  gap: 6px !important;
}

.lkdv-6040-follow {
  flex: 1 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
  height: 34px !important;
  border: 0 !important;
  border-radius: 999px !important;
  background: #17402C !important;
  color: #fff !important;
  font: 600 12px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  text-decoration: none !important;
  cursor: pointer !important;
  box-shadow: 0 4px 14px rgba(23, 64, 44, 0.18) !important;
}

.lkdv-6040-follow.on {
  background: rgba(255, 255, 255, 0.72) !important;
  color: #17402C !important;
  box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23, 43, 36, 0.12) !important;
}

.lkdv-6040-secondary {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
  height: 34px !important;
  padding: 0 12px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.72) !important;
  color: #17402C !important;
  font: 600 12px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  text-decoration: none !important;
  box-shadow: inset 0 1px 0 #fff, 0 0 0 0.5px rgba(23, 43, 36, 0.1) !important;
}

.lkdv-6040-stats {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 4px !important;
  padding: 7px 10px !important;
  border-radius: 15px !important;
  background: rgba(255, 255, 255, 0.56) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 0 0.5px rgba(23, 43, 36, 0.07) !important;
}

.lkdv-6040-stats span {
  font: 500 9.5px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #56665D !important;
  white-space: nowrap !important;
}

.lkdv-6040-stats b {
  font: 700 12.5px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #172B24 !important;
  margin-right: 2px !important;
}

.lkdv-6040-message {
  margin: 0 !important;
  font: 500 11px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #2C5E3E !important;
  text-align: center !important;
}

.lkdv-6040-highlights-wrap {
  padding: 4px 14px 8px !important;
  overflow-x: auto !important;
  scrollbar-width: none !important;
}

.lkdv-6040-highlights-wrap::-webkit-scrollbar {
  display: none !important;
}

.lkdv-6040-highlights {
  display: flex !important;
  gap: 12px !important;
  align-items: center !important;
}

.lkdv-6040-hl-item {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 4px !important;
  text-decoration: none !important;
  color: #172B24 !important;
  flex: none !important;
  width: 58px !important;
}

.lkdv-6040-hl-ring {
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  padding: 2px !important;
  border: 1.5px solid #5B7F55 !important;
  overflow: hidden !important;
  display: grid !important;
  place-items: center !important;
  background: rgba(255, 255, 255, 0.8) !important;
}

.lkdv-6040-hl-ring img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  border-radius: 50% !important;
}

.lkdv-6040-hl-fallback {
  font: 700 13px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #17402C !important;
}

.lkdv-6040-hl-title {
  font: 500 10px/1.2 -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #56665D !important;
  text-align: center !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  max-width: 58px !important;
}

.lkdv-6040-drawer {
  flex: 1 1 auto !important;
  min-height: 0 !important;
}

.lkdv-6040-mapzone {
  position: relative !important;
  height: 40% !important;
  min-height: 0 !important;
  width: 100% !important;
  overflow: hidden !important;
  z-index: 5 !important;
  background: #EAF2E5 !important;
}

.lkdv-6040-mapzone .lkdv-map-root {
  position: absolute !important;
  inset: 0 !important;
  height: 100% !important;
}

.lkdv-6040-map-private {
  position: absolute !important;
  inset: 0 !important;
  display: grid !important;
  place-items: center !important;
  padding: 20px !important;
  background: rgba(240, 245, 238, 0.6) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  backdrop-filter: blur(12px) !important;
}

.lkdv-6040-map-private-card {
  padding: 16px 20px !important;
  border-radius: 20px !important;
  background: rgba(255, 255, 255, 0.82) !important;
  border: 0.5px solid rgba(23, 43, 36, 0.12) !important;
  box-shadow: 0 4px 18px rgba(23, 43, 36, 0.08) !important;
  text-align: center !important;
  max-width: 320px !important;
}

.lkdv-6040-map-private-card b {
  display: block !important;
  font: 600 13px -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #17402C !important;
  margin-bottom: 4px !important;
}

.lkdv-6040-map-private-card p {
  margin: 0 !important;
  font: 400 11px/1.4 -apple-system, 'SF Pro Text', Inter, sans-serif !important;
  color: #56665D !important;
}
`;

export default Profile6040Shell;
