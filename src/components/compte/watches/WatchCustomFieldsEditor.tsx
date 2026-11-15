'use client';

/**
 * Lot D03-UI — éditeur des champs de navigation affichés sur la montre.
 *
 * Les pages sont bornées par `maxSlotsPerPage` et dédupliquées côté contrat.
 * L’éditeur ne valide pas en local les règles métier : il envoie la
 * configuration et affiche le verdict du serveur (`validateCustomFieldLayout`).
 */

import type { WatchNavigationFieldKey } from '@/features/watches';
import { Plus, X } from 'lucide-react';
import { FIELD_KEYS, FIELD_LABELS } from './format';
import { Button } from './primitives';

export interface WatchCustomFieldsEditorProps {
  pages: WatchNavigationFieldKey[][];
  maxSlotsPerPage?: number;
  disabled?: boolean;
  onChange: (pages: WatchNavigationFieldKey[][]) => void;
}

export function WatchCustomFieldsEditor({
  pages,
  maxSlotsPerPage = 4,
  disabled = false,
  onChange,
}: WatchCustomFieldsEditorProps) {
  const maxSlots = Math.max(1, Math.min(6, maxSlotsPerPage));

  function replacePage(pageIndex: number, next: WatchNavigationFieldKey[]) {
    onChange(pages.map((page, index) => (index === pageIndex ? next : page)));
  }

  function addField(pageIndex: number, key: WatchNavigationFieldKey) {
    const page = pages[pageIndex] ?? [];
    if (page.includes(key) || page.length >= maxSlots) return;
    replacePage(pageIndex, [...page, key]);
  }

  function removeField(pageIndex: number, key: WatchNavigationFieldKey) {
    replacePage(
      pageIndex,
      (pages[pageIndex] ?? []).filter((value) => value !== key),
    );
  }

  return (
    <div className="lkv-watch__field-editor" data-testid="watch-custom-fields-editor">
      {pages.map((page, pageIndex) => {
        const available = FIELD_KEYS.filter((key) => !page.includes(key));
        return (
          <div className="lkv-watch__field-page" key={`page-${pageIndex}`}>
            <div className="lkv-watch__row">
              <h3 className="lkv-watch__card-title">Page {pageIndex + 1}</h3>
              <span className="lkv-watch__hint">
                {page.length}/{maxSlots} champs
              </span>
              {pages.length > 1 ? (
                <Button
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Supprimer la page ${pageIndex + 1}`}
                  onClick={() => onChange(pages.filter((_, index) => index !== pageIndex))}
                >
                  <X size={15} aria-hidden="true" />
                </Button>
              ) : null}
            </div>

            <div className="lkv-watch__chips" aria-label={`Champs de la page ${pageIndex + 1}`}>
              {page.length === 0 ? (
                <span className="lkv-watch__hint">Aucun champ sur cette page.</span>
              ) : (
                page.map((key) => (
                  <span className="lkv-watch__field-chip" key={key}>
                    {FIELD_LABELS[key]}
                    <button
                      type="button"
                      aria-label={`Retirer ${FIELD_LABELS[key]}`}
                      disabled={disabled}
                      onClick={() => removeField(pageIndex, key)}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="lkv-watch__field">
              <label htmlFor={`watch-add-field-${pageIndex}`}>
                Ajouter un champ à la page {pageIndex + 1}
              </label>
              <select
                id={`watch-add-field-${pageIndex}`}
                value=""
                disabled={disabled || page.length >= maxSlots || available.length === 0}
                onChange={(event) => {
                  const key = event.target.value as WatchNavigationFieldKey;
                  if (key) addField(pageIndex, key);
                  event.target.value = '';
                }}
              >
                <option value="">
                  {page.length >= maxSlots ? 'Page complète' : 'Choisir un champ…'}
                </option>
                {available.map((key) => (
                  <option key={key} value={key}>
                    {FIELD_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}

      {pages.length < 10 ? (
        <Button
          variant="ghost"
          disabled={disabled}
          onClick={() => onChange([...pages, []])}
        >
          <Plus size={15} aria-hidden="true" /> Ajouter une page
        </Button>
      ) : null}
    </div>
  );
}
