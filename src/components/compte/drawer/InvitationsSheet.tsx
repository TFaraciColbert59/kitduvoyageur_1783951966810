'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { profileInvitationPath } from '@/lib/invitationPaths';
import './InvitationsSheet.css';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface ProfileInvitation {
  id: string;
  invitee_id?: string | null;
  token: string;
  status: string;
  expires_at?: string | null;
  created_at?: string | null;
}

export interface InvitationsSheetProps {
  onClose: () => void;
  /** Injectable pour les tests ; `fetch` global en production. */
  fetcher?: typeof fetch;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  revoked: 'Révoquée',
  expired: 'Expirée',
};

function isInvitation(value: unknown): value is ProfileInvitation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' && typeof row.token === 'string' && typeof row.status === 'string'
  );
}

function inviteUrl(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${profileInvitationPath(token)}`;
}

/** Une invitation pending dont l'expiration est passée s'affiche « Expirée ». */
function effectiveStatus(invitation: ProfileInvitation, now = Date.now()): string {
  if (invitation.status === 'pending' && invitation.expires_at) {
    const time = new Date(invitation.expires_at).getTime();
    if (Number.isFinite(time) && time <= now) return 'expired';
  }
  return invitation.status;
}

function expiryLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'Sans expiration';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'Expiration inconnue';
  return `Expire le ${date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
}

function httpStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

function loadErrorMessage(error: unknown): string {
  const status = httpStatus(error);
  if (status === 401) return 'Session expirée : reconnecte-toi pour gérer les invitations.';
  if (status === 403) return 'Tu n’as pas accès à ces invitations.';
  return 'Impossible de charger les invitations pour le moment.';
}

/**
 * Feuille propriétaire des invitations à un profil privé.
 *
 * Uniquement des données réelles : `GET /api/compte/invitations` pour la liste,
 * `POST` pour créer/révoquer. Aucune invitation n'est fabriquée localement ; le
 * lien copié est `/invitation/<token>` et l'API reste bornée par la RLS owner.
 */
export function InvitationsSheet({ onClose, fetcher }: InvitationsSheetProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [invitations, setInvitations] = useState<ProfileInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const request = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => (fetcher ?? fetch)(input, init),
    [fetcher]
  );

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const response = await request('/api/compte/invitations', {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw Object.assign(new Error('load_failed'), { status: response.status });
      const body = (await response.json()) as { invitations?: unknown };
      const rows = Array.isArray(body.invitations) ? body.invitations.filter(isInvitation) : [];
      setInvitations(rows);
      setPhase('ready');
    } catch (loadError) {
      setError(loadErrorMessage(loadError));
      setPhase('error');
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.removeAttribute('open');
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Capture + stopImmediatePropagation : sinon le listener global du runtime
      // ferme aussi le drawer complet derrière cette feuille.
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    if (dialog) dialog.removeAttribute('open');
    onClose();
  }, [onClose]);

  const createInvitation = useCallback(async () => {
    setBusy('create');
    setFeedback(null);
    setCopiedToken(null);
    try {
      const response = await request('/api/compte/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });
      if (!response.ok) {
        throw Object.assign(new Error('create_failed'), { status: response.status });
      }
      const body = (await response.json()) as { invitation?: unknown };
      if (!isInvitation(body.invitation)) throw new Error('invalid_invitation');
      setInvitations((current) => [body.invitation as ProfileInvitation, ...current]);
      setFeedback('Lien créé. Copie-le pour l’envoyer.');
    } catch {
      setFeedback('Impossible de créer l’invitation pour le moment.');
    } finally {
      setBusy(null);
    }
  }, [request]);

  const copyInvitation = useCallback(async (invitation: ProfileInvitation) => {
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(inviteUrl(invitation.token));
      setCopiedToken(invitation.id);
      setFeedback('Lien copié.');
    } catch {
      setCopiedToken(null);
      setFeedback('Copie impossible : sélectionne le lien affiché.');
    }
  }, []);

  const revokeInvitation = useCallback(
    async (invitation: ProfileInvitation) => {
      setBusy(invitation.id);
      setFeedback(null);
      try {
        const response = await request('/api/compte/invitations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'revoke', invitationId: invitation.id }),
        });
        if (!response.ok) {
          throw Object.assign(new Error('revoke_failed'), { status: response.status });
        }
        const body = (await response.json()) as { invitation?: unknown };
        const updated = isInvitation(body.invitation)
          ? body.invitation
          : { ...invitation, status: 'revoked' };
        setInvitations((current) =>
          current.map((row) => (row.id === invitation.id ? updated : row))
        );
        setFeedback('Invitation révoquée.');
      } catch {
        setFeedback('Impossible de révoquer cette invitation pour le moment.');
      } finally {
        setBusy(null);
      }
    },
    [request]
  );

  return (
    <dialog
      ref={dialogRef}
      className="lkdv-invitations-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="lkdv-invitations-panel">
        <header className="lkdv-invitations-head">
          <div>
            <h2 id={titleId}>Invitations</h2>
            <p>Partage un lien pour ouvrir ton profil privé.</p>
          </div>
          <button
            type="button"
            className="lkdv-invitations-close"
            aria-label="Fermer les invitations"
            onClick={close}
          >
            <LKDVIcon name="fermer" size="1em" className="lkdv-icon-inline" /></button>
        </header>

        {phase === 'loading' ? (
          <p className="lkdv-invitations-state" role="status">
            Chargement des invitations…
          </p>
        ) : null}

        {phase === 'error' ? (
          <div className="lkdv-invitations-state" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="lkdv-invitations-secondary"
              onClick={() => void load()}
            >
              Réessayer
            </button>
          </div>
        ) : null}

        {phase === 'ready' ? (
          <>
            <div className="lkdv-invitations-actions">
              <button
                type="button"
                className="lkdv-invitations-primary"
                onClick={() => void createInvitation()}
                disabled={busy === 'create'}
              >
                {busy === 'create' ? 'Création…' : 'Créer un lien'}
              </button>
            </div>

            {feedback ? (
              <p className="lkdv-invitations-feedback" role="status">
                {feedback}
              </p>
            ) : null}

            {invitations.length === 0 ? (
              <p className="lkdv-invitations-state">Aucune invitation pour le moment.</p>
            ) : (
              <ul className="lkdv-invitations-list">
                {invitations.map((invitation) => {
                  const status = effectiveStatus(invitation);
                  return (
                    <li key={invitation.id} className="lkdv-invitations-row">
                      <div className="lkdv-invitations-meta">
                        <span className="lkdv-invitations-status" data-status={status}>
                          {STATUS_LABELS[status] ?? status}
                        </span>
                        <code className="lkdv-invitations-link">{inviteUrl(invitation.token)}</code>
                        <small>{expiryLabel(invitation.expires_at)}</small>
                      </div>
                      <div className="lkdv-invitations-row-actions">
                        {status === 'pending' ? (
                          <button
                            type="button"
                            className="lkdv-invitations-secondary"
                            aria-label={`Copier le lien de l’invitation ${invitation.id}`}
                            onClick={() => void copyInvitation(invitation)}
                          >
                            {copiedToken === invitation.id ? 'Copié' : 'Copier'}
                          </button>
                        ) : null}
                        {invitation.status !== 'revoked' && status !== 'expired' ? (
                          confirmRevoke === invitation.id ? (
                            <>
                              <button
                                type="button"
                                className="lkdv-invitations-danger"
                                aria-label={`Confirmer la révocation de l’invitation ${invitation.id}`}
                                onClick={() => {
                                  setConfirmRevoke(null);
                                  void revokeInvitation(invitation);
                                }}
                                disabled={busy === invitation.id}
                              >
                                Confirmer ?
                              </button>
                              <button
                                type="button"
                                className="lkdv-invitations-secondary"
                                aria-label={`Annuler la révocation de l’invitation ${invitation.id}`}
                                onClick={() => setConfirmRevoke(null)}
                              >
                                Annuler
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="lkdv-invitations-danger"
                              aria-label={`Révoquer l’invitation ${invitation.id}`}
                              onClick={() => setConfirmRevoke(invitation.id)}
                              disabled={busy === invitation.id}
                            >
                              Révoquer
                            </button>
                          )
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </dialog>
  );
}
