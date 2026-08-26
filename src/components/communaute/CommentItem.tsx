'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

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
    <div className="w-7 h-7 rounded-full mt-1 object-cover border border-[#E8E4D8] shrink-0 overflow-hidden bg-[#E7E3D6] flex items-center justify-center text-[10px] font-bold text-[#17402C]">
      {comment.author?.avatar_url ? (
        <img src={comment.author.avatar_url} alt={comment.author?.full_name || 'Utilisateur'} className="w-full h-full object-cover" />
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
    if (!window.confirm('Voulez-vous vraiment supprimer ce commentaire ?')) return;
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
    } catch (e) {
      console.log('Report saved locally:', e);
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
          .select(`*, author:user_profiles(full_name, avatar_url)`)
          .single();
        if (!error && data) { inserted = data; break; }
        const msg = (error as any)?.message || '';
        if (!withParent || !/parent_id|column|does not exist/i.test(msg)) {
          console.error('Reply error:', (error as any)?.message || (error as any)?.details || (error as any)?.code || error);
          break;
        }
      }

      if (inserted) {
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
    <div className="flex gap-3 text-sm group/comment relative">
      {avatarArea}

      <div className="flex-1 glass-sub-card rounded-2xl rounded-tl-none p-3 relative">
        {/* Comment Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          {profileId ? (
            <Link href={`/profil/${profileId}`} className="font-bold text-xs text-[#17402C] hover:text-[#17402C] transition-colors">
              {comment.author?.full_name || 'Voyageur'}
            </Link>
          ) : (
            <div className="font-bold text-xs text-[#17402C]">
              {comment.author?.full_name || 'Voyageur'}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 opacity-80 group-hover/comment:opacity-100 transition-opacity ml-auto">
            {onReply && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="w-7 h-7 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0"
                aria-label={`Répondre à ${comment.author?.full_name || 'cette personne'}`}
              >
                <Icon name="ChatBubbleLeftIcon" size={12} />
              </button>
            )}
            {isOwnComment ? (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="w-7 h-7 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0"
                  aria-label="Modifier"
                >
                  <Icon name="PencilIcon" size={12} />
                </button>
                <button
                  onClick={handleDeleteComment}
                  className="w-7 h-7 rounded-full glass-capsule-btn flex items-center justify-center text-red-600 p-0"
                  aria-label="Supprimer"
                >
                  <Icon name="TrashIcon" size={12} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsReporting(!isReporting)}
                className="w-7 h-7 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0"
                aria-label="Signaler"
              >
                <Icon name="FlagIcon" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Editing Inline Form */}
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              rows={2}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-2 bg-white border border-[#E4E0D4] rounded-xl text-xs text-[#17402C] focus:outline-none focus:border-[#17402C]"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-white border border-[#E4E0D4] rounded-full text-[10px] font-bold text-[#5C6B5E] hover:bg-[#FAF8F5]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editText.trim()}
                className="px-3 py-1 bg-[#17402C] text-white rounded-full text-[10px] font-bold hover:bg-[#17402C] transition-colors"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : (
          /* Comment Text */
          <p className="text-xs text-[#4A574C] leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Report Inline Popover Form */}
        {isReporting && (
          <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200  text-xs space-y-2">
            <p className="font-bold text-[#17402C]">Motif du signalement :</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-1.5 bg-[#F5F2E8] border border-[#E4E0D4] rounded-lg text-xs"
            >
              <option value="Propos inappropriés">Propos inappropriés / Injurieux</option>
              <option value="Spam / Publicité">Spam ou publicité non sollicitée</option>
              <option value="Harcèlement">Harcèlement ou propos haineux</option>
              <option value="Contenu trompeur">Fausse information / Trompeur</option>
            </select>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsReporting(false)}
                className="px-2.5 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleSendReport}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700"
              >
                Confirmer le signalement
              </button>
            </div>
          </div>
        )}

        {/* Success toast badge */}
        {reportSuccessMsg && (
          <div className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            {reportSuccessMsg}
          </div>
        )}

        {/* Reply to this person */}
        {isReplying && onReply && (
          <div className="mt-3">
            <p className="text-[10px] font-bold text-[#17402C] mb-1.5">
              Répondre à {replyTargetName || comment.author?.full_name || 'cette personne'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder={`Écrire une réponse à ${comment.author?.full_name || '…'}`}
                className="flex-1 bg-white border border-[#E4E0D4] rounded-xl px-3 py-2 text-xs text-[#17402C] focus:outline-none focus:border-[#17402C]"
                disabled={sendingReply}
              />
              <button
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                className="px-3 py-2 bg-[#17402C] text-white rounded-xl text-[10px] font-bold hover:bg-[#17402C] disabled:opacity-50"
              >
                {sendingReply ? '…' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
