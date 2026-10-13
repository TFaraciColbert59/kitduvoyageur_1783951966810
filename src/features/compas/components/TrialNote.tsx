import Link from 'next/link';
import { KEEP_TRIAL_PATH } from '@/features/demo/keepTrial';

/**
 * Rappel sobre d'un essai sans compte (PLAN-100 2.3) : une ligne de TEXTE et un lien vers
 * `/compte/garder-mon-essai`. Le parent ne la rend que pour une session anonyme ET quand
 * l'interrupteur `NEXT_PUBLIC_KEEP_TRIAL=on` est allumé (`data.keepTrial`) : éteint, rien ne change.
 */
export function TrialNote() {
  return (
    <p role="note" className="cp-trial cp-sheet-glass">
      Essai sans compte : effacé après 7 jours sans visite.{' '}
      <Link href={KEEP_TRIAL_PATH}>Garder mon voyage</Link>
    </p>
  );
}
