'use client';

import Icon from '@/components/ui/Icon';
import React, { useMemo } from 'react';
import type { SelectedCountry, DatesChoice } from './wizardTypes';
import {
  checkSeasonalityForDates,
  checkSeasonality,
  getSeasonalityAdvice,
} from '../engine/seasonality';
import { Card, Chip, Tabs, type TabOption } from '@/components/ui';

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

const DATE_FIELD_CLASS =
  'min-h-[48px] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

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
      const diff =
        Math.round((new Date(endDate).getTime() - new Date(d).getTime()) / (1000 * 3600 * 24)) + 1;
      if (diff > 0) onDurationChange(diff);
    }
  };

  const handleEndDate = (d: string) => {
    onEndDateChange(d);
    if (startDate && d) {
      const diff =
        Math.round((new Date(d).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) +
        1;
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

  const dateModeOptions: readonly TabOption[] = [
    { id: 'duration', label: 'Durée seule', icon: <Icon name="clock" size={14} /> },
    { id: 'dates', label: 'Dates précises', icon: <Icon name="calendar" size={14} /> },
  ];

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <div className="mb-1 flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-secondary)]">
          <Icon name="calendar" size={14} />
          <span>Étape 2 sur 5</span>
        </div>
        <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
          Quand et combien de temps partez-vous ?
        </h2>
        <p className="mt-1 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
          Définissez vos dates précises ou indiquez simplement la durée souhaitée si vos billets ne
          sont pas encore pris.
        </p>
      </div>

      <Tabs
        options={dateModeOptions}
        value={datesChoice}
        ariaLabel="Mode de sélection des dates"
        className="max-w-sm"
        onChange={(choice) => onDatesChoiceChange(choice as DatesChoice)}
      />

      {/* Mode Dates précises */}
      {datesChoice === 'dates' && (
        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
          <label className="flex flex-col gap-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
            <span>Date de départ</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDate(e.target.value)}
              className={DATE_FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
            <span>Date de retour</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndDate(e.target.value)}
              className={DATE_FIELD_CLASS}
            />
          </label>
        </div>
      )}

      {/* Sélecteur de durée (affiché ou ajusté dans les deux modes) */}
      <Card className="space-y-[var(--space-4)]">
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
            Durée de l&apos;expédition
          </span>
          <span className="text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
            {durationDays} {durationDays > 1 ? 'jours' : 'jour'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-[var(--space-2)] sm:grid-cols-6">
          {QUICK_DURATIONS.map((d) => (
            <Chip key={d} selected={durationDays === d} onClick={() => onDurationChange(d)}>
              {d} jours
            </Chip>
          ))}
        </div>

        <input
          type="range"
          min={1}
          max={30}
          value={durationDays}
          aria-label="Durée de l'expédition en jours"
          onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer accent-[color:var(--lkv-primary)]"
        />
        <div className="flex justify-between text-[11px] font-medium text-[color:var(--lkv-text-muted)]">
          <span>1 jour (Micro-aventure)</span>
          <span>15 jours</span>
          <span>30 jours (Grande traversée)</span>
        </div>
      </Card>

      {/* Avertissement de Saisonnalité / Météo en Temps Réel */}
      {seasonalityWarnings.length > 0 ? (
        <div className="space-y-[var(--space-2)]">
          {seasonalityWarnings.map((w, i) => (
            <Card
              key={i}
              tone={w.severity === 'alert' ? 'danger' : 'warn'}
              className="flex items-start gap-[var(--space-3)]"
            >
              <Icon
                name="alert-triangle"
                size={18}
                className={
                  w.severity === 'alert'
                    ? 'text-[color:var(--lkv-danger)]'
                    : 'text-[color:var(--lkv-warning-dark)]'
                }
              />
              <div className="text-[length:var(--lkv-text-footnote)] leading-relaxed">
                <span className="mb-0.5 block font-semibold">
                  {w.severity === 'alert' ? 'Attention saisonnière' : 'Conseil météo & période'}
                </span>
                {w.message}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card tone="sage" className="flex items-center gap-[var(--space-3)]">
          <Icon
            name="check-circle2"
            size={16}
            className="shrink-0 text-[color:var(--lkv-secondary-hover)]"
          />
          <div className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
            <span className="font-semibold">
              Période favorable pour {countries[0]?.name || 'cette destination'} :
            </span>{' '}
            les conditions de praticabilité et de météo sont adaptées aux sentiers.
          </div>
        </Card>
      )}
    </div>
  );
}
