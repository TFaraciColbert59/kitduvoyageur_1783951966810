'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { KEEP_TRIAL_PATH } from '@/features/demo/keepTrial';

/**
 * Rappel sobre d'un essai sans compte (PLAN-100 2.3) : une ligne de TEXTE et un lien vers
 * `/compte`. Le parent ne la rend que pour une session anonyme ET quand
 * l'interrupteur `NEXT_PUBLIC_KEEP_TRIAL=on` est allumé (`data.keepTrial`) : éteint, rien ne change.
 */
export function TrialNote() {
  const { t } = useTranslation();
  return (
    <p role="note" className="cp-trial cp-sheet-glass">
      {t('compas.trial.note')} <Link href={KEEP_TRIAL_PATH}>{t('compas.trial.keep')}</Link>
    </p>
  );
}
