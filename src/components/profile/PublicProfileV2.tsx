'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { ProfileDrawerHost } from '@/components/compte/drawer/ProfileDrawerHost';
import { DRAWER_V2_CSS } from '@/components/compte/drawer/SlotShell';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type {
  CompteActiviteItem,
  CompteBadgeItem,
  CompteCarnet,
  CompteClubItem,
  CompteUserProfile,
} from '@/lib/supabase/queries-compte';
import { buildPublicProfilePayload } from './publicProfilePayload';

export interface PublicProfileV2Props {
  profile: CompteUserProfile;
  carnets: CompteCarnet[];
  clubs: CompteClubItem[];
  badges: CompteBadgeItem[];
  activite: CompteActiviteItem[];
  onShare?: () => void;
  onReport?: () => void;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function PublicProfileV2({
  profile,
  carnets,
  clubs,
  badges,
  activite,
  onShare,
  onReport,
}: PublicProfileV2Props) {
  const router = useRouter();
  const { user } = useAuth();
  const owner = Boolean(user?.id && user.id === profile.id);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Voyageur';
  const handle =
    (profile.handle || profile.first_name || 'voyageur')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 24);
  const visibility =
    ((profile as unknown as { profile_visibility?: string }).profile_visibility === 'prive'
      ? 'prive'
      : 'public') as 'public' | 'prive';
  const trust = Number(profile.trust_score ?? 0);

  const payload = useMemo(
    () =>
      buildPublicProfilePayload({
        profile,
        carnets,
        clubs,
        badges,
        activite,
        viewer: owner ? 'owner' : 'visitor',
        visibility,
      }),
    [activite, badges, carnets, clubs, owner, profile, visibility]
  );

