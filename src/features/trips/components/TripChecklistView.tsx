'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { Badge, Card, EmptyState, ListItem } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { createClient } from '@/lib/supabase/client';
import { requestChecklistCompletionAward } from '@/lib/progression-award-requests';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import { LiveArrivalReveal } from '@/features/hub/components/live/LiveArrivalReveal';
import { useLiveArrivalReveal } from '@/features/hub/components/live/useLiveArrivalReveal';

let checklistClient: ReturnType<typeof createClient> | null = null;
function supabaseChecklistClient() {
  if (!checklistClient) checklistClient = createClient();
  return checklistClient;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: 'formalites' | 'sante' | 'logistique' | 'securite';
  description?: string;
  recommendedDays: number;
}

export interface GroupedChecklist {
  j30: ChecklistItem[];
  j7: ChecklistItem[];
  j1: ChecklistItem[];
}

export interface CountryFormalities {
  countryCode: string;
  requiresPassport: boolean;
  passportValidityMonths: number;
  healthInsuranceCard: string;
  vaccineRecommendations: string[];
  vaccineNotice?: string;
  visaRequired: boolean;
  notes?: string;
}

const EU_EEA_COUNTRIES = new Set([
  'FR',
  'DE',
  'IT',
  'ES',
  'PT',
  'BE',
  'NL',
  'LU',
  'CH',
  'AT',
  'SE',
  'NO',
  'FI',
  'DK',
  'IE',
  'GR',
  'PL',
  'CZ',
  'SK',
  'HU',
  'SI',
  'HR',
  'EE',
  'LV',
  'LT',
  'IS',
]);

const DEFAULT_VACCINE_NOTICE =
  'Recommandations vaccinales à vérifier auprès de ton médecin traitant ou d’un centre de vaccinations internationales (ex: Institut Pasteur, Conseils aux Voyageurs MEAE).';

/**
 * Détermine les formalités légales et sanitaires spécifiques selon le pays de destination.
 * Z1.5 / D19 : Sans source officielle connectée et datée, aucune liste de vaccins n'est affirmée.
 */
export function getCountrySpecificFormalities(countryCode?: string | null): CountryFormalities {
  const code = (countryCode || 'FR').toUpperCase();
  const isEu = EU_EEA_COUNTRIES.has(code);

  if (code === 'NP') {
    return {
      countryCode: 'NP',
      requiresPassport: true,
      passportValidityMonths: 6,
      healthInsuranceCard: 'Assurance rapatriement et recherche héliportée obligatoire (> 5000m)',
      vaccineRecommendations: [],
      vaccineNotice: DEFAULT_VACCINE_NOTICE,
      visaRequired: true,
      notes: 'Visa à l’arrivée ou en ligne. Permis TIMS et entrées parcs nationaux requis.',
    };
  }

  if (code === 'PE') {
    return {
      countryCode: 'PE',
      requiresPassport: true,
      passportValidityMonths: 6,
      healthInsuranceCard: 'Assurance secours montagne haute altitude',
      vaccineRecommendations: [],
      vaccineNotice: DEFAULT_VACCINE_NOTICE,
      visaRequired: false,
      notes: 'Tampon d’entrée gratuit 90 jours pour ressortissants UE. Altitude > 3000m.',
    };
  }

  if (code === 'MA') {
    return {
      countryCode: 'MA',
      requiresPassport: true,
      passportValidityMonths: 3,
      healthInsuranceCard: 'Assurance rapatriement et secours',
      vaccineRecommendations: [],
      vaccineNotice: DEFAULT_VACCINE_NOTICE,
      visaRequired: false,
      notes:
        'Passeport valide obligatoire pour le Maroc. Pas de visa pour les séjours de moins de 90 jours.',
    };
  }

  if (!isEu) {
    return {
      countryCode: code,
      requiresPassport: true,
      passportValidityMonths: 6,
      healthInsuranceCard: 'Assurance voyage internationale complète',
      vaccineRecommendations: [],
      vaccineNotice: DEFAULT_VACCINE_NOTICE,
      visaRequired: false,
    };
  }

  // Pays UE / Schengen
  return {
    countryCode: code,
    requiresPassport: false,
    passportValidityMonths: 0,
    healthInsuranceCard: 'Carte Européenne d’Assurance Maladie (CEAM) à jour',
    vaccineRecommendations: [],
    vaccineNotice: DEFAULT_VACCINE_NOTICE,
    visaRequired: false,
    notes: 'Carte nationale d’identité valide ou passeport. Libre circulation Schengen.',
  };
}

