'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { resolveConfirm, subscribeConfirm, type ConfirmRequest } from './dialogs';

/**
 * ConfirmHost — hôte global du ConfirmDialog (Phase 2, Lot 3).
 * Monté une seule fois (layout racine) : toutes les demandes `lkvConfirm`
 * s'affichent dans la même modale accessible, sans window.confirm.
 */
export default function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => subscribeConfirm(setRequest), []);

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
