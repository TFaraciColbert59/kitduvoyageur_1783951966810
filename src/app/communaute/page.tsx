'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab = 'feed' | 'profils' | 'groupes' | 'qa' | 'ama';

interface CommunityPost {
  id: string;
  author_id: string;
  title: string;
  content: string;
  image_url: string;
  image_alt: string;
  post_type: 'post' | 'tip' | 'question' | 'share';
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_trending: boolean;
  created_at: string;
  author?: { full_name: string; avatar_url: string; trust_score: number; loyalty_level: string };
  user_liked?: boolean;
}

interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string };
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  trust_score: number;
  loyalty_level: string;
  created_at: string;
  user_following?: boolean;
}

interface QAQuestion {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  votes_count: number;
  answers_count: number;
  views_count: number;
  is_solved: boolean;
  created_at: string;
  author?: { full_name: string; trust_score: number };
  user_voted?: boolean;
}

interface QAAnswer {
  id: string;
  question_id: string;
  author_id: string;
  content: string;
  votes_count: number;
  is_accepted: boolean;
  created_at: string;
  author?: { full_name: string; trust_score: number };
}

interface AMASession {
  id: string;
  expert_id: string;
  title: string;
  description: string;
  scheduled_at: string | null;
  duration_minutes: number;
  status: 'upcoming' | 'live' | 'ended';
  participants_count: number;
  questions_count: number;
  expert?: { full_name: string; avatar_url: string; trust_score: number; loyalty_level: string };
}

interface AMAQuestion {
  id: string;
  session_id: string;
  author_id: string;
  content: string;
  votes_count: number;
  is_answered: boolean;
  answer: string;
  created_at: string;
  author?: { full_name: string };
  user_voted?: boolean;
}

const POST_TYPE_CFG: Record<string, { label: string; color: string; emoji: string }> = {
  post: { label: 'Post', color: 'bg-gray-100 text-gray-700', emoji: '💬' },
  tip: { label: 'Conseil', color: 'bg-emerald-100 text-emerald-700', emoji: '💡' },
  question: { label: 'Question', color: 'bg-blue-100 text-blue-700', emoji: '❓' },
  share: { label: 'Partage', color: 'bg-purple-100 text-purple-700', emoji: '🔗' },
};

const LEVEL_CFG: Record<string, { color: string; icon: string }> = {
  Explorateur: { color: 'text-gray-600 bg-gray-100', icon: '🌱' },
  Aventurier: { color: 'text-blue-700 bg-blue-100', icon: '🏔️' },
  Expert: { color: 'text-purple-700 bg-purple-100', icon: '⛰️' },
  Ambassadeur: { color: 'text-amber-700 bg-amber-100', icon: '🏅' },
  'Randonneur Expert': { color: 'text-blue-700 bg-blue-100', icon: '🧗' },
  'Guide de Montagne': { color: 'text-purple-700 bg-purple-100', icon: '🏔️' },
  'Légende du Voyage': { color: 'text-amber-700 bg-amber-100', icon: '🌍' },
};

// ─── Compose Post Modal ───────────────────────────────────────────────────────
interface ComposeModalProps {
  onClose: () => void;
  onPublished: () => void;
}