export function getPreDepartureChecklist(
  _daysUntilStart?: number | null,
  countryCode?: string | null
): GroupedChecklist {
  const formalities = getCountrySpecificFormalities(countryCode);

  const passportDescription = formalities.requiresPassport
    ? `Passeport biométrique valide au moins ${formalities.passportValidityMonths} mois après la date de retour prévue.`
    : `Carte Nationale d’Identité ou Passeport en cours de validité (espace Schengen).`;

  const insuranceDescription = formalities.healthInsuranceCard;

  const vaccineNoticeText = formalities.vaccineNotice || DEFAULT_VACCINE_NOTICE;
  const vaccineDescription =
    formalities.vaccineRecommendations.length > 0
      ? `Recommandations : ${formalities.vaccineRecommendations.join(', ')}. ${vaccineNoticeText}`
      : vaccineNoticeText;

  return {
    j30: [
      {
        id: 'j30-passport',
        label: formalities.requiresPassport
          ? `Validité du Passeport (> ${formalities.passportValidityMonths} mois)`
          : `Validité de la pièce d’identité (CNI / Passeport)`,
        category: 'formalites',
        description: passportDescription,
        recommendedDays: 30,
      },
      {
        id: 'j30-insurance',
        label: `Couverture médicale & assurance (${formalities.requiresPassport ? 'Secours étranger' : 'CEAM'})`,
        category: 'securite',
        description: insuranceDescription,
        recommendedDays: 30,
      },
      {
        id: 'j30-vaccines',
        label: 'Vaccins et santé de voyage à jour',
        category: 'sante',
        description: vaccineDescription,
        recommendedDays: 30,
      },
      {
        id: 'j30-bookings',
        label: 'Réservation des nuitées en refuge ou bivouacs autorisés',
        category: 'logistique',
        description: 'Valider les étapes clés et hébergements obligatoires.',
        recommendedDays: 30,
      },
    ],
    j7: [
      {
        id: 'j7-gear-check',
        label: 'Inspection et test du matériel (tente, réchaud, chaussures rodées)',
        category: 'logistique',
        description: 'Pas de matériel neuf non testé avant le grand départ.',
        recommendedDays: 7,
      },
      {
        id: 'j7-first-aid',
        label: 'Trousse de premiers secours vérifiée et complète',
        category: 'sante',
        description: 'Pansements ampoules, désinfectant, bande de contention, antalgiques.',
        recommendedDays: 7,
      },
      {
        id: 'j7-offline-maps',
        label: 'Cartes topographiques hors-ligne téléchargées sur le téléphone',
        category: 'securite',
        description: 'Télécharger les tuiles IGN/OSM pour l’usage en zone blanche.',
        recommendedDays: 7,
      },
      {
        id: 'j7-meteo-trend',
        label: 'Consultation des tendances météo à moyen terme',
        category: 'securite',
        description: 'Repérer les risques orageux ou chutes de température.',
        recommendedDays: 7,
      },
    ],
    j1: [
      {
        id: 'j1-batteries',
        label: 'Batterie externe et téléphone chargés à 100%',
        category: 'securite',
        description: 'Câbles de charge et mode économie d’énergie configurés.',
        recommendedDays: 1,
      },
      {
        id: 'j1-emergency-contact',
        label: 'Itinéraire et heure de retour estimée partagés avec un proche',
        category: 'securite',
        description: 'Donnez à votre contact d’urgence le numéro des secours locaux et le tracé.',
        recommendedDays: 1,
      },
      {
        id: 'j1-water-food',
        label: 'Ravitaillement eau (minimum 2L) et vivres de course du jour 1',
        category: 'logistique',
        description: 'Pastilles de purification et barres énergétiques accessibles.',
        recommendedDays: 1,
      },
      {
        id: 'j1-meteo-bulletin',
        label: 'Vérification du bulletin météo montagne du lendemain matin',
        category: 'securite',
        description: 'Adapter l’heure de départ en cas de risque orageux l’après-midi.',
        recommendedDays: 1,
      },
    ],
  };
}

export function getChecklistProgress(
  checkedSet: Set<string> | string[],
  totalItems: number
): number {
  if (totalItems <= 0) return 0;
  const count = checkedSet instanceof Set ? checkedSet.size : checkedSet.length;
  return Math.min(100, Math.round((count / totalItems) * 100));
}

interface TripChecklistViewProps {
  tripId: string;
  daysUntilStart?: number | null;
  /** Items réels de trip_checklist_items (chargés côté serveur). */
  items: DatabaseTripChecklistItem[];
}

/**
 * Checklist de préparation PERSISTÉE EN BDD (trip_checklist_items) : plus de
 * localStorage. Toggle = update Supabase (done/done_at) avec état optimiste
 * et retour arrière en cas d'erreur.
 */
