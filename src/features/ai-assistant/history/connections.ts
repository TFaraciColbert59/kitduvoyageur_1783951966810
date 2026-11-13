/**
 * S2.38 — état des connexions externes, sans appel réseau.
 * Une connexion n'est « connectée » que si le consentement est actif ET si la
 * clé du fournisseur existe déjà dans l'environnement. Sinon l'état est
 * indisponible avec la cause exacte.
 */

import { AI_ASSISTANT_CONTRACT_VERSION, type AssistantProviderId } from '../contracts';

export interface ConnectionEnv {
  [key: string]: string | undefined;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export interface AssistantConnection {
  provider: AssistantProviderId;
  label: string;
  status: 'connected' | 'unavailable';
  reason: 'consent_required' | 'provider_unconfigured' | null;
  message: string;
  revocable: true;
}

export interface HistoryConnections {
  contractVersion: string;
  consent: {
    purpose: 'personal_performance';
    status: 'granted' | 'denied';
    revocable: true;
  };
  connections: AssistantConnection[];
}

function configured(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function describeHistoryConnections(
  consentGranted: boolean,
  env: ConnectionEnv = process.env
): HistoryConnections {
  const providers: Array<{ provider: AssistantProviderId; label: string; key: string | undefined }> = [
    { provider: 'claude', label: 'Claude', key: env.ANTHROPIC_API_KEY },
    { provider: 'gemini', label: 'Gemini', key: env.GEMINI_API_KEY },
  ];

  const connections: AssistantConnection[] = providers.map((entry) => {
    if (!consentGranted) {
      return {
        provider: entry.provider,
        label: entry.label,
        status: 'unavailable',
        reason: 'consent_required',
        message: 'Consentement personnel_performance absent ou révoqué : aucune lecture de l’historique.',
        revocable: true,
      };
    }
    if (!configured(entry.key)) {
      return {
        provider: entry.provider,
        label: entry.label,
        status: 'unavailable',
        reason: 'provider_unconfigured',
        message: `Clé ${entry.label} absente : la connexion reste indisponible, aucun appel externe.`,
        revocable: true,
      };
    }
    return {
      provider: entry.provider,
      label: entry.label,
      status: 'connected',
      reason: null,
      message: `Connexion ${entry.label} autorisée pour l’historique, révocable à tout moment.`,
      revocable: true,
    };
  });

  return {
    contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
    consent: {
      purpose: 'personal_performance',
      status: consentGranted ? 'granted' : 'denied',
      revocable: true,
    },
    connections,
  };
}
