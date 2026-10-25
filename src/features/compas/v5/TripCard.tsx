'use client';

/* eslint-disable @next/next/no-img-element -- photos Wikimedia Commons (vignettes déjà dimensionnées) : hors des domaines optimisés par next/image */

import { useMemo } from 'react';
import { activityName } from '../engine/compasI18n';
import { formatDayMonth, formatKm } from '../engine/format';
import { formatNumber } from '@/lib/i18n/format';
import { countText } from '../components/compasTypes';
import { browserToday } from '../engine/zone';
import { useV5 } from './context';
import { readiness, selectCountdown, selectDays, selectHeadline, selectPoints } from './model/trip';
import { Pic } from './ui/primitives';
import { V5Icon, stayIcon, transportIcon, type V5IconName } from './ui/icons';
import { dayRangeLabel, moneyShort, weightShort } from './model/format';
import { notedStay } from '../engine/stayProposal';

/**
 * La card du voyage (matière `.v5-cs`, la référence de transparence) : l'aventure en un coup d'œil, des bulles
 * qui ouvrent les tiroirs, puis les jours, les nuits et le trajet en images. Tout vient des données réelles.
 */
export function TripCard({ view, onDay }: { view: 'grid' | 'fil'; onDay: (index: number) => void }) {
  const api = useV5();
  const { data, extras, t, locale, openSpace, solo, people } = api;
  const { model } = data;
  const days = useMemo(() => selectDays(data, locale), [data, locale]);
  const head = selectHeadline(data);
  const points = useMemo(() => selectPoints(data, t, locale), [data, t, locale]);
  const ready = readiness(points);
  const today = useMemo(() => browserToday(), []);
  const countdown = selectCountdown(model.dates.start, today);
  const todoCount = (model.route.nightsToFind > 0 ? 1 : 0) + model.kit.toAcquire.length + (model.bookings.pending > 0 ? 1 : 0);
  const slow = [...model.crew.loads]
    .filter((m) => m.flatSpeedKmh != null)
    .sort((a, b) => (a.flatSpeedKmh as number) - (b.flatSpeedKmh as number))[0];
  const km = head.distanceKm != null ? formatKm(head.distanceKm) : null;
  const firstPhoto = extras.dayPhotos[days[0]?.day ?? 1] ?? null;
  const dates = dayRangeLabel(model.dates.start, model.dates.end, locale) ?? t('compas.v5.card.datesUnknown');
  const perPerson = head.budgetPerPerson != null ? moneyShort(head.budgetPerPerson, head.currency, locale) : null;
  const myWeight = model.kit.baseGrams > 0 ? weightShort(model.kit.baseGrams, locale) : null;
  const stateLabel =
    ready.state === 'ready'
      ? t('compas.v5.card.ready')
      : countText(t, locale, ready.count, ready.state === 'blocked' ? 'compas.v5.card.blockedOne' : 'compas.v5.card.almostOne', ready.state === 'blocked' ? 'compas.v5.card.blockedOther' : 'compas.v5.card.almostOther');

  const bubble = (icon: V5IconName, label: string, space: Parameters<typeof openSpace>[0], badge?: { n: number | string; ok?: boolean } | null, photo?: string | null, aria?: string) => (
    <button key={space + label} type="button" className="v5-bub" onClick={() => openSpace(space)} aria-label={aria ?? (badge && typeof badge.n === 'number' ? `${label} : ${badge.n}` : label)}>
      <span className="c">
        {photo ? <img src={photo} alt="" /> : <V5Icon name={icon} />}
        {badge && <span className={`n${badge.ok ? ' ok' : ''}`}>{badge.n}</span>}
      </span>
      <small>{label}</small>
    </button>
  );

  const nightRow = (d: (typeof days)[number]) => {
    const noted = notedStay(d.stay);
    const options = extras.nights[d.day] ?? [];
    const chosen = noted ? (options.find((o) => o.name === noted) ?? null) : null;
    return { noted, chosen };
  };

  return (
    <div className="v5-scroll">
      <div className="v5-prof">
        <div className="v5-ava">
          {firstPhoto ? <img src={firstPhoto.url} alt={t('compas.v5.card.photoAlt', { place: model.destination ?? model.title })} referrerPolicy="no-referrer" /> : (
            <span className="ph">
              <V5Icon name="hike" />
            </span>
          )}
          <span className="bd">
            <V5Icon name="route" size="s" />
          </span>
        </div>
        <div className="v5-stats">
          <button type="button" onClick={() => openSpace('meteo')}>
            <b className="v5-num">{formatNumber(head.days, {}, locale)}</b>
            <small>{head.days === 1 ? t('compas.v5.card.daysOne') : t('compas.v5.card.days')}</small>
          </button>
          <button type="button" onClick={() => (days.length ? onDay(0) : openSpace('voyage', { tab: 1 }))}>
            <b className="v5-num">{km ?? '–'}</b>
            <small>{t('compas.v5.card.km')}</small>
          </button>
          <button type="button" onClick={() => openSpace('budget')}>
            <b className="v5-num">{perPerson ?? '–'}</b>
            <small>{solo ? t('compas.v5.card.planned') : t('compas.v5.card.perPerson')}</small>
          </button>
        </div>
      </div>

      <div className="v5-meta">
        <b>{model.destination ?? model.title}</b> · {dates} ·{' '}
        {solo ? t('compas.v5.card.solo') : countText(t, locale, people, 'compas.v5.card.peopleOne', 'compas.v5.card.peopleOther')}
        <span className="m2">
          {[activityName(model.activity, locale), solo ? t('compas.v5.card.paceSolo') : slow ? t('compas.v5.card.paceGroup', { name: slow.name }) : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      <div className="v5-row">
        <button type="button" className={`v5-chip ${ready.state === 'ready' ? 'good' : 'warn'}`} onClick={() => openSpace('verifs')}>
          <span className="dot" />
          {stateLabel}
        </button>
        {countdown != null && countdown >= 0 && (
          <span className="v5-chip">{countdown === 0 ? t('compas.v5.card.today') : t('compas.v5.card.countdown', { count: countdown })}</span>
        )}
        {countdown != null && countdown < 0 && <span className="v5-chip">{t('compas.v5.card.underway')}</span>}
      </div>

      <div className="v5-bubs" role="group" aria-label={t('compas.v5.card.aria')}>
        {bubble(solo ? 'person' : 'people', solo ? t('compas.v5.card.bubSolo') : `${t('compas.v5.card.bubNous')} · ${people}`, 'nous')}
        {bubble('euro', perPerson ? moneyShort(model.budget.planned, head.currency, locale) : t('compas.v5.card.bubBudget'), 'budget', null, null, perPerson ? `${t('compas.v5.card.bubBudget')} : ${moneyShort(model.budget.planned, head.currency, locale)}` : undefined)}
        {bubble('bag', myWeight ? t('compas.v5.card.bubBag', { weight: myWeight }) : t('compas.v5.card.bubBagNoWeight'), 'sac')}
        {bubble('list', t('compas.v5.card.bubTodo'), 'prevoir', todoCount ? { n: todoCount } : { n: '✓', ok: true })}
        {bubble('shield', t('compas.v5.card.bubChecks'), 'verifs', ready.count ? { n: ready.count } : null)}
        {bubble('cloudsun', t('compas.v5.card.bubWeather'), 'meteo')}
        {bubble('route', t('compas.v5.card.bubTrip'), 'voyage')}
        {bubble('dots', t('compas.v5.card.bubMore'), 'menu')}
      </div>

      {days.length === 0 ? (
        <div className="v5-grp" style={{ padding: 16 }}>
          <b>{t('compas.v5.card.emptyTitle')}</b>
          <p className="v5-note" style={{ padding: 0, marginTop: 4 }}>
            {t('compas.v5.card.emptyBody')}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="v5-grid">
          {days.map((d) => (
            <button key={`d${d.day}`} type="button" className={`v5-tile${extras.dayPhotos[d.day] ? '' : ' ill'}`} onClick={() => onDay(d.index)} aria-label={d.from ? t('compas.v5.card.tileDayAria', { n: d.day, from: d.from, to: d.to ?? d.title }) : `${t('compas.v5.card.tileDay', { n: d.day })} · ${d.to ?? d.title}`}>
              {extras.dayPhotos[d.day] ? <Pic photo={extras.dayPhotos[d.day]} icon="peak" alt="" /> : <V5Icon name="peak" size="big" />}
              <span className="tg">
                <V5Icon name="hike" />
              </span>
              <span className="lb">
                <b>{t('compas.v5.card.tileDay', { n: d.day })}</b>
                <small>{d.distanceKm != null ? `${formatKm(d.distanceKm)}` : t('compas.v5.day.unknown')}</small>
              </span>
            </button>
          ))}
          {days
            .filter((d) => !d.isLast)
            .map((d) => {
              const { noted, chosen } = nightRow(d);
              const booked = model.bookings.confirmed > 0 && Boolean(noted);
              return (
                <button
                  key={`n${d.day}`}
                  type="button"
                  className={`v5-tile${chosen?.photo ? '' : ' ill'}`}
                  onClick={() => onDay(d.index)}
                  aria-label={noted ? t('compas.v5.card.tileNightAria', { n: d.day, name: noted }) : t('compas.v5.card.tileNightToFind', { n: d.day })}
                >
                  {chosen?.photo ? <img src={chosen.photo.url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <V5Icon name={stayIcon(chosen?.kind ?? 'hebergement')} size="big" />}
                  {booked && <span className="ok">{t('compas.v5.card.tileNightBooked')}</span>}
                  <span className="tg">
                    <V5Icon name="sleep" />
                  </span>
                  <span className="lb">
                    <b>{noted ?? t('compas.v5.card.tileNightToFind', { n: d.day })}</b>
                    <small>{noted ? t('compas.v5.card.tileNightNoted') : ' '}</small>
                  </span>
                </button>
              );
            })}
          {extras.transport.length > 0 && (
            <button type="button" className="v5-tile ill" onClick={() => openSpace('prevoir', { tab: 0 })} aria-label={t('compas.v5.card.tileTransport')}>
              <V5Icon name={transportIcon(extras.transport[0].id)} size="big" />
              <span className="lb">
                <b>{t('compas.v5.card.tileTransport')}</b>
                <small>{extras.transport[0].label}</small>
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="v5-fil">
          {days.map((d) => {
            const { noted } = nightRow(d);
            return (
              <button key={d.day} type="button" className="fr v5-grp" onClick={() => onDay(d.index)}>
                <span className="ph v5-ava" style={{ width: 54, height: 54, padding: 0, borderRadius: 14 }}>
                  <Pic photo={extras.dayPhotos[d.day] ?? null} icon="peak" />
                </span>
                <span>
                  <b>
                    {t('compas.v5.card.tileDay', { n: d.day })} · {d.from ? `${d.from} → ` : ''}
                    {d.to ?? d.title}
                  </b>
                  <small>
                    {[d.distanceKm != null ? formatKm(d.distanceKm) : null, d.gainM != null ? `D+ ${Math.round(d.gainM)} m` : null, d.date ? formatDayMonth(d.date, locale) : null].filter(Boolean).join(' · ')}
                  </small>
                  <small>{d.isLast ? t('compas.v5.card.timelineLast') : noted ? t('compas.v5.card.timelineNight', { name: noted }) : t('compas.v5.card.timelineNightEmpty')}</small>
                </span>
                <V5Icon name="right" size="s" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Sélecteur grille / fil, posé sur la card (hors du défilement). */
export function ViewSwitch({ view, onView }: { view: 'grid' | 'fil'; onView: (v: 'grid' | 'fil') => void }) {
  const { t } = useV5();
  return (
    <div className="v5-igsel v5-lg" role="group" aria-label={t('compas.v5.card.viewGroup')}>
      <span className="th" style={{ transform: `translateX(${view === 'grid' ? 0 : 100}%)` }} />
      <button type="button" aria-pressed={view === 'grid'} aria-label={t('compas.v5.card.viewGrid')} onClick={() => onView('grid')}>
        <V5Icon name="grid" size="s" />
      </button>
      <button type="button" aria-pressed={view === 'fil'} aria-label={t('compas.v5.card.viewTimeline')} onClick={() => onView('fil')}>
        <V5Icon name="timeline" size="s" />
      </button>
    </div>
  );
}