export function TripChecklistView({ tripId, daysUntilStart, items }: TripChecklistViewProps) {
  const [rows, setRows] = useState<DatabaseTripChecklistItem[]>(items);
  const { triggerHaptic } = useHapticFeedback();
  // T10 — reveal des tâches ajoutées en réel (bus live), section visible seulement.
  const { liveIds, containerRef } = useLiveArrivalReveal<HTMLDivElement>('trip_checklist_items');

  const totalCount = rows.length;
  const doneCount = rows.filter((i) => i.done).length;

  const toggleItem = (item: DatabaseTripChecklistItem) => {
    triggerHaptic('selection');
    const nextDone = !item.done;
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, done: nextDone } : r)));
    void (async () => {
      const { error } = await supabaseChecklistClient()
        .from('trip_checklist_items')
        .update({ done: nextDone, done_at: nextDone ? new Date().toISOString() : null })
        .eq('id', item.id)
        .eq('trip_id', tripId);
      if (error) {
        console.error('[LKDV checklist] toggle error:', error);
        setRows(previous);
      } else {
        // P2 — le serveur revérifie l'état réel (100 % des items) et attribue
        // une seule fois par voyage ; ne bloque jamais le toggle.
        requestChecklistCompletionAward(tripId);
      }
    })();
  };

  const progress = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;

  const renderSection = (title: string, badgeText: string, sectionItems: DatabaseTripChecklistItem[]) => {
    return (
      <div className="space-y-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)] px-1">
          <span className="text-[length:var(--lkv-text-footnote)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            {title}
          </span>
          <Badge tone="sage">{badgeText}</Badge>
        </div>

        <ul className="space-y-[var(--space-2)]">
          {sectionItems.map((item, index) => {
            const isChecked = item.done;
            return (
              <li key={item.id}>
                <LiveArrivalReveal id={item.id} liveIds={liveIds} index={index}>
                  <ListItem
                    as="div"
                    onClick={() => toggleItem(item)}
                    selected={isChecked}
                    aria-pressed={isChecked}
                    className={`items-start gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] sm:p-[var(--space-4)] ${
                      isChecked
                        ? 'border-[color:var(--lkv-action)]/30 bg-[color:var(--lkv-action-soft)]'
                        : 'border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-card)]'
                    }`}
                    leading={
                      <span className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <Icon name="check-circle2" size={20} className="text-[color:var(--lkv-primary)]" />
                        ) : (
                          <Icon
                            name="circle"
                            size={20}
                            className="text-[color:var(--lkv-text-secondary)]/50"
                          />
                        )}
                      </span>
                    }
                    title={
                      <span
                        className={
                          isChecked
                            ? 'text-[color:var(--lkv-text-secondary)] line-through opacity-75'
                            : 'text-[color:var(--lkv-text-primary)]'
                        }
                      >
                        {item.label}
                      </span>
                    }
                  />
                </LiveArrivalReveal>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const j30 = rows.filter((i) => i.due_offset_days >= 30);
  const j7 = rows.filter((i) => i.due_offset_days >= 8 && i.due_offset_days < 30);
  const j1 = rows.filter((i) => i.due_offset_days < 8);

  return (
    <div ref={containerRef} className="space-y-[var(--space-6)]">
      {/* Barre de progression */}
      <Card tone="sage">
        <div className="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-4)]">
          <Icon name="shield-check" size={20} className="text-[color:var(--lkv-primary)]" aria-hidden="true" />
          <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
            {doneCount} / {totalCount} ({progress}%)
          </div>
        </div>

        {/* Barre */}
        <div className="mt-[var(--space-3)] h-2 w-full overflow-hidden rounded-full bg-white/30">
          <div
            className="h-full rounded-full bg-[color:var(--lkv-primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {daysUntilStart !== null && daysUntilStart !== undefined && (
          <div className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            <Icon name="calendar" size={13} />
            <span>
              {daysUntilStart > 0
                ? `Départ prévu dans ${daysUntilStart} jour${daysUntilStart > 1 ? 's' : ''}`
                : 'Départ imminent aujourd’hui !'}
            </span>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <EmptyState compact title="Aucune tâche de préparation pour ce voyage." />
      ) : (
        <>
          {j30.length > 0 && renderSection('Préparation fondamentale', 'J-30', j30)}
          {j7.length > 0 && renderSection('Dernière ligne droite', 'J-7', j7)}
          {j1.length > 0 && renderSection('Veille & jour J', 'Départ', j1)}
        </>
      )}
    </div>
  );
}
