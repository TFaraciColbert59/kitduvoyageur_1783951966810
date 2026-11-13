'use client';

import React, { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import {
  OUTING_AUDIENCE_CONTRACT_NOTE,
  type StoredOutingVisibility,
} from '@/features/compte/domain/outingAudience';
import { outingVisibilityErrorMessage } from '@/features/compte/client/outingVisibility';
import { DrawerButton, OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { OutingAudienceOptions } from './OutingAudienceOptions';

export interface OutingAudienceSheetProps {
  open: boolean;
  title: string;
  /** Résumé local affiché avant l'écriture ; il n'est jamais publié. */
  summary?: string;
  current: StoredOutingVisibility;
  onClose: () => void;
  onApply: (next: StoredOutingVisibility) => Promise<void>;
  /** Appelé uniquement après une écriture réussie. */
  onApplied?: () => void;
}

/**
 * Sous-drawer « Partager » d'une sortie. Le choix d'audience est explicite et
 * l'écriture n'est confirmée qu'après la réponse du PATCH existant. Les
 * audiences que le serveur ne porte pas restent visibles, désactivées, avec
 * leur raison.
 */
export function OutingAudienceSheet({
  open,
  title,
  summary,
  current,
  onClose,
  onApply,
  onApplied,
}: OutingAudienceSheetProps) {
  const [draft, setDraft] = useState<StoredOutingVisibility>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(current);
    setError(null);
    setBusy(false);
  }, [open, current]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const submit = async () => {
    if (busy || draft === current) return;
    setBusy(true);
    setError(null);
    try {
      await onApply(draft);
      onApplied?.();
    } catch (cause) {
      setError(outingVisibilityErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <OverlaySheet
      title="Partager cette sortie"
      subtitle={title}
      onClose={close}
      nested
      footer={
        <div className="flex items-center justify-end gap-2">
          <DrawerButton tone="ghost" onClick={close} disabled={busy}>
            Annuler
          </DrawerButton>
          <DrawerButton
            tone="primary"
            onClick={() => void submit()}
            disabled={busy || draft === current}
            aria-busy={busy ? 'true' : undefined}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </DrawerButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12.5px] leading-snug text-[color:var(--label2)]">
          Choisis l’audience à enregistrer pour cette sortie. Seules les valeurs
          portées par le serveur sont applicables ; l’écriture est confirmée
          avant tout message de succès.
        </p>

        <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2">
          <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--label2)]">
            Aperçu local — non publié
          </p>
          <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-[color:var(--label)]">
            {title}
          </p>
          {summary ? (
            <p className="m-0 text-[11.5px] text-[color:var(--label2)]">{summary}</p>
          ) : null}
        </div>

        <OutingAudienceOptions
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setError(null);
          }}
          disabled={busy}
        />

        {error ? (
          <p
            role="alert"
            className="m-0 flex items-start gap-2 rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-danger-bg)] px-3 py-2 text-[12px] leading-snug text-[color:var(--lkv-danger)]"
          >
            <CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <p className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[11.5px] leading-snug text-[color:var(--label2)]">
          {OUTING_AUDIENCE_CONTRACT_NOTE}
        </p>

        <OutingAudienceMatrix />

        <p className="m-0 text-[11.5px] leading-snug text-[color:var(--label2)]">
          Partage externe indisponible : aucune route publique ni jeton de
          partage de sortie n’existe. Ce panneau ne fabrique pas de lien et ne
          présente pas l’URL du Compte comme un partage de la sortie.
        </p>
      </div>
    </OverlaySheet>
  );
}

/**
 * Matrice de droits réellement appliquée par le schéma actuel. Elle sert de
 * preuve lisible dans le drawer, pas de promesse sur une audience future.
 */
export function OutingAudienceMatrix() {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] text-[11px] leading-snug text-[color:var(--label2)]">
      <caption className="pb-1 text-left text-[11px] font-semibold text-[color:var(--label2)]">
        Droits appliqués aujourd’hui
      </caption>
      <thead>
        <tr>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            Audience
          </th>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            Lecture
          </th>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            Contrat
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Propriétaire
          </th>
          <td className="px-2 py-1.5">Oui</td>
          <td className="px-2 py-1.5">user_id = auth.uid()</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Mes abonnés
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Pas de policy par abonné</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Public
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Pas de policy directe</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Tiers bloqué
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Pas de lecture via cette audience</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Collectif anonymisé
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Aucune vue par cette valeur</td>
        </tr>
      </tbody>
    </table>
  );
}

export default OutingAudienceSheet;
