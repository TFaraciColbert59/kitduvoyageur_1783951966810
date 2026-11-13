'use client';

import type { CommandResult } from '../../lib/rpc';

/** Toute écriture passe par une route serveur (jamais d'écriture de table ici). */
async function post(path: string, body: unknown): Promise<CommandResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'Hors connexion : l’action n’a pas été envoyée. Reconnectez-vous puis réessayez.' };
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, error: 'Le serveur n’a pas répondu. Vérifiez votre connexion puis réessayez.' };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: 'Cette action n’est pas encore branchée côté serveur. Le reste du CRM continue de fonctionner.'
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const record = (payload ?? {}) as Partial<CommandResult> & { error?: string; message?: string };

  if (!response.ok) {
    return {
      ok: false,
      error: record.error ?? record.message ?? 'L’action a été refusée. Le motif est indiqué dans le journal d’audit.'
    };
  }

  return {
    ok: record.ok ?? true,
    data: record.data,
    request_id: record.request_id ?? null,
    audit_id: record.audit_id ?? null,
    message: record.message,
    error: record.ok === false ? (record.error ?? record.message ?? 'L’action n’a pas abouti.') : undefined
  };
}

/** Exécute une commande du registre (144 actions + transverses). */
export function runCommand(command: string, params: Record<string, unknown> = {}): Promise<CommandResult> {
  return post('/api/cmd', { command, params });
}

/** Valide une demande à deux personnes (ou en solo, avec le mode affiché). */
export function approveRequest(id: string, confirmation: string): Promise<CommandResult> {
  return post('/api/approve', { id, confirmation });
}

/** Annule une action réversible dans les 10 s. */
export function undoAudit(auditId: string): Promise<CommandResult> {
  return post('/api/undo', { audit_id: auditId });
}

/** Message d'erreur traduit, sans code brut. */
export function errorMessage(result: CommandResult): string {
  return result.error ?? result.message ?? 'L’action n’a pas abouti.';
}
