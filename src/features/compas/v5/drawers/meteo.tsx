'use client';

import { useMemo } from 'react';
import { useV5 } from '../context';
import { dayRangeLabel } from '../model/format';
import { selectDays } from '../model/trip';
import { Cap, Grp, Li } from '../ui/primitives';
import { V5Icon, type V5IconName } from '../ui/icons';
import type { V5DrawerDef } from './types';

/** Icône d'un code météo WMO. */
function iconOf(code: number): V5IconName {
  if (code === 0 || code === 1) return 'sun';
  if (code >= 71 && code <= 77) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  return 'cloudsun';
}

/**
 * Météo du voyage : la prévision réelle (MET Norway) jour par jour, le repère du mois (NASA POWER) quand la
 * prévision ne couvre pas encore les dates, et les alertes officielles lues. Rien n'est comblé : sans prévision, on le dit.
 */
function MeteoBody() {
  const { data, t, locale, openSpace } = useV5();
  const days = useMemo(() => selectDays(data, locale), [data, locale]);
  const { model } = data;
  const withForecast = days.filter((d) => d.weather);
  const alerts = data.danger.signals.filter((s) => s.official);
  const calendar = data.weather?.calendar ?? [];
  const trend = calendar.filter((c) => c.kind === 'tendance' && c.tMin != null && c.tMax != null);

  if (!model.dates.start) {
    return (
      <Grp>
        <Li icon="calendar" title={t('compas.v5.meteo.noDates')} onClick={() => openSpace('voyage', { tab: 2 })} right={<V5Icon name="right" size="s" />} />
      </Grp>
    );
  }

  return (
    <>
      {withForecast.length === 0 && <p className="v5-note">{t('compas.v5.meteo.none')}</p>}
      {withForecast.length > 0 && (
        <Grp>
          {withForecast.map((d) => {
            const w = d.weather!;
            return (
              <Li
                key={d.day}
                lead={
                  <span className="fi">
                    <V5Icon name={iconOf(w.code)} size="s" />
                  </span>
                }
                title={w.label}
                detail={[d.date ? dayRangeLabel(d.date, d.date, locale) : null, w.precipPct != null ? t('compas.v5.meteo.precip', { pct: Math.round(w.precipPct) }) : null].filter(Boolean).join(' · ')}
                value={t('compas.v5.meteo.range', { min: Math.round(w.tMinC), max: Math.round(w.tMaxC) })}
                onClick={() => openSpace('day', { day: d.index })}
              />
            );
          })}
        </Grp>
      )}

      {withForecast.length < days.length && trend.length > 0 && (
        <p className="v5-note">
          {t('compas.v5.meteo.normals', {
            min: Math.round(Math.min(...trend.map((c) => c.tMin as number))),
            max: Math.round(Math.max(...trend.map((c) => c.tMax as number))),
          })}
        </p>
      )}

      {alerts.length > 0 && (
        <>
          <Cap>{t('compas.v5.meteo.alerts')}</Cap>
          <Grp>
            {alerts.map((s) => (
              <Li key={s.id} icon="flag" title={s.official?.title ?? s.label} detail={`${s.source} · ${s.asOf}`} />
            ))}
          </Grp>
        </>
      )}

      <p className="v5-src">{t('compas.v5.meteo.source', { source: data.weather?.source ?? 'MET Norway' })}</p>
    </>
  );
}

export const meteoDrawer: V5DrawerDef = {
  space: 'meteo',
  tabs: () => [],
  title: (api) => api.t('compas.v5.meteo.title'),
  subtitle: (api) => dayRangeLabel(api.data.model.dates.start, api.data.model.dates.end, api.locale),
  Body: MeteoBody,
};
