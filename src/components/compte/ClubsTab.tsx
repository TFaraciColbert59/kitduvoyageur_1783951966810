'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface ClubItem {
  id: string;
  name: string;
  slug: string;
  role: 'admin' | 'member';
  membersCount: number;
  eventsThisMonth: number;
  joinedDate: string;
  tags: string[];
  nextEvent?: string;
  unreadCount?: number;
  isFeatured?: boolean;
  tagline?: string;
  coverUrl?: string;
}

interface InvitationItem {
  id: string;
  clubName: string;
  category: string;
  membersCount: number;
  invitedBy: string;
}

interface DiscoveryClub {
  id: string;
  name: string;
  membersCount: number;
  category: string;
  imageUrl: string;
  isJoined?: boolean;
}

interface ActivityItem {
  id: string;
  clubName: string;
  type: 'event' | 'join' | 'comment' | 'workshop' | 'race' | 'carnet';
  content: string;
  detail?: string;
  timeAgo: string;
  hasRSVP?: boolean;
  userRsvp?: 'yes' | 'later' | null;
}

export default function ClubsTab({ profile }: { profile?: any }) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'tous' | 'admin' | 'membre'>('tous');
  const [toast, setToast] = useState<string | null>(null);

  // State
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([
    { id: 'inv-1', clubName: 'Corsica Ridge', category: 'GR20', membersCount: 52, invitedBy: 'Sophie M.' },
    { id: 'inv-2', clubName: 'Étoiles & altitude', category: 'Astronomie', membersCount: 42, invitedBy: 'Camille V.' }
  ]);
  const [discoveryClubs, setDiscoveryClubs] = useState<DiscoveryClub[]>([
    { id: 'disc-1', name: 'Vercors Sauvage', membersCount: 164, category: 'Randonnée', imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80' },
    { id: 'disc-2', name: 'Écrins Alpinisme', membersCount: 92, category: 'Alpinisme', imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=80' },
    { id: 'disc-3', name: 'Chartreuse Solo', membersCount: 87, category: 'Randonnée solo', imageUrl: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=400&q=80' }
  ]);
  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: 'act-1', clubName: 'Club Alpin Grenoble', type: 'event', content: 'nouvelle sortie planifiée :', detail: 'Charmant Som le sam. 19 oct.', timeAgo: '2 h', hasRSVP: true },
    { id: 'act-2', clubName: 'Club Alpin Grenoble', type: 'join', content: 'Julien Mazet a rejoint Club Alpin Grenoble. Membre 249.', timeAgo: '5 h' },
    { id: 'act-3', clubName: 'Bivouacs Étoilés', type: 'comment', content: 'Antoine Rey a commenté votre post dans Bivouacs Étoilés :', detail: '"Le lac Achard est parfait à cette saison, on s\'organise ?"', timeAgo: 'hier' },
    { id: 'act-4', clubName: 'Photo de montagne', type: 'workshop', content: 'nouvel atelier :', detail: 'La lumière du col d\'automne, vendredi 18 oct. à 19h.', timeAgo: 'hier' },
    { id: 'act-5', clubName: 'Trail Chartreuse', type: 'race', content: '18 coureurs sont inscrits à la sortie du 27 oct. (Grand Som en 3 h).', timeAgo: '2 j' },
    { id: 'act-6', clubName: 'Club Alpin Grenoble', type: 'carnet', content: 'Camille Verger a publié le carnet Refuge de la Pra - aller-retour dans Club Alpin Grenoble.', timeAgo: '3 j' }
  ]);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Default mock clubs list matching screenshot design exactly
      const defaultClubs: ClubItem[] = [
        {
          id: 'c-1',
          name: 'Club Alpin Grenoble',
          slug: 'club-alpin-grenoble',
          role: 'admin',
          membersCount: 248,
          eventsThisMonth: 3,
          joinedDate: 'mars 2023',
          tags: ['Randonnée', 'Alpinisme', 'Ski'],
          nextEvent: 'Charmant Som · sam. 19 oct.',
          unreadCount: 3,
          isFeatured: true,
          tagline: 'Trois massifs, une porte : Chartreuse, Vercors, Belledonne.',
          coverUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1000&q=80'
        },
        {
          id: 'c-2',
          name: 'Bivouacs Étoilés',
          slug: 'bivouacs-etoiles',
          role: 'member',
          membersCount: 119,
          eventsThisMonth: 1,
          joinedDate: 'août 2024',
          tags: ['Bivouac', 'Nuit', 'Alpes du Nord'],
          nextEvent: 'Prochaine sortie ven. 19'
        },
        {
          id: 'c-3',
          name: 'Photo de montagne',
          slug: 'photo-de-montagne',
          role: 'member',
          membersCount: 156,
          eventsThisMonth: 2,
          joinedDate: 'janv. 2025',
          tags: ['Photo', 'Alpes', 'Ateliers'],
          nextEvent: 'Atelier vendredi soir'
        },
        {
          id: 'c-4',
          name: 'Trail Chartreuse',
          slug: 'trail-chartreuse',
          role: 'member',
          membersCount: 122,
          eventsThisMonth: 4,
          joinedDate: 'avr. 2024',
          tags: ['Trail', 'Course', 'Chartreuse'],
          nextEvent: 'Prochaine course dim. 27'
        }
      ];

      if (user) {
        // Try fetching real user clubs from Supabase
        const { data: dbMembers } = await supabase
          .from('club_members')
          .select('role, club:clubs(id, name, slug, description, category, members_count, cover_image, created_at)')
          .eq('user_id', user.id);

        if (dbMembers && dbMembers.length > 0) {
          const userClubs: ClubItem[] = dbMembers.map((m: any, idx: number) => ({
            id: m.club?.id || `c-${idx}`,
            name: m.club?.name || 'Club Randonnée',
            slug: m.club?.slug || 'club-randonnee',
            role: m.role === 'admin' ? 'admin' : 'member',
            membersCount: m.club?.members_count || 120,
            eventsThisMonth: 2,
            joinedDate: new Date(m.club?.created_at || Date.now()).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
            tags: [m.club?.category || 'Randonnée', 'Montagne'],
            isFeatured: idx === 0,
            tagline: m.club?.description || 'Club de passionnés de montagne',
            coverUrl: m.club?.cover_image || defaultClubs[0].coverUrl
          }));
          setClubs(userClubs);
        } else {
          setClubs(defaultClubs);
        }
      } else {
        setClubs(defaultClubs);
      }
    } catch (e) {
      console.error('Error fetching clubs data:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleAcceptInvite = (id: string, name: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== id));
    setClubs(prev => [
      ...prev,
      {
        id: `c-new-${Date.now()}`,
        name: name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        role: 'member',
        membersCount: 45,
        eventsThisMonth: 1,
        joinedDate: 'récent',
        tags: ['Montagne', 'Communauté']
      }
    ]);
    showToastMsg(`Vous avez rejoint le club ${name} !`);
  };

  const handleDeclineInvite = (id: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== id));
    showToastMsg('Invitation refusée');
  };

  const handleJoinDiscovery = (id: string, name: string) => {
    setDiscoveryClubs(prev => prev.map(c => c.id === id ? { ...c, isJoined: true } : c));
    showToastMsg(`Demande envoyée pour rejoindre ${name}`);
  };

  const handleRSVP = (actId: string, status: 'yes' | 'later') => {
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, userRsvp: status } : a));
    showToastMsg(status === 'yes' ? 'Inscription confirmée à la sortie !' : 'Rappel enregistré');
  };

  const featuredClub = clubs.find(c => c.isFeatured) || clubs[0];
  const filteredClubs = clubs.filter(c => {
    if (filterMode === 'admin') return c.role === 'admin';
    if (filterMode === 'membre') return c.role === 'member';
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn text-[#1C2620]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          {toast}
        </div>
      )}

      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-[#C8C3B0]/60 shadow-sm">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-[#1C2620]">
            Vos <span className="italic font-serif font-normal">clubs</span>
          </h1>
          <p className="text-sm text-[#5C6B5E] mt-1 font-medium">
            <span className="font-bold text-[#1C2620]">{clubs.length} communautés actives</span> · vous êtes admin d&apos;une · <span className="font-semibold text-[#1C2620]">615 membres cumulés</span> · 12 sorties partagées ce mois.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/nouveau-groupe"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#1C2620]/30 hover:border-[#1C2620] text-[#1C2620] text-xs font-bold transition-all hover:bg-[#1C2620]/5 shadow-sm"
          >
            <Icon name="PlusIcon" size={14} />
            Nouveau groupe
          </Link>
          <Link
            href="/clubs/nouveau"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1C2620] hover:bg-[#2A3830] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg"
          >
            <Icon name="UserGroupIcon" size={14} />
            Créer un club
          </Link>
        </div>
      </div>

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Clubs rejoints */}
        <div className="bg-white p-5 rounded-2xl border border-[#C8C3B0]/50 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B5E] mb-1">CLUBS REJOINTS</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-black text-[#1C2620]">{clubs.length}</span>
          </div>
          <p className="text-xs text-[#5C6B5E] mt-2 font-medium">Depuis 2023 · <span className="text-[#1C2620] font-semibold">1 admin</span></p>
        </div>

        {/* Card 2: Sorties partagées */}
        <div className="bg-white p-5 rounded-2xl border border-[#C8C3B0]/50 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B5E] mb-1">SORTIES PARTAGÉES</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-black text-[#1C2620]">28</span>
          </div>
          <p className="text-xs text-emerald-700 mt-2 font-semibold flex items-center gap-1">
            <span>↑ 12</span> <span className="text-[#5C6B5E] font-normal">cette année</span>
          </p>
        </div>

        {/* Card 3: Membres connectés */}
        <div className="bg-white p-5 rounded-2xl border border-[#C8C3B0]/50 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B5E] mb-1">MEMBRES CONNECTÉS</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-black text-[#1C2620]">615</span>
          </div>
          <p className="text-xs text-[#5C6B5E] mt-2 font-medium">Réseau cumulé des {clubs.length} clubs</p>
        </div>

        {/* Card 4: Nouveautés */}
        <div className="bg-white p-5 rounded-2xl border border-[#C8C3B0]/50 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B5E] mb-1">NOUVEAUTÉS</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-black text-[#1C2620]">7</span>
            <span className="text-base font-serif italic text-[#1C2620]">alertes</span>
          </div>
          <p className="text-xs text-[#5C6B5E] mt-2 font-medium">
            <span className="text-[#17402C] font-bold">3 non lus</span> · {invitations.length} invitations en attente
          </p>
        </div>
      </div>

      {/* Main Grid: Left Column (8 cols) + Right Sidebar (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Featured Club Banner ("Club à la une") */}
          {featuredClub && (
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-[#C8C3B0]/60 bg-[#1C2620] text-white">
              {/* Cover Image Background */}
              <div className="absolute inset-0 z-0">
                <Image
                  src={featuredClub.coverUrl || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1000&q=80'}
                  alt={featuredClub.name}
                  fill
                  className="object-cover opacity-35 mix-blend-luminosity hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1C2620] via-[#1C2620]/90 to-transparent" />
              </div>

              {/* Content Container */}
              <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-between min-h-[260px]">
                {/* Top Row: Admin Badge & Featured Tag */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#17402C] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                      VOUS ÊTES ADMIN
                    </span>
                    <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                      CLUB À LA UNE
                    </span>
                  </div>
                </div>

                {/* Middle Row: Title & Subtitle */}
                <div className="my-4">
                  <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                    {featuredClub.name.replace(/Grenoble$/, '')}
                    <span className="italic font-serif font-normal text-emerald-300"> Grenoble</span>
                  </h2>
                  <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium max-w-xl italic">
                    &ldquo;{featuredClub.tagline || 'Trois massifs, une porte : Chartreuse, Vercors, Belledonne.'}&rdquo;
                  </p>
                </div>

                {/* Bottom Row: Stats & Action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 border-t border-white/15">
                  {/* Stats Mini Grid */}
                  <div className="grid grid-cols-4 gap-4 text-center sm:text-left">
                    <div>
                      <span className="text-xl font-black text-white font-display block">248</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">MEMBRES</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-white font-display block">3 <span className="text-xs font-normal text-white/70">sort.</span></span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">CE MOIS</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-white font-display block">18h</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">PROCHAINE</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-amber-400 font-display block">3 <span className="text-xs font-normal text-white/70">alertes</span></span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">NON LUES</span>
                    </div>
                  </div>

                  {/* Next Event Info & Actions */}
                  <div className="flex items-center gap-3 self-end">
                    {featuredClub.nextEvent && (
                      <div className="hidden xl:flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs text-white">
                        <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded">Prochaine sortie</span>
                        <span className="font-medium text-white/90">{featuredClub.nextEvent}</span>
                      </div>
                    )}
                    <Link
                      href={`/clubs/${featuredClub.slug}/admin`}
                      className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold transition-all border border-white/30"
                    >
                      Gérer
                    </Link>
                    <Link
                      href={`/clubs/${featuredClub.slug}`}
                      className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg"
                    >
                      Ouvrir le club
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mes clubs Section */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#C8C3B0]/60 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#C8C3B0]/40 pb-5">
              <div>
                <h2 className="text-2xl font-display font-extrabold text-[#1C2620]">
                  Mes <span className="italic font-serif font-normal">clubs</span>
                </h2>
                <p className="text-xs text-[#5C6B5E] mt-1 font-medium">
                  Ouvrez un club pour voir son fil, ses sorties et ses membres.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center bg-[#EDEAE0] p-1 rounded-full border border-[#C8C3B0]/50 self-start">
                {(['tous', 'admin', 'membre'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterMode(tab)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                      filterMode === tab
                        ? 'bg-white text-[#1C2620] shadow-sm'
                        : 'text-[#5C6B5E] hover:text-[#1C2620]'
                    }`}
                  >
                    {tab === 'tous' ? 'Tous' : tab === 'admin' ? 'Admin' : 'Membre'}
                  </button>
                ))}
              </div>
            </div>

            {/* Clubs List */}
            <div className="space-y-4">
              {filteredClubs.map(club => (
                <div
                  key={club.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-[#C8C3B0]/40 hover:border-[#1C2620]/30 hover:bg-[#F9F8F5] transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {/* Club Avatar / Icon */}
                    <div className="w-12 h-12 rounded-2xl bg-[#1C2620] text-white flex items-center justify-center font-display font-black text-lg flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                      {club.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-display font-bold text-[#1C2620] group-hover:text-emerald-800 transition-colors">
                          {club.name}
                        </h3>
                        {club.role === 'admin' ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                            Admin
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Membre
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#5C6B5E] font-medium">
                        <span className="font-semibold text-[#1C2620]">{club.membersCount} membres</span> · {club.nextEvent || `${club.eventsThisMonth} sorties ce mois`} · Rejoint en {club.joinedDate}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {club.tags.map(t => (
                          <span key={t} className="text-[10px] bg-[#EDEAE0] text-[#5C6B5E] font-semibold px-2.5 py-0.5 rounded-md">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {club.unreadCount && (
                      <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-sm animate-pulse">
                        {club.unreadCount} NOUVEAUX
                      </span>
                    )}
                    <Link
                      href={`/clubs/${club.slug}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#C8C3B0] hover:border-[#1C2620] text-[#1C2620] text-xs font-bold transition-all hover:bg-white shadow-sm"
                    >
                      Ouvrir <Icon name="ArrowRightIcon" size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activité récente Section */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#C8C3B0]/60 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#C8C3B0]/40 pb-4">
              <div>
                <h2 className="text-xl font-display font-extrabold text-[#1C2620]">
                  Activité récente
                </h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5 font-medium">
                  Ce qui se passe dans vos clubs cette semaine.
                </p>
              </div>
              <Link href="/activite" className="text-xs font-bold text-[#5C6B5E] hover:text-[#1C2620] flex items-center gap-1">
                Voir tout <Icon name="ArrowRightIcon" size={13} />
              </Link>
            </div>

            {/* Timeline */}
            <div className="space-y-5">
              {activities.map(act => (
                <div key={act.id} className="flex items-start gap-4 text-xs">
                  {/* Icon Container */}
                  <div className="w-8 h-8 rounded-full bg-[#EDEAE0] text-[#1C2620] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#C8C3B0]/40">
                    {act.type === 'event' && <Icon name="CalendarDaysIcon" size={15} className="text-emerald-700" />}
                    {act.type === 'join' && <Icon name="UserPlusIcon" size={15} className="text-blue-700" />}
                    {act.type === 'comment' && <Icon name="ChatBubbleLeftIcon" size={15} className="text-amber-700" />}
                    {act.type === 'workshop' && <Icon name="SparklesIcon" size={15} className="text-purple-700" />}
                    {act.type === 'race' && <Icon name="CheckCircleIcon" size={15} className="text-emerald-700" />}
                    {act.type === 'carnet' && <Icon name="BookOpenIcon" size={15} className="text-emerald-800" />}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    <p className="text-[#1C2620] leading-relaxed font-medium">
                      <span className="font-bold">{act.clubName}</span> – {act.content}{' '}
                      {act.detail && <span className="italic font-semibold">{act.detail}</span>}
                    </p>

                    {/* RSVP Buttons if Event */}
                    {act.hasRSVP && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleRSVP(act.id, 'yes')}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                            act.userRsvp === 'yes'
                              ? 'bg-emerald-700 text-white shadow-sm'
                              : 'bg-[#1C2620] text-white hover:bg-[#2A3830]'
                          }`}
                        >
                          {act.userRsvp === 'yes' ? '✓ Inscrit' : 'Je participe'}
                        </button>
                        <button
                          onClick={() => handleRSVP(act.id, 'later')}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                            act.userRsvp === 'later'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620]'
                          }`}
                        >
                          Plus tard
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Time ago */}
                  <span className="text-[10px] text-[#5C6B5E] font-semibold flex-shrink-0">
                    {act.timeAgo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Invitations en attente Card */}
          <div className="bg-[#FAF8F5] p-6 rounded-3xl border border-[#C8C3B0]/60 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-display font-extrabold text-[#1C2620]">
                Invitations <span className="italic font-serif font-normal">en attente</span>
              </h2>
              <p className="text-xs text-[#5C6B5E] mt-0.5 font-medium">
                {invitations.length} clubs vous invitent à rejoindre leur communauté.
              </p>
            </div>

            {invitations.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#5C6B5E] font-medium bg-white rounded-2xl border border-dashed border-[#C8C3B0]">
                Aucune invitation en attente pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {invitations.map(inv => (
                  <div key={inv.id} className="bg-white p-4 rounded-2xl border border-[#C8C3B0]/50 shadow-sm space-y-3">
                    <div>
                      <h3 className="font-display font-bold text-sm text-[#1C2620]">
                        {inv.clubName}
                      </h3>
                      <p className="text-[11px] text-[#5C6B5E] font-medium mt-0.5">
                        {inv.category} · {inv.membersCount} membres. Invité par <span className="font-semibold text-[#1C2620]">{inv.invitedBy}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleAcceptInvite(inv.id, inv.clubName)}
                        className="flex-1 py-1.5 rounded-full bg-[#1C2620] hover:bg-[#2A3830] text-white text-xs font-bold transition-all shadow-sm"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(inv.id)}
                        className="flex-1 py-1.5 rounded-full border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] text-xs font-bold transition-all hover:bg-[#EDEAE0]"
                      >
                        Décliner
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* À découvrir Card */}
          <div className="bg-white p-6 rounded-3xl border border-[#C8C3B0]/60 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-display font-extrabold text-[#1C2620]">
                À découvrir
              </h2>
              <p className="text-xs text-[#5C6B5E] mt-0.5 font-medium">
                Clubs recommandés selon vos massifs et vos disciplines
              </p>
            </div>

            <div className="space-y-3">
              {discoveryClubs.map(disc => (
                <div key={disc.id} className="flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-[#F9F8F5] transition-colors border border-transparent hover:border-[#C8C3B0]/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden relative flex-shrink-0 bg-[#EDEAE0]">
                      <Image src={disc.imageUrl} alt={disc.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-xs text-[#1C2620] truncate">
                        {disc.name}
                      </h3>
                      <p className="text-[10px] text-[#5C6B5E] font-medium truncate">
                        {disc.membersCount} membres · {disc.category}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinDiscovery(disc.id, disc.name)}
                    disabled={disc.isJoined}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex-shrink-0 ${
                      disc.isJoined
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#1C2620] hover:bg-[#2A3830] text-white shadow-sm'
                    }`}
                  >
                    {disc.isJoined ? 'Demande envoyée' : 'Rejoindre'}
                  </button>
                </div>
              ))}
            </div>

            <Link
              href="/clubs"
              className="block text-center text-xs font-bold text-[#5C6B5E] hover:text-[#1C2620] pt-2 border-t border-[#C8C3B0]/30 transition-colors"
            >
              Voir l&apos;annuaire complet (218 clubs) →
            </Link>
          </div>

          {/* Dark Green Promo Card: "Créer votre propre club" */}
          <div className="bg-[#1C2620] p-7 rounded-3xl text-white shadow-xl space-y-4 border border-[#2A3830] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-lg font-display font-extrabold text-white leading-tight">
              Créer votre <span className="italic font-serif font-normal text-emerald-300">propre club</span>
            </h3>
            <p className="text-xs text-white/80 leading-relaxed font-medium">
              Rassembler des voyageurs autour d&apos;un massif que vous connaissez, à votre rythme.
            </p>
            <Link
              href="/clubs/nouveau"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-emerald-50 text-[#1C2620] text-xs font-bold transition-all shadow-md mt-2"
            >
              <Icon name="PlusIcon" size={14} />
              Créer un club
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
