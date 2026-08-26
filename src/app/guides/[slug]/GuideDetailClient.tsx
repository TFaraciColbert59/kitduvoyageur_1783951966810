'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
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

  const difficulty = guide?.difficulty || '';
  const diffClass = difficultyColor[difficulty] || 'glass-pill';

  const desktopLoading = (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
      <div className="animate-pulse space-y-6">
        <div className="h-4 glass-sub-card rounded w-32" />
        <div className="h-8 glass-sub-card rounded w-3/4" />
        <div className="h-64 glass-sub-card rounded-[24px]" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 glass-sub-card rounded" />)}
        </div>
      </div>
    </div>
  );

  const desktopNotFound = (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 text-center">
      <div className="py-16">
        <Icon name="BookOpenIcon" size={48} className="mx-auto mb-4 text-[#5A7064]" variant="outline" />
        <h1 className="font-display font-bold text-2xl text-[#17402C] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          Guide introuvable
        </h1>
        <p className="text-[#5A7064] mb-6">Ce guide n&apos;existe pas ou a été supprimé.</p>
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[#5A7064] mb-6">
        <Link href="/" className="hover:text-[#17402C] transition-colors">Accueil</Link>
        <Icon name="ChevronRightIcon" size={12} variant="outline" />
        <Link href="/guides" className="hover:text-[#17402C] transition-colors">Guides</Link>
        <Icon name="ChevronRightIcon" size={12} variant="outline" />
        <span className="text-[#17402C] truncate">{guide.title}</span>
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
      <h1 className="font-display font-bold text-3xl md:text-4xl text-[#17402C] mb-4 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
        {guide.title}
      </h1>

      {/* Excerpt */}
      <p className="text-[#365233] text-lg leading-relaxed mb-8">{guide.excerpt}</p>

      {/* Hero image */}
      {guide.image && (
        <div className="glass rounded-[24px] overflow-hidden mb-10 relative h-72 md:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={guide.image} alt={guide.alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      {/* Author & date */}
      <div className="flex items-center gap-3 mb-8 pb-8 border-b border-white/40">
        <div className="w-9 h-9 rounded-full bg-[#5B7F55] flex items-center justify-center text-white">
          <Icon name="UserCircleIcon" size={20} variant="outline" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#17402C]">{guide.author?.full_name ?? 'Équipe Le Kit du Voyageur'}</p>
          <p className="text-xs text-[#5A7064]">
            Publié le {new Date(guide.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      {guide.content ? (
        <div className="prose prose-sm max-w-none text-[#365233] leading-relaxed" dangerouslySetInnerHTML={{ __html: guide.content }} />
      ) : (
        <div className="space-y-6 text-[#365233] leading-relaxed">
          <p>
            Ce guide complet vous accompagne dans la préparation de votre aventure en <strong className="text-[#17402C]">{guide.destination}</strong>.
            Retrouvez tous les conseils essentiels pour partir bien équipé et en toute sécurité.
          </p>
          <div className="glass-sub-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="SparklesIcon" size={16} className="text-[#5B7F55]" variant="outline" />
              <span className="font-semibold text-[#17402C] text-sm">Configurez votre kit pour {guide.destination}</span>
            </div>
            <p className="text-sm text-[#5A7064] mb-4">
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
          className="inline-flex items-center gap-2 text-sm text-[#5A7064] hover:text-[#17402C] transition-colors"
        >
          <Icon name="ArrowLeftIcon" size={14} variant="outline" />
          Retour aux guides
        </Link>
      </div>
    </div>
  ) : null;

  const mobileLoading = (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(23,64,44,0.12)', borderTopColor: '#17402C', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: '13px', color: '#5A7064', marginTop: '12px' }}>Chargement du guide...</p>
    </div>
  );

  const mobileNotFound = (
    <div style={{ padding: '16px', textAlign: 'center', paddingTop: '60px' }}>
      <p style={{ fontSize: '40px', marginBottom: '12px' }}>📖</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: '#17402C', marginBottom: '8px' }}>
        Guide introuvable
      </h1>
      <p style={{ fontSize: '14px', color: '#5A7064', marginBottom: '24px' }}>Ce guide n&apos;existe pas ou a ete supprime.</p>
      <Link href="/guides" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#17402C', color: '#fff', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
        Voir tous les guides
      </Link>
    </div>
  );

  const mobileDetail = guide ? (
    <div style={{ padding: '16px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#5A7064', marginBottom: '12px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <Link href="/" style={{ color: '#5A7064', textDecoration: 'none' }}>Accueil</Link>
        <span>/</span>
        <Link href="/guides" style={{ color: '#5A7064', textDecoration: 'none' }}>Guides</Link>
        <span>/</span>
        <span style={{ color: '#17402C', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guide.title}</span>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: '#EDF3ED', color: '#17402C', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {guide.category}
        </span>
        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontFamily: 'ui-monospace, monospace', border: '1px solid rgba(23,64,44,0.08)', background: '#F4F1EA', color: '#5A7064' }}>
          {guide.difficulty}
        </span>
        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontFamily: 'ui-monospace, monospace', background: '#F4F1EA', color: '#5A7064' }}>
          {guide.read_time} min
        </span>
        {guide.destination && (
          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontFamily: 'ui-monospace, monospace', background: '#F4F1EA', color: '#5A7064' }}>
            {guide.destination}
          </span>
        )}
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: '#17402C', margin: '0 0 8px 0', lineHeight: 1.2 }}>
        {guide.title}
      </h1>

      <p style={{ fontSize: '14px', color: '#365233', lineHeight: 1.6, marginBottom: '16px' }}>{guide.excerpt}</p>

      {/* Image */}
      {guide.image && (
        <div style={{ position: 'relative', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', background: '#E8E4D8' }}>
          <img src={guide.image} alt={guide.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(23,64,44,0.08)' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EDF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#17402C' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#17402C', margin: 0 }}>{guide.author?.full_name ?? 'Equipe Le Kit du Voyageur'}</p>
          <p style={{ fontSize: '11px', color: '#5A7064', margin: 0 }}>
            Publie le {new Date(guide.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ fontSize: '14px', color: '#17402C', lineHeight: 1.7 }}>
        {guide.content ? (
          <div dangerouslySetInnerHTML={{ __html: guide.content }} />
        ) : (
          <div>
            <p>
              Ce guide complet vous accompagne dans la preparation de votre aventure en <strong>{guide.destination}</strong>.
              Retrouvez tous les conseils essentiels pour partir bien equipe et en toute securite.
            </p>
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', background: '#EDF3ED', border: '1px solid rgba(23,64,44,0.2)' }}>
              <p style={{ fontWeight: 600, fontSize: '14px', color: '#17402C', marginBottom: '8px' }}>
                Configurez votre kit pour {guide.destination}
              </p>
              <p style={{ fontSize: '13px', color: '#5A7064', marginBottom: '12px' }}>
                Utilisez notre configurateur IA pour obtenir une liste d&apos;equipement personnalisee.
              </p>
              <Link href="/ai-configurator" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#17402C', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                Lancer le configurateur
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {guide.tags && guide.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(23,64,44,0.08)' }}>
          {guide.tags.map((tag) => (
            <span key={tag} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: '#F4F1EA', color: '#5A7064' }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Back link */}
      <div style={{ marginTop: '24px' }}>
        <Link href="/guides" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A7064', textDecoration: 'none' }}>
          ← Retour aux guides
        </Link>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* ── DESKTOP ── fullscreen, scroll interne */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-[#FAF8F5]" data-lkv-material-theme="light">
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