  useEffect(() => {
    let active = true;
    setFollowing(false);
    if (!user?.id || owner) return () => { active = false; };
    void createClient()
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active && !error) setFollowing(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [owner, profile.id, user?.id]);

  const toggleFollow = useCallback(async () => {
    if (busy) return;
    if (!user?.id) {
      router.push(`/connexion?redirect=${encodeURIComponent(`/profil/${profile.id}`)}`);
      return;
    }
    if (owner) return;
    setBusy(true);
    setMessage(null);
    const next = !following;
    setFollowing(next);
    const supabase = createClient();
    const { error } = next
      ? await supabase
          .from('user_follows')
          .upsert(
            { follower_id: user.id, following_id: profile.id },
            { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
          )
      : await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);
    if (error) {
      setFollowing(!next);
      setMessage('Abonnement non enregistré. Réessaie.');
    } else {
      setMessage(next ? 'Tu suis ce voyageur.' : 'Tu ne suis plus ce voyageur.');
      window.setTimeout(() => setMessage(null), 2400);
    }
    setBusy(false);
  }, [busy, following, owner, profile.id, router, user?.id]);

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

  return (
    <div className="lkdv-public-profile">
      <div className="lkdv-public-profile-frame">
        <header className="lkdv-public-head">
          <div className="lkdv-public-topbar">
            <button
              type="button"
              className="lkdv-public-icon"
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/communaute'))}
              aria-label="Retour"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <span className="lkdv-public-toplabel">Profil voyageur</span>
            <div className="lkdv-public-topactions">
              <button type="button" className="lkdv-public-icon" onClick={() => void share()} aria-label="Partager le profil">
                <Share2 size={17} aria-hidden="true" />
              </button>
              {!owner && onReport ? (
                <button type="button" className="lkdv-public-icon" onClick={onReport} aria-label="Signaler le profil">
                  <Flag size={16} aria-hidden="true" />
                </button>
              ) : (
                <Link href="/compte" className="lkdv-public-icon" aria-label="Mon compte">
                  <MoreHorizontal size={18} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          <div className="lkdv-public-identity">
            <span className="lkdv-public-avatar" aria-hidden="true">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" loading="lazy" />
              ) : (
                initials(name)
              )}
            </span>
            <div className="lkdv-public-idtext">
              <div className="lkdv-public-name">
                <b>{name}</b>
                {trust >= 70 ? (
                  <span className="lkdv-public-trust" title={`Confiance ${trust}/100`}>
                    <ShieldCheck size={12} aria-hidden="true" /> {trust}
                  </span>
                ) : null}
              </div>
              <span className="lkdv-public-handle">@{handle}</span>
              <span className="lkdv-public-place">
                {profile.location || 'Massif non renseigné'}
                {profile.level?.title ? ` · ${profile.level.title}` : ''}
              </span>
            </div>
          </div>

          <div className="lkdv-public-actions">
            {owner ? (
              <Link href="/compte/modifier" className="lkdv-public-follow">
                Modifier mon profil
              </Link>
            ) : (
              <button
                type="button"
                className={`lkdv-public-follow ${following ? 'on' : ''}`}
                onClick={() => void toggleFollow()}
                disabled={busy}
              >
                {following ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
                {following ? 'Abonné' : 'Suivre'}
              </button>
            )}
            <Link className="lkdv-public-secondary" href={`/messagerie?to=${encodeURIComponent(handle)}`}>
              <MessageCircle size={15} aria-hidden="true" /> Message
            </Link>
          </div>

          <div className="lkdv-public-stats" aria-label="Repères du profil">
            <span>
              <b>{profile.stats?.sorties ?? profile.sorties_count ?? 0}</b> sorties
            </span>
            <span>
              <b>{carnets.length}</b> carnets
            </span>
            <span>
              <b>{clubs.length}</b> clubs
            </span>
            <span>
              <b>{badges.filter((badge) => badge.earned).length}</b> badges
            </span>
          </div>
          {message ? <p className="lkdv-public-message" role="status">{message}</p> : null}
        </header>

        <div className="lkdv-public-drawer">
          <ProfileDrawerHost
            viewer={owner ? 'owner' : 'visitor'}
            visibility={visibility}
            invited={owner || visibility === 'public'}
            payload={payload}
            activeSlot="vitrine"
            state="ready"
          />
        </div>

        <style dangerouslySetInnerHTML={{ __html: PUBLIC_PROFILE_CSS + '\n' + DRAWER_V2_CSS }} />
      </div>
    </div>
  );
}

export const PUBLIC_PROFILE_CSS = `
.lkdv-public-profile{--label:#172B24!important;--label2:#56665D!important;--label3:#6A786F!important;--glass-label:#172B24!important;--glass-label-secondary:#56665D!important;--glass-bg-medium:rgba(255,255,255,.62)!important;--glass-tint:rgba(255,255,255,.52)!important;--card-tint:rgba(255,255,255,.58)!important;--lkv-surface-card:rgba(255,255,255,.58)!important;--accent:#5B7F55!important;--tint:#17402C!important;--pg:#17402C!important;--pg-ink:#fff!important;--sep:rgba(23,43,36,.1)!important;min-height:100dvh!important;width:100%!important;background:radial-gradient(120% 70% at 20% 0%,rgba(175,205,168,.55),transparent 55%),linear-gradient(165deg,#EAF2E5 0%,#DCEAD7 48%,#C9DDC6 100%)!important;color:var(--label,#172B24)!important;padding:0!important;}
.lkdv-public-profile-frame{width:100%!important;max-width:480px!important;min-height:100dvh!important;margin:0 auto!important;display:flex!important;flex-direction:column!important;background:rgba(255,255,255,.28)!important;-webkit-backdrop-filter:blur(22px) saturate(130%)!important;backdrop-filter:blur(22px) saturate(130%)!important;box-shadow:0 0 60px rgba(23,43,36,.14)!important;}
.lkdv-public-head{display:flex!important;flex-direction:column!important;gap:8px!important;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 9px!important;flex:none!important;}
.lkdv-public-topbar{display:flex!important;align-items:center!important;gap:8px!important;}
.lkdv-public-icon{width:36px!important;height:36px!important;border:0!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:rgba(255,255,255,.58)!important;color:#17402C!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;cursor:pointer!important;text-decoration:none!important;flex:none!important;}
.lkdv-public-toplabel{flex:1!important;text-align:center!important;font:600 11px var(--sf)!important;color:var(--label2)!important;letter-spacing:.02em!important;}
.lkdv-public-topactions{display:flex!important;align-items:center!important;gap:6px!important;}
.lkdv-public-identity{display:grid!important;grid-template-columns:54px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;}
.lkdv-public-avatar{width:54px!important;height:54px!important;border-radius:50%!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 17px var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12),0 6px 18px rgba(23,43,36,.1)!important;}
.lkdv-public-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-public-idtext{min-width:0!important;display:flex!important;flex-direction:column!important;gap:1px!important;}
.lkdv-public-name{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;}
.lkdv-public-name b{font:650 18px/1.15 var(--sf)!important;letter-spacing:-.02em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-public-trust{display:inline-flex!important;align-items:center!important;gap:2px!important;height:18px!important;padding:0 6px!important;border-radius:999px!important;background:rgba(61,122,82,.14)!important;color:#2C5E3E!important;font:600 9.5px var(--sf)!important;flex:none!important;}
.lkdv-public-handle{font:500 11.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-public-place{font:500 10.5px var(--sf)!important;color:var(--label3)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-public-actions{display:flex!important;gap:6px!important;}
.lkdv-public-follow{flex:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;height:34px!important;border:0!important;border-radius:999px!important;background:#17402C!important;color:#fff!important;font:600 12px var(--sf)!important;text-decoration:none!important;cursor:pointer!important;box-shadow:0 4px 14px rgba(23,64,44,.18)!important;}
.lkdv-public-follow.on{background:rgba(255,255,255,.66)!important;color:#17402C!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-public-follow:disabled{opacity:.55!important;}
.lkdv-public-secondary{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;height:34px!important;padding:0 12px!important;border-radius:999px!important;background:rgba(255,255,255,.58)!important;color:#17402C!important;font:600 12px var(--sf)!important;text-decoration:none!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-public-stats{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:4px!important;padding:7px 10px!important;border-radius:15px!important;background:rgba(255,255,255,.44)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-public-stats span{font:500 9.5px var(--sf)!important;color:var(--label2)!important;white-space:nowrap!important;}
.lkdv-public-stats b{font:700 12.5px var(--sf)!important;color:var(--label)!important;margin-right:2px!important;}
.lkdv-public-message{margin:0!important;font:500 11px var(--sf)!important;color:#2C5E3E!important;text-align:center!important;}
.lkdv-public-profile .lkdv-slot-selector button{color:#56665D!important;}
.lkdv-public-profile .lkdv-slot-selector button.active{color:#17402C!important;}
.lkdv-public-drawer{flex:1!important;min-height:0!important;display:flex!important;flex-direction:column!important;}
.lkdv-public-drawer>.lkdv-drawer-host{height:100%!important;min-height:0!important;}
@media (min-width:768px){.lkdv-public-profile{padding:24px 0!important;}.lkdv-public-profile-frame{min-height:calc(100dvh - 48px)!important;height:calc(100dvh - 48px)!important;border-radius:30px!important;overflow:hidden!important;border:.5px solid rgba(255,255,255,.7)!important;}}
@media (max-width:360px){.lkdv-public-stats span:nth-child(4){display:none!important;}}
@media (prefers-reduced-motion:reduce){.lkdv-public-profile-frame{backdrop-filter:none!important;}}
`;

export default PublicProfileV2;
