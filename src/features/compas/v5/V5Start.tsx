'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import TravellerCard from '@/components/identity/TravellerCard';
import { useTranslation } from '@/lib/i18n/context';
import { AiNotice } from '../components/AiNotice';
import { TripInvitationsInbox } from '../components/TripInvitations';
import { understandRequest } from '../engine/request';
import { browserToday } from '../engine/zone';
import type { TripInvitationView } from '../server/invitationActions';
import { compasCreateTripAction } from '../server/compasActions';
import { V5Icon, type V5IconName } from './ui/icons';

const IDEAS: Array<{ key: 'ideaVercors' | 'ideaSolo' | 'ideaGr20'; icon: V5IconName }> = [
  { key: 'ideaVercors', icon: 'people' },
  { key: 'ideaSolo', icon: 'person' },
  { key: 'ideaGr20', icon: 'peak' },
];

/**
 * Le Compas avant toute aventure : une seule question, « Où veux-tu aller ? ». Une phrase suffit ; le voyage est créé
 * à ce moment-là et tout le reste se prépare tout seul, avec un chargement visible (l'îlot). Rien d'autre à remplir.
 */
export function V5Start({
  signedIn,
  invitations = [],
  askTraveller = false,
  aiOn = false,
}: {
  signedIn: boolean;
  invitations?: TripInvitationView[];
  askTraveller?: boolean;
  aiOn?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = useMemo(() => browserToday(), []);
  const ready = text.trim().length >= 2;

  const go = () => {
    if (!ready || pending) return;
    if (!signedIn) {
      router.push(`/connexion?next=${encodeURIComponent('/compas')}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const understood = understandRequest(text, today, {}, locale);
      const res = await compasCreateTripAction({ activity: understood.activity, say: understood.say.slice(0, 280) });
      if (!res.success) {
        setError(res.error ?? t('compas.v5.start.createError'));
        return;
      }
      router.replace('/compas');
      router.refresh();
    });
  };

  return (
    <div className="v5" data-start="">
      <div className="v5-bg" aria-hidden="true" />
      <div className="v5-start">
        {invitations.length > 0 && (
          <section className="v5-start-card v5-cs" aria-label={t('compas.start.invitationsLabel')}>
            <TripInvitationsInbox invitations={invitations} title={t('compas.start.invitationsTitle')} />
          </section>
        )}
        <section className="v5-start-card v5-cs" aria-label={t('compas.v5.start.inputLabel')}>
          <h1>{t('compas.v5.start.title')}</h1>
          <form
            className="v5-ask"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <input
              value={text}
              maxLength={240}
              autoComplete="off"
              enterKeyHint="go"
              disabled={pending}
              placeholder={t('compas.v5.start.placeholder')}
              aria-label={t('compas.v5.start.inputLabel')}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" disabled={!ready || pending} aria-busy={pending} aria-label={t('compas.v5.start.go')}>
              <V5Icon name="right" />
            </button>
          </form>
          <div className="v5-ideas" role="group" aria-label={t('compas.v5.start.title')}>
            {IDEAS.map((idea) => (
              <button key={idea.key} type="button" className="v5-idea" disabled={pending} onClick={() => setText(t(`compas.v5.start.${idea.key}`))}>
                <span className="fi">
                  <V5Icon name={idea.icon} size="s" />
                </span>
                {t(`compas.v5.start.${idea.key}`)}
              </button>
            ))}
          </div>
          {pending && (
            <p className="v5-fine" role="status">
              {t('compas.v5.start.creating')}
            </p>
          )}
          {error && (
            <p className="v5-fine" role="alert">
              {error}
            </p>
          )}
          {!signedIn && (
            <p className="v5-fine">
              {t('compas.v5.start.signIn')} <Link href={`/connexion?next=${encodeURIComponent('/compas')}`}>{t('compas.v5.start.signInLink')}</Link>
            </p>
          )}
          {aiOn && <AiNotice variant="run" withPrivacyLink />}
          <p className="v5-fine">{t('compas.v5.start.fine')}</p>
        </section>
        {askTraveller && <TravellerCard mode="collect" className="v5-start-card v5-cs" />}
      </div>
    </div>
  );
}
