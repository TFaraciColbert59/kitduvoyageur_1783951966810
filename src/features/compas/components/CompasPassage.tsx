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
import type { CompasCtl } from './compasTypes';

/**
 * Heure de passage à chaque étape (onglet « Quand », maquette finale).
 *
 * Tout vient du moteur (`engine/passage.ts`). Une heure notée sur une étape de l'itinéraire
 * (`trip_steps.start_time`, l'heure de passage de CETTE étape) est gardée telle quelle. Les
 * étapes sans heure sont estimées : dernière heure notée avant elles + temps pour atteindre
 * l'étape, sinon départ du jour que la personne tape ici pour simuler (jamais enregistré, jamais
 * prérempli). Sans heure de départ, sans distance ou sans allure connue, la ligne dit
 * « non renseigné » et ce qui manque.
 */
export function PassageSection({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  // Le fuseau de CHAQUE jour (son point), jamais celui de la première étape : un itinéraire peut traverser
  // des fuseaux. Inconnu : la lumière du jour reste non classée.
  const dayZones = ctl.data.dayZones;
  const forecasts = ctl.data.weather?.tripDays;
  const inputId = useId();
  const [simulated, setSimulated] = useState('');

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
  // Toutes les étapes ont leur heure notée : aucun départ à simuler.
  const allNoted = all.every((r) => r.source === 'note');
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
              sunrise={d.light?.sunrise ?? null}
              sunset={d.light?.sunset ?? null}
            />
          ))
        )}
      </ol>
      <p className="cp-sub">
        Heures locales au lieu. Une heure notée sur une étape est gardée telle quelle ; les autres sont estimées : dernière heure notée ou départ du jour + temps pour atteindre l’étape (
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
  sunrise,
  sunset,
}: {
  day: number;
  row: StepPassage;
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
        {row.source === 'note' ? (
          <small>Heure notée dans l’itinéraire</small>
        ) : row.time && row.from ? (
          <small>
            {row.from.kind === 'depart'
              ? `Départ ${row.from.time} (simulation)`
              : `Depuis ${row.from.title ?? 'l’étape précédente'} (${row.from.time}, heure notée)`}
            {row.sinceStartMin != null
              ? ` · ${formatDuration(row.sinceStartMin)} ${row.from.kind === 'depart' ? 'depuis le départ' : 'depuis cette étape'}`
              : ''}
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
          row.source === 'note' ? (
            <b>{row.time}</b>
          ) : (
            <>
              vers <b>{row.time}</b>
            </>
          )
        ) : (
          'non renseigné'
        )}
      </span>
    </li>
  );
}
