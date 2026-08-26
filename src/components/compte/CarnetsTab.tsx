'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/mock/compte-marceline';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CarnetDB {
  id: string;
  title: string;
  visibility: 'public' | 'private' | 'link';
  cover_image: string | null;
  description: string | null;
  created_at: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  // Mock fields for UI purposes
  status?: 'published' | 'draft';
  chapters_count?: number;
  word_count?: number;
  draft_progress?: number;
  published_at?: string;
  slug?: string;
}

interface FideleReader {
  id: string;
  full_name: string;
  avatar_url: string | null;
  location: string | null;
  carnets_read?: number;
}

interface RythmeMonth {
  month: string;
  short: string;
  count: number;
  current: boolean;
}

type SortMode = 'recent' | 'vues' | 'aimes';

interface CarnetsTabProps {
  profile: UserProfile;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function buildEmptyMonths(): RythmeMonth[] {
  const now = new Date();
  const months: RythmeMonth[] = [];
  for (let i = 10; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      short: MONTHS_SHORT[d.getMonth()],
      count: 0,
      current: i === 0,
    });
  }
  return months;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')} k` : String(n);
}

const FALLBACK_COVERS = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=600&q=80',
];

// ─────────────────────────────────────────────
// CarnetsTab
// ─────────────────────────────────────────────
export default function CarnetsTab({ profile }: CarnetsTabProps) {
  const router = useRouter();
  const supabase = createClient();

  // --- state ---
  const [published, setPublished] = useState<CarnetDB[]>([]);
  const [drafts, setDrafts] = useState<CarnetDB[]>([]);
  const [fideles, setFideles] = useState<FideleReader[]>([]);
  const [rythme, setRythme] = useState<RythmeMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // stats
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);

  // ─── data fetching ────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1 – Only ever show the authenticated user's own carnets
      let dbCarnets: any[] = [];
      if (!user) {
        setPublished([]);
        setDrafts([]);
        setRythme(buildEmptyMonths());
        setLoading(false);
        return;
      }

      const { data: userCarnets } = await supabase
        .from('carnets')
        .select(`
          id, title, visibility, cover_image, description,
          created_at, views_count, likes_count, comments_count
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (userCarnets && userCarnets.length > 0) {
        dbCarnets = userCarnets;
      }

      let parsedCarnets: CarnetDB[] = [];
      if (dbCarnets && dbCarnets.length > 0) {
        // The schema has no status column yet: private visibility is treated as a draft.
        // chapters_count / word_count / draft_progress have no real source column and
        // are intentionally left undefined rather than fabricated.
        parsedCarnets = dbCarnets.map((c: any) => {
          const isDraft = c.visibility === 'private';
          return {
            ...c,
            status: isDraft ? 'draft' : 'published',
            chapters_count: undefined,
            word_count: undefined,
            draft_progress: undefined,
            published_at: isDraft ? null : c.created_at,
            slug: c.id
          };
        });
        const pub = parsedCarnets.filter(c => c.status === 'published');
        const drft = parsedCarnets.filter(c => c.status === 'draft');
        setPublished(pub.length > 0 ? pub : parsedCarnets);
        setDrafts(drft);
        setTotalViews(parsedCarnets.reduce((s, c) => s + (c.views_count || 0), 0));
        setTotalLikes(parsedCarnets.reduce((s, c) => s + (c.likes_count || 0), 0));
        setTotalComments(parsedCarnets.reduce((s, c) => s + (c.comments_count || 0), 0));
      }

      // 2 – Lecteurs fidèles (top 5 followers who liked/viewed)
      if (user) {
        const { data: followers } = await supabase
          .from('user_follows')
          .select('follower_id, follower:user_profiles!user_follows_follower_id_fkey(id, full_name, avatar_url, location)')
          .eq('following_id', user.id)
          .limit(5);

        if (followers) {
          const mapped: FideleReader[] = followers.map((f: any, i: number) => ({
            id: f.follower?.id || i,
            full_name: f.follower?.full_name || 'Voyageur',
            avatar_url: f.follower?.avatar_url || null,
            location: f.follower?.location || null,
            // No read-count column exists: left undefined rather than fabricated
            carnets_read: undefined,
          }));
          setFideles(mapped);
        }
      }

      // 3 – Rythme (publications par mois sur les 11 derniers mois + mois courant)
      const months: RythmeMonth[] = buildEmptyMonths();
      // Count publications per month
      if (parsedCarnets) {
        parsedCarnets.filter(c => c.status === 'published' && c.published_at).forEach(c => {
          const m = (c.published_at || c.created_at).slice(0, 7);
          const entry = months.find(mo => mo.month === m);
          if (entry) entry.count++;
        });
      }
      setRythme(months);

    } catch (err) {
      console.error('CarnetsTab fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── sort published carnets ───────────────
  const sortedPublished = [...published].sort((a, b) => {
    if (sortMode === 'vues') return (b.views_count || 0) - (a.views_count || 0);
    if (sortMode === 'aimes') return (b.likes_count || 0) - (a.likes_count || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // ─── delete draft ─────────────────────────
  async function handleDeleteDraft(id: string) {
    if (!confirm('Supprimer ce brouillon définitivement ?')) return;
    await supabase.from('carnets').delete().eq('id', id);
    setDrafts(prev => prev.filter(d => d.id !== id));
  }

  // ─── publish draft ─────────────────────────
  async function handlePublish(id: string) {
    const { error } = await supabase.from('carnets').update({
      visibility: 'public'
    }).eq('id', id);
    if (!error) await fetchData();
  }

  // ─────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────
  const StatPill = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="glass rounded-[1.25rem] p-5 flex flex-col gap-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[#5A7064]">{label}</p>
      <p className="glass-metric text-3xl sm:text-4xl text-[#17402C] leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#5A7064] font-medium mt-0.5">{sub}</p>}
    </div>
  );

  // ─── loading skeleton ─────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
        <div className="lg:col-span-4 space-y-6">
          <div className="glass rounded-2xl h-48 animate-pulse" />
          <div className="glass rounded-2xl h-48 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#17402C]/5 pb-5">
        <div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#17402C] tracking-tight">
            Carnets <span className="font-serif italic font-normal text-[#365233]">de route</span>
          </h2>
          <p className="text-xs text-[#5A7064] mt-1 font-mono">
            {published.length} récits publiés · {fmtNum(totalViews)} lectures · {totalLikes} mentions j'aime
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/carnets/brouillons"
            className="glass-capsule-btn text-xs font-bold"
          >
            <Icon name="DocumentTextIcon" size={14} />
            <span>Brouillons ({drafts.length})</span>
          </Link>
          <Link
            href="/carnets/nouveau"
            className="glass-capsule-btn primary text-xs font-bold"
          >
            <Icon name="PlusIcon" size={14} />
            <span>+ Rédiger un carnet</span>
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatPill label="Récits publiés" value={published.length} sub={`Sur ${published.length + drafts.length} carnets`} />
        <StatPill label="Lectures cumulées" value={fmtNum(totalViews)} sub="Par la communauté" />
        <StatPill label="Mentions j'aime" value={fmtNum(totalLikes)} sub={`${totalComments} commentaires`} />
        <StatPill label="Brouillons actifs" value={drafts.length} sub={drafts.length ? 'En cours de rédaction' : 'Tous publiés !'} />
      </div>

      {/* ── Main Layout Stack ── */}
      <div className="space-y-6">
        {/* ── Publications Grille ── */}
        <div className="glass rounded-[1.5rem] p-5 sm:p-6 space-y-5 border border-white/50 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-[#17402C]">
                Récits <span className="font-serif italic font-normal text-[#5B7F55]">publiés</span>
              </h3>
              <p className="text-xs text-[#5A7064] mt-0.5">Visibles par les membres de la communauté</p>
            </div>

            {/* Sort pills */}
            <div className="glass-capsule-bar">
              <div className="flex items-center gap-1 p-0.5">
                {(['recent', 'vues', 'aimes'] as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={`glass-capsule-segment !px-3 !py-1 text-xs ${sortMode === mode ? 'active' : ''}`}
                  >
                    {mode === 'recent' ? 'Récents' : mode === 'vues' ? 'Plus lus' : 'Plus aimés'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {sortedPublished.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/40 flex items-center justify-center mx-auto text-xl">
                📖
              </div>
              <p className="text-sm font-bold text-[#17402C]">Aucun carnet publié</p>
              <p className="text-xs text-[#5A7064]">Partagez votre première aventure avec la communauté.</p>
              <Link
                href="/carnets/nouveau"
                className="glass-capsule-btn primary inline-flex text-xs font-bold mt-2"
              >
                Commencer à écrire
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPublished.map((carnet, i) => (
                <CarnetCard key={carnet.id} carnet={carnet} isNew={i === 0} />
              ))}
            </div>
          )}
        </div>

        {/* ── Brouillons Section ── */}
        {drafts.length > 0 && (
          <div className="glass rounded-[1.5rem] p-5 sm:p-6 space-y-4 border border-white/50 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-lg sm:text-xl text-[#17402C]">
                  Brouillons <span className="font-serif italic font-normal text-[#5B7F55]">en cours</span>
                </h3>
                <p className="text-xs text-[#5A7064] mt-0.5">Privés — vous seul pouvez les voir</p>
              </div>
              <span className="glass-pill pill-warn text-xs font-mono font-bold">
                {drafts.length} en cours
              </span>
            </div>

            <div className="space-y-2.5">
              {drafts.map((d, i) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  idx={i}
                  onDelete={handleDeleteDraft}
                  onPublish={handlePublish}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Insights Row: Rythme + Lecteurs fidèles ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* ── Rythme de publication ── */}
          <div className="glass rounded-[1.5rem] p-5 space-y-3.5 border border-white/50 shadow-sm">
            <div>
              <h3 className="font-display font-bold text-base text-[#17402C]">
                Rythme <span className="font-serif italic font-normal text-[#5B7F55]">de publication</span>
              </h3>
              <p className="text-[11px] text-[#5A7064]">Activité sur 12 mois</p>
            </div>

            <div className="flex items-end justify-between gap-1.5 h-20 pt-2">
              {rythme.map((m) => {
                const maxCount = Math.max(...rythme.map((x) => x.count), 1);
                const h = m.count === 0 ? 4 : Math.max(12, Math.round((m.count / maxCount) * 48));
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        m.current
                          ? 'bg-[#17402C]'
                          : m.count > 0
                          ? 'bg-[#5B7F55]'
                          : 'bg-[#17402C]/10'
                      }`}
                      style={{ height: `${h}px` }}
                    />
                    <span className={`text-[8px] font-mono ${m.current ? 'font-bold text-[#17402C]' : 'text-[#5A7064]'}`}>
                      {m.short}
                    </span>
                    {m.count > 0 && (
                      <span className="absolute -top-4 text-[9px] font-mono font-bold text-[#17402C] opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Lecteurs fidèles ── */}
          <div className="glass rounded-[1.5rem] p-5 space-y-3.5 border border-white/50 shadow-sm">
            <div>
              <h3 className="font-display font-bold text-base text-[#17402C]">
                Lecteurs <span className="font-serif italic font-normal text-[#5B7F55]">fidèles</span>
              </h3>
              <p className="text-[11px] text-[#5A7064]">Membres les plus engagés</p>
            </div>

            {fideles.length === 0 ? (
              <p className="text-xs text-[#5A7064] text-center py-4">Pas encore d'abonnés enregistrés.</p>
            ) : (
              <div className="space-y-2">
                {fideles.slice(0, 3).map((f) => (
                  <div key={f.id} className="glass-sub-card flex items-center justify-between p-2 rounded-xl border border-white/40">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#17402C] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {f.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#17402C] truncate">{f.full_name}</p>
                        <p className="text-[9.5px] text-[#5A7064] truncate">{f.location || 'Alpes françaises'}</p>
                      </div>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold">Fidèle</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function CarnetCard({ carnet, isNew }: { carnet: CarnetDB; isNew: boolean }) {
  const router = useRouter();
  const cover = carnet.cover_image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80';

  return (
    <div
      onClick={() => router.push(`/carnets/${carnet.slug || carnet.id}`)}
      className="glass-sub-card rounded-2xl overflow-hidden transition-all cursor-pointer flex flex-col hover:border-[#17402C]/20"
    >
      {/* Cover */}
      <div className="relative h-44 overflow-hidden">
        <Image
          src={cover}
          alt={carnet.title}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Status badge */}
        <div className="absolute top-3 left-3">
          {isNew ? (
            <span className="glass-pill !bg-[#17402C] !text-white text-[10px] font-bold uppercase tracking-wider">
              Nouveau
            </span>
          ) : (
            <span className="glass-pill text-[10px] font-bold uppercase tracking-wider">
              Publié
            </span>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Title on image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className="font-display font-bold text-white text-sm leading-tight line-clamp-2">
            {carnet.title}
          </h4>
          <p className="text-white/70 text-[10px] font-mono mt-1">
            {carnet.published_at ? `Publié le ${formatDate(carnet.published_at)}` : 'Publié récemment'}
          </p>
        </div>
      </div>

      {/* Stats footer */}
      <div className="px-4 py-3 flex items-center justify-between text-xs font-mono font-bold text-[#5A7064]">
        <span className="flex items-center gap-1.5 text-[#5B7F55]">
          <Icon name="HeartIcon" size={13} />
          {fmtNum(carnet.likes_count || 0)}
        </span>
        <span className="flex items-center gap-1.5 text-[#5A7064]">
          <Icon name="EyeIcon" size={13} />
          {fmtNum(carnet.views_count || 0)}
        </span>
        <span className="flex items-center gap-1.5 text-[#4B6B7C]">
          <Icon name="ChatBubbleLeftIcon" size={13} />
          {fmtNum(carnet.comments_count || 0)}
        </span>
      </div>
    </div>
  );
}

function DraftRow({
  draft, idx, onDelete, onPublish
}: {
  draft: CarnetDB;
  idx: number;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}) {
  const router = useRouter();
  // No real progress source exists for drafts yet: only render the bar when real data is present
  const progress = typeof draft.draft_progress === 'number' ? draft.draft_progress : null;
  const progressColor = progress !== null ? (progress >= 80 ? '#22C55E' : progress >= 50 ? '#17402C' : '#C8C3B0') : '#C8C3B0';
  const roman = ['I', 'II', 'III', 'IV', 'V'][idx] || String(idx + 1);

  return (
    <div className="px-5 py-4 hover:bg-[#FAFAF7] transition-colors group">
      <div className="flex items-start gap-4">
        {/* Roman numeral */}
        <span className="font-serif italic text-[#C8C3B0] text-lg leading-none mt-0.5 flex-shrink-0 w-6 text-center">
          {roman}
        </span>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h5 className="font-600 text-sm text-[#17402C] truncate group-hover:text-[#17402C] transition-colors">
                {draft.title || 'Brouillon sans titre'}
              </h5>
              <p className="text-[11px] text-[#5A7064] mt-0.5">
                {(draft as any).travel_group && `Groupe · ${((draft as any).travel_group as any).name} · `}
                {draft.chapters_count ? `${draft.chapters_count} chapitres` : 'En cours de rédaction'}
                {draft.word_count ? ` · ${draft.word_count.toLocaleString('fr')} mots` : ''}
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => router.push(`/carnets/${draft.slug || draft.id}/edit`)}
                className="px-3 py-1.5 bg-[#17402C] hover:bg-[#365233] text-white text-xs font-700 rounded-full transition-colors"
              >
                Reprendre
              </button>
              <button
                onClick={() => onPublish(draft.id)}
                title="Publier"
                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <Icon name="ArrowUpOnSquareIcon" size={14} />
              </button>
              <button
                onClick={() => onDelete(draft.id)}
                title="Supprimer"
                className="p-1.5 text-[#5A7064] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Icon name="TrashIcon" size={14} />
              </button>
            </div>
          </div>
          {/* Progress bar (only shown when real progress data exists) */}
          {progress !== null && (
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-[#EDEAE0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: progressColor }}
                />
              </div>
              <span className="text-[10px] font-mono font-700 text-[#5A7064] flex-shrink-0">{progress}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
