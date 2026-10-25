'use client';

import React, { useEffect, useState } from 'react';
import { Check, Clock, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';
import type { ReseauUser } from '@/features/compte/server/reseau';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function relativeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

export interface UserRowProps {
  user: ReseauUser;
  mode: 'followers' | 'following';
  busy?: boolean;
  onFollow: (user: ReseauUser) => void;
  onUnfollow: (user: ReseauUser) => void;
}

export function UserRow({ user, mode, busy, onFollow, onUnfollow }: UserRowProps) {
  const [confirming, setConfirming] = useState(false);
  const following = mode === 'following' || user.relation === 'mutual';
  const lastSeen = relativeDate(user.lastActivityAt);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 2600);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const handleFollowClick = () => {
    if (!following) {
      onFollow(user);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onUnfollow(user);
  };

  return (
    <div className="lkdv-reseau-row">
      <a className="lkdv-reseau-avatar" href={`/profil/${encodeURIComponent(user.handle)}`} aria-label={`Profil de ${user.name}`}>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" loading="lazy" />
        ) : (
          initials(user.name)
        )}
      </a>
      <div className="lkdv-reseau-meta">
        <div className="lkdv-reseau-name">
          <a href={`/profil/${encodeURIComponent(user.handle)}`}><b>{user.name}</b></a>
          {user.verified ? <ShieldCheck size={13} aria-label="Profil vérifié" /> : null}
        </div>
        <div className="lkdv-reseau-sub">
          @{user.handle}
          {user.massif ? ` · ${user.massif}` : ''}
        </div>
        <div className="lkdv-reseau-hint">
          {user.relation === 'mutual' ? 'Abonnés mutuels' : user.relation === 'follows_you' ? 'Te suit' : 'Tu suis'}
          {lastSeen ? (
            <>
              <Clock size={11} aria-hidden="true" /> {lastSeen}
            </>
          ) : null}
        </div>
      </div>
      <div className="lkdv-reseau-actions">
        <button
          type="button"
          className={`lkdv-reseau-follow ${following ? 'on' : ''} ${confirming ? 'confirm' : ''}`}
          disabled={busy}
          onClick={handleFollowClick}
          aria-label={following ? `Retirer ${user.name} de tes abonnements` : `Suivre ${user.name}`}
        >
          {following && !confirming ? <Check size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
          {following ? (confirming ? 'Retirer ?' : 'Abonné') : 'Suivre'}
        </button>
        <a
          href={`/messagerie?to=${encodeURIComponent(user.handle)}`}
          className="lkdv-reseau-icon"
          aria-label={`Message à ${user.name}`}
          title="Message"
        >
          <MessageCircle size={15} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export default UserRow;
