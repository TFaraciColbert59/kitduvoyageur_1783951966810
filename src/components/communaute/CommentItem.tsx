'use client';
import { lkvConfirm } from '@/components/ui/dialogs';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, IconButton } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

export interface CommentData {
  id: string;
  author_id?: string;
  content: string;
  created_at?: string;
  author?: {
    id?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface CommentItemProps {
  comment: CommentData;
  currentUser: any;
  tableName: 'post_comments' | 'carnet_comments' | 'club_topic_replies';
  onUpdate: (updatedId: string, newContent: string) => void;
  onDelete: (deletedId: string) => void;
  onReply?: (parentId: string, reply: CommentData) => void;
  replyTargetName?: string;
}

export default function CommentItem({
  comment,
  currentUser,
  tableName,
  onUpdate,
  onDelete,
  onReply,
  replyTargetName,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Reporting State
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('Propos inappropriés');
  const [isReported, setIsReported] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState<string | null>(null);

  // Check if current user is author
  const currentUserId = currentUser?.id;
  const currentUserName = currentUser?.user_metadata?.full_name || currentUser?.email;
  const isOwnComment =
    (currentUserId && comment.author_id === currentUserId) ||
    (currentUserId && comment.author?.id === currentUserId) ||
    (currentUserName && comment.author?.full_name === currentUserName);

  const profileId = comment.author_id || comment.author?.id;
  const authorBlock = (
    <div className="mt-[var(--space-1)] flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-primary)]">
      {comment.author?.avatar_url ? (
        <img src={comment.author.avatar_url} alt={comment.author?.full_name || 'Utilisateur'} className="size-full object-cover" />
      ) : comment.author?.full_name?.charAt(0) || 'V'}
    </div>
  );
  const avatarArea = profileId ? (
    <Link href={`/profil/${profileId}`} className="shrink-0" title="Voir le profil">{authorBlock}</Link>
  ) : authorBlock;

  // Handle Save Edit
  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(tableName)
        .update({ content: editText.trim() })
        .eq('id', comment.id);

      if (error) {
        console.error('Error updating comment:', error?.message || error?.details || error?.code || error);
      }
      onUpdate(comment.id, editText.trim());
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      onUpdate(comment.id, editText.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async () => {
    if (!(await lkvConfirm('Voulez-vous vraiment supprimer ce commentaire ?'))) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from(tableName).delete().eq('id', comment.id);
      if (error) console.error('Error deleting comment:', error);
      onDelete(comment.id);
    } catch (err) {
      console.error(err);
      onDelete(comment.id);
    }
  };

  // Handle Send Report
  const handleSendReport = async () => {
    try {
      const supabase = createClient();
      await supabase.from('comment_reports').insert({
        comment_id: comment.id,
        reporter_id: currentUserId || null,
        reason: reportReason,
        table_name: tableName,
      });
    } catch {
      // Ignorer l'erreur réseau ponctuelle sur signalement
    }
    setIsReported(true);
    setIsReporting(false);
    setReportSuccessMsg('Signalement envoyé aux modérateurs ✓');
    setTimeout(() => setReportSuccessMsg(null), 4000);
  };

  // Réponse directe à la personne concernée
  const handleSendReply = async () => {
    if (!currentUser?.id || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const supabase = createClient();
      const tableExtra =
        tableName === 'carnet_comments'
          ? { carnet_id: (comment as any).carnet_id }
          : tableName === 'post_comments'
          ? { post_id: (comment as any).post_id }
          : {};
      const basePayload: Record<string, unknown> = {
        ...tableExtra,
        author_id: currentUser.id,
        content: replyText.trim(),
      };
      // Tentative 1 : réponse imbriquée (colonne parent_id)
      // Fallback : réponse plate si la BDD live ne possède pas encore la colonne
      let inserted: any = null;
      for (const withParent of [true, false]) {
        const payload = { ...basePayload, ...(withParent ? { parent_id: comment.id } : {}) };
        const { data, error } = await supabase
          .from(tableName)
          .insert(payload)
          .select('*')
          .single();
        if (!error && data) { inserted = data; break; }
        const msg = (error as any)?.message || '';
        if (!withParent || !/parent_id|column|does not exist/i.test(msg)) {
          console.error('Reply error:', (error as any)?.message || (error as any)?.details || (error as any)?.code || error);
          break;
        }
      }

      if (inserted) {
        // F1 — auteur via la vue `public_profiles` (jamais d'embed FK).
        const profiles = await fetchPublicProfilesWith(supabase, [currentUser.id]);
        const profile = profiles[currentUser.id];
        inserted = {
          ...inserted,
          author: profile
            ? { id: profile.id, full_name: profile.full_name ?? '', avatar_url: profile.avatar_url ?? '' }
            : undefined,
        };
        setReplyText('');
        setIsReplying(false);
        onReply?.(comment.id, inserted as CommentData);
      } else {
        setReplyText('');
        setIsReplying(false);
      }
    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="group/comment relative flex gap-[var(--space-3)] text-[length:var(--lkv-text-footnote)]">
      {avatarArea}

      <Card variant="compact" className="relative flex-1 rounded-tl-none">
        {/* Comment Header */}
        <div className="mb-[var(--space-1)] flex items-center justify-between gap-[var(--space-2)]">
          {profileId ? (
            <Link href={`/profil/${profileId}`} className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] transition-colors hover:text-[color:var(--lkv-primary)]">
              {comment.author?.full_name || 'Voyageur'}
            </Link>
          ) : (
            <div className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              {comment.author?.full_name || 'Voyageur'}
            </div>
          )}

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-[var(--space-1)] opacity-80 transition-opacity group-hover/comment:opacity-100">
            {onReply && (
              <IconButton
                variant="glass"
                size="sm"
                onClick={() => setIsReplying(!isReplying)}
                aria-label={`Répondre à ${comment.author?.full_name || 'cette personne'}`}
              >
                <Icon name="message-square" size={12} aria-hidden="true" />
              </IconButton>
            )}
            {isOwnComment ? (
              <>
                <IconButton
                  variant="glass"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  aria-label="Modifier"
                >
                  <Icon name="pencil" size={12} aria-hidden="true" />
                </IconButton>
                <IconButton
                  variant="glass"
                  size="sm"
                  onClick={handleDeleteComment}
                  aria-label="Supprimer"
                  className="text-[color:var(--lkv-danger)]"
                >
                  <Icon name="trash2" size={12} aria-hidden="true" />
                </IconButton>
              </>
            ) : (
              <IconButton
                variant="glass"
                size="sm"
                onClick={() => setIsReporting(!isReporting)}
                aria-label="Signaler"
              >
                <Icon name="flag" size={12} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        </div>

        {/* Editing Inline Form */}
        {isEditing ? (
          <div className="mt-[var(--space-1)] space-y-[var(--space-2)]">
            <textarea
              rows={2}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] p-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] focus:border-[color:var(--lkv-primary)] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-[var(--space-2)]">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={isSaving}
                disabled={isSaving || !editText.trim()}
                onClick={handleSaveEdit}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        ) : (
          /* Comment Text */
          <p className="whitespace-pre-wrap text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
            {comment.content}
          </p>
        )}

        {/* Report Inline Popover Form */}
        {isReporting && (
          <div className="mt-[var(--space-3)] space-y-[var(--space-2)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-3)] text-[length:var(--lkv-text-caption)]">
            <p className="font-bold text-[color:var(--lkv-text-primary)]">Motif du signalement :</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-[var(--lkv-radius-xs)] border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] p-1.5 text-[length:var(--lkv-text-caption)]"
            >
              <option value="Propos inappropriés">Propos inappropriés / Injurieux</option>
              <option value="Spam / Publicité">Spam ou publicité non sollicitée</option>
              <option value="Harcèlement">Harcèlement ou propos haineux</option>
              <option value="Contenu trompeur">Fausse information / Trompeur</option>
            </select>
            <div className="flex justify-end gap-[var(--space-2)] pt-[var(--space-1)]">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsReporting(false)}>
                Annuler
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleSendReport}>
                Confirmer le signalement
              </Button>
            </div>
          </div>
        )}

        {/* Success toast badge */}
        {reportSuccessMsg && (
          <div className="mt-[var(--space-2)] rounded-[var(--lkv-radius-xs)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-secondary)]">
            {reportSuccessMsg}
          </div>
        )}

        {/* Reply to this person */}
        {isReplying && onReply && (
          <div className="mt-[var(--space-3)]">
            <p className="mb-1.5 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
              Répondre à {replyTargetName || comment.author?.full_name || 'cette personne'}
            </p>
            <div className="flex gap-[var(--space-2)]">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder={`Écrire une réponse à ${comment.author?.full_name || '…'}`}
                className="flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] focus:border-[color:var(--lkv-primary)] focus:outline-none"
                disabled={sendingReply}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={sendingReply}
                disabled={sendingReply || !replyText.trim()}
                onClick={handleSendReply}
              >
                Envoyer
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
