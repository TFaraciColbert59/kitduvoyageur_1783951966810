'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  OUTING_AUDIENCE_CONTRACT_NOTE,
  outingVisibilityLabel,
  type StoredOutingVisibility,
} from '@/features/compte/domain/outingAudience';
import {
  outingVisibilityErrorMessage,
  updateOutingVisibility,
} from '@/features/compte/client/outingVisibility';
import { DrawerButton, OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { OutingAudienceOptions } from './OutingAudienceOptions';
import { OutingAudienceMatrix } from './OutingAudienceSheet';

export interface BulkOutingItem {
  id: string;
  title: string;
  visibility: StoredOutingVisibility;
}

export interface BulkAudienceResult {
  updated: Array<{ id: string; visibility: StoredOutingVisibility }>;
  failedIds: string[];
}

export interface OutingBulkAudienceSheetProps {
  /** `null` ferme la feuille. L'identité du tableau doit rester stable. */
  items: BulkOutingItem[] | null;
  /** Sélection initiale ; par défaut toutes les sorties. */
  initialIds?: string[];
  /** La sélection a déjà été faite dans l'historique : on ne la refait pas ici. */
  fixedSelection?: boolean;
  onClose: () => void;
  onApplied?: (result: BulkAudienceResult) => void;
}

function initialDraft(items: BulkOutingItem[]): StoredOutingVisibility {
  if (items.length === 0) return 'private';
  const first = items[0].visibility;
  return items.every((item) => item.visibility === first)
    ? first
    : 'private';
}

/**
 * Changement rétroactif d'audience sur plusieurs sorties. Le lot est une
 * orchestration du PATCH existant, une requête par sortie : aucun endpoint ni
 * aucune transaction nouvelle n'est inventé. Un échec partiel est donc rendu
 * visible et les sorties concernées restent sélectionnées.
 */
export function OutingBulkAudienceSheet({
  items,
  initialIds,
  fixedSelection = false,
  onClose,
  onApplied,
}: OutingBulkAudienceSheetProps) {
  const [localItems, setLocalItems] = useState<BulkOutingItem[]>(items ?? []);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<StoredOutingVisibility>(() =>
    initialDraft(items ?? [])
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const initialIdsRef = useRef(initialIds);

  useEffect(() => {
    initialIdsRef.current = initialIds;
  }, [initialIds]);

  useEffect(() => {
    if (!items) return;
    setLocalItems(items);
    const allowed = new Set(items.map((item) => item.id));
    const requested = initialIdsRef.current?.length
      ? initialIdsRef.current
      : items.map((item) => item.id);
    setSelected(new Set(requested.filter((id) => allowed.has(id))));
    setDraft(initialDraft(items));
    setBusy(false);
    setNotice(null);
  }, [items]);

  const targets = useMemo(
    () => localItems.filter((item) => selected.has(item.id)),
    [localItems, selected]
  );
  const allSelected = localItems.length > 0 && targets.length === localItems.length;
  const draftAlreadyApplied =
    targets.length > 0 && targets.every((item) => item.visibility === draft);

  const toggle = (id: string) => {
    if (busy) return;
    setNotice(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (busy) return;
    setNotice(null);
    setSelected(
      allSelected ? new Set() : new Set(localItems.map((item) => item.id))
    );
  };

  const apply = async () => {
    if (busy || targets.length === 0 || draftAlreadyApplied) return;
    setBusy(true);
    setNotice(null);

    const updated: Array<{ id: string; visibility: StoredOutingVisibility }> = [];
    const failed: Array<{ id: string; message: string }> = [];

    const results: Array<
      { id: string; ok: true } | { id: string; ok: false; message: string }
    > = await Promise.all(
      targets.map(async (item) => {
        try {
          await updateOutingVisibility(item.id, draft);
          return { id: item.id, ok: true as const };
        } catch (cause) {
          return {
            id: item.id,
            ok: false as const,
            message: outingVisibilityErrorMessage(cause),
          };
        }
      })
    );

    for (const result of results) {
      if (result.ok) updated.push({ id: result.id, visibility: draft });
      else failed.push({ id: result.id, message: result.message });
    }

    onApplied?.({
      updated,
      failedIds: failed.map((failure) => failure.id),
    });

    if (failed.length === 0) {
      setBusy(false);
      onClose();
      return;
    }

    const updatedIds = new Set(updated.map((entry) => entry.id));
    setLocalItems((current) =>
      current.map((item) =>
        updatedIds.has(item.id) ? { ...item, visibility: draft } : item
      )
    );
    setSelected(new Set(failed.map((failure) => failure.id)));
    setNotice(
      `${updated.length} sortie${updated.length > 1 ? 's' : ''} modifiée${
        updated.length > 1 ? 's' : ''
      }, ${failed.length} échec${failed.length > 1 ? 's' : ''}. ${
        failed[0]?.message ?? ''
      }`
    );
    setBusy(false);
  };

  if (!items || items.length === 0) return null;

  return (
    <OverlaySheet
      title="Visibilité de plusieurs sorties"
      subtitle={`${targets.length} sélectionnée${targets.length > 1 ? 's' : ''} sur ${localItems.length}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      nested
      footer={
        <div className="flex items-center justify-end gap-2">
          <DrawerButton
            tone="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Annuler
          </DrawerButton>
          <DrawerButton
            tone="primary"
            onClick={() => void apply()}
            disabled={busy || targets.length === 0 || draftAlreadyApplied}
            aria-busy={busy ? 'true' : undefined}
          >
            {busy
              ? 'Enregistrement…'
              : `Appliquer à ${targets.length} sortie${targets.length > 1 ? 's' : ''}`}
          </DrawerButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12.5px] leading-snug text-[color:var(--label2)]">
          Le changement est rétroactif : chaque sortie sélectionnée reçoit la
          même audience par le PATCH propriétaire existant. Aucune donnée n’est
          réécrite en masse côté base et aucun succès n’est affiché avant la
          réponse de chaque requête.
        </p>

        {!fixedSelection ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleAll}
              disabled={busy}
              className="min-h-[44px] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-3 text-[12px] font-semibold text-[color:var(--label)] disabled:opacity-50"
            >
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <span
              role="status"
              aria-live="polite"
              className="text-[11.5px] font-semibold text-[color:var(--label2)]"
            >
              {targets.length} sélectionnée{targets.length > 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <p
            role="status"
            className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[11.5px] leading-snug text-[color:var(--label2)]"
          >
            {targets.length} sortie{targets.length > 1 ? 's' : ''} sélectionnée
            {targets.length > 1 ? 's' : ''} dans l’historique.
          </p>
        )}

        {!fixedSelection ? (
          <ul
            aria-label="Sorties à modifier"
            className="m-0 flex list-none flex-col gap-1.5 p-0"
          >
            {localItems.map((item) => {
              const checked = selected.has(item.id);
              return (
                <li key={item.id}>
                  <label
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[var(--lkv-radius-sm)] border px-2.5 py-2 ${
                      checked
                        ? 'border-[color:var(--lkv-primary)]/40 bg-[color:var(--lkv-primary)]/10'
                        : 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(item.id)}
                      disabled={busy}
                      className="h-4 w-4 shrink-0 accent-[color:var(--lkv-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-[color:var(--label)]">
                        {item.title}
                      </span>
                      <span className="block text-[10.5px] text-[color:var(--label2)]">
                        {outingVisibilityLabel(item.visibility)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul
            aria-label="Sorties sélectionnées"
            className="m-0 flex list-none flex-col gap-1 p-0"
          >
            {targets.map((item) => (
              <li
                key={item.id}
                className="flex min-h-[36px] items-center justify-between gap-2 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate text-[12px] font-medium text-[color:var(--label)]">
                  {item.title}
                </span>
                <span className="shrink-0 text-[10.5px] text-[color:var(--label2)]">
                  {outingVisibilityLabel(item.visibility)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <p className="mb-1.5 mt-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--label2)]">
            Nouvelle audience
          </p>
          <OutingAudienceOptions
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setNotice(null);
            }}
            disabled={busy}
            label="Quelle audience appliquer à ces sorties ?"
          />
        </div>

        {notice ? (
          <p
            role={notice.includes('échec') ? 'alert' : 'status'}
            className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[11.5px] leading-snug text-[color:var(--label2)]"
          >
            {notice}
          </p>
        ) : null}

        <p className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[11.5px] leading-snug text-[color:var(--label2)]">
          {OUTING_AUDIENCE_CONTRACT_NOTE}
        </p>

        <OutingAudienceMatrix />
      </div>
    </OverlaySheet>
  );
}

export default OutingBulkAudienceSheet;
