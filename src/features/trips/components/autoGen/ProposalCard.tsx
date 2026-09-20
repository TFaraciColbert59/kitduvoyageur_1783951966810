'use client';

import Icon from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import React, { useState } from 'react';
import type { Proposal, LayerId } from '@/features/trips/schemas/autoGen.schema';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Badge, Button, Card, IconButton } from '@/components/ui';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

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
    <Card
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-locked={proposal.locked ? 'true' : 'false'}
      tone={proposal.locked ? 'warn' : 'neutral'}
      className="relative select-none transition-all duration-200"
    >
      {/* En-tête : Couche + Provenance + Cadenas (Geste 2) */}
      <div className="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)]">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <Badge tone="stone">{LAYER_LABELS[proposal.layer] || proposal.layer}</Badge>
          {currentItem.confidence === 'low' || currentItem.provenance?.source === 'estimated' ? (
            <Badge tone="warn" className="gap-1">
              <Icon name="help-circle" size={12} className="text-[color:var(--lkv-warning-dark)]" />
              <span className="font-medium">Estimation</span>
              {currentItem.provenance?.sourceRef && (
                <span className="hidden text-[color:var(--lkv-warning-dark)] sm:inline">
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
                className="ml-1 inline-flex items-center text-[10px] font-semibold text-[color:var(--lkv-warning-dark)] underline underline-offset-2 hover:text-[color:var(--lkv-warning-dark)]"
                onClick={(e) => e.stopPropagation()}
              >
                vérifier
                <Icon name="external-link" size={10} className="ml-0.5" />
              </a>
            </Badge>
          ) : (
            <span className="flex items-center text-[11px] text-[color:var(--lkv-text-muted)]">
              <Icon name="shield-check" size={14} className="mr-1 text-[color:var(--lkv-secondary)]" />
              {PROVENANCE_LABELS[currentItem.provenance?.source] || currentItem.provenance?.source}
              {currentItem.provenance?.sourceRef && ` · ${currentItem.provenance.sourceRef}`}
            </span>
          )}
        </div>

        {/* Bouton de Verrouillage (Geste 2) — Target >= 44x44px */}
        <IconButton
          type="button"
          size="sm"
          variant={proposal.locked ? 'solid' : 'ghost'}
          onClick={toggleLock}
          aria-label={
            proposal.locked ? 'Déverrouiller cette proposition' : 'Verrouiller cette proposition'
          }
        >
          {proposal.locked ? <Icon name="lock" size={16} /> : <Icon name="unlock" size={16} />}
        </IconButton>
      </div>

      {/* Corps principal : Titre / Valeur */}
      <div className="my-[var(--space-2)]">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[length:var(--lkv-text-body)] font-semibold leading-snug text-[color:var(--lkv-text-primary)]">
            {valueName}
          </h4>
          {priceEur !== undefined && (
            <span className="ml-[var(--space-2)] font-mono text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
              {priceEur} €
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          {currentItem.rationale}
        </p>
      </div>

      {/* Barre basse : Geste 1 (Balayage / Alternatives) & Geste 3 (Dictée) */}
      <div className="mt-[var(--space-3)] flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
        {/* Contrôles d'alternatives (Geste 1) */}
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            type="button"
            size="sm"
            onClick={handlePrevAlt}
            disabled={activeAltIndex === 0}
            aria-label="Alternative précédente"
          >
            <Icon name="chevron-left" size={16} />
          </IconButton>
          <span className="px-1 font-mono text-[length:var(--lkv-text-footnote)]">
            {activeAltIndex + 1} / {totalProposals}
          </span>
          <IconButton
            type="button"
            size="sm"
            onClick={handleNextAlt}
            disabled={activeAltIndex >= totalProposals - 1}
            aria-label="Alternative suivante"
          >
            <Icon name="chevron-right" size={16} />
          </IconButton>
          <span className="ml-1 hidden text-[11px] text-[color:var(--lkv-text-muted)] sm:inline">
            Balayer pour alterner
          </span>
        </div>

        {/* Contrôle Dictée / Réglage fin (Geste 3) */}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleVoiceEdit}
          aria-label="Ajuster par commande vocale"
          icon={<Icon name="mic" size={14} className="text-[color:var(--lkv-secondary)]" />}
        >
          Ajuster
        </Button>
      </div>

      {/* Impact tags */}
      {currentItem.impacts && currentItem.impacts.length > 0 && (
        <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-1)]">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--lkv-text-muted)]">
            Impact :
          </span>
          {currentItem.impacts.map((imp: string) => (
            <Badge key={imp} tone="warn">
              {imp.replace('slot-', '')}
            </Badge>
          ))}
        </div>
      )}

      {/* Modale d'édition rapide (ex-window.prompt, règle Y-D80 n°5) */}
      <Modal
        open={editOpen}
        onOpenChange={(v) => !v && setEditOpen(false)}
        title="Ajuster ce composant"
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={submitEdit} disabled={!editValue.trim()}>
              Appliquer
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
          placeholder="Ajustez ce composant par commande vocale ou texte :"
          className={FIELD_CLASS}
        />
      </Modal>
    </Card>
  );
};
