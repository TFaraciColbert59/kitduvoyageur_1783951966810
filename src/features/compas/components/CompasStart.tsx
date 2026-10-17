'use client';

import Link from 'next/link';
import { TripInvitationsInbox } from './TripInvitations';
import type { TripInvitationView } from '../server/invitationActions';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import Icon from '@/components/ui/Icon';
import { COMPAS_STEPS } from '../engine/compasModel';
import { understandRequest, type RequestLine, type RequestPrecisions } from '../engine/request';
import { MAX_TRIP_DAYS } from '../engine/intent';
import { STEP_LABEL_KEY, activityName } from '../engine/compasI18n';
import { browserToday } from '../engine/zone';
import { compasCreateTripAction } from '../server/compasActions';
import { ACTIVITY_FIRST, ACTIVITY_META, ACTIVITY_ORDER } from './CompasOuFlows';
import TravellerCard from '@/components/identity/TravellerCard';
import { AiNotice } from './AiNotice';
import { useTranslation } from '@/lib/i18n/context';
import { plural } from '@/lib/i18n/translate';
import { formatNumber } from '@/lib/i18n/format';

const LINE_ICON: Record<RequestLine['key'], string> = {
  activite: 'compass',
  lieu: 'map-pin',
  quand: 'calendar',
  groupe: 'users',
  nuits: 'moon',
  envies: 'heart',
  budget: 'euro',
  deplacements: 'train',
};

/**
 * Le Compas avant toute aventure : « Où » est LA demande. Une phrase libre
 * (le principal), un résumé « voici ce que j'ai compris » à la frappe, des
 * précisions facultatives, puis « Préparer mon aventure » : le voyage est créé
 * à ce moment-là et tout le reste se construit comme réponse, avec un
 * chargement visible. Sans compte : le bouton mène à la connexion.
 * Textes : dictionnaire `compas.start.*`, dans la locale du site (pluriels par Intl).
 */
