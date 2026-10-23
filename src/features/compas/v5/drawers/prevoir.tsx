'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { setPurchaseStateAction } from '@/app/voyages/kit-actions';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import { addToCart, getCart, removeFromCart, updateQuantity } from '@/lib/cart';
import { countText } from '../../components/compasTypes';
import { dayMonthIn, moneyIn } from '../../components/sheetsI18n';
import { compasPickShopProductAction, compasSetStayAction } from '../../server/compasActions';
import { useV5 } from '../context';
import { compasV5SetStayAction, compasV5SetTransportAction } from '../server/choiceActions';
import {
  bookingTotals,
  buyEntries,
  buyTotals,
  formatDistance,
  liveBookings,
  nearestRouteShop,
  nightCards,
  reservationSteps,
  safeUrl,
  sandboxProviders,
  transportViews,
  type BuyEntry,
  type NightCard,
  type StayView,
  type TransportView,
} from '../model/prevoir';
import { itemIcon } from '../model/sac';
import { stayIcon, transportIcon, V5Icon } from '../ui/icons';
import { Cap, Chip, Credit, Grp, MBtn, PBtn, Pic } from '../ui/primitives';
import type { V5DrawerDef } from './types';
import './sac-prevoir.css';

const PROVIDER_NAME = { routestack: 'RouteStack', viator: 'Viator' } as const;
const VERTICAL_KEY = { hotel: 'compas.sheets.booking.hotel', flight: 'compas.sheets.booking.flight', car: 'compas.sheets.booking.car', activity: 'compas.sheets.booking.activity' } as const;
const STATUS_KEY = {
  confirmed: 'compas.sheets.booking.confirmed',
  pending: 'compas.sheets.booking.pending',
  held: 'compas.sheets.booking.held',
  draft: 'compas.sheets.booking.draft',
} as const;

const linkRel = (partner: string | null) => (partner ? 'sponsored nofollow noopener' : 'noopener noreferrer');

/* ---------- Corps du tiroir ---------- */

function PrevoirBody() {
  const api = useV5();
  const tab = Math.min(api.tab, 1);
  return (
    <div className="v5-sp">
      {!api.canEdit && <p className="v5-note">{api.t('compas.v5.prevoir.readOnly')}</p>}
      {tab === 0 ? <BookTab /> : <BuyTab />}
    </div>
  );
}

/* ---------- À réserver ---------- */

