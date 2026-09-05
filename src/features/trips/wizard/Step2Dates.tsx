'use client';

import React, { useMemo } from 'react';
import type { SelectedCountry, DatesChoice } from './wizardTypes';
import {
  checkSeasonalityForDates,
  checkSeasonality,
  getSeasonalityAdvice,
} from '../engine/seasonality';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface Step2DatesProps {
  countries: SelectedCountry[];
  datesChoice: DatesChoice;
  startDate: string;
  endDate: string;
  durationDays: number;
  onDatesChoiceChange: (choice: DatesChoice) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onDurationChange: (days: number) => void;
}

const QUICK_DURATIONS = [3, 5, 7, 10, 14, 21];

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function Step2Dates({
  countries,
  datesChoice,
  startDate,
  endDate,
  durationDays,
  onDatesChoiceChange,
  onStartDateChange,
  onEndDateChange,
  onDurationChange,
}: Step2DatesProps) {
  // Calcul automatique du nombre de jours quand les dates changent
  const handleStartDate = (d: string) => {
    onStartDateChange(d);
    if (d && endDate) {
      const diff = Math.round((new Date(endDate).getTime() - new Date(d).getTime()) / (1000 * 3600 * 24)) + 1;
      if (diff > 0) onDurationChange(diff);
    }
  };

  const handleEndDate = (d: string) => {
    onEndDateChange(d);
    if (startDate && d) {
      const diff = Math.round((new Date(d).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1;
      if (diff > 0) onDurationChange(diff);
    }
  };

  // Évaluation en temps réel de la saisonnalité pour le premier pays
  const primaryCountry = countries[0]?.code || 'FR';

  const seasonalityWarnings = useMemo(() => {
    if (!startDate && !endDate) {
      const currentMonth = new Date().getMonth() + 1;
      const monthWarnings = checkSeasonality(primaryCountry, currentMonth);
      if (monthWarnings.length > 0) {
        return monthWarnings;
      }
      const advice = getSeasonalityAdvice(primaryCountry);
      return [
        {
          code: 'SEASON_DEFAULT_INFO',
          severity: 'info' as const,
          message: `Pour ${countries[0]?.name || primaryCountry}, les mois recommandés sont : ${advice.bestMonths.map((m) => MONTH_NAMES[m - 1]).join(', ')}. ${advice.notes}`,
        },
      ];
    }

    return checkSeasonalityForDates(primaryCountry, startDate, endDate);
  }, [primaryCountry, startDate, endDate, countries]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5B7F55] mb-1">
          <Calendar size={14} />
          <span>Étape 2 sur 5</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#17402C]">
          Quand et combien de temps partez-vous ?
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Définissez vos dates précises ou indiquez simplement la durée souhaitée si vos billets ne sont pas encore pris.
        </p>
      </div>

      {/* Onglets Dates précises vs Durée seule */}
      <div className="flex p-1 bg-black/5 rounded-2xl max-w-sm">
        <button
          type="button"
          onClick={() => onDatesChoiceChange('duration')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
            datesChoice === 'duration'
              ? 'bg-white text-[#17402C] shadow-sm'
              : 'text-gray-600 hover:text-[#17402C]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Clock size={14} />
            <span>Durée seule</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onDatesChoiceChange('dates')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
            datesChoice === 'dates'
              ? 'bg-white text-[#17402C] shadow-sm'
              : 'text-gray-600 hover:text-[#17402C]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Calendar size={14} />
            <span>Dates précises</span>
          </div>
        </button>
      </div>

      {/* Mode Dates précises */}
      {datesChoice === 'dates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#17402C] mb-1">
              Date de départ
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-white rounded-xl border border-black/10 text-sm focus:ring-2 focus:ring-[#17402C] focus:outline-none min-h-[48px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#17402C] mb-1">
              Date de retour
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-white rounded-xl border border-black/10 text-sm focus:ring-2 focus:ring-[#17402C] focus:outline-none min-h-[48px]"
            />
          </div>
        </div>
      )}

      {/* Sélecteur de durée (affiché ou ajusté dans les deux modes) */}
      <div className="p-4 sm:p-5 bg-white/80 rounded-2xl border border-black/5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#17402C] uppercase tracking-wider">
            Durée de l&apos;expédition
          </span>
          <span className="text-lg font-bold text-[#17402C]">
            {durationDays} {durationDays > 1 ? 'jours' : 'jour'}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK_DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDurationChange(d)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                durationDays === d
                  ? 'bg-[#17402C] text-white border-[#17402C]'
                  : 'bg-white hover:bg-black/5 text-[#17402C] border-black/10'
              }`}
            >
              {d} jours
            </button>
          ))}
        </div>

        <input
          type="range"
          min={1}
          max={30}
          value={durationDays}
          onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
          className="w-full accent-[#17402C] cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-gray-500 font-medium">
          <span>1 jour (Micro-aventure)</span>
          <span>15 jours</span>
          <span>30 jours (Grande traversée)</span>
        </div>
      </div>

      {/* Avertissement de Saisonnalité / Météo en Temps Réel */}
      {seasonalityWarnings.length > 0 ? (
        <div className="space-y-2">
          {seasonalityWarnings.map((w, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                w.severity === 'alert'
                  ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                  : 'bg-amber-50/90 border-amber-200 text-amber-950'
              }`}
            >
              <AlertTriangle
                size={18}
                className={w.severity === 'alert' ? 'text-rose-600' : 'text-amber-600'}
              />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">
                  {w.severity === 'alert' ? 'Attention saisonnière' : 'Conseil météo & période'}
                </span>
                {w.message}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center gap-3 text-emerald-900">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold">Période favorable pour {countries[0]?.name || 'cette destination'} :</span> les conditions de praticabilité et de météo sont adaptées aux sentiers.
          </div>
        </div>
      )}
    </div>
  );
}
