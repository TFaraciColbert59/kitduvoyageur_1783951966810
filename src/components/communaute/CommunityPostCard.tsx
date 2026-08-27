'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import SmartImage from '@/components/ui/SmartImage';
import { createClient } from '@/lib/supabase/client';

export interface PostAuthor {
  id?: string;
  full_name?: string;
  avatar_url?: string;
  loyalty_level?: string;
}

export interface PostCommentItem {
  id: string;
  parentId?: string | null;
  author?: PostAuthor;
  content: string;
  attachment?: string | null;
  location?: string | null;
  created_at?: string;
  likes?: number;
  userLiked?: boolean;
  isOwner?: boolean;
  edited?: boolean;
}

export interface CommunityPostItem {
  id: string;
  user_id?: string;
  author_id?: string;
  content: string;
  author?: PostAuthor;
  image_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  created_at?: string;
  user_liked?: boolean;
  user_saved?: boolean;
}

export const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'À l’instant';
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)} j`;
};

// Heart SVG Icon helper for crisp rendering
export function HeartSvg({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  if (filled) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-3.5 h-3.5 text-rose-500 transition-transform duration-200 scale-110 ${className}`}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3.5 h-3.5 text-[#17402C] hover:text-rose-600 transition-colors ${className}`}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function CommunityPostCard({
  post,
  user,
}: {
  post: CommunityPostItem;
  user?: any;
}) {
  const [isLiked, setIsLiked] = useState(Boolean(post.user_liked));
  const [likesCount, setLikesCount] = useState<number>(post.likes_count || 14);
  const [commentsCount, setCommentsCount] = useState<number>(post.comments_count || 2);
  const [showComments, setShowComments] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(post.user_saved));
  const [isHidden, setIsHidden] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [parentCommentId, setParentCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<PostCommentItem[]>([
    {
      id: 'c1',
      author: { full_name: 'Antoine Duprès', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200' },
      content: 'Superbe tracé ! La source sous le col coulait encore ?',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      likes: 2,
      userLiked: false,
      isOwner: false,
    },
    {
      id: 'c2',
      parentId: 'c1',
      author: { full_name: 'Léna Moreau', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200' },
      content: 'Oui un bon filet d’eau très fraîche, compter 2 min pour remplir 1.5L !',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      likes: 4,
      userLiked: true,
      isOwner: true,
    },
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLike = async () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikesCount((prev: number) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    const supabase = createClient();
    try {
      await supabase.rpc('toggle_community_post_like', { p_post_id: post.id });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) {
      setTimeout(() => commentInputRef.current?.focus(), 150);
    }
  };

  const handleLikeComment = (commentId: string) => {
    setComments(prev =>
      prev.map(c => {
        if (c.id === commentId) {
          const nextLiked = !c.userLiked;
          return {
            ...c,
            userLiked: nextLiked,
            likes: nextLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1),
          };
        }
        return c;
      })
    );
  };

  const handleStartEditComment = (comment: PostCommentItem) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.content);
  };

  const handleSaveEditComment = (commentId: string) => {
    if (!editingText.trim()) return;
    setComments(prev =>
      prev.map(c => (c.id === commentId ? { ...c, content: editingText.trim(), edited: true } : c))
    );
    setEditingCommentId(null);
    setEditingText('');
    showToast('Commentaire mis à jour !');
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));
    setCommentsCount((prev: number) => Math.max(0, prev - 1));
    showToast('Commentaire supprimé');
  };

  const handleReportComment = () => {
    showToast('Merci, ce commentaire a été signalé à la modération.');
  };

  const handleReplyTo = (authorName: string, parentId?: string) => {
    setReplyingTo(authorName);
    if (parentId) setParentCommentId(parentId);
    setCommentText(`@${authorName} `);
    setShowComments(true);
    setTimeout(() => commentInputRef.current?.focus(), 150);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Lien copié dans le presse-papier !');
    }
  };

  const handleToggleSave = () => {
    setIsSaved(!isSaved);
    setShowMoreMenu(false);
    showToast(isSaved ? 'Retiré de vos favoris' : 'Enregistré dans vos favoris ⭐');
  };

  const handleHidePost = () => {
    setIsHidden(true);
    setShowMoreMenu(false);
    showToast('Publication masquée de votre fil.');
  };

  const handleReport = () => {
    setShowMoreMenu(false);
    showToast('Merci, ce contenu a été signalé aux modérateurs.');
  };

  const handleSendComment = async (
    customText?: string,
    attachmentUrl?: string,
    locationData?: string
  ) => {
    const textToSend = customText || commentText.trim();
    if (!textToSend && !attachmentUrl && !locationData) return;

    const newComment: PostCommentItem = {
      id: `c-${Date.now()}`,
      parentId: parentCommentId || null,
      content: textToSend || (locationData ? `📍 ${locationData}` : '📎 Photo partagée'),
      attachment: attachmentUrl || null,
      location: locationData || null,
      created_at: new Date().toISOString(),
      likes: 0,
      userLiked: false,
      isOwner: true,
      author: {
        full_name: user?.user_metadata?.full_name || 'Moi',
        avatar_url: user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200',
      },
    };

    setComments(prev => [...prev, newComment]);
    setCommentsCount((prev: number) => prev + 1);
    setCommentText('');
    setReplyingTo(null);
    setParentCommentId(null);

    const supabase = createClient();
    try {
      await supabase.from('post_comments').insert({
        post_id: post.id,
        author_id: user?.id,
        content: newComment.content,
        parent_id: newComment.parentId,
      });
    } catch (err) {
      console.warn('Comment insert error:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fakeUrl = URL.createObjectURL(file);
    handleSendComment(commentText || `Photo partagée : ${file.name}`, fakeUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleSendComment(`🗺️ Trace GPX partagée : ${file.name}`);
    if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const handleShareLocation = () => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      showToast('Géolocalisation indisponible.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        handleSendComment(`📍 Position terrain partagée : ${loc}`, undefined, loc);
      },
      () => {
        showToast('Impossible d’obtenir votre position.');
      }
    );
  };

  if (isHidden) return null;

  return (
    <div className="glass bg-white/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white shadow-xs space-y-4 relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#17402C] text-white text-[11px] font-mono px-3 py-1 rounded-full shadow-md animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Header author & Badge */}
      <div className="flex items-center justify-between">
        <Link
          href={post.author?.id ? `/profil/${post.author.id}` : post.user_id ? `/profil/${post.user_id}` : '/communaute'}
          className="flex items-center gap-3 group/author cursor-pointer"
        >
          <img
            src={post.author?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200'}
            alt="Author"
            className="w-10 h-10 rounded-full object-cover border border-[#17402C]/10 group-hover/author:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#17402C] group-hover/author:underline">{post.author?.full_name || 'Voyageur LKDV'}</span>
              <span className="bg-[#17402C]/10 text-[#17402C] text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                {post.author?.loyalty_level || 'EXPLORATEUR'}
              </span>
            </div>
            <span className="text-[10px] text-[#5C6B5E] font-mono">{timeAgo(post.created_at || new Date().toISOString())}</span>
          </div>
        </Link>

        <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">FIL</span>
      </div>

      {/* Content */}
      <p className="text-xs sm:text-sm text-[#17402C] leading-relaxed whitespace-pre-line">
        {post.content}
      </p>

      {/* Attached Media */}
      {post.image_url && (
        <div className="rounded-2xl overflow-hidden aspect-[16/10] bg-[#FAF8F5] border border-white/80 shadow-2xs">
          <SmartImage
            src={post.image_url}
            alt="Photo de l'expédition"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Actions Row: Like, Comment (left) | Share, More Options (right) */}
      <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Like Button with clean Vector Heart */}
          <GlassIconButton
            title="J'aime cette expédition"
            active={isLiked}
            count={likesCount}
            onClick={handleLike}
            icon={<HeartSvg filled={isLiked} />}
          />

          {/* Comment Button with clean Vector Bubble */}
          <GlassIconButton
            title="Commenter la publication"
            count={commentsCount}
            onClick={handleToggleComments}
            icon={<Icon name="ChatBubbleLeftIcon" size={14} className="text-[#17402C]" />}
          />
        </div>

        {/* Right Actions: Share & 3-dots Menu */}
        <div className="flex items-center gap-2">
          <GlassIconButton
            size="md"
            title="Partager"
            onClick={handleShare}
            icon={<Icon name="PaperAirplaneIcon" size={14} className="text-[#17402C]" />}
          />

          {/* 3-dots functional menu button */}
          <div className="relative" ref={menuRef}>
            <GlassIconButton
              size="md"
              title="Options de la publication"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              icon={<Icon name="EllipsisHorizontalIcon" size={16} className="text-[#17402C]" />}
            />

            {/* Floating context menu */}
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 bottom-full mb-2 w-48 bg-white/95 backdrop-blur-xl border border-white/90 rounded-2xl p-1.5 shadow-xl z-40 space-y-1 text-xs text-[#17402C]"
                >
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 transition-colors text-left"
                  >
                    <Icon name={isSaved ? "BookmarkSolidIcon" : "BookmarkIcon"} size={14} className={isSaved ? "text-amber-600" : "text-[#5C6B5E]"} />
                    <span>{isSaved ? "Retirer des favoris" : "Enregistrer"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { handleShare(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 transition-colors text-left"
                  >
                    <Icon name="LinkIcon" size={14} className="text-[#5C6B5E]" />
                    <span>Copier le lien direct</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHidePost}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5 transition-colors text-left"
                  >
                    <Icon name="EyeSlashIcon" size={14} className="text-[#5C6B5E]" />
                    <span>Masquer ce post</span>
                  </button>

                  <div className="border-t border-[#17402C]/10 my-1" />

                  <button
                    type="button"
                    onClick={handleReport}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-left font-semibold"
                  >
                    <Icon name="FlagIcon" size={14} />
                    <span>Signaler le post</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Full Feature Threaded Comments Drawer (Pure Liquid Glass) */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-4 border-t border-[#17402C]/10 space-y-3.5"
          >
            {/* Header of comments drawer */}
            <div className="flex items-center justify-between text-xs text-[#5C6B5E] px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span className="font-bold text-[#17402C]">Discussions ({comments.length})</span>
              </div>
              <span className="text-[10px] font-mono text-[#5C6B5E]">Fil d'échange en direct</span>
            </div>

            {/* List of comments (Root Comments with Nested Threaded Replies) */}
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {comments
                .filter((c) => !c.parentId)
                .map((rootComment) => {
                  const replies = comments.filter((c) => c.parentId === rootComment.id);

                  return (
                    <div key={rootComment.id} className="space-y-2">
                      {/* Root Comment Card (Pure Liquid Glass) */}
                      <div className="glass p-3.5 rounded-2xl border border-white/60 bg-white/45 backdrop-blur-xl shadow-2xs space-y-2 group relative">
                        <div className="flex items-center justify-between text-[10px]">
                          <Link
                            href={rootComment.author?.id ? `/profil/${rootComment.author.id}` : '/communaute'}
                            className="flex items-center gap-2.5 group/cauthor cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-xs overflow-hidden border border-white/40 shadow-xs group-hover/cauthor:scale-105 transition-transform">
                              {rootComment.author?.avatar_url ? (
                                <img
                                  src={rootComment.author.avatar_url}
                                  alt={rootComment.author?.full_name || 'Voyageur'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (rootComment.author?.full_name?.charAt(0) || 'V').toUpperCase()
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-xs text-[#17402C] block leading-tight group-hover/cauthor:underline">
                                {rootComment.author?.full_name || 'Voyageur'}
                              </span>
                              <span className="text-[9.5px] text-[#5C6B5E] font-mono">
                                {timeAgo(rootComment.created_at || new Date().toISOString())}
                                {rootComment.edited && ' · modifié'}
                              </span>
                            </div>
                          </Link>

                          {/* Comment Options Buttons (Image 3 style) */}
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {rootComment.isOwner ? (
                              <>
                                <GlassIconButton
                                  size="sm"
                                  title="Modifier"
                                  onClick={() => handleStartEditComment(rootComment)}
                                  icon={<Icon name="PencilIcon" size={11} />}
                                />
                                <GlassIconButton
                                  size="sm"
                                  title="Supprimer"
                                  onClick={() => handleDeleteComment(rootComment.id)}
                                  icon={<Icon name="TrashIcon" size={11} className="text-red-600" />}
                                />
                              </>
                            ) : (
                              <GlassIconButton
                                size="sm"
                                title="Signaler"
                                onClick={handleReportComment}
                                icon={<Icon name="FlagIcon" size={11} />}
                              />
                            )}
                          </div>
                        </div>

                        {/* Comment Content or Edit Form */}
                        {editingCommentId === rootComment.id ? (
                          <div className="pl-9 space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="glass w-full rounded-xl p-2.5 text-xs text-[#17402C] focus:outline-none focus:ring-1 focus:ring-[#17402C]"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-3 py-1 text-[11px] font-bold text-[#5C6B5E] hover:text-[#17402C]"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditComment(rootComment.id)}
                                className="glass-circle-btn px-3.5 py-1 text-[11px] font-bold !bg-[#17402C] !text-white"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-[#17402C] pl-9 leading-relaxed">
                              {rootComment.content}
                            </p>

                            {/* Image Attachment */}
                            {rootComment.attachment && (
                              <div className="pl-9 pt-1">
                                <img
                                  src={rootComment.attachment}
                                  alt="Pièce jointe"
                                  className="w-40 h-28 object-cover rounded-xl border border-white/60 shadow-xs"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Footer Reply & Like Buttons */}
                        <div className="flex items-center justify-between pl-9 pt-1 text-[11px]">
                          <GlassIconButton
                            size="sm"
                            title={`Répondre à ${rootComment.author?.full_name || 'ce message'}`}
                            onClick={() => handleReplyTo(rootComment.author?.full_name || 'Voyageur', rootComment.id)}
                            icon={<span className="text-[10px] font-bold">↩</span>}
                          />

                          <GlassIconButton
                            size="sm"
                            active={rootComment.userLiked}
                            count={rootComment.likes || 0}
                            onClick={() => handleLikeComment(rootComment.id)}
                            title="Aimer ce commentaire"
                            icon={<HeartSvg filled={rootComment.userLiked} className="w-3 h-3" />}
                          />
                        </div>
                      </div>

                      {/* Threaded Child Replies (Offset with Connecting Guide Line) */}
                      {replies.length > 0 && (
                        <div className="relative ml-5 sm:ml-7 pl-4 sm:pl-5 border-l-2 border-[#17402C]/20 space-y-2 pt-1">
                          {replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="relative before:absolute before:-left-4 sm:before:-left-5 before:top-4 before:w-3 sm:before:w-4 before:h-[2px] before:bg-[#17402C]/20 before:rounded-full"
                            >
                              <div className="glass p-3 rounded-2xl border border-white/60 bg-white/35 backdrop-blur-xl shadow-2xs space-y-1.5 group">
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-[10px] overflow-hidden border border-white/30">
                                      {reply.author?.avatar_url ? (
                                        <img
                                          src={reply.author.avatar_url}
                                          alt={reply.author?.full_name || 'Voyageur'}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        (reply.author?.full_name?.charAt(0) || 'V').toUpperCase()
                                      )}
                                    </div>
                                    <span className="font-bold text-[11px] text-[#17402C]">
                                      {reply.author?.full_name || 'Voyageur'}
                                    </span>
                                    <span className="text-[9px] text-[#5C6B5E] font-mono">
                                      {timeAgo(reply.created_at || new Date().toISOString())}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                    {reply.isOwner ? (
                                      <GlassIconButton
                                        size="sm"
                                        title="Supprimer"
                                        onClick={() => handleDeleteComment(reply.id)}
                                        icon={<Icon name="TrashIcon" size={11} className="text-red-600" />}
                                      />
                                    ) : (
                                      <GlassIconButton
                                        size="sm"
                                        title="Signaler"
                                        onClick={handleReportComment}
                                        icon={<Icon name="FlagIcon" size={11} />}
                                      />
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-[#17402C] pl-7 leading-relaxed">
                                  {reply.content}
                                </p>

                                <div className="flex items-center justify-end pl-7 pt-0.5">
                                  <GlassIconButton
                                    size="sm"
                                    active={reply.userLiked}
                                    count={reply.likes || 0}
                                    onClick={() => handleLikeComment(reply.id)}
                                    title="Aimer cette réponse"
                                    icon={<HeartSvg filled={reply.userLiked} className="w-2.5 h-2.5" />}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Hidden Inputs for Attachments */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              ref={gpxInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={handleGpxUpload}
            />

            {/* Liquid Glass Composer Bar */}
            <div className="space-y-1.5 pt-1">
              {replyingTo && (
                <div className="glass px-3 py-1.5 rounded-xl border border-emerald-300/60 bg-emerald-50/60 backdrop-blur-md flex items-center justify-between text-[11px] text-emerald-900 shadow-2xs">
                  <span>En réponse à <strong>@{replyingTo}</strong></span>
                  <button
                    type="button"
                    onClick={() => { setReplyingTo(null); setParentCommentId(null); setCommentText(''); }}
                    className="font-bold hover:text-emerald-950 px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Liquid Glass Input Capsule with Image 3 Glass Buttons */}
              <div className="glass p-1.5 pl-3 rounded-full border border-white/70 bg-white/50 backdrop-blur-xl flex items-center gap-1.5 shadow-xs">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                  placeholder={replyingTo ? `Répondre à @${replyingTo}...` : "Ajouter une réponse ou un retour terrain..."}
                  className="flex-1 bg-transparent border-none text-xs text-[#17402C] focus:outline-none placeholder-[#5C6B5E]"
                />

                {/* Attachment & Action Buttons (Image 3 Style) */}
                <GlassIconButton
                  size="sm"
                  title="Joindre une photo"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Icon name="PhotoIcon" size={13} />}
                />
                <GlassIconButton
                  size="sm"
                  title="Partager un GPX"
                  onClick={() => gpxInputRef.current?.click()}
                  icon={<span className="text-[11px] leading-none">🗺️</span>}
                />
                <GlassIconButton
                  size="sm"
                  title="Partager ma position"
                  onClick={handleShareLocation}
                  icon={<Icon name="MapPinIcon" size={13} />}
                />

                <GlassIconButton
                  size="md"
                  title="Publier le commentaire"
                  onClick={() => handleSendComment()}
                  icon={<Icon name="PaperAirplaneIcon" size={13} />}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
