'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { CarnetField } from '../CarnetField';

export interface CarnetManagePaneProps {
  detail: CarnetDetail;
  url: string;
  onExport: () => void;
  onDeleted: () => void;
}

/**
 * Gestion propriétaire, dans la carte : visibilité, export, copie, suppression.
 *
 * Aucun titre de section, aucune phrase : quatre champs de 48 px séparés par
 * 20 px d'air, libellés en placeholders, valeurs réelles à droite. La
 * suppression demande une confirmation en deux champs, sans discours — le
 * liseré `#C13B34` et les noms accessibles portent le sérieux de l'action.
 */
export function CarnetManagePane({ detail, url, onExport, onDeleted }: CarnetManagePaneProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [visibility, setVisibility] = useState(detail.visibility);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const isPublic = visibility === 'public';

  const changeVisibility = async () => {
    const next = isPublic ? 'private' : 'public';
    setBusy(true);
    const { error } = await createClient()
      .from('carnets')
      .update({ visibility: next })
      .eq('id', detail.id);
    setBusy(false);
    if (error) {
      toast('Visibilité non modifiée.', 'error');
      return;
    }
    setVisibility(next);
    toast(next === 'public' ? 'Carnet public.' : 'Carnet privé.', 'success');
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await createClient().from('carnets').delete().eq('id', detail.id);
    setBusy(false);
    if (error) {
      toast('Suppression impossible.', 'error');
      return;
    }
    toast('Carnet supprimé.', 'success');
    onDeleted();
  };

  return (
    <div className="ckp-pane ckp-manage">
      <div className="ckp-group">
        <CarnetField
          label="visibilité"
          value={
            <span className={`ckp-switch${isPublic ? ' is-on' : ''}`} aria-hidden="true">
              <span />
            </span>
          }
          onClick={() => void changeVisibility()}
          disabled={busy}
          ariaLabel={
            isPublic
              ? 'Visibilité : public. Appuyer pour rendre le carnet privé.'
              : 'Visibilité : privé. Appuyer pour rendre le carnet public.'
          }
        />
      </div>

      <div className="ckp-group">
        <CarnetField
          label="exporter"
          value="json"
          onClick={onExport}
          ariaLabel="Exporter le carnet en JSON complet"
        />
        <CarnetField
          label="copier le lien"
          value={url}
          wide
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => toast('Lien copié.', 'success'));
          }}
          ariaLabel="Copier le lien du carnet"
        />
      </div>

      <div className="ckp-group">
        {confirmDelete ? (
          <>
            <CarnetField
              label="annuler"
              showValue={false}
              onClick={() => setConfirmDelete(false)}
              ariaLabel="Annuler la suppression"
            />
            <CarnetField
              label="supprimer définitivement"
              tone="danger"
              showValue={false}
              onClick={() => void remove()}
              disabled={busy}
              ariaLabel="Confirmer la suppression définitive du carnet, de son récit, de ses étapes, de ses moments et de son kit"
            />
          </>
        ) : (
          <CarnetField
            label="supprimer le carnet"
            tone="danger"
            showValue={false}
            onClick={() => setConfirmDelete(true)}
            ariaLabel="Supprimer le carnet"
          />
        )}
      </div>
    </div>
  );
}

export default CarnetManagePane;
