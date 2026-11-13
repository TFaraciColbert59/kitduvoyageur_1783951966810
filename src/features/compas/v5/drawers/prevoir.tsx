'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { V5ExtrasPayload } from '../engine/dayArrivals';
import Link from 'next/link';
import { setPurchaseStateAction } from '@/app/voyages/kit-actions';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import { addToCart, getCart, removeFromCart, updateQuantity } from '@/lib/cart';
import { countText } from '../../components/compasTypes';
import { dayMonthIn, moneyIn } from '../../components/sheetsI18n';
import { compasPickShopProductAction, compasSetStayAction } from '../../server/compasActions';
import { useV5, type V5Api } from '../context';
import { isResaBooked, nightKey, TRANSPORT_KEY, type ResaStatus } from '../engine/resaStatus';
import { compasV5SetResaStatusAction, compasV5SetStayAction, compasV5SetTransportAction } from '../server/choiceActions';
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
  selectedTransport,
  transportViews,
  type BuyEntry,
  type NightCard,
  type ReservationStep,
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

/** Lien affilié (partenaire ou relais `/go/…`) : `sponsored nofollow`. Lien de recherche direct : jamais. */
const linkRel = (partner: string | null, url?: string | null) => (partner || url?.startsWith('/go/') ? 'sponsored nofollow noopener' : 'noopener noreferrer');

