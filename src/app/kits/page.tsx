'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Kit {
  id: string;
  slug: string;
  nom: string;
  description: string;
  destination: string;
  saison: string;
  poids_total_g: number;
  prix_cents: number;
  nb_articles: number;
  difficulte: 'Débutant' | 'Intermédiaire' | 'Expert';
  activite: string;
  image: string;
  alt: string;
  tags: string[];
  featured?: boolean;
}

interface KitReadiness {
  kitId: string;
  score: number;
  missingEssentials: number;
}

const activites = ['Tous', 'Trek', 'Randonnée', 'Vanlife', 'Alpinisme', 'Désert', 'Photo'];
const difficultes = ['Tous', 'Débutant', 'Intermédiaire', 'Expert'];

const difficulteColor: Record<string, string> = {
  Débutant: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Intermédiaire: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  Expert: 'text-red-400 bg-red-400/10 border-red-400/30'
};

function ReadinessBar({ score, missingEssentials }: { score: number; missingEssentials: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground font-mono">Prêt à partir</span>
        <span className="text-[10px] font-mono font-600" style={{ color }}>{score}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {missingEssentials > 0 && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {missingEssentials} essentiel{missingEssentials > 1 ? 's' : ''} manquant{missingEssentials > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export default function KitsPage() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeActivite, setActiveActivite] = useState('Tous');
  const [activeDifficulte, setActiveDifficulte] = useState('Tous');
  const [sortBy, setSortBy] = useState<'prix' | 'poids' | 'articles'>('prix');
  const [readinessMap, setReadinessMap] = useState<Record<string, KitReadiness>>({});
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();

  const loadKits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('kits')
        .select('*')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setKits(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Compute readiness scores for all kits based on user inventory
  const computeReadiness = useCallback(async (kitList: Kit[]) => {
    if (!user || kitList.length === 0) return;
    try {
      // Load user inventory categories
      const { data: inventory } = await supabase
        .from('gear_items')
        .select('category, condition')
        .eq('user_id', user.id)
        .neq('condition', 'à_remplacer');
      const ownedCategories = new Set((inventory ?? []).map(i => i.category));

      // Load kit_items for all kits
      const kitIds = kitList.map(k => k.id);
      const { data: allKitItems } = await supabase
        .from('kit_items')
        .select('kit_id, category, essentiel')
        .in('kit_id', kitIds);

      const map: Record<string, KitReadiness> = {};
      for (const kit of kitList) {
        const items = (allKitItems ?? []).filter(i => i.kit_id === kit.id);
        const essentials = items.filter(i => i.essentiel);
        if (essentials.length === 0) continue;
        const ownedEssentials = essentials.filter(i => ownedCategories.has(i.category)).length;
        const score = Math.round((ownedEssentials / essentials.length) * 100);
        map[kit.id] = { kitId: kit.id, score, missingEssentials: essentials.length - ownedEssentials };
      }
      setReadinessMap(map);
    } catch {
      // Silent fail
    }
  }, [user, supabase]);

  useEffect(() => { loadKits(); }, [loadKits]);
  useEffect(() => { if (kits.length > 0) computeReadiness(kits); }, [kits, computeReadiness]);

  const filtered = kits
    .filter((k) => activeActivite === 'Tous' || k.activite === activeActivite)
    .filter((k) => activeDifficulte === 'Tous' || k.difficulte === activeDifficulte)
    .sort((a, b) => {
      if (sortBy === 'prix') return a.prix_cents - b.prix_cents;
      if (sortBy === 'poids') return a.poids_total_g - b.poids_total_g;
      return a.nb_articles - b.nb_articles;
    });

  const featured = kits.filter((k) => k.featured);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-0 bg-dark-bg relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E7E3D6' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-1 h-12 bg-primary flex-shrink-0 mt-1" />
            <div>
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                BIBLIOTHÈQUE — {kits.length} KITS DISPONIBLES
              </p>
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                KITS INTELLIGENTS
              </h1>
              <p className="mt-3 text-white/60 text-lg max-w-2xl">
                Des sélections d&apos;équipement optimisées par destination, saison et profil. Chaque kit est pesé, testé, et prêt à partir.
              </p>
            </div>
          </div>
        </div>
        <TopoSeparator color="#E7E3D6" />
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Featured Kits */}
              {featured.length > 0 && (
                <>
                  <h2 className="font-display font-700 text-2xl text-foreground tracking-tight mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                    ⭐ Kits populaires
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {featured.map((kit) => (
                      <Link key={kit.slug} href={`/kits/${kit.slug}`} className="group block">
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
                          <div className="relative h-48 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={kit.image} alt={kit.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/80 to-transparent" />
                            <div className="absolute top-3 left-3 flex gap-2">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${difficulteColor[kit.difficulte]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                                {kit.difficulte.toUpperCase()}
                              </span>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3">
                              <p className="font-display font-700 text-white text-lg leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                                {kit.nom}
                              </p>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex gap-1.5 flex-wrap">
                                {kit.tags?.map((tag) => (
                                  <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 bg-accent/20 text-accent rounded" style={{ fontFamily: 'var(--font-mono)' }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <WeightGauge weightG={kit.poids_total_g} maxG={15000} size="sm" />
                            {readinessMap[kit.id] && (
                              <ReadinessBar score={readinessMap[kit.id].score} missingEssentials={readinessMap[kit.id].missingEssentials} />
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <span className="font-mono text-sm text-info font-600" style={{ fontFamily: 'var(--font-mono)' }}>
                                {(kit.prix_cents / 100).toFixed(2)} €
                              </span>
                              <span className="text-xs text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                                {kit.nb_articles} articles
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-card rounded-xl border border-border">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>Activité</p>
                  <div className="flex flex-wrap gap-2">
                    {activites.map((a) => (
                      <button
                        key={a}
                        onClick={() => setActiveActivite(a)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeActivite === a ? 'bg-primary text-white' : 'bg-background border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>Difficulté</p>
                  <div className="flex flex-wrap gap-2">
                    {difficultes.map((d) => (
                      <button
                        key={d}
                        onClick={() => setActiveDifficulte(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeDifficulte === d ? 'bg-primary text-white' : 'bg-background border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>Trier par</p>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="prix">Prix</option>
                    <option value="poids">Poids</option>
                    <option value="articles">Nb articles</option>
                  </select>
                </div>
              </div>

              {/* All kits grid */}
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="ArchiveBoxIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-display font-700 text-foreground mb-1">Aucun kit trouvé</p>
                  <p className="text-sm">Essayez d&apos;autres filtres</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((kit) => (
                    <Link key={kit.slug} href={`/kits/${kit.slug}`} className="group block">
                      <div className="relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 h-full flex flex-col">
                        <div className="relative h-44 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={kit.image} alt={kit.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/70 to-transparent" />
                          <div className="absolute top-3 left-3">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${difficulteColor[kit.difficulte]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                              {kit.difficulte.toUpperCase()}
                            </span>
                          </div>
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="font-display font-700 text-white text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                              {kit.nom}
                            </p>
                            <p className="text-white/60 text-xs mt-0.5">📍 {kit.destination} · {kit.saison}</p>
                          </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="flex gap-1.5 flex-wrap mb-3">
                            {kit.tags?.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 bg-accent/20 text-accent rounded" style={{ fontFamily: 'var(--font-mono)' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <WeightGauge weightG={kit.poids_total_g} maxG={15000} size="sm" />
                          {readinessMap[kit.id] && (
                            <ReadinessBar score={readinessMap[kit.id].score} missingEssentials={readinessMap[kit.id].missingEssentials} />
                          )}
                          <div className="flex items-center justify-between mt-3 mt-auto">
                            <span className="font-mono text-sm text-info font-600" style={{ fontFamily: 'var(--font-mono)' }}>
                              {(kit.prix_cents / 100).toFixed(2)} €
                            </span>
                            <span className="text-xs text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                              {kit.nb_articles} articles
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
