'use client';

import React from 'react';
import type { Club, ClubNextEvent } from './cards/ClubCard';
import {
  finiteCountOrNull,
  formatCommunityDate,
  pluralizeCommunity,
} from './cards/communityFormat';
import './ClubDrawer.css';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export type ClubRsvp = 'yes' | 'no';

export type ClubMembershipStatus = 'active' | 'banned' | 'pending';

export interface ClubDrawerProps {
  /** `membershipStatus` vient du bootstrap ; `joined` reste le repli legacy. */
  club: Club & { membershipStatus?: ClubMembershipStatus | null };
  onClose: () => void;
}

function initialMembershipStatus(
  club: ClubDrawerProps['club']
): ClubMembershipStatus | null {
  const status = club.membershipStatus;
  if (status === 'active' || status === 'banned' || status === 'pending') return status;
  return club.joined ? 'active' : null;
}

/**
 * Le schéma `club_event_participants` ne stocke que la présence
 * (`event_id`, `user_id`, `joined_at`) : il n'existe pas de colonne pour un
 * « peut-être ». On n'affiche donc que deux réponses persistables, plutôt que
 * de simuler une réponse que la base ne saurait pas restituer.
 */
const RSVP_OPTIONS: ReadonlyArray<{ value: ClubRsvp; label: string; phrase: string }> = [
  { value: 'yes', label: 'Je participe', phrase: 'je participe' },
  { value: 'no', label: 'Non', phrase: 'non' },
];

/** Champs additifs exposés par le bootstrap (non déclarés par `ClubCard`). */
type DrawerRecommendedKit = NonNullable<Club['recommendedKits']>[number] & {
  image?: string | null;
  cover?: string | null;
  weight?: number | null;
};

/** `attending` est fourni par le bootstrap, pas encore par le type de carte. */
type DrawerNextEvent = ClubNextEvent & { attending?: boolean };

const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** `participants`/`max` et `participants_count`/`max_participants` sont acceptés. */
export function eventAttendance(event?: ClubNextEvent | null): string | null {
  if (!event) return null;
  const participants = finiteCountOrNull(event.participants ?? event.participants_count);
  const max = finiteCountOrNull(event.max ?? event.max_participants);
  if (max !== null && max > 0) {
    if (participants === null) return pluralizeCommunity(max, 'place');
    return `${participants} / ${max} ${participants === 1 ? 'inscrit' : 'inscrits'}`;
  }
  if (participants !== null && participants > 0) {
    return pluralizeCommunity(participants, 'inscrit');
  }
  return null;
}

/**
 * Drawer club : en-tête, rôle, membres actifs, prochain événement avec RSVP,
 * sujets récents, kits recommandés, actions et règles de sécurité.
 *
 * Les actions Rejoindre/Quitter et RSVP sont optimistes : l'état bascule
 * immédiatement, puis revient à sa valeur précédente avec un message visible
 * si `POST /api/compte/clubs` refuse ou échoue. Aucun succès n'est simulé.
 */
