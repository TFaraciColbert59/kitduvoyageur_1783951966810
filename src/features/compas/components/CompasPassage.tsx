'use client';

import { useId, useMemo, useState } from 'react';
import { formatDuration } from '../engine/format';
import {
  MISSING_TEXT,
  dayLightClock,
  passageModel,
  stepPassages,
  type StepPassage,
} from '../engine/passage';
import { compasSetDepartureTimeAction } from '../server/compasActions';
import type { CompasCtl } from './compasTypes';
import { useTranslation } from '@/lib/i18n/context';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Heure de passage à chaque étape (onglet « Quand », maquette finale).
 *
 * Tout vient du moteur (`engine/passage.ts`). Une heure notée sur une étape de l'itinéraire
 * (`trip_steps.start_time`, l'heure de passage de CETTE étape) est gardée telle quelle. Les
 * étapes sans heure sont estimées : dernière heure notée avant elles + temps pour atteindre
 * l'étape, sinon départ du jour. Ce départ est celui que la personne a enregistré
 * (`metadata.compas.departure_time`, « Enregistrer », effaçable, « Annuler » le rétablit), ou celui
 * qu'elle tape ici pour simuler sans l'enregistrer ; il n'y en a jamais par défaut. Sans heure de
 * départ, sans distance ou sans allure connue, la ligne dit « non renseigné » et ce qui manque.
 */
export function PassageSection({ ctl }: { ctl: CompasCtl }) {
  const { t } = useTranslation();
  const m = ctl.data.model;
  // Le fuseau de CHAQUE jour (son point), jamais celui de la première étape : un itinéraire peut traverser
  // des fuseaux. Inconnu : la lumière du jour reste non classée.
  const dayZones = ctl.data.dayZones;
  const forecasts = ctl.data.weather?.tripDays;
  const inputId = useId();
  const saved = ctl.data.departureTime ?? null;
  const canSave = Boolean(ctl.data.canEdit);
  // null : on suit l'heure enregistrée ; une chaîne : ce que la personne tape (simulation tant qu'elle
  // ne l'enregistre pas). « » efface la simulation, pas l'heure enregistrée.
  const [draft, setDraft] = useState<string | null>(null);
  const typed = draft ?? saved ?? '';
  const simulated = /^\d{2}:\d{2}/.test(typed) ? typed.slice(0, 5) : '';
  const isSaved = simulated !== '' && simulated === saved;

  const store = (time: string | null) => {
    const before = saved;
    void ctl
      .run(
        time ? t('compas.passage.savedToast', { time }) : t('compas.passage.clearedToast'),
        () => compasSetDepartureTimeAction({ tripId: m.tripId, tripSlug: m.slug, time }),
        () => compasSetDepartureTimeAction({ tripId: m.tripId, tripSlug: m.slug, time: before })
      )
      .then((ok) => {
        if (ok) setDraft(null);
      });
  };

  const days = useMemo(
    () =>
      m.route.dayPlans.map((plan) => {
        const departure = simulated || null;
        const light = dayLightClock(
          forecasts?.find((d) => d.day === plan.day)?.forecast,
          { lat: plan.lat, lon: plan.lon, date: plan.date },
          dayZones?.[plan.day] ?? null
        );
        const rows = stepPassages({
          activity: m.activity,
          departure,
          steps: plan.steps ?? [],
          flatSpeedKmh: m.crew.pace.slowest?.speedKmh ?? null,
          pace: m.preferences.pace,
          sunrise: light?.sunrise ?? null,
          sunset: light?.sunset ?? null,
        });
        return {
          day: plan.day,
          light,
          rows,
        };
      }),
    [m.route.dayPlans, m.activity, m.crew.pace.slowest?.speedKmh, m.preferences.pace, forecasts, dayZones, simulated]
  );

  const all = days.flatMap((d) => d.rows);
  if (all.length === 0) return null;
  // Toutes les étapes ont leur heure notée : aucun départ à simuler ni à enregistrer.
  const allNoted = all.every((r) => r.source === 'note');
  const model = passageModel(m.activity);
  const showDeparture = (!allNoted && model) || saved != null;

  return (
    <section className="cp-pass" aria-labelledby={`${inputId}-h`}>
      <h4 id={`${inputId}-h`} className="cp-pass__h">
        {t('compas.passage.title')}
      </h4>
      {showDeparture && (
        <div className="cp-pass__dep">
          <label className="cp-field cp-pass__sim" htmlFor={inputId}>
            {canSave ? t('compas.passage.departureLabel') : t('compas.passage.simulate')}
            <input
              id={inputId}
              type="time"
              step={300}
              value={simulated}
              aria-describedby={`${inputId}-n`}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <p id={`${inputId}-n`} className="cp-note" aria-live="polite">
            {isSaved
              ? t('compas.passage.savedNote')
              : simulated
                ? t('compas.passage.unsavedNote')
                : saved
                  ? t('compas.passage.savedHidden', { time: saved })
                  : t('compas.passage.noDeparture')}
          </p>
          {canSave && (
            <div className="cp-actions">
              {simulated && !isSaved && (
                <button
                  type="button"
                  className="cp-btn cp-btn--pg cp-btn--tap"
                  disabled={ctl.busy}
                  onClick={() => store(simulated)}
                >
                  {t('compas.passage.save')}
                </button>
              )}
              {saved && (
                <button
                  type="button"
                  className="cp-btn cp-btn--soft cp-btn--tap"
                  disabled={ctl.busy}
                  onClick={() => store(null)}
                >
                  {t('compas.passage.clear', { time: saved })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <ol className="cp-pass__list">
        {days.flatMap((d) =>
          d.rows.map((r) => (
            <PassageRow
              key={r.id}
              day={d.day}
              row={r}
              savedDeparture={isSaved}
              sunrise={d.light?.sunrise ?? null}
              sunset={d.light?.sunset ?? null}
            />
          ))
        )}
      </ol>
      <p className="cp-sub">
        {t('compas.passage.explain', {
          model:
            model === 'pied'
              ? t('compas.passage.modelFoot')
              : model
                ? t('compas.passage.modelKmh', { kmh: model.kmh })
                : t('compas.passage.modelNone'),
        })}
      </p>
    </section>
  );
}

function PassageRow({
  day,
  row,
  savedDeparture,
  sunrise,
  sunset,
}: {
  day: number;
  row: StepPassage;
  /** Le départ du calcul est l'heure enregistrée, pas une simulation. */
  savedDeparture: boolean;
  sunrise: string | null;
  sunset: string | null;
}) {
  const { t, locale } = useTranslation();
  const dark =
    row.light === 'apres-coucher'
      ? row.nextDay
        ? t('compas.passage.afterSunsetNextDay', { time: String(sunset) })
        : t('compas.passage.afterSunset', { time: String(sunset) })
      : row.light === 'avant-lever'
        ? t('compas.passage.beforeSunrise', { time: String(sunrise) })
        : null;
  const since =
    row.from?.kind === 'depart' ? 'compas.passage.sinceDeparture' : 'compas.passage.sinceStep';
  const [aboutBefore, aboutAfter] = t('compas.passage.about').split('{time}');
  return (
    <li className="cp-pass__row" data-missing={row.missing ?? undefined}>
      <span className="cp-pass__day">{t('compas.passage.dayShort', { day })}</span>
      <span className="cp-pass__t">
        <b>{row.title}</b>
        {row.source === 'note' ? (
          <small>{t('compas.passage.noted')}</small>
        ) : row.time && row.from ? (
          <small>
            {row.from.kind === 'depart'
              ? t(savedDeparture ? 'compas.passage.fromDepartureSaved' : 'compas.passage.fromDeparture', {
                  time: row.from.time,
                })
              : t('compas.passage.fromStep', {
                  title: row.from.title ?? t('compas.passage.previousStep'),
                  time: row.from.time,
                })}
            {row.sinceStartMin != null
              ? ` · ${t(since, { duration: formatDuration(row.sinceStartMin, locale) })}`
              : ''}
          </small>
        ) : (
          <small>
            {t('compas.passage.missing', { what: row.missing ? MISSING_TEXT[row.missing] : '' })}
          </small>
        )}
        {dark && (
          <small className="cp-pass__dark">
            <LKDVIcon name="alerte" size={13} aria-hidden="true" /> {dark}
          </small>
        )}
      </span>
      <span className="cp-pass__v">
        {row.time ? (
          row.source === 'note' ? (
            <b>{row.time}</b>
          ) : (
            <>
              {aboutBefore}
              <b>{row.time}</b>
              {aboutAfter}
            </>
          )
        ) : (
          t('compas.passage.notFilled')
        )}
      </span>
    </li>
  );
}
