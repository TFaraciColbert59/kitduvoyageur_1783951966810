'use client';

import React from 'react';
import { Chip, Switch } from '@/components/ui';
import type {
  SportProfileAudience,
  SportProfilePreferencesPatch,
  SportProfileSummaryVM,
} from '@/features/community/g01/sportProfile';
import { SPORT_KEYS, sportLabel, type SportKey } from '@/features/community/g01/contracts';
import { SportStatsRow } from './SportStatsRow';
import styles from './g01.module.css';

export interface SportProfileSummaryProps {
  summary: SportProfileSummaryVM;
  onPreferencesChange?: (patch: SportProfilePreferencesPatch) => void;
}

const AUDIENCES: Array<{ id: SportProfileAudience; label: string }> = [
  { id: 'private', label: 'Privé' },
  { id: 'abonnies', label: 'Abonnés' },
  { id: 'public', label: 'Public' },
];

/**
 * Résumé sportif du profil. Rendu uniquement si la politique d'accès l'a
 * autorisé : un profil privé, bloqué ou sans sport coché ne laisse filtrer
 * aucune statistique. Le propriétaire peut régler l'audience et les sports.
 */
export function SportProfileSummary({ summary, onPreferencesChange }: SportProfileSummaryProps) {
  if (!summary.visible) return null;
  if (!summary.hasData && !summary.owner) return null;

  const editable = summary.owner && typeof onPreferencesChange === 'function';
  const preferences = summary.preferences;

  const setAudience = (audience: SportProfileAudience) => {
    onPreferencesChange?.({ audience });
  };
  const toggleSport = (sport: SportKey) => {
    onPreferencesChange?.({
      sports: { ...preferences.sports, [sport]: !preferences.sports[sport] },
    });
  };

  return (
    <section className={styles.profile} aria-label="Profil sportif">
      <header className={styles.profileHead}>
        <h2 className={styles.profileTitle}>Profil sportif</h2>
        <span className={styles.badge}>{summary.audienceLabel}</span>
      </header>

      {summary.sports.length > 0 ? (
        <div className={styles.profileGrid}>
          {summary.sports.map((sport) => (
            <article key={sport.sport} className={styles.profileCard}>
              <h3 className={styles.profileSport}>{sport.label}</h3>
              <p className={styles.profileMetric}>
                {sport.sessions} sortie{sport.sessions > 1 ? 's' : ''}
              </p>
              {sport.distanceLabel ? (
                <p className={styles.profileMetric}>{sport.distanceLabel}</p>
              ) : null}
              {sport.elevationLabel ? (
                <p className={styles.profileMetric}>{sport.elevationLabel}</p>
              ) : null}
              {sport.durationLabel ? (
                <p className={styles.profileMetric}>{sport.durationLabel}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>
          {editable
            ? 'Coche un sport et choisis une audience pour partager tes chiffres.'
            : 'Aucune statistique sportive partagée.'}
        </p>
      )}

      {summary.records.length > 0 ? (
        <SportStatsRow stats={[]} records={summary.records} ariaLabel="Records sportifs" />
      ) : null}

      {editable ? (
        <div className={styles.drawerSection}>
          <h3 className={styles.sectionTitle}>Qui voit ces chiffres ?</h3>
          <div className={styles.segmented} role="group" aria-label="Audience du profil sportif">
            {AUDIENCES.map((audience) => (
              <button
                key={audience.id}
                type="button"
                className={[
                  styles.segment,
                  preferences.audience === audience.id ? styles.segmentActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={preferences.audience === audience.id}
                onClick={() => setAudience(audience.id)}
              >
                {audience.label}
              </button>
            ))}
          </div>

          <h3 className={styles.sectionTitle}>Sports affichés</h3>
          <div className={styles.sportChips}>
            {SPORT_KEYS.filter((sport) => sport !== 'autre').map((sport) => (
              <Chip
                key={sport}
                selected={preferences.sports[sport] === true}
                onClick={() => toggleSport(sport)}
              >
                {sportLabel(sport)}
              </Chip>
            ))}
          </div>

          <Switch
            checked={preferences.show_totals}
            onCheckedChange={(checked) => onPreferencesChange?.({ show_totals: checked })}
            label="Afficher les totaux (distance, dénivelé, durée)"
          />
          <Switch
            checked={preferences.show_records}
            onCheckedChange={(checked) => onPreferencesChange?.({ show_records: checked })}
            label="Afficher mes records personnels"
          />
        </div>
      ) : null}
    </section>
  );
}

export default SportProfileSummary;
