'use client';

// Hub V4 — FIL D'ACTION : la prochaine chose à faire, toujours en premier.
// Le serveur fournit une liste ORDONNÉE de signaux (règles déterministes) ;
// le client invalide le signal « checklist » si elle est déjà à 100%
// (localStorage, même clé que TripChecklistView) puis affiche la première
// action pertinente. Carte pleine largeur, accent, cliquable.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckSquare,
  CreditCard,
  FileText,
  MessageSquare,
  Play,
  Share2,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { getPreDepartureChecklist } from '@/features/trips/components/TripChecklistView';

export type NextActionKind =
  | 'cockpit'
  | 'raconter'
  | 'safety'
  | 'checklist'
  | 'documents'
  | 'debts'
  | 'tasks'
  | 'discussion'
  | 'invitations'
  | 'all-clear';

export interface NextActionSignal {
  kind: NextActionKind;
  href: string;
  title: string;
  description: string;
}

const ICONS: Record<NextActionKind, LucideIcon> = {
  cockpit: Play,
  raconter: Share2,
  safety: Shield,
  checklist: CheckSquare,
  documents: FileText,
  debts: CreditCard,
  tasks: CheckSquare,
  discussion: MessageSquare,
  invitations: Users,
  'all-clear': Sparkles,
};

/**
 * % de complétion réel de la checklist (localStorage + moteur J-30/J-7/J-1).
 * null = inconnu (SSR / erreur) → le signal checklist reste affiché.
 */
function useChecklistPct(
  tripId: string | null,
  daysUntil: number | null | undefined,
  countryCode: string | null | undefined,
): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!tripId) {
      setPct(null);
      return;
    }
    try {
      const raw = localStorage.getItem(`lkv_trip_checklist_${tripId}`);
      const checked = raw ? (JSON.parse(raw) as string[]) : [];
      const cl = getPreDepartureChecklist(daysUntil ?? null, countryCode ?? null);
      const all = [...cl.j30, ...cl.j7, ...cl.j1];
      const done = all.filter((i) => checked.includes(i.id)).length;
      setPct(all.length > 0 ? Math.round((done / all.length) * 100) : 100);
    } catch {
      setPct(null);
    }
  }, [tripId, daysUntil, countryCode]);
  return pct;
}

export interface NextActionCardProps {
  actions: NextActionSignal[];
  /** Contexte checklist (localStorage + moteur J-30/J-7/J-1) — sortie. */
  checklist?: {
    tripId: string;
    daysUntil: number | null;
    countryCode: string | null | undefined;
  };
}

export function NextActionCard({ actions, checklist }: NextActionCardProps) {
  const reduceMotion = useReducedMotion();
  const checklistPct = useChecklistPct(
    checklist?.tripId ?? null,
    checklist?.daysUntil ?? null,
    checklist?.countryCode ?? null,
  );

  const picked =
    actions.find((a) => {
      if (a.kind === 'checklist' && checklistPct !== null && checklistPct >= 100) return false;
      return true;
    }) ?? actions[0];

  if (!picked) return null;
  const Icon = ICONS[picked.kind] ?? Sparkles;
  const isAllClear = picked.kind === 'all-clear';

  return (
    <Link
      href={picked.href}
      className={`group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] rounded-2xl ${
        isAllClear ? '' : 'ring-1 ring-[var(--lkv-primary)]/20'
      }`}
    >
      <div
        className={`flex items-center gap-3.5 rounded-2xl border p-4 min-h-[44px] transition-transform active:scale-[0.99] ${
          isAllClear
            ? 'border-white/60 bg-white/55'
            : 'border-[var(--lkv-forest-900)]/15 bg-[var(--lkv-forest-900)] text-sage-300 shadow-md'
        }`}
        style={reduceMotion ? undefined : { transition: 'transform 0.15s ease' }}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
            isAllClear
              ? 'border-white/60 bg-white/70 text-[var(--lkv-secondary)]'
              : 'border-white/20 bg-white/10 text-sage-300'
          }`}
        >
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[10px] font-mono font-bold uppercase tracking-widest ${
              isAllClear ? 'text-[var(--lkv-text-muted)]' : 'text-sage-300/80'
            }`}
          >
            {isAllClear ? 'À jour' : 'Prochaine action'}
          </span>
          <span
            className={`block truncate text-sm font-bold ${
              isAllClear ? 'text-[var(--lkv-text-primary)]' : 'text-white'
            }`}
          >
            {picked.title}
          </span>
          <span
            className={`block truncate text-xs ${
              isAllClear ? 'text-[var(--lkv-text-secondary)]' : 'text-white/70'
            }`}
          >
            {picked.description}
          </span>
        </span>
        <ArrowRight
          size={17}
          className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
            isAllClear ? 'text-[var(--lkv-text-muted)]' : 'text-white/80'
          }`}
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

export default NextActionCard;