function ComposeModal({ onClose, onPublished }: ComposeModalProps) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    post_type: 'post' as CommunityPost['post_type'],
    image_url: '',
  });
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const handlePublish = async () => {
    if (!user) { setError('Connectez-vous pour publier.'); return; }
    if (!form.content.trim()) { setError('Le contenu est requis.'); return; }
    setPosting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('community_posts').insert({
        author_id: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
        post_type: form.post_type,
        image_url: form.image_url.trim(),
        image_alt: form.title.trim() || 'Image du post',
      });
      if (insertError) throw insertError;
      onPublished();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la publication.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#C8C3B0]">
          <h2 className="font-display font-700 text-[#1C2620] text-lg">Nouveau post</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Post type selector */}
          <div>
            <label className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] block mb-2">Type de post</label>
            <div className="flex gap-2 flex-wrap">
              {(['post', 'tip', 'question', 'share'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, post_type: t }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border transition-all ${
                    form.post_type === t
                      ? 'bg-[#E4501C]/10 border-[#E4501C]/40 text-[#E4501C]'
                      : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#E4501C]/30'
                  }`}
                >
                  {POST_TYPE_CFG[t].emoji} {POST_TYPE_CFG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] block mb-1.5">Titre (optionnel)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Un titre accrocheur..."
              className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] placeholder:text-[#5C6B5E]/60 focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 focus:border-[#E4501C]/40"
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] block mb-1.5">Contenu *</label>
            <textarea
              rows={5}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={
                form.post_type === 'tip' ?'Partagez un conseil utile pour la communauté...'
                  : form.post_type === 'question' ?'Posez votre question à la communauté...'
                  : form.post_type === 'share' ?'Partagez un lien, une ressource, une découverte...' :'Partagez votre expérience, vos aventures...'
              }
              className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-3 text-sm text-[#1C2620] placeholder:text-[#5C6B5E]/60 focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 focus:border-[#E4501C]/40 resize-none"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] block mb-1.5">
              <Icon name="PhotoIcon" size={11} className="inline mr-1" />
              Image (URL optionnelle)
            </label>
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://exemple.com/image.jpg"
              className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] placeholder:text-[#5C6B5E]/60 focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 focus:border-[#E4501C]/40"
            />
            {form.image_url && (
              <div className="mt-2 relative h-32 rounded-xl overflow-hidden border border-[#C8C3B0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="Aperçu" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[#C8C3B0]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-600 text-[#5C6B5E] hover:bg-[#C8C3B0]/20 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handlePublish}
            disabled={posting || !form.content.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-700 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {posting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publication...
              </>
            ) : (
              <>
                <Icon name="PaperAirplaneIcon" size={14} />
                Publier
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────
function FeedTab() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<'all' | 'trending'>('all');
  const [showCompose, setShowCompose] = useState(false);
  const [commentPost, setCommentPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('community_posts')
      .select('*, author:user_profiles(full_name, avatar_url, trust_score, loyalty_level)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (feedFilter === 'trending') query = query.eq('is_trending', true);

    const { data } = await query;
    let likedIds: string[] = [];
    if (user) {
      const { data: likes } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
      likedIds = likes?.map((l) => l.post_id) ?? [];
    }
    setPosts((data ?? []).map((p) => ({ ...p, user_liked: likedIds.includes(p.id) })));
    setLoading(false);
  }, [supabase, user, feedFilter]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleLike = async (post: CommunityPost) => {
    if (!user) { showToast('Connectez-vous pour réagir'); return; }
    if (post.user_liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      await supabase.from('community_posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', post.id);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, user_liked: false, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      await supabase.from('post_likes').upsert({ post_id: post.id, user_id: user.id }, { onConflict: 'post_id,user_id' });
      await supabase.from('community_posts').update({ likes_count: post.likes_count + 1 }).eq('id', post.id);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, user_liked: true, likes_count: p.likes_count + 1 } : p));
    }
  };

  const openComments = async (post: CommunityPost) => {
    setCommentPost(post);
    const { data } = await supabase.from('post_comments').select('*, author:user_profiles(full_name)').eq('post_id', post.id).order('created_at', { ascending: true });
    setComments((data as PostComment[]) ?? []);
  };

  const handleComment = async () => {
    if (!user || !commentPost || !newComment.trim()) return;
    setSubmittingComment(true);
    const { data } = await supabase.from('post_comments').insert({ post_id: commentPost.id, author_id: user.id, content: newComment.trim() }).select('*, author:user_profiles(full_name)').single();
    if (data) {
      setComments((prev) => [...prev, data as PostComment]);
      await supabase.from('community_posts').update({ comments_count: commentPost.comments_count + 1 }).eq('id', commentPost.id);
      setPosts((prev) => prev.map((p) => p.id === commentPost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
    }
    setNewComment('');
    setSubmittingComment(false);
  };

  const handleShare = (post: CommunityPost) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/communaute?post=${post.id}`);
      showToast('Lien copié !');
    }
  };

  return (
    <div className="space-y-6">
      {/* Compose button / CTA */}
      {user ? (
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
          <button
            onClick={() => setShowCompose(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E4501C]/20 flex items-center justify-center font-700 text-[#E4501C] flex-shrink-0">
              {user.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#5C6B5E]/70 hover:border-[#E4501C]/30 transition-colors">
              Partagez votre expérience, un conseil, une question...
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCompose(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors flex-shrink-0"
            >
              <Icon name="PlusIcon" size={14} />
              Publier
            </button>
          </button>
        </div>
      ) : (
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 text-center">
          <p className="text-sm text-[#5C6B5E] mb-3">Connectez-vous pour partager avec la communauté</p>
          <Link href="/connexion" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
            <Icon name="ArrowRightOnRectangleIcon" size={14} />
            Se connecter
          </Link>
        </div>
      )}

      {/* Feed filters */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: 'Tout le feed' },
          { id: 'trending', label: '🔥 Trending' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFeedFilter(f.id as typeof feedFilter)}
            className={`px-4 py-2 rounded-xl text-sm font-600 border transition-all ${feedFilter === f.id ? 'bg-[#1C2620] text-white border-[#1C2620]' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-40 animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-[#5C6B5E]">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucun post</p>
          <p className="text-sm">Soyez le premier à partager quelque chose !</p>
        </div>
      ) : (
        posts.map((post) => {
          const typeCfg = POST_TYPE_CFG[post.post_type] ?? POST_TYPE_CFG.post;
          const lvl = LEVEL_CFG[post.author?.loyalty_level ?? 'Explorateur'] ?? LEVEL_CFG.Explorateur;
          return (
            <div key={post.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
              {/* Author */}
              <div className="flex items-start gap-3 mb-3">
                <Link href={`/profil/${post.author_id}`} className="w-10 h-10 rounded-xl bg-[#E4501C]/20 flex items-center justify-center font-700 text-[#E4501C] flex-shrink-0 hover:bg-[#E4501C]/30 transition-colors">
                  {post.author?.full_name?.[0] ?? '?'}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/profil/${post.author_id}`} className="font-700 text-[#1C2620] text-sm hover:text-[#E4501C] transition-colors">{post.author?.full_name ?? 'Anonyme'}</Link>
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${lvl.color}`}>{lvl.icon} {post.author?.loyalty_level}</span>
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.emoji} {typeCfg.label}</span>
                    {post.is_trending && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-700">🔥 Trending</span>}
                  </div>
                  <p className="text-[10px] text-[#5C6B5E]">Trust {post.author?.trust_score ?? 0} · {new Date(post.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              {/* Title */}
              {post.title && <h3 className="font-700 text-[#1C2620] text-sm mb-1">{post.title}</h3>}

              {/* Content */}
              <p className="text-sm text-[#1C2620] mb-3 leading-relaxed">{post.content}</p>

              {/* Image */}
              {post.image_url && (
                <div className="relative h-48 rounded-xl overflow-hidden mb-3">
                  <Image src={post.image_url} alt={post.image_alt || 'Post image'} fill className="object-cover" />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#C8C3B0]/50">
                <button
                  onClick={() => handleLike(post)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border transition-all ${post.user_liked ? 'bg-[#E4501C]/10 border-[#E4501C]/30 text-[#E4501C]' : 'border-[#C8C3B0] text-[#5C6B5E] hover:border-[#E4501C]/30'}`}
                >
                  <Icon name="HeartIcon" variant={post.user_liked ? 'solid' : 'outline'} size={13} />
                  {post.likes_count}
                </button>
                <button
                  onClick={() => openComments(post)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30 transition-all"
                >
                  <Icon name="ChatBubbleLeftIcon" size={13} />
                  {post.comments_count}
                </button>
                <button
                  onClick={() => handleShare(post)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30 transition-all"
                >
                  <Icon name="ShareIcon" size={13} />
                  Partager
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onPublished={() => { loadPosts(); showToast('Post publié !'); }}
        />
      )}

      {/* Comments modal */}
      {commentPost && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[#C8C3B0]">
              <h3 className="font-display font-700 text-[#1C2620]">Commentaires ({commentPost.comments_count})</h3>
              <button onClick={() => setCommentPost(null)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-[#5C6B5E] text-sm py-8">Aucun commentaire. Soyez le premier !</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-700 text-[#E4501C] flex-shrink-0">{c.author?.full_name?.[0] ?? '?'}</div>
                    <div className="flex-1 bg-white rounded-xl p-3">
                      <p className="text-xs font-700 text-[#1C2620] mb-1">{c.author?.full_name ?? 'Anonyme'}</p>
                      <p className="text-sm text-[#5C6B5E]">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {user ? (
              <div className="p-5 border-t border-[#C8C3B0] flex gap-3">
                <input
                  className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
                  placeholder="Écrire un commentaire..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                />
                <button onClick={handleComment} disabled={submittingComment || !newComment.trim()} className="px-4 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-600 disabled:opacity-50 hover:bg-[#E4501C]/90 transition-colors">
                  {submittingComment ? '...' : 'Envoyer'}
                </button>
              </div>
            ) : (
              <div className="p-5 border-t border-[#C8C3B0] text-center text-sm text-[#5C6B5E]">
                <Link href="/connexion" className="text-[#E4501C] font-600 hover:underline">Connectez-vous</Link> pour commenter
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Profiles Tab ─────────────────────────────────────────────────────────────
function ProfilsTab() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('user_profiles').select('*').order('trust_score', { ascending: false }).limit(50);
      let followingIds: string[] = [];
      if (user) {
        const { data: follows } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id);
        followingIds = follows?.map((f) => f.following_id) ?? [];
      }
      setProfiles((data ?? []).map((p) => ({ ...p, user_following: followingIds.includes(p.id) })));
      setLoading(false);
    };
    load();
  }, [supabase, user]);

  const handleFollow = async (profile: UserProfile) => {
    if (!user) { showToast('Connectez-vous pour suivre'); return; }
    if (profile.id === user.id) return;
    if (profile.user_following) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profile.id);
      setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, user_following: false } : p));
      showToast('Abonnement annulé');
    } else {
      await supabase.from('user_follows').upsert({ follower_id: user.id, following_id: profile.id }, { onConflict: 'follower_id,following_id' });
      setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, user_following: true } : p));
      showToast('Abonné !');
    }
  };

  const filtered = profiles.filter((p) => !search || p.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
        <input
          className="w-full bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl pl-10 pr-4 py-3 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
          placeholder="Rechercher un aventurier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-48 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-[#5C6B5E]">
              <p className="text-4xl mb-3">🧭</p>
              <p className="font-display font-700 text-[#1C2620] text-lg mb-1">
                {search ? 'Aucun aventurier trouvé' : 'Aucun profil disponible'}
              </p>
              <p className="text-sm">{search ? `Aucun résultat pour "${search}"` : 'Soyez le premier à rejoindre la communauté !'}</p>
            </div>
          ) : (
            filtered.map((p) => {
              const lvl = LEVEL_CFG[p.loyalty_level ?? 'Explorateur'] ?? LEVEL_CFG.Explorateur;
              const isMe = user?.id === p.id;
              return (
                <div key={p.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#E4501C]/20 flex items-center justify-center font-700 text-[#E4501C] text-lg flex-shrink-0">
                      {p.full_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-700 text-[#1C2620] text-sm truncate">{p.full_name}</p>
                        <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${lvl.color}`}>{lvl.icon} {p.loyalty_level}</span>
                      </div>
                      <p className="text-[10px] text-[#5C6B5E]">Membre depuis {new Date(p.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-700 text-[#E4501C] text-lg">{p.trust_score}</p>
                      <p className="text-[10px] text-[#5C6B5E]">Trust</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/profil/${p.id}`} className="flex-1 py-2 rounded-xl text-sm font-600 text-center border border-[#C8C3B0] text-[#5C6B5E] hover:bg-[#C8C3B0]/20 transition-colors">
                      Voir profil
                    </Link>
                    {!isMe && (
                      <button
                        onClick={() => handleFollow(p)}
                        className={`flex-1 py-2 rounded-xl text-sm font-600 transition-all ${p.user_following ? 'bg-[#1C2620]/10 text-[#1C2620] border border-[#C8C3B0]' : 'bg-[#E4501C] text-white hover:bg-[#E4501C]/90'}`}
                      >
                        {p.user_following ? '✓ Abonné' : 'Suivre'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Q&A Tab ──────────────────────────────────────────────────────────────────
function QATab() {
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQ, setSelectedQ] = useState<QAQuestion | null>(null);
  const [answers, setAnswers] = useState<QAAnswer[]>([]);
  const [newAnswer, setNewAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', content: '', tags: '', category: 'général' });
  const [postingQ, setPostingQ] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('qa_questions')
      .select('*, author:user_profiles(full_name, trust_score)')
      .order('created_at', { ascending: false })
      .limit(30);
    setQuestions(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const openQuestion = async (q: QAQuestion) => {
    setSelectedQ(q);
    const { data } = await supabase.from('qa_answers').select('*, author:user_profiles(full_name, trust_score)').eq('question_id', q.id).order('is_accepted', { ascending: false }).order('votes_count', { ascending: false });
    setAnswers((data as QAAnswer[]) ?? []);
    await supabase.from('qa_questions').update({ views_count: (q.views_count ?? 0) + 1 }).eq('id', q.id);
  };

  const handleSubmitAnswer = async () => {
    if (!user || !selectedQ || !newAnswer.trim()) return;
    setSubmittingAnswer(true);
    const { data } = await supabase.from('qa_answers').insert({ question_id: selectedQ.id, author_id: user.id, content: newAnswer.trim() }).select('*, author:user_profiles(full_name, trust_score)').single();
    if (data) {
      setAnswers((prev) => [...prev, data as QAAnswer]);
      await supabase.from('qa_questions').update({ answers_count: (selectedQ.answers_count ?? 0) + 1 }).eq('id', selectedQ.id);
      setSelectedQ((prev) => prev ? { ...prev, answers_count: (prev.answers_count ?? 0) + 1 } : null);
    }
    setNewAnswer('');
    setSubmittingAnswer(false);
    showToast('Réponse publiée !');
  };

  const handlePostQuestion = async () => {
    if (!user || !newQuestion.title.trim()) return;
    setPostingQ(true);
    await supabase.from('qa_questions').insert({
      author_id: user.id,
      title: newQuestion.title,
      content: newQuestion.content,
      tags: newQuestion.tags ? newQuestion.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      category: newQuestion.category,
    });
    setNewQuestion({ title: '', content: '', tags: '', category: 'général' });
    setShowAskModal(false);
    setPostingQ(false);
    showToast('Question publiée !');
    await loadQuestions();
  };

  const CATEGORIES = ['général', 'matériel', 'itinéraires', 'sécurité', 'réglementation', 'logistique'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-xl text-[#1C2620]">Questions & Réponses</h2>
          <p className="text-xs text-[#5C6B5E] mt-0.5">Posez vos questions, partagez votre expertise</p>
        </div>
        {user && (
          <button onClick={() => setShowAskModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
            <Icon name="PlusIcon" size={14} /> Poser une question
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-24 animate-pulse" />)}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-[#5C6B5E]">
          <p className="text-4xl mb-3">❓</p>
          <p className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucune question</p>
          <p className="text-sm">Soyez le premier à poser une question !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:border-[#E4501C]/30 transition-colors cursor-pointer" onClick={() => openQuestion(q)}>
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="font-mono font-700 text-[#1C2620] text-sm">{q.votes_count ?? 0}</span>
                  <span className="text-[10px] text-[#5C6B5E]">votes</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {q.is_solved && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-700">✓ Résolu</span>}
                    <span className="text-[10px] bg-[#E7E3D6] text-[#5C6B5E] px-2 py-0.5 rounded-full">{q.category}</span>
                  </div>
                  <h3 className="font-600 text-[#1C2620] text-sm mb-1">{q.title}</h3>
                  {q.content && <p className="text-xs text-[#5C6B5E] line-clamp-2 mb-2">{q.content}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-[#5C6B5E] flex-wrap">
                    <span>{q.author?.full_name ?? 'Anonyme'}</span>
                    <span>💬 {q.answers_count ?? 0} réponses</span>
                    <span>👁️ {q.views_count ?? 0} vues</span>
                    {q.tags?.slice(0, 3).map((tag) => <span key={tag} className="bg-[#E7E3D6] px-1.5 py-0.5 rounded-full">#{tag}</span>)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question detail modal */}
      {selectedQ && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-[#C8C3B0]">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {selectedQ.is_solved && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-700">✓ Résolu</span>}
                  <span className="text-[10px] bg-[#E7E3D6] text-[#5C6B5E] px-2 py-0.5 rounded-full">{selectedQ.category}</span>
                </div>
                <h3 className="font-display font-700 text-[#1C2620] text-lg">{selectedQ.title}</h3>
                {selectedQ.content && <p className="text-sm text-[#5C6B5E] mt-1">{selectedQ.content}</p>}
              </div>
              <button onClick={() => setSelectedQ(null)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors flex-shrink-0"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider">{answers.length} réponse{answers.length !== 1 ? 's' : ''}</p>
              {answers.map((a) => (
                <div key={a.id} className={`p-4 rounded-xl border ${a.is_accepted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#C8C3B0]'}`}>
                  {a.is_accepted && <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-700 mb-2"><Icon name="CheckCircleIcon" size={14} /> Meilleure réponse</div>}
                  <p className="text-sm text-[#1C2620] mb-3">{a.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[#5C6B5E]">
                    <span>{a.author?.full_name ?? 'Anonyme'}</span>
                    <span>▲ {a.votes_count ?? 0}</span>
                  </div>
                </div>
              ))}
              {answers.length === 0 && <p className="text-center text-[#5C6B5E] text-sm py-4">Aucune réponse pour l&apos;instant.</p>}
            </div>
            {user && (
              <div className="p-5 border-t border-[#C8C3B0] space-y-3">
                <textarea
                  rows={3}
                  className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-3 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 resize-none"
                  placeholder="Votre réponse..."
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                />
                <button onClick={handleSubmitAnswer} disabled={submittingAnswer || !newAnswer.trim()} className="px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50">
                  {submittingAnswer ? 'Publication...' : 'Répondre'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ask question modal */}
      {showAskModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[#C8C3B0]">
              <h3 className="font-display font-700 text-[#1C2620] text-lg">Poser une question</h3>
              <button onClick={() => setShowAskModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Titre *</label>
                <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="Votre question en une phrase..." value={newQuestion.title} onChange={(e) => setNewQuestion((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Détails</label>
                <textarea rows={3} className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 resize-none" placeholder="Contexte, ce que vous avez déjà essayé..." value={newQuestion.content} onChange={(e) => setNewQuestion((f) => ({ ...f, content: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Catégorie</label>
                <select className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" value={newQuestion.category} onChange={(e) => setNewQuestion((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-700 text-[#5C6B5E] uppercase tracking-wider block mb-1.5">Tags (séparés par des virgules)</label>
                <input className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30" placeholder="matelas, bivouac, hiver..." value={newQuestion.tags} onChange={(e) => setNewQuestion((f) => ({ ...f, tags: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-[#C8C3B0]">
              <button onClick={() => setShowAskModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-600 text-[#5C6B5E] hover:bg-[#C8C3B0]/20 transition-colors">Annuler</button>
              <button onClick={handlePostQuestion} disabled={postingQ || !newQuestion.title.trim()} className="flex-1 py-2.5 rounded-xl bg-[#E4501C] text-white text-sm font-700 hover:bg-[#E4501C]/90 transition-colors disabled:opacity-50">
                {postingQ ? 'Publication...' : 'Publier la question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── AMA Tab ──────────────────────────────────────────────────────────────────
function AMATab() {
  const [sessions, setSessions] = useState<AMASession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<AMASession | null>(null);
  const [amaQuestions, setAmaQuestions] = useState<AMAQuestion[]>([]);
  const [newAmaQ, setNewAmaQ] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('ama_sessions')
        .select('*, expert:user_profiles(full_name, avatar_url, trust_score, loyalty_level)')
        .order('scheduled_at', { ascending: true });
      setSessions((data as AMASession[]) ?? []);
      setLoading(false);
    };
    load();
  }, [supabase]);

  const openSession = async (session: AMASession) => {
    setSelectedSession(session);
    const { data } = await supabase
      .from('ama_questions')
      .select('*, author:user_profiles(full_name)')
      .eq('session_id', session.id)
      .order('votes_count', { ascending: false });
    setAmaQuestions((data ?? []).map((q) => ({ ...q, user_voted: false })));
  };

  const handleSubmitAmaQ = async () => {
    if (!user || !selectedSession || !newAmaQ.trim()) return;
    setSubmitting(true);
    const { data } = await supabase.from('ama_questions').insert({ session_id: selectedSession.id, author_id: user.id, content: newAmaQ.trim() }).select('*, author:user_profiles(full_name)').single();
    if (data) {
      setAmaQuestions((prev) => [...prev, { ...data as AMAQuestion, user_voted: false }]);
      await supabase.from('ama_sessions').update({ questions_count: (selectedSession.questions_count ?? 0) + 1 }).eq('id', selectedSession.id);
      setSelectedSession((prev) => prev ? { ...prev, questions_count: (prev.questions_count ?? 0) + 1 } : null);
    }
    setNewAmaQ('');
    setSubmitting(false);
    showToast('Question soumise !');
  };

  const STATUS_CFG: Record<string, { label: string; color: string }> = {
    upcoming: { label: '📅 À venir', color: 'bg-blue-100 text-blue-700' },
    live: { label: '🔴 En direct', color: 'bg-red-100 text-red-700' },
    ended: { label: '✓ Terminé', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-700 text-xl text-[#1C2620]">AMAs avec les experts</h2>
        <p className="text-xs text-[#5C6B5E] mt-0.5">Ask Me Anything — posez vos questions aux experts de la communauté</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-40 animate-pulse" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-[#5C6B5E]">
          <p className="text-4xl mb-3">🎤</p>
          <p className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucun AMA planifié</p>
          <p className="text-sm">Les prochaines sessions seront annoncées ici.</p>
        </div>
      ) : (
        sessions.map((session) => {
          const statusCfg = STATUS_CFG[session.status] ?? STATUS_CFG.upcoming;
          const lvl = LEVEL_CFG[session.expert?.loyalty_level ?? 'Explorateur'] ?? LEVEL_CFG.Explorateur;
          return (
            <div key={session.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E4501C]/20 flex items-center justify-center font-700 text-[#E4501C] text-lg flex-shrink-0">
                  {session.expert?.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${lvl.color}`}>{lvl.icon} {session.expert?.loyalty_level}</span>
                  </div>
                  <h3 className="font-display font-700 text-[#1C2620] text-base mb-1">{session.title}</h3>
                  <p className="text-xs text-[#5C6B5E] mb-2">{session.description}</p>
                  <div className="flex items-center gap-4 text-[10px] text-[#5C6B5E] flex-wrap">
                    <span>Par {session.expert?.full_name ?? 'Expert'}</span>
                    {session.scheduled_at && <span>{new Date(session.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                    <span>❓ {session.questions_count ?? 0} questions</span>
                  </div>
                </div>
                <button
                  onClick={() => openSession(session)}
                  className="flex-shrink-0 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors"
                >
                  {session.status === 'live' ? '🔴 Rejoindre' : session.status === 'ended' ? 'Voir les Q&R' : 'Poser une question'}
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* AMA Session modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-[#C8C3B0]">
              <div>
                <h3 className="font-display font-700 text-[#1C2620] text-lg">{selectedSession.title}</h3>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Par {selectedSession.expert?.full_name} · {amaQuestions.length} questions</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {amaQuestions.length === 0 ? (
                <p className="text-center text-[#5C6B5E] text-sm py-8">Aucune question pour l&apos;instant. Soyez le premier !</p>
              ) : (
                amaQuestions.map((q) => (
                  <div key={q.id} className={`p-4 rounded-xl border ${q.is_answered ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#C8C3B0]'}`}>
                    <p className="text-sm text-[#1C2620] mb-1">{q.content}</p>
                    {q.is_answered && q.answer && (
                      <div className="mt-2 pl-3 border-l-2 border-emerald-400">
                        <p className="text-[10px] font-700 text-emerald-600 mb-0.5">Réponse de l&apos;expert</p>
                        <p className="text-xs text-[#5C6B5E]">{q.answer}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-[#5C6B5E] mt-1">{q.author?.full_name ?? 'Anonyme'} · ▲ {q.votes_count ?? 0}</p>
                  </div>
                ))
              )}
            </div>
            {user && selectedSession.status !== 'ended' && (
              <div className="p-5 border-t border-[#C8C3B0] flex gap-3">
                <input
                  className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30"
                  placeholder="Posez votre question à l'expert..."
                  value={newAmaQ}
                  onChange={(e) => setNewAmaQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitAmaQ(); } }}
                />
                <button onClick={handleSubmitAmaQ} disabled={submitting || !newAmaQ.trim()} className="px-4 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-600 disabled:opacity-50 hover:bg-[#E4501C]/90 transition-colors">
                  {submitting ? '...' : 'Envoyer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Groups Tab ───────────────────────────────────────────────────────────────
function GroupesTab() {
  const [publicGroups, setPublicGroups] = useState<{ id: string; name: string; destination: string; theme: string; visibility: string; group_level: number; optimization_score: number; max_members: number; budget_target: number; departure_date: string | null; member_count?: number; owner?: { full_name: string } | null }[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const THEME_EMOJI: Record<string, string> = {
    Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍',
    Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒',
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('travel_groups')
        .select('*, owner:user_profiles!travel_groups_owner_id_fkey(full_name)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(12);
      const enriched = await Promise.all((data || []).map(async (g) => {
        const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'active');
        return { ...g, member_count: count || 0 };
      }));
      setPublicGroups(enriched);
      if (user) {
        const { data: memberData } = await supabase.from('group_members').select('group_id').eq('user_id', user.id).eq('status', 'active');
        setMyGroupIds((memberData || []).map(m => m.group_id));
      }
      setLoading(false);
    };
    load();
  }, [supabase, user]);

  const handleJoin = async (groupId: string, groupName: string) => {
    if (!user) { showToast('Connectez-vous pour rejoindre un groupe'); return; }
    setJoining(groupId);
    try {
      const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id, role: 'member', status: 'active' });
      if (error && error.code !== '23505') throw error;
      setMyGroupIds(prev => [...prev, groupId]);
      showToast(`Vous avez rejoint "${groupName}" !`);
    } catch { showToast('Erreur lors de la tentative'); }
    finally { setJoining(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-xl text-[#1C2620]">Groupes de voyage</h2>
          <p className="text-xs text-[#5C6B5E] mt-0.5">Rejoignez des aventuriers qui partagent vos destinations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/groupes" className="flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl text-sm font-600 hover:text-[#1C2620] transition-colors">
            <Icon name="UserGroupIcon" size={14} /> Mes groupes
          </Link>
          <Link href="/groupes?tab=decouvrir" className="flex items-center gap-2 px-4 py-2 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
            <Icon name="MagnifyingGlassIcon" size={14} /> Explorer tout
          </Link>
        </div>
      </div>

      {/* CTA for non-logged users */}
      {!user && (
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 text-center">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="font-display font-700 text-[#1C2620] mb-1">Voyagez en groupe</p>
          <p className="text-sm text-[#5C6B5E] mb-4">Connectez-vous pour créer ou rejoindre des groupes de voyage</p>
          <Link href="/connexion" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
            <Icon name="ArrowRightOnRectangleIcon" size={14} /> Se connecter
          </Link>
        </div>
      )}

      {/* Groups grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl h-48 animate-pulse" />)}
        </div>
      ) : publicGroups.length === 0 ? (
        <div className="text-center py-16 text-[#5C6B5E]">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucun groupe public</p>
          <p className="text-sm mb-4">Soyez le premier à créer un groupe de voyage !</p>
          <Link href="/groupes" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E4501C] text-white rounded-xl text-sm font-700 hover:bg-[#E4501C]/90 transition-colors">
            <Icon name="PlusIcon" size={14} /> Créer un groupe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {publicGroups.map(group => {
            const isMember = myGroupIds.includes(group.id);
            return (
              <div key={group.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#E4501C]/30 transition-all">
                <div className="bg-[#1C2620] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
                        {THEME_EMOJI[group.theme] || '🎒'}
                      </div>
                      <div>
                        <h3 className="font-display font-700 text-white text-sm leading-tight">{group.name}</h3>
                        <p className="text-white/50 text-[10px] flex items-center gap-1 mt-0.5">
                          <Icon name="MapPinIcon" size={9} /> {group.destination}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-700 text-[#E4501C] text-base">{group.optimization_score}</div>
                      <div className="text-[10px] text-white/40">score</div>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-1.5 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                      <p className="font-mono font-700 text-[#1C2620] text-sm">{group.member_count || 0}</p>
                      <p className="text-[10px] text-[#5C6B5E]">membres</p>
                    </div>
                    <div className="text-center p-1.5 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                      <p className="font-mono font-700 text-[#1C2620] text-sm">{group.budget_target > 0 ? `${group.budget_target}€` : '—'}</p>
                      <p className="text-[10px] text-[#5C6B5E]">budget</p>
                    </div>
                    <div className="text-center p-1.5 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                      <p className="font-mono font-700 text-[#1C2620] text-sm">Niv.{group.group_level}</p>
                      <p className="text-[10px] text-[#5C6B5E]">niveau</p>
                    </div>
                  </div>
                  {group.departure_date && (
                    <p className="text-[10px] text-[#5C6B5E] flex items-center gap-1 mb-3">
                      <Icon name="CalendarIcon" size={9} />
                      {new Date(group.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                  {group.owner && (
                    <p className="text-[10px] text-[#5C6B5E] mb-3">Par <span className="font-600 text-[#1C2620]">{group.owner.full_name}</span></p>
                  )}
                  <div className="flex gap-2">
                    {isMember ? (
                      <Link href={`/groupe?group=${group.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1C2620] hover:bg-[#1C2620]/80 text-white rounded-xl text-xs font-700 transition-colors">
                        <Icon name="ArrowRightIcon" size={11} /> Ouvrir
                      </Link>
                    ) : (
                      <>
                        <button
                          onClick={() => handleJoin(group.id, group.name)}
                          disabled={joining === group.id || (group.member_count || 0) >= group.max_members}
                          className="flex-1 py-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl text-xs font-700 transition-colors disabled:opacity-50"
                        >
                          {joining === group.id ? '...' : (group.member_count || 0) >= group.max_members ? 'Complet' : 'Rejoindre'}
                        </button>
                        <Link href={`/groupe?group=${group.id}`} className="p-2 border border-[#C8C3B0] text-[#5C6B5E] rounded-xl hover:border-[#1C2620]/30 hover:text-[#1C2620] transition-colors">
                          <Icon name="EyeIcon" size={12} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunautePage() {
  const [activeTab, setActiveTab] = useState<MainTab>('feed');

  const TABS: { id: MainTab; label: string; icon: string }[] = [
    { id: 'feed', label: 'Feed', icon: 'RssIcon' },
    { id: 'profils', label: 'Profils', icon: 'UsersIcon' },
    { id: 'groupes', label: 'Groupes', icon: 'MapIcon' },
    { id: 'qa', label: 'Q&R', icon: 'QuestionMarkCircleIcon' },
    { id: 'ama', label: 'AMA', icon: 'MicrophoneIcon' },
  ];

  return (
    <div className="min-h-screen bg-[#E7E3D6] text-[#1C2620]">
      <Header />

      {/* Hero */}
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2">Communauté</p>
          <h1 className="font-display font-800 text-white text-2xl sm:text-3xl tracking-tight mb-2">
            La communauté des voyageurs équipés
          </h1>
          <p className="text-white/50 text-sm max-w-xl mb-6">
            Feed global, profils publics, groupes de voyage, Q&R entre voyageurs et AMAs avec les experts.
          </p>

          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <Link href="/carnets" className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-600 transition-colors">
              <Icon name="BookOpenIcon" size={14} /> Carnets d&apos;expédition
            </Link>
            <Link href="/clubs" className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-600 transition-colors">
              <Icon name="UserGroupIcon" size={14} /> Clubs
            </Link>
            <Link href="/groupes" className="flex items-center gap-2 px-4 py-2 bg-[#E4501C]/20 hover:bg-[#E4501C]/30 border border-[#E4501C]/40 text-white rounded-xl text-sm font-600 transition-colors">
              <Icon name="MapIcon" size={14} /> Mes groupes
            </Link>
            <Link href="/groupes?tab=decouvrir" className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-600 transition-colors">
              <Icon name="MagnifyingGlassIcon" size={14} /> Découvrir des groupes
            </Link>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0.5 overflow-x-auto pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#E7E3D6] text-[#1C2620]' : 'text-white/50 hover:text-white hover:bg-white/8'}`}
              >
                <Icon name={tab.icon} size={14} variant="outline" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'profils' && <ProfilsTab />}
        {activeTab === 'groupes' && <GroupesTab />}
        {activeTab === 'qa' && <QATab />}
        {activeTab === 'ama' && <AMATab />}
      </div>

      <Footer />
    </div>
  );
}

export const dynamic = 'force-dynamic';