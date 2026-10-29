'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Image as ImageIcon, Heart, CornerDownRight, X } from 'lucide-react';
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
  onOpenKit?: (kitId: string, kitName?: string) => void;
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
  onOpenKit,
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

  // Load comments
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);

    fetchReelComments(reelId)
      .then((data) => {
        if (!alive) return;
        setComments(data);
      })
      .catch((e) => {
        console.error('[Freedom] Error loading comments:', e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen, reelId]);

  // Keyboard navigation
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
    const textToSend = inputText.trim();
    if ((!textToSend && !pendingAttachment) || submitting) return;

    haptic('light');
    setSubmitting(true);

    try {
      const newComment = await postReelComment(
        reelId,
        currentUser,
        textToSend,
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
    if (!file) return;

    haptic('medium');
    const localUrl = URL.createObjectURL(file);
    setPendingAttachment({
      type: 'photo',
      photoUrl: localUrl,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="freedom-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Commentaires"
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
          // Glisser vers le bas pour fermer
          if (currentY - start > 110) onClose();
        }}
      >
        {/* Grab Handle (pour fermer en glissant vers le bas) */}
        <div className="freedom-drawer-grab" aria-hidden="true" onClick={onClose}>
          <span />
        </div>

        {/* Note: Le titre "Commentaires" et la croix de fermeture ont été retirés selon la consigne */}

        {/* Comments List */}
        <div ref={listRef} className="freedom-drawer-content space-y-4">
          {loading ? (
            <div className="flex h-36 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-[#17402C] border-t-transparent" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-center text-sm text-[#56665D]">
              <p className="font-semibold text-[#172B24]">Aucun commentaire pour l’instant.</p>
              <p className="text-xs">Soyez le premier voyageur à partager votre avis ou votre kit !</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2.5">
                {/* Avatar */}
                <div className="size-8 shrink-0 overflow-hidden rounded-full bg-[#E5EAE3] border border-black/5">
                  {comment.author.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- distant avatar
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-xs font-bold text-[#17402C]">
                      {comment.author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Comment Body */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
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
                        <KitCard
                          meta={comment.attachment.kit}
                          isMine={comment.isOwner}
                          onOpen={(id) => onOpenKit?.(id, comment.attachment?.kit?.kit_name)}
                        />
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
                        <div className="overflow-hidden rounded-xl border border-black/10">
                          {/* eslint-disable-next-line @next/next/no-img-element -- user comment photo */}
                          <img
                            src={comment.attachment.photoUrl}
                            alt="Photo partagée"
                            className="max-h-48 w-auto rounded-xl object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reply Button */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setReplyingTo(comment);
                        inputRef.current?.focus();
                      }}
                      className="text-[11px] font-semibold text-[#56665D] hover:text-[#17402C]"
                    >
                      Répondre
                    </button>
                  </div>
                </div>

                {/* Like Button on Comment */}
                <button
                  type="button"
                  onClick={() => handleToggleLike(comment.id)}
                  className="flex flex-col items-center gap-0.5 pt-1 text-[#56665D] hover:text-[#FF2D55]"
                  aria-label="Aimer le commentaire"
                >
                  <Heart
                    size={14}
                    fill={comment.isLiked ? '#FF2D55' : 'none'}
                    color={comment.isLiked ? '#FF2D55' : 'currentColor'}
                    strokeWidth={comment.isLiked ? 0 : 2}
                  />
                  {comment.likesCount > 0 && (
                    <span className="text-[10px] font-medium">{comment.likesCount}</span>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Replying Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-black/5 px-4 py-1.5 text-xs text-[#172B24]">
            <div className="flex items-center gap-1.5 truncate">
              <CornerDownRight size={13} className="text-[#17402C]" />
              <span>En réponse à <b>{replyingTo.author.name}</b></span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-xs font-semibold text-[#7A241C]"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Pending Attachment Preview Banner */}
        {pendingAttachment && (
          <div className="flex items-center justify-between border-t border-black/5 bg-[#E8F0E6] px-4 py-2 text-xs font-semibold text-[#17402C]">
            <div className="flex items-center gap-2 truncate">
              {pendingAttachment.type === 'kit' && (
                <span>Kit : {pendingAttachment.kit?.kit_name || 'Matériel'}</span>
              )}
              {pendingAttachment.type === 'gpx' && (
                <span>Tracé GPX : {pendingAttachment.gpx?.name || 'Tracé'}</span>
              )}
              {pendingAttachment.type === 'product' && (
                <span>Équipement : {pendingAttachment.product?.name}</span>
              )}
              {pendingAttachment.type === 'trail' && (
                <span>Randonnée : {pendingAttachment.trail?.name}</span>
              )}
              {pendingAttachment.type === 'photo' && (
                <span>Photo prête à l’envoi</span>
              )}
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
              type="button"
              onClick={() => void handleSend()}
              disabled={(!inputText.trim() && !pendingAttachment) || submitting}
              className={`freedom-composer-btn is-send ${
                (!inputText.trim() && !pendingAttachment) || submitting ? 'opacity-40' : ''
              }`}
              aria-label="Publier le commentaire"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Rich Attachments Sheet (GPX, Kit, Équipement, Rando) */}
      {menuOpen && (
        <FreedomComposerMenuSheet
          isOpen={menuOpen}
          currentUserId={currentUser?.id}
          onClose={() => setMenuOpen(false)}
          onSelectAttachment={(att) => {
            setPendingAttachment(att);
            setMenuOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default FreedomCommentsDrawer;
