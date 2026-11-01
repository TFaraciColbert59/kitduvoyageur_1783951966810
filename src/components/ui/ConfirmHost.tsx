'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { resolveConfirm, subscribeConfirm, type ConfirmRequest } from './dialogs';

// Radix Dialog n'est chargé qu'à la première demande : il sort du JS initial de la mise en page racine.
// Une demande arrivée avant la fin du chargement reste en attente dans `dialogs.ts` (jamais perdue).
const ConfirmDialog = dynamic(() => import('./ConfirmDialog').then((m) => m.ConfirmDialog), { ssr: false });

/**
 * ConfirmHost — hôte global du ConfirmDialog (Phase 2, Lot 3).
 * Monté une seule fois (layout racine) : toutes les demandes `lkvConfirm`
 * s'affichent dans la même modale accessible, sans window.confirm.
 */
export default function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const [everRequested, setEverRequested] = useState(false);

  useEffect(() => subscribeConfirm(setRequest), []);
  useEffect(() => {
    if (request) setEverRequested(true);
  }, [request]);

  // Une fois monté, le dialogue reste en place (animation de fermeture, focus rendu à l'appelant).
  if (!everRequested && !request) return null;

  return (
    <ConfirmDialog
      open={Boolean(request)}
      title={request?.title ?? 'Confirmation'}
      description={request?.message}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      variant={request?.variant ?? 'default'}
      onConfirm={() => resolveConfirm(true)}
      onCancel={() => resolveConfirm(false)}
    />
  );
}
