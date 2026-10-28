'use client';

import { useMemo, useState } from 'react';
import { formatKm } from '../../engine/format';
import { notedStay } from '../../engine/stayProposal';
import { compasSetStayAction } from '../../server/compasActions';
import { formatNumber } from '@/lib/i18n/format';
import { useV5 } from '../context';
import { dayRangeLabel, moneyShort } from '../model/format';
import { selectDays } from '../model/trip';
import { Cap, Credit, Grp, Li, MBtn, PBtn, Pic } from '../ui/primitives';
import { V5Icon, stayIcon } from '../ui/icons';
import type { V5Day, V5StayOption } from '../types';
import type { V5DrawerDef } from './types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/** « 1 h 45 » / « 45 min » depuis des minutes. */
function duration(min: number, locale: string): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return `${formatNumber(h, {}, locale as never)} h ${String(m).padStart(2, '0')}`;
}

function metres(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

function useCurrentDay(): { days: V5Day[]; current: V5Day | null } {
  const { data, locale, day } = useV5();
  const days = useMemo(() => selectDays(data, locale), [data, locale]);
  return { days, current: days[day] ?? days[0] ?? null };
}

function DayBody() {
  const api = useV5();
  const { extras, t, locale, ctl, canEdit, solo, openSpace, closeSpace, data } = api;
  const { days, current } = useCurrentDay();
  const [name, setName] = useState('');
  if (!current) return <p className="v5-note">{t('compas.v5.card.emptyBody')}</p>;

  const idx = current.index;
  const noted = notedStay(current.stay);
  const options = extras.nights[current.day] ?? [];
  const photo = extras.dayPhotos[current.day] ?? null;
  const { tripId, slug } = data.model;
  const lodgingDown = extras.unavailable.includes('lodging');

  const write = (next: string, success: string, previous: string) =>
    ctl.run(
      success,
      () => compasSetStayAction({ tripId, tripSlug: slug, day: current.day, name: next }),
      () => compasSetStayAction({ tripId, tripSlug: slug, day: current.day, name: previous })
    );

  const choose = (o: V5StayOption) => write(o.name, t('compas.v5.day.stayNoted', { n: current.day, name: o.name }), noted ?? '');
  const clear = () => write('', t('compas.v5.day.stayCleared', { n: current.day }), noted ?? '');

  const dateLabel = current.date ? dayRangeLabel(current.date, current.date, locale) : null;
  const weather = current.weather;
  const weatherLine = weather
    ? weather.precipPct != null
      ? t('compas.v5.day.weatherRain', { label: weather.label, min: Math.round(weather.tMinC), max: Math.round(weather.tMaxC), pct: Math.round(weather.precipPct) })
      : t('compas.v5.day.weather', { label: weather.label, min: Math.round(weather.tMinC), max: Math.round(weather.tMaxC) })
    : t('compas.v5.day.weatherNone');

  return (
    <>
      <div className="v5-hero">
        <Pic photo={photo} icon='sommet' alt={t('compas.v5.card.photoAlt', { place: current.to ?? current.title })} />
        <div className="nav">
          <button type="button" className="v5-rbtn v5-lg" aria-label={t('compas.v5.day.prev')} disabled={idx <= 0} onClick={() => openSpace('day', { day: idx - 1 })}>
            <V5Icon name='retour' size="s" />
          </button>
          <button type="button" className="v5-rbtn v5-lg" aria-label={t('compas.v5.day.next')} disabled={idx >= days.length - 1} onClick={() => openSpace('day', { day: idx + 1 })}>
            <V5Icon name='suivant' size="s" />
          </button>
        </div>
      </div>
      <Credit photo={photo} />

      <p className="v5-meta">
        {current.from && (
          <b>
            {current.from} <LKDVIcon name="suivant" size="1em" className="lkdv-icon-inline" />{current.to ?? current.title}
          </b>
        )}
        {current.from && ' · '}
        {dateLabel ? t('compas.v5.day.kicker', { n: current.day, date: dateLabel }) : t('compas.v5.day.kickerNoDate', { n: current.day })}
      </p>

      <div className="v5-stats3">
        <div>
          <b className="v5-num">{current.distanceKm != null ? formatKm(current.distanceKm) : '–'}</b>
          <small>{current.distanceKm != null ? t('compas.v5.day.distance') : t('compas.v5.day.unknown')}</small>
        </div>
        <div>
          <b className="v5-num">{current.gainM != null ? `+${Math.round(current.gainM)} m` : '–'}</b>
          <small>{current.gainM != null ? t('compas.v5.day.gain') : t('compas.v5.day.unknown')}</small>
        </div>
        <div>
          <b className="v5-num">{current.walkMin != null ? duration(current.walkMin, locale) : '–'}</b>
          <small>{current.walkMin != null ? (solo ? t('compas.v5.day.walkSolo') : t('compas.v5.day.walkGroup')) : t('compas.v5.day.unknown')}</small>
        </div>
      </div>

      <Grp>
        <Li icon='meteo' title={weatherLine} onClick={() => openSpace('meteo')} right={<V5Icon name='suivant' size="s" />} />
      </Grp>

      {current.isLast ? (
        <p className="v5-note">{t('compas.v5.day.lastDay')}</p>
      ) : (
        <>
          <Cap right={noted ? t('compas.v5.day.noted') : t('compas.v5.day.tonightHint')}>{t('compas.v5.day.tonight')}</Cap>
          <Grp>
            {noted && (
              <Li
                icon='lune'
                title={noted}
                detail={t('compas.v5.day.noted')}
                right={
                  canEdit ? (
                    <MBtn onClick={() => void clear()} aria-label={t('compas.v5.day.noteClear')}>
                      <V5Icon name='supprimer' size="s" />
                    </MBtn>
                  ) : undefined
                }
              />
            )}
            {!noted && <Li icon='lune' title={t('compas.v5.day.noStay')} />}
            {options
              .filter((o) => o.name !== noted)
              .map((o) => (
                <Li
                  key={o.id}
                  icon={stayIcon(o.kind)}
                  photo={o.photo?.url ?? null}
                  title={o.name}
                  detail={[
                    t('compas.v5.day.distanceFrom', { distance: metres(o.distanceM) }),
                    o.price ? `${t('compas.v5.day.perPerson', { price: moneyShort(o.price.perPerson, o.price.currency, locale) })} · ${t(o.price.basis === 'bareme' ? 'compas.v5.day.priceBareme' : 'compas.v5.day.perPerson', { price: '' }).replace(/\s*\/.*$/, '')}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    canEdit ? (
                      <MBtn primary onClick={() => void choose(o)} aria-label={`${t('compas.v5.day.chooseOther')} : ${o.name}`}>
                        <V5Icon name='valider' size="s" />
                      </MBtn>
                    ) : undefined
                  }
                />
              ))}
            {options.length === 0 && (
              <p className="v5-note" style={{ padding: '10px 14px' }}>
                {lodgingDown ? t('compas.v5.day.lodgingUnavailable') : extras.fetchedAt === '' ? t('compas.v5.day.lodgingLoading') : t('compas.v5.day.lodgingNone')}
              </p>
            )}
          </Grp>
          {options.some((o) => o.photo) && options.map((o) => <Credit key={`c${o.id}`} photo={o.photo} />)}
          <p className="v5-src">{t('compas.v5.day.sourceLodging')}</p>

          {canEdit && (
            <>
              <Cap>{t('compas.v5.day.noteTitle')}</Cap>
              <form
                className="v5-ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = name.trim();
                  if (!value) return;
                  void write(value, t('compas.v5.day.stayNoted', { n: current.day, name: value }), noted ?? '').then((ok) => ok && setName(''));
                }}
              >
                <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label={t('compas.v5.day.noteLabel')} placeholder={t('compas.v5.day.noteLabel')} />
                <button type="submit" aria-label={t('compas.v5.day.noteSave')} disabled={!name.trim()}>
                  <V5Icon name='valider' />
                </button>
              </form>
              <p className="v5-src">{t('compas.v5.day.noteHint')}</p>
            </>
          )}
        </>
      )}

      <PBtn onClick={closeSpace}>{t('compas.v5.day.back')}</PBtn>
    </>
  );
}

export const dayDrawer: V5DrawerDef = {
  space: 'day',
  tabs: () => [],
  title: (api) => {
    const days = selectDays(api.data, api.locale);
    const d = days[api.day] ?? days[0];
    return d ? (d.to ?? d.title) : api.t('compas.v5.day.back');
  },
  subtitle: (api) => {
    const days = selectDays(api.data, api.locale);
    const d = days[api.day] ?? days[0];
    return d ? api.t('compas.v5.day.kickerNoDate', { n: d.day }) : null;
  },
  Body: DayBody,
};
