/**
 * Appels clients des actions de sécurité du réseau.
 *
 * Toutes les mutations passent par les routes `/api/compte/reseau/*` : l'acteur
 * vient du JWT, le client n'écrit jamais directement dans `user_blocks`,
 * `group_reports`, `user_content_mutes`, `story_hidden_users` ou
 * `conversation_members`.
 */

import type { RelationshipPolicy } from '@/features/compte/domain/relationshipPolicy';

export interface ModerationState {
  blockedByViewer: boolean;
  blockedByTarget: boolean;
  /** Sourdine de contenu : publications de fil et stories. */
  mutedContent: boolean;
  /** Sourdine de conversation : notifications de la conversation directe. */
  mutedConversation: boolean;
  hasDirectConversation: boolean;
  policy: RelationshipPolicy;
}

export interface BlockResult {
  blocked: true;
}

export interface ReportResult {
  reported: true;
  duplicate: boolean;
}

export interface MuteResult {
  conversationMuted: true;
}

export interface ContentMuteResult {
  contentMuted: true;
}

type ApiPayload = {
  error?: unknown;
  code?: unknown;
};

const FALLBACK_ERROR = 'Cette action de sécurité est momentanément indisponible.';

export class ReseauModerationError extends Error {
  readonly code: string | null;
  readonly httpStatus: number;

  constructor(message: string, code: string | null, httpStatus: number) {
    super(message);
    this.name = 'ReseauModerationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
    });
  } catch {
    throw new ReseauModerationError(FALLBACK_ERROR, 'network', 0);
  }
  const payload = (await response.json().catch(() => null)) as (T & ApiPayload) | null;
  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string' && payload.error.trim()
        ? payload.error
        : FALLBACK_ERROR;
    const code = payload && typeof payload.code === 'string' ? payload.code : null;
    throw new ReseauModerationError(message, code, response.status);
  }
  return payload as T;
}

function withUser(targetId: string): string {
  return JSON.stringify({ userId: targetId });
}

export async function loadModerationState(targetId: string): Promise<ModerationState> {
  return request<ModerationState>(
    `/api/compte/reseau/moderation?targetId=${encodeURIComponent(targetId)}`,
    { method: 'GET' }
  );
}

export async function blockUser(targetId: string, groupId?: string): Promise<BlockResult> {
  return request<BlockResult>('/api/compte/reseau/block', {
    method: 'POST',
    body: JSON.stringify({ userId: targetId, ...(groupId ? { groupId } : {}) }),
  });
}

export async function unblockUser(targetId: string): Promise<{ blocked: false }> {
  return request<{ blocked: false }>('/api/compte/reseau/block', {
    method: 'DELETE',
    body: withUser(targetId),
  });
}

export async function reportUser(
  targetId: string,
  categoryId: string,
  details?: string,
  groupId?: string
): Promise<ReportResult> {
  return request<ReportResult>('/api/compte/reseau/report', {
    method: 'POST',
    body: JSON.stringify({
      userId: targetId,
      categoryId,
      ...(details && details.trim() ? { details: details.trim() } : {}),
      ...(groupId ? { groupId } : {}),
    }),
  });
}

export async function muteUser(targetId: string): Promise<MuteResult> {
  return request<MuteResult>('/api/compte/reseau/mute', {
    method: 'POST',
    body: withUser(targetId),
  });
}

export async function unmuteUser(targetId: string): Promise<{ conversationMuted: false }> {
  return request<{ conversationMuted: false }>('/api/compte/reseau/mute', {
    method: 'DELETE',
    body: withUser(targetId),
  });
}

/** Masque les publications de fil et les stories de la cible (sans blocage). */
export async function muteContentUser(targetId: string): Promise<ContentMuteResult> {
  return request<ContentMuteResult>('/api/compte/reseau/content-mute', {
    method: 'POST',
    body: withUser(targetId),
  });
}

/** Révoque la sourdine de contenu ; les contenus redeviennent visibles. */
export async function unmuteContentUser(
  targetId: string
): Promise<{ contentMuted: false }> {
  return request<{ contentMuted: false }>('/api/compte/reseau/content-mute', {
    method: 'DELETE',
    body: withUser(targetId),
  });
}

/** Message sûr pour l'UI : la route ne renvoie que des erreurs bornées. */
export function moderationErrorMessage(error: unknown, fallback = FALLBACK_ERROR): string {
  return error instanceof ReseauModerationError && error.message.trim()
    ? error.message
    : fallback;
}
