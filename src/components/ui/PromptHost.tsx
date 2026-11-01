'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { resolvePrompt, subscribePrompt, type PromptRequest } from './dialogs';

// Radix Dialog n'est chargé qu'à la première demande : il sort du JS initial de la mise en page racine.
// Une demande arrivée avant la fin du chargement reste en attente dans `dialogs.ts` (jamais perdue).
const PromptDialog = dynamic(() => import('./PromptDialog').then((m) => m.PromptDialog), { ssr: false });

export default function PromptHost() {
  const [request, setRequest] = useState<PromptRequest | null>(null);

  const [everRequested, setEverRequested] = useState(false);

  useEffect(() => subscribePrompt(setRequest), []);
  useEffect(() => {
    if (request) setEverRequested(true);
  }, [request]);

  // Une fois monté, le dialogue reste en place (animation de fermeture, focus rendu à l'appelant).
  if (!everRequested && !request) return null;

  return (
    <PromptDialog
      open={Boolean(request)}
      title={request?.title ?? ''}
      defaultValue={request?.defaultValue}
      placeholder={request?.placeholder}
      confirmLabel={request?.confirmLabel}
      onConfirm={(value) => resolvePrompt(value)}
      onCancel={() => resolvePrompt(null)}
    />
  );
}
