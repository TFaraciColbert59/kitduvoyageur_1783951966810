'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Guide {
  id: string;
  slug: string;
  title: string;
  category: string;
  destination: string;
  read_time: number;
  difficulty: string;
  image: string;
  alt: string;
  excerpt: string;
  tags: string[];
  featured: boolean;
  author?: { full_name: string };
  created_at: string;
}

const difficultyColor: Record<string, string> = {
  Débutant: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Intermédiaire: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Expert: 'text-red-500 bg-red-50 border-red-200',
};

const categoryColor: Record<string, string> = {
  Destination: 'text-blue-600 bg-blue-50',
  Checklist: 'text-primary bg-primary/10',
  'Guide pratique': 'text-accent bg-accent/10',
  "Guide d'achat": 'text-secondary bg-secondary/10',
  Comparatif: 'text-purple-600 bg-purple-50',
};

// eslint-disable-next-line no-useless-escape
const categories = ['Tous', 'Destination', 'Checklist', 'Guide pratique', "Guide d\'achat", 'Comparatif'];

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', category: 'Destination', destination: '', read_time: 5, difficulty: 'Débutant',
    image: '', alt: '', excerpt: '', tags: '', featured: false,
  });
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('guides')
        .select('*, author:user_profiles!guides_author_id_fkey(full_name)')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setGuides(data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadGuides(); }, [loadGuides]);

  const handleCreateGuide = async () => {
    if (!user || !createForm.title.trim()) return;
    setCreating(true);
    try {
      const slug = createForm.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60) + '-' + Date.now();
      const { error: insertError } = await supabase.from('guides').insert({
        slug,
        title: createForm.title,
        category: createForm.category,
        destination: createForm.destination,
        read_time: createForm.read_time,
        difficulty: createForm.difficulty,
        image: createForm.image || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa',
        alt: createForm.alt || createForm.title,
        excerpt: createForm.excerpt,
        tags: createForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        featured: createForm.featured,
        author_id: user.id,
      });
      if (insertError) throw insertError;
      setShowCreateModal(false);
      setCreateForm({ title: '', category: 'Destination', destination: '', read_time: 5, difficulty: 'Débutant', image: '', alt: '', excerpt: '', tags: '', featured: false });
      await loadGuides();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = guides.filter((g) => activeCategory === 'Tous' || g.category === activeCategory);
  const featured = filtered.filter((g) => g.featured);
  const rest = filtered.filter((g) => !g.featured);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="pt-24 pb-0 bg-dark-bg relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E7E3D6' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-1 h-12 bg-primary flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2">HUB CONTENU — {guides.length} GUIDES</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight leading-none">GUIDES & CHECKLISTS</h1>
                  <p className="mt-3 text-white/60 text-lg max-w-2xl">Conseils d&apos;experts, checklists téléchargeables et guides destination pour préparer chaque aventure avec précision.</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary flex-shrink-0 mt-2">
                  <Icon name="PlusIcon" size={16} />
                  Publier un guide
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`category-pill text-sm ${activeCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <TopoSeparator color="#E7E3D6" />
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              {featured.length > 0 && (
                <>
                  <h2 className="font-display font-700 text-2xl text-foreground tracking-tight mb-6">⭐ Guides incontournables</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {featured[0] && (
                      <Link href={`/guides/${featured[0].slug}`} className="group md:col-span-2 lg:col-span-1 lg:row-span-2 block">
                        <article className="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 h-full min-h-[320px]">
                          <div className="absolute inset-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={featured[0].image} alt={featured[0].alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/60 to-transparent" />
                          </div>
                          <div className="relative z-10 p-6 flex flex-col justify-end h-full">
                            <div className="flex gap-2 mb-3">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${categoryColor[featured[0].category] || 'text-white/60 bg-white/10'}`}>{featured[0].category.toUpperCase()}</span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${difficultyColor[featured[0].difficulty]}`}>{featured[0].difficulty.toUpperCase()}</span>
                            </div>
                            <h3 className="font-display font-700 text-white text-xl leading-tight mb-2">{featured[0].title}</h3>
                            <p className="text-white/60 text-sm line-clamp-2 mb-3">{featured[0].excerpt}</p>
                            <div className="flex items-center gap-3 text-white/40 text-xs font-mono">
                              <span>{featured[0].destination}</span>
                              <span>·</span>
                              <span>{featured[0].read_time} min de lecture</span>
                            </div>
                          </div>
                        </article>
                      </Link>
                    )}
                    {featured.slice(1).map((guide) => (
                      <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block">
                        <article className="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 h-64">
                          <div className="absolute inset-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={guide.image} alt={guide.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/90 via-dark-bg/40 to-transparent" />
                          </div>
                          <div className="relative z-10 p-5 flex flex-col justify-end h-full">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded w-fit mb-2 ${categoryColor[guide.category] || 'text-white/60 bg-white/10'}`}>{guide.category.toUpperCase()}</span>
                            <h3 className="font-display font-700 text-white text-base leading-tight mb-1">{guide.title}</h3>
                            <div className="flex items-center gap-2 text-white/40 text-xs font-mono">
                              <span>{guide.destination}</span>
                              <span>·</span>
                              <span>{guide.read_time} min</span>
                            </div>
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                </>
              )}

              <h2 className="font-display font-700 text-2xl text-foreground tracking-tight mb-6">Tous les guides</h2>
              {rest.length === 0 && featured.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="BookOpenIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-display font-700 text-foreground mb-1">Aucun guide pour l&apos;instant</p>
                  <p className="text-sm">Soyez le premier à publier un guide !</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {rest.map((guide) => (
                    <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group block">
                      <article className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-300 h-full flex flex-col">
                        <div className="relative h-44 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={guide.image} alt={guide.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/60 to-transparent" />
                          <span className={`absolute top-3 left-3 text-[10px] font-mono px-2 py-0.5 rounded ${categoryColor[guide.category] || 'text-white/60 bg-white/10'}`}>{guide.category.toUpperCase()}</span>
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${difficultyColor[guide.difficulty]}`}>{guide.difficulty}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{guide.read_time} min</span>
                          </div>
                          <h3 className="font-display font-700 text-foreground text-sm leading-tight mb-2 flex-1">{guide.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{guide.excerpt}</p>
                          <div className="flex flex-wrap gap-1 mt-auto">
                            {guide.tags?.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Create guide modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-700 text-foreground text-lg">Publier un guide</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            {!user ? (
              <p className="text-sm text-muted-foreground text-center py-4">Connectez-vous pour publier un guide.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Titre</label>
                  <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Titre du guide" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Catégorie</label>
                    <select className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={createForm.category} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}>
                      {categories.filter((c) => c !== 'Tous').map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Difficulté</label>
                    <select className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={createForm.difficulty} onChange={(e) => setCreateForm((f) => ({ ...f, difficulty: e.target.value }))}>
                      <option>Débutant</option>
                      <option>Intermédiaire</option>
                      <option>Expert</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Destination</label>
                    <input className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: Islande" value={createForm.destination} onChange={(e) => setCreateForm((f) => ({ ...f, destination: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Temps de lecture (min)</label>
                    <input type="number" min={1} className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={createForm.read_time} onChange={(e) => setCreateForm((f) => ({ ...f, read_time: parseInt(e.target.value) || 5 }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Résumé</label>
                  <textarea rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Résumé du guide..." value={createForm.excerpt} onChange={(e) => setCreateForm((f) => ({ ...f, excerpt: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Tags (séparés par virgule)</label>
                  <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Trek, Froid, Montagne" value={createForm.tags} onChange={(e) => setCreateForm((f) => ({ ...f, tags: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">URL image de couverture</label>
                  <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="https://..." value={createForm.image} onChange={(e) => setCreateForm((f) => ({ ...f, image: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.featured} onChange={(e) => setCreateForm((f) => ({ ...f, featured: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-foreground">Mettre en avant (guide incontournable)</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary py-2.5 text-sm justify-center">Annuler</button>
                  <button onClick={handleCreateGuide} disabled={creating || !createForm.title.trim()} className="flex-1 btn-primary py-2.5 text-sm justify-center disabled:opacity-50">
                    {creating ? 'Publication...' : 'Publier le guide'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export const dynamic = 'force-dynamic';