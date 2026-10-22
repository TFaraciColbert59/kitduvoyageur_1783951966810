'use client';

import React, { useEffect, useState } from 'react';
import { Check, Clock, MessageCircle, ShieldCheck, Star, UserPlus } from 'lucide-react';
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
  onCordee: (user: ReseauUser) => void;
}

export function UserRow({ user, mode, busy, onFollow, onUnfollow, onCordee }: UserRowProps) {
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
      <span className="lkdv-reseau-avatar" aria-hidden="true">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" loading="lazy" />
        ) : (
          initials(user.name)
        )}
      </span>
      <div className="lkdv-reseau-meta">
        <div className="lkdv-reseau-name">
          <b>{user.name}</b>
          {user.verified ? <ShieldCheck size={13} aria-label="Profil vérifié" /> : null}
          {user.closeFriend ? <Star size={12} aria-label="Dans ta cordée" /> : null}
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
        <button
          type="button"
          className={`lkdv-reseau-icon ${user.closeFriend ? 'on' : ''}`}
          onClick={() => onCordee(user)}
          disabled={busy}
          aria-label={user.closeFriend ? `Retirer ${user.name} de la cordée` : `Ajouter ${user.name} à la cordée`}
          title={user.closeFriend ? 'Retirer de la cordée' : 'Ajouter à la cordée'}
        >
          <Star size={15} aria-hidden="true" />
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
