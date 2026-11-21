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
import { CarnetCommentsPane } from '@/components/carnet/profile/panes/CarnetCommentsPane';
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
  addComment: (text: string) => Promise<unknown> | void;
  deleteComment: (commentId: string) => Promise<unknown> | void;
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
  onSelectDay?: (dayNumber: number) => void;
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
  onSelectDay,
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
            </StaggerCard>
          );
        })}
      </StaggerList>
    );
  }

  if (lensId === 'reactions') {
    const days = detail.days.length > 0 ? detail.days : [{ index: 1, dayNumber: 1 }];
    const paneComments = reactions.comments.map((c) => ({
      id: c.id,
      authorId: c.authorId ?? null,
      authorName: c.authorName,
      authorAvatar: null,
      content: c.content,
      createdAt: '',
    }));

    const activeEtape = detail.etapes.find((e) => e.dayNumber === reactionDay);
    const activeDayLabel = activeEtape?.to || activeEtape?.from || null;

    return (
      <StaggerList className="lkdv-carnet-drawer-pane" style={{ gap: '12px' }}>
        {/* Sélecteur de jour compact en pilules */}
        <div
          role="tablist"
          aria-label="Jours des réactions"
          className="lkdv-carnet-filter-rail"
          style={{ paddingBottom: '2px' }}
        >
          {days.map((d) => {
            const n = d.dayNumber ?? d.index ?? 1;
            const dayReact = detail.dayReactions?.[n];
            const isCurrent = n === reactionDay;
            const liked = isCurrent ? reactions.liked : Boolean(dayReact?.userLiked);
            const count = isCurrent ? reactions.likesCount : (dayReact?.likesCount ?? 0);

            return (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => onReactionDayChange(n)}
                className={`lkdv-carnet-filter-pill${isCurrent ? ' is-active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  height: '34px',
                  flexShrink: 0,
                }}
              >
                {isCurrent ? <span className="lkdv-carnet-filter-pill-bg" /> : null}
                <span
                  className="lkdv-carnet-filter-pill-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <LikeIcon
                    size={13}
                    active={liked}
                    style={{ color: liked ? '#e11d48' : 'currentColor' }}
                  />
                  <span>J{n}</span>
                  <span style={{ opacity: 0.72, fontSize: '11px' }}>{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Carte du jour sélectionné */}
        <StaggerCard
          className="lkdv-carnet-follow-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 14px',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <b style={{ fontSize: '14px', color: 'var(--label, #172b24)' }}>
                Jour {reactionDay}
              </b>
              {onSelectDay ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(reactionDay)}
                  style={{
                    border: 0,
                    background: 'rgba(27, 67, 50, 0.08)',
                    color: '#1b4332',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Voir sur la carte
                </button>
              ) : null}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--label2, #56665d)',
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeDayLabel ? `${activeDayLabel} · ` : ''}
              {reactions.likesCount} j’aime · {paneComments.length} commentaire
              {paneComments.length > 1 ? 's' : ''}
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => reactions.toggleLike()}
            aria-pressed={reactions.liked}
            aria-label={
              reactions.liked
                ? `Retirer mon j’aime du jour ${reactionDay}`
                : `J’aime le jour ${reactionDay}`
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 14px',
              borderRadius: '999px',
              border: reactions.liked
                ? '1px solid rgba(225, 29, 72, 0.28)'
                : '1px solid rgba(23, 43, 36, 0.14)',
              background: reactions.liked
                ? 'rgba(225, 29, 72, 0.1)'
                : 'rgba(255, 255, 255, 0.85)',
              color: reactions.liked ? '#e11d48' : '#17402c',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <LikeIcon size={15} active={reactions.liked} />
            <span>{reactions.liked ? 'Aimé' : 'J’aime'}</span>
          </motion.button>
        </StaggerCard>

        {/* Commentaires du jour */}
        <StaggerCard
          className="lkdv-carnet-follow-card"
          style={{ padding: '12px 14px' }}
        >
          <CarnetCommentsPane
            comments={paneComments}
            loading={false}
            canWrite={Boolean(userId)}
            currentUserId={userId ?? null}
            onSend={async (content) => {
              await reactions.addComment(content);
              return true;
            }}
            onRemove={async (commentId) => {
              await reactions.deleteComment(commentId);
              return true;
            }}
            onRequireAuth={onRequireAuth ?? (() => {})}
          />
        </StaggerCard>
      </StaggerList>
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
