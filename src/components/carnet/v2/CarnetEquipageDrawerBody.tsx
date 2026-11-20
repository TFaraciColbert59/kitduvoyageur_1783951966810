'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  Copy,
  Package,
  Radio,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import LikeIcon from '@/components/social-kit/LikeIcon';
import type { CarnetDetail, CarnetParticipant } from '@/features/carnet/detail/types';
import {
  AnimatedNumber,
  CARNET_SPRING,
  StaggerCard,
  StaggerList,
} from './CarnetDrawerMotion';

interface CarnetDayReactionsView {
  likesCount: number;
  liked: boolean;
  toggleLike: () => void;
  comments: Array<{
    id: string;
    authorId?: string | null;
    authorName: string;
    content: string;
  }>;
  addComment: (text: string) => Promise<void> | void;
  deleteComment: (commentId: string) => Promise<void> | void;
}

interface CarnetEquipageDrawerBodyProps {
  detail: CarnetDetail;
  lensId: string;
  userId?: string | null;
  reactionDay: number;
  onReactionDayChange: (day: number) => void;
  reactions: CarnetDayReactionsView;
  newCommentText: string;
  onNewCommentTextChange: (val: string) => void;
  onSelectParticipant: (p: CarnetParticipant) => void;
  onJumpToParticipantKit?: (userId: string) => void;
  onRequireAuth?: () => void;
  onIsland?: (msg: string) => void;
}

function roleLabel(role?: string | null): string {
  if (role === 'author' || role === 'owner') return 'Organisateur';
  if (role === 'collaborator' || role === 'co_author') return 'Co-auteur';
  return 'Participant';
}

