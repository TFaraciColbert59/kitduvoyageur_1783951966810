'use client';

// Hub V4 — FIL D'ACTION : la prochaine chose à faire, toujours en premier.
// Le serveur fournit une liste ORDONNÉE de signaux (règles déterministes) ;
// le client invalide le signal « checklist » si elle est déjà à 100%
// (items réels trip_checklist_items, même source que ChecklistCardBody)
// puis affiche la première action pertinente. Carte pleine largeur, accent, cliquable.
import React from 'react';
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
import type { HubChecklistItem } from '../../server/getHubAdventureData';

export type NextActionKind =
  | 'cockpit'
  | 'raconter'
  | 'navigation'
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
  navigation: Play,
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
 * % de complétion réel de la checklist (items serveur trip_checklist_items).
 * Déterministe : mêmes items → même %. Vide = null (signal conservé, pas
 * de faux « complet » sur une checklist jamais provisionnée).
 */
function checklistPctOf(items: HubChecklistItem[]): number | null {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

export interface NextActionCardProps {
  actions: NextActionSignal[];
  /** Items réels de la checklist (trip_checklist_items) — sortie. */
  checklist?: {
    tripId: string;
    items: HubChecklistItem[];
  };
  /** compact = bandeau mobile dense (hub V6). */
  variant?: 'default' | 'compact';
}

export function NextActionCard({ actions, checklist, variant = 'default' }: NextActionCardProps) {
  const reduceMotion = useReducedMotion();
  const compact = variant === 'compact';
  const checklistPct = checklist ? checklistPctOf(checklist.items) : null;

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
      className={`group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
        compact ? 'rounded-[var(--lkv-radius-md)]' : 'rounded-[var(--lkv-radius-lg)]'
      } ${isAllClear ? '' : 'ring-1 ring-[var(--lkv-primary)]/20'}`}
    >
      <div
        className={`flex items-center transition-transform active:scale-[0.99] ${
          compact ? 'gap-3 rounded-[var(--lkv-radius-md)] p-3' : 'gap-3.5 rounded-[var(--lkv-radius-lg)] p-4'
        } min-h-[44px] ${compact ? 'hub-control-material' : 'hub-content-material'} ${
          isAllClear ? '' : 'lkv-glass-interactive'
        }`}
        style={reduceMotion ? undefined : { transition: 'transform 0.15s ease' }}
      >
        <span
          className={`hub-control-lens flex shrink-0 items-center justify-center rounded-full border ${
            compact ? 'h-9 w-9' : 'h-11 w-11'
          } ${
            isAllClear
              ? 'text-[var(--lkv-secondary)]'
              : 'text-[color:var(--lkv-text-primary)]'
          }`}
        >
          <Icon size={compact ? 16 : 19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block font-medium uppercase tracking-[0.14em] ${
              compact ? 'text-[9px]' : 'text-[10px]'
            } text-[color:var(--lkv-text-muted)]`}
          >
            {isAllClear ? 'À jour' : 'Prochaine action'}
          </span>
          <span
            className={`block truncate font-bold ${compact ? 'text-[13px]' : 'text-sm'} text-[color:var(--lkv-text-primary)]`}
          >
            {picked.title}
          </span>
          <span
            className={`block truncate ${compact ? 'text-[11px]' : 'text-xs'} text-[color:var(--lkv-text-secondary)]`}
          >
            {picked.description}
          </span>
        </span>
        <ArrowRight
          size={compact ? 15 : 17}
          className="shrink-0 text-[color:var(--lkv-text-muted)] transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

export default NextActionCard;
