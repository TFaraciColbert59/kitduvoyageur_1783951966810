'use client';

import React from 'react';
import type { Club, ClubNextEvent } from './cards/ClubCard';
import {
  finiteCountOrNull,
  formatCommunityDate,
  pluralizeCommunity,
} from './cards/communityFormat';
import './ClubDrawer.css';

export type ClubRsvp = 'yes' | 'maybe' | 'no';

export interface ClubDrawerProps {
  club: Club;
  onClose: () => void;
}

const RSVP_OPTIONS: ReadonlyArray<{ value: ClubRsvp; label: string; phrase: string }> = [
  { value: 'yes', label: 'Je participe', phrase: 'je participe' },
  { value: 'maybe', label: 'Peut-être', phrase: 'peut-être' },
  { value: 'no', label: 'Non', phrase: 'non' },
];

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
 * Les actions (rejoindre/quitter, RSVP) sont optimistes et locales tant que la
 * chaîne d'écriture n'est pas branchée : aucun appel réseau n'est simulé ici.
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

  const [joined, setJoined] = React.useState(Boolean(club.joined));
  const [rsvp, setRsvp] = React.useState<ClubRsvp | null>(null);
  const [notice, setNotice] = React.useState('');

  React.useEffect(() => {
    setJoined(Boolean(club.joined));
    setRsvp(null);
    setNotice('');
  }, [club.id, club.joined]);

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
  const event = club.nextEvent ?? null;
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
  const recommendedKits = club.recommendedKits ?? club.recommended_kits ?? [];

  const toggleMembership = () => {
    const next = !joined;
    setJoined(next);
    setNotice(next ? `Tu as rejoint ${name}.` : `Tu as quitté ${name}.`);
  };

  const chooseRsvp = (choice: ClubRsvp, phrase: string) => {
    setRsvp(choice);
    setNotice(`Ta réponse : ${phrase}.`);
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
        setNotice(invite ? 'Invitation partagée.' : 'Club partagé.');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice(invite ? "Lien d'invitation copié." : 'Lien du club copié.');
        return;
      }
      setNotice("Le partage n'est pas disponible sur cet appareil.");
    } catch (error) {
      const name =
        error instanceof Error
          ? error.name
          : typeof error === 'object' && error !== null && 'name' in error
            ? String((error as { name?: unknown }).name)
            : '';
      // Annulation du partage natif : aucun message d'erreur nécessaire.
      if (name === 'AbortError') return;
      setNotice("Le partage n'a pas abouti. Réessaie depuis ton navigateur.");
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
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
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

              <div className="lkdv-rsvp" role="group" aria-label={`RSVP pour ${eventTitle}`}>
                {RSVP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="lkdv-rsvp-btn"
                    aria-pressed={rsvp === option.value}
                    onClick={() => chooseRsvp(option.value, option.phrase)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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
          <button
            type="button"
            className={joined ? 'lkdv-club-btn danger' : 'lkdv-club-btn primary'}
            onClick={toggleMembership}
          >
            {joined ? 'Quitter' : 'Rejoindre'}
          </button>
          <button type="button" className="lkdv-club-btn" onClick={() => void shareClub(false)}>
            Partager
          </button>
          <button type="button" className="lkdv-club-btn" onClick={() => void shareClub(true)}>
            Inviter
          </button>
        </div>

        <p className="lkdv-club-notice" role="status" aria-live="polite">
          {notice}
        </p>
      </div>
    </dialog>
  );
}

export default ClubDrawer;
