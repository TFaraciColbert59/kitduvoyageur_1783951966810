'use client';
import Icon from '@/components/ui/Icon';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Badge, Button, IconButton } from '@/components/ui';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { resolveGearImage } from '@/features/materiel/services/gearImageResolver';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
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
 * - 48px interactive touch target with 32px circular check fill in emerald (emerald)
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
  const { haptic } = useHapticFeedback();
  const imageUrl = resolveGearImage(item.name, item.category, item.photoUrl);

  const handleToggle = () => {
    // Wrapper haptique unique (mission gestes, Phase 7) — remplace navigator.vibrate direct.
    haptic('light');
    onToggle(item);
  };

  return (
    <div className={cn('relative w-full select-none overflow-hidden rounded-2xl', className)}>
      {/* ════ ARRIÈRE-PLAN GESTUELLE SWIPE-TO-PACK / SUPPRESSION ════ */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-between px-4 rounded-2xl transition-colors',
          item.is_checked
            ? 'bg-[var(--lkv-warning)] text-white'
            : 'bg-[var(--lkv-primary-hover)] text-white'
        )}
        aria-hidden="true"
      >
        <div className="flex items-center gap-2 font-bold text-xs">
          <Icon name="check" size={18} strokeWidth={3} />
          <span>{item.is_checked ? 'Déballer' : 'Packé !'}</span>
        </div>
        {onDelete && (
          <div className="flex items-center gap-1 font-bold text-xs text-[var(--lkv-danger-bg)]">
            <Icon name="trash2" size={16} />
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
          'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn',
          item.is_checked && 'bg-[color:var(--glass-bg-medium)] border-[color:var(--glass-border)] opacity-80 hover:opacity-100',
          isHighlighted &&
            'ring-2 ring-[var(--lkv-danger)] bg-[var(--lkv-danger)]/10 border-[var(--lkv-danger)]/25'
        )}
      >
        {/* ════ GAUCHE : COCHE CIRCULAIRE 32PX DANS HIT-BOX 48PX APPLE HIG ════ */}
        <Button
          variant="ghost"
          role="checkbox"
          aria-checked={item.is_checked}
          aria-label={`${item.is_checked ? 'Décocher' : 'Cocher'} : ${item.name}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 rounded-full p-0 hover:bg-transparent focus-visible:ring-[var(--lkv-primary-hover)]"
        >
          <div
            className={cn(
              'w-8 h-8 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 shadow-2xs',
              item.is_checked
                ? 'bg-[color:var(--btn-tint)] border-[color:var(--btn-glass-border)] text-[color:var(--lkv-text-primary)] shadow-xs'
                : 'border-[var(--lkv-text-muted)]/40 bg-[color:var(--btn-tint)] text-transparent hover:border-[var(--lkv-primary-hover)]'
            )}
          >
            {item.is_checked && (
              <motion.span
                initial={shouldReduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <Icon name="check" size={14} strokeWidth={3} className="text-[color:var(--lkv-text-primary)]" />
              </motion.span>
            )}
          </div>
        </Button>

        {/* ════ CENTRE : NOM SF PRO, POIDS FORMATÉ ET PASTILLES SÉCURITÉ ════ */}
        <div
          className="flex-1 min-w-0 flex flex-col justify-center py-0.5 cursor-pointer"
          onClick={handleToggle}
        >
          <span
            className={cn(
              'text-[13.5px] font-bold tracking-tight text-[var(--lkv-primary)] truncate leading-snug',
              item.is_checked &&
                'line-through text-[var(--lkv-text-muted)] decoration-[var(--lkv-text-muted)]/60 font-medium'
            )}
          >
            {item.name}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[11px] font-mono font-semibold text-[var(--lkv-text-muted)]">
              {formatWeight(item.weight_g)}
            </span>
            {item.quantity && item.quantity > 1 && (
              <span className="text-[10px] font-mono font-bold text-[var(--lkv-text-muted)] bg-black/5 px-1 rounded">
                ×{item.quantity}
              </span>
            )}
            {item.is_vital && (
              <Badge tone="danger" className="gap-0.5 px-1.5 py-0.2 text-[9.5px] font-bold">
                <Icon name="zap" size={8} aria-hidden="true" />
                Vital
              </Badge>
            )}
            {item.is_consumable && (
              <Badge tone="sage" className="gap-0.5 px-1.5 py-0.2 text-[9.5px] font-semibold">
                <Icon name="sparkles" size={8} aria-hidden="true" />
                Consommable
              </Badge>
            )}
            {item.is_worn && (
              <Badge tone="stone" className="px-1.5 py-0.2 text-[9.5px] font-medium">
                Porté
              </Badge>
            )}
          </div>
        </div>

        {/* ════ DROITE : ACTION SUPPRIMER & MINIATURE 36PX ROUNDED-XL ════ */}
        <div className="flex items-center gap-1 shrink-0">
          {onDelete && (
            <IconButton
              variant="ghost"
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              aria-label={`Supprimer : ${item.name}`}
              className="h-12 w-12 min-h-[48px] min-w-[48px] text-[var(--lkv-text-muted)]/60 hover:text-[var(--lkv-danger)] focus-visible:ring-[var(--lkv-danger)]"
            >
              <Icon name="trash2" size={15} aria-hidden="true" />
            </IconButton>
          )}
          <div className="w-9 h-9 shrink-0 rounded-xl overflow-hidden bg-black/5 border border-black/5 shadow-2xs">
            <img src={imageUrl} alt={item.name} loading="lazy" className="w-9 h-9 object-cover" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
