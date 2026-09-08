'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Volume2Icon as Volume2 } from '@/components/icons/volume-2';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface MobileFloatingIslandProps {
  totalCount: number;
  remainingCount: number;
  filterMode: 'all' | 'remaining';
  onFilterChange: (mode: 'all' | 'remaining') => void;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
  onQuickAdd: () => void;
  className?: string;
}

/**
 * MobileFloatingIsland — Bottom Floating Capsule (« Liquid Island »)
 *
 * Adheres to Apple iOS 18 HIG & LKDV Mobile Terrain UX:
 * - Floating thumb-zone controller anchored above env(safe-area-inset-bottom)
 * - Master Liquid Glass styling: rounded-full, backdrop-blur-md, soft shadow & subtle borders
 * - Segmented Control for 'Tous ({totalCount})' and 'Restants ({remainingCount})'
 * - Quick Audio TTS readout toggle with active wave/pulse state
 * - High-contrast Emerald Quick Add button (+), min 44-48px touch target
 * - Framer Motion spring physics with useReducedMotion accessibility support
 */
export function MobileFloatingIsland({
  totalCount = 0,
  remainingCount = 0,
  filterMode = 'all',
  onFilterChange,
  isSpeaking = false,
  onToggleSpeak,
  onQuickAdd,
  className,
}: MobileFloatingIslandProps) {
  const shouldReduceMotion = useReducedMotion();
  // Wrapper haptique unique (mission gestes, Phase 7) — remplace navigator.vibrate direct.
  // Signature zéro-arg conservée (l'ancien vibrate(8) = feedback léger).
  const { haptic } = useHapticFeedback();
  const triggerHaptic = () => haptic('light');

  return (
    <motion.nav
      role="region"
      aria-label="Contrôles mobiles rapides"
      initial={shouldReduceMotion ? undefined : { y: 30, opacity: 0, scale: 0.95 }}
      animate={shouldReduceMotion ? undefined : { y: 0, opacity: 1, scale: 1 }}
      exit={shouldReduceMotion ? undefined : { y: 30, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-40 mb-[env(safe-area-inset-bottom)]',
        'flex items-center gap-1.5 p-1.5 px-3',
        'rounded-full bg-white/85 dark:bg-stone-900/90 border border-white/80 dark:border-white/20',
        'shadow-lg backdrop-blur-md text-[var(--lkv-primary)] dark:text-stone-100',
        'max-w-[calc(100vw-24px)] select-none',
        className
      )}
    >
      {/* ════ 1. SEGMENTED CONTROL: TOUS / RESTANTS ════ */}
      <div
        role="tablist"
        aria-label="Filtrer les équipements"
        className="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/10 gap-0.5"
      >
        {/* Onglet 'Tous' */}
        <button
          type="button"
          role="tab"
          aria-selected={filterMode === 'all'}
          aria-label={`Tous les équipements (${totalCount})`}
          onClick={() => {
            triggerHaptic();
            onFilterChange('all');
          }}
          className={cn(
            'relative min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all',
            'flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary-hover)]',
            filterMode === 'all'
              ? 'bg-white dark:bg-stone-800 text-[var(--lkv-primary)] dark:text-white shadow-xs font-bold'
              : 'text-[var(--lkv-text-muted)] dark:text-stone-400 hover:text-[var(--lkv-primary)] dark:hover:text-white'
          )}
        >
          <span>Tous</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold leading-none',
              filterMode === 'all'
                ? 'bg-[var(--lkv-primary)]/10 dark:bg-white/20 text-[var(--lkv-primary)] dark:text-white'
                : 'bg-black/5 dark:bg-white/10 text-[var(--lkv-text-muted)] dark:text-stone-400'
            )}
          >
            {totalCount}
          </span>
        </button>

        {/* Onglet 'Restants' */}
        <button
          type="button"
          role="tab"
          aria-selected={filterMode === 'remaining'}
          aria-label={`Équipements restants (${remainingCount})`}
          onClick={() => {
            triggerHaptic();
            onFilterChange('remaining');
          }}
          className={cn(
            'relative min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all',
            'flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary-hover)]',
            filterMode === 'remaining'
              ? 'bg-white dark:bg-stone-800 text-[var(--lkv-primary)] dark:text-white shadow-xs font-bold'
              : 'text-[var(--lkv-text-muted)] dark:text-stone-400 hover:text-[var(--lkv-primary)] dark:hover:text-white'
          )}
        >
          <span>Restants</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold leading-none',
              filterMode === 'remaining'
                ? remainingCount > 0
                  ? 'bg-[var(--lkv-warning)]/20 text-[var(--lkv-warning)]'
                  : 'bg-[var(--lkv-primary)]/10 dark:bg-white/20 text-[var(--lkv-primary)] dark:text-white'
                : 'bg-black/5 dark:bg-white/10 text-[var(--lkv-text-muted)] dark:text-stone-400'
            )}
          >
            {remainingCount}
          </span>
        </button>
      </div>

      {/* ════ 2. BOUTON AUDIO TTS (LECTURE VOCALE) ════ */}
      <button
        type="button"
        aria-label={
          isSpeaking
            ? 'Arrêter la lecture vocale'
            : 'Lire à voix haute les articles restants'
        }
        aria-pressed={isSpeaking}
        onClick={() => {
          triggerHaptic();
          onToggleSpeak();
        }}
        className={cn(
          'min-h-[44px] min-w-[44px] w-11 h-11 rounded-full flex items-center justify-center',
          'transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary-hover)]',
          isSpeaking
            ? 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] border border-[var(--lkv-primary)]/30 animate-pulse ring-2 ring-[var(--lkv-primary)]/40'
            : 'bg-black/5 dark:bg-white/10 text-[var(--lkv-primary)] dark:text-stone-200 border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95'
        )}
      >
        <Volume2
          className={cn('w-5 h-5', isSpeaking ? 'text-[var(--lkv-primary)]' : 'opacity-85')}
          strokeWidth={isSpeaking ? 2.2 : 1.8}
        />
      </button>

      {/* ════ 3. BOUTON AJOUT RAPIDE (+) ════ */}
      <button
        type="button"
        aria-label="Ajouter un équipement"
        onClick={() => {
          triggerHaptic();
          onQuickAdd();
        }}
        className={cn(
          'min-h-[44px] min-w-[44px] w-11 h-11 rounded-full flex items-center justify-center',
          'bg-[var(--lkv-primary)] hover:bg-[var(--lkv-secondary)] active:scale-95 text-white shadow-md',
          'cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--lkv-primary)]'
        )}
      >
        <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
      </button>
    </motion.nav>
  );
}
