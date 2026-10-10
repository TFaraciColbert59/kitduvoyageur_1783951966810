'use client';

import React from 'react';
import Sheet from '@/components/ui/Sheet';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface PostActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaved?: boolean;
  onToggleSave: () => void;
  onWhyThis?: () => void;
  onLessLikeThis: () => void;
  onHide: () => void;
  onShare?: () => void;
  onReport: () => void;
  hasTransparency?: boolean;
}

export default function PostActionSheet({
  open,
  onOpenChange,
  isSaved = false,
  onToggleSave,
  onWhyThis,
  onLessLikeThis,
  onHide,
  onShare,
  onReport,
  hasTransparency = true,
}: PostActionSheetProps) {
  const { triggerHaptic } = useHapticFeedback();

  const handleAction = (callback?: () => void, hapticStyle: 'light' | 'medium' | 'selection' | 'warning' = 'light') => {
    triggerHaptic(hapticStyle);
    onOpenChange(false);
    callback?.();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Options de la publication"
      hideTitle={false}
      dragToDismiss={true}
      detent="auto"
    >
      <div className="space-y-[var(--space-2)] pt-[var(--space-1)] text-[color:var(--lkv-text-primary)]">
        {/* Action 1: Enregistrer / Retirer des favoris */}
        <button
          type="button"
          onClick={() => handleAction(onToggleSave, 'selection')}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-transparent px-[var(--space-4)] py-[var(--space-3)] text-left transition-colors active:scale-[0.98] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <div className="flex items-center gap-[var(--space-3)]">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isSaved ? 'bg-[color:var(--lkv-action)]/15 text-[color:var(--lkv-action)]' : 'bg-[color:var(--glass-bg-subtle)] text-[color:var(--lkv-text-secondary)]'}`}>
              <Icon name="bookmark" size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                {isSaved ? 'Retirer des favoris' : 'Enregistrer dans mes favoris'}
              </p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                {isSaved ? 'Supprimer de votre carnet de sauvegarde' : 'Retrouver facilement cette sortie plus tard'}
              </p>
            </div>
          </div>
          {isSaved && (
            <span className="font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-action)]">
              Enregistré ✓
            </span>
          )}
        </button>

        {/* Action 2: Transparence algorithmique Feed V1 */}
        {hasTransparency && (
          <button
            type="button"
            onClick={() => handleAction(onWhyThis, 'light')}
            className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-transparent px-[var(--space-4)] py-[var(--space-3)] text-left transition-colors active:scale-[0.98] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          >
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-action)]/10 text-[color:var(--lkv-action)]">
                <Icon name="sparkles" size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                  Pourquoi je vois ce contenu
                </p>
                <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                  Consulter les critères de recommandation et d&apos;utilité terrain
                </p>
              </div>
            </div>
            <Icon name="chevron-right" size={16} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
          </button>
        )}

        {/* Action 3: Partage direct */}
        {onShare && (
          <button
            type="button"
            onClick={() => handleAction(onShare, 'light')}
            className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-transparent px-[var(--space-4)] py-[var(--space-3)] text-left transition-colors active:scale-[0.98] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          >
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--glass-bg-subtle)] text-[color:var(--lkv-text-secondary)]">
                <Icon name="link" size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                  Copier le lien direct
                </p>
                <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                  Partager ce récit avec un compagnon d&apos;aventure
                </p>
              </div>
            </div>
          </button>
        )}

        <div className="my-[var(--space-1)] h-px bg-[color:var(--lkv-border)]" role="separator" />

        {/* Action 4: Moins comme ceci */}
        <button
          type="button"
          onClick={() => handleAction(onLessLikeThis, 'medium')}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-transparent px-[var(--space-4)] py-[var(--space-3)] text-left transition-colors active:scale-[0.98] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--glass-bg-subtle)] text-[color:var(--lkv-text-secondary)]">
              <Icon name="MinusCircleIcon" size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                Moins comme ceci
              </p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                Ajuster vos préférences pour réduire ce type de suggestions
              </p>
            </div>
          </div>
        </button>

        {/* Action 5: Masquer */}
        <button
          type="button"
          onClick={() => handleAction(onHide, 'medium')}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-transparent px-[var(--space-4)] py-[var(--space-3)] text-left transition-colors active:scale-[0.98] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--glass-bg-subtle)] text-[color:var(--lkv-text-secondary)]">
              <Icon name="eye-off" size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--lkv-text-primary)]">
                Masquer cette publication
              </p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
                Retirer définitivement ce post de votre fil
              </p>
            </div>
          </div>
        </button>

        <div className="my-[var(--space-1)] h-px bg-[color:var(--lkv-border)]" role="separator" />

        {/* Action 6: Signaler (Destructive styling) */}
        <button
          type="button"
          onClick={() => handleAction(onReport, 'warning')}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--lkv-radius-md)] border border-transparent px-[var(--space-4)] py-[var(--space-3)] text-left text-[color:var(--lkv-danger)] transition-colors active:scale-[0.98] hover:bg-[color:var(--lkv-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger)]">
              <Icon name="flag" size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[length:var(--lkv-text-subheadline)] font-semibold">
                Signaler la publication
              </p>
              <p className="text-[length:var(--lkv-text-caption)] opacity-80">
                Informations erronées, danger non signalé ou comportement inapproprié
              </p>
            </div>
          </div>
        </button>

        {/* Cancel button at bottom (iOS Action Sheet style) */}
        <div className="pt-[var(--space-3)]">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenChange(false);
            }}
            className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] font-medium text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] active:scale-[0.99]"
          >
            Annuler
          </button>
        </div>
      </div>
    </Sheet>
  );
}
