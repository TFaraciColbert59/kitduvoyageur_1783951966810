/**
 * Port IA de LKDV — contrat unique entre les features et les providers.
 * Changer de provider (Nemotron → Claude/GPT/local) = écrire UN adapter ici.
 * Aucune feature n'importe un provider directement : elles appellent askAI().
 */

export type AITier = 'heavy' | 'fast';

export interface AIPluginConfig {
  id: string;
  max_results?: number;
}

export interface AIRequest {
  feature: string; // clé du registre (src/lib/ai/features/registry.ts)
  tier: AITier;
  /**
   * Palier décompté au quota de la personne, quand il diffère du modèle
   * appelé : la préparation du Compas interroge le modèle rapide (réponse
   * longue, temps compté) mais se décompte en `heavy`, comme le prévoit sa
   * fiche. Absent : `tier`.
   */
  quotaTier?: AITier;
  system: string;
  prompt: string;
  maxTokens: number;
  reasoningBudget?: number; // borne le raisonnement d'Ultra (crucial pour le quota)
  cacheTtlSeconds?: number; // 0 = pas de cache (utilisé par askAI, pas le provider)
  userId?: string; // pour le quota (utilisé par askAI, pas le provider)
  plugins?: AIPluginConfig[]; // plugins OpenRouter optionnels (ex: web search)
  /**
   * La feature attend un objet JSON : le provider le demande au modèle
   * (`response_format: json_object` chez NVIDIA). Le JSON rendu est alors
   * toujours lisible ; ses CLÉS restent à valider par la feature.
   */
  json?: boolean;
  /**
   * Annulation cooperative, propagee du client jusqu a la socket.
   *
   * Elle manquait, et cette absence coutait deux fois. Le preparateur verifies
   * `signal.aborted` entre deux phases, donc l utilisateur pouvait croire
   * avoir abandonne alors que la requete continuait de courir cote serveur — et
   * payer le full jet de tokens pour un resultat jette. Et `askAI`, teste les
   * providers l un apres l autre, ne pouvait pas interrompre un candidat deja
   * perdu : il fallait attendre son delai entier.
   *
   * Facultatif : un provider appele sans signal se comporte comme avant.
   */
  signal?: AbortSignal;
}

/**
 * Cause REELLE d'un repli, distincte de `degraded`.
 *
 * `degraded` dit QUOI il s'est passe ; ceci dit POURQUOI. Sans ce second
 * champ, l'ecran n'a que deux phrases possibles — « assistant desactive » ou
 * « service tombe » — et les deux sont fausses quand le provider a depasse son
 * delai, ce qui est le cas le plus frequent en measurant.
 */
export type AIFailureReason =
  | 'delai_depasse'
  | 'quota_epuise'
  /** IA éteinte par le site (`AI_MODE=off`, plan 1.7) : rien n'est appelé. */
  | 'ia_eteinte'
  | 'provider_indisponible'
  | 'reponse_invalide';

export interface AIResponse {
  text: string;
  model: string;
  degraded: boolean;
  cached: boolean;
  provider: string;
  /** Renseignee UNIQUEMENT quand `degraded` est vrai. */
  failureReason?: AIFailureReason;
}

export interface AIProvider {
  readonly name: string;
  /** Clé présente + endpoint joignable (vérification cheap, sans appel réseau). */
  isAvailable(): boolean;
  /** Retourne le texte brut. Throw en cas d'échec → askAI gère le fallback. */
  complete(req: AIRequest): Promise<string>;
}

/** Erreur transport normalisée (status HTTP ou timeout) — jamais de clé dedans. */
export class ProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}
