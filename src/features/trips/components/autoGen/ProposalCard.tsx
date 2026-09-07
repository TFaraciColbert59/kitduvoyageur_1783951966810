'use client';

import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  Mic,
} from 'lucide-react';
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
    const prompt = window.prompt(
      'Ajustez ce composant par commande vocale ou texte :',
      ''
    );
    if (prompt && onEditPrompt) {
      onEditPrompt(proposal.id, prompt);
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
          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 shadow-md'
          : 'bg-white/90 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md'
      }`}
    >
      {/* En-tête : Couche + Provenance + Cadenas (Geste 2) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {LAYER_LABELS[proposal.layer] || proposal.layer}
          </span>
          {currentItem.confidence === 'low' || currentItem.provenance?.source === 'estimated' ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/40">
              <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">Estimation</span>
              {currentItem.provenance?.sourceRef && (
                <span className="text-amber-700/70 dark:text-amber-400/70 hidden sm:inline">· {currentItem.provenance.sourceRef}</span>
              )}
              <a
                href={currentItem.verifyUrl || `https://www.google.com/search?q=${encodeURIComponent(`${proposal.layer} ${valueName}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-[10px] font-semibold underline underline-offset-2 ml-1 text-amber-900 dark:text-amber-200 hover:text-amber-950"
                onClick={(e) => e.stopPropagation()}
              >
                vérifier
                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </a>
            </span>
          ) : (
            <span className="flex items-center text-[11px] text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
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
            proposal.locked
              ? 'Déverrouiller cette proposition'
              : 'Verrouiller cette proposition'
          }
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
            proposal.locked
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          {proposal.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>

      {/* Corps principal : Titre / Valeur */}
      <div className="my-2">
        <div className="flex items-baseline justify-between">
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-snug">
            {valueName}
          </h4>
          {priceEur !== undefined && (
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-base ml-2">
              {priceEur} €
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
          {currentItem.rationale}
        </p>
      </div>

      {/* Barre basse : Geste 1 (Balayage / Alternatives) & Geste 3 (Dictée) */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-3 text-xs text-zinc-500">
        {/* Contrôles d'alternatives (Geste 1) */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevAlt}
            disabled={activeAltIndex === 0}
            aria-label="Alternative précédente"
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs px-1">
            {activeAltIndex + 1} / {totalProposals}
          </span>
          <button
            type="button"
            onClick={handleNextAlt}
            disabled={activeAltIndex >= totalProposals - 1}
            aria-label="Alternative suivante"
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-zinc-400 ml-1 hidden sm:inline">
            Balayer pour alterner
          </span>
        </div>

        {/* Contrôle Dictée / Réglage fin (Geste 3) */}
        <button
          type="button"
          onClick={handleVoiceEdit}
          aria-label="Ajuster par commande vocale"
          className="flex items-center space-x-1 px-2.5 py-1.5 min-h-[36px] text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Mic className="w-3.5 h-3.5 text-emerald-500" />
          <span>Ajuster</span>
        </button>
      </div>

      {/* Impact tags */}
      {currentItem.impacts && currentItem.impacts.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] uppercase font-semibold text-zinc-400">Impact :</span>
          {currentItem.impacts.map((imp: string) => (
            <span
              key={imp}
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium"
            >
              {imp.replace('slot-', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
