'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetManageSheetProps {
  open: boolean;
  detail: CarnetDetail;
  url: string;
  onClose: () => void;
  onExport: () => void;
  onCopied: () => void;
}

/** Gestion propriétaire : visibilité réelle, export JSON, copie, suppression. */
export function CarnetManageSheet({
  open,
  detail,
  url,
  onClose,
  onExport,
  onCopied,
}: CarnetManageSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [visibility, setVisibility] = useState(detail.visibility);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

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
    onClose();
    router.push('/carnets');
  };

  return (
    <OverlaySheet title="Gérer le carnet" subtitle={detail.title} onClose={onClose}>
      <div className="lkdv-overlay-card">
        <button
          type="button"
          className="lkdv-overlay-row"
          onClick={() => void changeVisibility()}
          disabled={busy}
        >
          <span className="lkdv-overlay-row-main">
            <b>Visibilité</b>
            <small>
              {isPublic ? 'Public — visible dans la communauté' : 'Privé — visible par vous seul'}
            </small>
          </span>
          <span className={`lkdv-drawer-toggle${isPublic ? ' on' : ''}`} aria-hidden="true">
            <span />
          </span>
        </button>
        <button type="button" className="lkdv-overlay-row" onClick={onExport}>
          <span className="lkdv-overlay-row-main">
            <b>Exporter le carnet</b>
            <small>JSON complet — récit, étapes, moments, kit</small>
          </span>
          <Icon name="download" size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="lkdv-overlay-row"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(onCopied);
          }}
        >
          <span className="lkdv-overlay-row-main">
            <b>Copier le lien</b>
            <small>{url}</small>
          </span>
          <Icon name="link" size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="lkdv-overlay-card" style={{ marginTop: 10 }}>
        {confirmDelete ? (
          <div style={{ padding: 12 }}>
            <b style={{ display: 'block', fontSize: 13 }}>Supprimer définitivement ce carnet ?</b>
            <p style={{ margin: '4px 0 10px', fontSize: 11.5, color: '#5f6f66' }}>
              Le récit, les étapes, les moments et le kit seront supprimés.
            </p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="lkdv-drawer-btn is-ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="lkdv-drawer-btn is-danger"
                onClick={() => void remove()}
                disabled={busy}
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="lkdv-overlay-row" onClick={() => setConfirmDelete(true)}>
            <span className="lkdv-overlay-row-main" style={{ color: '#a33227' }}>
              <b>Supprimer le carnet</b>
              <small>Action définitive</small>
            </span>
            <Icon name="trash2" size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </OverlaySheet>
  );
}

export default CarnetManageSheet;
