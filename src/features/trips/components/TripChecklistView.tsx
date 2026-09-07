'use client';

import React, { useState, useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CheckCircle2, Circle, Calendar, ShieldCheck } from 'lucide-react';

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
}

export function TripChecklistView({ tripId, daysUntilStart }: TripChecklistViewProps) {
  const checklist = getPreDepartureChecklist(daysUntilStart);
  const allItems = [...checklist.j30, ...checklist.j7, ...checklist.j1];
  const totalCount = allItems.length;
  const { triggerHaptic } = useHapticFeedback();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`lkv_trip_checklist_${tripId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCheckedIds(new Set(parsed));
        }
      }
    } catch {
      // Ignorer erreurs localStorage
    }
  }, [tripId]);

  const toggleItem = (id: string) => {
    triggerHaptic('selection');
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(`lkv_trip_checklist_${tripId}`, JSON.stringify(Array.from(next)));
      } catch {
        // Ignorer erreurs localStorage
      }
      return next;
    });
  };

  const progress = getChecklistProgress(checkedIds, totalCount);

  const renderSection = (
    title: string,
    badgeText: string,
    items: ChecklistItem[],
    timingInfo: string
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-lkv-primary">
              {title}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-lkv-primary/10 text-lkv-primary font-medium">
              {badgeText}
            </span>
          </div>
          <span className="text-xs text-lkv-secondary">{timingInfo}</span>
        </div>

        <div className="space-y-2">
          {items.map(item => {
            const isChecked = checkedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 flex items-start gap-3 min-h-[44px] ${
                  isChecked
                    ? 'bg-lkv-primary/5 border-lkv-primary/30 text-lkv-primary'
                    : 'glass-sub-card border border-white/60 shadow-2xs hover:bg-white/90 text-lkv-primary'
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
                  {item.description && (
                    <div className="text-xs text-lkv-secondary mt-0.5">{item.description}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Barre de progression */}
      <GlassCard tone="sage" className="p-5 rounded-[var(--lkv-radius-xl)] border border-white/70">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-lkv-primary" />
            <h3 className="font-bold text-base text-lkv-primary">Checklist Départ & Sérénité</h3>
          </div>
          <div className="text-xs font-semibold text-lkv-primary">
            {checkedIds.size} / {totalCount} validés ({progress}%)
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

      {/* Sections temporelles */}
      {renderSection('Préparation Fondamentale', 'J-30', checklist.j30, 'Un mois avant le départ')}
      {renderSection('Dernière Ligne Droite', 'J-7', checklist.j7, 'Une semaine avant le départ')}
      {renderSection('Veille & Jour J', 'J-1', checklist.j1, 'La veille du départ')}
    </div>
  );
}
