'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface PublicGroup {
  id: string;
  name: string;
  description: string;
  destination: string;
  theme: string;
  visibility: string;
  invite_code: string;
  max_members: number;
  departure_date: string | null;
  return_date: string | null;
  budget_target: number;
  group_level: number;
  optimization_score: number;
  created_at: string;
  member_count?: number;
  owner?: { full_name: string } | null;
}

const THEMES = ['Tous', 'Trek', 'Van Life', 'Randonnée', 'Expédition', 'Tour du monde', 'Plage', 'Ski', 'Vélo', 'Moto'];

export default function ExploreGroupsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('Tous');
  const [joining, setJoining] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('travel_groups')
        .select('*, owner:user_profiles!travel_groups_owner_id_fkey(full_name)')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(30);

      // Get member counts
      const enriched = await Promise.all((data || []).map(async (g) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id)
          .eq('status', 'active');
        return { ...g, member_count: count || 0 };
      }));

      setGroups(enriched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup(groupId: string) {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    setJoining(groupId);
    try {
      const { error } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: user.id,
        role: 'member',
        status: 'active',
      });
      if (error && error.code !== '23505') throw error;
      toast('Vous avez rejoint le groupe !', 'success');
      loadGroups();
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setJoining(null);
    }
  }

  async function handleJoinByCode() {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    if (!joinCode.trim()) return;
    setJoiningByCode(true);
    try {
      const { data: group } = await supabase
        .from('travel_groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();
      if (!group) { toast('Code invalide', 'error'); return; }
      const { error } = await supabase.from('group_members').insert({
        group_id: group.id, user_id: user.id, role: 'member', status: 'active',
      });
      if (error && error.code !== '23505') throw error;
      toast(`Vous avez rejoint "${group.name}" !`, 'success');
      setJoinCode('');
      loadGroups();
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setJoiningByCode(false);
    }
  }

  const filtered = groups.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.destination.toLowerCase().includes(search.toLowerCase());
    const matchTheme = selectedTheme === 'Tous' || g.theme === selectedTheme;
    return matchSearch && matchTheme;
  });

  const themeEmoji: Record<string, string> = {
    Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍', Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒',
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="pt-20 bg-dark-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>DÉCOUVERTE</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-800 text-3xl md:text-4xl text-white tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Explorer les groupes
              </h1>
              <p className="text-white/60 text-sm mt-1">Rejoignez des aventuriers qui partagent vos passions</p>
            </div>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="Code d'invitation"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary w-36"
              />
              <button onClick={handleJoinByCode} disabled={joiningByCode} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                {joiningByCode ? '...' : 'Rejoindre'}
              </button>
              <Link href="/groupe" className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
                <Icon name="UserGroupIcon" size={14} variant="outline" />
                Mes groupes
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/10">
            <div><div className="font-mono text-xl font-700 text-white">{groups.length}</div><div className="text-xs text-white/40">Groupes actifs</div></div>
            <div><div className="font-mono text-xl font-700 text-white">{groups.reduce((s, g) => s + (g.member_count || 0), 0)}</div><div className="text-xs text-white/40">Voyageurs</div></div>
            <div><div className="font-mono text-xl font-700 text-white">{new Set(groups.map(g => g.destination)).size}</div><div className="text-xs text-white/40">Destinations</div></div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" variant="outline" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou destination..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {THEMES.map(theme => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(theme)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${selectedTheme === theme ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
              >
                {theme !== 'Tous' && themeEmoji[theme] ? `${themeEmoji[theme]} ` : ''}{theme}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="UserGroupIcon" size={48} className="text-muted-foreground mx-auto mb-4" variant="outline" />
            <h3 className="font-display font-700 text-lg text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Aucun groupe trouvé</h3>
            <p className="text-sm text-muted-foreground mb-4">Soyez le premier à créer un groupe pour cette destination !</p>
            <Link href="/groupe" className="btn-primary py-2 px-4 text-sm inline-flex items-center gap-2">
              <Icon name="PlusIcon" size={14} variant="outline" />
              Créer un groupe
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(group => (
              <div key={group.id} className="topo-card p-5 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{themeEmoji[group.theme] || '🎒'}</span>
                      <h3 className="font-display font-700 text-sm text-foreground truncate" style={{ fontFamily: 'var(--font-display)' }}>{group.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="MapPinIcon" size={11} variant="outline" />
                      <span className="truncate">{group.destination}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{group.theme}</span>
                    <div className="flex items-center gap-1">
                      <Icon name="TrophyIcon" size={10} className="text-amber-500" variant="outline" />
                      <span className="text-[10px] text-muted-foreground">Niv. {group.group_level}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {group.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{group.description}</p>
                )}

                {/* Dates */}
                {group.departure_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <Icon name="CalendarIcon" size={11} variant="outline" />
                    <span>{new Date(group.departure_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {group.return_date && <><span>→</span><span>{new Date(group.return_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span></>}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-background rounded-lg border border-border">
                    <div className="font-mono text-sm font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{group.member_count || 0}</div>
                    <div className="text-[10px] text-muted-foreground">membres</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded-lg border border-border">
                    <div className="font-mono text-sm font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{group.budget_target > 0 ? `${group.budget_target}€` : '—'}</div>
                    <div className="text-[10px] text-muted-foreground">budget</div>
                  </div>
                  <div className="text-center p-2 bg-background rounded-lg border border-border">
                    <div className="font-mono text-sm font-700 text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{group.optimization_score}</div>
                    <div className="text-[10px] text-muted-foreground">score</div>
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Places disponibles</span>
                    <span>{group.member_count || 0}/{group.max_members}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(((group.member_count || 0) / group.max_members) * 100, 100)}%` }} />
                  </div>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                  <Icon name="UserIcon" size={11} variant="outline" />
                  <span>Organisé par {(group.owner as any)?.full_name || 'Anonyme'}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <Link href="/groupe" className="flex-1 text-center border border-border text-foreground py-2 px-3 text-xs rounded-lg hover:border-primary transition-colors">
                    Voir détails
                  </Link>
                  {(group.member_count || 0) < group.max_members ? (
                    <button
                      onClick={() => handleJoinGroup(group.id)}
                      disabled={joining === group.id}
                      className="flex-1 btn-primary py-2 px-3 text-xs justify-center"
                    >
                      {joining === group.id ? '...' : 'Rejoindre'}
                    </button>
                  ) : (
                    <span className="flex-1 text-center bg-muted text-muted-foreground py-2 px-3 text-xs rounded-lg">Complet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
