import type { CreateKindV2 } from './createSchemasV2';

/**
 * Contrat entre un formulaire V2 et la coque (`CreateSheetV2`) : la coque ne
 * connaît que ce nav — pied Retour/Suivant/action finale, mini-capsule
 * d'étapes, état d'envoi et erreur serveur affichée une seule fois.
 */
export interface CreateNavV2 {
  kind: CreateKindV2;
  stepIndex: number;
  stepCount: number;
  /** Libellés des étapes (mini-capsule : « Étape i : … »). */
  stepLabels: readonly string[];
  canBack: boolean;
  /** Envoi en cours : le pied est occupé (pas de double envoi). */
  busy: boolean;
  /** « Envoi des médias… 45 % » quand des médias sont encore en cours. */
  busyLabel: string | null;
  finalLabel: string;
  /** Message d'erreur serveur, rendu une fois près du bouton. */
  serverError: string | null;
  /** Une saisie existe (brouillon non vide) : fermeture = confirmation. */
  hasContent: boolean;
  goBack: () => void;
  goNext: () => void;
  /** Mini-capsule : va à une étape ; une étape en avant valide d'abord. */
  goToStep: (index: number) => void;
  /** Écrit le brouillon tout de suite (fermeture, changement de type). */
  flushDraft: () => void;
}
