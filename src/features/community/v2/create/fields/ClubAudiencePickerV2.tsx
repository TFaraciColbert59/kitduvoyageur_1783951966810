'use client';

import React from 'react';
import { Check, Plus, Users } from 'lucide-react';
import { ClubCrest } from '../../shared/ClubCrest';
import type { MyClubV2 } from '../club/useMyClubsV2';

export interface ClubAudiencePickerV2Props {
  id?: string;
  labelId?: string;
  errorId?: string;
  clubs: readonly MyClubV2[];
  loading?: boolean;
  error?: string | null;
  selectedId: string;
  onSelect: (clubId: string) => void;
  onCreateClub?: () => void;
}

/**
 * Sélecteur moderne de club pour l’audience « Un club » : cartes compactes
 * en rail horizontal avec blason `ClubCrest`, nom, activité et coche active.
 */
export function ClubAudiencePickerV2({
  id = 'cv2c-clubId',
  labelId = 'cv2c-clubId-label',
  errorId,
  clubs,
  loading = false,
  error = null,
  selectedId,
  onSelect,
  onCreateClub,
}: ClubAudiencePickerV2Props) {
  return (
    <div
      className="lkdv-cv2c-club-rail"
      id={id}
      role={clubs.length > 0 ? 'radiogroup' : undefined}
      tabIndex={-1}
      aria-labelledby={labelId}
      aria-describedby={errorId}
    >
      {loading ? (
        <p className="lkdv-cv2-field-hint">Chargement de tes clubs…</p>
      ) : clubs.length > 0 ? (
        <div className="lkdv-cv2c-hrail">
          {clubs.map((club) => {
            const active = selectedId === club.id;
            return (
              <button
                key={club.id}
                type="button"
                role="radio"
                aria-checked={active}
                className="lkdv-cv2c-club-card"
                data-active={active}
                onClick={() => onSelect(club.id)}
              >
                {club.avatarUrl ? (
                  <img
                    src={club.avatarUrl}
                    alt=""
                    className="lkdv-cv2c-club-avatar"
                    width={34}
                    height={34}
                  />
                ) : (
                  <ClubCrest name={club.name} activity={club.activity} seed={club.id} size={34} />
                )}
                <span className="lkdv-cv2c-club-meta">
                  <b>{club.name}</b>
                  <small>{club.activity || (club.slug ? `@${club.slug}` : 'Membre actif')}</small>
                </span>
                <span className="lkdv-cv2c-club-check" aria-hidden="true">
                  {active ? <Check size={13} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="lkdv-cv2c-club-empty">
          <span className="lkdv-cv2c-club-empty-ico" aria-hidden="true">
            <Users size={16} />
          </span>
          <span className="lkdv-cv2c-club-empty-txt">
            <b>{error ?? 'Aucun club actif'}</b>
            <small>Rejoins un club ou crée le tien en 1 minute.</small>
          </span>
          {onCreateClub ? (
            <button type="button" className="lkdv-cv2-chip" onClick={onCreateClub}>
              <Plus size={13} aria-hidden="true" />
              Créer
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
