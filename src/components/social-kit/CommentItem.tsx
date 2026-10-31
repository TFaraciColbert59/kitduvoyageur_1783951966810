'use client';

import React from 'react';
import { LikeButton } from './LikeButton';

/** Forme unique d'un commentaire, quelle que soit la source (post, reel, sortie, carnet, club). */
export interface SocialComment {
  id: string;
  authorName: string;
  authorHandle?: string | null;
  authorAvatarUrl?: string | null;
  content: React.ReactNode;
  timeLabel: string;
  likes: number;
  liked: boolean;
  isOwner: boolean;
  replies?: SocialComment[];
  /** Pièce jointe éventuelle (kit, trace, photo) sous le texte. */
  attachment?: React.ReactNode;
}

export interface CommentItemProps {
  comment: SocialComment;
  /** Faux = lecture seule (invité) : compteur de likes sans actions. */
  canInteract: boolean;
  isReply?: boolean;
  onLike?: (comment: SocialComment) => void;
  onReply?: (comment: SocialComment) => void;
  onEdit?: (comment: SocialComment) => void;
  onDelete?: (comment: SocialComment) => void;
  onReport?: (comment: SocialComment) => void;
  onOpenProfile?: (comment: SocialComment) => void;
  /** Zone d'édition en ligne : remplace le texte quand non nulle. */
  editor?: React.ReactNode;
  /** Autorise « Répondre » aussi sur les réponses (le parent reste le commentaire racine). */
  replyOnReplies?: boolean;
}

function CommentAvatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar distant
    return <img className="lkdv-comment-av" src={url} alt="" />;
  }
  return (
    <span className="lkdv-comment-av pmi-author-initial" aria-hidden="true">
      {(name || 'V').charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Commentaire UNIQUE de l'application (markup `.lkdv-comment*` du fil).
 * Les écrans fournissent des données normalisées (`SocialComment`) et des
 * rappels ; la forme, les actions et l'ordre sont identiques partout.
 */
export function CommentItem({
  comment,
  canInteract,
  isReply = false,
  onLike,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onOpenProfile,
  editor,
  replyOnReplies = false,
}: CommentItemProps) {
  return (
    <div id={`comment-${comment.id}`} className={`lkdv-comment ${isReply ? 'is-reply' : ''}`}>
      <CommentAvatar name={comment.authorName} url={comment.authorAvatarUrl} />
      <div className="lkdv-comment-body">
        <div className="lkdv-comment-head">
          {onOpenProfile ? (
            <button type="button" className="lkdv-comment-name" onClick={() => onOpenProfile(comment)}>
              {comment.authorName}
            </button>
          ) : (
            <span className="lkdv-comment-name">{comment.authorName}</span>
          )}
          <span className="lkdv-comment-time">{comment.timeLabel}</span>
        </div>
        {editor ?? <p className="lkdv-comment-text">{comment.content}</p>}
        {comment.attachment}
        <div className="lkdv-comment-actions">
          {canInteract ? (
            <>
              <LikeButton variant="comment" liked={comment.liked} count={comment.likes} onToggle={() => onLike?.(comment)} />
              {(!isReply || replyOnReplies) && onReply ? (
                <button type="button" onClick={() => onReply(comment)}>Répondre</button>
              ) : null}
              {comment.isOwner ? (
                <>
                  {onEdit ? <button type="button" onClick={() => onEdit(comment)}>Modifier</button> : null}
                  {onDelete ? <button type="button" onClick={() => onDelete(comment)}>Supprimer</button> : null}
                </>
              ) : onReport ? (
                <button type="button" onClick={() => onReport(comment)}>Signaler</button>
              ) : null}
            </>
          ) : comment.likes > 0 ? (
            <span className="lkdv-comment-readonly-likes">♥ {comment.likes}</span>
          ) : null}
        </div>
        {comment.replies && comment.replies.length > 0 ? (
          <div className="lkdv-comment-replies">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                isReply
                canInteract={canInteract}
                onLike={onLike}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReport={onReport}
                onOpenProfile={onOpenProfile}
                replyOnReplies={replyOnReplies}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CommentItem;
