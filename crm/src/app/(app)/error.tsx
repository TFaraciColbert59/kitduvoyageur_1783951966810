'use client';

import { useEffect } from 'react';
import s from '@/ui/crm.module.css';
import { ErrorState } from '@/ui/error-state';
import { Workspace } from '@/components/shell/workspace';

/** Filet de sécurité : une erreur d'écran ne laisse jamais une page blanche. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // La trace complète reste côté serveur ; on n'expose rien de technique à l'écran.
    console.error('[crm] erreur d’écran', error.digest ?? '');
  }, [error]);

  return (
    <Workspace>
      <div className={s.card}>
        <ErrorState
          cause="Cet écran n’a pas pu être chargé. La base ou le serveur n’a pas répondu à temps."
          solution="Réessayez. Si le problème dure, ouvrez l’écran Technique : les erreurs récentes y sont listées."
          onRetry={reset}
        />
      </div>
    </Workspace>
  );
}