function BookTab() {
  const api = useV5();
  const { data, extras, ctl, t, locale, canEdit, people } = api;
  const { model } = data;
  const [transportChoice, setTransportChoice] = useState<TransportView['id'] | null>(null);
  const [booked, setBooked] = useState<ReadonlySet<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);

  const cards = useMemo(() => nightCards(model, extras), [model, extras]);
  const transports = useMemo(() => transportViews(extras.transport, people), [extras.transport, people]);
  const chosenTransport = transports.find((x) => x.id === transportChoice) ?? null;
  const totals = useMemo(() => bookingTotals(cards, chosenTransport, people), [cards, chosenTransport, people]);
  const steps = useMemo(() => reservationSteps(cards, chosenTransport), [cards, chosenTransport]);
  const sandbox = sandboxProviders(data.providers);
  const saved = liveBookings(data.bookings);
  const pending = extras.fetchedAt === '';
  const lodgingDown = extras.unavailable.includes('lodging');
  const photosDown = extras.unavailable.includes('photos');
  const hasPartner = cards.some((c) => c.options.some((o) => o.partner)) || transports.some((x) => x.partner);
  const mark = (key: string, on: boolean) =>
    setBooked((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const stepBooked = (key: string, label: string, noteStay?: { day: number; name: string }) => {
    if (noteStay) {
      void ctl
        .run(
          t('compas.v5.prevoir.bookedMsg', { label }),
          () => compasSetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: noteStay.day, name: noteStay.name }),
          async () => {
            mark(key, false);
            return { success: true };
          }
        )
        .then((ok) => ok && mark(key, true));
    } else {
      mark(key, true);
      api.announce(t('compas.v5.prevoir.bookedMsg', { label }));
    }
  };

  return (
    <>
      {pending && cards.length > 0 && <p className="banner info" role="status">{t('compas.v5.prevoir.extrasPending')}</p>}
      {!pending && lodgingDown && <p className="banner" role="status">{t('compas.v5.prevoir.lodgingUnavailable')}</p>}
      {!pending && photosDown && <p className="banner info" role="status">{t('compas.v5.prevoir.photosUnavailable')}</p>}
      {sandbox.map((p) => (
        <p key={p} className="banner" role="status">
          {t('compas.v5.prevoir.sandbox', { provider: PROVIDER_NAME[p] })}
        </p>
      ))}
      {hasPartner && <AffiliateDisclosure compact />}

      {cards.length === 0 && <p className="v5-note">{t('compas.v5.prevoir.noNights')}</p>}
      {cards.map((card) => (
        <NightCardView
          key={card.day}
          card={card}
          booked={booked.has(`night:${card.day}`)}
          onBooked={(view) => stepBooked(`night:${card.day}`, view.name, { day: card.day, name: view.name })}
        />
      ))}

      <TransportCardView
        views={transports}
        chosen={chosenTransport}
        booked={chosenTransport ? booked.has(`transport:${chosenTransport.id}`) : false}
        unavailable={extras.unavailable.includes('transport')}
        onChoose={setTransportChoice}
        onBooked={(view) => stepBooked(`transport:${view.id}`, view.label)}
      />

      <Grp className="v5-tot" role="group" aria-label={t('compas.v5.prevoir.totalCap')}>
        <Cap>{t('compas.v5.prevoir.totalCap')}</Cap>
        {totals.chosenCount === 0 ? (
          <p className="v5-note">{t('compas.v5.prevoir.totalNone')}</p>
        ) : (
          <>
            {totals.nightsTotalEur != null && (
              <div className="l">
                <span>{t('compas.v5.prevoir.totalNights')}</span>
                <b className="v5-num">{moneyIn(locale, totals.nightsTotalEur)}</b>
              </div>
            )}
            {totals.transportTotalEur != null && (
              <div className="l">
                <span>{t('compas.v5.prevoir.totalTransport')}</span>
                <b className="v5-num">{moneyIn(locale, totals.transportTotalEur)}</b>
              </div>
            )}
            {totals.total != null && totals.currency && (
              <>
                <div className="l big">
                  <span>{t('compas.v5.prevoir.totalAll')}</span>
                  <b className="v5-num">{moneyIn(locale, totals.total, totals.currency)}</b>
                </div>
                {people > 1 && totals.perPerson != null && (
                  <div className="l">
                    <span>{t('compas.v5.prevoir.totalPerPerson')}</span>
                    <b className="v5-num">{moneyIn(locale, totals.perPerson, totals.currency)}</b>
                  </div>
                )}
              </>
            )}
            {totals.total == null && Object.keys(totals.byCurrency).length > 1 && (
              <p className="v5-note">
                {t('compas.v5.prevoir.totalMixed', {
                  list: Object.entries(totals.byCurrency)
                    .map(([cur, amount]) => moneyIn(locale, amount, cur))
                    .join(' · '),
                })}
              </p>
            )}
            {totals.unpriced > 0 && (
              <p className="v5-note">{countText(t, locale, totals.unpriced, 'compas.v5.prevoir.totalUnpricedOne', 'compas.v5.prevoir.totalUnpricedOther')}</p>
            )}
            {totals.hasHints && <p className="v5-note">{t('compas.v5.prevoir.totalHints')}</p>}
          </>
        )}
      </Grp>

      <PBtn
        tone="dark"
        aria-expanded={panelOpen}
        aria-controls="v5-book-panel"
        disabled={steps.length === 0}
        onClick={() => setPanelOpen((v) => !v)}
      >
        {totals.total != null && totals.currency
          ? t('compas.v5.prevoir.bookAllAmount', { amount: moneyIn(locale, totals.total, totals.currency) })
          : t('compas.v5.prevoir.bookAll')}
      </PBtn>
      {steps.length === 0 && <p className="v5-src">{t('compas.v5.prevoir.bookAllNone')}</p>}
      {panelOpen && steps.length > 0 && (
        <section id="v5-book-panel" aria-label={t('compas.v5.prevoir.bookPanel')} style={{ display: 'contents' }}>
          <Cap>{t('compas.v5.prevoir.bookPanel')}</Cap>
          {steps.some((s) => s.partner) && <AffiliateDisclosure compact />}
          <Grp>
            <ol className="steps">
              {steps.map((step, index) => {
                const done = booked.has(step.key);
                const next = !done && steps.findIndex((s) => !booked.has(s.key)) === index;
                const url = safeUrl(step.url);
                const where = step.kind === 'night' ? t('compas.v5.prevoir.nightWhen', { day: step.day ?? 0 }) : t('compas.v5.prevoir.transportCap');
                return (
                  <li key={step.key} className={next ? 'next' : undefined}>
                    <span className="t">
                      <b>{step.label}</b>
                      <small>
                        {t('compas.v5.prevoir.bookStep', { n: index + 1, total: steps.length })} · {where}
                        {step.partner ? ` · ${step.partner}` : ''}
                      </small>
                      {!url && <small>{t('compas.v5.prevoir.bookNoLink')}</small>}
                    </span>
                    <span className="end">
                      {url && (
                        <a
                          className="v5-link"
                          href={url}
                          target="_blank"
                          rel={linkRel(step.partner)}
                          aria-label={t('compas.v5.prevoir.linkLabel', { action: t('compas.v5.prevoir.bookOpen'), name: step.label })}
                        >
                          {t('compas.v5.prevoir.bookOpen')}
                          <V5Icon name="external" size="xs" />
                        </a>
                      )}
                      {done ? (
                        <span className="v5-okc">{t('compas.v5.prevoir.stateBooked')}</span>
                      ) : (
                        canEdit && (
                          <MBtn
                            disabled={ctl.busy}
                            aria-label={t('compas.v5.prevoir.iBookedLabel', { label: step.label })}
                            onClick={() => {
                              if (step.kind === 'night') {
                                const card = cards.find((c) => c.day === step.day);
                                if (card?.chosen) stepBooked(step.key, step.label, { day: card.day, name: card.chosen.name });
                              } else stepBooked(step.key, step.label);
                            }}
                          >
                            {t('compas.v5.prevoir.iBooked')}
                          </MBtn>
                        )
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Grp>
          <p className="v5-src">{t('compas.v5.prevoir.bookNote')}</p>
          {steps.every((s) => booked.has(s.key)) && <p className="v5-line good" role="status">{t('compas.v5.prevoir.bookAllDone')}</p>}
        </section>
      )}

      {saved.length > 0 && (
        <>
          <Cap right={saved.length}>{t('compas.v5.prevoir.savedCap')}</Cap>
          <Grp>
            <ul>
              {saved.map((b) => {
                const vertical = b.vertical in VERTICAL_KEY ? t(VERTICAL_KEY[b.vertical as keyof typeof VERTICAL_KEY]) : b.vertical;
                const status = b.status in STATUS_KEY ? t(STATUS_KEY[b.status as keyof typeof STATUS_KEY]) : b.status;
                const provider = b.provider === 'affiliate' ? t('compas.sheets.booking.affiliate') : b.provider === 'routestack' ? 'RouteStack' : b.provider === 'viator' ? 'Viator' : b.provider;
                return (
                  <li key={b.id} className="v5-li">
                    <span className="fi" aria-hidden="true">
                      <V5Icon name={b.vertical === 'hotel' ? 'bed' : b.vertical === 'flight' ? 'plane' : b.vertical === 'car' ? 'car' : 'cart'} size="s" />
                    </span>
                    <span className="t">
                      <b>{vertical}</b>
                      <small>
                        {provider} · {status}
                      </small>
                    </span>
                    <span className="v v5-num">{b.amountEur != null ? moneyIn(locale, b.amountEur) : ''}</span>
                  </li>
                );
              })}
            </ul>
          </Grp>
        </>
      )}
    </>
  );
}

function priceText(api: ReturnType<typeof useV5>, view: StayView): string {
  const { t, locale, people } = api;
  if (!view.price) return t('compas.v5.prevoir.priceNone');
  const one = moneyIn(locale, view.price.perPerson, view.price.currency);
  return people > 1 ? t('compas.v5.prevoir.priceEach', { price: one, people }) : one;
}

function NightCardView({ card, booked, onBooked }: { card: NightCard; booked: boolean; onBooked: (view: StayView) => void }) {
  const api = useV5();
  const { data, ctl, t, locale, canEdit } = api;
  const { model } = data;
  const { shown, chosen } = card;
  const [manual, setManual] = useState('');
  const when = card.date ? t('compas.v5.prevoir.nightWhenDate', { day: card.day, date: dayMonthIn(locale, card.date) }) : t('compas.v5.prevoir.nightWhen', { day: card.day });
  const listed = card.options.filter((o) => !o.manual);

  const write = (option: StayView['option'] | null) => compasV5SetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: card.day, option });
  const choose = (view: StayView) =>
    void ctl.run(t('compas.v5.prevoir.nightChosenMsg', { day: card.day, name: view.name }), () => write(view.option), () => write(chosen?.option ?? null));
  const remove = () =>
    void ctl.run(t('compas.v5.prevoir.nightRemovedMsg', { day: card.day }), () => write(null), () => write(chosen?.option ?? null));
  const note = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = manual.trim();
    if (!name) return;
    const previous = card.noted ?? '';
    void ctl
      .run(
        t('compas.v5.prevoir.nightChosenMsg', { day: card.day, name }),
        () => compasSetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: card.day, name }),
        () => compasSetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: card.day, name: previous })
      )
      .then((ok) => ok && setManual(''));
  };

  const detail = shown
    ? [shown.distanceM != null ? t('compas.v5.prevoir.fromArrival', { distance: formatDistance(locale, shown.distanceM) }) : null, shown.manual ? t('compas.v5.prevoir.manualTag') : t(`compas.v5.prevoir.kind.${shown.kind}` as const)]
        .filter(Boolean)
        .join(' · ')
    : '';
  const url = shown ? safeUrl(shown.url) : null;
  const stateLabel = booked ? t('compas.v5.prevoir.stateBooked') : chosen ? t('compas.v5.prevoir.stateChosen') : t('compas.v5.prevoir.stateProposed');

  return (
    <div className="v5-grp v5-bk" data-day={card.day}>
      {shown && shown.photo ? (
        <div className="bh">
          <Pic photo={shown.photo} icon={stayIcon(shown.kind)} alt={shown.name} />
          <span className="when">{when}</span>
          <div className="nm">
            <b>{shown.name}</b>
            <small>{detail}</small>
          </div>
          <span className="pr">{priceText(api, shown)}</span>
        </div>
      ) : (
        <div className="ill">
          <V5Icon name={shown ? stayIcon(shown.kind) : 'bed'} />
          <div className="t">
            <small>{when}</small>
            <b>{shown ? shown.name : t('compas.v5.prevoir.noOptions', { day: card.day })}</b>
            {shown && <small>{detail}</small>}
          </div>
          {shown && <span className="pr">{priceText(api, shown)}</span>}
        </div>
      )}
      {shown?.photo && <Credit photo={shown.photo} />}
      <div className="bb">
        {card.options.length > 1 && (
          <ul className="v5-mini" aria-label={t('compas.v5.prevoir.nightAlternatives', { day: card.day })}>
            {card.options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="v5-mo"
                  aria-pressed={chosen?.id === o.id}
                  aria-label={t('compas.v5.prevoir.chooseNight', { name: o.name, day: card.day })}
                  disabled={!canEdit || ctl.busy}
                  onClick={() => (chosen?.id === o.id ? undefined : choose(o))}
                >
                  <span className="im">
                    <Pic photo={o.photo} icon={stayIcon(o.kind)} alt={o.name} />
                  </span>
                  <b>{o.name}</b>
                  <small>{o.price ? moneyIn(locale, o.price.perPerson, o.price.currency) : t('compas.v5.prevoir.priceNone')}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {shown && (
          <div className="v5-stl">
            <span>
              {shown.source ? t('compas.v5.prevoir.sourceLine', { source: shown.source }) : ''}
              {shown.price ? ` · ${shown.price.basis === 'bareme' ? t('compas.v5.prevoir.priceHint', { date: dayMonthIn(locale, shown.price.asOf) }) : t('compas.v5.prevoir.pricePartner', { date: dayMonthIn(locale, shown.price.asOf) })}` : ''}
            </span>
            <span className="v5-okc">{stateLabel}</span>
          </div>
        )}
        {shown && (
          <div className="row">
            {url && (
              <a
                className="v5-link"
                href={url}
                target="_blank"
                rel={linkRel(shown.partner)}
                aria-label={t('compas.v5.prevoir.linkLabel', { action: shown.partner ? t('compas.v5.prevoir.linkPartner', { partner: shown.partner }) : t('compas.v5.prevoir.linkOfficial'), name: shown.name })}
              >
                {shown.partner ? t('compas.v5.prevoir.linkPartner', { partner: shown.partner }) : t('compas.v5.prevoir.linkOfficial')}
                <V5Icon name="external" size="xs" />
              </a>
            )}
            {canEdit && !chosen && (
              <MBtn primary disabled={ctl.busy} aria-label={t('compas.v5.prevoir.chooseNight', { name: shown.name, day: card.day })} onClick={() => choose(shown)}>
                {t('compas.v5.prevoir.choose')}
              </MBtn>
            )}
            {canEdit && chosen && (
              <MBtn disabled={ctl.busy} aria-label={t('compas.v5.prevoir.removeNight', { day: card.day })} onClick={remove}>
                {t('compas.v5.prevoir.remove')}
              </MBtn>
            )}
            {canEdit && chosen && !booked && (
              <MBtn primary disabled={ctl.busy} aria-label={t('compas.v5.prevoir.iBookedLabel', { label: chosen.name })} onClick={() => onBooked(chosen)}>
                {t('compas.v5.prevoir.iBooked')}
              </MBtn>
            )}
          </div>
        )}
        {listed.length === 0 && canEdit && (
          <form className="v5-form" onSubmit={note} aria-label={t('compas.v5.prevoir.manualCap')}>
            <label>
              {t('compas.v5.prevoir.manualLabel', { day: card.day })}
              <input className="v5-inp" value={manual} maxLength={120} autoComplete="off" placeholder={t('compas.v5.prevoir.manualPlaceholder')} onChange={(e) => setManual(e.target.value)} />
            </label>
            <MBtn primary type="submit" disabled={ctl.busy || manual.trim().length === 0}>
              {t('compas.v5.prevoir.manualButton')}
            </MBtn>
          </form>
        )}
      </div>
    </div>
  );
}

function TransportCardView({
  views,
  chosen,
  booked,
  unavailable,
  onChoose,
  onBooked,
}: {
  views: TransportView[];
  chosen: TransportView | null;
  booked: boolean;
  unavailable: boolean;
  onChoose: (id: TransportView['id'] | null) => void;
  onBooked: (view: TransportView) => void;
}) {
  const api = useV5();
  const { data, ctl, t, locale, canEdit } = api;
  const { model } = data;
  const shown = chosen ?? views[0] ?? null;

  if (!shown) {
    return (
      <Grp className="manual">
        <Cap>{t('compas.v5.prevoir.transportCap')}</Cap>
        <p className="v5-note">{unavailable ? t('compas.v5.prevoir.transportUnavailable') : t('compas.v5.prevoir.transportNone')}</p>
      </Grp>
    );
  }
  const write = (v: TransportView) =>
    // Le serveur ne propose jamais « bus » : un tel choix n'est pas écrit.
    v.id === 'bus'
      ? Promise.resolve({ success: false as const, error: t('compas.v5.prevoir.transportUnavailable') })
      : compasV5SetTransportAction({ tripId: model.tripId, tripSlug: model.slug, transport: { id: v.id, amountEur: v.amountEur, perPerson: v.perPerson, source: v.source } });
  const choose = (view: TransportView) => {
    const previous = chosen;
    void ctl
      .run(
        t('compas.v5.prevoir.transportChosenMsg', { label: view.label }),
        () => write(view),
        previous
          ? async () => {
              const res = await write(previous);
              if (res.success) onChoose(previous.id);
              return res;
            }
          : undefined
      )
      .then((ok) => ok && onChoose(view.id));
  };
  const priceOf = (v: TransportView) =>
    v.amountEur == null ? t('compas.v5.prevoir.priceNone') : v.perPerson ? t('compas.v5.prevoir.transportEach', { price: moneyIn(locale, v.amountEur) }) : t('compas.v5.prevoir.transportTotal', { price: moneyIn(locale, v.amountEur) });
  const url = safeUrl(shown.url);
  const stateLabel = booked ? t('compas.v5.prevoir.stateBooked') : chosen ? t('compas.v5.prevoir.stateChosen') : t('compas.v5.prevoir.stateProposed');

  return (
    <div className="v5-grp v5-bk" data-kind="transport">
      <div className="ill">
        <V5Icon name={transportIcon(shown.id)} />
        <div className="t">
          <small>{t('compas.v5.prevoir.transportCap')}</small>
          <b>{shown.label}</b>
          {shown.detail && <small>{shown.detail}</small>}
        </div>
        <span className="pr">{priceOf(shown)}</span>
      </div>
      <div className="bb">
        {views.length > 1 && (
          <ul className="v5-mini" aria-label={t('compas.v5.prevoir.transportAlternatives')}>
            {views.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="v5-mo"
                  aria-pressed={chosen?.id === v.id}
                  aria-label={t('compas.v5.prevoir.chooseTransport', { label: v.label })}
                  disabled={!canEdit || ctl.busy}
                  onClick={() => (chosen?.id === v.id ? undefined : choose(v))}
                >
                  <span className="im">
                    <V5Icon name={transportIcon(v.id)} />
                  </span>
                  <b>{v.label}</b>
                  <small>{priceOf(v)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="v5-stl">
          <span>{t('compas.v5.prevoir.sourceLine', { source: shown.source })}</span>
          <span className="v5-okc">{stateLabel}</span>
        </div>
        <div className="row">
          {url && (
            <a
              className="v5-link"
              href={url}
              target="_blank"
              rel={linkRel(shown.partner)}
              aria-label={t('compas.v5.prevoir.linkLabel', { action: shown.partner ? t('compas.v5.prevoir.linkPartner', { partner: shown.partner }) : t('compas.v5.prevoir.linkOfficial'), name: shown.label })}
            >
              {shown.partner ? t('compas.v5.prevoir.linkPartner', { partner: shown.partner }) : t('compas.v5.prevoir.linkOfficial')}
              <V5Icon name="external" size="xs" />
            </a>
          )}
          {canEdit && !chosen && (
            <MBtn primary disabled={ctl.busy} aria-label={t('compas.v5.prevoir.chooseTransport', { label: shown.label })} onClick={() => choose(shown)}>
              {t('compas.v5.prevoir.choose')}
            </MBtn>
          )}
          {canEdit && chosen && !booked && (
            <MBtn primary disabled={ctl.busy} aria-label={t('compas.v5.prevoir.iBookedLabel', { label: chosen.label })} onClick={() => onBooked(chosen)}>
              {t('compas.v5.prevoir.iBooked')}
            </MBtn>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- À acheter ---------- */

function BuyTab() {
  const api = useV5();
  const { data, ctl, t, locale, solo } = api;
  const { model } = data;
  const entries = useMemo(() => buyEntries(ctl.lines, data.shop, data.viewerId), [ctl.lines, data.shop, data.viewerId]);
  const totals = useMemo(() => buyTotals(entries), [entries]);
  const shop = useMemo(() => nearestRouteShop(data.points, model.route.dayPlans), [data.points, model.route.dayPlans]);

  return (
    <>
      {entries.length === 0 ? (
        <Grp>
          <div className="v5-li">
            <span className="fi" aria-hidden="true">
              <V5Icon name="check" size="s" />
            </span>
            <span className="t">
              <b>{t('compas.v5.prevoir.buyEmptyTitle')}</b>
              <small>{t('compas.v5.prevoir.buyEmptySub')}</small>
            </span>
          </div>
        </Grp>
      ) : (
        <>
          <p className="v5-note">
            {totals.pricedCount > 0 ? t('compas.v5.prevoir.buyTotal', { amount: moneyIn(locale, totals.boutiqueEur) }) : ''}
            {totals.pricedCount > 0 && totals.unpricedCount > 0 ? ' · ' : ''}
            {totals.unpricedCount > 0 ? countText(t, locale, totals.unpricedCount, 'compas.v5.prevoir.buyUnpricedOne', 'compas.v5.prevoir.buyUnpricedOther') : ''}
          </p>
          {shop && (
            <div className="v5-line info">
              <V5Icon name="cart" size="s" />
              <span>{t('compas.v5.prevoir.routeShop', { name: shop.label, distance: formatDistance(locale, shop.distanceM), day: shop.day })}</span>
              <MBtn onClick={() => api.openSpace('day', { day: shop.day - 1 })}>{t('compas.v5.prevoir.seeDay', { day: shop.day })}</MBtn>
            </div>
          )}
          <ul className="list">
            {entries.map((entry) => (
              <BuyCard key={entry.line.id} entry={entry} solo={solo} />
            ))}
          </ul>
        </>
      )}
      <p className="v5-src">{t('compas.v5.prevoir.buyNote')}</p>
    </>
  );
}

function BuyCard({ entry, solo }: { entry: BuyEntry; solo: boolean }) {
  const { data, ctl, t, locale, canEdit } = useV5();
  const { model } = data;
  const { line, product, stage } = entry;
  const name = line.name;
  const inCart = stage !== 'needed';

  const pick = async () => {
    if (!product) return;
    const before = getCart().find((i) => i.id === product.id)?.quantity ?? 0;
    const ok = await ctl.run(
      t('compas.v5.prevoir.pickedMsg', { name }),
      () => compasPickShopProductAction({ tripId: model.tripId, tripSlug: model.slug, itemId: line.id, shopProductId: product.id }),
      () => {
        if (before === 0) removeFromCart(product.id);
        else updateQuantity(product.id, before);
        return setPurchaseStateAction(line.id, entry.restore === 'in_cart' || entry.restore === 'shipping' ? entry.restore : 'needed', model.slug);
      }
    );
    if (ok && product.slug && product.priceEur != null) {
      addToCart({
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand ?? '',
        priceEur: product.priceEur,
        weightG: product.weightG ?? 0,
        image: product.image ?? '',
        imageAlt: product.imageAlt ?? product.name,
        category: product.category ?? '',
      });
    }
  };
  const bought = () =>
    void ctl.run(
      t('compas.v5.prevoir.boughtMsg', { name }),
      () => setPurchaseStateAction(line.id, 'added', model.slug),
      () => setPurchaseStateAction(line.id, entry.restore, model.slug)
    );

  const detail =
    stage === 'in_cart'
      ? `${t('compas.v5.prevoir.stageInCart')}${product ? ` · ${product.name}` : ''}`
      : stage === 'shipping'
        ? `${t('compas.v5.prevoir.stageShipping')}${product ? ` · ${product.name}` : ''}`
        : product
          ? product.priceEur != null
            ? `${product.name} · ${moneyIn(locale, product.priceEur)}`
            : `${product.name} · ${t('compas.v5.prevoir.priceNone')}`
          : t('compas.v5.prevoir.buyNoProduct');

  return (
    <li className="v5-grp v5-by">
      <div className="li2">
        <span className="th">
          <Pic src={product?.image ?? null} icon={itemIcon(line)} alt={product ? product.imageAlt || product.name : name} />
        </span>
        <span className="t">
          <b>{name}</b>
          <small>{detail}</small>
        </span>
        <span className="v v5-num">{product?.priceEur != null ? moneyIn(locale, product.priceEur) : ''}</span>
      </div>
      {canEdit && (
        <div className="v5-chips chips" role="group" aria-label={t('compas.v5.sac.stateGroup', { name })}>
          {product && (
            <Chip
              pressed={inCart && entry.linked}
              disabled={ctl.busy || (inCart && entry.linked)}
              aria-label={t('compas.v5.prevoir.buyStoreLabel', { product: product.name, name })}
              onClick={() => void pick()}
            >
              {t('compas.v5.prevoir.buyStore')}
            </Chip>
          )}
          <Chip aria-label={t('compas.v5.prevoir.buyOtherLabel', { name })} disabled={ctl.busy} onClick={() => ctl.open({ kind: 'acquire', lineId: line.id, mode: 'acheter' })}>
            {t('compas.v5.prevoir.buyOther')}
          </Chip>
          {!solo && (
            <Chip aria-label={t('compas.v5.prevoir.buyBorrowLabel', { name })} disabled={ctl.busy} onClick={() => ctl.open({ kind: 'acquire', lineId: line.id, mode: 'emprunter' })}>
              {t('compas.v5.prevoir.buyBorrow')}
            </Chip>
          )}
          <Chip aria-label={t('compas.v5.prevoir.buyBoughtLabel', { name })} disabled={ctl.busy} onClick={bought}>
            {t('compas.v5.prevoir.buyBought')}
          </Chip>
          {inCart && (
            <Link className="v5-link" href="/panier">
              {t('compas.v5.prevoir.seeCart')}
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

/* ---------- Définition ---------- */

export const prevoirDrawer: V5DrawerDef = {
  space: 'prevoir',
  tabs: (api) => [
    { icon: 'bed', label: api.t('compas.v5.prevoir.tabBook') },
    { icon: 'cart', label: api.t('compas.v5.prevoir.tabBuy') },
  ],
  title: (api) => (Math.min(api.tab, 1) === 0 ? api.t('compas.v5.prevoir.tabBook') : api.t('compas.v5.prevoir.tabBuy')),
  subtitle: (api) => {
    if (Math.min(api.tab, 1) === 0) {
      const nights = Math.max(0, api.data.model.route.dayPlans.length - 1);
      return nights > 0 ? countText(api.t, api.locale, nights, 'compas.v5.prevoir.subNightsOne', 'compas.v5.prevoir.subNightsOther') : null;
    }
    const entries = buyEntries(api.ctl.lines, api.data.shop, api.data.viewerId);
    return entries.length > 0 ? countText(api.t, api.locale, entries.length, 'compas.v5.prevoir.subBuyOne', 'compas.v5.prevoir.subBuyOther') : null;
  },
  Body: PrevoirBody,
};
