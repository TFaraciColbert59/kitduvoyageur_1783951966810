'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
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
      <article className="relative overflow-hidden rounded-2xl" style={{ height: 400 }}>
        <AppImage
          src={post.image}
          alt={post.image_alt}
          fill
          sizes="(max-width: 768px) 100vw, 60vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.92) 0%, rgba(28,38,32,0.3) 50%, transparent 100%)' }} />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-700 text-white" style={{ background: '#E4501C' }}>
            ⭐ À la une
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-7">
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono text-white mb-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
            {post.category}
          </span>
          <h2 className="font-display font-800 text-white text-2xl md:text-3xl leading-tight mb-2" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
            {post.title}
          </h2>
          <p className="text-white/70 text-sm line-clamp-2 mb-4">{post.excerpt}</p>
          <div className="flex items-center gap-3 text-white/50 text-xs font-mono">
            <span>{post.author}</span>
            <span>·</span>
            <span>{formatDate(post.published_at)}</span>
            <span>·</span>
            <span>{post.read_time} min</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/guides/${post.slug}`} className="group block h-full">
      <article className="h-full overflow-hidden rounded-2xl flex flex-col transition-all duration-300 group-hover:shadow-xl" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
        <div className="relative overflow-hidden flex-shrink-0" style={{ height: 200 }}>
          <AppImage
            src={post.image}
            alt={post.image_alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,38,32,0.5) 0%, transparent 60%)' }} />
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono text-white" style={{ background: 'rgba(28,38,32,0.7)' }}>
              {post.category}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col p-5">
          <h2 className="font-display font-700 text-base leading-snug mb-2 transition-colors group-hover:text-[#4A6741]" style={{ fontFamily: 'var(--font-display)', color: '#1C2620' }}>
            {post.title}
          </h2>
          <p className="text-sm line-clamp-2 flex-1 mb-4" style={{ color: '#5C6B5E' }}>{post.excerpt}</p>
          <div className="flex items-center justify-between text-xs font-mono" style={{ color: '#7A7A6E' }}>
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

  const featuredPosts = useMemo(() => posts.filter((p) => p.featured), [posts]);
  const filteredPosts = useMemo(() => {
    const nonFeatured = posts.filter((p) => !p.featured);
    return activeCategory === 'Tous' ? nonFeatured : nonFeatured.filter((p) => p.category === activeCategory);
  }, [posts, activeCategory]);

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1600&q=80')" }} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <a href="/" className="hover:text-white transition-colors">Accueil</a>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Blog</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Journal du voyageur</p>
          <h1 className="font-display text-5xl md:text-6xl text-white mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Le blog<br /><em>outdoor.</em>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mb-10">
            Conseils, guides et inspirations pour voyager léger et bien équipé.
          </p>
          <div className="flex flex-wrap gap-8 pt-8 border-t border-white/10">
            {[{ v: `${posts.length}`, l: 'Articles' }, { v: `${CATEGORIES.length - 1}`, l: 'Catégories' }, { v: 'Gratuit', l: 'Accès libre' }].map((s) => (
              <div key={s.l}>
                <p className="font-mono text-2xl font-700 text-white">{s.v}</p>
                <p className="text-xs text-white/40 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Featured */}
        {featuredPosts.length > 0 && (
          <section className="mb-16">
            <p className="text-xs font-mono tracking-[0.2em] uppercase mb-6" style={{ color: '#4A6741' }}>À la une</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredPosts.slice(0, 2).map((post) => (
                <FeaturedCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={activeCategory === cat
                ? { background: '#1C2620', color: '#fff' }
                : { background: '#fff', border: '1px solid #C8C3B0', color: '#5C6B5E' }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#7A7A6E' }}>
            <p className="text-lg font-display" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>Aucun article dans cette catégorie.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>

      <NewFooterSection />
    </div>
  );
}
