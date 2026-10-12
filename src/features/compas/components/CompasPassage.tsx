'use client';

import { useId, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { formatDuration } from '../engine/format';
import {
  MISSING_TEXT,
  dayLightClock,
  passageModel,
  stepPassages,
  type StepPassage,
} from '../engine/passage';
import { DEFAULT_TRAVELLER_ZONE } from '../engine/zone';
import type { CompasCtl } from './compasTypes';

/**
 * Heure de passage à chaque étape (onglet « Quand », maquette finale).
 *
 * Tout vient du moteur (`engine/passage.ts`) : départ du jour + temps pour atteindre
 * l'étape. Le départ est celui noté sur la première étape du jour ; à défaut, celui que la
 * personne tape ici pour simuler (jamais enregistré, jamais prérempli). Sans départ, sans
 * distance ou sans allure connue, la ligne dit « non renseigné » et ce qui manque.
 */
export function PassageSection({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const zone = ctl.data.zone ?? DEFAULT_TRAVELLER_ZONE;
  const forecasts = ctl.data.weather?.tripDays;
  const inputId = useId();
  const [simulated, setSimulated] = useState('');

  const days = useMemo(
    () =>
      m.route.dayPlans.map((plan) => {
        const noted = plan.startTime ?? null;
        const departure = noted ?? (simulated || null);
        const light = dayLightClock(
          forecasts?.find((d) => d.day === plan.day)?.forecast,
          { lat: plan.lat, lon: plan.lon, date: plan.date },
          zone
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
          departure,
          origin: noted ? ('noté' as const) : departure ? ('simulation' as const) : null,
          light,
          rows,
        };
      }),
    [m.route.dayPlans, m.activity, m.crew.pace.slowest?.speedKmh, m.preferences.pace, forecasts, zone, simulated]
  );

  const all = days.flatMap((d) => d.rows);
  if (all.length === 0) return null;
  const allNoted = m.route.dayPlans.every((p) => p.startTime != null);
  const model = passageModel(m.activity);

  return (
    <section className="cp-pass" aria-labelledby={`${inputId}-h`}>
      <h4 id={`${inputId}-h`} className="cp-pass__h">
        Heure de passage à chaque étape
      </h4>
      {!allNoted && model && (
        <label className="cp-field cp-pass__sim" htmlFor={inputId}>
          Si tu pars à (simulation, non enregistrée)
          <input
            id={inputId}
            type="time"
            step={300}
            value={simulated}
            onChange={(e) => setSimulated(e.target.value)}
          />
        </label>
      )}
      <ol className="cp-pass__list">
        {days.flatMap((d) =>
          d.rows.map((r) => (
            <PassageRow
              key={r.id}
              day={d.day}
              row={r}
              departure={d.departure}
              origin={d.origin}
              sunrise={d.light?.sunrise ?? null}
              sunset={d.light?.sunset ?? null}
            />
          ))
        )}
      </ol>
      <p className="cp-sub">
        Heures estimées, locales au lieu : départ du jour + temps pour atteindre l’étape (
        {model === 'pied'
          ? 'DIN 33466 au pas du plus lent, pauses +15 %'
          : model
            ? `${model.kmh} km/h, allure type de l’activité, pauses comprises`
            : 'aucune allure connue pour cette activité'}
        ), arrondies à 5 min. Sans heure de départ ni distance, rien n’est supposé.
      </p>
    </section>
  );
}

function PassageRow({
  day,
  row,
  departure,
  origin,
  sunrise,
  sunset,
}: {
  day: number;
  row: StepPassage;
  departure: string | null;
  origin: 'noté' | 'simulation' | null;
  sunrise: string | null;
  sunset: string | null;
}) {
  const dark =
    row.light === 'apres-coucher'
      ? `${row.nextDay ? 'le lendemain, ' : ''}après le coucher du soleil (${sunset})`
      : row.light === 'avant-lever'
        ? `avant le lever du soleil (${sunrise})`
        : null;
  return (
    <li className="cp-pass__row" data-missing={row.missing ?? undefined}>
      <span className="cp-pass__day">J{day}</span>
      <span className="cp-pass__t">
        <b>{row.title}</b>
        {row.time ? (
          <small>
            Départ {departure} ({origin})
            {row.sinceStartMin != null ? ` · ${formatDuration(row.sinceStartMin)} depuis le départ` : ''}
          </small>
        ) : (
          <small>Manque : {row.missing ? MISSING_TEXT[row.missing] : ''}</small>
        )}
        {dark && (
          <small className="cp-pass__dark">
            <Icon name="alert-triangle" size={13} aria-hidden="true" /> {dark}
          </small>
        )}
      </span>
      <span className="cp-pass__v">
        {row.time ? (
          <>
            vers <b>{row.time}</b>
          </>
        ) : (
          'non renseigné'
        )}
      </span>
    </li>
  );
}
