'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { createClient } from '@/lib/supabase/client';
import type { DatabaseTripChecklistItem } from '@/lib/supabase/types';
import { CheckCircle2, Circle, Calendar, ShieldCheck } from 'lucide-react';

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
  'FR', 'DE', 'IT', 'ES', 'PT', 'BE', 'NL', 'LU', 'CH', 'AT', 'SE', 'NO', 'FI',
  'DK', 'IE', 'GR', 'PL', 'CZ', 'SK', 'HU', 'SI', 'HR', 'EE', 'LV', 'LT', 'IS',
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
      notes: 'Passeport valide obligatoire pour le Maroc. Pas de visa pour les séjours de moins de 90 jours.',
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
      }
    })();
  };

  const progress = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;

  const renderSection = (
    title: string,
    badgeText: string,
    items: DatabaseTripChecklistItem[]
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-lkv-primary">
            {title}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-lkv-primary/10 text-lkv-primary font-medium">
            {badgeText}
          </span>
        </div>

        <div className="space-y-2">
          {items.map(item => {
            const isChecked = item.done;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 flex items-start gap-3 min-h-[44px] ${
                  isChecked
                    ? 'bg-lkv-primary/5 border-lkv-primary/30 text-lkv-primary'
                    : 'glass-sub-card border border-white/60 shadow-2xs hover:bg-white/90 text-lkv-primary active:scale-[0.98]'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckCircle2 size={20} className="text-lkv-primary" />
                  ) : (
                    <Circle size={20} className="text-lkv-secondary/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      isChecked ? 'line-through text-lkv-secondary opacity-75' : 'text-lkv-primary'
                    }`}
                  >
                    {item.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const j30 = rows.filter((i) => i.due_offset_days >= 30);
  const j7 = rows.filter((i) => i.due_offset_days >= 8 && i.due_offset_days < 30);
  const j1 = rows.filter((i) => i.due_offset_days < 8);

  return (
    <div className="space-y-6">
      {/* Barre de progression */}
      <GlassCard tone="sage" className="p-5 rounded-[var(--lkv-radius-xl)] border border-white/70">
        <div className="flex items-center justify-between gap-4 mb-2">
          <ShieldCheck className="w-5 h-5 text-lkv-primary" aria-hidden="true" />
          <div className="text-xs font-semibold text-lkv-primary">
            {doneCount} / {totalCount} ({progress}%)
          </div>
        </div>

        {/* Barre */}
        <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden mt-3">
          <div
            className="bg-lkv-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {daysUntilStart !== null && daysUntilStart !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-lkv-secondary mt-3">
            <Calendar size={13} />
            <span>
              {daysUntilStart > 0
                ? `Départ prévu dans ${daysUntilStart} jour${daysUntilStart > 1 ? 's' : ''}`
                : 'Départ imminent aujourd’hui !'}
            </span>
          </div>
        )}
      </GlassCard>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-lkv-secondary">
          Aucune tâche de préparation pour ce voyage.
        </p>
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