export function ClubDrawer({ club, onClose }: ClubDrawerProps) {
  const titleId = React.useId();
  const eventTitleId = React.useId();
  const topicsTitleId = React.useId();
  const kitsTitleId = React.useId();
  const safetyTitleId = React.useId();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const membershipBusyRef = React.useRef(false);
  const rsvpBusyRef = React.useRef(false);

  const membershipStatusFromClub = initialMembershipStatus(club);
  const event = club.nextEvent ? (club.nextEvent as DrawerNextEvent) : null;
  const initialRsvp: ClubRsvp | null = event?.attending === true ? 'yes' : null;
  const [membershipStatus, setMembershipStatus] = React.useState<ClubMembershipStatus | null>(
    membershipStatusFromClub
  );
  const [rsvp, setRsvp] = React.useState<ClubRsvp | null>(initialRsvp);
  const [notice, setNotice] = React.useState('');
  const [noticeIsError, setNoticeIsError] = React.useState(false);

  React.useEffect(() => {
    setMembershipStatus(membershipStatusFromClub);
    setRsvp(initialRsvp);
    setNotice('');
    setNoticeIsError(false);
  }, [
    club.id,
    club.joined,
    club.membershipStatus,
    club.nextEvent?.id,
    initialRsvp,
    membershipStatusFromClub,
  ]);

  // `<dialog>` modal : échappe au transform du pager et piège le focus nativement.
  // Le fallback `open` couvre jsdom, où `showModal` peut ne pas être implémenté.
  React.useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog) {
      try {
        if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
        else if (!dialog.open) dialog.setAttribute('open', '');
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    closeRef.current?.focus();
    return () => {
      if (dialog?.open) {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute('open');
        }
      }
      previousFocusRef.current?.focus?.();
    };
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const name = club.n?.trim() || 'Club';
  const role = club.role?.trim();
  const members = finiteCountOrNull(club.members);
  const eventTitle = event?.title?.trim();
  const eventDate = formatCommunityDate(event?.event_date);
  const eventLocation = event?.location?.trim();
  const attendance = eventAttendance(event);
  const topics = React.useMemo(
    () =>
      [...(club.topics ?? [])].sort(
        (a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))
      ),
    [club.topics]
  );
  const recommendedKits = (club.recommendedKits ??
    club.recommended_kits ??
    []) as DrawerRecommendedKit[];

  const showNotice = (message: string) => {
    setNoticeIsError(false);
    setNotice(message);
  };

  const showError = (message: string) => {
    setNoticeIsError(true);
    setNotice(message);
  };

  const toggleMembership = async () => {
    if (membershipBusyRef.current) return;
    if (membershipStatus !== 'active' && membershipStatus !== null) return;
    membershipBusyRef.current = true;
    const previous = membershipStatus;
    const next: ClubMembershipStatus | null = previous === 'active' ? null : 'active';
    const action = next === 'active' ? 'join' : 'leave';

    // Optimiste : l'interface répond avant le réseau.
    setMembershipStatus(next);
    if (next === null) setRsvp(null);
    showNotice(next === 'active' ? `Tu as rejoint ${name}.` : `Tu as quitté ${name}.`);

    try {
      const response = await fetch('/api/compte/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, clubId: club.id }),
      });
      if (!response.ok) throw new Error('request_failed');

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const serverJoined =
        payload !== null &&
        typeof payload === 'object' &&
        typeof (payload as { joined?: unknown }).joined === 'boolean'
          ? Boolean((payload as { joined: boolean }).joined)
          : next === 'active';
      setMembershipStatus(serverJoined ? 'active' : null);
      if (!serverJoined) setRsvp(null);
      showNotice(serverJoined ? `Tu as rejoint ${name}.` : `Tu as quitté ${name}.`);
    } catch {
      // Rollback : on ne laisse pas croire à une adhésion non enregistrée.
      setMembershipStatus(previous);
      showError(
        next === 'active'
          ? `L'action n'a pas abouti : impossible de rejoindre ${name}. Réessaie.`
          : `L'action n'a pas abouti : impossible de quitter ${name}. Réessaie.`
      );
    } finally {
      membershipBusyRef.current = false;
    }
  };

  const chooseRsvp = async (choice: ClubRsvp, phrase: string) => {
    if (membershipStatus !== 'active') return;
    if (!event?.id) {
      showError("Cet événement n'est pas encore synchronisé.");
      return;
    }
    if (rsvpBusyRef.current) return;
    rsvpBusyRef.current = true;
    const previous = rsvp;

    // Optimiste : la réponse choisie est affichée avant la confirmation.
    setRsvp(choice);
    showNotice(`Ta réponse : ${phrase}.`);

    try {
      const response = await fetch('/api/compte/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rsvp',
          clubId: club.id,
          eventId: event.id,
          // `club_event_participants` ne stocke que la présence : « Non »
          // retire la participation de l'appelant.
          attending: choice === 'yes',
        }),
      });
      if (!response.ok) throw new Error('request_failed');
      showNotice(`Ta réponse : ${phrase}.`);
    } catch {
      setRsvp(previous);
      showError("Ta réponse n'a pas abouti. Réessaie.");
    } finally {
      rsvpBusyRef.current = false;
    }
  };

  const shareClub = async (invite: boolean) => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/clubs/${encodeURIComponent(club.id)}`
        : `/clubs/${encodeURIComponent(club.id)}`;
    const title = invite ? `Rejoins ${name}` : name;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        showNotice(invite ? 'Invitation partagée.' : 'Club partagé.');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showNotice(invite ? "Lien d'invitation copié." : 'Lien du club copié.');
        return;
      }
      showNotice("Le partage n'est pas disponible sur cet appareil.");
    } catch (error) {
      const name =
        error instanceof Error
          ? error.name
          : typeof error === 'object' && error !== null && 'name' in error
            ? String((error as { name?: unknown }).name)
            : '';
      // Annulation du partage natif : aucun message d'erreur nécessaire.
      if (name === 'AbortError') return;
      showNotice("Le partage n'a pas abouti. Réessaie depuis ton navigateur.");
    }
  };

  return (
    <dialog
      className="lkdv-club-dialog"
      data-testid="club-drawer"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div
        className="lkdv-club-panel"
        ref={panelRef}
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <span className="lkdv-club-grab" aria-hidden="true" />

        <header className="lkdv-club-head">
          <span className="lkdv-club-badge lkdv-club-badge-lg" aria-hidden="true">
            {club.emoji?.trim() || name.charAt(0).toUpperCase()}
          </span>
          <div className="lkdv-club-head-txt">
            <h3 className="lkdv-club-title" id={titleId}>
              {name}
            </h3>
            {role ? <span className="lkdv-club-role">{role}</span> : null}
          </div>
          <button
            type="button"
            className="lkdv-club-close"
            aria-label="Fermer le club"
            onClick={onClose}
            ref={closeRef}
          >
            <LKDVIcon name="fermer" aria-hidden="true" />
          </button>
        </header>

        {members === null ? (
          <p className="lkdv-club-members-line">
            <span>Membres non communiqués</span>
          </p>
        ) : (
          <p className="lkdv-club-members-line">
            <b>{members}</b>{' '}
            <span>{members === 1 ? 'membre actif' : 'membres actifs'}</span>
          </p>
        )}

        <section className="lkdv-club-sec" aria-labelledby={eventTitleId}>
          <h4 className="lkdv-club-sec-title" id={eventTitleId}>
            Prochains événements
          </h4>
          {eventTitle ? (
            <article className="lkdv-club-event">
              <div className="lkdv-club-event-head">
                <div className="lkdv-club-event-txt">
                  <h5 className="lkdv-club-event-title">{eventTitle}</h5>
                  <p className="lkdv-club-event-meta">
                    {[eventDate, eventLocation].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {attendance ? <span className="lkdv-club-attendance">{attendance}</span> : null}
              </div>

              {membershipStatus === 'active' ? (
                <div className="lkdv-rsvp" role="group" aria-label={`RSVP pour ${eventTitle}`}>
                  {RSVP_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="lkdv-rsvp-btn"
                      aria-pressed={rsvp === option.value}
                      onClick={() => void chooseRsvp(option.value, option.phrase)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="lkdv-club-empty">RSVP réservé aux membres actifs.</p>
              )}
            </article>
          ) : (
            <p className="lkdv-club-empty">Aucun événement à venir.</p>
          )}
        </section>

        <section className="lkdv-club-sec" aria-labelledby={topicsTitleId}>
          <h4 className="lkdv-club-sec-title" id={topicsTitleId}>
            Sujets récents
          </h4>
          {topics.length > 0 ? (
            <ul className="lkdv-club-topics">
              {topics.map((topic) => (
                <li key={topic.id} className="lkdv-club-topic">
                  <span className="lkdv-club-topic-title">{topic.title}</span>
                  {topic.is_pinned ? <span className="lkdv-club-pin">Épinglé</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="lkdv-club-empty">Aucun sujet récent.</p>
          )}
        </section>

        <section className="lkdv-club-sec" aria-labelledby={kitsTitleId}>
          <h4 className="lkdv-club-sec-title" id={kitsTitleId}>
            Kits recommandés
          </h4>
          {recommendedKits.length > 0 ? (
            <ul className="lkdv-club-kits">
              {recommendedKits.map((kit) => {
                const kitName = kit.name?.trim() || kit.title?.trim() || 'Kit';
                return (
                  <li key={kit.id} className="lkdv-club-kit">
                    <span className="lkdv-club-kit-ico" aria-hidden="true">
                      ▣
                    </span>
                    <span className="lkdv-club-kit-name">{kitName}</span>
                    {typeof kit.items === 'number' && kit.items > 0 ? (
                      <small>{pluralizeCommunity(kit.items, 'objet')}</small>
                    ) : null}
                    {typeof kit.weight === 'number' && kit.weight > 0 ? (
                      <small>{`${Math.round(kit.weight)} g`}</small>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="lkdv-club-empty">Aucun kit recommandé.</p>
          )}
        </section>

        <section className="lkdv-club-sec" aria-labelledby={safetyTitleId}>
          <h4 className="lkdv-club-sec-title" id={safetyTitleId}>
            Sécurité
          </h4>
          <ul className="lkdv-club-safety">
            <li>Les sorties restent sous la responsabilité de chaque participant.</li>
            <li>Vérifie le matériel, la météo et les consignes avant de partir.</li>
            <li>En cas de doute, contacte un responsable du club avant l&apos;événement.</li>
          </ul>
        </section>

        <div className="lkdv-club-actions">
          {membershipStatus === 'active' ? (
            <button
              type="button"
              className="lkdv-club-btn danger"
              onClick={() => void toggleMembership()}
            >
              Quitter
            </button>
          ) : membershipStatus === null ? (
            <button
              type="button"
              className="lkdv-club-btn primary"
              onClick={() => void toggleMembership()}
            >
              Rejoindre
            </button>
          ) : (
            <span className="lkdv-club-role">
              {membershipStatus === 'pending' ? 'En attente' : 'Banni'}
            </span>
          )}
          <button type="button" className="lkdv-club-btn" onClick={() => void shareClub(false)}>
            Partager
          </button>
          <button type="button" className="lkdv-club-btn" onClick={() => void shareClub(true)}>
            Inviter
          </button>
        </div>

        <p
          className="lkdv-club-notice"
          role="status"
          aria-live="polite"
          data-error={noticeIsError ? 'true' : 'false'}
          style={noticeIsError ? { color: 'var(--danger)' } : undefined}
        >
          {notice}
        </p>
      </div>
    </dialog>
  );
}

export default ClubDrawer;
