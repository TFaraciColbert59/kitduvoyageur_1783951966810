import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { AI_NOTICE_DONE, AI_NOTICE_RUN } from '../engine/aiNotice';

/**
 * Mention « IA » du Compas (PLAN-100 5.3) : une note de TEXTE, lue par les lecteurs d'écran ;
 * l'icône est décorative. Le parent ne la rend que s'il y a une IA derrière (interrupteur
 * allumé, ou contenu réellement produit) : voir `engine/aiNotice.ts`.
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
  return (
    <p role="note" className="cp-note cp-ai">
      <Icon name="sparkles" size={12} aria-hidden="true" />{' '}
      {variant === 'run' ? AI_NOTICE_RUN : AI_NOTICE_DONE}
      {withPrivacyLink && (
        <>
          {' '}
          <Link href="/politique-confidentialite">Ce qui lui est envoyé</Link>
        </>
      )}
    </p>
  );
}
