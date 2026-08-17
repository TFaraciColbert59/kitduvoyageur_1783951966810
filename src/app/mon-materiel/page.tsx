'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  getStreamingChatCompletion,
  GEMINI_PROVIDER,
  GEMINI_DEFAULT_MODEL,
} from '@/lib/ai/chatCompletion';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatWeight(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${g} g`;
}

const CATEGORIES = ['all', 'couchage', 'portage', 'cuisine', 'vêtement', 'navigation'];

// Objectif de poids par défaut du pack (kg) — pilotable via l'UI
const DEFAULT_TARGET_KG = 8;

// Extract plain text from a streaming chunk regardless of provider shape
function extractChunkText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  const c = chunk as Record<string, any>;
  if (!c) return '';
  return (
    c.content ||
    c.delta ||
    c.text ||
    c.message?.content ||
    c.choices?.[0]?.delta?.content ||
    c.choices?.[0]?.message?.content ||
    ''
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable Liquid Glass card (visionOS style)
// ─────────────────────────────────────────────────────────────
function GlassCard({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={`relative rounded-[28px] overflow-hidden border border-white/12 bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_60px_-15px_rgba(11,31,23,0.6),inset_0_1px_0_0_rgba(255,255,255,0.18)] ${className}`}
      {...rest}
    >
      {/* Top specular sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%)' }}
      />
      {/* Light-refraction edge (gradient border via mask) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px]"
        style={{
          padding: 1,
          background: 'linear-gradient(140deg, rgba(255,255,255,0.35), rgba(255,255,255,0.04) 40%, transparent 70%)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

// Weight-target radial gauge
function WeightGauge({ currentG, targetKg }: { currentG: number; targetKg: number }) {
  const targetG = targetKg * 1000;
  const ratio = targetG > 0 ? currentG / targetG : 0;
  const pct = Math.min(ratio, 1);
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const color = ratio <= 0.85 ? '#A3C4A3' : ratio <= 1 ? '#E9C46A' : '#E76F51';
  return (
    <div className="relative w-[92px] h-[92px] shrink-0">
      <svg viewBox="0 0 92 92" className="w-full h-full -rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {(currentG / 1000).toFixed(1)}
        </span>
        <span className="text-[9px] text-white/50 font-mono">/ {targetKg} kg</span>
      </div>
    </div>
  );
}

export default function MonMaterielCockpitPage() {
  const { triggerHaptic } = useHapticFeedback();

  // Supabase Hooks (logic preserved)
  const {
    equipment,
    loading: equipmentLoading,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  const {
    kits,
    loading: kitsLoading,
    updateKit,
    moveToTrash,
  } = useUserKits(equipment);

  const isLoading = equipmentLoading || kitsLoading;

  // States
  const [activeNav, setActiveNav] = useState<'inventory' | 'telemetry' | 'favorites' | 'settings'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Tous');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [targetKg, setTargetKg] = useState<number>(DEFAULT_TARGET_KG);
  const [showTelemetryPanel, setShowTelemetryPanel] = useState(false); // mobile/tablet overlay
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // multi-select
  const [compareIds, setCompareIds] = useState<string[]>([]); // comparator

  // Inline edit
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineWeight, setInlineWeight] = useState<string>('');
  const [inlineQty, setInlineQty] = useState<string>('');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);

  // AI Copilot (real streaming)
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Set default selected item
  useEffect(() => {
    if (equipment.length > 0) {
      if (!selectedItemId || !equipment.some((e) => e.id === selectedItemId)) {
        setSelectedItemId(equipment[0].id);
      }
    }
  }, [equipment, selectedItemId]);

  // Filtered equipment list
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (activeNav === 'favorites' && !item.is_favorite) return false;
      if (selectedBrand && selectedBrand !== 'Tous') {
        if (!item.brand?.toLowerCase().includes(selectedBrand.toLowerCase())) return false;
      }
      if (activeCategory !== 'all') {
        const cat = (item.category || '').toLowerCase();
        if (!cat.includes(activeCategory.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchBrand = item.brand?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCat) return false;
      }
      return true;
    });
  }, [equipment, activeNav, selectedBrand, activeCategory, searchQuery]);

  // Active selected item
  const activeItem = useMemo(() => {
    if (filteredEquipment.length > 0) {
      const found = filteredEquipment.find((e) => e.id === selectedItemId);
      if (found) return found;
      return filteredEquipment[0];
    }
    return equipment.find((e) => e.id === selectedItemId) || equipment[0] || null;
  }, [filteredEquipment, equipment, selectedItemId]);

  // Totals
  const totalWeightG = useMemo(
    () => equipment.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0),
    [equipment]
  );
  const totalValue = useMemo(
    () => equipment.reduce((sum, it) => sum + (Number(it.purchase_price) || 0) * (it.quantity || 1), 0),
    [equipment]
  );
  const favoritesCount = useMemo(() => equipment.filter((e) => e.is_favorite).length, [equipment]);

  // Category distribution
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    equipment.forEach((it) => {
      const cat = (it.category || 'Autre').split(/[&/]/)[0].trim();
      map.set(cat, (map.get(cat) || 0) + (it.weight_g || 0) * (it.quantity || 1));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([label, grams]) => ({ label, grams, pct: Math.round((grams / total) * 100) }))
      .sort((a, b) => b.grams - a.grams)
      .slice(0, 4);
  }, [equipment]);

  // ── Smart alerts (Lot 4) ──
  const alerts = useMemo(() => {
    const now = Date.now();
    const out: { id: string; kind: 'maintenance' | 'expiry' | 'replace' | 'loan'; label: string; itemId: string }[] = [];
    equipment.forEach((it) => {
      if (it.next_maintenance_date && new Date(it.next_maintenance_date).getTime() < now) {
        out.push({ id: `m-${it.id}`, kind: 'maintenance', label: `Révision due — ${it.name}`, itemId: it.id });
      }
      if (it.expiry_date && new Date(it.expiry_date).getTime() < now) {
        out.push({ id: `e-${it.id}`, kind: 'expiry', label: `Péremption — ${it.name}`, itemId: it.id });
      }
      if (it.condition === 'à_remplacer') {
        out.push({ id: `r-${it.id}`, kind: 'replace', label: `À remplacer — ${it.name}`, itemId: it.id });
      }
      if (it.loan_status === 'prêté') {
        out.push({ id: `l-${it.id}`, kind: 'loan', label: `Prêté${it.loan_to_name ? ` à ${it.loan_to_name}` : ''} — ${it.name}`, itemId: it.id });
      }
    });
    return out;
  }, [equipment]);

  // Reset filters
  const handleResetFilters = () => {
    triggerHaptic('light');
    setSearchQuery('');
    setSelectedBrand('Tous');
    setActiveCategory('all');
    setActiveNav('inventory');
  };

  // Toggle favorite
  const handleToggleFavorite = async (item: UserEquipmentItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    await updateEquipment(item.id, { is_favorite: !item.is_favorite });
  };

  // Inline edit save
  const startInlineEdit = (item: UserEquipmentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineEditId(item.id);
    setInlineWeight(String(item.weight_g ?? ''));
    setInlineQty(String(item.quantity ?? 1));
  };
  const saveInlineEdit = async (item: UserEquipmentItem) => {
    triggerHaptic('light');
    const w = Number(inlineWeight);
    const q = Math.max(1, Number(inlineQty) || 1);
    await updateEquipment(item.id, {
      weight_g: Number.isFinite(w) && w >= 0 ? w : item.weight_g,
      quantity: q,
    });
    setInlineEditId(null);
  };

  // Multi-select
  const toggleSelected = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const bulkDelete = async () => {
    triggerHaptic('warning');
    for (const id of Array.from(selectedIds)) {
      await removeFromEquipment(id);
    }
    clearSelection();
  };

  // Comparator
  const toggleCompare = (id: string) => {
    triggerHaptic('light');
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };
  const compareItems = useMemo(
    () => compareIds.map((id) => equipment.find((e) => e.id === id)).filter(Boolean) as UserEquipmentItem[],
    [compareIds, equipment]
  );

  // ── AI Copilot (Lot 5) ──
  const runAi = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || aiStreaming) return;
      triggerHaptic('selection');
      setAiStreaming(true);
      setAiError(null);
      setAiResponse('');

      const inventorySummary = equipment
        .map((e) => `- ${e.name} (${e.brand || 'sans marque'}, ${e.category}, ${e.weight_g || 0} g${e.condition ? `, état: ${e.condition}` : ''})`)
        .join('\n');

      const messages = [
        {
          role: 'system',
          content:
            "Tu es le Copilote Équipement du Kit du Voyageur, expert en optimisation de packs de randonnée et trek. Tu réponds en français, de façon concise et actionnable (listes courtes, poids en grammes/kg). Base-toi UNIQUEMENT sur l'inventaire fourni. Propose des arbitrages de poids concrets.",
        },
        {
          role: 'user',
          content: `Voici mon inventaire actuel (${equipment.length} articles, poids total ${formatWeight(totalWeightG)}, objectif ${targetKg} kg):\n${inventorySummary}\n\nDemande: ${q}`,
        },
      ];

      getStreamingChatCompletion(
        GEMINI_PROVIDER,
        GEMINI_DEFAULT_MODEL,
        messages,
        (chunk) => {
          const text = extractChunkText(chunk);
          if (text) {
            setAiResponse((prev) => prev + text);
            requestAnimationFrame(() => {
              if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
            });
          }
        },
        () => setAiStreaming(false),
        (err) => {
          setAiError(err.message || 'Le copilote est indisponible pour le moment.');
          setAiStreaming(false);
        },
        { temperature: 0.6, max_tokens: 700 }
      );
    },
    [aiStreaming, equipment, totalWeightG, targetKg, triggerHaptic]
  );

  // ── Keyboard shortcuts (Lot 6) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filteredEquipment.length === 0) return;
        e.preventDefault();
        const idx = filteredEquipment.findIndex((it) => it.id === (activeItem?.id || selectedItemId));
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(filteredEquipment.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        setSelectedItemId(filteredEquipment[nextIdx].id);
        triggerHaptic('light');
      } else if (e.key.toLowerCase() === 'f' && activeItem) {
        handleToggleFavorite(activeItem);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEquipment, activeItem, selectedItemId]);

  const enterAnim = prefersReducedMotion ? '' : 'motion-safe:animate-[fadeInUp_0.4s_ease_both]';

  return (
    <div className="fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-[#0B1F17] text-white select-none font-sans flex flex-col p-3 sm:p-4">
      {/* keyframes + no-scrollbar utility injected locally */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* ═══ BACKGROUND — blurred alpine trek landscape (parallax) ═══ */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/assets/images/hero-misty.jpg"
          alt="Paysage de montagne — trek alpin"
          fill
          priority
          sizes="100vw"
          className={`object-cover object-center scale-[1.18] ${prefersReducedMotion ? '' : 'motion-safe:animate-[fadeInUp_1.2s_ease_both]'}`}
          style={{ filter: 'blur(30px) saturate(1.18)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1F17]/72 via-[#0B1F17]/55 to-[#0B1F17]/82" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 28%, transparent 18%, rgba(11,31,23,0.9) 100%)' }}
        />
        {/* Grain overlay (anti-banding) */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      {/* ═══ TOP FLOATING GLASS BAR ═══ */}
      <header className="relative z-10 flex items-center justify-between gap-3 shrink-0 h-12 px-3 mb-3 rounded-full border border-white/12 bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_12px_40px_-12px_rgba(11,31,23,0.6),inset_0_1px_0_0_rgba(255,255,255,0.16)]">
        <div className="flex items-center gap-2.5 pl-1 min-w-0">
          <span className="w-8 h-8 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner shrink-0">
            <svg viewBox="0 0 32 32" width="17" height="17" fill="none">
              <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="#A3C4A3" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-semibold tracking-wide text-sm text-white truncate">Mon Équipement</span>
          <span className="text-white/25 hidden sm:inline">·</span>
          <span className="text-[11px] text-white/70 font-medium hidden sm:inline tracking-wide">Cockpit d&apos;équipement</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setShowTelemetryPanel((v) => !v); }}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-white/85 hover:text-white bg-white/8 hover:bg-white/14 border border-white/12 transition-all active:scale-95 xl:hidden"
          >
            Télémétrie
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setIsKitDrawerOpen(true); }}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white/85 hover:text-white bg-white/8 hover:bg-white/14 border border-white/12 transition-all active:scale-95 hidden sm:inline-block"
          >
            Kits assemblés
          </button>
          <Link
            href="/boutique"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white/85 hover:text-white bg-white/8 hover:bg-white/14 border border-white/12 transition-all active:scale-95 hidden lg:inline-block"
          >
            Boutique
          </Link>
          {/* Clear exit from the immersive cockpit */}
          <Link
            href="/compte"
            aria-label="Quitter le cockpit"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all active:scale-90"
            title="Quitter le cockpit"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Link>
          <Link
            href="/compte"
            className="w-8 h-8 rounded-full bg-[#A3C4A3] text-[#0B1F17] flex items-center justify-center text-[11px] font-extrabold shadow-sm transition-transform active:scale-90"
          >
            MC
          </Link>
        </div>
      </header>

      {/* ═══ SMART ALERTS RIBBON (Lot 4) ═══ */}
      {alerts.length > 0 && (
        <div className="relative z-10 shrink-0 mb-3 flex gap-2 overflow-x-auto scrollbar-none">
          {alerts.slice(0, 6).map((a) => {
            const palette =
              a.kind === 'expiry' || a.kind === 'replace'
                ? 'bg-[#E76F51]/15 border-[#E76F51]/40 text-[#F4A18C]'
                : a.kind === 'maintenance'
                ? 'bg-[#E9C46A]/15 border-[#E9C46A]/40 text-[#EFD79B]'
                : 'bg-white/8 border-white/15 text-white/80';
            const icon = a.kind === 'expiry' ? '⏳' : a.kind === 'maintenance' ? '🛠️' : a.kind === 'replace' ? '⚠️' : '🤝';
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => { setSelectedItemId(a.itemId); triggerHaptic('light'); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium whitespace-nowrap transition-all active:scale-95 ${palette}`}
              >
                <span>{icon}</span>
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ MAIN COCKPIT ═══ */}
      <div className="relative z-10 flex-1 flex gap-3 sm:gap-4 min-h-0 max-h-full overflow-hidden">

        {/* ─── LEFT RAIL ─── */}
        <GlassCard className="w-14 shrink-0 hidden sm:block">
          <div className="flex flex-col items-center justify-between py-4 px-1.5 h-full">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-white/8 hover:bg-white/14 border border-white/12 flex items-center justify-center text-white transition-transform active:scale-95"
              title="Accueil LKDV"
            >
              <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
                <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="#A3C4A3" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setActiveNav('inventory'); }}
                aria-label="Inventaire"
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                  activeNav === 'inventory'
                    ? 'bg-[#A3C4A3] text-[#0B1F17] shadow-[0_0_20px_rgba(163,196,163,0.45)] scale-105'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`}
                title="Inventaire"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1">
                  <rect x="3" y="3" width="7" height="7" rx="2" />
                  <rect x="14" y="3" width="7" height="7" rx="2" />
                  <rect x="3" y="14" width="7" height="7" rx="2" />
                  <rect x="14" y="14" width="7" height="7" rx="2" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setIsKitDrawerOpen(true); }}
                aria-label="Kits assemblés"
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all active:scale-95"
                title="Kits assemblés"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setActiveNav(activeNav === 'favorites' ? 'inventory' : 'favorites'); }}
                aria-label="Favoris"
                aria-pressed={activeNav === 'favorites'}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                  activeNav === 'favorites'
                    ? 'bg-[#A3C4A3] text-[#0B1F17] shadow-[0_0_20px_rgba(163,196,163,0.45)] scale-105'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`}
                title="Favoris"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill={activeNav === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z" />
                </svg>
              </button>
            </div>

            <Link
              href="/compte"
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-all active:scale-95"
              title="Paramètres"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </Link>
          </div>
        </GlassCard>

        {/* ─── COLUMN 1 : INVENTORY ─── */}
        <GlassCard className="w-[280px] lg:w-[320px] xl:w-[340px] shrink-0 flex flex-col">
          <div className="flex flex-col h-full p-3.5 overflow-hidden">
            <div className="space-y-2.5 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-bold tracking-tight text-white">Inventaire</h2>
                <span className="text-xs font-mono text-[#A3C4A3] font-bold">
                  {filteredEquipment.length} · {formatWeight(totalWeightG)}
                </span>
              </div>

              <div className="relative flex items-center">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 text-white/50">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher…  ( / )"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-2 bg-black/25 rounded-2xl border border-white/12 text-xs text-white placeholder-white/50 focus:outline-none focus:border-[#A3C4A3]/60 focus:ring-1 focus:ring-[#A3C4A3]/40 transition-colors"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 text-white/50 hover:text-white text-xs" aria-label="Effacer">✕</button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setActiveCategory(cat); }}
                    className={`px-3 py-1 rounded-full capitalize whitespace-nowrap transition-colors ${
                      activeCategory === cat
                        ? 'bg-[#A3C4A3] text-[#0B1F17] font-bold'
                        : 'bg-white/8 text-white/75 hover:bg-white/14 hover:text-white border border-white/10'
                    }`}
                  >
                    {cat === 'all' ? 'Tous' : cat}
                  </button>
                ))}
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[#A3C4A3]/12 border border-[#A3C4A3]/30">
                  <span className="text-[11px] text-white/90 font-medium">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={bulkDelete} className="px-2.5 py-1 rounded-lg bg-[#E76F51]/20 hover:bg-[#E76F51]/30 text-[#F4A18C] text-[11px] font-semibold transition-all active:scale-95">Supprimer</button>
                    <button type="button" onClick={clearSelection} className="px-2 py-1 rounded-lg bg-white/8 hover:bg-white/14 text-white/80 text-[11px] transition-all active:scale-95">Annuler</button>
                  </div>
                </div>
              )}
            </div>

            {/* Item cards */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 pt-2.5 scrollbar-none">
              {isLoading && equipment.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="p-3 rounded-2xl bg-white/5 animate-pulse flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-3/4 h-3 rounded bg-white/15" />
                        <div className="w-1/2 h-2.5 rounded bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredEquipment.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/5 text-center space-y-2.5 my-3 border border-white/10">
                  <span className="text-2xl block">🧭</span>
                  <p className="text-xs text-white/75 font-medium">
                    {equipment.length === 0 ? 'Commence ton inventaire' : 'Aucun équipement trouvé'}
                  </p>
                  <button
                    type="button"
                    onClick={equipment.length === 0 ? () => { setEditingItem(null); setIsAddModalOpen(true); } : handleResetFilters}
                    className="px-3.5 py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-all active:scale-95"
                  >
                    {equipment.length === 0 ? 'Ajouter un article' : 'Réinitialiser'}
                  </button>
                </div>
              ) : (
                filteredEquipment.map((item, i) => {
                  const isSelected = item.id === (activeItem?.id || selectedItemId);
                  const isChecked = selectedIds.has(item.id);
                  const inCompare = compareIds.includes(item.id);
                  const editing = inlineEditId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => { triggerHaptic('light'); setSelectedItemId(item.id); }}
                      style={prefersReducedMotion ? undefined : { animationDelay: `${Math.min(i, 12) * 30}ms` }}
                      className={`${enterAnim} p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative group ${
                        isSelected
                          ? 'bg-white/[0.12] border-[#A3C4A3]/50 ring-1 ring-[#A3C4A3]/30 shadow-[0_8px_24px_-8px_rgba(11,31,23,0.6)]'
                          : 'bg-white/[0.04] border-white/8 hover:bg-white/[0.08] hover:border-white/15'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-[#A3C4A3] shadow-[0_0_10px_rgba(163,196,163,0.8)]" />
                      )}

                      {/* select checkbox */}
                      <button
                        type="button"
                        onClick={(e) => toggleSelected(item.id, e)}
                        aria-label={isChecked ? 'Désélectionner' : 'Sélectionner'}
                        className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                          isChecked ? 'bg-[#A3C4A3] border-[#A3C4A3] text-[#0B1F17]' : 'border-white/30 text-transparent hover:border-white/60'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                      </button>

                      <div className="w-11 h-11 rounded-xl bg-black/30 overflow-hidden relative shrink-0 border border-white/10 flex items-center justify-center p-1.5 shadow-inner">
                        <Image src={item.image || '/assets/images/no_image.png'} alt={item.name} width={40} height={40} className="object-contain max-h-full max-w-full" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-[13px] font-bold text-white truncate leading-tight">{item.name}</h4>
                        {editing ? (
                          <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                            <input value={inlineWeight} onChange={(e) => setInlineWeight(e.target.value)} inputMode="numeric" className="w-14 px-1.5 py-0.5 rounded-md bg-black/40 border border-white/20 text-[11px] text-white text-center focus:outline-none focus:border-[#A3C4A3]" aria-label="Poids en grammes" />
                            <span className="text-[10px] text-white/50">g</span>
                            <span className="text-white/30">×</span>
                            <input value={inlineQty} onChange={(e) => setInlineQty(e.target.value)} inputMode="numeric" className="w-9 px-1.5 py-0.5 rounded-md bg-black/40 border border-white/20 text-[11px] text-white text-center focus:outline-none focus:border-[#A3C4A3]" aria-label="Quantité" />
                            <button type="button" onClick={() => saveInlineEdit(item)} className="px-2 py-0.5 rounded-md bg-[#A3C4A3] text-[#0B1F17] text-[10px] font-bold">OK</button>
                            <button type="button" onClick={() => setInlineEditId(null)} className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 text-[10px]">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-0.5 truncate">
                            <span>{item.brand || 'Outdoor'}</span>
                            <span>·</span>
                            <button type="button" onClick={(e) => startInlineEdit(item, e)} className="font-mono text-[#A3C4A3] font-bold hover:underline" title="Éditer le poids / la quantité">
                              {formatWeight(item.weight_g || 0)}{(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}
                            </button>
                            {item.loan_status === 'prêté' && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-white/70 border border-white/15">Prêté</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleCompare(item.id); }}
                          className={`p-1 rounded-md transition-colors ${inCompare ? 'text-[#A3C4A3]' : 'text-white/35 hover:text-white/80'}`}
                          title="Comparer"
                          aria-label="Comparer"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3v18M15 3v18M3 9h18M3 15h18" opacity="0.0"/><path d="M4 7h6v10H4zM14 7h6v10h-6z"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); setIsDetailDrawerOpen(true); }}
                          className="text-white/40 hover:text-[#A3C4A3] p-1 transition-colors"
                          title="Ouvrir la fiche"
                          aria-label="Ouvrir la fiche"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }}
                className="w-full py-2.5 rounded-2xl border border-dashed border-white/20 hover:border-[#A3C4A3] bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-[#A3C4A3] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <span className="text-sm">+</span> Ajouter un article
              </button>
            </div>
          </div>
        </GlassCard>

        {/* ─── COLUMN 2 : HERO + TOOL SHEET ─── */}
        <GlassCard className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-col h-full p-4 sm:p-5 overflow-hidden">
            {/* Comparator strip */}
            {compareItems.length === 2 && (
              <div className="mb-3 shrink-0 rounded-2xl bg-white/[0.05] border border-white/12 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Comparateur</span>
                  <button type="button" onClick={() => setCompareIds([])} className="text-white/50 hover:text-white text-[11px]">Fermer ✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {compareItems.map((it) => (
                    <div key={it.id} className="text-xs">
                      <p className="font-bold text-white truncate">{it.name}</p>
                      <p className="text-white/60 mt-1">Poids <span className="font-mono text-[#A3C4A3]">{formatWeight(it.weight_g || 0)}</span></p>
                      <p className="text-white/60">Prix <span className="font-mono text-white">{it.purchase_price ? `${it.purchase_price} €` : '—'}</span></p>
                      <p className="text-white/60 capitalize">État {it.condition || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeItem ? (
              <div className="flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight truncate">{activeItem.name}</h1>
                  <p className="text-xs text-white/70 mt-0.5">
                    {activeItem.brand || 'Outdoor'} · Catégorie <span className="capitalize font-bold text-[#A3C4A3]">{activeItem.category}</span>
                    {activeItem.loan_status === 'prêté' && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/80">Prêté{activeItem.loan_to_name ? ` à ${activeItem.loan_to_name}` : ''}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setIsDetailDrawerOpen(true)} className="px-5 py-2 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] font-extrabold text-xs transition-all shadow-[0_0_20px_rgba(163,196,163,0.4)] active:scale-95">
                    Fiche complète
                  </button>
                  <button type="button" onClick={(e) => handleToggleFavorite(activeItem, e)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs transition-transform active:scale-90" title="Favori (f)" aria-label="Favori">
                    {activeItem.is_favorite ? '❤️' : '🤍'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/70">Sélectionnez un équipement</div>
            )}

            {/* Hero stage + tool sheet grid */}
            <div className="flex-1 min-h-0 mt-3 grid grid-rows-[1fr_auto] gap-3 overflow-hidden">
              {/* Hero */}
              <div className="relative min-h-0 rounded-[24px] bg-gradient-to-b from-white/[0.06] to-black/25 border border-white/12 overflow-hidden flex items-center justify-center p-4 group">
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.14) 0%, transparent 58%)' }} />
                <div className="absolute bottom-6 w-56 sm:w-72 h-6 rounded-[100%] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(11,31,23,0.85) 0%, rgba(11,31,23,0) 70%)', filter: 'blur(10px)' }} />
                {activeItem ? (
                  <div key={activeItem.id} className={`relative z-10 w-full h-full max-h-[240px] flex items-center justify-center ${prefersReducedMotion ? '' : 'motion-safe:animate-[fadeInUp_0.45s_ease_both]'}`}>
                    <Image src={activeItem.image || '/assets/images/no_image.png'} alt={activeItem.name} width={340} height={260} className="object-contain max-h-full max-w-full drop-shadow-[0_20px_32px_rgba(11,31,23,0.7)] group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <span className="text-4xl">🎒</span>
                )}
              </div>

              {/* Tool sheet: metrics + gauge + specs */}
              {activeItem && (
                <div className="shrink-0 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-3 items-center border-t border-white/10 pt-3">
                  <div className="flex items-center gap-4">
                    <WeightGauge currentG={totalWeightG} targetKg={targetKg} />
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[11px] text-white/60">
                        <span className="uppercase font-mono tracking-widest">Objectif</span>
                        <div className="flex items-center gap-1">
                          {[6, 8, 10, 12].map((t) => (
                            <button key={t} type="button" onClick={() => { setTargetKg(t); triggerHaptic('light'); }} className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${targetKg === t ? 'bg-[#A3C4A3] text-[#0B1F17] font-bold' : 'bg-white/8 text-white/70 hover:bg-white/14'}`}>{t}kg</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/60 uppercase tracking-widest block font-mono">Poids pesé</span>
                        <span className="text-2xl font-bold font-mono text-[#A3C4A3]">{formatWeight(activeItem.weight_g || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Spec tiles from DB fields */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SpecTile label="État" value={activeItem.condition || 'Excellent'} accent />
                    <SpecTile label="Usure" value={activeItem.wear_percentage != null ? `${activeItem.wear_percentage}%` : '—'} />
                    <SpecTile label="Usages" value={activeItem.usage_count != null ? String(activeItem.usage_count) : '—'} />
                    <SpecTile label="Valeur" value={activeItem.purchase_price ? `${activeItem.purchase_price} €` : '—'} />
                    <SpecTile label="Matériaux" value={activeItem.materials || '—'} wide />
                    <SpecTile label="Imperm." value={activeItem.waterproof_rating || '—'} />
                    <SpecTile label="Maintenance" value={activeItem.next_maintenance_date ? new Date(activeItem.next_maintenance_date).toLocaleDateString('fr-FR') : '—'} />
                  </div>
                </div>
              )}

              {/* Action row */}
              {activeItem && (
                <div className="grid grid-cols-3 gap-2.5 shrink-0">
                  <button type="button" onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }} className="py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95">✎ Éditer</button>
                  <button type="button" onClick={() => setIsLendModalOpen(true)} className="py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/12 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95">🤝 Prêter</button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      addToCart({
                        id: activeItem.product_id || activeItem.id,
                        slug: 'equipement',
                        name: activeItem.name,
                        brand: activeItem.brand || 'LKDV',
                        priceEur: activeItem.purchase_price || 99,
                        weightG: activeItem.weight_g || 100,
                        image: activeItem.image || '/assets/images/no_image.png',
                        imageAlt: activeItem.name,
                        category: activeItem.category || 'équipement',
                      });
                    }}
                    className="py-2.5 rounded-2xl bg-[#A3C4A3]/15 hover:bg-[#A3C4A3]/25 border border-[#A3C4A3]/40 text-[#A3C4A3] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    ↻ Racheter
                  </button>
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* ─── COLUMN 3 : TELEMETRY + AI (desktop) ─── */}
        <div className="hidden xl:flex w-[320px] shrink-0 flex-col h-full gap-4 overflow-hidden">
          <TelemetryCard
            equipmentCount={equipment.length}
            totalWeightG={totalWeightG}
            favoritesCount={favoritesCount}
            categoryStats={categoryStats}
            totalValue={totalValue}
          />
          <AiCard
            aiInput={aiInput}
            setAiInput={setAiInput}
            aiResponse={aiResponse}
            aiStreaming={aiStreaming}
            aiError={aiError}
            aiScrollRef={aiScrollRef}
            runAi={runAi}
            kits={kits}
            openKit={(kit) => { setSelectedKitForCockpit(kit); setIsKitDrawerOpen(true); }}
          />
        </div>
      </div>

      {/* ─── Mobile / tablet telemetry overlay ─── */}
      {showTelemetryPanel && (
        <div className="xl:hidden fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTelemetryPanel(false)} />
          <div className="relative w-[340px] max-w-[88vw] h-full p-3 flex flex-col gap-3 overflow-y-auto scrollbar-none">
            <button type="button" onClick={() => setShowTelemetryPanel(false)} className="self-end w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white active:scale-90" aria-label="Fermer">✕</button>
            <TelemetryCard equipmentCount={equipment.length} totalWeightG={totalWeightG} favoritesCount={favoritesCount} categoryStats={categoryStats} totalValue={totalValue} />
            <AiCard aiInput={aiInput} setAiInput={setAiInput} aiResponse={aiResponse} aiStreaming={aiStreaming} aiError={aiError} aiScrollRef={aiScrollRef} runAi={runAi} kits={kits} openKit={(kit) => { setSelectedKitForCockpit(kit); setIsKitDrawerOpen(true); }} />
          </div>
        </div>
      )}

      {/* ═══ MODALS & DRAWERS ═══ */}
      <GearDetailDrawer
        isOpen={isDetailDrawerOpen}
        item={activeItem}
        onClose={() => setIsDetailDrawerOpen(false)}
        onEdit={(item) => { setIsDetailDrawerOpen(false); setEditingItem(item); setIsAddModalOpen(true); }}
        onDelete={(id) => { removeFromEquipment(id); setIsDetailDrawerOpen(false); }}
        onLend={() => { setIsDetailDrawerOpen(false); setIsLendModalOpen(true); }}
        onToggleFavorite={() => { if (activeItem) handleToggleFavorite(activeItem); }}
        onAddToCart={(p) => {
          addToCart({
            id: p.id || 'prod',
            slug: p.slug || 'equipement',
            name: p.name || 'Équipement',
            brand: p.brand || 'LKDV',
            priceEur: p.price_eur || p.priceEur || 99,
            weightG: p.weight_g || p.weightG || 100,
            image: p.image || '/assets/images/no_image.png',
            imageAlt: p.name || 'Équipement',
            category: p.category || 'équipement',
          });
        }}
      />

      <AddEditGearModal
        isOpen={isAddModalOpen}
        initialItem={
          editingItem
            ? {
                id: editingItem.id,
                name: editingItem.name,
                brand: editingItem.brand || undefined,
                category: editingItem.category,
                weight_g: editingItem.weight_g,
                weight: editingItem.weight_g,
                count: editingItem.quantity || 1,
                quantity: editingItem.quantity || 1,
                condition: editingItem.condition as any,
                image: editingItem.image || undefined,
                purchase_price: editingItem.purchase_price || undefined,
                purchase_date: editingItem.purchase_date || undefined,
                is_favorite: editingItem.is_favorite,
                is_rented: false,
                notes: editingItem.notes || undefined,
              }
            : null
        }
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }}
        onSave={async (itemData) => {
          if (editingItem && editingItem.id) {
            await updateEquipment(editingItem.id, {
              name: itemData.name,
              brand: itemData.brand,
              category: itemData.category,
              weight_g: itemData.weight_g,
              condition: itemData.condition as any,
              notes: itemData.notes,
              image: itemData.image,
              purchase_price: itemData.purchase_price,
            });
          } else {
            await addToEquipment(
              {
                name: itemData.name || 'Nouvel équipement',
                category: itemData.category || 'autre',
                weight_g: itemData.weight_g || 100,
                brand: itemData.brand || undefined,
                image: itemData.image || undefined,
              },
              {
                condition: (itemData.condition as any) || 'excellent',
                notes: itemData.notes || undefined,
                purchase_price: itemData.purchase_price || undefined,
              }
            );
          }
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
      />

      <KitCockpitDrawer
        isOpen={isKitDrawerOpen}
        kit={selectedKitForCockpit || kits[0] || null}
        userEquipment={equipment}
        onClose={() => { setIsKitDrawerOpen(false); setSelectedKitForCockpit(null); }}
        onSelectForDeparture={(kit) => { setSelectedKitForCockpit(kit); setIsKitDrawerOpen(false); }}
        onUpdateKit={async (kitId, patch) => { await updateKit(kitId, patch); }}
        onDeleteKit={async (kitId) => { await moveToTrash(kitId); setIsKitDrawerOpen(false); setSelectedKitForCockpit(null); }}
        onAddGearToInventory={async (product) => {
          await addToEquipment({
            name: product.name,
            brand: product.brand,
            category: product.category || 'Autre',
            weight_g: product.weight_g || 100,
            image: product.image,
          });
        }}
        onAddToCart={(p) => {
          addToCart({
            id: p.id || 'prod',
            slug: p.slug || 'equipement',
            name: p.name || 'Équipement',
            brand: p.brand || 'LKDV',
            priceEur: p.price_eur || p.priceEur || 99,
            weightG: p.weight_g || p.weightG || 100,
            image: p.image || '/assets/images/no_image.png',
            imageAlt: p.name || 'Équipement',
            category: p.category || 'équipement',
          });
        }}
      />

      <LendItemModal
        isOpen={isLendModalOpen}
        item={activeItem}
        onClose={() => setIsLendModalOpen(false)}
        onSaveLoan={async (borrowerName, returnDate, notes) => {
          if (activeItem) {
            await updateEquipment(activeItem.id, {
              loan_status: 'prêté',
              loan_to_name: borrowerName,
              notes: notes || activeItem.notes,
            });
          }
          setIsLendModalOpen(false);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function SpecTile({ label, value, accent, wide }: { label: string; value: string; accent?: boolean; wide?: boolean }) {
  return (
    <div className={`p-2.5 rounded-xl bg-white/[0.05] border border-white/10 ${wide ? 'col-span-2' : ''}`}>
      <span className={`text-xs font-bold block truncate capitalize ${accent ? 'text-[#A3C4A3]' : 'text-white'}`}>{value}</span>
      <span className="text-[9px] text-white/55 uppercase font-mono tracking-wider mt-0.5 block">{label}</span>
    </div>
  );
}

function TelemetryCard({
  equipmentCount,
  totalWeightG,
  favoritesCount,
  categoryStats,
  totalValue,
}: {
  equipmentCount: number;
  totalWeightG: number;
  favoritesCount: number;
  categoryStats: { label: string; grams: number; pct: number }[];
  totalValue: number;
}) {
  return (
    <GlassCard className="shrink-0">
      <div className="p-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Télémétrie du pack</h3>
          <span className="text-[9px] text-[#A3C4A3] font-mono font-bold uppercase tracking-wider">Live</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 text-center">
            <span className="block text-lg font-bold font-mono text-[#A3C4A3]">{equipmentCount}</span>
            <span className="block text-[9px] text-white/60 uppercase font-mono mt-0.5">Articles</span>
          </div>
          <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 text-center">
            <span className="block text-lg font-bold font-mono text-white">{formatWeight(totalWeightG)}</span>
            <span className="block text-[9px] text-white/60 uppercase font-mono mt-0.5">Poids</span>
          </div>
          <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 text-center">
            <span className="block text-lg font-bold font-mono text-white">{favoritesCount}</span>
            <span className="block text-[9px] text-white/60 uppercase font-mono mt-0.5">Favoris</span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {categoryStats.map((c) => (
            <div key={c.label}>
              <div className="flex items-center justify-between text-[10px] text-white/70 mb-0.5">
                <span className="capitalize truncate">{c.label}</span>
                <span className="font-mono text-[#A3C4A3]">{formatWeight(c.grams)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-[#A3C4A3]" style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-white/70 pt-2.5 border-t border-white/10">
          <span>Valeur totale du kit</span>
          <span className="font-mono font-bold text-white">{Math.round(totalValue)} €</span>
        </div>
      </div>
    </GlassCard>
  );
}

function AiCard({
  aiInput,
  setAiInput,
  aiResponse,
  aiStreaming,
  aiError,
  aiScrollRef,
  runAi,
  kits,
  openKit,
}: {
  aiInput: string;
  setAiInput: (v: string) => void;
  aiResponse: string;
  aiStreaming: boolean;
  aiError: string | null;
  aiScrollRef: React.RefObject<HTMLDivElement | null>;
  runAi: (q: string) => void;
  kits: CustomKit[];
  openKit: (kit: CustomKit) => void;
}) {
  const suggestions = [
    'Optimise un pack bivouac 3 jours sous 8 kg',
    'Quel matériel alléger en priorité ?',
    'Détecte le matériel à réviser avant mon départ',
  ];
  return (
    <GlassCard className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-col h-full p-4 overflow-hidden">
        <div className="flex items-center gap-2 pb-2.5 border-b border-white/10 shrink-0">
          <span className="text-sm">✦</span>
          <div>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Copilote IA Équipement</h3>
            <span className="text-[9px] text-[#A3C4A3] font-mono font-bold uppercase tracking-wider">{aiStreaming ? 'Analyse en cours…' : 'Assistance active'}</span>
          </div>
        </div>

        <div ref={aiScrollRef} className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-2.5 pr-0.5 scrollbar-none">
          {aiResponse ? (
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 shadow-inner">
              <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">{aiResponse}{aiStreaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-[#A3C4A3] animate-pulse align-middle" />}</p>
            </div>
          ) : aiError ? (
            <div className="p-3.5 rounded-2xl bg-[#E76F51]/12 border border-[#E76F51]/30 text-[11px] text-[#F4A18C]">{aiError}</div>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => runAi(s)} className="w-full text-left p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-[#A3C4A3]/40 transition-all active:scale-[0.98] text-xs text-white/90">
                  ✦ {s}
                </button>
              ))}
              {kits.slice(0, 2).map((kit) => (
                <button key={kit.id} type="button" onClick={() => openKit(kit)} className="w-full text-left p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-[#A3C4A3]/40 transition-all active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{kit.name || 'Kit assemblé'}</span>
                    <span className="text-[10px] font-mono text-[#A3C4A3]">→</span>
                  </div>
                  <span className="text-[10px] text-white/60">{formatWeight(kit.total_weight_g || 0)} · {kit.items?.length || 0} articles</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prompt input */}
        <form
          onSubmit={(e) => { e.preventDefault(); runAi(aiInput); setAiInput(''); }}
          className="mt-3 shrink-0 flex items-center gap-2 rounded-2xl bg-black/25 border border-white/12 px-2.5 py-1.5"
        >
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Pose une question au copilote…"
            className="flex-1 bg-transparent text-xs text-white placeholder-white/45 focus:outline-none py-1"
            aria-label="Question au copilote IA"
          />
          <button type="submit" disabled={aiStreaming || !aiInput.trim()} className="w-7 h-7 rounded-full bg-[#A3C4A3] text-[#0B1F17] flex items-center justify-center text-sm font-bold disabled:opacity-40 transition-all active:scale-90" aria-label="Envoyer">↑</button>
        </form>
      </div>
    </GlassCard>
  );
}
