'use client';

import Link from 'next/link';
import { TripInvitationsInbox } from './TripInvitations';
import type { TripInvitationView } from '../server/invitationActions';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import Icon from '@/components/ui/Icon';
import { COMPAS_STEPS } from '../engine/compasModel';
import { understandRequest, type RequestLine, type RequestPrecisions } from '../engine/request';
import { activityLabel } from '../engine/format';
import { compasCreateTripAction } from '../server/compasActions';
import { ACTIVITY_FIRST, ACTIVITY_META, ACTIVITY_ORDER } from './CompasOuFlows';

const LINE_ICON: Record<RequestLine['key'], string> = {
  activite: 'compass',
  lieu: 'map-pin',
  quand: 'calendar',
  groupe: 'users',
  nuits: 'moon',
  envies: 'heart',
  budget: 'euro',
};

/**
 * Le Compas avant toute aventure : « Où » est LA demande. Une phrase libre
 * (le principal), un résumé « voici ce que j'ai compris » à la frappe, des
 * précisions facultatives, puis « Préparer mon aventure » : le voyage est créé
 * à ce moment-là et tout le reste se construit comme réponse, avec un
 * chargement visible. Sans compte : le bouton mène à la connexion.
 */
export function CompasStart({
  signedIn,
  invitations = [],
}: {
  signedIn: boolean;
  /** Invitations reçues : on peut rejoindre un voyage au lieu d'en créer un. */
  invitations?: TripInvitationView[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [precise, setPrecise] = useState<RequestPrecisions>({});
  const [allActivities, setAllActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // « Voici ce que j'ai compris » : règles du Compas, à la frappe, sans réseau.
  const understood = useMemo(() => understandRequest(text, today, precise), [text, today, precise]);
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
        setError(res.error ?? 'L’aventure n’a pas pu être créée.');
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
          <nav className="cp-steps cp-glass" aria-label="Étapes du Compas">
            <span className="cp-steps__lens" aria-hidden="true" style={{ transform: 'none' }} />
            {COMPAS_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="cp-step"
                aria-current={i === 0 ? 'step' : undefined}
                disabled={i > 0}
                title={i > 0 ? 'Disponible dès le premier choix' : undefined}
              >
                <Icon name={s.icon} size={20} />
                <span className="cp-step__l">{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {invitations.length > 0 && (
          <section className="cp-card cp-sheet-glass" aria-label="Invitations reçues">
            <TripInvitationsInbox invitations={invitations} title="On t’invite" />
          </section>
        )}

        <section className="cp-card cp-sheet-glass" aria-label="Ta demande">
          <div>
            <h1 className="cp-t2">Où veux-tu aller ?</h1>
            <p className="cp-sub">
              Décris ton aventure avec tes mots. Le Compas prépare tout le reste : parcours, dates,
              nuits, trajet, kit, budget.
            </p>
          </div>

          <form
            className="cp-intent cp-ask"
            aria-label="Ta demande"
            onSubmit={(e) => {
              e.preventDefault();
              prepare();
            }}
          >
            <label className="sr-only" htmlFor="cp-start-say">
              Ta demande
            </label>
            <textarea
              id="cp-start-say"
              className="cp-ask__in"
              value={text}
              maxLength={240}
              rows={3}
              autoComplete="off"
              enterKeyHint="go"
              placeholder="« 5 jours de trek dans le Vercors à 3, en refuge, début juillet »"
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
                <p className="cp-understood__h">Voici ce que j’ai compris</p>
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
              <summary>Préciser (facultatif)</summary>
              <div className="cp-tiles" role="group" aria-label="Activité">
                {(allActivities ? ACTIVITY_ORDER : ACTIVITY_FIRST).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="cp-tile"
                    disabled={pending}
                    aria-pressed={precise.activity === a}
                    title={ACTIVITY_META[a].hint}
                    onClick={() => setPrecise((p) => ({ ...p, activity: p.activity === a ? null : a }))}
                  >
                    <Icon name={ACTIVITY_META[a].icon} size={22} />
                    <span>{activityLabel(a)}</span>
                  </button>
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
                    <span>Plus</span>
                  </button>
                )}
              </div>
              {(
                [
                  ['days', 'Durée', 'jour', 'jours', 60],
                  ['party', 'Personnes', 'personne', 'personnes', 20],
                ] as const
              ).map(([key, label, one, many, max]) => {
                const v = precise[key] ?? null;
                return (
                  <div key={key} className="cp-precise__row">
                    <span>{label}</span>
                    <span className="cp-stepper" role="group" aria-label={label}>
                      <button
                        type="button"
                        className="cp-ibtn cp-ibtn--sm cp-glass"
                        aria-label={`${label} : moins`}
                        disabled={pending || v == null}
                        onClick={() => setNum(key, v != null && v > 1 ? v - 1 : null)}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <output aria-live="polite">{v == null ? 'auto' : `${v} ${v > 1 ? many : one}`}</output>
                      <button
                        type="button"
                        className="cp-ibtn cp-ibtn--sm cp-glass"
                        aria-label={`${label} : plus`}
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
              {pending ? 'Création de l’aventure…' : 'Préparer mon aventure'}
            </button>
          </form>

          {error && (
            <p className="cp-note" role="alert">
              {error}
            </p>
          )}
          {!signedIn && (
            <p className="cp-note">
              <Link href={`/connexion?next=${encodeURIComponent('/compas')}`}>Connecte-toi</Link>{' '}
              pour enregistrer ton aventure.
            </p>
          )}
        </section>
      </div>

      <section className="cp-map" aria-label="Carte du parcours">
        <p className="cp-map__empty">La carte se remplit dès que le parcours est choisi.</p>
      </section>
    </div>
  );
}
