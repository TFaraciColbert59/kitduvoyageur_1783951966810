'use client';

import React, { useId } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import { ClubAudiencePickerV2 } from './ClubAudiencePickerV2';
import type { MyClubV2 } from '../club/useMyClubsV2';
import { readError } from './FieldV2';

export type UnifiedVisibilityValue = 'public' | 'private' | 'club';

export interface VisibilityOption {
  value: string;
  label: string;
}

export interface VisibilityPickerV2Props {
  /** Champ RHF principal (ex: `audience`, `visibility`, `isPublic`, `privacy`). */
  name: string;
  label?: string;
  /** Mode boolean (pour `KitFormV2` `isPublic` + `clubId` virtuel) ou string. */
  options?: readonly VisibilityOption[];
  /** Active le 3e choix « Club » et le rail `ClubAudiencePickerV2`. */
  supportClub?: boolean;
  clubFieldName?: string;
  clubs?: readonly MyClubV2[];
  clubsLoading?: boolean;
  clubsError?: string | null;
  onCreateClub?: () => void;
  /** Valeur courante forcée (ex: pour `Kit` qui combine `isPublic` + `clubId`). */
  value?: string;
  onSelectValue?: (next: string) => void;
}

const DEFAULT_OPTIONS: readonly VisibilityOption[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Privé' },
  { value: 'club', label: 'Club' },
];

/**
 * Sélecteur de visibilité unifié (style pilule segmentée identique sur tous
 * les formulaires de création : Public / Privé / Club, ou Ouvert / Privé pour Club).
 */
export function VisibilityPickerV2({
  name,
  label = 'Visibilité',
  options = DEFAULT_OPTIONS,
  supportClub = true,
  clubFieldName = 'clubId',
  clubs = [],
  clubsLoading = false,
  clubsError = null,
  onCreateClub,
  value,
  onSelectValue,
}: VisibilityPickerV2Props) {
  const form = useFormContext();
  const { errors } = useFormState({ control: form.control });
  const id = useId();
  const labelId = `${id}-label`;
  const clubErrorId = `${id}-club-err`;

  const watched = form.watch(name);
  const clubId = (form.watch(clubFieldName) as string | undefined) ?? '';
  const currentValue = value !== undefined ? value : String(watched ?? '');
  const clubError = readError(errors, clubFieldName);
  const fieldError = readError(errors, name);

  const select = (next: string) => {
    if (onSelectValue) {
      onSelectValue(next);
      return;
    }
    form.setValue(name, next, { shouldDirty: true, shouldValidate: true });
    if (next !== 'club' && clubFieldName && form.getValues(clubFieldName) !== undefined) {
      form.setValue(clubFieldName, '', { shouldDirty: true });
    }
  };

  return (
    <div className="lkdv-cv2-field lkdv-cv2c-vis-wrap">
      <span id={labelId} className="lkdv-cv2-field-label">
        {label}
      </span>
      <div className="lkdv-cv2c-vis-rail" role="radiogroup" aria-labelledby={labelId}>
        {options.map((opt) => {
          const active = currentValue === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className="lkdv-cv2c-vis-pill"
              data-active={active}
              onClick={() => select(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {fieldError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {supportClub && currentValue === 'club' ? (
        <div className="lkdv-cv2c-vis-club-sub">
          <ClubAudiencePickerV2
            id={`cv2c-${clubFieldName}`}
            labelId={labelId}
            errorId={clubError ? clubErrorId : undefined}
            clubs={clubs}
            loading={clubsLoading}
            error={clubsError}
            selectedId={clubId}
            onSelect={(selectedClubId) =>
              form.setValue(clubFieldName, selectedClubId, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onCreateClub={onCreateClub}
          />
          {clubError ? (
            <p id={clubErrorId} className="lkdv-cv2-field-error" role="alert">
              {clubError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
