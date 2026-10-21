'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { profileInvitationLoginPath } from '@/lib/invitationPaths';
import './ProfileInvitationAccept.css';

export interface ProfileInvitationAcceptProps {
  token: string;
  /** Injectable pour les tests ; `fetch` global en production. */
  fetcher?: typeof fetch;
}

type AcceptState =
  | { kind: 'loading' }
  | { kind: 'accepted'; already: boolean; ownerId: string | null }
  | { kind: 'not_found' }
  | { kind: 'reserved' }
  | { kind: 'expired' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' };

function ownerHref(ownerId: string | null): string {
  return ownerId ? `/profil/${encodeURIComponent(ownerId)}` : '/compte';
}

/**
 * Acceptation d'une invitation à un profil privé.
 *
 * La page serveur a déjà vérifié la session ; ce composant appelle réellement
 * `POST /api/compte/invitations` (action `accept`) et rend un état honnête par
 * code HTTP. Aucune donnée de démonstration : le jeton vient de l'URL.
 */
export function ProfileInvitationAccept({
  token,
  fetcher,
}: ProfileInvitationAcceptProps) {
  const titleId = useId();
  const [state, setState] = useState<AcceptState>({ kind: 'loading' });
  const [retrying, setRetrying] = useState(false);

  const request = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => (fetcher ?? fetch)(input, init),
    [fetcher]
  );

  const accept = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await request('/api/compte/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'accept', token }),
      });

      if (response.status === 401) {
        setState({ kind: 'unauthenticated' });
        return;
      }
      if (response.status === 404) {
        setState({ kind: 'not_found' });
        return;
      }
      if (response.status === 403) {
        setState({ kind: 'reserved' });
        return;
      }
      if (response.status === 409) {
        setState({ kind: 'expired' });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error' });
        return;
      }

      const body = (await response.json()) as {
        accepted?: unknown;
        already?: unknown;
        owner_id?: unknown;
      };
      if (body.accepted !== true || typeof body.already !== 'boolean') {
        setState({ kind: 'error' });
        return;
      }

      setState({
        kind: 'accepted',
        already: body.already,
        ownerId: typeof body.owner_id === 'string' ? body.owner_id : null,
      });
    } catch {
      setState({ kind: 'error' });
    }
  }, [request, token]);

  useEffect(() => {
    void accept();
  }, [accept]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await accept();
    } finally {
      setRetrying(false);
    }
  }, [accept]);

  return (
    <section
      className="lkdv-profile-invitation"
      aria-labelledby={titleId}
      data-state={state.kind}
    >
      <p className="lkdv-profile-invitation-kicker">Invitation à un profil privé</p>

      {state.kind === 'loading' ? (
        <>
          <h1 id={titleId}>Invitation à un profil privé</h1>
          <p className="lkdv-profile-invitation-state" role="status">
            Vérification de l’invitation…
          </p>
        </>
      ) : null}

      {state.kind === 'accepted' ? (
        <>
          <h1 id={titleId}>
            {state.already ? 'Invitation déjà acceptée' : 'Invitation acceptée'}
          </h1>
          <p className="lkdv-profile-invitation-state" role="status">
            {state.already
              ? 'Tu avais déjà accepté cette invitation : le profil privé reste accessible.'
              : 'Tu peux maintenant consulter le profil privé de cette personne.'}
          </p>
          <Link className="lkdv-profile-invitation-link" href={ownerHref(state.ownerId)}>
            Voir le profil
          </Link>
        </>
      ) : null}

      {state.kind === 'not_found' ? (
        <>
          <h1 id={titleId}>Invitation introuvable</h1>
          <p className="lkdv-profile-invitation-state" role="alert">
            Ce lien d’invitation n’existe pas ou a été révoqué. Demande un nouveau lien au
            propriétaire du profil.
          </p>
          <Link className="lkdv-profile-invitation-link" href="/compte">
            Retour à mon compte
          </Link>
        </>
      ) : null}

      {state.kind === 'reserved' ? (
        <>
          <h1 id={titleId}>Invitation réservée à une autre personne</h1>
          <p className="lkdv-profile-invitation-state" role="alert">
            Cette invitation a été créée pour un autre compte. Connecte-toi avec le compte
            invité ou demande un nouveau lien.
          </p>
          <Link className="lkdv-profile-invitation-link" href="/compte">
            Retour à mon compte
          </Link>
        </>
      ) : null}

      {state.kind === 'expired' ? (
        <>
          <h1 id={titleId}>Invitation expirée</h1>
          <p className="lkdv-profile-invitation-state" role="alert">
            Cette invitation a expiré ou n’est plus valide. Demande un nouveau lien au
            propriétaire du profil.
          </p>
          <Link className="lkdv-profile-invitation-link" href="/compte">
            Retour à mon compte
          </Link>
        </>
      ) : null}

      {state.kind === 'unauthenticated' ? (
        <>
          <h1 id={titleId}>Connexion requise</h1>
          <p className="lkdv-profile-invitation-state" role="alert">
            Ta session a expiré. Reconnecte-toi pour accepter cette invitation.
          </p>
          <Link
            className="lkdv-profile-invitation-link"
            href={profileInvitationLoginPath(token)}
          >
            Se connecter
          </Link>
        </>
      ) : null}

      {state.kind === 'error' ? (
        <>
          <h1 id={titleId}>Impossible d’accepter l’invitation</h1>
          <p className="lkdv-profile-invitation-state" role="alert">
            Une erreur est survenue. Tu peux réessayer ; le lien reste valable s’il n’a pas
            expiré.
          </p>
          <button
            type="button"
            className="lkdv-profile-invitation-action"
            onClick={() => void retry()}
            disabled={retrying}
          >
            {retrying ? 'Nouvel essai…' : 'Réessayer'}
          </button>
        </>
      ) : null}
    </section>
  );
}

