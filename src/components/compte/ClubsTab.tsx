'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type FilterMode = 'tous' | 'admin' | 'membre';

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
    <div className="space-y-8 pb-16 font-sans text-[#17402C]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#17402C] text-white px-5 py-3 rounded-full flex items-center gap-3 text-sm font-semibold border border-white/20 shadow-lg animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#A6C1A0] animate-ping" />
          {toast}
        </div>
      )}

      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#17402C]/5 pb-5">
        <div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#17402C]">
            Vos <span className="font-serif italic font-normal text-[#365233]">clubs &amp; communautés</span>
          </h2>
          <p className="text-xs text-[#5A7064] mt-1 font-mono">
            {clubs.length} communautés actives · 1 rôle admin · 615 membres connectés · 12 sorties ce mois
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/groupes"
            className="glass-capsule-btn text-xs font-bold"
          >
            <Icon name="PlusIcon" size={14} />
            <span>Nouveau groupe</span>
          </Link>
          <Link
            href="/clubs/nouveau"
            className="glass-capsule-btn primary text-xs font-bold"
          >
            <Icon name="UserGroupIcon" size={14} />
            <span>+ Créer un club</span>
          </Link>
        </div>
      </div>

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-[1.25rem] p-5 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] mb-1">CLUBS REJOINTS</p>
          <div className="flex items-baseline gap-2">
            <span className="glass-metric text-3xl sm:text-4xl text-[#17402C]">{clubs.length}</span>
          </div>
          <p className="text-xs text-[#5A7064] mt-2 font-mono">Depuis 2023 · <span className="text-[#17402C] font-semibold">1 admin</span></p>
        </div>

        <div className="glass rounded-[1.25rem] p-5 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] mb-1">SORTIES PARTAGÉES</p>
          <div className="flex items-baseline gap-2">
            <span className="glass-metric text-3xl sm:text-4xl text-[#17402C]">28</span>
          </div>
          <p className="text-xs text-[#5B7F55] mt-2 font-semibold flex items-center gap-1 font-mono">
            <span>↑ 12 sorties</span> <span className="text-[#5A7064] font-normal">cette année</span>
          </p>
        </div>

        <div className="glass rounded-[1.25rem] p-5 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] mb-1">MEMBRES CONNECTÉS</p>
          <div className="flex items-baseline gap-2">
            <span className="glass-metric text-3xl sm:text-4xl text-[#17402C]">615</span>
          </div>
          <p className="text-xs text-[#5A7064] mt-2 font-mono">Réseau des {clubs.length} clubs</p>
        </div>

        <div className="glass rounded-[1.25rem] p-5 flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] mb-1">NOUVEAUTÉS</p>
          <div className="flex items-baseline gap-1.5">
            <span className="glass-metric text-3xl sm:text-4xl text-[#17402C]">7</span>
            <span className="text-sm font-serif italic text-[#365233]">alertes</span>
          </div>
          <p className="text-xs text-[#5A7064] mt-2 font-mono">
            <span className="text-[#17402C] font-bold">3 non lus</span> · {invitations.length} invitations
          </p>
        </div>
      </div>

      {/* Main Content Stack */}
      <div className="space-y-6">
        {/* Featured Club Banner ("Club à la une") */}
        {featuredClub && (
          <div className="relative rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#17402C] text-white shadow-[0_16px_40px_-20px_rgba(23,64,44,0.35)]">
            {/* Cover Image Background */}
            <div className="absolute inset-0 z-0">
              <Image
                src={featuredClub.coverUrl || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1000&q=80'}
                alt={featuredClub.name}
                fill
                className="object-cover opacity-30 mix-blend-luminosity"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#17402C] via-[#17402C]/90 to-transparent" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
              {/* Top Row: Admin Badge & Featured Tag */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="bg-white/15 backdrop-blur-md text-white text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white/20">
                    VOUS ÊTES ADMIN
                  </span>
                  <span className="text-white/60 text-[10px] font-mono uppercase tracking-widest">
                    CLUB À LA UNE
                  </span>
                </div>
              </div>

              {/* Middle Row: Title & Subtitle */}
              <div className="my-3">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                  {featuredClub.name.replace(/Grenoble$/, '')}
                  <span className="font-serif italic font-normal text-[#A6C1A0]"> Grenoble</span>
                </h2>
                <p className="text-white/80 text-xs sm:text-sm mt-1 max-w-xl font-serif italic">
                  &ldquo;{featuredClub.tagline || 'Trois massifs, une porte : Chartreuse, Vercors, Belledonne.'}&rdquo;
                </p>
              </div>

              {/* Bottom Row: Stats & Action buttons */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-3 border-t border-white/15">
                {/* Stats Mini Grid */}
                <div className="grid grid-cols-4 gap-4 text-center sm:text-left">
                  <div>
                    <span className="text-lg font-mono font-bold text-white block">248</span>
                    <span className="text-[10px] font-mono text-white/60 uppercase">Membres</span>
                  </div>
                  <div>
                    <span className="text-lg font-mono font-bold text-white block">3</span>
                    <span className="text-[10px] font-mono text-white/60 uppercase">Sorties ce mois</span>
                  </div>
                  <div>
                    <span className="text-lg font-mono font-bold text-white block">68</span>
                    <span className="text-[10px] font-mono text-white/60 uppercase">Topos</span>
                  </div>
                  <div>
                    <span className="text-lg font-mono font-bold text-white block">4.9★</span>
                    <span className="text-[10px] font-mono text-white/60 uppercase">Note</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/clubs/${featuredClub.slug}`}
                    className="glass-capsule-btn primary !py-1.5 !px-4 text-xs font-bold"
                  >
                    Espace Admin →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vos Communautés (Full List with Filter Tabs) */}
        <div className="glass rounded-[1.5rem] p-5 sm:p-6 space-y-5 border border-white/50 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-[#17402C]">
                Vos <span className="font-serif italic font-normal text-[#5B7F55]">communautés</span>
              </h3>
              <p className="text-xs text-[#5A7064] mt-0.5">Clubs dont vous êtes membre ou responsable</p>
            </div>

            {/* Segmented Filter */}
            <div className="glass-capsule-bar">
              <div className="flex items-center gap-1 p-0.5">
                {(['tous', 'admin', 'membre'] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`glass-capsule-segment !px-3 !py-1 text-xs capitalize ${
                      filterMode === mode ? 'active' : ''
                    }`}
                  >
                    {mode === 'tous' ? 'Tous' : mode === 'admin' ? 'Admin' : 'Membre'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clubs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredClubs.map((club) => (
              <div
                key={club.id}
                onClick={() => router.push(`/clubs/${club.slug}`)}
                className="glass-sub-card p-4 rounded-2xl border border-white/40 hover:bg-white/80 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 border border-white bg-[#17402C]">
                    <Image src={club.coverUrl || '/assets/images/no_image.png'} alt={club.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#17402C] truncate group-hover:text-[#5B7F55] transition-colors">
                        {club.name}
                      </h4>
                      {club.role === 'admin' && (
                        <span className="glass-pill !bg-[#17402C] !text-white text-[8.5px] font-mono font-bold uppercase">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#5A7064] mt-0.5 font-mono">
                      {club.membersCount} membres · {club.eventsThisMonth} sorties prévues
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {club.tags?.map((t, idx) => (
                        <span key={idx} className="glass-pill text-[8.5px] font-mono font-bold">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side-by-side: Invitations + À découvrir */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Invitations en attente */}
          <div className="glass rounded-[1.5rem] p-5 space-y-3.5 border border-white/50 shadow-sm">
            <div>
              <h3 className="text-base font-display font-bold text-[#17402C]">
                Invitations <span className="font-serif italic font-normal text-[#5B7F55]">en attente</span>
              </h3>
              <p className="text-[11px] text-[#5A7064]">
                {invitations.length} clubs vous invitent à rejoindre.
              </p>
            </div>

            {invitations.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#5A7064] glass-sub-card rounded-xl">
                Aucune invitation en attente.
              </div>
            ) : (
              <div className="space-y-2.5">
                {invitations.map((inv) => (
                  <div key={inv.id} className="glass-sub-card p-3 rounded-xl space-y-2 border border-white/40">
                    <div>
                      <h4 className="font-display font-bold text-xs text-[#17402C]">
                        {inv.clubName}
                      </h4>
                      <p className="text-[10px] text-[#5A7064] font-mono mt-0.5">
                        {inv.category} · {inv.membersCount} membres. Par <span className="font-bold text-[#17402C]">{inv.invitedBy}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleAcceptInvite(inv.id, inv.clubName)}
                        className="glass-capsule-btn primary flex-1 !py-1 text-[11px] font-bold"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(inv.id)}
                        className="glass-capsule-btn flex-1 !py-1 text-[11px] font-bold"
                      >
                        Décliner
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* À découvrir */}
          <div className="glass rounded-[1.5rem] p-5 space-y-3.5 border border-white/50 shadow-sm">
            <div>
              <h3 className="text-base font-display font-bold text-[#17402C]">
                À découvrir
              </h3>
              <p className="text-[11px] text-[#5A7064]">
                Clubs recommandés selon vos massifs
              </p>
            </div>

            <div className="space-y-2">
              {discoveryClubs.map((disc) => (
                <div key={disc.id} className="glass-sub-card flex items-center justify-between gap-3 p-2 rounded-xl border border-white/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg overflow-hidden relative shrink-0 bg-[#17402C]">
                      <Image src={disc.imageUrl || '/assets/images/no_image.png'} alt={disc.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-[#17402C] truncate">
                        {disc.name}
                      </h4>
                      <p className="text-[9.5px] text-[#5A7064] font-mono truncate">
                        {disc.membersCount} membres · {disc.category}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinDiscovery(disc.id, disc.name)}
                    disabled={disc.isJoined}
                    className={`glass-capsule-btn !py-1 !px-2.5 text-[10px] font-bold shrink-0 ${
                      disc.isJoined ? '!bg-[#5B7F55]/20 !text-[#5B7F55]' : 'primary'
                    }`}
                  >
                    {disc.isJoined ? 'Envoyé' : 'Rejoindre'}
                  </button>
                </div>
              ))}
            </div>

            <Link
              href="/clubs"
              className="block text-center text-[11px] font-bold text-[#5B7F55] hover:text-[#17402C] pt-2 border-t border-[#17402C]/5 transition-colors"
            >
              Voir l&apos;annuaire complet →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
