'use client';

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { compasOpenTripAction } from '../server/compasActions';
import {
  respondTripInvitationAction,
  type TripInvitationView,
} from '../server/invitationActions';
import { invitationDates } from '../engine/team';

/**
 * Invitations à un voyage, côté invité : accepter ou refuser sur place, sans
 * redirection forcée. Une fois acceptée, le bouton devient « Voir » : on
 * n'ouvre le voyage que si on le choisit. Utilisé dans les notifications
 * (alertes du hub), au départ du Compas et sur la page du lien d'invitation.
 */

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--lkv-radius-md)',
  background: 'var(--glass-solid)',
  border: '1px solid var(--lkv-border)',
};
const btn: CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid var(--lkv-border)',
  background: 'transparent',
  color: 'var(--lkv-text-primary)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};
const btnMain: CSSProperties = {
  ...btn,
  background: 'var(--lkv-primary)',
  borderColor: 'var(--lkv-primary)',
  color: 'var(--lkv-on-primary)',
};

type State = 'pending' | 'accepted' | 'declined';

export function InvitationResponse({
  invitationId,
  token,
  tripId,
  initial = 'pending',
  onDone,
}: {
  invitationId?: string;
  token?: string;
  tripId: string;
  initial?: State;
  onDone?: (state: State) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = async (accept: boolean) => {
    // Instantané : la réponse s'affiche tout de suite, l'enregistrement suit.
    const next: State = accept ? 'accepted' : 'declined';
    setState(next);
    setError(null);
    setBusy(true);
    const res = await respondTripInvitationAction({
      ...(invitationId ? { invitationId } : { token }),
      accept,
    }).catch(() => ({ success: false as const, error: 'Connexion perdue : réessaie.' }));
    setBusy(false);
    if (!res.success) {
      setState('pending');
      setError(res.error);
      return;
    }
    onDone?.(next);
  };

  const view = async () => {
    setBusy(true);
    const res = await compasOpenTripAction({ tripId }).catch(() => ({
      success: false as const,
      error: 'Connexion perdue : réessaie.',
    }));
    if (!res.success) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push('/compas');
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        {state === 'pending' && (
          <>
            <button type="button" style={btn} disabled={busy} onClick={() => void respond(false)}>
              Refuser
            </button>
            <button type="button" style={btnMain} disabled={busy} onClick={() => void respond(true)}>
              Accepter
            </button>
          </>
        )}
        {state === 'accepted' && (
          <button type="button" style={btnMain} disabled={busy} onClick={() => void view()}>
            Voir
          </button>
        )}
        {state === 'declined' && (
          <span style={{ fontSize: 14, color: 'var(--lkv-text-secondary)' }}>Refusée</span>
        )}
      </span>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--lkv-danger)' }}>
          {error}
        </span>
      )}
    </span>
  );
}

export function TripInvitationsInbox({
  invitations,
  title = 'Invitations à un voyage',
}: {
  invitations: TripInvitationView[];
  title?: string;
}) {
  if (!invitations.length) return null;
  return (
    <section aria-label={title} style={{ display: 'grid', gap: 8, width: '100%' }}>
      <h2
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--lkv-text-secondary)',
        }}
      >
        {title}
      </h2>
      {invitations.map((inv) => {
        const when = invitationDates(inv.startDate, inv.endDate);
        return (
          <div key={inv.invitationId} style={row}>
            <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
              <b style={{ fontSize: 15, color: 'var(--lkv-text-primary)' }}>{inv.tripTitle}</b>
              <span style={{ fontSize: 13, color: 'var(--lkv-text-secondary)' }}>
                {[`${inv.inviterName} t’invite`, inv.destination, when].filter(Boolean).join(' · ')}
              </span>
            </span>
            <InvitationResponse invitationId={inv.invitationId} tripId={inv.tripId} />
          </div>
        );
      })}
    </section>
  );
}
