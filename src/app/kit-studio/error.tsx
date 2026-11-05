'use client';

import '@/features/kit-studio/ui/kit-studio.css';
import '@/features/kit-studio/ui/route.css';
import { S } from '@/features/kit-studio/ui/strings';

/** Erreur de l'écran : message neutre (rien d'interne n'est montré) et « Réessayer ». */
export default function KitStudioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ks-root ks-stage ks-error" role="alert">
      <p className="ks-error-mark" aria-hidden="true">⚠</p>
      <p className="ks-error-text">{S.states.error}</p>
      <button type="button" className="ks-gbtn" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
