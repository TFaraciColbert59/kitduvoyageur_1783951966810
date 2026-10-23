'use client';

import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translate';

/**
 * Un texte du dictionnaire dans un composant serveur du Compas (squelette…) :
 * seule cette feuille est cliente. Rendue côté serveur avec la locale du
 * `LocaleProvider` racine, elle s'affiche juste avant tout JavaScript.
 */
export function CompasText({ k }: { k: TranslationKey }) {
  const { t } = useTranslation();
  return <>{t(k)}</>;
}
