'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ProfileSettings, ShareStats } from '@/features/compte/server/compte';
import { DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { fetchJson, initials } from './shared';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export function SharePane() {
  const [copied, setCopied] = useState(false);
  const profileQuery = useQuery({
    queryKey: ['compte', 'profile'],
    queryFn: () => fetchJson<ProfileSettings>('/api/compte/compte/profile'),
    staleTime: 30_000,
  });
  const shareQuery = useQuery({
    queryKey: ['compte', 'share'],
    queryFn: () => fetchJson<ShareStats>('/api/compte/compte/share'),
    staleTime: 30_000,
  });

  const profile = profileQuery.data;
  const stats = shareQuery.data;
  const absoluteUrl = useMemo(() => {
    if (!stats?.url) return '';
    if (typeof window === 'undefined') return stats.url;
    return `${window.location.origin}${stats.url}`;
  }, [stats?.url]);
  const qrUrl = absoluteUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(absoluteUrl)}`
    : '';

  if (profileQuery.isLoading || shareQuery.isLoading) return <DrawerSkeleton />;
  if (profileQuery.isError || shareQuery.isError || !profile || !stats) {
    return (
      <DrawerError
        onRetry={() => {
          void profileQuery.refetch();
          void shareQuery.refetch();
        }}
      />
    );
  }

  const share = async () => {
    if (!absoluteUrl) return;
    const payload = {
      title: `${profile.name || 'Mon profil'} · Le Kit du Voyageur`,
      text: profile.bio || 'Retrouve mon profil et mes sorties vérifiées.',
      url: absoluteUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        return;
      }
    }
    await copy();
  };

  const copy = async () => {
    if (!absoluteUrl) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="lkdv-compte-pane lkdv-compte-share">
      <div className="lkdv-compte-share-card">
        <div className="lkdv-compte-share-glow" aria-hidden="true" />
        <div className="lkdv-compte-share-head">
          <span className="lkdv-compte-share-avatar" aria-hidden="true">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" loading="lazy" />
            ) : (
              initials(profile.name || 'LKDV')
            )}
          </span>
          <div>
            <b>{profile.name || 'Ton profil'}</b>
            <small>@{profile.handle || 'handle'}</small>
            {profile.location ? <span>{profile.location}</span> : null}
          </div>
        </div>

        <div className="lkdv-compte-share-qr">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt={`QR code du profil de ${profile.name || 'voyageur'}`}
              width={176}
              height={176}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <LKDVIcon name="scanner" size={48} aria-hidden="true" />
          )}
          <span className="lkdv-compte-share-seal" aria-hidden="true">
            <LKDVIcon name="securite" size={18} />
          </span>
        </div>

        <p className="lkdv-compte-share-url">{absoluteUrl || 'Lien indisponible'}</p>

        <div className="lkdv-compte-share-actions">
          <button type="button" className="lkdv-compte-btn primary" onClick={() => void share()}>
            <LKDVIcon name="partager" size={15} aria-hidden="true" /> Partager
          </button>
          <button type="button" className="lkdv-compte-btn ghost" onClick={() => void copy()}>
            {copied ? <LKDVIcon name="valider" size={15} aria-hidden="true" /> : <LKDVIcon name="dupliquer" size={15} aria-hidden="true" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
          <Link className="lkdv-compte-btn ghost" href={stats.url || '/profil'} target="_blank">
            <LKDVIcon name="lien" size={15} aria-hidden="true" /> Voir
          </Link>
        </div>
      </div>

      <div className="lkdv-compte-share-stats">
        <div>
          <small>Vues · 7 jours</small>
          <b>{stats.views7d}</b>
        </div>
        <div>
          <small>Vues · 30 jours</small>
          <b>{stats.views30d}</b>
        </div>
        <div>
          <small>Visibilité</small>
          <b>{profile.visibility === 'public' ? 'Public' : 'Privé'}</b>
        </div>
      </div>

      <section className="lkdv-compte-share-note">
        <b>
          <LKDVIcon name="securite" size={14} aria-hidden="true" /> Ton profil privé reste sur invitation
        </b>
        <p>
          Partager ce lien n’ouvre pas ton profil privé : seules les personnes que tu acceptes
          voient tes sorties.
        </p>
      </section>
    </div>
  );
}

export default SharePane;
