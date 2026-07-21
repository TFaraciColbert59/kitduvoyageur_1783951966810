'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TopoSeparator from '@/components/TopoSeparator';
import AppImage from '@/components/ui/AppImage';
import type { BlogPost } from './page';

const CATEGORIES = ['Tous', 'Conseils', 'Destinations', 'Comparatifs', 'Guides d\'achat', 'Lifestyle'];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/guides/${post.slug}`} className="group block">
      <article className="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
        <div className="relative h-72 md:h-96 overflow-hidden">
          <AppImage
            src={post.image}
            alt={post.image_alt}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-700 bg-primary text-white tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
              ⭐ À la une
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/20 text-white mb-3 backdrop-blur-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {post.category}
            </span>
            <h2 className="font-display font-800 text-white text-xl md:text-2xl leading-tight mb-2 group-hover:text-primary/90 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
              {post.title}
            </h2>
            <p className="text-white/70 text-sm line-clamp-2 mb-3">{post.excerpt}</p>
            <div className="flex items-center gap-3 text-white/50 text-xs font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
              <span>{post.author}</span>
              <span>·</span>
              <span>{formatDate(post.published_at)}</span>
              <span>·</span>
              <span>{post.read_time} min de lecture</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/guides/${post.slug}`} className="group block h-full">
      <article className="h-full overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 flex flex-col">
        <div className="relative aspect-[16/9] overflow-hidden flex-shrink-0">
          <AppImage
            src={post.image}
            alt={post.image_alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/50 text-white backdrop-blur-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {post.category}
            </span>
          </div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-display font-700 text-foreground text-base leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>
            {post.title}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">{post.excerpt}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border pt-3" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>{formatDate(post.published_at)}</span>
            <span>{post.read_time} min</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BlogClient({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');

  const featured = useMemo(() => posts.filter((p) => p.featured), [posts]);
  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const matchCat = activeCategory === 'Tous' || p.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [posts, activeCategory, searchQuery]);

  const nonFeaturedFiltered = filtered.filter((p) => !p.featured || activeCategory !== 'Tous' || searchQuery);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-0 relative overflow-hidden" style={{ background: 'var(--dark-bg)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23E7E3D6' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-1 h-12 bg-primary flex-shrink-0 mt-1" />
            <div>
              <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                BLOG — {posts.length} ARTICLES
              </p>
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                CONSEILS & GUIDES
              </h1>
              <p className="mt-3 text-white/60 text-lg max-w-2xl">
                Expertise terrain, comparatifs honnêtes et inspirations pour voyager mieux, plus léger et plus loin.
              </p>
            </div>
          </div>
        </div>
        <TopoSeparator color="#E7E3D6" />
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Search + Category filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un article…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-primary text-white' :'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Featured posts */}
          {featured.length > 0 && activeCategory === 'Tous' && !searchQuery && (
            <div className="mb-12">
              <h2 className="font-display font-700 text-xl text-foreground mb-5" style={{ fontFamily: 'var(--font-display)' }}>
                À la une
              </h2>
              <div className={`grid gap-6 ${featured.length >= 2 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-2xl'}`}>
                {featured.slice(0, 2).map((post) => (
                  <FeaturedCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* All posts grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">📝</p>
              <h3 className="font-display font-700 text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Aucun article trouvé</h3>
              <p className="text-muted-foreground mb-6">Essayez une autre catégorie ou un autre terme de recherche.</p>
              <button onClick={() => { setActiveCategory('Tous'); setSearchQuery(''); }} className="btn-primary">
                Voir tous les articles
              </button>
            </div>
          ) : (
            <>
              {(activeCategory !== 'Tous' || searchQuery) && (
                <p className="font-mono text-sm text-muted-foreground mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
                  <span className="font-700 text-foreground">{filtered.length}</span> article{filtered.length > 1 ? 's' : ''}
                </p>
              )}
              {(!searchQuery && activeCategory === 'Tous') && nonFeaturedFiltered.length > 0 && (
                <h2 className="font-display font-700 text-xl text-foreground mb-5" style={{ fontFamily: 'var(--font-display)' }}>
                  Tous les articles
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeCategory !== 'Tous' || searchQuery ? filtered : nonFeaturedFiltered).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}

          {/* Newsletter CTA */}
          <div className="mt-16 rounded-2xl p-8 text-center border border-border bg-card">
            <p className="text-3xl mb-3">📬</p>
            <h3 className="font-display font-700 text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Restez informé
            </h3>
            <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
              Recevez nos meilleurs articles, comparatifs et bons plans équipement directement dans votre boîte mail.
            </p>
            <div className="flex gap-3 max-w-sm mx-auto">
              <input
                type="email"
                placeholder="votre@email.fr"
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary"
              />
              <button className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors whitespace-nowrap">
                S&apos;abonner
              </button>
            </div>
          </div>
        </div>
      </section>

      <TopoSeparator />
      <Footer />
    </div>
  );
}
