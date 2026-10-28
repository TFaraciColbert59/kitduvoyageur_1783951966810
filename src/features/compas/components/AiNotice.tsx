'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Mention « IA » du Compas (PLAN-100 5.3) : une note de TEXTE, lue par les lecteurs d'écran ;
 * l'icône est décorative. Le parent ne la rend que s'il y a une IA derrière (interrupteur
 * allumé, ou contenu réellement produit) : voir `engine/aiNotice.ts`. Les textes viennent du
 * dictionnaire (`compas.ai.*`) ; le français y est mot pour mot celui du moteur (test de non-dérive).
 *
 * - `run` : avant et pendant la préparation, ce que l'IA peut faire.
 * - `done` : préparation terminée, l'IA a contribué, où la reconnaître.
 * - `withPrivacyLink` : renvoie vers ce qui lui est envoyé (politique de confidentialité).
 */
export function AiNotice({
  variant,
  withPrivacyLink = false,
}: {
  variant: 'run' | 'done';
  withPrivacyLink?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <p role="note" className="cp-note cp-ai">
      <LKDVIcon name="ia" size={12} aria-hidden="true" />{' '}
      {variant === 'run' ? t('compas.ai.noticeRun') : t('compas.ai.noticeDone')}
      {withPrivacyLink && (
        <>
          {' '}
          <Link href="/politique-confidentialite">{t('compas.ai.privacyLink')}</Link>
        </>
      )}
    </p>
  );
}
