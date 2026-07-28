'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

import CreateCarnetView from '@/components/carnets/CreateCarnetView';
import CommentItem from '@/components/communaute/CommentItem';

// Helper formatting functions
const formatDateString = (dateString: string) => {
  const d = new Date(dateString);
  const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
  return {
    day: d.getDate().toString().padStart(2, '0'),
    month: months[d.getMonth()]
  };
};

const timeAgo = (dateString: string) => {
  const d = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `Il y a ${Math.max(1, hours)} h`;
  return `Il y a ${Math.floor(hours / 24)} j`;
};

// --- INLINE COMPONENTS FOR ENCAPSULATED STATE ---

function PostCard({ post, user }: { post: any, user: any }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const handleLike = async () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLikesCount(newCount);

    const supabase = createClient();
    const { error } = await supabase.from('community_posts').update({ likes_count: newCount }).eq('id', post.id);
    if (error) {
      console.error('Error updating like:', error);
      // Revert optimistic UI on error
      setIsLiked(isLiked);
      setLikesCount(likesCount);
    }
  };

  const handleToggleComments = async () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('post_comments')
        .select(`
          *,
          author:user_profiles(full_name, avatar_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });
      
      if (data) setComments(data);
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    const newComment = {
      id: Date.now().toString(),
      content: commentText.trim(),
      created_at: new Date().toISOString(),
      author: {
        full_name: user.user_metadata?.full_name || 'Moi',
        avatar_url: user.user_metadata?.avatar_url
      }
    };
    
    // Optimistic UI
    setComments([...comments, newComment]);
    setCommentsCount((prev: number) => prev + 1);
    setCommentText('');

    const supabase = createClient();
    const { error } = await supabase.from('post_comments').insert({
      post_id: post.id,
      author_id: user.id,
      content: newComment.content
    });
    if (error) {
      console.error("Comment insert error:", error);
      alert("Erreur lors de l'ajout du commentaire.");
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E8E4D8]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src={post.author?.avatar_url || 'https://i.pravatar.cc/150'} alt={post.author?.full_name} className="w-10 h-10 rounded-full border-2 border-[#F5F2E8] object-cover" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#1C2620]">{post.author?.full_name || 'Utilisateur inconnu'}</span>
              <span className="bg-[#D3DFD7] text-[#2D5A3D] text-[8px] font-mono tracking-widest px-1.5 py-0.5 rounded uppercase">
                {post.author?.loyalty_level || 'EXPLORATEUR'}
              </span>
            </div>
            <div className="text-[11px] text-[#5C6B5E] mt-0.5">{timeAgo(post.created_at)}</div>
          </div>
        </div>
        <button className="text-[#C8C3B0] hover:text-[#1C2620] transition-colors p-1">
          <Icon name="EllipsisHorizontalIcon" size={20} />
        </button>
      </div>

      {/* Content */}
      <p className="text-[#1C2620] text-sm leading-relaxed mb-5 whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Image (Optional) */}
      {post.image_url && (
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-[1.5rem] overflow-hidden mb-5">
          <img src={post.image_url} alt={post.image_alt || "Post image"} className="w-full h-full object-cover" />
          {post.location && (
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 text-[10px] font-semibold text-[#1C2620]">
              <Icon name="MapPinIcon" size={12} variant="solid" className="text-[#2D5A3D]" />
              {post.location}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#F5F2E8] pt-4">
        <div className="flex items-center gap-6">
          <motion.button 
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.9 }} 
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs transition-colors group ${isLiked ? 'text-red-500' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}
          >
            <Icon name="HeartIcon" size={18} variant={isLiked ? "solid" : "outline"} className={isLiked ? "fill-current" : "group-hover:fill-red-50 group-hover:text-red-500"} />
            <span className="font-mono">{likesCount}</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.9 }} 
            onClick={handleToggleComments}
            className="flex items-center gap-1.5 text-xs text-[#5C6B5E] hover:text-[#1C2620] transition-colors"
          >
            <Icon name="ChatBubbleLeftIcon" size={18} variant={showComments ? "solid" : "outline"} className={showComments ? "text-[#1C2620]" : ""} />
            <span className="font-mono">{commentsCount}</span>
          </motion.button>
        </div>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="text-[#5C6B5E] hover:text-[#1C2620] transition-colors p-1">
          <Icon name="BookmarkIcon" size={18} variant="outline" />
        </motion.button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 pt-4 border-t border-[#F5F2E8] space-y-4"
          >
            {loadingComments ? (
              <div className="flex justify-center py-2"><div className="w-4 h-4 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {comments.length === 0 ? (
                  <p className="text-xs text-[#5C6B5E] text-center italic">Aucun commentaire pour l&apos;instant. Soyez le premier !</p>
                ) : (
                  comments.map((c, i) => (
                    <CommentItem
                      key={c.id || i}
                      comment={c}
                      currentUser={user}
                      tableName="post_comments"
                      onUpdate={(id, newContent) =>
                        setComments((prev) => prev.map((item) => (item.id === id ? { ...item, content: newContent } : item)))
                      }
                      onDelete={(id) => {
                        setComments((prev) => prev.filter((item) => item.id !== id));
                        setCommentsCount((prev: number) => Math.max(0, prev - 1));
                      }}
                    />
                  ))
                )}
              </div>
            )}
            
            <form onSubmit={handleSubmitComment} className="flex items-center gap-2 mt-2">
              <img src={user.user_metadata?.avatar_url || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full object-cover" />
              <input 
                type="text" 
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Écrire un commentaire..."
                className="flex-1 bg-[#F5F2E8] border-none rounded-full px-4 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D]"
              />
              <button 
                type="submit" 
                disabled={!commentText.trim()}
                className="bg-[#2D5A3D] text-white p-2 rounded-full disabled:opacity-50 transition-colors"
              >
                <Icon name="PaperAirplaneIcon" size={14} variant="solid" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CarnetCard({ carnet, user }: { carnet: any, user: any }) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(carnet.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(carnet.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLikesCount(newCount);

    const supabase = createClient();
    const { error } = await supabase.from('carnets').update({ likes_count: newCount }).eq('id', carnet.id);
    if (error) {
      console.error('Error updating like for carnet:', error);
      setIsLiked(isLiked);
      setLikesCount(likesCount);
    }
  };

  const handleToggleComments = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('carnet_comments')
        .select(`
          *,
          author:user_profiles!author_id(full_name, avatar_url)
        `)
        .eq('carnet_id', carnet.id)
        .order('created_at', { ascending: true });
      
      if (data) setComments(data);
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentText.trim()) return;
    
    const newComment = {
      id: Date.now().toString(),
      content: commentText.trim(),
      created_at: new Date().toISOString(),
      author: {
        full_name: user.user_metadata?.full_name || 'Moi',
        avatar_url: user.user_metadata?.avatar_url
      }
    };
    
    setComments([...comments, newComment]);
    setCommentsCount((prev: number) => prev + 1);
    setCommentText('');

    const supabase = createClient();
    const { error } = await supabase.from('carnet_comments').insert({
      carnet_id: carnet.id,
      author_id: user.id,
      content: newComment.content
    });
    if (error) {
      console.error("Comment insert error:", error);
      alert("Erreur lors de l'ajout du commentaire.");
    }
  };

  return (
    <div 
      onClick={() => router.push(`/carnets/${carnet.id || encodeURIComponent(carnet.title)}`)}
      className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-[#E8E4D8] flex flex-col group cursor-pointer hover:border-[#2D5A3D] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full"
    >
      {/* Cover Image Header */}
      <div className="w-full aspect-[16/10] overflow-hidden relative bg-[#E7E3D6]">
        <img 
          src={carnet.cover_image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800'} 
          alt={carnet.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        
        {/* Floating Badges (Top Left) */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-2 flex-wrap">
          {carnet.destination && (
            <span className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-bold text-[#1C2620] shadow-md flex items-center gap-1.5">
              <Icon name="MapPinIcon" size={12} className="text-[#E4501C]" />
              <span>{carnet.destination}</span>
            </span>
          )}
          {carnet.duration && (
            <span className="bg-[#1C2620]/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold shadow-sm">
              ⏱️ {carnet.duration}
            </span>
          )}
        </div>

        {/* Top Right Verified / Favorite Badge */}
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
          {carnet.verified && (
            <span className="bg-[#2D6A4F] text-white backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
              <span>✓</span> Vérifié
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4 bg-white">
        <div className="space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-[#E4501C] uppercase font-bold">
            CARNET DE VOYAGE
          </div>
          <h3 className="font-display font-800 text-xl text-[#1C2620] leading-snug group-hover:text-[#2D5A3D] transition-colors line-clamp-2">
            {carnet.title}
          </h3>
          {carnet.description && (
            <p className="text-xs text-[#5C6B5E] line-clamp-2 leading-relaxed font-normal">
              {carnet.description}
            </p>
          )}
        </div>

        {/* Key Metrics Chips Row */}
        {(carnet.distance_km || carnet.elevation_m || carnet.duration) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {carnet.distance_km && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#1C2620] text-[11px] font-mono font-semibold rounded-lg border border-[#E4E0D4]">
                📏 {carnet.distance_km} km
              </span>
            )}
            {carnet.elevation_m && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#1C2620] text-[11px] font-mono font-semibold rounded-lg border border-[#E4E0D4]">
                ⛰️ +{carnet.elevation_m} m
              </span>
            )}
            {carnet.weather && (
              <span className="px-2.5 py-1 bg-[#F5F2EA] text-[#1C2620] text-[11px] font-medium rounded-lg border border-[#E4E0D4] truncate max-w-[150px]">
                ☁️ {carnet.weather}
              </span>
            )}
          </div>
        )}

        {/* Footer Author & Actions */}
        <div className="flex flex-col pt-4 border-t border-[#F0ECE1] mt-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            {/* Author profile */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img 
                  src={carnet.author?.avatar_url || 'https://i.pravatar.cc/150'} 
                  alt={carnet.author?.full_name || 'Voyageur'}
                  className="w-8 h-8 rounded-full border border-[#E8E4D8] object-cover" 
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div className="truncate">
                <span className="font-bold text-xs text-[#1C2620] block truncate">{carnet.author?.full_name || 'Voyageur'}</span>
                <span className="text-[10px] text-[#7A8A7D] block">Explorateur</span>
              </div>
            </div>

            {/* Social action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-1.5 text-xs font-mono font-bold transition-all px-3 py-1.5 rounded-full border ${
                  isLiked ? 'text-red-500 bg-red-50 border-red-200 shadow-sm' : 'text-[#5C6B5E] border-[#E4E0D4] hover:text-[#1C2620] hover:bg-[#F5F2EA]'
                }`}
              >
                <Icon name="HeartIcon" size={14} variant={isLiked ? "solid" : "outline"} />
                <span>{likesCount}</span>
              </button>

              <button 
                onClick={handleToggleComments}
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#5C6B5E] border border-[#E4E0D4] hover:text-[#1C2620] transition-all px-3 py-1.5 rounded-full hover:bg-[#F5F2EA]"
              >
                <Icon name="ChatBubbleLeftIcon" size={14} variant={showComments ? "solid" : "outline"} />
                <span>{commentsCount}</span>
              </button>
            </div>
          </div>

          {/* Comments Expandable Drawer */}
          <AnimatePresence>
            {showComments && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden pt-3 border-t border-[#F0ECE1] space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                {loadingComments ? (
                  <div className="text-center py-2 text-xs text-[#5C6B5E]">Chargement des commentaires...</div>
                ) : (
                  <>
                    <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {comments.length === 0 ? (
                        <p className="text-[11px] text-[#5C6B5E] italic text-center py-2">Aucun commentaire pour l&apos;instant. Soyez le premier !</p>
                      ) : (
                        comments.map((c, i) => (
                          <CommentItem
                            key={c.id || i}
                            comment={c}
                            currentUser={user}
                            tableName="carnet_comments"
                            onUpdate={(id, newContent) =>
                              setComments((prev) => prev.map((item) => (item.id === id ? { ...item, content: newContent } : item)))
                            }
                            onDelete={(id) => {
                              setComments((prev) => prev.filter((item) => item.id !== id));
                              setCommentsCount((prev: number) => Math.max(0, prev - 1));
                            }}
                          />
                        ))
                      )}
                    </div>
                    {user && (
                      <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-1">
                        <input 
                          type="text" 
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          placeholder="Ajouter un commentaire..."
                          className="flex-1 bg-[#F5F2EA] border border-[#E4E0D4] rounded-full px-3.5 py-1.5 text-xs text-[#1C2620] focus:outline-none focus:border-[#2D5A3D]"
                        />
                        <button 
                          type="submit" 
                          disabled={!commentText.trim()}
                          className="bg-[#2D5A3D] text-white p-2 rounded-full disabled:opacity-50 hover:bg-[#1C2620] transition-colors"
                        >
                          <Icon name="PaperAirplaneIcon" size={12} variant="solid" />
                        </button>
                      </form>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── CARNET FORM MODAL ────────────────────────────────────────────────────────
function CarnetFormModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (form: any) => void;
  saving?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#F5F2E8] animate-fade-in font-sans">
      <div className="relative min-h-screen">
        <CreateCarnetView onCloseModal={onClose} />
      </div>
    </div>
  );
}

// ─── CLUB FORM MODAL ──────────────────────────────────────────────────────────
function ClubFormModal({
  isOpen,
  onClose,
  onSave,
  saving
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (form: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    type: 'activité',
    emoji: '🏕️',
    description: '',
    category: 'Randonnée',
    rules: '',
    privacy: 'open'
  });

  if (!isOpen) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white border border-[#E8E4D8] shadow-2xl rounded-[2.5rem] w-full max-w-lg my-4 overflow-hidden flex flex-col p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
          <div>
            <h3 className="font-display font-800 text-2xl text-[#1C2620]">Créer un nouveau club</h3>
            <p className="text-xs text-[#5C6B5E] mt-0.5">Rassemblez les voyageurs autour d&apos;une passion commune.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-[#F5F2E8] hover:bg-[#E8E4D8] rounded-full text-[#1C2620] transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Emoji</label>
              <input type="text" className="w-full bg-[#F5F2E8] border-none rounded-2xl p-3 text-center text-2xl" value={form.emoji} onChange={e => set('emoji', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nom du club *</label>
              <input type="text" placeholder="Ex: Club Trek Alpes" className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] focus:ring-1 focus:ring-[#2D5A3D]" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Type</label>
              <select className="w-full bg-[#F5F2E8] border-none rounded-2xl px-3 py-3 text-xs text-[#1C2620]" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="activité">🎯 Activité</option>
                <option value="pays">🌍 Destination</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Catégorie</label>
              <input type="text" placeholder="Ex: Randonnée, Kayak..." className="w-full bg-[#F5F2E8] border-none rounded-2xl px-3 py-3 text-xs text-[#1C2620]" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Description</label>
            <textarea rows={3} placeholder="Présentez l'objectif et l'esprit du club..." className="w-full bg-[#F5F2E8] border-none rounded-2xl p-3 text-xs text-[#1C2620] resize-none" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Règles (optionnel)</label>
            <textarea rows={2} placeholder="Règles de bonne conduite..." className="w-full bg-[#F5F2E8] border-none rounded-2xl p-3 text-xs text-[#1C2620] resize-none" value={form.rules} onChange={e => set('rules', e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Confidentialité</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'open', l: '🌍 Ouvert', d: 'Libre accès' },
                { v: 'closed', l: '🔒 Fermé', d: 'Sur demande' },
                { v: 'secret', l: '🕵️ Secret', d: 'Sur invitation' },
              ].map(opt => (
                <button type="button" key={opt.v} onClick={() => set('privacy', opt.v)} className={`p-3 rounded-2xl border text-left transition-all ${form.privacy === opt.v ? 'border-[#2D5A3D] bg-[#2D5A3D]/10 text-[#2D5A3D]' : 'border-[#E8E4D8] bg-[#F5F2E8] text-[#5C6B5E]'}`}>
                  <div className="font-bold text-xs">{opt.l}</div>
                  <div className="text-[9px] opacity-75">{opt.d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#F5F2E8]">
          <button onClick={onClose} className="px-5 py-3 rounded-full text-xs font-semibold text-[#5C6B5E] hover:bg-[#F5F2E8] transition-colors">Annuler</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} className="flex-1 py-3 bg-[#2D5A3D] text-white rounded-full text-xs font-bold hover:bg-[#1C2620] transition-colors disabled:opacity-50 shadow-md">
            {saving ? 'Création...' : 'Créer le club'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── CLUB DETAIL MODAL ────────────────────────────────────────────────────────
function ClubDetailModal({
  club,
  onClose,
  currentUserId,
  onRefresh
}: {
  club: any | null;
  onClose: () => void;
  currentUserId?: string;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'topics' | 'members' | 'challenges' | 'events' | 'moderation'>('topics');
  const [topics, setTopics] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', content: '' });
  const [postingTopic, setPostingTopic] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '', location: '', max_participants: 20 });
  const [postingEvent, setPostingEvent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const isAdmin = club?.is_member && (club?.member_role === 'admin' || club?.member_role === 'moderator');

  const loadData = useCallback(async () => {
    if (!club) return;
    setLoading(true);
    const supabase = createClient();
    const [topicsRes, membersRes, challengesRes, eventsRes] = await Promise.all([
      supabase.from('club_topics').select('*, author:user_profiles(full_name)').eq('club_id', club.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('club_members').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'active'),
      supabase.from('club_challenges').select('*').eq('club_id', club.id).eq('active', true),
      supabase.from('club_events').select('*').eq('club_id', club.id).order('event_date', { ascending: true }),
    ]);
    setTopics(topicsRes.data || []);
    setMembers(membersRes.data || []);
    setChallenges(challengesRes.data || []);
    setEvents(eventsRes.data || []);

    if (isAdmin) {
      const { data: pending } = await supabase.from('club_join_requests').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'pending');
      setPendingRequests(pending || []);
    }
    setLoading(false);
  }, [club, isAdmin]);

  useEffect(() => { if (club) loadData(); }, [club, loadData]);

  const handlePostTopic = async () => {
    if (!club || !currentUserId || !newTopic.title.trim()) return;
    setPostingTopic(true);
    const supabase = createClient();
    await supabase.from('club_topics').insert({ club_id: club.id, author_id: currentUserId, title: newTopic.title, content: newTopic.content });
    setNewTopic({ title: '', content: '' });
    setPostingTopic(false);
    showToast('Discussion publiée !');
    loadData();
  };

  const handlePostEvent = async () => {
    if (!club || !currentUserId || !newEvent.title.trim()) return;
    setPostingEvent(true);
    const supabase = createClient();
    await supabase.from('club_events').insert({
      club_id: club.id,
      organizer_id: currentUserId,
      title: newEvent.title,
      description: newEvent.description,
      event_date: newEvent.event_date || null,
      location: newEvent.location,
      max_participants: newEvent.max_participants,
    });
    setNewEvent({ title: '', description: '', event_date: '', location: '', max_participants: 20 });
    setPostingEvent(false);
    showToast('Événement créé !');
    loadData();
  };

  const handleApproveRequest = async (requestId: string, userId: string, approve: boolean) => {
    const supabase = createClient();
    await supabase.from('club_join_requests').update({ status: approve ? 'approved' : 'rejected' }).eq('id', requestId);
    if (approve && club) {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: userId, role: 'member', status: 'active' });
      await supabase.from('clubs').update({ members_count: (club.members_count || 0) + 1 }).eq('id', club.id);
    }
    showToast(approve ? 'Demande approuvée !' : 'Demande refusée.');
    loadData();
    onRefresh();
  };

  if (!club) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#F5F2E8] border border-[#E8E4D8] shadow-2xl rounded-[2.5rem] w-full max-w-3xl my-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#1C2620] text-white p-6 sm:p-8 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#E4501C] rounded-full blur-[80px] opacity-30 pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/20">
                {club.emoji || '🏔️'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-800 text-2xl text-white">{club.name}</h2>
                  {club.is_verified && <span className="bg-[#2D5A3D] text-white text-[9px] font-mono px-2 py-0.5 rounded-full">✓ VÉRIFIÉ</span>}
                </div>
                <p className="text-xs text-white/70 mt-1">
                  {club.members_count || 0} membres · {club.category || 'Général'} · {club.privacy === 'open' ? '🌍 Ouvert' : '🔒 Sur demande'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
          {club.description && (
            <p className="text-xs text-white/80 mt-4 leading-relaxed max-w-xl">{club.description}</p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-[#E8E4D8] px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {[
            { id: 'topics', label: '💬 Discussions', count: topics.length },
            { id: 'members', label: '👥 Membres', count: members.length },
            { id: 'challenges', label: '🏆 Défis', count: challenges.length },
            { id: 'events', label: '📅 Agenda', count: events.length },
            ...(isAdmin ? [{ id: 'moderation', label: `🛡️ Modération (${pendingRequests.length})`, count: pendingRequests.length }] : [])
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#5C6B5E] hover:bg-[#F5F2E8]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"></div></div>
          ) : activeTab === 'topics' ? (
            <div className="space-y-4">
              {club.is_member && (
                <div className="bg-white p-4 rounded-2xl border border-[#E8E4D8] space-y-3">
                  <h4 className="font-bold text-xs text-[#1C2620] uppercase tracking-wider">Lancer un sujet</h4>
                  <input type="text" placeholder="Titre du sujet..." className="w-full bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D]" value={newTopic.title} onChange={e => setNewTopic({ ...newTopic, title: e.target.value })} />
                  <textarea rows={2} placeholder="Description..." className="w-full bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D] resize-none" value={newTopic.content} onChange={e => setNewTopic({ ...newTopic, content: e.target.value })} />
                  <button onClick={handlePostTopic} disabled={postingTopic || !newTopic.title.trim()} className="px-4 py-2 bg-[#2D5A3D] text-white rounded-full text-xs font-bold disabled:opacity-50">
                    {postingTopic ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              )}

              {topics.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucune discussion lancée dans ce club pour le moment.</p>
                </div>
              ) : (
                topics.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#1C2620]">{t.title}</h4>
                      {t.is_pinned && <span className="bg-[#2D5A3D]/10 text-[#2D5A3D] text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">📌 ÉPINGLÉ</span>}
                    </div>
                    {t.content && <p className="text-xs text-[#4A574C] leading-relaxed">{t.content}</p>}
                    <div className="flex items-center justify-between text-[10px] text-[#5C6B5E] pt-2 border-t border-[#F5F2E8]">
                      <span>Par {t.author?.full_name || 'Anonyme'}</span>
                      <span>❤️ {t.likes_count || 0} likes</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'members' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map(m => (
                <div key={m.id} className="bg-white p-3 rounded-2xl border border-[#E8E4D8] flex items-center gap-3">
                  <img src={m.user?.avatar_url || 'https://i.pravatar.cc/150'} className="w-9 h-9 rounded-full object-cover border border-[#E8E4D8]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-[#1C2620] truncate">{m.user?.full_name || 'Membre'}</p>
                    <span className="text-[9px] font-mono text-[#2D5A3D] bg-[#EAF0EB] px-2 py-0.5 rounded-full uppercase">
                      {m.role === 'admin' ? '👑 Admin' : m.role === 'moderator' ? '🛡️ Modo' : 'Membre'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'challenges' ? (
            <div className="space-y-3">
              {challenges.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucun défi actif actuellement.</p>
                </div>
              ) : (
                challenges.map(ch => (
                  <div key={ch.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-[#1C2620] mb-1">{ch.title}</h4>
                      <p className="text-xs text-[#4A574C] mb-2">{ch.description}</p>
                      <span className="bg-[#E4501C]/10 text-[#E4501C] text-[10px] font-bold px-2.5 py-1 rounded-full">+{ch.xp} XP</span>
                    </div>
                    <button className="px-4 py-2 bg-[#1C2620] text-white rounded-full text-xs font-bold hover:bg-[#2D5A3D] transition-colors">Relever</button>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'events' ? (
            <div className="space-y-4">
              {isAdmin && (
                <div className="bg-white p-4 rounded-2xl border border-[#E8E4D8] space-y-3">
                  <h4 className="font-bold text-xs text-[#1C2620] uppercase tracking-wider">Planifier une sortie</h4>
                  <input type="text" placeholder="Titre de la sortie..." className="w-full bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D]" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="datetime-local" className="bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                    <input type="text" placeholder="Lieu..." className="bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} />
                  </div>
                  <button onClick={handlePostEvent} disabled={postingEvent || !newEvent.title.trim()} className="px-4 py-2 bg-[#2D5A3D] text-white rounded-full text-xs font-bold disabled:opacity-50">
                    {postingEvent ? 'Création...' : 'Créer l\'événement'}
                  </button>
                </div>
              )}
              {events.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucune sortie planifiée.</p>
                </div>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-[#1C2620]">{ev.title}</h4>
                      <p className="text-xs text-[#5C6B5E] mt-0.5">📍 {ev.location || 'En ligne'} · {ev.event_date ? new Date(ev.event_date).toLocaleDateString('fr-FR') : 'Date à venir'}</p>
                    </div>
                    <button className="px-4 py-2 bg-[#2D5A3D] text-white rounded-full text-xs font-bold">Participer</button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucune demande en attente.</p>
                </div>
              ) : (
                pendingRequests.map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={r.user?.avatar_url || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full object-cover" />
                      <span className="font-bold text-xs text-[#1C2620]">{r.user?.full_name || 'Utilisateur'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApproveRequest(r.id, r.user_id, true)} className="px-3 py-1.5 bg-[#2D5A3D] text-white rounded-full text-xs font-bold">Accepter</button>
                      <button onClick={() => handleApproveRequest(r.id, r.user_id, false)} className="px-3 py-1.5 bg-[#F5F2E8] text-[#5C6B5E] rounded-full text-xs font-bold">Refuser</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {toast && (
          <div className="bg-[#1C2620] text-white text-xs font-bold px-4 py-2 text-center">
            {toast}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CommunautePage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Tabs State
  const [activeTab, setActiveTab] = useState('Feed');
  
  // Clubs Tab State & Modals
  const [clubFilterTab, setClubFilterTab] = useState<'all' | 'activite' | 'pays' | 'my_clubs'>('all');
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [isCreateClubModalOpen, setIsCreateClubModalOpen] = useState(false);
  const [selectedDetailClub, setSelectedDetailClub] = useState<any | null>(null);
  const [isSavingClub, setIsSavingClub] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  // Carnets Tab State & Modals
  const [carnetFilterCategory, setCarnetFilterCategory] = useState<string>('all');
  const [carnetSearchQuery, setCarnetSearchQuery] = useState('');
  const [isCreateCarnetModalOpen, setIsCreateCarnetModalOpen] = useState(false);
  const [isSavingCarnet, setIsSavingCarnet] = useState(false);

  // Data States
  const [posts, setPosts] = useState<any[]>([]);
  const [carnets, setCarnets] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [travelGroups, setTravelGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [newMembers, setNewMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    async function fetchData() {
      const supabase = createClient();
      setLoading(true);
      
      try {
        // Fetch Community Posts (Feed)
        const { data: postsData } = await supabase
          .from('community_posts')
          .select(`
            *,
            author:user_profiles!community_posts_author_id_fkey(full_name, avatar_url, loyalty_level)
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        if (postsData) setPosts(postsData);

        // Fetch Carnets (Long form & LocalStorage sync)
        let localCarnets: any[] = [];
        try {
          localCarnets = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
        } catch (e) {
          console.error(e);
        }

        const { data: carnetsData } = await supabase
          .from('carnets')
          .select(`*, author:user_profiles!author_id(full_name, avatar_url)`)
          .order('created_at', { ascending: false })
          .limit(20);
          
        let remoteCarnets = carnetsData || [];
        if (!carnetsData) {
          const { data: cData2 } = await supabase.from('carnets').select(`*, author:user_profiles(full_name, avatar_url)`).limit(20);
          if (cData2) remoteCarnets = cData2;
        }

        const allCarnets = [...localCarnets, ...remoteCarnets];
        const uniqueCarnets = Array.from(new Map(allCarnets.map(item => [item.id || item.title, item])).values());
        setCarnets(uniqueCarnets);

        // Fetch Clubs with user membership check
        const { data: clubsData } = await supabase
          .from('clubs')
          .select('*')
          .order('members_count', { ascending: false });

        if (clubsData) {
          let memberMap: Record<string, { role: string; status: string }> = {};
          if (user) {
            const { data: memberships } = await supabase
              .from('club_members')
              .select('club_id, role, status')
              .eq('user_id', user.id);
            if (memberships) {
              memberMap = Object.fromEntries(memberships.map((m: any) => [m.club_id, { role: m.role, status: m.status }]));
            }
          }
          setClubs(clubsData.map((c: any) => ({
            ...c,
            is_member: !!memberMap[c.id] && memberMap[c.id].status === 'active',
            member_role: memberMap[c.id]?.role,
            member_status: memberMap[c.id]?.status,
          })));
        }

        // Fetch Travel Groups (user-created groups from the wizard)
        const { data: travelGroupsData } = await supabase
          .from('travel_groups')
          .select('*, owner:user_profiles!travel_groups_owner_id_fkey(full_name, avatar_url)')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(20);

        if (travelGroupsData) setTravelGroups(travelGroupsData);

        // Fetch Events
        const { data: eventsData } = await supabase
          .from('club_events')
          .select('*')
          .order('event_date', { ascending: true })
          .limit(3);

        if (eventsData) setEvents(eventsData);

        // Fetch New Members
        const { data: membersData } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .order('created_at', { ascending: false })
          .limit(5);

        if (membersData) setNewMembers(membersData);

      } catch (err) {
        console.error('Error fetching community data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  useEffect(() => {
    const handleCarnetCreated = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
        if (saved.length > 0) {
          setCarnets(prev => {
            const combined = [...saved, ...prev];
            return Array.from(new Map(combined.map(item => [item.id || item.title, item])).values());
          });
        }
      } catch (e) {
        console.error("Error updating carnets list:", e);
      }
    };

    window.addEventListener('carnet_created', handleCarnetCreated);
    handleCarnetCreated();
    return () => window.removeEventListener('carnet_created', handleCarnetCreated);
  }, []);

  // Handler to toggle club membership (Join / Leave / Request)
  const handleToggleClubMember = async (clubId: string, isCurrentlyMember: boolean) => {
    if (!user) {
      showToast('Connectez-vous pour rejoindre un club');
      return;
    }
    const club = clubs.find((c) => c.id === clubId);
    if (!club) return;

    const supabase = createClient();
    if (isCurrentlyMember) {
      // Leave club
      setClubs(prev => prev.map(c => c.id === clubId ? { ...c, is_member: false, members_count: Math.max(0, (c.members_count || 1) - 1) } : c));
      showToast('Vous avez quitté le club');
      await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', user.id);
      await supabase.from('clubs').update({ members_count: Math.max(0, (club.members_count || 1) - 1) }).eq('id', clubId);
    } else if (club.privacy === 'open') {
      // Join open club
      setClubs(prev => prev.map(c => c.id === clubId ? { ...c, is_member: true, member_role: 'member', members_count: (c.members_count || 0) + 1 } : c));
      showToast('Bienvenue dans le club ! 🎉');
      await supabase.from('club_members').insert({ club_id: clubId, user_id: user.id, role: 'member', status: 'active' });
      await supabase.from('clubs').update({ members_count: (club.members_count || 0) + 1 }).eq('id', clubId);
    } else {
      // Send join request for closed/secret club
      await supabase.from('club_join_requests').upsert({ club_id: clubId, user_id: user.id, status: 'pending' }, { onConflict: 'club_id,user_id' });
      showToast("Demande d'adhésion envoyée !");
    }
  };

  // Handler to create a new club
  const handleSaveClub = async (form: any) => {
    if (!user) return;
    setIsSavingClub(true);
    try {
      const supabase = createClient();
      const colorMap: Record<string, string> = {
        'activité': 'from-emerald-600 to-teal-700',
        'pays': 'from-blue-600 to-indigo-700',
      };
      const slug = `c-${form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;
      const payload = {
        name: form.name,
        type: form.type || 'activité',
        emoji: form.emoji || '🏕️',
        description: form.description || '',
        category: form.category || 'Général',
        rules: form.rules || '',
        privacy: form.privacy || 'open',
        cover_color: colorMap[form.type] || 'from-emerald-600 to-teal-700',
        created_by: user.id,
        slug,
        members_count: 1,
        active_this_month: 1
      };

      const { data: newClub, error } = await supabase.from('clubs').insert(payload).select().single();
      if (error) throw error;

      if (newClub) {
        await supabase.from('club_members').insert({ club_id: newClub.id, user_id: user.id, role: 'admin', status: 'active' });
      }

      showToast("Club créé avec succès ! Vous en êtes l'administrateur.");
      setIsCreateClubModalOpen(false);

      // Refresh clubs
      const { data: refreshedClubs } = await supabase.from('clubs').select('*').order('members_count', { ascending: false });
      if (refreshedClubs) {
        setClubs(refreshedClubs.map(c => ({
          ...c,
          is_member: c.id === (newClub?.id) ? true : c.is_member,
          member_role: c.id === (newClub?.id) ? 'admin' : c.member_role
        })));
      }
    } catch (err: any) {
      console.error("Error creating club:", err);
      alert("Erreur lors de la création du club: " + (err.message || err));
    } finally {
      setIsSavingClub(false);
    }
  };

  // Handler to create a new carnet
  const handleSaveCarnet = async (form: any) => {
    if (!user) return;
    setIsSavingCarnet(true);
    try {
      const supabase = createClient();
      const payload = {
        title: form.title,
        destination: form.destination || 'Alpes',
        description: form.description || '',
        cover_image: form.cover_image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000',
        duration: form.duration || '3 jours',
        distance_km: form.distance_km || 45,
        elevation_m: form.elevation_m || 2400,
        author_id: user.id,
        likes_count: 0,
        comments_count: 0
      };

      const { data: newCarnet, error } = await supabase.from('carnets').insert(payload).select(`
        *,
        author:user_profiles!author_id(full_name, avatar_url)
      `).single();

      if (error) throw error;

      if (newCarnet) {
        setCarnets([newCarnet, ...carnets]);
      }
      showToast("Carnet de voyage publié avec succès !");
      setIsCreateCarnetModalOpen(false);
    } catch (err: any) {
      console.error("Error creating carnet:", err);
      alert("Erreur lors de la création du carnet : " + (err.message || err));
    } finally {
      setIsSavingCarnet(false);
    }
  };

  const filteredCarnets = useMemo(() => {
    return carnets.filter(c => {
      if (carnetFilterCategory !== 'all' && (c.category || '').toLowerCase() !== carnetFilterCategory.toLowerCase()) {
        if (!(c.destination || '').toLowerCase().includes(carnetFilterCategory.toLowerCase())) {
          return false;
        }
      }
      if (carnetSearchQuery.trim()) {
        const q = carnetSearchQuery.toLowerCase();
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchDest = (c.destination || '').toLowerCase().includes(q);
        const matchDesc = (c.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDest && !matchDesc) return false;
      }
      return true;
    });
  }, [carnets, carnetFilterCategory, carnetSearchQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublish = async () => {
    if (!newPostContent.trim() && !selectedFile) return;
    setIsPublishing(true);
    
    try {
      const supabase = createClient();
      
      // In a real app, we would upload the file to Supabase Storage here and get the public URL.
      // For this demo, if there's a preview URL, we'll just pass it directly (it's a blob: URL and will only work locally).
      const imageUrl = previewUrl ? previewUrl : null;
      
      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          author_id: user?.id,
          content: newPostContent.trim(),
          post_type: 'share',
          likes_count: 0,
          comments_count: 0,
          image_url: imageUrl
        })
        .select(`
          *,
          author:user_profiles!community_posts_author_id_fkey(full_name, avatar_url, loyalty_level)
        `)
        .single();
        
      if (data && !error) {
        setPosts([data, ...posts]);
        setNewPostContent('');
        handleRemoveFile();
        setIsPublishModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  // Si l'utilisateur n'est pas connecté
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F2E8] font-sans flex flex-col">
        <Header />
        <main className="flex-1 pt-24 px-4 flex items-center justify-center">
          <div className="text-center max-w-md w-full">
            <div className="w-20 h-20 bg-[#1C2620] rounded-[2rem] mx-auto flex items-center justify-center text-white mb-8 shadow-xl">
              <Icon name="UserGroupIcon" size={32} />
            </div>
            <h1 className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620] mb-4">
              Rejoignez la <em className="font-serif italic font-normal text-[#2D5A3D]">Communauté</em>
            </h1>
            <p className="text-sm text-[#5C6B5E] mb-8 leading-relaxed">
              Le Hub Voyageurs est un espace privé réservé aux explorateurs pour partager leurs récits, leurs traces et leurs conseils en toute bienveillance.
            </p>
            <Link 
              href="/connexion" 
              className="inline-flex items-center gap-2 bg-[#1C2620] hover:bg-[#2A3830] text-white px-8 py-4 rounded-full font-semibold text-sm transition-all shadow-md"
            >
              Se connecter ou s'inscrire
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans text-[#1C2620] selection:bg-[#E4501C]/20 relative">
      <Header />
      
      <main className="pt-24 pb-20">
        
        {/* HERO SECTION */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="relative w-full min-h-[450px] rounded-[2.5rem] overflow-hidden flex flex-col justify-end p-8 sm:p-10 md:p-14 shadow-xl">
            {/* Background Image */}
            <div className="absolute inset-0">
              <img 
                src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1600" 
                alt="Sunset hiking" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C2620] via-[#1C2620]/80 to-transparent"></div>
            </div>

            {/* Top Bar (inside hero) */}
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-auto pb-8">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-white/80 text-[10px] font-mono tracking-widest uppercase border border-white/10">
                LE HUB VOYAGEURS - Privé
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-2.5 rounded-full text-white font-medium text-xs transition-colors border border-white/20 shadow-sm"
              >
                Explorer
              </motion.button>
            </div>

            {/* Content */}
            <div className="relative z-10 w-full max-w-4xl mt-12">
              <h1 className="font-display font-800 text-4xl sm:text-5xl md:text-7xl text-white leading-[1.05] mb-6">
                Ceux qui marchent, <br /><em className="font-serif italic font-normal text-[#E4501C]">parlent doucement.</em>
              </h1>
              <p className="text-white/70 text-sm md:text-base leading-relaxed max-w-lg mb-10 font-medium">
                Un feed sans algorithme. Des voyageurs, des refuges partagés, des itinéraires qu'on se recommande de bouche à oreille. Ici on écrit long, on répond bien.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/10">
                <div>
                  <div className="font-display font-800 text-white text-3xl mb-1">12 <em className="font-serif italic font-normal text-white/60 text-2xl">4k</em></div>
                  <div className="text-[9px] font-mono text-white/50 tracking-widest uppercase">Voyageurs actifs</div>
                </div>
                <div>
                  <div className="font-display font-800 text-white text-3xl mb-1">348</div>
                  <div className="text-[9px] font-mono text-white/50 tracking-widest uppercase">Récits ce mois</div>
                </div>
                <div>
                  <div className="font-display font-800 text-white text-3xl mb-1">{clubs.length > 0 ? clubs.length * 12 : 62}</div>
                  <div className="text-[9px] font-mono text-white/50 tracking-widest uppercase">Clubs thématiques</div>
                </div>
                <div>
                  <div className="font-display font-800 text-white text-3xl mb-1">{events.length > 0 ? events.length * 9 : 27} <em className="font-serif italic font-normal text-white/60 text-2xl">sorties</em></div>
                  <div className="text-[9px] font-mono text-white/50 tracking-widest uppercase">Prévues cette semaine</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN LAYOUT */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* LEFT COLUMN (FEED/CONTENT) */}
            <div className="lg:col-span-8">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 overflow-x-auto pb-2">
                <h2 className="font-display font-800 text-3xl text-[#1C2620] flex-shrink-0">
                  Le fil <em className="font-serif italic font-normal text-[#2D5A3D]">de la maison</em>
                </h2>
                <div className="flex bg-white rounded-full p-1 border border-[#E8E4D8] shadow-sm flex-shrink-0">
                  {['Feed', 'Carnets', 'Clubs', 'Groupes'].map(tab => (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${activeTab === tab ? 'bg-[#F5F2E8] text-[#1C2620] shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}
                    >
                      {tab}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* TABS CONTENT */}
              <div className="space-y-8">
                {loading ? (
                  <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : activeTab === 'Feed' ? (
                  // TAB: FEED (community_posts)
                  posts.length > 0 ? (
                    posts.map((post, i) => <PostCard key={post.id || i} post={post} user={user} />)
                  ) : (
                    <div className="text-center py-20 bg-white rounded-[2rem] border border-[#E8E4D8]">
                      <Icon name="DocumentTextIcon" size={32} className="mx-auto text-[#C8C3B0] mb-4" />
                      <p className="text-[#5C6B5E] font-medium">Le fil est vide. Soyez le premier à publier !</p>
                    </div>
                  )
                ) : activeTab === 'Carnets' ? (
                  // TAB: CARNETS (Redesigned matching media__1785172253456.png)
                  <div className="space-y-10">
                    {/* 1. Header Banner & Counter */}
                    <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-[#E8E4D8] shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 max-w-xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF0EB] text-[#2D5A3D] text-[10px] font-mono tracking-widest uppercase">
                          <span>📖</span> LES CARNETS DE VOYAGE
                        </div>
                        <h2 className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620]">
                          Mes voyages, <em className="font-serif italic font-normal text-[#2D5A3D]">préservés.</em>
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5C6B5E] leading-relaxed">
                          Retrouvez les carnets de route des membres, leurs traces GPS, photos et récits d'expéditions en montagne et pleine nature.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="bg-[#F5F2E8] px-5 py-3 rounded-2xl text-center border border-[#E8E4D8]">
                          <span className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">CARNETS</span>
                          <span className="font-display font-800 text-2xl text-[#1C2620]">{carnets.length}</span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsCreateCarnetModalOpen(true)}
                          className="px-6 py-3.5 bg-[#2D5A3D] hover:bg-[#1C2620] text-white rounded-full font-bold text-xs shadow-md flex items-center gap-2 whitespace-nowrap"
                        >
                          <Icon name="PlusIcon" size={16} /> Nouveau carnet
                        </motion.button>
                      </div>
                    </div>

                    {/* 2. Category Filter Pills & Live Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      <div className="flex bg-white rounded-full p-1 border border-[#E8E4D8] shadow-sm overflow-x-auto">
                        {[
                          { id: 'all', label: 'Tous' },
                          { id: 'Trek', label: '🏔️ Trek' },
                          { id: 'Bivouac', label: '🏕️ Bivouac' },
                          { id: 'Kayak', label: '🚣 Kayak' },
                          { id: 'Van Life', label: '🚐 Van Life' },
                          { id: 'Vélo', label: '🚵 Vélo' }
                        ].map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setCarnetFilterCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${carnetFilterCategory === cat.id ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
                        <input
                          type="text"
                          value={carnetSearchQuery}
                          onChange={e => setCarnetSearchQuery(e.target.value)}
                          placeholder="Rechercher un récit ou lieu..."
                          className="bg-white border border-[#E8E4D8] rounded-full pl-9 pr-4 py-2 text-xs text-[#1C2620] focus:ring-1 focus:ring-[#2D5A3D] w-full sm:w-64"
                        />
                        {carnetSearchQuery && (
                          <button onClick={() => setCarnetSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C6B5E] text-xs">✕</button>
                        )}
                      </div>
                    </div>

                    {/* 3. Featured Carnet Showcase (Carnet à la une) */}
                    {carnets.length > 0 && (
                      <div className="bg-white rounded-[2.5rem] overflow-hidden border border-[#E8E4D8] shadow-sm flex flex-col md:flex-row group">
                        <div className="w-full md:w-5/12 relative min-h-[220px] md:min-h-[300px] overflow-hidden shrink-0">
                          <img
                            src={carnets[0].cover_image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000'}
                            alt={carnets[0].title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                            <span className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-[#1C2620] shadow-sm flex items-center gap-1">
                              <Icon name="MapPinIcon" size={10} className="text-[#E4501C]" />
                              {carnets[0].destination || 'Chartreuse'}
                            </span>
                            <span className="bg-[#1C2620]/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono">
                              {carnets[0].duration || '4 jours'}
                            </span>
                          </div>
                        </div>

                        <div className="w-full md:w-7/12 p-6 sm:p-7 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="text-[10px] font-mono tracking-widest text-[#E4501C] uppercase mb-1.5 font-bold">CARNET À LA UNE</div>
                            <h3 className="font-display font-800 text-xl sm:text-2xl text-[#1C2620] mb-2 group-hover:text-[#2D5A3D] transition-colors leading-snug">
                              {carnets[0].title}
                            </h3>
                            <p className="text-xs text-[#4A574C] leading-relaxed line-clamp-3 mb-4">
                              {carnets[0].description || 'Récit complet de l\'expédition avec carte d\'itinéraire et traces GPS.'}
                            </p>

                            <div className="flex flex-wrap gap-2">
                              <span className="bg-[#F5F2E8] text-[#1C2620] px-2.5 py-1 rounded-full text-[10px] font-mono">⏱️ {carnets[0].duration || '4 jours'}</span>
                              <span className="bg-[#F5F2E8] text-[#1C2620] px-2.5 py-1 rounded-full text-[10px] font-mono">📏 {carnets[0].distance_km || 52} km</span>
                              <span className="bg-[#F5F2E8] text-[#1C2620] px-2.5 py-1 rounded-full text-[10px] font-mono">⛰️ +{carnets[0].elevation_m || 3200} m</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#F5F2E8] flex items-center justify-between gap-3 mt-auto">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={carnets[0].author?.avatar_url || 'https://i.pravatar.cc/150'} className="w-7 h-7 rounded-full object-cover border border-[#E8E4D8] shrink-0" />
                              <span className="font-bold text-xs text-[#1C2620] truncate">{carnets[0].author?.full_name || 'Voyageur'}</span>
                            </div>

                            <button
                              onClick={() => router.push(`/carnets/${carnets[0].id || encodeURIComponent(carnets[0].title)}`)}
                              className="px-4 py-2 bg-[#1C2620] hover:bg-[#2D5A3D] text-white rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                            >
                              <span>Lire le carnet</span>
                              <Icon name="ArrowRightIcon" size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Carnets Cards Grid ("Les carnets récents") */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-display font-800 text-2xl text-[#1C2620]">
                          Les carnets <em className="font-serif italic font-normal text-[#2D5A3D]">récents</em>
                        </h3>
                        <span className="text-xs text-[#5C6B5E] font-mono">{filteredCarnets.length} carnets trouvés</span>
                      </div>

                      {filteredCarnets.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-[2rem] border border-[#E8E4D8] space-y-3">
                          <Icon name="BookOpenIcon" size={32} className="mx-auto text-[#C8C3B0]" />
                          <h4 className="font-bold text-base text-[#1C2620]">Aucun carnet trouvé</h4>
                          <p className="text-xs text-[#5C6B5E] max-w-sm mx-auto">Soyez le premier à publier un récit de voyage dans cette catégorie !</p>
                          <button onClick={() => setIsCreateCarnetModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D5A3D] text-white rounded-full text-xs font-bold hover:bg-[#1C2620] transition-colors">
                            <Icon name="PlusIcon" size={14} /> Nouveau carnet
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {filteredCarnets.map((carnet, i) => (
                            <CarnetCard key={carnet.id || i} carnet={carnet} user={user} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeTab === 'Clubs' ? (
                  // TAB: CLUBS (Redesigned)
                  <div className="space-y-8">
                    {/* Header Banner */}
                    <div className="bg-[#1C2620] rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 border border-[#2D5A3D]/40">
                      <div className="absolute top-0 right-0 w-72 h-72 bg-[#E4501C] rounded-full blur-[110px] opacity-25 pointer-events-none" />
                      <div className="relative z-10 space-y-2 text-center sm:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-mono tracking-widest uppercase border border-white/10">
                          <span>🏕️</span> ESPACES COMMUNAUTAIRES
                        </div>
                        <h3 className="font-display font-800 text-2xl sm:text-3xl text-white leading-tight">
                          Trouvez votre tribu, <br/><em className="font-serif italic font-normal text-[#E4501C]">partagez l&apos;aventure.</em>
                        </h3>
                        <p className="text-xs text-white/70 max-w-md leading-relaxed">
                          Rejoignez des clubs de passionnés par discipline ou destination. Conseils matos, sorties en groupe et retours d'expérience.
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push('/clubs/nouveau')}
                        className="relative z-10 px-7 py-3.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white rounded-full font-extrabold text-sm tracking-wide shadow-lg flex items-center gap-2 whitespace-nowrap"
                      >
                        <Icon name="PlusIcon" size={18} /> Fonder un club
                      </motion.button>
                    </div>

                    {/* Filter Tabs & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      <div className="flex bg-white rounded-full p-1 border border-[#E8E4D8] shadow-sm overflow-x-auto">
                        {[
                          { id: 'all', label: 'Tous', count: clubs.length },
                          { id: 'activite', label: '🎯 Activités', count: clubs.filter(c => c.type === 'activité' || c.type === 'activite').length },
                          { id: 'pays', label: '🌍 Destinations', count: clubs.filter(c => c.type === 'pays').length },
                          { id: 'my_clubs', label: '⭐ Mes Clubs', count: clubs.filter(c => c.is_member).length }
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setClubFilterTab(t.id as any)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${clubFilterTab === t.id ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}
                          >
                            <span>{t.label}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${clubFilterTab === t.id ? 'bg-white/20 text-white' : 'bg-[#F5F2E8] text-[#5C6B5E]'}`}>{t.count}</span>
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
                        <input
                          type="text"
                          value={clubSearchQuery}
                          onChange={e => setClubSearchQuery(e.target.value)}
                          placeholder="Rechercher un club..."
                          className="bg-white border border-[#E8E4D8] rounded-full pl-9 pr-4 py-2 text-xs text-[#1C2620] focus:ring-1 focus:ring-[#2D5A3D] w-full sm:w-64"
                        />
                        {clubSearchQuery && (
                          <button onClick={() => setClubSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C6B5E] text-xs">✕</button>
                        )}
                      </div>
                    </div>

                    {/* Clubs Grid */}
                    {clubs.filter(c => {
                      if (clubFilterTab === 'activite' && c.type !== 'activité' && c.type !== 'activite') return false;
                      if (clubFilterTab === 'pays' && c.type !== 'pays') return false;
                      if (clubFilterTab === 'my_clubs' && !c.is_member) return false;
                      if (clubSearchQuery.trim()) {
                        const q = clubSearchQuery.toLowerCase();
                        const matchName = (c.name || '').toLowerCase().includes(q);
                        const matchDesc = (c.description || '').toLowerCase().includes(q);
                        const matchCat = (c.category || '').toLowerCase().includes(q);
                        if (!matchName && !matchDesc && !matchCat) return false;
                      }
                      return true;
                    }).length === 0 ? (
                      <div className="text-center py-16 bg-white rounded-[2rem] border border-[#E8E4D8] space-y-3">
                        <div className="w-16 h-16 bg-[#F5F2E8] rounded-full flex items-center justify-center text-3xl mx-auto text-[#5C6B5E]">🏕️</div>
                        <h4 className="font-bold text-base text-[#1C2620]">Aucun club ne correspond à votre recherche</h4>
                        <p className="text-xs text-[#5C6B5E] max-w-sm mx-auto">Essayez un autre terme de recherche ou fondez le tout premier club de cette catégorie !</p>
                        <button onClick={() => router.push('/clubs/nouveau')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D5A3D] text-white rounded-full text-xs font-bold hover:bg-[#1C2620] transition-colors">
                          <Icon name="PlusIcon" size={14} /> Fonder un club
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {clubs.filter(c => {
                          if (clubFilterTab === 'activite' && c.type !== 'activité' && c.type !== 'activite') return false;
                          if (clubFilterTab === 'pays' && c.type !== 'pays') return false;
                          if (clubFilterTab === 'my_clubs' && !c.is_member) return false;
                          if (clubSearchQuery.trim()) {
                            const q = clubSearchQuery.toLowerCase();
                            const matchName = (c.name || '').toLowerCase().includes(q);
                            const matchDesc = (c.description || '').toLowerCase().includes(q);
                            const matchCat = (c.category || '').toLowerCase().includes(q);
                            if (!matchName && !matchDesc && !matchCat) return false;
                          }
                          return true;
                        }).map(club => {
                          const isMember = club.is_member;
                          return (
                            <motion.div
                              key={club.id}
                              whileHover={{ y: -4 }}
                              className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E8E4D8] flex flex-col justify-between hover:border-[#2D5A3D] transition-all group relative overflow-hidden"
                            >
                              {/* Cover Header Accent */}
                              <div className="flex items-start justify-between mb-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#F5F2E8] to-[#E8E4D8] rounded-2xl flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform">
                                  {club.emoji || '🏔️'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono tracking-widest uppercase bg-[#F5F2E8] text-[#5C6B5E] px-2.5 py-1 rounded-full">
                                    {club.type === 'pays' ? '🌍 Destination' : '🎯 Activité'}
                                  </span>
                                  {club.privacy !== 'open' && (
                                    <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                                      🔒 Sur demande
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Title & Description */}
                              <div className="mb-6">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h3 className="font-bold text-lg text-[#1C2620] group-hover:text-[#2D5A3D] transition-colors">{club.name}</h3>
                                  {club.is_verified && (
                                    <span className="bg-[#2D5A3D] text-white text-[8px] font-mono px-1.5 py-0.5 rounded uppercase">✓ VÉRIFIÉ</span>
                                  )}
                                </div>
                                <p className="text-xs text-[#5C6B5E] leading-relaxed line-clamp-2">{club.description || 'Club de passionnés de voyage et d\'aventure.'}</p>
                              </div>

                              {/* Stats & Actions */}
                              <div className="pt-4 border-t border-[#F5F2E8] flex items-center justify-between gap-3 mt-auto">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-[#1C2620] flex items-center gap-1">
                                    <Icon name="UserGroupIcon" size={14} className="text-[#2D5A3D]" />
                                    {club.members_count || 0} membres
                                  </span>
                                  <span className="text-[10px] text-[#5C6B5E] font-mono">
                                    ⚡ {club.active_this_month || 12} actifs ce mois
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedDetailClub(club)}
                                    className="px-3.5 py-2 rounded-full text-xs font-semibold text-[#5C6B5E] bg-[#F5F2E8] hover:bg-[#E8E4D8] hover:text-[#1C2620] transition-colors"
                                  >
                                    Aperçu
                                  </button>

                                  <button
                                    onClick={() => router.push(`/clubs/${club.slug || club.id}`)}
                                    className="px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm bg-[#2D5A3D] text-white hover:bg-[#1C2620] flex items-center gap-1"
                                  >
                                    <span>Voir</span>
                                    <Icon name="ArrowRightIcon" size={12} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  // TAB: GROUPES
                  <div className="space-y-6">
                    {/* Header Banner for Groupes */}
                    <div className="bg-[#1C2620] rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 border border-[#2D5A3D]/40">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#E4501C] rounded-full blur-[100px] opacity-25 pointer-events-none" />
                      <div className="relative z-10 space-y-2 text-center sm:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-mono tracking-widest uppercase border border-white/10">
                          <span>🏕️</span> Cockpit Collaboratif
                        </div>
                        <h3 className="font-display font-800 text-2xl sm:text-3xl text-white leading-tight">
                          Créez votre <em className="font-serif italic font-normal text-[#E4501C]">groupe de voyage</em>
                        </h3>
                        <p className="text-xs text-white/70 max-w-md leading-relaxed">
                          Organisez une expédition entre amis : gestion du matériel, budget partagé, sondages et chat temps réel.
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push('/nouveau-groupe')}
                        className="relative z-10 px-7 py-3.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white rounded-full font-extrabold text-sm tracking-wide shadow-lg flex items-center gap-2 whitespace-nowrap"
                      >
                        <Icon name="PlusIcon" size={18} /> Créer un groupe
                      </motion.button>
                    </div>

                    {/* Group Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Card to launch creation */}
                      <div 
                        onClick={() => router.push('/nouveau-groupe')}
                        className="bg-white/60 hover:bg-white rounded-[2rem] p-6 border-2 border-dashed border-[#E4501C]/40 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#E4501C] transition-all group min-h-[220px]"
                      >
                        <div className="w-14 h-14 bg-[#E4501C]/10 text-[#E4501C] rounded-2xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                          <Icon name="PlusIcon" size={24} />
                        </div>
                        <h4 className="font-display font-800 text-base text-[#1C2620] mb-1">Créer un nouveau groupe</h4>
                        <p className="text-xs text-[#5C6B5E]">Lancer un parcours guidé en 4 étapes simples</p>
                      </div>

                      {travelGroups.length > 0 ? travelGroups.map(group => (
                        <div 
                          key={group.id} 
                          onClick={() => router.push(`/groupes/${group.id}`)}
                          className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-[#E8E4D8] flex flex-col cursor-pointer hover:border-[#1C2620] transition-colors group"
                        >
                          {group.cover_url && (
                            <div className="h-32 w-full overflow-hidden">
                              <img src={group.cover_url} alt={group.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            </div>
                          )}
                          <div className="p-5 flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#2D5A3D]/20 to-[#E4501C]/20 rounded-2xl flex items-center justify-center text-2xl mb-3 -mt-10 bg-white border-2 border-white shadow-md relative z-10">
                              {group.theme === 'Trek' ? '🏔️' : group.theme === 'Van Life' ? '🚐' : group.theme === 'Vélo' ? '🚴' : group.theme === 'Ski' ? '⛷️' : group.theme === 'Plage' ? '🏖️' : group.theme === 'Expédition' ? '🧭' : '🎒'}
                            </div>
                            <h3 className="font-bold text-lg text-[#1C2620] mb-1">{group.name}</h3>
                            <p className="text-xs text-[#5C6B5E] mb-2 line-clamp-2">{group.description}</p>
                            {group.destination && (
                              <p className="text-[10px] font-mono text-[#E4501C] mb-3 flex items-center gap-1">
                                <span>📍</span> {group.destination}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono tracking-widest text-[#2D5A3D] uppercase bg-[#EAF0EB] px-3 py-1 rounded-full">
                                {group.theme || 'Aventure'}
                              </span>
                              {group.owner?.full_name && (
                                <span className="text-[10px] text-[#5C6B5E]">
                                  par {group.owner.full_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="bg-white/60 rounded-[2rem] p-8 border border-[#E8E4D8] flex flex-col items-center justify-center text-center col-span-full">
                          <p className="text-sm text-[#5C6B5E] mb-2">Aucun groupe public pour l&apos;instant.</p>
                          <p className="text-xs text-[#5C6B5E]/70">Créez le premier en cliquant sur le bouton ci-dessus !</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (SIDEBAR) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Profile Card */}
              <div className="bg-[#1C2620] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#2D5A3D] rounded-full blur-3xl opacity-30 -mr-10 -mt-10"></div>
                
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <img src={user.user_metadata?.avatar_url || 'https://i.pravatar.cc/150'} alt="Mon profil" className="w-14 h-14 rounded-full border-2 border-white/20 object-cover" />
                  <div>
                    <div className="font-display font-800 text-lg leading-tight">{user.user_metadata?.full_name || 'Mon Profil'}</div>
                    <div className="text-[10px] text-white/50 font-mono mt-1">Voyageur certifié</div>
                  </div>
                </div>

                <div className="flex justify-between border-t border-white/10 pt-5 pb-6 relative z-10">
                  <div className="text-center">
                    <div className="font-display font-800 text-xl">14</div>
                    <div className="text-[9px] font-mono text-white/50 uppercase tracking-widest mt-1">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-800 text-xl">3</div>
                    <div className="text-[9px] font-mono text-white/50 uppercase tracking-widest mt-1">Clubs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-800 text-xl">248</div>
                    <div className="text-[9px] font-mono text-white/50 uppercase tracking-widest mt-1">Likes</div>
                  </div>
                </div>

                <motion.button 
                  onClick={() => router.push('/communaute/publier')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-[#E4501C] hover:bg-[#cc3d10] text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 relative z-10"
                >
                  <Icon name="PlusIcon" size={16} /> Publier
                </motion.button>
              </div>

              {/* Sorties */}
              {events.length > 0 && (
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E8E4D8]">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-display font-800 text-lg text-[#1C2620]">Sorties <em className="font-serif italic font-normal text-[#2D5A3D]">à venir</em></h3>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="text-[10px] font-bold text-[#5C6B5E] hover:text-[#1C2620] uppercase tracking-wider">Tout voir</motion.button>
                  </div>
                  <div className="space-y-4">
                    {events.map((ev, i) => {
                      const date = formatDateString(ev.event_date);
                      return (
                        <div key={ev.id || i} className="flex items-center gap-4 group cursor-pointer">
                          <div className="w-12 h-12 rounded-2xl bg-[#F5F2E8] border border-[#E8E4D8] flex flex-col items-center justify-center flex-shrink-0 group-hover:border-[#2D5A3D] transition-colors">
                            <span className="text-[9px] font-mono text-[#5C6B5E] leading-none mb-1">{date.month}</span>
                            <span className="font-display font-800 text-base text-[#1C2620] leading-none">{date.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-[#1C2620] mb-0.5 group-hover:text-[#2D5A3D] transition-colors truncate">{ev.title}</div>
                            <div className="text-[10px] text-[#5C6B5E] truncate">{ev.location || 'Localisation TBD'}</div>
                          </div>
                          <div className="bg-[#EAF0EB] text-[#2D5A3D] text-[9px] font-bold px-2 py-1 rounded hidden sm:block">
                            Bientôt
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clubs */}
              {clubs.length > 0 && (
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E8E4D8]">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-display font-800 text-lg text-[#1C2620]">Clubs <em className="font-serif italic font-normal text-[#2D5A3D]">actifs</em></h3>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="text-[10px] font-bold text-[#5C6B5E] hover:text-[#1C2620] uppercase tracking-wider">Voir tout</motion.button>
                  </div>
                  <div className="space-y-4">
                    {clubs.slice(0, 4).map((club, i) => (
                      <div 
                        key={club.id || i} 
                        onClick={() => router.push(`/clubs/${club.slug}`)}
                        className="flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#F5F2E8] flex items-center justify-center text-lg">{club.emoji}</div>
                          <div>
                            <div className="font-bold text-xs text-[#1C2620] group-hover:text-[#2D5A3D] transition-colors">{club.name}</div>
                            <div className="text-[10px] text-[#5C6B5E]">{club.members_count} membres</div>
                          </div>
                        </div>
                        <Icon name="ChevronRightIcon" size={14} className="text-[#C8C3B0] group-hover:text-[#1C2620] transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nouveaux removed */}

            </div>

          </div>
        </div>
      </main>

      <Footer />

      {/* PUBLISH MODAL */}
      <AnimatePresence>
        {isPublishModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
              onClick={() => setIsPublishModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg bg-white rounded-[2rem] p-6 shadow-2xl z-[101] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display font-800 text-2xl text-[#1C2620]">Créer une publication</h3>
                <button 
                  onClick={() => setIsPublishModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#F5F2E8] flex items-center justify-center text-[#5C6B5E] hover:bg-[#E8E4D8] transition-colors"
                >
                  <Icon name="XMarkIcon" size={16} />
                </button>
              </div>
              
              <textarea 
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Racontez votre dernière aventure, partagez une photo, un conseil..."
                className="w-full h-32 bg-[#F5F2E8] border-none rounded-xl p-4 text-[#1C2620] text-sm focus:ring-2 focus:ring-[#2D5A3D] resize-none mb-4"
              />

              {/* Image Preview */}
              {previewUrl && (
                <div className="relative mb-4 w-full h-48 rounded-xl overflow-hidden bg-black/5">
                  <img src={previewUrl} alt="Aperçu" className="w-full h-full object-cover" />
                  <button 
                    onClick={handleRemoveFile}
                    className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
                  >
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <div>
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full border border-[#E8E4D8] flex items-center justify-center text-[#5C6B5E] hover:text-[#2D5A3D] hover:border-[#2D5A3D] transition-colors"
                    title="Ajouter une photo ou vidéo"
                  >
                    <Icon name="PhotoIcon" size={20} />
                  </button>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePublish}
                  disabled={isPublishing || (!newPostContent.trim() && !selectedFile)}
                  className="bg-[#E4501C] hover:bg-[#cc3d10] text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPublishing ? 'Publication...' : 'Publier'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>


      

      {/* CREATE CARNET MODAL */}
      <CarnetFormModal
        isOpen={isCreateCarnetModalOpen}
        onClose={() => setIsCreateCarnetModalOpen(false)}
        onSave={handleSaveCarnet}
        saving={isSavingCarnet}
      />

      {/* CREATE CLUB MODAL */}
      <ClubFormModal
        isOpen={isCreateClubModalOpen}
        onClose={() => setIsCreateClubModalOpen(false)}
        onSave={handleSaveClub}
        saving={isSavingClub}
      />

      {/* CLUB DETAIL MODAL */}
      <ClubDetailModal
        club={selectedDetailClub}
        onClose={() => setSelectedDetailClub(null)}
        currentUserId={user?.id}
        onRefresh={() => {
          const supabase = createClient();
          supabase.from('clubs').select('*').order('members_count', { ascending: false }).then(({ data }) => {
            if (data) setClubs(prev => data.map(c => ({ ...c, is_member: prev.find(p => p.id === c.id)?.is_member })));
          });
        }}
      />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] bg-[#1C2620] text-white px-6 py-3 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#2D5A3D]">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}