export function CompasStart({
  signedIn,
  invitations = [],
  askTraveller = false,
  aiOn = false,
}: {
  signedIn: boolean;
  /** Invitations reçues : on peut rejoindre un voyage au lieu d'en créer un. */
  invitations?: TripInvitationView[];
  /** Profil voyageur jamais demandé (compte réel) : la question est posée une fois, « Passer » visible. */
  askTraveller?: boolean;
  /** Interrupteur de l'IA du site : allumé, la mention est dite avant le premier envoi (PLAN-100 5.3). */
  aiOn?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [text, setText] = useState('');
  const [precise, setPrecise] = useState<RequestPrecisions>({});
  const [allActivities, setAllActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // La date du navigateur (pas celle d'UTC) : « demain » dit à 23 h reste demain.
  const today = useMemo(() => browserToday(), []);
  // « Voici ce que j'ai compris » : règles du Compas, à la frappe, sans réseau.
  const understood = useMemo(() => understandRequest(text, today, precise, locale), [text, today, precise, locale]);
  const ready = text.trim().length >= 2;

  // La demande part entière : le voyage est créé à ce moment-là, avec elle ;
  // la préparation (visible) commence dès l'ouverture du Compas.
  const prepare = () => {
    if (!ready || pending) return;
    if (!signedIn) {
      router.push(`/connexion?next=${encodeURIComponent('/compas')}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await compasCreateTripAction({ activity: understood.activity, say: understood.say.slice(0, 280) });
      if (!res.success) {
        setError(res.error ?? t('compas.start.createError'));
        return;
      }
      // Quitter `?nouvelle=1` : sinon la page réaffiche le Compas vide.
      router.replace('/compas');
      router.refresh();
    });
  };

  const setNum = (key: 'days' | 'party', value: number | null) =>
    setPrecise((p) => ({ ...p, [key]: value }));

  return (
    <div className="compas compas--start">
      <div className="cp-bg" aria-hidden="true" />
      <div className="cp-top">
        <div className="cp-headrow">
          <nav className="cp-steps cp-glass" aria-label={t('compas.start.stepsNav')}>
            <span className="cp-steps__lens" aria-hidden="true" style={{ transform: 'none' }} />
            {COMPAS_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="cp-step"
                aria-current={i === 0 ? 'step' : undefined}
                disabled={i > 0}
                aria-describedby={i > 0 ? 'cp-start-locked' : undefined}
                title={i > 0 ? t('compas.start.lockedStep') : undefined}
              >
                <Icon name={s.icon} size={20} aria-hidden="true" />
                <span className="cp-step__l">{t(STEP_LABEL_KEY[s.id])}</span>
              </button>
            ))}
            {/* L'info-bulle ne suffit pas (clavier, toucher, lecteur d'écran) : la raison est dite aussi. */}
            <span id="cp-start-locked" hidden>
              {t('compas.start.lockedStep')}
            </span>
          </nav>
        </div>

        {invitations.length > 0 && (
          <section className="cp-card cp-sheet-glass" aria-label={t('compas.start.invitationsLabel')}>
            <TripInvitationsInbox invitations={invitations} title={t('compas.start.invitationsTitle')} />
          </section>
        )}

        <section className="cp-card cp-sheet-glass" aria-label={t('compas.start.requestLabel')}>
          <div>
            <h1 className="cp-t2">{t('compas.start.title')}</h1>
            <p className="cp-sub">{t('compas.start.subtitle')}</p>
          </div>

          <form
            className="cp-ask"
            aria-label={t('compas.start.requestLabel')}
            onSubmit={(e) => {
              e.preventDefault();
              prepare();
            }}
          >
            <label className="sr-only" htmlFor="cp-start-say">
              {t('compas.start.requestLabel')}
            </label>
            <textarea
              id="cp-start-say"
              className="cp-ask__in"
              value={text}
              maxLength={240}
              rows={3}
              autoComplete="off"
              enterKeyHint="go"
              placeholder={t('compas.start.placeholder')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Entrée prépare ; Maj + Entrée passe à la ligne.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  prepare();
                }
              }}
              disabled={pending}
            />

            {ready && (
              <div aria-live="polite">
                <p className="cp-understood__h">{t('compas.start.understoodTitle')}</p>
                <div className="cp-fsum cp-glass">
                  {understood.lines.map((l) => (
                    <div key={l.key} className="cp-fr" data-state={l.state}>
                      <span className="cp-fr__i">
                        <Icon name={LINE_ICON[l.key]} size={15} />
                      </span>
                      <span className="cp-fr__l">{l.label}</span>
                      <span className="cp-fr__v">
                        <span>{l.value}</span>
                      </span>
                      <span aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <details className="cp-precise">
              <summary>{t('compas.start.precise')}</summary>
              <div className="cp-tiles" role="group" aria-label={t('compas.start.activityGroup')}>
                {(allActivities ? ACTIVITY_ORDER : ACTIVITY_FIRST).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="cp-tile"
                    disabled={pending}
                    aria-pressed={precise.activity === a}
                    aria-describedby={`cp-start-act-${a}`}
                    title={t(ACTIVITY_META[a].hintKey)}
                    onClick={() => setPrecise((p) => ({ ...p, activity: p.activity === a ? null : a }))}
                  >
                    <Icon name={ACTIVITY_META[a].icon} size={22} />
                    <span>{activityName(a, locale)}</span>
                  </button>
                ))}
                {(allActivities ? ACTIVITY_ORDER : ACTIVITY_FIRST).map((a) => (
                  <span key={a} id={`cp-start-act-${a}`} hidden>
                    {t(ACTIVITY_META[a].hintKey)}
                  </span>
                ))}
                {!allActivities && (
                  <button
                    type="button"
                    className="cp-tile"
                    disabled={pending}
                    aria-expanded={false}
                    onClick={() => setAllActivities(true)}
                  >
                    <Icon name="more-horizontal" size={22} />
                    <span>{t('compas.start.moreActivities')}</span>
                  </button>
                )}
              </div>
              {(
                [
                  // Au-delà, la lecture refuse la durée (« Il me manque la durée »).
                  ['days', 'compas.start.duration', 'compas.start.daysOne', 'compas.start.daysOther', MAX_TRIP_DAYS],
                  ['party', 'compas.start.people', 'compas.start.peopleOne', 'compas.start.peopleOther', 20],
                ] as const
              ).map(([key, labelKey, one, other, max]) => {
                const v = precise[key] ?? null;
                const label = t(labelKey);
                const count = (n: number) => {
                  const vars = { count: formatNumber(n, {}, locale) };
                  return plural(locale, n, { one: t(one, vars), other: t(other, vars) });
                };
                return (
                  <div key={key} className="cp-precise__row">
                    <span>{label}</span>
                    <span className="cp-stepper" role="group" aria-label={label}>
                      <button
                        type="button"
                        className="cp-ibtn cp-ibtn--sm cp-glass"
                        aria-label={t('compas.start.stepperLess', { label })}
                        disabled={pending || v == null}
                        onClick={() => setNum(key, v != null && v > 1 ? v - 1 : null)}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <output aria-live="polite">{v == null ? t('compas.start.auto') : count(v)}</output>
                      <button
                        type="button"
                        className="cp-ibtn cp-ibtn--sm cp-glass"
                        aria-label={t('compas.start.stepperMore', { label })}
                        disabled={pending || (v ?? 0) >= max}
                        onClick={() => setNum(key, (v ?? 0) + 1)}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </details>

            <button
              type="submit"
              className="cp-btn cp-btn--pg cp-btn--block"
              disabled={!ready || pending}
              aria-busy={pending}
            >
              <Icon name="sparkles" size={16} />
              {pending ? t('compas.start.creating') : t('compas.start.submit')}
            </button>
          </form>

          {aiOn && <AiNotice variant="run" withPrivacyLink />}

          {error && (
            <p className="cp-note" role="alert">
              {error}
            </p>
          )}
          {!signedIn && (
            <p className="cp-note">
              {t('compas.start.signInPrompt')
                .split(/(\{link\})/)
                .map((part, i) =>
                  part === '{link}' ? (
                    <Link key={i} href={`/connexion?next=${encodeURIComponent('/compas')}`}>
                      {t('compas.start.signInLink')}
                    </Link>
                  ) : (
                    part
                  )
                )}
            </p>
          )}
        </section>

        {askTraveller && <TravellerCard mode="collect" className="cp-card cp-sheet-glass" />}
      </div>

      <section className="cp-map" aria-label={t('compas.start.mapLabel')}>
        <p className="cp-map__empty">{t('compas.start.mapEmpty')}</p>
      </section>
    </div>
  );
}
