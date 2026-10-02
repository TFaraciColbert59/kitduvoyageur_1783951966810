'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Icon from '@/components/ui/Icon';
import { COMPAS_STEPS } from '../engine/compasModel';
import { COMPAS_ACTIVITIES, parseIntentRules, type CompasActivity } from '../engine/intent';
import { activityLabel } from '../engine/format';
import { compasCreateTripAction } from '../server/compasActions';
import { ACTIVITY_META } from './CompasOuFlows';

/** Phrase tapée avant la création : le Compas la comprend juste après. */
export const START_SAY_KEY = 'lkdv.compas.say';

/**
 * Le Compas avant toute aventure (préparateur unique). Même écran que la
 * maquette, vide : rien n'est renseigné. Le premier geste (une activité, ou
 * une phrase dans « Dis-le ») crée l'aventure en brouillon et ouvre le
 * Compas complet. Sans compte : le geste mène à la connexion, puis revient.
 */
export function CompasStart({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = (activity: CompasActivity, say?: string) => {
    if (!signedIn) {
      router.push(`/connexion?next=${encodeURIComponent('/compas')}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await compasCreateTripAction({ activity });
      if (!res.success) {
        setError(res.error ?? 'L’aventure n’a pas pu être créée.');
        return;
      }
      if (say) {
        try {
          window.sessionStorage.setItem(START_SAY_KEY, say);
        } catch {
          /* la phrase sera à retaper : rien n'est perdu côté voyage */
        }
      }
      // Quitter `?nouvelle=1` : sinon la page réaffiche le Compas vide et
      // chaque toucher créerait un brouillon de plus.
      router.replace('/compas');
      router.refresh();
    });
  };

  const onSay = () => {
    const say = text.trim();
    if (say.length < 2) return;
    const today = new Date().toISOString().slice(0, 10);
    const act = parseIntentRules(say, today).find((a) => a.type === 'set_activity');
    create(act && act.type === 'set_activity' ? act.activity : 'mixed', say);
  };

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

        <section className="cp-card cp-sheet-glass" aria-label="Nouvelle aventure">
          <div>
            <h2 className="cp-t2">Nouvelle aventure</h2>
            <p className="cp-sub">
              Rien n’est encore renseigné. Choisis une activité ou dis-le : l’aventure se crée et
              tout le reste se prépare ici.
            </p>
          </div>

          <form
            className="cp-intent"
            aria-label="Dis-le : décris ton aventure"
            onSubmit={(e) => {
              e.preventDefault();
              onSay();
            }}
          >
            <Icon name="search" size={15} aria-hidden="true" />
            <label className="sr-only" htmlFor="cp-start-say">
              Dis-le
            </label>
            <input
              id="cp-start-say"
              value={text}
              maxLength={280}
              autoComplete="off"
              enterKeyHint="go"
              placeholder="Dis-le : « 3 jours de rando à 4 dans le Vercors »"
              onChange={(e) => setText(e.target.value)}
              disabled={pending}
            />
          </form>

          <div className="cp-tiles" role="group" aria-label="Activité">
            {COMPAS_ACTIVITIES.map((a) => (
              <button
                key={a}
                type="button"
                className="cp-tile"
                disabled={pending}
                title={ACTIVITY_META[a].hint}
                onClick={() => create(a)}
              >
                <Icon name={ACTIVITY_META[a].icon} size={22} />
                <span>{activityLabel(a)}</span>
              </button>
            ))}
          </div>

          <div className="cp-fsum cp-glass">
            {(
              [
                ['route', 'Parcours'],
                ['calendar', 'Quand'],
                ['heart', 'Préférences'],
                ['backpack', 'Sac'],
              ] as const
            ).map(([icon, label]) => (
              <button key={label} type="button" className="cp-fr" disabled>
                <span className="cp-fr__i">
                  <Icon name={icon} size={15} />
                </span>
                <span className="cp-fr__l">{label}</span>
                <span className="cp-fr__v">
                  <span>Non renseigné</span>
                </span>
                <Icon name="chevron-right" size={12} />
              </button>
            ))}
          </div>

          {error && (
            <p className="cp-note" role="alert">
              {error}
            </p>
          )}
          {pending && (
            <p className="cp-note" role="status">
              Création de l’aventure…
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
