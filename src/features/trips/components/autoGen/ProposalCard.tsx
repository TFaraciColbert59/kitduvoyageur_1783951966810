'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import type { Proposal, LayerId } from '@/features/trips/schemas/autoGen.schema';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ProposalCardProps {
  proposal: Proposal<any>;
  onLockToggle: (proposalId: string, locked: boolean) => void;
  onSelectAlternative: (proposalId: string, alternativeIndex: number) => void;
  onEditPrompt?: (proposalId: string, newInstruction: string) => void;
}

const LAYER_LABELS: Record<LayerId, string> = {
  skeleton: 'Squelette & Rythme',
  itinerary: 'Itinéraire & Tracé',
  major_transport: 'Transport Principal',
  local_transport: 'Mobilité Locale',
  accommodations: 'Hébergement',
  food_water: 'Alimentation & Eau',
  kit: 'Équipement & Sac',
  poi: 'Points d’Intérêt',
  budget: 'Budget & Dépenses',
  compliance: 'Réglementation & Accès',
  safety: 'Sécurité & Secours',
  know_how: 'Compétences & Météo',
};

const PROVENANCE_LABELS: Record<string, string> = {
  official: 'Officiel',
  measured: 'Mesuré terrain',
  computed: 'Calculé',
  community: 'Communauté',
  estimated: 'Estimé',
  suggested: 'Suggéré',
};

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onLockToggle,
  onSelectAlternative,
  onEditPrompt,
}) => {
  const { haptic } = useHapticFeedback();
  const [activeAltIndex, setActiveAltIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState('');

  const totalProposals = 1 + (proposal.alternatives?.length || 0);
  const allProposals = [proposal, ...(proposal.alternatives || [])];
  const currentItem = allProposals[activeAltIndex] || proposal;

  const handlePrevAlt = () => {
    if (activeAltIndex > 0) {
      const nextIndex = activeAltIndex - 1;
      setActiveAltIndex(nextIndex);
      haptic('selection');
      onSelectAlternative(proposal.id, nextIndex);
    }
  };

  const handleNextAlt = () => {
    if (activeAltIndex < totalProposals - 1) {
      const nextIndex = activeAltIndex + 1;
      setActiveAltIndex(nextIndex);
      haptic('selection');
      onSelectAlternative(proposal.id, nextIndex);
    }
  };

  // Geste 1 : Détection du balayage (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNextAlt(); // Balayage vers la gauche -> suivant
      } else {
        handlePrevAlt(); // Balayage vers la droite -> précédent
      }
    }
    setTouchStartX(null);
  };

  // Geste 2 : Verrouillage (Lock)
  const toggleLock = () => {
    const nextLocked = !proposal.locked;
    haptic(nextLocked ? 'medium' : 'light');
    onLockToggle(proposal.id, nextLocked);
  };

  // Geste 3 : Dictée / Édition rapide
  const handleVoiceEdit = () => {
    haptic('light');
    setEditValue('');
    setEditOpen(true);
  };

  const submitEdit = () => {
    setEditOpen(false);
    if (editValue.trim() && onEditPrompt) {
      onEditPrompt(proposal.id, editValue.trim());
    }
  };

  const valueName =
    currentItem.value?.name ||
    currentItem.value?.title ||
    (currentItem.value?.totalDistanceKm
      ? `${currentItem.value.totalDistanceKm} km · +${currentItem.value.totalGainM} m`
      : currentItem.value?.targetWeightKg
        ? `Sac de ${currentItem.value.targetWeightKg} kg`
        : currentItem.rationale);

  const priceEur = currentItem.value?.priceEur ?? currentItem.value?.totalPerPersonEur;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-locked={proposal.locked ? 'true' : 'false'}
      className={`relative rounded-2xl p-4 transition-all duration-200 border select-none ${
        proposal.locked
          ? 'bg-[var(--lkv-warning-bg)]  border-[var(--lkv-warning)]  shadow-md'
          : 'bg-white/90  border-[var(--lkv-stone-200)]  shadow-sm hover:shadow-md'
      }`}
    >
      {/* En-tête : Couche + Provenance + Cadenas (Geste 2) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--lkv-surface-muted)]  text-[var(--lkv-text-secondary)] ">
            {LAYER_LABELS[proposal.layer] || proposal.layer}
          </span>
          {currentItem.confidence === 'low' || currentItem.provenance?.source === 'estimated' ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--lkv-warning)]  text-[var(--lkv-warning-dark)]  border border-[var(--lkv-warning)] ">
              <Icon name="help-circle" className="w-3 h-3 text-[var(--lkv-warning-dark)] " />
              <span className="font-medium">Estimation</span>
              {currentItem.provenance?.sourceRef && (
                <span className="text-[var(--lkv-warning-dark)]  hidden sm:inline">
                  · {currentItem.provenance.sourceRef}
                </span>
              )}
              <a
                href={
                  currentItem.verifyUrl ||
                  `https://www.google.com/search?q=${encodeURIComponent(`${proposal.layer} ${valueName}`)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-[10px] font-semibold underline underline-offset-2 ml-1 text-[var(--lkv-warning-dark)]  hover:text-[var(--lkv-warning-dark)]"
                onClick={(e) => e.stopPropagation()}
              >
                vérifier
                <Icon name="external-link" className="w-2.5 h-2.5 ml-0.5" />
              </a>
            </span>
          ) : (
            <span className="flex items-center text-[11px] text-[var(--lkv-text-muted)] ">
              <Icon name="shield-check" className="w-3.5 h-3.5 mr-1 text-[var(--lkv-secondary)]" />
              {PROVENANCE_LABELS[currentItem.provenance?.source] || currentItem.provenance?.source}
              {currentItem.provenance?.sourceRef && ` · ${currentItem.provenance.sourceRef}`}
            </span>
          )}
        </div>

        {/* Bouton de Verrouillage (Geste 2) — Target >= 44x44px */}
        <button
          type="button"
          onClick={toggleLock}
          aria-label={
            proposal.locked ? 'Déverrouiller cette proposition' : 'Verrouiller cette proposition'
          }
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
            proposal.locked
              ? 'bg-[var(--lkv-warning)] text-white shadow-sm'
              : 'text-[var(--lkv-text-subtle)] hover:text-[var(--lkv-text-muted)]  hover:bg-[var(--lkv-surface-muted)] '
          }`}
        >
          {proposal.locked ? (
            <Icon name="lock" className="w-4 h-4" />
          ) : (
            <Icon name="unlock" className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Corps principal : Titre / Valeur */}
      <div className="my-2">
        <div className="flex items-baseline justify-between">
          <h4 className="font-semibold text-[var(--lkv-text-primary)]  text-base leading-snug">
            {valueName}
          </h4>
          {priceEur !== undefined && (
            <span className="font-mono font-bold text-[var(--lkv-text-primary)]  text-base ml-2">
              {priceEur} €
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--lkv-text-muted)]  mt-1 line-clamp-2">
          {currentItem.rationale}
        </p>
      </div>

      {/* Barre basse : Geste 1 (Balayage / Alternatives) & Geste 3 (Dictée) */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--lkv-surface-muted)]  mt-3 text-xs text-[var(--lkv-text-muted)]">
        {/* Contrôles d'alternatives (Geste 1) */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevAlt}
            disabled={activeAltIndex === 0}
            aria-label="Alternative précédente"
            className="p-1.5 min-w-[var(--lkv-touch-min)] min-h-[var(--lkv-touch-min)] flex items-center justify-center rounded-lg hover:bg-[var(--lkv-surface-muted)]  disabled:opacity-30"
          >
            <Icon name="chevron-left" className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs px-1">
            {activeAltIndex + 1} / {totalProposals}
          </span>
          <button
            type="button"
            onClick={handleNextAlt}
            disabled={activeAltIndex >= totalProposals - 1}
            aria-label="Alternative suivante"
            className="p-1.5 min-w-[var(--lkv-touch-min)] min-h-[var(--lkv-touch-min)] flex items-center justify-center rounded-lg hover:bg-[var(--lkv-surface-muted)]  disabled:opacity-30"
          >
            <Icon name="chevron-right" className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-[var(--lkv-text-subtle)] ml-1 hidden sm:inline">
            Balayer pour alterner
          </span>
        </div>

        {/* Contrôle Dictée / Réglage fin (Geste 3) */}
        <button
          type="button"
          onClick={handleVoiceEdit}
          aria-label="Ajuster par commande vocale"
          className="flex items-center space-x-1 px-2.5 py-1.5 min-h-[var(--lkv-touch-min)] text-xs font-medium rounded-lg text-[var(--lkv-text-muted)]  hover:bg-[var(--lkv-surface-muted)] "
        >
          <Icon name="mic" className="w-3.5 h-3.5 text-[var(--lkv-secondary)]" />
          <span>Ajuster</span>
        </button>
      </div>

      {/* Impact tags */}
      {currentItem.impacts && currentItem.impacts.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] uppercase font-semibold text-[var(--lkv-text-subtle)]">
            Impact :
          </span>
          {currentItem.impacts.map((imp: string) => (
            <span
              key={imp}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--lkv-warning-bg)]  text-[var(--lkv-warning-dark)]  font-medium"
            >
              {imp.replace('slot-', '')}
            </span>
          ))}
        </div>
      )}

      {/* Modale d'édition rapide (ex-window.prompt, règle Y-D80 n°5) */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Ajuster ce composant"
        >
          <div className="glass rounded-[var(--lkv-radius-xl)] border border-white/70 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--lkv-text-primary)] flex items-center gap-2">
                <Icon name="mic" size={16} className="text-[var(--lkv-secondary)]" />
                Ajuster ce composant
              </h4>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-secondary)] hover:bg-white transition-all cursor-pointer"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
              placeholder="Ajustez ce composant par commande vocale ou texte :"
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="glass-capsule-btn px-4 py-2 text-xs font-semibold text-[var(--lkv-text-secondary)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={!editValue.trim()}
                className="glass-capsule-btn primary px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
