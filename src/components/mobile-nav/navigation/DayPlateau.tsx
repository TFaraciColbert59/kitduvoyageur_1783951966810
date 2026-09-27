'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  isDayFocusReady,
  useDayFocusStore,
  type DayFocusDay,
} from '@/components/mobile-nav/dayFocusStore';

/**
 * DayPlateau — extension de la bottom bar de selection du jour.
 *
 * Meme materiau, meme hauteur et meme curseur que `NavigationPlateau` (le
 * plateau « Fil / Carnets / Clubs » de la communaute) : les deux vivent dans
 * le meme slot `plateau` de `NavigationSurface`, donc ils doivent partager la
 * meme geometrie, sinon la barre « saute » quand l'un remplace l'autre.
 *
 * Regles produit :
 * - apparait UNIQUEMENT quand le voyage est decoupe en au moins deux journees
 *   (`isDayFocusReady`) ; sur un voyage d'une journee, aucun rail de plus ;
 * - `Tout` = vue globale du voyage ; `J1..Jn` = focus sur ce seul jour ;
 * - chaque onglet porte la date civile et la distance du jour : la lecture du
 *   rail se fait sans ouvrir quoi que ce soit ;
 * - la selection survit au changement de section (store module, pas etat local).
 */

interface DayTab {
  id: string;
  /** Texte de l'onglet : « Tout » ou « J3 ». */
  label: string;
  /** Ligne secondaire : « sam. 12 » ou « 14 km ». */
  hint: string | null;
  /** Valeur rendue en `aria-label` (jamais de contenu vide pour les lecteurs). */
  ariaLabel: string;
  day: number | null;
}

/** Formulation unique pour toute donnee non verifiee, jamais un zero. */
const A_VERIFIER = 'à vérifier';

function formatDistanceKm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} km`;
}

/**
 * Distance d'un onglet, ou la formulation « à vérifier ».
 *
 * Un jour dont la distance n'est pas verifiee ne doit JAMAIS afficher 0 km :
 * le rail se lit sans ouvrir quoi que ce soit, donc un chiffre fabrique
 * deviendrait une affirmation.
 */
function distanceHint(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return A_VERIFIER;
  return formatDistanceKm(value);
}

/** Deux lignes maximum : la date du jour quand elle existe, sinon la distance. */
function buildDayTab(day: DayFocusDay): DayTab {
  const parts = [day.dateLabel, distanceHint(day.distanceKm)].filter(Boolean);
  return {
    id: `day-${day.day}`,
    label: `J${day.day}`,
    hint: parts.length > 0 ? parts[0] : null,
    ariaLabel: [
      `Jour ${day.day}`,
      day.dateLabel ?? null,
      `${distanceHint(day.distanceKm)}, ${day.stepsCount} étape${day.stepsCount > 1 ? 's' : ''}`,
    ]
      .filter(Boolean)
      .join(', '),
    day: day.day,
  };
}

function buildAllTab(days: DayFocusDay[]): DayTab {
  // Somme partielle = total partiel : on n'affiche un total que si TOUS les
  // jours sont mesures, sinon le rail annoncerait un faux total de voyage.
  const measured = days.every((entry) => entry.distanceKm !== null);
  const total = measured ? days.reduce((sum, entry) => sum + (entry.distanceKm ?? 0), 0) : null;
  return {
    id: 'day-all',
    label: 'Tout',
    hint: distanceHint(total),
    ariaLabel: `Tout le voyage, ${days.length} jours, ${distanceHint(total)}`,
    day: null,
  };
}

export default function DayPlateau() {
  const reduceMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const days = useDayFocusStore((state) => state.days);
  const selectedDay = useDayFocusStore((state) => state.selectedDay);
  const selectDay = useDayFocusStore((state) => state.selectDay);

  if (!isDayFocusReady(days)) return null;

  const tabs = [buildAllTab(days), ...days.map(buildDayTab)];
  const activeId = selectedDay == null ? 'day-all' : `day-${selectedDay}`;

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: 14, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      role="tablist"
      aria-label="Journées du voyage"
      style={{
        // M03 — hauteur utile 44 px pour chaque bouton, 40 px de barre visible.
        width: 'calc(100% - 8px)',
        height: 40,
        marginBottom: 0,
        paddingTop: 2,
        paddingBottom: 2,
        background: 'var(--g1-bg)',
        backdropFilter: 'blur(var(--material-bar-blur)) saturate(var(--material-bar-saturate))',
        WebkitBackdropFilter: 'blur(var(--material-bar-blur)) saturate(var(--material-bar-saturate))',
        borderTopLeftRadius: 'var(--lkv-radius-sheet)',
        borderTopRightRadius: 'var(--lkv-radius-sheet)',
        border: '1px solid var(--material-bar-border)',
        borderBottom: 'none',
        boxShadow: 'var(--btn-rim), 0 -2px 14px rgba(23, 64, 44, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x',
        overscrollBehaviorX: 'contain',
        overscrollBehaviorY: 'none',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        scrollSnapType: 'x proximity',
        paddingLeft: 10,
        paddingRight: 14,
        scrollPaddingRight: '20px',
        gap: 4,
        zIndex: 1,
        maskImage: 'linear-gradient(to right, black 86%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, black 86%, transparent 100%)',
      }}
    >
      {tabs.map((tab) => {
        const isSelected = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            aria-label={tab.ariaLabel}
            onClick={() => {
              triggerHaptic('light');
              selectDay(tab.day);
            }}
            style={{
              flex: '0 0 auto',
              position: 'relative',
              // Cible tactile utile 44 px, fond visible 34 px (inset de la pilule).
              height: 44,
              minWidth: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '0 10px',
              whiteSpace: 'nowrap',
              scrollSnapAlign: 'start',
            }}
          >
            {isSelected && (
              <motion.div
                layoutId="activeDayUpperTab"
                style={{
                  position: 'absolute',
                  top: 5,
                  bottom: 5,
                  left: 2,
                  right: 2,
                  borderRadius: 999,
                  background: 'var(--g3-bg)',
                  border: '1px solid var(--glass-border-color)',
                  boxShadow: 'var(--glass-shadow)',
                  pointerEvents: 'none',
                }}
                transition={
                  reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 32 }
                }
              />
            )}
            <span
              style={{
                position: 'relative',
                zIndex: 2,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'baseline',
                gap: 5,
                transform: isSelected && !reduceMotion ? 'scale(1.04)' : 'scale(1)',
                transition: reduceMotion ? 'none' : 'transform var(--motion-control-duration) var(--lkv-ease)',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'var(--g3-text)' : 'var(--glass-label-secondary)',
                }}
              >
                {tab.label}
              </span>
              {tab.hint && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    color: isSelected ? 'var(--g3-text)' : 'var(--glass-label-secondary)',
                    opacity: 0.75,
                  }}
                >
                  {tab.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
