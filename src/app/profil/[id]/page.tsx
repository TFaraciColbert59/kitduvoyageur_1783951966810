'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  trust_score: number;
  loyalty_points: number;
  loyalty_level: string;
  bio: string;
  location: string;
  xp: number;
  level: number;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  post_type: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const LEVEL_CFG: Record<string, { color: string; icon: string; bg: string }> = {
  Explorateur: { color: 'text-stone-600', icon: '🥾', bg: 'bg-stone-100 border-stone-300' },
  Aventurier: { color: 'text-emerald-700', icon: '🏕️', bg: 'bg-emerald-50 border-emerald-300' },
  'Randonneur Expert': { color: 'text-blue-700', icon: '🧗', bg: 'bg-blue-50 border-blue-300' },
  'Guide de Montagne': { color: 'text-purple-700', icon: '🏔️', bg: 'bg-purple-50 border-purple-300' },
  'Légende du Voyage': { color: 'text-amber-700', icon: '🌍', bg: 'bg-amber-50 border-amber-300' },
};

const POST_TYPE_CFG: Record<string, { label: string; color: string; emoji: string }> = {
  post: { label: 'Post', color: 'bg-gray-100 text-gray-700', emoji: '💬' },
  tip: { label: 'Conseil', color: 'bg-emerald-100 text-emerald-700', emoji: '💡' },
  question: { label: 'Question', color: 'bg-blue-100 text-blue-700', emoji: '❓' },
  share: { label: 'Partage', color: 'bg-purple-100 text-purple-700', emoji: '🔗' },
};

