'use client';

import { useAdminChannel } from '@/components/data/use-admin-channel';
import { Chip } from '@/ui/chip';

/** Pastille « Temps réel connecté » : l'état réel du canal, jamais une décoration. */
export function RealtimeChip({ channel = 'queue' }: { channel?: string }) {
  const status = useAdminChannel(channel);

  if (status === 'connecte') {
    return (
      <Chip tone="sage" dot>
        Temps réel connecté
      </Chip>
    );
  }
  if (status === 'connexion') {
    return (
      <Chip tone="stone" dot>
        Temps réel : connexion…
      </Chip>
    );
  }
  return (
    <Chip tone="stone" dot title="Le canal temps réel n’est pas joignable ; les écrans se rechargent à la demande.">
      Temps réel indisponible
    </Chip>
  );
}