/** Écrit la façon de venir (le serveur ne propose jamais « bus » : un tel choix n'est pas écrit). */
const writeTransport = (api: V5Api, v: TransportView) =>
  v.id === 'bus'
    ? Promise.resolve({ success: false as const, error: api.t('compas.v5.prevoir.transportUnavailable') })
    : compasV5SetTransportAction({
        tripId: api.data.model.tripId,
        tripSlug: api.data.model.slug,
        transport: { id: v.id, amountEur: v.amountEur, perPerson: v.perPerson, source: v.source },
      });

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
  // Le choix déjà écrit (relu avec les extras) tient lieu de départ ; un geste de cet écran le remplace.
  const persisted = (extras as Partial<V5ExtrasPayload>).choices?.transport?.id ?? null;
  const [picked, setTransportChoice] = useState<TransportView['id'] | null | undefined>(undefined);
  const transportChoice = picked === undefined ? persisted : picked;
  const [panelOpen, setPanelOpen] = useState(false);

  const cards = useMemo(() => nightCards(model, extras), [model, extras]);
  const transports = useMemo(() => transportViews(extras.transport, people), [extras.transport, people]);
  const chosenTransport = transports.find((x) => x.id === transportChoice) ?? null;
  // Le plan liste TOUT : le trajet choisi, sinon l'option chiffrée par défaut (annoncée « Proposée »), puis chaque nuit.
  const selection = useMemo(() => selectedTransport(transports, transportChoice), [transports, transportChoice]);
  const totals = useMemo(() => bookingTotals(cards, chosenTransport, people), [cards, chosenTransport, people]);
  const searchWord = t('compas.v5.prevoir.searchWord');
  const steps = useMemo(
    () =>
      reservationSteps(cards, selection, {
        people,
        origin: data.originName ?? null,
        destination: model.destination,
        start: model.dates.start,
        end: model.dates.end,
        keyword: searchWord,
      }),
    [cards, selection, people, data.originName, model.destination, model.dates.start, model.dates.end, searchWord]
  );
  const sandbox = sandboxProviders(data.providers);
  const saved = liveBookings(data.bookings);
  const pending = extras.fetchedAt === '';
  const lodgingDown = extras.unavailable.includes('lodging');
  const photosDown = extras.unavailable.includes('photos');
  const hasPartner = cards.some((c) => c.options.some((o) => o.partner)) || transports.some((x) => x.partner);
  const isBooked = (keys: readonly string[]) => keys.length > 0 && keys.every((k) => isResaBooked(api.resa, k));

  /**
   * « J'ai réservé » (ou son contraire) : rangé sur le voyage, un statut par élément. L'affichage suit tout de
   * suite ; si l'écriture échoue, il revient à l'état d'avant et l'erreur est annoncée. Une nuit ou un trajet
   * seulement proposés deviennent le choix de la personne au moment où elle dit l'avoir réservé.
   */
  const markResa = (target: { keys: string[]; label: string; pending?: ReservationStep['pending']; transport?: TransportView }, on: boolean) => {
    const { keys, label } = target;
    const status: ResaStatus = on ? 'booked' : 'todo';
    const patchOf = (to: ResaStatus | null) => Object.fromEntries(keys.map((k) => [k, to]));
    const previous = Object.fromEntries(keys.map((k) => [k, api.resa[k] ?? null])) as Record<string, ResaStatus | null>;
    const write = (to: ResaStatus) => compasV5SetResaStatusAction({ tripId: model.tripId, tripSlug: model.slug, keys, status: to });
    api.setResa(patchOf(status));
    void ctl
      .run(
        t(on ? 'compas.v5.prevoir.bookedMsg' : 'compas.v5.prevoir.unbookedMsg', { label }),
        async () => {
          if (on) {
            for (const night of target.pending ?? []) {
              const res = await compasV5SetStayAction({ tripId: model.tripId, tripSlug: model.slug, day: night.day, option: night.option });
              if (!res.success) return res;
            }
            if (target.transport) {
              const res = await writeTransport(api, target.transport);
              if (!res.success) return res;
              setTransportChoice(target.transport.id);
            }
          }
          return write(status);
        },
        async () => {
          const res = await write(on ? 'todo' : 'booked');
          if (res.success) api.setResa(patchOf(on ? 'todo' : 'booked'));
          return res;
        }
      )
      .then((ok) => {
        if (!ok) api.setResa(previous);
      });
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
          booked={isBooked([nightKey(card.day)])}
          onBooked={(view) => markResa({ keys: [nightKey(card.day)], label: view.name }, true)}
        />
      ))}

      <TransportCardView
        views={transports}
        chosen={chosenTransport}
        booked={isBooked([TRANSPORT_KEY])}
        unavailable={extras.unavailable.includes('transport')}
        onChoose={setTransportChoice}
        onBooked={(view) => markResa({ keys: [TRANSPORT_KEY], label: view.label }, true)}
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
          {steps.some((s) => s.partner || s.url?.startsWith('/go/')) && <AffiliateDisclosure compact />}
          <Grp>
            <ol className="steps">
              {steps.map((step, index) => {
                const done = isBooked(step.keys);
                const next = !done && steps.findIndex((s) => !isBooked(s.keys)) === index;
                const url = safeUrl(step.url);
                const where =
                  step.kind === 'transport'
                    ? t('compas.v5.prevoir.transportCap')
                    : step.nights > 1
                      ? t('compas.v5.prevoir.nightsWhen', { day: step.day ?? 0, count: step.nights })
                      : t('compas.v5.prevoir.nightWhen', { day: step.day ?? 0 });
                const name = step.label || where;
                const dates = step.checkIn && step.checkOut ? t('compas.v5.prevoir.stayDates', { from: dayMonthIn(locale, step.checkIn), to: dayMonthIn(locale, step.checkOut) }) : null;
                const state = step.proposed ? t('compas.v5.prevoir.stateProposed') : t('compas.v5.prevoir.stateChosen');
                const openLabel = step.direct ? t('compas.v5.prevoir.searchLink') : t('compas.v5.prevoir.bookOpen');
                const transport = step.kind === 'transport' && step.proposed ? selection?.view : undefined;
                return (
                  <li key={step.key} className={next ? 'next' : undefined} data-key={step.key}>
                    <span className="t">
                      <b>{name}</b>
                      <small>
                        {t('compas.v5.prevoir.bookStep', { n: index + 1, total: steps.length })} · {where}
                        {dates ? ` · ${dates}` : ''}
                        {step.partner ? ` · ${step.partner}` : ''}
                        {done ? '' : ` · ${state}`}
                      </small>
                      {!url && <small>{t('compas.v5.prevoir.bookNoLink')}</small>}
                    </span>
                    <span className="end">
                      {url && (
                        <a
                          className="v5-link"
                          href={url}
                          target="_blank"
                          rel={linkRel(step.partner, url)}
                          aria-label={t('compas.v5.prevoir.linkLabel', { action: openLabel, name })}
                        >
                          {openLabel}
                          <V5Icon name="external" size="xs" />
                        </a>
                      )}
                      {done ? (
                        <>
                          <span className="v5-okc">{t('compas.v5.prevoir.stateBooked')}</span>
                          {canEdit && (
                            <MBtn disabled={ctl.busy} aria-label={t('compas.v5.prevoir.unbookLabel', { label: name })} onClick={() => markResa({ keys: step.keys, label: name }, false)}>
                              {t('compas.v5.prevoir.unbook')}
                            </MBtn>
                          )}
                        </>
                      ) : (
                        canEdit && (
                          <MBtn
                            disabled={ctl.busy}
                            aria-label={t('compas.v5.prevoir.iBookedLabel', { label: name })}
                            onClick={() => markResa({ keys: step.keys, label: name, pending: step.pending, transport }, true)}
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
          {steps.some((s) => s.direct) && <p className="v5-src">{t('compas.v5.prevoir.searchNote')}</p>}
          {steps.every((s) => isBooked(s.keys)) &&<p className="v5-line good" role="status">{t('compas.v5.prevoir.bookAllDone')}</p>}
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
                rel={linkRel(shown.partner, url)}
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
  const { ctl, t, locale, canEdit } = api;
  const shown = chosen ?? views[0] ?? null;

  if (!shown) {
    return (
      <Grp className="manual">
        <Cap>{t('compas.v5.prevoir.transportCap')}</Cap>
        <p className="v5-note">{unavailable ? t('compas.v5.prevoir.transportUnavailable') : t('compas.v5.prevoir.transportNone')}</p>
      </Grp>
    );
  }
  const write = (v: TransportView) => writeTransport(api, v);
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
              rel={linkRel(shown.partner, url)}
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
