'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetManagePaneProps {
  detail: CarnetDetail;
  url: string;
  onExport: () => void;
  onDeleted: () => void;
}

/**
 * Gestion propriétaire, dans la carte : visibilité, export, copie, suppression.
 * Lignes de réglage de 48 px, séparateur hairline inséré, chevron de 12 px,
 * aucun cadre ; les sections sont séparées par 24 px d’air et portent un
 * en-tête 10,5/600 espacé. L'interrupteur fait 36 × 20, teinte #17402C.
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
      <section className="ckp-manage-section" aria-label="Confidentialité">
        <h2 className="ckp-section-head">Confidentialité</h2>
        <button type="button" className="ckp-set" onClick={() => void changeVisibility()} disabled={busy}>
          <span className="ckp-set-label">
            <b>Visibilité</b>
            <small>{isPublic ? 'Public — visible dans la communauté' : 'Privé — visible par vous seul'}</small>
          </span>
          <span className={`ckp-switch${isPublic ? ' is-on' : ''}`} aria-hidden="true">
            <span />
          </span>
        </button>
      </section>

      <section className="ckp-manage-section" aria-label="Partage">
        <h2 className="ckp-section-head">Partage</h2>
        <button type="button" className="ckp-set" onClick={onExport}>
          <span className="ckp-set-label">
            <b>Exporter le carnet</b>
            <small>JSON complet — récit, étapes, moments, kit</small>
          </span>
          <ChevronRight size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ckp-set"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => toast('Lien copié.', 'success'));
          }}
        >
          <span className="ckp-set-label">
            <b>Copier le lien</b>
            <small>{url}</small>
          </span>
          <ChevronRight size={12} aria-hidden="true" />
        </button>
      </section>

      <section className="ckp-manage-section" aria-label="Suppression">
        <h2 className="ckp-section-head">Suppression</h2>
        {confirmDelete ? (
          <div className="ckp-set-confirm">
            <b>Supprimer définitivement ce carnet ?</b>
            <small>Le récit, les étapes, les moments et le kit seront supprimés.</small>
            <div className="ckp-set-confirm-row">
              <button type="button" className="ckp-pill" onClick={() => setConfirmDelete(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="ckp-pill ckp-pill--danger"
                onClick={() => void remove()}
                disabled={busy}
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="ckp-set ckp-set--danger" onClick={() => setConfirmDelete(true)}>
            <span className="ckp-set-label">
              <b>Supprimer le carnet</b>
              <small>Action définitive</small>
            </span>
            <ChevronRight size={12} aria-hidden="true" />
          </button>
        )}
      </section>
    </div>
  );
}

export default CarnetManagePane;
