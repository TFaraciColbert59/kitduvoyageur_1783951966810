'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Spinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';


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
  Débutant: 'glass-pill',
  Intermédiaire: 'glass-pill pill-warn',
  Expert: 'glass-pill pill-danger',
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
          .select('*')
          .eq('slug', slug)
          .single();

        if (error || !data) {
          setNotFoundState(true);
        } else {
          // F1 — auteur via la vue `public_profiles` (deux étapes, sans embed).
          const profile = data.author_id
            ? (await fetchPublicProfilesWith(supabase, [data.author_id as string]))[
                data.author_id as string
              ]
            : undefined;
          setGuide({
            ...(data as Guide),
            author: profile ? { full_name: profile.full_name ?? '' } : undefined,
          });
        }
      } catch {
        setNotFoundState(true);
      } finally {
        setLoading(false);
      }
    }
    loadGuide();
  }, [slug, supabase]);

  const difficulty = guide?.difficulty || '';
  const diffClass = difficultyColor[difficulty] || 'glass-pill';

  const desktopLoading = (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
      <div className="animate-pulse space-y-6">
        <div className="h-4 glass-sub-card rounded w-32" />
        <div className="h-8 glass-sub-card rounded w-3/4" />
        <div className="h-64 glass-sub-card rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 glass-sub-card rounded" />)}
        </div>
      </div>
    </div>
  );

  const desktopNotFound = (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 text-center">
      <div className="py-16 glass rounded-xl">
        <Icon name="BookOpenIcon" size={48} className="mx-auto mb-4 text-[color:var(--lkv-text-secondary)]" variant="outline" />
        <h1 className="font-display font-bold text-2xl text-[color:var(--lkv-primary)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          Guide introuvable
        </h1>
        <p className="text-[color:var(--lkv-text-secondary)] mb-6">Ce guide n&apos;existe pas ou a été supprimé.</p>
        <Link
          href="/guides"
          className="glass-capsule-btn primary"
        >
          <Icon name="ArrowLeftIcon" size={14} variant="outline" />
          Voir tous les guides
        </Link>
      </div>
    </div>
  );

  const desktopDetail = guide ? (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
      <div className="glass rounded-xl p-6 sm:p-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[color:var(--lkv-text-secondary)] mb-6">
        <Link href="/" className="hover:text-[color:var(--lkv-primary)] transition-colors">Accueil</Link>
        <Icon name="ChevronRightIcon" size={12} variant="outline" />
        <Link href="/guides" className="hover:text-[color:var(--lkv-primary)] transition-colors">Guides</Link>
        <Icon name="ChevronRightIcon" size={12} variant="outline" />
        <span className="text-[color:var(--lkv-primary)] truncate">{guide.title}</span>
      </nav>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="glass-pill">
          {guide.category}
        </span>
        <span className={diffClass}>
          {guide.difficulty}
        </span>
        <span className="glass-pill">
          <Icon name="ClockIcon" size={12} variant="outline" />
          {guide.read_time} min de lecture
        </span>
        {guide.destination && (
          <span className="glass-pill">
            <Icon name="MapPinIcon" size={12} variant="outline" />
            {guide.destination}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="font-display font-bold text-3xl md:text-4xl text-[color:var(--lkv-primary)] mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
        {guide.title}
      </h1>

      {/* Excerpt */}
      <p className="text-[color:var(--lkv-primary-soft)] text-lg leading-relaxed mb-8">{guide.excerpt}</p>

      {/* Hero image */}
      {guide.image && (
        <div className="glass rounded-xl overflow-hidden mb-10 relative h-72 md:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={guide.image} alt={guide.alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      {/* Author & date */}
      <div className="flex items-center gap-3 mb-8 pb-8 border-b border-white/40">
        <div className="w-9 h-9 rounded-full bg-[color:var(--lkv-secondary)] flex items-center justify-center text-white">
          <Icon name="UserCircleIcon" size={20} variant="outline" />
        </div>
        <div>
          <p className="text-sm font-medium text-[color:var(--lkv-primary)]">{guide.author?.full_name ?? 'Équipe Le Kit du Voyageur'}</p>
          <p className="text-xs text-[color:var(--lkv-text-secondary)]">
            Publié le {new Date(guide.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      {guide.content ? (
        <div className="prose prose-sm max-w-none text-[color:var(--lkv-primary-soft)] leading-relaxed" dangerouslySetInnerHTML={{ __html: guide.content }} />
      ) : (
        <div className="space-y-6 text-[color:var(--lkv-primary-soft)] leading-relaxed">
          <p>
            Ce guide complet vous accompagne dans la préparation de votre aventure en <strong className="text-[color:var(--lkv-primary)]">{guide.destination}</strong>.
            Retrouvez tous les conseils essentiels pour partir bien équipé et en toute sécurité.
          </p>
          <div className="glass-sub-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="SparklesIcon" size={16} className="text-[color:var(--lkv-secondary)]" variant="outline" />
              <span className="font-semibold text-[color:var(--lkv-primary)] text-sm">Configurez votre kit pour {guide.destination}</span>
            </div>
            <p className="text-sm text-[color:var(--lkv-text-secondary)] mb-4">
              Utilisez notre configurateur IA pour obtenir une liste d&apos;équipement personnalisée pour cette destination.
            </p>
            <Link
              href="/ai-configurator"
              className="glass-capsule-btn primary"
            >
              <Icon name="SparklesIcon" size={14} variant="outline" />
              Lancer le configurateur
            </Link>
          </div>
        </div>
      )}

      {/* Tags */}
      {guide.tags && guide.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-white/40">
          {guide.tags.map((tag) => (
            <span key={tag} className="glass-pill text-[11px]">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Back link */}
      <div className="mt-10">
        <Link
          href="/guides"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--lkv-text-secondary)] hover:text-[color:var(--lkv-primary)] transition-colors"
        >
          <Icon name="ArrowLeftIcon" size={14} variant="outline" />
          Retour aux guides
        </Link>
      </div>
      </div>
    </div>
  ) : null;

  const mobileLoading = (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center p-[var(--space-4)]">
      <Spinner size="lg" />
      <p className="mt-[var(--space-3)] text-[13px] text-[color:var(--lkv-text-secondary)]">Chargement du guide...</p>
    </div>
  );

  const mobileNotFound = (
    <div className="p-[var(--space-4)] pt-[60px] text-center">
      <p className="mb-[var(--space-3)] text-[40px]" aria-hidden="true">📖</p>
      <h1 className="mb-[var(--space-2)] font-display text-[20px] font-extrabold text-[color:var(--lkv-primary)]">
        Guide introuvable
      </h1>
      <p className="mb-[var(--space-6)] text-[14px] text-[color:var(--lkv-text-secondary)]">Ce guide n&apos;existe pas ou a été supprimé.</p>
      <Link href="/guides">
        <Button>Voir tous les guides</Button>
      </Link>
    </div>
  );

  const mobileDetail = guide ? (
    <div className="p-[var(--space-4)]">
      <Card variant="standard" className="p-[var(--space-4)]">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="mb-[var(--space-3)] flex items-center gap-[6px] overflow-hidden whitespace-nowrap text-[11px] text-[color:var(--lkv-text-secondary)]">
        <Link href="/" className="text-[color:var(--lkv-text-secondary)] no-underline">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link href="/guides" className="text-[color:var(--lkv-text-secondary)] no-underline">Guides</Link>
        <span aria-hidden="true">/</span>
        <span className="overflow-hidden text-ellipsis text-[color:var(--lkv-primary)]">{guide.title}</span>
      </nav>

      {/* Badges */}
      <div className="mb-[var(--space-3)] flex flex-wrap gap-[6px]">
        <Badge tone="sage" className="font-mono uppercase tracking-[0.05em]">{guide.category}</Badge>
        <Badge className="font-mono">{guide.difficulty}</Badge>
        <Badge className="font-mono">{guide.read_time} min</Badge>
        {guide.destination && <Badge className="font-mono">{guide.destination}</Badge>}
      </div>

      <h1 className="mb-[var(--space-2)] font-display text-[22px] font-extrabold leading-[var(--leading-tight)] text-[color:var(--lkv-primary)]">
        {guide.title}
      </h1>

      <p className="mb-[var(--space-4)] text-[14px] leading-[var(--leading-relaxed)] text-[color:var(--lkv-primary-soft)]">{guide.excerpt}</p>

      {/* Image */}
      {guide.image && (
        <div className="relative mb-[var(--space-4)] h-[200px] overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--stone-200)]">
          <img src={guide.image} alt={guide.alt} className="h-full w-full object-cover" />
        </div>
      )}

      {/* Author */}
      <div className="mb-[var(--space-4)] flex items-center gap-[10px] border-b border-[color:var(--lkv-border-subtle)] pb-[var(--space-4)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lkv-surface-muted)] text-[14px] text-[color:var(--lkv-primary)]" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <p className="m-0 text-[13px] font-semibold text-[color:var(--lkv-primary)]">{guide.author?.full_name ?? 'Équipe Le Kit du Voyageur'}</p>
          <p className="m-0 text-[11px] text-[color:var(--lkv-text-secondary)]">
            Publié le {new Date(guide.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="text-[14px] leading-[1.7] text-[color:var(--lkv-primary)]">
        {guide.content ? (
          <div dangerouslySetInnerHTML={{ __html: guide.content }} />
        ) : (
          <div>
            <p>
              Ce guide complet vous accompagne dans la préparation de votre aventure en <strong>{guide.destination}</strong>.
              Retrouvez tous les conseils essentiels pour partir bien équipé et en toute sécurité.
            </p>
            <Card variant="compact" className="mt-[var(--space-4)] p-[var(--space-4)]">
              <p className="mb-[var(--space-2)] text-[14px] font-semibold text-[color:var(--lkv-primary)]">
                Configurez votre kit pour {guide.destination}
              </p>
              <p className="mb-[var(--space-3)] text-[13px] text-[color:var(--lkv-text-secondary)]">
                Utilisez notre configurateur IA pour obtenir une liste d&apos;équipement personnalisée.
              </p>
              <Link href="/ai-configurator">
                <Button size="sm">Lancer le configurateur</Button>
              </Link>
            </Card>
          </div>
        )}
      </div>

      {/* Tags */}
      {guide.tags && guide.tags.length > 0 && (
        <div className="mt-[var(--space-6)] flex flex-wrap gap-[6px] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)]">
          {guide.tags.map((tag) => (
            <Badge key={tag} className="font-normal">#{tag}</Badge>
          ))}
        </div>
      )}

      {/* Back link */}
      <div className="mt-[var(--space-6)]">
        <Link href="/guides" className="inline-flex items-center gap-[6px] text-[13px] text-[color:var(--lkv-text-secondary)] no-underline hover:text-[color:var(--lkv-primary)]">
          ← Retour aux guides
        </Link>
      </div>
      </Card>
    </div>
  ) : null;

  return (
    <>
      {/* ── DESKTOP ── fullscreen, scroll interne */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-[color:var(--lkv-surface)]" data-lkv-material-theme="light">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto">
          {loading ? desktopLoading : notFoundState || !guide ? desktopNotFound : desktopDetail}
        </main>
        <Footer />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {loading ? mobileLoading : notFoundState || !guide ? mobileNotFound : mobileDetail}
        </MobilePageShell>
      </div>
    </>
  );
}
