'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import AppImage from '@/components/ui/AppImage';
import { Card } from '@/components/ui';
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
    <Link href={`/guides/${post.slug}`} className="group block h-full">
      <Card as="article" tone="sage" variant="interactive" className="h-full">
        <div className="relative h-72 md:h-80 overflow-hidden">
          <AppImage
            src={post.image}
            alt={post.image_alt}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold tracking-widest uppercase text-[color:var(--lkv-primary)] bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] ">
              ⭐ À la une
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] rounded-sm px-3 py-2.5 ">
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-[rgba(91,127,85,0.14)] text-[color:var(--lkv-primary-soft)] border border-[rgba(91,127,85,0.30)] mb-2">
                {post.category}
              </span>
              <h2 className="font-display font-bold text-xl md:text-2xl leading-tight text-[color:var(--lkv-primary)] mb-1.5 group-hover:text-[color:var(--lkv-primary-soft)] transition-colors">
                {post.title}
              </h2>
              <p className="text-[color:var(--lkv-primary-soft)] text-sm line-clamp-2 mb-2">{post.excerpt}</p>
              <div className="flex items-center gap-3 text-[11px] font-mono text-[color:var(--lkv-text-secondary)]">
                <span>{post.author}</span>
                <span>·</span>
                <span>{formatDate(post.published_at)}</span>
                <span>·</span>
                <span>{post.read_time} min de lecture</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/guides/${post.slug}`} className="group block h-full">
      <Card as="article" tone="sage" variant="interactive" className="h-full flex flex-col">
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
            <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-mono text-[color:var(--lkv-primary)] bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] ">
              {post.category}
            </span>
          </div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-display font-bold text-[color:var(--lkv-primary)] text-base leading-tight mb-2 group-hover:text-[color:var(--lkv-primary-soft)] transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-[color:var(--lkv-text-secondary)] text-sm line-clamp-3 mb-4 flex-1">{post.excerpt}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="glass-pill text-[10px]">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--lkv-text-secondary)] border-t border-white/40 pt-3">
            <span>{formatDate(post.published_at)}</span>
            <span>{post.read_time} min</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function MobilePostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/guides/${post.slug}`} className="block no-underline">
      <article className="glass mb-[var(--space-3)] overflow-hidden">
        <div className="flex gap-[var(--space-3)] p-[var(--space-3)]">
          <div className="relative h-[90px] w-20 shrink-0 overflow-hidden rounded-[var(--lkv-radius-xs)] bg-[color:var(--stone-200)]">
            {post.image && (
              <AppImage src={post.image} alt={post.image_alt} fill sizes="80px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-bold text-[color:var(--lkv-primary)]">
                {post.category}
              </span>
              {post.featured && (
                <span className="rounded-[var(--lkv-radius-xs)] bg-[color:var(--lkv-surface-muted)] px-1.5 py-px text-[9px] text-[color:var(--lkv-primary)]">
                  A la une
                </span>
              )}
            </div>
            <h3 className="m-0 line-clamp-2 text-[14px] font-bold leading-[1.3] text-[color:var(--lkv-primary)]">
              {post.title}
            </h3>
            <p className="m-0 mt-1 line-clamp-2 text-[12px] leading-[1.4] text-[color:var(--lkv-text-secondary)]">
              {post.excerpt}
            </p>
            <div className="mt-1.5 flex items-center gap-[var(--space-2)] font-mono text-[10px] text-[color:var(--lkv-text-secondary)]">
              <span>{formatDate(post.published_at)}</span>
              <span>·</span>
              <span>{post.read_time} min</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function MobileFeaturedCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/guides/${post.slug}`} className="mb-[var(--space-4)] block no-underline">
      <article className="glass overflow-hidden">
        <div className="relative h-[180px] overflow-hidden bg-[color:var(--stone-200)]">
          {post.image && (
            <AppImage src={post.image} alt={post.image_alt} fill sizes="100vw" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-2 top-2">
            <span className="rounded-[var(--lkv-radius-xs)] bg-[color:var(--lkv-primary)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--lkv-text-inverted)]">
              A la une
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <span className="rounded-[var(--lkv-radius-xs)] border border-white/60 bg-white/90 px-1.5 py-0.5 font-mono text-[9px] text-[color:var(--lkv-primary)]">
              {post.category}
            </span>
            <h3 className="mb-0.5 mt-1.5 font-display text-[16px] font-extrabold leading-[1.2] text-[color:var(--lkv-text-inverted)]">
              {post.title}
            </h3>
            <p className="m-0 line-clamp-2 text-[12px] leading-[1.4] text-white/70">
              {post.excerpt}
            </p>
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

  const desktopContent = (
    <>
      {/* Hero */}
      <div className="mb-8">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--lkv-forest-100)] mb-2">
          BLOG — {posts.length} ARTICLES
        </p>
        <h1 className="font-display font-bold text-3xl tracking-tight text-[color:var(--lkv-surface)]">
          Conseils &amp; guides
        </h1>
        <p className="mt-1.5 text-sm text-[color:var(--lkv-forest-100)] max-w-2xl">
          Expertise terrain, comparatifs honnêtes et inspirations pour voyager mieux, plus léger et plus loin.
        </p>
      </div>

      {/* Search + Category filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--lkv-text-secondary)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un article…"
            className="glass-input w-full pl-9"
          />
        </div>
        <div className="glass-capsule-bar flex flex-nowrap overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`glass-capsule-segment flex-shrink-0 ${activeCategory === cat ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Featured posts */}
      {featured.length > 0 && activeCategory === 'Tous' && !searchQuery && (
        <div className="mb-10">
          <h2 className="font-display font-bold text-xl text-[color:var(--lkv-surface)] mb-4">
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
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📝</p>
          <h3 className="font-display font-bold text-xl text-[color:var(--lkv-surface)] mb-2">Aucun article trouvé</h3>
          <p className="text-[color:var(--lkv-forest-100)] mb-6">Essayez une autre catégorie ou un autre terme de recherche.</p>
          <button onClick={() => { setActiveCategory('Tous'); setSearchQuery(''); }} className="glass-capsule-btn primary">
            Voir tous les articles
          </button>
        </div>
      ) : (
        <>
          {(activeCategory !== 'Tous' || searchQuery) && (
            <p className="font-mono text-sm text-[color:var(--lkv-forest-100)] mb-6">
              <span className="font-bold text-[color:var(--lkv-surface)]">{filtered.length}</span> article{filtered.length > 1 ? 's' : ''}
            </p>
          )}
          {(!searchQuery && activeCategory === 'Tous') && nonFeaturedFiltered.length > 0 && (
            <h2 className="font-display font-bold text-xl text-[color:var(--lkv-surface)] mb-4">
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
      <div className="glass-sub-card mt-10 p-8 text-center">
        <p className="text-3xl mb-3">📬</p>
        <h3 className="font-display font-bold text-xl text-[color:var(--lkv-primary)] mb-2">
          Restez informé
        </h3>
        <p className="text-[color:var(--lkv-text-secondary)] text-sm mb-5 max-w-md mx-auto">
          Recevez nos meilleurs articles, comparatifs et bons plans équipement directement dans votre boîte mail.
        </p>
        <div className="flex gap-3 max-w-sm mx-auto">
          <input
            type="email"
            placeholder="votre@email.fr"
            aria-label="Votre adresse email"
            className="min-w-0 flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface)] px-3.5 py-2.5 text-[13px] text-[color:var(--lkv-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          />
          <button className="glass-capsule-btn primary whitespace-nowrap">
            S&apos;abonner
          </button>
        </div>
      </div>
    </>
  );

  const mobileContent = (
    <div className="p-[var(--space-4)]">
      {/* Hero */}
      <div className="mb-[var(--space-6)]">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--sage-100)]">
          BLOG — {posts.length} ARTICLES
        </p>
        <h1 className="m-0 font-display text-[22px] font-extrabold text-[color:var(--lkv-surface)]">
          Conseils & Guides
        </h1>
        <p className="mt-1.5 text-[13px] leading-normal text-[color:var(--lkv-forest-100)]">
          Expertise terrain, comparatifs honnetes et inspirations pour voyager mieux, plus leger et plus loin.
        </p>
      </div>

      {/* Search */}
      <div className="mb-[var(--space-4)]">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un article..."
          className="box-border w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--stone-100)] px-3.5 py-2.5 text-[14px] text-[color:var(--lkv-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        />
      </div>

      {/* Category filters */}
      <div className="scrollbar-hide mb-[var(--space-5)] flex gap-[var(--space-2)] overflow-x-auto pb-[var(--space-2)]">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`glass-capsule-segment flex-shrink-0 ${activeCategory === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured */}
      {featured.length > 0 && activeCategory === 'Tous' && !searchQuery && (
        <div className="mb-[var(--space-5)]">
          <h2 className="mb-[var(--space-3)] font-display text-[16px] font-bold text-[color:var(--lkv-surface)]">
            A la une
          </h2>
          {featured.slice(0, 1).map((post) => (
            <MobileFeaturedCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Posts list */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="mb-[var(--space-2)] text-[32px]">📝</p>
          <p className="mb-1 text-[16px] font-bold text-[color:var(--lkv-surface)]">Aucun article trouve</p>
          <p className="mb-[var(--space-4)] text-[13px] text-[color:var(--lkv-forest-100)]">Essayez une autre categorie ou un autre terme de recherche.</p>
          <button onClick={() => { setActiveCategory('Tous'); setSearchQuery(''); }}
            className="glass-capsule-btn primary !px-6 !py-2.5 !text-[13px]">
            Voir tous les articles
          </button>
        </div>
      ) : (
        <>
          {(activeCategory !== 'Tous' || searchQuery) && (
            <p className="mb-[var(--space-3)] font-mono text-[13px] text-[color:var(--lkv-forest-100)]">
              <strong className="text-[color:var(--lkv-surface)]">{filtered.length}</strong> article{filtered.length > 1 ? 's' : ''}
            </p>
          )}
          {(!searchQuery && activeCategory === 'Tous') && nonFeaturedFiltered.length > 0 && (
            <h2 className="mb-[var(--space-3)] font-display text-[16px] font-bold text-[color:var(--lkv-surface)]">
              Tous les articles
            </h2>
          )}
          <div>
            {(activeCategory !== 'Tous' || searchQuery ? filtered : nonFeaturedFiltered).map((post) => (
              <MobilePostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      )}

      {/* Newsletter */}
      <div className="glass mt-[var(--space-6)] p-[var(--space-5)] text-center">
        <p className="mb-[var(--space-2)] text-[28px]">📬</p>
        <h3 className="mb-[var(--space-2)] font-display text-[16px] font-bold text-[color:var(--lkv-primary)]">
          Restez informe
        </h3>
        <p className="mb-[var(--space-4)] text-[13px] leading-normal text-[color:var(--lkv-text-secondary)]">
          Recevez nos meilleurs articles, comparatifs et bons plans equipement directement dans votre boite mail.
        </p>
        <div className="flex gap-[var(--space-2)]">
          <input
            type="email"
            placeholder="votre@email.fr"
            aria-label="Votre adresse email"
            className="min-w-0 flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface)] px-3.5 py-2.5 text-[13px] text-[color:var(--lkv-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          />
          <button className="glass-capsule-btn primary !px-4 !py-2.5 !text-[13px] whitespace-nowrap">
            S&apos;abonner
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP ── fullscreen, scroll interne */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-transparent" data-lkv-material-theme="light">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
            {desktopContent}
          </div>
        </main>
        <Footer />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {mobileContent}
        </MobilePageShell>
      </div>
    </>
  );
}