export function CarnetEquipageDrawerBody({
  detail,
  lensId,
  userId,
  reactionDay,
  onReactionDayChange,
  reactions,
  newCommentText,
  onNewCommentTextChange,
  onSelectParticipant,
  onJumpToParticipantKit,
  onRequireAuth,
  onIsland,
}: CarnetEquipageDrawerBodyProps) {
  const momentsCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of detail.moments) {
      if (m.authorId) {
        map.set(m.authorId, (map.get(m.authorId) ?? 0) + 1);
      } else if (m.authorName) {
        map.set(m.authorName, (map.get(m.authorName) ?? 0) + 1);
      }
    }
    return map;
  }, [detail.moments]);

  if (lensId === 'participants') {
    if (detail.participants.length === 0) {
      return (
        <div className="lkdv-carnet-empty-card">
          <Users size={22} aria-hidden="true" />
          <b>Aucun participant</b>
          <p>Les membres de l’expédition apparaîtront ici.</p>
        </div>
      );
    }

    return (
      <StaggerList className="lkdv-carnet-cards-col">
        {detail.participants.map((p) => {
          const displayName = p.name?.trim() || p.handle?.trim() || 'Voyageur';
          const initial = displayName.slice(0, 1).toUpperCase();
          const momentCount =
            momentsCountByUser.get(p.userId) ??
            (p.name ? momentsCountByUser.get(p.name) : 0) ??
            0;
          const memberKit =
            detail.memberKits?.[p.userId] ??
            (p.userId === detail.author?.id ? detail.kit : undefined);
          const kitWeightG = memberKit?.totalWeightG ?? null;
          const hasKitItems = (memberKit?.items.length ?? 0) > 0;

          return (
            <StaggerCard key={p.userId} className="lkdv-carnet-crew-card">
              <button
                type="button"
                className="lkdv-carnet-crew-main"
                onClick={() => onSelectParticipant(p)}
              >
                <span className="lkdv-carnet-crew-avatar">
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" />
                  ) : (
                    initial
                  )}
                </span>
                <div className="lkdv-carnet-crew-meta">
                  <div className="lkdv-carnet-crew-name-row">
                    <b>{displayName}</b>
                    <span className="lkdv-carnet-chip-soft">{roleLabel(p.role)}</span>
                  </div>
                  <div className="lkdv-carnet-crew-stats">
                    <span>
                      {momentCount} moment{momentCount > 1 ? 's' : ''}
                    </span>
                    {hasKitItems && kitWeightG ? (
                      <span>· Sac {(kitWeightG / 1000).toFixed(1).replace('.', ',')} kg</span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight size={15} className="lkdv-carnet-chevron" />
              </button>

              {hasKitItems && onJumpToParticipantKit ? (
                <button
                  type="button"
                  className="lkdv-carnet-crew-kit-btn"
                  onClick={() => onJumpToParticipantKit(p.userId)}
                >
                  <Package size={12} aria-hidden="true" />
                  <span>Voir son kit</span>
                </button>
              ) : null}
            </StaggerCard>
          );
        })}
      </StaggerList>
    );
  }

  if (lensId === 'reactions') {
    const days = detail.days.length > 0 ? detail.days : [{ index: 1, dayNumber: 1 }];

    return (
      <div className="lkdv-carnet-drawer-pane">
        <div className="lkdv-carnet-filter-rail" role="group" aria-label="Jour des réactions">
          {days.map((d) => {
            const n = d.dayNumber ?? d.index ?? 1;
            const on = n === reactionDay;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                className={`lkdv-carnet-filter-pill${on ? ' is-active' : ''}`}
                onClick={() => onReactionDayChange(n)}
              >
                {on ? (
                  <motion.span
                    layoutId="carnet-reaction-day-pill"
                    className="lkdv-carnet-filter-pill-bg"
                    transition={CARNET_SPRING}
                  />
                ) : null}
                <span className="lkdv-carnet-filter-pill-label">Jour {n}</span>
              </button>
            );
          })}
        </div>

        <div className="lkdv-carnet-kudos-card">
          <div>
            <b>Jour {reactionDay}</b>
            <p>
              <AnimatedNumber value={reactions.likesCount} /> mention
              {reactions.likesCount > 1 ? 's' : ''} J’aime
            </p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            className={`lkdv-carnet-like-btn${reactions.liked ? ' is-liked' : ''}`}
            onClick={reactions.toggleLike}
            aria-pressed={reactions.liked}
            aria-label={reactions.liked ? 'Retirer mon j’aime du jour' : 'J’aime ce jour'}
          >
            <LikeIcon size={15} active={reactions.liked} />
            <span>{reactions.liked ? 'Aimé' : 'J’aime'}</span>
          </motion.button>
        </div>

        <span className="lkdv-carnet-kit-eyebrow" style={{ marginTop: 4 }}>
          Commentaires ({reactions.comments.length})
        </span>

        <StaggerList className="lkdv-carnet-cards-col">
          {reactions.comments.length === 0 ? (
            <div className="lkdv-carnet-empty-card" style={{ padding: '16px' }}>
              <p style={{ margin: 0 }}>Soyez le premier à encourager l’équipage sur ce jour.</p>
            </div>
          ) : (
            reactions.comments.map((c) => (
              <StaggerCard key={c.id} className="lkdv-carnet-comment-bubble">
                <div className="lkdv-carnet-comment-head">
                  <b>{c.authorName}</b>
                  {userId && c.authorId === userId ? (
                    <button
                      type="button"
                      className="lkdv-carnet-comment-del"
                      onClick={() => reactions.deleteComment(c.id)}
                      aria-label="Supprimer mon commentaire"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
                <p>{c.content}</p>
              </StaggerCard>
            ))
          )}
        </StaggerList>

        <div className="lkdv-carnet-comment-composer">
          <input
            type="text"
            placeholder="Écrire un mot d’encouragement…"
            value={newCommentText}
            onChange={(e) => onNewCommentTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCommentText.trim()) {
                void reactions.addComment(newCommentText);
                onNewCommentTextChange('');
              }
            }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (newCommentText.trim()) {
                void reactions.addComment(newCommentText);
                onNewCommentTextChange('');
              }
            }}
            aria-label="Envoyer le commentaire"
          >
            <Send size={15} />
          </motion.button>
        </div>
      </div>
    );
  }

  // lensId === 'suivre'
  const isLive = Boolean(detail.liveSharing);
  return (
    <StaggerList className="lkdv-carnet-drawer-pane">
      <StaggerCard className="lkdv-carnet-follow-card">
        <div className="lkdv-carnet-follow-head">
          <span className={`lkdv-carnet-live-badge${isLive ? ' is-live' : ''}`}>
            {isLive ? (
              <motion.span
                className="lkdv-carnet-live-dot"
                animate={{ scale: [1, 1.45, 1], opacity: [1, 0.45, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            ) : (
              <Radio size={13} aria-hidden="true" />
            )}
            <span>{isLive ? 'Suivi en direct actif' : 'Suivi du carnet'}</span>
          </span>
        </div>
        <b>Rester informé de l’expédition</b>
        <p>
          Recevez une notification lors de la publication d’une nouvelle étape ou d’un moment fort.
        </p>
        <div className="lkdv-carnet-follow-actions">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="lkdv-carnet-btn-primary"
            onClick={() => {
              if (!userId) {
                onRequireAuth?.();
              } else {
                toast.success('Vous suivez désormais cette expédition');
                onIsland?.('Vous suivez désormais cette expédition');
              }
            }}
          >
            <Bell size={14} aria-hidden="true" />
            <span>Suivre cette expédition</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="lkdv-carnet-btn-soft"
            onClick={() => {
              if (typeof window !== 'undefined') {
                void navigator.clipboard.writeText(window.location.href);
                toast.success('Lien copié dans le presse-papier');
                onIsland?.('Lien copié dans le presse-papier');
              }
            }}
          >
            <Copy size={14} aria-hidden="true" />
            <span>Partager</span>
          </motion.button>
        </div>
      </StaggerCard>
    </StaggerList>
  );
}
