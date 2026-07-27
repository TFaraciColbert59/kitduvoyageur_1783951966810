'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import CreateGroupWizardModal from '@/components/groupes/CreateGroupWizardModal';

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

  const handleLike = () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLikesCount(newCount);
    
    const supabase = createClient();
    supabase.from('community_posts').update({ likes_count: newCount }).eq('id', post.id).then();
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
    setCommentsCount(prev => prev + 1);
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
                  <p className="text-xs text-[#5C6B5E] text-center italic">Aucun commentaire pour l'instant. Soyez le premier !</p>
                ) : (
                  comments.map((c, i) => (
                    <div key={c.id || i} className="flex gap-3 text-sm">
                      <img src={c.author?.avatar_url || 'https://i.pravatar.cc/150'} className="w-6 h-6 rounded-full mt-1 object-cover" />
                      <div className="flex-1 bg-[#F5F2E8] rounded-2xl rounded-tl-none p-3">
                        <div className="font-bold text-xs text-[#1C2620] mb-0.5">{c.author?.full_name}</div>
                        <p className="text-[#4A574C]">{c.content}</p>
                      </div>
                    </div>
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

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setLikesCount(newCount);

    const supabase = createClient();
    supabase.from('carnets').update({ likes_count: newCount }).eq('id', carnet.id).then();
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
    setCommentsCount(prev => prev + 1);
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
      onClick={() => router.push(`/carnets/${carnet.id}`)}
      className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-[#E8E4D8] flex flex-col sm:flex-row group cursor-pointer hover:border-[#2D5A3D] transition-colors"
    >
      {carnet.cover_image && (
        <div className="w-full sm:w-2/5 aspect-[4/3] sm:aspect-auto overflow-hidden">
          <img src={carnet.cover_image} alt={carnet.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        </div>
      )}
      <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-3">
            <Icon name="MapPinIcon" size={12} variant="solid" className="text-[#E4501C]" />
            {carnet.destination}
          </div>
          <h3 className="font-display font-800 text-2xl text-[#1C2620] leading-tight mb-3 group-hover:text-[#2D5A3D] transition-colors">
            {carnet.title}
          </h3>
          <p className="text-sm text-[#4A574C] line-clamp-3 mb-6">
            {carnet.description}
          </p>
        </div>
        
        <div className="flex flex-col border-t border-[#F5F2E8] pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={carnet.author?.avatar_url || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full border border-[#E8E4D8] object-cover" />
              <span className="font-bold text-xs text-[#1C2620]">{carnet.author?.full_name}</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-1 text-xs font-mono transition-colors ${isLiked ? 'text-red-500' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}
              >
                <Icon name="HeartIcon" size={16} variant={isLiked ? "solid" : "outline"} />
                {likesCount}
              </button>
              <button 
                onClick={handleToggleComments}
                className="flex items-center gap-1 text-xs font-mono text-[#5C6B5E] hover:text-[#1C2620] transition-colors"
              >
                <Icon name="ChatBubbleLeftIcon" size={16} variant={showComments ? "solid" : "outline"} />
                {commentsCount}
              </button>
              <button onClick={(e) => e.stopPropagation()} className="text-[#5C6B5E] hover:text-[#1C2620] transition-colors">
                <Icon name="BookmarkIcon" size={16} variant="outline" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showComments && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-4 pt-4 border-t border-[#F5F2E8] space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {loadingComments ? (
                  <div className="flex justify-center py-2"><div className="w-4 h-4 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"></div></div>
                ) : (
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {comments.length === 0 ? (
                      <p className="text-xs text-[#5C6B5E] text-center italic">Aucun commentaire. Soyez le premier !</p>
                    ) : (
                      comments.map((c, i) => (
                        <div key={c.id || i} className="flex gap-3 text-sm">
                          <img src={c.author?.avatar_url || 'https://i.pravatar.cc/150'} className="w-6 h-6 rounded-full mt-1 object-cover" />
                          <div className="flex-1 bg-[#F5F2E8] rounded-2xl rounded-tl-none p-3">
                            <div className="font-bold text-xs text-[#1C2620] mb-0.5">{c.author?.full_name}</div>
                            <p className="text-[#4A574C]">{c.content}</p>
                          </div>
                        </div>
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
      </div>
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
  const [isCreateGroupWizardOpen, setIsCreateGroupWizardOpen] = useState(false);
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

        // Fetch Carnets (Long form)
        // Using author:user_profiles!carnets_author_id_fkey or fallback if not strictly named
        // Trying generic relation name
        const { data: carnetsData } = await supabase
          .from('carnets')
          .select(`
            *,
            author:user_profiles!author_id(full_name, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (carnetsData) {
          setCarnets(carnetsData);
        } else {
          // If the precise relation name fails, try the general one
          const { data: cData2 } = await supabase.from('carnets').select(`*, author:user_profiles(full_name, avatar_url)`).limit(10);
          if (cData2) setCarnets(cData2);
        }

        // Fetch Clubs and Groups
        const { data: clubsData } = await supabase
          .from('clubs')
          .select('*')
          .order('members_count', { ascending: false })
          .limit(20);

        if (clubsData) setClubs(clubsData);

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
                  // TAB: CARNETS (table carnets)
                  carnets.length > 0 ? (
                    <div className="space-y-6">
                      {carnets.map((carnet, i) => <CarnetCard key={carnet.id || i} carnet={carnet} user={user} />)}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-[2rem] border border-[#E8E4D8]">
                      <Icon name="BookOpenIcon" size={32} className="mx-auto text-[#C8C3B0] mb-4" />
                      <p className="text-[#5C6B5E] font-medium">Aucun grand récit de voyage pour l'instant.</p>
                    </div>
                  )
                ) : activeTab === 'Clubs' ? (
                  // TAB: CLUBS
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {clubs.filter(c => c.type === 'activité').map(club => (
                      <div 
                        key={club.id} 
                        onClick={() => router.push(`/clubs/${club.slug}`)}
                        className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E8E4D8] flex flex-col items-center text-center cursor-pointer hover:border-[#1C2620] transition-colors group"
                      >
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                          {club.emoji}
                        </div>
                        <h3 className="font-bold text-lg text-[#1C2620] mb-1">{club.name}</h3>
                        <p className="text-xs text-[#5C6B5E] mb-4 line-clamp-2">{club.description}</p>
                        <div className="text-[10px] font-mono tracking-widest text-[#2D5A3D] uppercase bg-[#EAF0EB] px-3 py-1 rounded-full">
                          {club.members_count} membres
                        </div>
                      </div>
                    ))}
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
                        onClick={() => setIsCreateGroupWizardOpen(true)}
                        className="relative z-10 px-7 py-3.5 bg-[#E4501C] hover:bg-[#cc3d10] text-white rounded-full font-extrabold text-sm tracking-wide shadow-lg flex items-center gap-2 whitespace-nowrap"
                      >
                        <Icon name="PlusIcon" size={18} /> Créer un groupe
                      </motion.button>
                    </div>

                    {/* Group Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Card to launch creation */}
                      <div 
                        onClick={() => setIsCreateGroupWizardOpen(true)}
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
                          <p className="text-sm text-[#5C6B5E] mb-2">Aucun groupe public pour l'instant.</p>
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
                  onClick={() => setIsPublishModalOpen(true)}
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

      {/* CREATE GROUP WIZARD MODAL */}
      <CreateGroupWizardModal 
        isOpen={isCreateGroupWizardOpen} 
        onClose={() => setIsCreateGroupWizardOpen(false)} 
      />

    </div>
  );
}