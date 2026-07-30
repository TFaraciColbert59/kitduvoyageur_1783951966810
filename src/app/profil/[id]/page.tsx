'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface Profile {
  id: string; full_name: string; avatar_url: string; trust_score: number; loyalty_points: number;
  loyalty_level: string; bio: string; location: string; xp: number; level: number; created_at: string;
}
interface Post { id: string; content: string; post_type: string; likes_count: number; comments_count: number; created_at: string; }
interface Carnet { id: string; title: string; destination: string; description: string; cover_image: string; cover_image_alt: string; start_date: string | null; end_date: string | null; weather: string; route_rating: number; visibility: string; tags: string[]; likes_count: number; comments_count: number; favorites_count: number; views_count: number; verified: boolean; is_collaborative: boolean; created_at: string; }
interface Badge { id: string; name: string; icon: string; rarity: string; }
interface ClubMembership { id: string; club_id: string; role: string; joined_at: string; club?: { name: string; emoji: string; category: string; members_count: number; type: string }; }
interface EventParticipation { id: string; event_id: string; event?: { title: string; emoji: string; event_date: string; location: string; type: string; status: string }; }
interface UserGroup { id: string; name: string; destination: string; theme: string; departure_date: string | null; return_date: string | null; visibility: string; group_level: number; optimization_score: number; my_role?: string; member_count?: number; }

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

type ProfileTab = 'publications' | 'carnets' | 'clubs' | 'evenements' | 'badges' | 'groupes';

export default function ProfilPage() {
  const params = useParams();
  const profileId = params?.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [carnets, setCarnets] = useState<Carnet[]>([]);
  const [clubs, setClubs] = useState<ClubMembership[]>([]);
  const [events, setEvents] = useState<EventParticipation[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('publications');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCarnet, setSelectedCarnet] = useState<Carnet | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (!profileId) return;
    const load = async () => {
      setLoading(true);
      const [profileRes, postsRes, carnetsRes, clubsRes, eventsRes, badgesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', profileId).single(),
        supabase.from('community_posts').select('id, content, post_type, likes_count, comments_count, created_at').eq('author_id', profileId).order('created_at', { ascending: false }).limit(10),
        supabase.from('carnets').select('*').eq('author_id', profileId).eq('visibility', 'public').order('created_at', { ascending: false }).limit(12),
        supabase.from('club_members').select('id, club_id, role, joined_at, club:clubs(name, emoji, category, members_count, type)').eq('user_id', profileId).eq('status', 'active').limit(8),
        supabase.from('event_participants').select('id, event_id, event:events(title, emoji, event_date, location, type, status)').eq('user_id', profileId).limit(8),
        supabase.from('user_badges').select('badge_id, badge:badges(id, name, icon, rarity)').eq('user_id', profileId).limit(12),
      ]);
      setProfile(profileRes.data ?? null);
      setPosts(postsRes.data ?? []);
      setCarnets((carnetsRes.data ?? []) as Carnet[]);
      setClubs((clubsRes.data ?? []) as unknown as ClubMembership[]);
      setEvents((eventsRes.data ?? []) as unknown as EventParticipation[]);
      setBadges(((badgesRes.data ?? []) as any[]).map((b) => b.badge).filter(Boolean));
      const { data: memberData } = await supabase.from('group_members').select('group_id, role').eq('user_id', profileId).eq('status', 'active');
      if (memberData?.length) {
        const groupIds = memberData.map(m => m.group_id);
        const { data: groupsData } = await supabase.from('travel_groups').select('id, name, destination, theme, departure_date, return_date, visibility, group_level, optimization_score').in('id', groupIds).order('created_at', { ascending: false }).limit(8);
        const enriched = await Promise.all((groupsData || []).map(async (g) => {
          const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('status', 'active');
          return { ...g, member_count: count || 0, my_role: memberData.find(m => m.group_id === g.id)?.role };
        }));
        setGroups(enriched);
      }
      const [fwersRes, fwingRes] = await Promise.all([
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
      ]);
      setFollowersCount(fwersRes.count ?? 0);
      setFollowingCount(fwingRes.count ?? 0);
      if (user) { const { data: followData } = await supabase.from('user_follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle(); setIsFollowing(!!followData); }
      setLoading(false);
    };
    load();
  }, [profileId, supabase, user]);

  const handleFollow = async () => {
    if (!user) { showToast('Connectez-vous pour suivre'); return; }
    if (user.id === profileId) return;
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false); setFollowersCount((c) => Math.max(0, c - 1)); showToast('Abonnement annulé');
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true); setFollowersCount((c) => c + 1); showToast('Abonné !');
    }
  };

  const levelCfg = LEVEL_CFG[profile?.loyalty_level ?? 'Explorateur'] ?? LEVEL_CFG.Explorateur;
  const initials = profile?.full_name ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const isOwnProfile = user?.id === profileId;

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2E8]">
          <Header />
          <main className="pt-20 pb-24">
            <div className="bg-[#1C2620] h-[40vh] min-h-[300px] w-full relative overflow-hidden">
              <div className="absolute inset-0 opacity-40 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Cover" fill className="object-cover opacity-60 mix-blend-overlay blur-sm" /> : <div className="absolute inset-0 bg-[#17402C]/10" />}
              <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center">
                <div className="translate-y-1/2">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt={`Photo de ${profile.full_name}`} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-[#F5F2E8] shadow-xl" />
                    : <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#17402C] flex items-center justify-center text-4xl md:text-5xl font-700 text-white border-4 border-[#F5F2E8] shadow-xl">{initials}</div>}
                </div>
              </div>
            </div>
            <div className="max-w-5xl mx-auto px-4 mt-20 md:mt-24">
              {loading ? <div className="flex flex-col items-center justify-center space-y-4 py-12"><div className="h-10 w-64 bg-[#C8C3B0]/30 rounded animate-pulse" /><div className="h-4 w-48 bg-[#C8C3B0]/30 rounded animate-pulse" /></div>
                : !profile ? <div className="text-center py-12"><p className="text-[#5C6B5E]">Profil introuvable</p></div>
                  : <><div className="text-center mb-12"><h1 className="font-display font-800 text-4xl md:text-5xl text-[#1C2620] mb-3">{profile.full_name}</h1></div></>
              }
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100dvh', background: '#F5F2E8', padding: '16px' }}>
            {loading ? <p style={{ color: 'rgba(28,38,32,0.5)' }}>Chargement…</p>
              : !profile ? <p style={{ color: 'rgba(28,38,32,0.5)' }}>Profil introuvable</p>
                : <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '4px' }}>{profile.full_name}</h1>
                  <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)', marginBottom: '16px' }}>{profile.location || 'Nomade'} · {levelCfg.icon} {profile.loyalty_level}</p>
                  <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.7)', marginBottom: '16px', lineHeight: '1.6' }}>{profile.bio || "Ce voyageur n'a pas encore écrit de biographie."}</p>
                </div>
            }
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
