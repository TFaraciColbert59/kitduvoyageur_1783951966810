/**
 * S2.38 — orchestration de l'assistant historique.
 *
 * Ordre non négociable :
 *   1. consentement vérifié AVANT toute lecture ;
 *   2. historique chargé, réduit aux champs autorisés ;
 *   3. questions proposées sans IA (toujours) ;
 *   4. réponse IA seulement si un fournisseur Claude/Gemini est configuré.
 *
 * Un refus ou une absence de clé ne supprime jamais les questions : l'état
 * est explicite et aucune métrique n'est inventée.
 */

import {
  unavailable,
  type AiGeneration,
  type AssistantCompletionPort,
  type AssistantProviderId,
} from '../contracts';
import {
  buildHistoryFacts,
  buildHistoryPrompt,
  sanitizeHistoryAnswer,
  suggestHistoryQuestions,
  type HistoryActivityRow,
  type HistoryFacts,
} from './historyContract';

export interface HistoryActivitiesPort {
  list(userId: string, limit: number): Promise<HistoryActivityRow[]>;
}

export interface HistoryConsentReadPort {
  isGranted(userId: string): Promise<boolean>;
}

export interface HistoryAssistantDeps {
  consent: HistoryConsentReadPort;
  activities: HistoryActivitiesPort;
  providers: Partial<Record<AssistantProviderId, AssistantCompletionPort>>;
  now?: () => Date;
}

export type HistoryStatus = 'ok' | 'consent_required' | 'no_data';

export interface HistoryQuestionsResult {
  status: HistoryStatus;
  questions: string[];
  facts: HistoryFacts | null;
  ai: AiGeneration;
}

export interface HistoryAnswerResult extends HistoryQuestionsResult {
  answer: AiGeneration;
}

export const HISTORY_ACTIVITY_LIMIT = 200;

function consentRequired(): HistoryAnswerResult {
  return {
    status: 'consent_required',
    questions: [],
    facts: null,
    ai: unavailable(
      'consent_required',
      'Accès à l’historique refusé : le consentement personnel_performance est absent ou révoqué.'
    ),
    answer: unavailable(
      'consent_required',
      'Accès à l’historique refusé : le consentement personnel_performance est absent ou révoqué.'
    ),
  };
}

function noData(): HistoryAnswerResult {
  return {
    status: 'no_data',
    questions: [],
    facts: null,
    ai: unavailable('no_data', 'Aucune sortie enregistrée : il n’y a rien à analyser.'),
    answer: unavailable('no_data', 'Aucune sortie enregistrée : il n’y a rien à analyser.'),
  };
}

function providerUnavailable(): AiGeneration {
  return unavailable(
    'provider_unconfigured',
    'Réponse IA indisponible : aucun fournisseur Claude ou Gemini configuré. Les questions et les agrégats restent disponibles.'
  );
}

async function loadFacts(
  userId: string,
  deps: HistoryAssistantDeps
): Promise<HistoryFacts> {
  const rows = await deps.activities.list(userId, HISTORY_ACTIVITY_LIMIT);
  return buildHistoryFacts(rows);
}

export async function getHistoryQuestions(
  userId: string,
  deps: HistoryAssistantDeps
): Promise<HistoryQuestionsResult> {
  const granted = await deps.consent.isGranted(userId);
  if (!granted) {
    const refused = consentRequired();
    return { status: refused.status, questions: [], facts: null, ai: refused.ai };
  }

  let facts: HistoryFacts;
  try {
    facts = await loadFacts(userId, deps);
  } catch {
    return {
      status: 'no_data',
      questions: [],
      facts: null,
      ai: unavailable('provider_unavailable', 'Historique illisible pour le moment.'),
    };
  }

  const questions = suggestHistoryQuestions(facts);
  if (questions.length === 0) {
    return {
      status: 'no_data',
      questions: [],
      facts,
      ai: unavailable('no_data', 'Aucune sortie enregistrée : il n’y a rien à analyser.'),
    };
  }

  return {
    status: 'ok',
    questions,
    facts,
    ai: unavailable('not_requested', 'Aucune question posée : les suggestions sont déterministes.'),
  };
}

export async function askHistoryAssistant(
  userId: string,
  question: string,
  providerId: AssistantProviderId,
  deps: HistoryAssistantDeps
): Promise<HistoryAnswerResult> {
  const granted = await deps.consent.isGranted(userId);
  if (!granted) return consentRequired();

  let facts: HistoryFacts;
  try {
    facts = await loadFacts(userId, deps);
  } catch {
    return {
      status: 'no_data',
      questions: [],
      facts: null,
      ai: unavailable('provider_unavailable', 'Historique illisible pour le moment.'),
      answer: unavailable('provider_unavailable', 'Historique illisible pour le moment.'),
    };
  }

  const questions = suggestHistoryQuestions(facts);
  if (questions.length === 0) {
    return {
      ...noData(),
      facts,
    };
  }

  const provider = deps.providers[providerId];
  if (!provider || !provider.isAvailable()) {
    const state = providerUnavailable();
    return {
      status: 'ok',
      questions,
      facts,
      ai: state,
      answer: state,
    };
  }

  const { system, prompt } = buildHistoryPrompt(question, facts);
  try {
    const completion = await provider.complete({ system, prompt, maxTokens: 900 });
    const answerText = sanitizeHistoryAnswer(completion.text);
    if (!answerText) {
      const state = unavailable(
        'invalid_response',
        'Réponse IA écartée : format inattendu ou coordonnées détectées.'
      );
      return { status: 'ok', questions, facts, ai: state, answer: state };
    }
    const answer: AiGeneration = {
      status: 'available',
      provider: completion.provider,
      model: completion.model,
      text: answerText,
      generatedAt: (deps.now?.() ?? new Date()).toISOString(),
    };
    return { status: 'ok', questions, facts, ai: answer, answer };
  } catch {
    const state = unavailable(
      'provider_unavailable',
      'Réponse IA momentanément indisponible. Les questions et les agrégats restent disponibles.'
    );
    return { status: 'ok', questions, facts, ai: state, answer: state };
  }
}
