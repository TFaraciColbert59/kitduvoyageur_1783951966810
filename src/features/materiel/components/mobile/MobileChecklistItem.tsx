'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Zap, Sparkles, Trash2 } from 'lucide-react';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { resolveGearImage } from '@/features/materiel/services/gearImageResolver';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

export interface MobileChecklistItemProps {
  item: ChecklistItem;
  onToggle: (item: ChecklistItem) => void;
  onDelete?: (item: ChecklistItem) => void;
  isHighlighted?: boolean;
  className?: string;
}

/**
 * MobileChecklistItem — Apple Reminders Style Equipment Row with Swipe-to-Pack
 *
 * Adheres to Apple iOS 18 Human Interface Guidelines:
 * - 48px interactive touch target with 32px circular check fill in emerald (#2D6B4A)
 * - SF Pro bold typography with strike-through completion and metadata tags (Vital, Consumable, Worn)
 * - 36px rounded-xl gear image thumbnail with automatic fallback
 * - Framer Motion horizontal Swipe-to-Pack gesture with spring physics
 * - Subtle haptic vibration feedback on toggle (8ms)
 */
export function MobileChecklistItem({
  item,
  onToggle,
  onDelete,
  isHighlighted = false,
  className,
}: MobileChecklistItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const imageUrl = resolveGearImage(item.name, item.category, item.photoUrl);

  const handleToggle = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Fallback gracefully on environments without vibration support
      }
    }
    onToggle(item);
  };

  return (
    <div className={cn('relative w-full select-none overflow-hidden rounded-2xl', className)}>
      {/* ════ ARRIÈRE-PLAN GESTUELLE SWIPE-TO-PACK / SUPPRESSION ════ */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-between px-4 rounded-2xl transition-colors',
          item.is_checked ? 'bg-amber-600/90 text-white' : 'bg-[#2D6B4A] text-white'
        )}
        aria-hidden="true"
      >
        <div className="flex items-center gap-2 font-bold text-xs">
          <Check size={18} strokeWidth={3} />
          <span>{item.is_checked ? 'Déballer' : 'Packé !'}</span>
        </div>
        {onDelete && (
          <div className="flex items-center gap-1 font-bold text-xs text-rose-100">
            <Trash2 size={16} />
            <span>Supprimer</span>
          </div>
        )}
      </div>

      {/* ════ SURFACE PRINCIPALE GLISSANTE SWIPE-TO-PACK (Framer Motion) ════ */}
      <motion.div
        drag="x"
        dragConstraints={{ left: onDelete ? -80 : 0, right: 100 }}
        dragElastic={{ left: onDelete ? 0.2 : 0.05, right: 0.2 }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 60 || info.velocity.x > 300) {
            handleToggle();
          } else if (onDelete && (info.offset.x < -60 || info.velocity.x < -300)) {
            onDelete(item);
          }
        }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'relative z-10 w-full flex items-center justify-between gap-2.5 px-2 py-1.5 rounded-2xl transition-all',
          'bg-white dark:bg-stone-900 border border-white/90 dark:border-white/10 shadow-2xs',
          item.is_checked && 'bg-stone-50/95 dark:bg-stone-900/95 opacity-80 hover:opacity-100',
          isHighlighted && 'ring-2 ring-[#8A241B] bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
        )}
      >
        {/* ════ GAUCHE : COCHE CIRCULAIRE 32PX DANS HIT-BOX 48PX APPLE HIG ════ */}
        <button
          type="button"
          role="checkbox"
          aria-checked={item.is_checked}
          aria-label={`${item.is_checked ? 'Décocher' : 'Cocher'} : ${item.name}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="shrink-0 min-w-[48px] min-h-[48px] w-12 h-12 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6B4A] rounded-full"
        >
          <div
            className={cn(
              'w-8 h-8 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 shadow-2xs',
              item.is_checked
                ? 'bg-[#2D6B4A] border-[#2D6B4A] text-white shadow-xs'
                : 'border-[#5A7064]/40 bg-white dark:bg-stone-800 dark:border-white/20 text-transparent hover:border-[#2D6B4A]'
            )}
          >
            {item.is_checked && (
              <motion.span
                initial={shouldReduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <Check size={14} strokeWidth={3} className="text-white" />
              </motion.span>
            )}
          </div>
        </button>

        {/* ════ CENTRE : NOM SF PRO, POIDS FORMATÉ ET PASTILLES SÉCURITÉ ════ */}
        <div
          className="flex-1 min-w-0 flex flex-col justify-center py-0.5 cursor-pointer"
          onClick={handleToggle}
        >
          <span
            className={cn(
              'text-[13.5px] font-bold tracking-tight text-[#17402C] dark:text-stone-100 truncate leading-snug',
              item.is_checked && 'line-through text-[#5A7064] dark:text-stone-400 decoration-[#5A7064]/60 font-medium'
            )}
          >
            {item.name}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[11px] font-mono font-semibold text-[#5A7064] dark:text-stone-400">
              {formatWeight(item.weight_g)}
            </span>
            {item.quantity && item.quantity > 1 && (
              <span className="text-[10px] font-mono font-bold text-[#5A7064] dark:text-stone-400 bg-black/5 dark:bg-white/10 px-1 rounded">
                ×{item.quantity}
              </span>
            )}
            {item.is_vital && (
              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[#8A241B]/15 text-[#8A241B] dark:bg-rose-950/50 dark:text-rose-300">
                <Zap size={8} aria-hidden="true" />
                Vital
              </span>
            )}
            {item.is_consumable && (
              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Sparkles size={8} aria-hidden="true" />
                Consommable
              </span>
            )}
            {item.is_worn && (
              <span className="inline-flex items-center text-[9.5px] font-medium px-1.5 py-0.2 rounded-full bg-black/5 text-[#5A7064] dark:bg-white/10 dark:text-stone-300">
                Porté
              </span>
            )}
          </div>
        </div>

        {/* ════ DROITE : ACTION SUPPRIMER & MINIATURE 36PX ROUNDED-XL ════ */}
        <div className="flex items-center gap-1 shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              aria-label={`Supprimer : ${item.name}`}
              className="min-w-[48px] min-h-[48px] w-12 h-12 flex items-center justify-center text-[#5A7064]/60 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-full"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
          <div className="w-9 h-9 shrink-0 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-2xs">
            <img
              src={imageUrl}
              alt={item.name}
              loading="lazy"
              className="w-9 h-9 object-cover"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
