'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';


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
  content?: string;
  author?: { full_name: string };
  created_at: string;
}

const difficultyColor: Record<string, string> = {
  Débutant: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Intermédiaire: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Expert: 'text-red-500 bg-red-50 border-red-200',
};

export default function GuideDetailClient({ slug }: { slug: string }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadGuide() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('guides')
          .select('*, author:user_profiles!guides_author_id_fkey(full_name)')
          .eq('slug', slug)
          .single();

        if (error || !data) {
          setNotFoundState(true);
        } else {
          setGuide(data);
        }
      } catch {
        setNotFoundState(true);
      } finally {
        setLoading(false);
      }
    }
    loadGuide();
  }, [slug, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-64 bg-muted rounded-2xl" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-muted rounded" />)}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFoundState || !guide) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center">
          <div className="py-16">
            <Icon name="BookOpenIcon" size={48} className="mx-auto mb-4 text-foreground/20" variant="outline" />
            <h1 className="font-display text-2xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              Guide introuvable
            </h1>
            <p className="text-foreground/60 mb-6">Ce guide n&apos;existe pas ou a été supprimé.</p>
            <Link
              href="/guides"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all"
            >
              <Icon name="ArrowLeftIcon" size={14} variant="outline" />
              Voir tous les guides
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-foreground/40 mb-6">
          <Link href="/" className="hover:text-foreground/70 transition-colors">Accueil</Link>
          <Icon name="ChevronRightIcon" size={12} variant="outline" />
          <Link href="/guides" className="hover:text-foreground/70 transition-colors">Guides</Link>
          <Icon name="ChevronRightIcon" size={12} variant="outline" />
          <span className="text-foreground/60 truncate">{guide.title}</span>
        </nav>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-[10px] font-mono px-2 py-1 rounded bg-primary/10 text-primary uppercase tracking-wider">
            {guide.category}
          </span>
          <span className={`text-[10px] font-mono px-2 py-1 rounded border ${difficultyColor[guide.difficulty] ?? 'text-foreground/60 bg-muted border-border'}`}>
            {guide.difficulty}
          </span>
          <span className="text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground flex items-center gap-1">
            <Icon name="ClockIcon" size={10} variant="outline" />
            {guide.read_time} min de lecture
          </span>
          {guide.destination && (
            <span className="text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground flex items-center gap-1">
              <Icon name="MapPinIcon" size={10} variant="outline" />
              {guide.destination}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          {guide.title}
        </h1>

        {/* Excerpt */}
        <p className="text-foreground/70 text-lg leading-relaxed mb-8">{guide.excerpt}</p>

        {/* Hero image */}
        {guide.image && (
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={guide.image} alt={guide.alt} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        )}

        {/* Author & date */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="UserCircleIcon" size={20} className="text-primary" variant="outline" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{guide.author?.full_name ?? 'Équipe Le Kit du Voyageur'}</p>
            <p className="text-xs text-foreground/40">
              Publié le {new Date(guide.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Content */}
        {guide.content ? (
          <div className="prose prose-sm max-w-none text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: guide.content }} />
        ) : (
          <div className="space-y-6 text-foreground/80 leading-relaxed">
            <p>
              Ce guide complet vous accompagne dans la préparation de votre aventure en <strong className="text-foreground">{guide.destination}</strong>.
              Retrouvez tous les conseils essentiels pour partir bien équipé et en toute sécurité.
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="SparklesIcon" size={16} className="text-primary" variant="outline" />
                <span className="font-semibold text-foreground text-sm">Configurez votre kit pour {guide.destination}</span>
              </div>
              <p className="text-sm text-foreground/60 mb-4">
                Utilisez notre configurateur IA pour obtenir une liste d&apos;équipement personnalisée pour cette destination.
              </p>
              <Link
                href="/ai-configurator"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
              >
                <Icon name="SparklesIcon" size={14} variant="outline" />
                Lancer le configurateur
              </Link>
            </div>
          </div>
        )}

        {/* Tags */}
        {guide.tags && guide.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-border">
            {guide.tags.map((tag) => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-10">
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeftIcon" size={14} variant="outline" />
            Retour aux guides
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
