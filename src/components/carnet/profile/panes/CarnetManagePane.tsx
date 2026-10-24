'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetManagePaneProps {
  detail: CarnetDetail;
  url: string;
  onExport: () => void;
  onDeleted: () => void;
}

/** Gestion propriétaire, dans la carte : visibilité, export, copie, suppression. */
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
    <div className="ckp-pane">
      <button type="button" className="ckp-row" onClick={() => void changeVisibility()} disabled={busy}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>Visibilité</b>
          <small>{isPublic ? 'Public — visible dans la communauté' : 'Privé — visible par vous seul'}</small>
        </span>
        <span className={`ckp-switch${isPublic ? ' is-on' : ''}`} aria-hidden="true">
          <span />
        </span>
      </button>

      <button type="button" className="ckp-row" onClick={onExport}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>Exporter le carnet</b>
          <small>JSON complet — récit, étapes, moments, kit</small>
        </span>
        <Icon name="download" size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="ckp-row"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => toast('Lien copié.', 'success'));
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>Copier le lien</b>
          <small>{url}</small>
        </span>
        <Icon name="link" size={16} aria-hidden="true" />
      </button>

      {confirmDelete ? (
        <div className="ckp-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <b style={{ fontSize: 13 }}>Supprimer définitivement ce carnet ?</b>
          <small>Le récit, les étapes, les moments et le kit seront supprimés.</small>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="ckp-pill" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="ckp-pill"
              style={{ background: 'rgba(180,60,48,.1)', color: '#a33227' }}
              onClick={() => void remove()}
              disabled={busy}
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="ckp-row ckp-row--danger" onClick={() => setConfirmDelete(true)}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>Supprimer le carnet</b>
            <small>Action définitive</small>
          </span>
          <Icon name="trash2" size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default CarnetManagePane;