export default function ProfilPage() {
  const params = useParams();
  const profileId = params?.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      setLoading(true);
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', profileId)
        .single();
      setProfile(profileData ?? null);

      const { data: postsData } = await supabase
        .from('community_posts')
        .select('id, content, post_type, likes_count, comments_count, created_at')
        .eq('author_id', profileId)
        .order('created_at', { ascending: false })
        .limit(10);
      setPosts(postsData ?? []);

      const { count: fwersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profileId);
      setFollowersCount(fwersCount ?? 0);

      const { count: fwingCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profileId);
      setFollowingCount(fwingCount ?? 0);

      if (user) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileId)
          .maybeSingle();
        setIsFollowing(!!followData);
      }
      setLoading(false);
    };
    load();
  }, [profileId, supabase, user]);

  const handleFollow = async () => {
    if (!user) { showToast('Connectez-vous pour suivre'); return; }
    if (user.id === profileId) return;
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
      showToast('Abonnement annulé');
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
      showToast('Abonné !');
    }
  };

  const levelCfg = LEVEL_CFG[profile?.loyalty_level ?? 'Explorateur'] ?? LEVEL_CFG.Explorateur;
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const isOwnProfile = user?.id === profileId;

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />
      <main className="pt-20">
        {/* Hero Banner */}
        <div className="bg-[#1C2620] h-40 relative">
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-[#E4501C] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4">
          {/* Profile Card */}
          <div className="relative -mt-16 mb-6">
            <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-6">
              {loading ? (
                <div className="space-y-3">
                  <div className="w-24 h-24 rounded-2xl bg-[#C8C3B0]/30 animate-pulse" />
                  <div className="h-6 w-48 bg-[#C8C3B0]/30 rounded animate-pulse" />
                  <div className="h-4 w-64 bg-[#C8C3B0]/30 rounded animate-pulse" />
                </div>
              ) : !profile ? (
                <div className="text-center py-8">
                  <p className="text-[#5C6B5E]">Profil introuvable</p>
                  <Link href="/communaute" className="text-[#E4501C] text-sm mt-2 inline-block">← Retour à la communauté</Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt={`Photo de profil de ${profile.full_name}`} className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg" />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-[#E4501C]/20 flex items-center justify-center text-3xl font-700 text-[#E4501C] border-4 border-white shadow-lg">
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div>
                        <h1 className="font-display font-800 text-2xl text-[#1C2620] tracking-tight">{profile.full_name || 'Aventurier'}</h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs font-600 px-2.5 py-1 rounded-full border ${levelCfg.bg} ${levelCfg.color}`}>
                            {levelCfg.icon} {profile.loyalty_level}
                          </span>
                          {profile.location && (
                            <span className="text-xs text-[#5C6B5E] flex items-center gap-1">
                              <Icon name="MapPinIcon" size={12} /> {profile.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isOwnProfile ? (
                          <Link href="/compte" className="flex items-center gap-2 px-4 py-2 border border-[#C8C3B0] rounded-xl text-sm font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all">
                            <Icon name="PencilIcon" size={14} /> Modifier
                          </Link>
                        ) : (
                          <button
                            onClick={handleFollow}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 transition-all ${isFollowing ? 'border border-[#C8C3B0] text-[#5C6B5E] hover:border-red-300 hover:text-red-500' : 'bg-[#E4501C] text-white hover:bg-[#E4501C]/90'}`}
                          >
                            <Icon name={isFollowing ? 'UserMinusIcon' : 'UserPlusIcon'} size={14} />
                            {isFollowing ? 'Abonné' : 'Suivre'}
                          </button>
                        )}
                      </div>
                    </div>

                    {profile.bio && <p className="text-sm text-[#5C6B5E] mb-4 leading-relaxed">{profile.bio}</p>}

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Trust Score', value: profile.trust_score ?? 50, icon: '🛡️' },
                        { label: 'Points fidélité', value: profile.loyalty_points ?? 0, icon: '⭐' },
                        { label: 'Abonnés', value: followersCount, icon: '👥' },
                        { label: 'Abonnements', value: followingCount, icon: '🔔' },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-white/60 rounded-xl p-3 text-center">
                          <p className="text-lg">{stat.icon}</p>
                          <p className="font-display font-700 text-[#1C2620] text-lg">{stat.value.toLocaleString()}</p>
                          <p className="text-[10px] text-[#5C6B5E]">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trust Score Card */}
          {profile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#1C2620] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase mb-3">Trust Score</p>
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <svg width={64} height={64} className="-rotate-90">
                      <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
                      <circle cx={32} cy={32} r={26} fill="none" stroke="#E4501C" strokeWidth={4}
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - (profile.trust_score ?? 50) / 100)}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-mono font-700 text-white text-base">{profile.trust_score ?? 50}</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-display font-700 text-white text-sm">
                      {(profile.trust_score ?? 50) >= 80 ? 'Confirmé 🏔️' : (profile.trust_score ?? 50) >= 60 ? 'Fiable ✅' : 'Débutant 🌱'}
                    </p>
                    <p className="text-white/40 text-xs mt-1">Score de confiance</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                <p className="text-[10px] font-mono text-[#5C6B5E] tracking-[0.2em] uppercase mb-3">Niveau fidélité</p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{levelCfg.icon}</span>
                  <div>
                    <p className={`font-display font-700 text-lg ${levelCfg.color}`}>{profile.loyalty_level}</p>
                    <p className="text-xs text-[#5C6B5E]">{profile.loyalty_points?.toLocaleString() ?? 0} points accumulés</p>
                  </div>
                </div>
                <p className="text-xs text-[#5C6B5E]">
                  Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          )}

          {/* Posts */}
          {profile && (
            <div className="mb-8">
              <h2 className="font-display font-700 text-xl text-[#1C2620] mb-4">
                Publications ({posts.length})
              </h2>
              {posts.length === 0 ? (
                <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-8 text-center text-[#5C6B5E]">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm">Aucune publication pour l&apos;instant</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => {
                    const typeCfg = POST_TYPE_CFG[post.post_type] ?? POST_TYPE_CFG.post;
                    return (
                      <div key={post.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.emoji} {typeCfg.label}</span>
                          <span className="text-[10px] text-[#5C6B5E]">{new Date(post.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <p className="text-sm text-[#1C2620] leading-relaxed mb-3">{post.content}</p>
                        <div className="flex items-center gap-4 text-xs text-[#5C6B5E]">
                          <span className="flex items-center gap-1"><Icon name="HeartIcon" size={12} /> {post.likes_count}</span>
                          <span className="flex items-center gap-1"><Icon name="ChatBubbleLeftIcon" size={12} /> {post.comments_count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}

      <Footer />
    </div>
  );
}
