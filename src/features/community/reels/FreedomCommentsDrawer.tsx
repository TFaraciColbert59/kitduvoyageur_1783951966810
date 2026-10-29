'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Plus, Image as ImageIcon, Heart, CornerDownRight } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { KitCard } from '@/features/messaging/components/KitCard';
import { GPXPreviewCard } from '@/features/messaging/components/GPXPreviewCard';
import { ProductCard } from '@/features/messaging/components/ProductCard';
import { TrailCard } from '@/features/messaging/components/TrailCard';
import { FreedomComposerMenuSheet } from './FreedomComposerMenuSheet';
import { fetchReelComments, postReelComment } from './freedomReelsService';
import type { FreedomComment, FreedomCommentAttachment } from './freedom-types';

export interface FreedomCommentsDrawerProps {
  isOpen: boolean;
  reelId: string;
  currentUser?: any;
  onClose: () => void;
  onCommentsCountChange?: (count: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export const FreedomCommentsDrawer: React.FC<FreedomCommentsDrawerProps> = ({
  isOpen,
  reelId,
  currentUser,
  onClose,
  onCommentsCountChange,
}) => {
  const { haptic } = useHapticFeedback();
  const [comments, setComments] = useState<FreedomComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<FreedomCommentAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<FreedomComment | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchReelComments(reelId, currentUser)
      .then((data) => {
        setComments(data);
        onCommentsCountChange?.(data.length);
      })
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [isOpen, reelId, currentUser, onCommentsCountChange]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) setMenuOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, menuOpen, onClose]);

  const handleSend = async () => {
    if ((!inputText.trim() && !pendingAttachment) || submitting) return;
    haptic('light');
    setSubmitting(true);

    try {
      const newComment = await postReelComment(
        reelId,
        currentUser,
        inputText,
        pendingAttachment,
        replyingTo?.id || null,
      );

      setComments((prev) => [...prev, newComment]);
      onCommentsCountChange?.(comments.length + 1);
      setInputText('');
      setPendingAttachment(null);
      setReplyingTo(null);

      // Scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch (e) {
      console.error('[Freedom] Error posting comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = (commentId: string) => {
    haptic('selection');
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const nextLiked = !c.isLiked;
        return {
          ...c,
          isLiked: nextLiked,
          likesCount: nextLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
        };
      }),
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      haptic('light');
      const url = URL.createObjectURL(file);
      setPendingAttachment({
        type: 'photo',
        photoUrl: url,
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      className="freedom-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Discussion Freedom"
    >
      <div
        className="freedom-drawer-sheet"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(e) => {
          const start = touchStartY.current;
          if (start === null) return;
          const currentY = e.touches[0]?.clientY ?? start;
          const deltaY = currentY - start;
          if (deltaY > 120 && (!listRef.current || listRef.current.scrollTop <= 0)) {
            onClose();
          }
        }}
      >
        {/* Grab Handle */}
        <div className="freedom-drawer-grab" aria-hidden="true" onClick={onClose}>
          <span />
        </div>

        {/* Header */}
        <div className="freedom-drawer-header">
          <span className="freedom-drawer-title">
            Commentaires ({comments.length})
          </span>
          <button
            type="button"
            className="freedom-drawer-close"
            onClick={onClose}
            aria-label="Fermer les commentaires"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Comments Scrollable List */}
        <div ref={listRef} className="freedom-drawer-content space-y-4">
          {loading ? (
            <p className="py-8 text-center text-xs text-[#56665D]">Chargement des commentaires…</p>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-[#172B24]">Aucun commentaire pour le moment.</p>
              <p className="mt-1 text-xs text-[#56665D]">
                Sois le premier à échanger ou partager un kit/trace GPX !
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                {/* Avatar */}
                <div className="size-8 shrink-0 overflow-hidden rounded-full border border-black/10 bg-[#17402C]/10 text-center font-bold text-[#17402C]">
                  {comment.author.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-xs">
                      {comment.author.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#172B24]">
                      {comment.author.name}
                    </span>
                    <span className="text-[10px] text-[#56665D]">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>

                  {comment.content && (
                    <p className="text-xs text-[#172B24] leading-relaxed">
                      {comment.content}
                    </p>
                  )}

                  {/* Rich Attachments (Kits, GPX, Product, Trail, Photo) */}
                  {comment.attachment && (
                    <div className="pt-1.5">
                      {comment.attachment.type === 'kit' && comment.attachment.kit && (
                        <KitCard meta={comment.attachment.kit} isMine={comment.isOwner} />
                      )}

                      {comment.attachment.type === 'gpx' && comment.attachment.gpx && (
                        <GPXPreviewCard
                          fileName={comment.attachment.gpx.name}
                          gpxUrl={comment.attachment.gpx.url}
                          fileContent={comment.attachment.gpx.fileContent}
                          isMine={comment.isOwner}
                        />
                      )}

                      {comment.attachment.type === 'product' && comment.attachment.product && (
                        <ProductCard meta={comment.attachment.product} isMine={comment.isOwner} />
                      )}

                      {comment.attachment.type === 'trail' && comment.attachment.trail && (
                        <TrailCard meta={comment.attachment.trail} isMine={comment.isOwner} />
                      )}

                      {comment.attachment.type === 'photo' && comment.attachment.photoUrl && (
                        <div className="max-w-[240px] overflow-hidden rounded-xl border border-black/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={comment.attachment.photoUrl}
                            alt="Pièce jointe"
                            className="max-h-48 w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions (Reply, Like count) */}
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-[#56665D]">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(comment);
                        inputRef.current?.focus();
                      }}
                      className="hover:text-[#17402C]"
                    >
                      Répondre
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleLike(comment.id)}
                      className={`flex items-center gap-1 ${comment.isLiked ? 'text-[#FF4A6E]' : 'hover:text-[#17402C]'}`}
                    >
                      <Heart
                        size={12}
                        fill={comment.isLiked ? 'currentColor' : 'none'}
                        strokeWidth={2}
                      />
                      <span>{comment.likesCount > 0 ? comment.likesCount : ''}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Replying banner */}
        {replyingTo && (
          <div className="flex items-center justify-between border-t border-black/5 bg-[#F0EDE6] px-4 py-1.5 text-xs text-[#56665D]">
            <span className="flex items-center gap-1">
              <CornerDownRight size={12} />
              En réponse à <b className="text-[#172B24]">{replyingTo.author.name}</b>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-xs font-bold text-[#7A241C]"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Pending Attachment Preview Chip */}
        {pendingAttachment && (
          <div className="flex items-center justify-between border-t border-black/10 bg-[#E8F0E6] px-4 py-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#17402C]">
              {pendingAttachment.type === 'kit' && (
                <span>🎒 Kit : {pendingAttachment.kit?.kit_name || 'Matériel'}</span>
              )}
              {pendingAttachment.type === 'gpx' && (
                <span>🗺️ GPX : {pendingAttachment.gpx?.name || 'Tracé'}</span>
              )}
              {pendingAttachment.type === 'product' && (
                <span>⚙️ Équipement : {pendingAttachment.product?.name}</span>
              )}
              {pendingAttachment.type === 'trail' && (
                <span>🥾 Randonnée : {pendingAttachment.trail?.name}</span>
              )}
              {pendingAttachment.type === 'photo' && <span>📷 Photo prête</span>}
            </div>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              className="rounded-full p-1 text-[#7A241C] hover:bg-black/5"
              aria-label="Supprimer la pièce jointe"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Bottom Composer */}
        <div className="freedom-comments-composer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="freedom-composer-form"
          >
            {/* Photo Picker */}
            <button
              type="button"
              className="freedom-composer-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Joindre une photo"
            >
              <ImageIcon size={19} />
            </button>

            {/* Rich Attachment Sheet Picker (+) */}
            <button
              type="button"
              className="freedom-composer-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Joindre un Kit, GPX ou Équipement"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              className="freedom-composer-input"
              placeholder={
                replyingTo
                  ? `Répondre à ${replyingTo.author.name}…`
                  : 'Ajouter un commentaire ou partager un kit…'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              aria-label="Votre commentaire"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !pendingAttachment) || submitting}
              className={`freedom-composer-btn is-send ${
                (!inputText.trim() && !pendingAttachment) || submitting ? 'opacity-40' : ''
              }`}
              aria-label="Publier le commentaire"
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Attachment Choice Drawer */}
        <FreedomComposerMenuSheet
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          currentUserId={currentUser?.id}
          onSelectAttachment={(att) => {
            setPendingAttachment(att);
            inputRef.current?.focus();
          }}
        />
      </div>
    </div>
  );
};

export default FreedomCommentsDrawer;
