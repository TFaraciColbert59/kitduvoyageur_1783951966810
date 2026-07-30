'use client';

import React, { useState } from 'react';
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
}

export default function CommentItem({
  comment,
  currentUser,
  tableName,
  onUpdate,
  onDelete,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);

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
        console.error('Error updating comment:', error);
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

  return (
    <div className="flex gap-3 text-sm group/comment relative">
      <img
        src={comment.author?.avatar_url || 'https://i.pravatar.cc/150'}
        alt={comment.author?.full_name || 'Utilisateur'}
        className="w-7 h-7 rounded-full mt-1 object-cover border border-[#E8E4D8] shrink-0"
      />

      <div className="flex-1 bg-[#F5F2E8] rounded-2xl rounded-tl-none p-3 relative">
        {/* Comment Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="font-bold text-xs text-[#1C2620]">
            {comment.author?.full_name || 'Voyageur'}
          </div>

          {/* Action buttons (Edit / Delete / Report) */}
          <div className="flex items-center gap-2 opacity-80 group-hover/comment:opacity-100 transition-opacity">
            {isOwnComment ? (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-[10px] font-semibold text-[#5C6B5E] hover:text-[#2D5A3D] flex items-center gap-0.5"
                  title="Modifier votre commentaire"
                >
                  ✏️ <span>Modifier</span>
                </button>

                <button
                  onClick={handleDeleteComment}
                  className="text-[10px] font-semibold text-red-500 hover:text-red-700 flex items-center gap-0.5"
                  title="Supprimer votre commentaire"
                >
                  🗑️ <span>Supprimer</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsReporting(!isReporting)}
                className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                  isReported ? 'text-amber-600' : 'text-[#7A8A7D] hover:text-red-600'
                }`}
                title="Signaler ce commentaire"
              >
                🚩 <span>{isReported ? 'Signalé' : 'Signaler'}</span>
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
              className="w-full p-2 bg-white border border-[#E4E0D4] rounded-xl text-xs text-[#1C2620] focus:outline-none focus:border-[#2D5A27]"
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
                className="px-3 py-1 bg-[#2D5A3D] text-white rounded-full text-[10px] font-bold hover:bg-[#1C2620] transition-colors"
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
          <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200 shadow-md text-xs space-y-2">
            <p className="font-bold text-[#1C2620]">Motif du signalement :</p>
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
      </div>
    </div>
  );
}
