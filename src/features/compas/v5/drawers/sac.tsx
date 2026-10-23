'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { deleteTripItemAction, addCustomTripItemAction, setPurchaseStateAction } from '@/app/voyages/kit-actions';
import { countText } from '../../components/compasTypes';
import { kgIn, moneyIn } from '../../components/sheetsI18n';
import { kitCompatibility, type MyKit } from '../../engine/kitApply';
import type { CompasKitLine } from '../../engine/compasModel';
import {
  compasApplyKitAction,
  compasCreateKitFromTripAction,
  compasListMyKitsAction,
  compasSetCarrierAction,
} from '../../server/compasActions';
import { useV5 } from '../context';
import {
  adaptations,
  carryView,
  groupLines,
  itemIcon,
  itemPhoto,
  itemState,
  kitSummary,
  lineWeightG,
  myLines,
  restorablePurchaseState,
  shopProductFor,
  stateEditable,
  viewerCapacityKg,
  weightGroup,
  weightRing,
  type ItemState,
} from '../model/sac';
import { Avi, Cap, Chip, Grp, MBtn, PBtn, Pic } from '../ui/primitives';
import { V5Icon } from '../ui/icons';
import type { V5DrawerDef } from './types';
import './sac-prevoir.css';

type Season = 'printemps' | 'ete' | 'automne' | 'hiver' | 'toute_saison';
const SEASONS: ReadonlyArray<{ id: Season; key: 'optPrintemps' | 'optEte' | 'optAutomne' | 'optHiver' | 'optToute' }> = [
  { id: 'printemps', key: 'optPrintemps' },
  { id: 'ete', key: 'optEte' },
  { id: 'automne', key: 'optAutomne' },
  { id: 'hiver', key: 'optHiver' },
  { id: 'toute_saison', key: 'optToute' },
];

/** Catégorie de `addCustomTripItemAction` (liste fermée) pour remettre un objet retiré. */
function customCategory(line: CompasKitLine): 'safety' | 'shelter' | 'sleep' | 'clothing' | 'cook' | 'water' | 'tech' | 'misc' {
  switch (weightGroup(line.category, line.name)) {
    case 'securite':
      return 'safety';
    case 'dormir':
      return /tente|tarp|abri/i.test(line.name) ? 'shelter' : 'sleep';
    case 'vetements':
      return 'clothing';
    case 'eau':
      return /rechaud|popote|gamelle/i.test(line.name) ? 'cook' : 'water';
    default:
      return 'misc';
  }
}

const STATE_CLASS: Record<ItemState, 'have' | 'buy' | 'borrow'> = { have: 'have', buy: 'buy', borrow: 'borrow', lent: 'borrow', replace: 'buy' };

/* ---------- Corps du tiroir ---------- */

function SacBody() {
  const api = useV5();
  const tab = api.solo ? Math.min(api.tab, 1) : Math.min(api.tab, 2);
  return (
    <div className="v5-sp">
      {!api.canEdit && <p className="v5-note">{api.t('compas.v5.sac.readOnly')}</p>}
      {tab === 0 ? <BagTab /> : tab === 1 ? <KitsTab /> : <CarryTab />}
    </div>
  );
}

/* ---------- Ton sac ---------- */

function BagTab() {
  const api = useV5();
  const { data, ctl, t, locale, canEdit, solo } = api;
  const { model } = data;
  const viewer = data.viewerId;
  const [openId, setOpenId] = useState<string | null>(null);

  const mine = useMemo(() => myLines(ctl.lines, viewer, new Set(model.crew.loads.map((l) => l.userId))), [ctl.lines, viewer, model.crew.loads]);
  const ring = useMemo(() => weightRing(mine, viewerCapacityKg(model, viewer)), [mine, model, viewer]);
  const adapt = useMemo(() => adaptations(mine, data.kitAdvice), [mine, data.kitAdvice]);
  const groups = useMemo(() => groupLines(mine), [mine]);
  const lineById = useMemo(() => new Map(ctl.lines.map((l) => [l.id, l])), [ctl.lines]);

  const C = 2 * Math.PI * 44;
  let offset = 0;
  const arcs = ring.segments.map((s) => {
    const len = s.share * C;
    const arc = (
      <circle
        key={s.group}
        className={`seg-${s.group}`}
        cx="52"
        cy="52"
        r="44"
        strokeDasharray={`${Math.max(0, len - 2).toFixed(1)} ${C.toFixed(1)}`}
        strokeDashoffset={(-offset).toFixed(1)}
      />
    );
    offset += len;
    return arc;
  });

  const remove = (line: CompasKitLine) =>
    void ctl.run(
      t('compas.v5.sac.removedMsg', { name: line.name }),
      () => deleteTripItemAction(line.id, model.slug),
      () => {
        const fd = new FormData();
        fd.set('itemName', line.name);
        fd.set('category', customCategory(line));
        if (line.weightGrams != null && line.weightGrams > 0) fd.set('weightGrams', String(line.weightGrams));
        fd.set('quantity', String(Math.max(1, line.quantity)));
        fd.set('isVital', String(line.vital));
        fd.set('isWorn', String(line.kind === 'worn'));
        fd.set('isConsumable', String(line.kind === 'consumable'));
        return addCustomTripItemAction(model.tripId, model.slug, fd);
      }
    );

  const ringLabel = `${t('compas.v5.sac.ringLabel')} : ${kgIn(locale, ring.totalG)}`;

  return (
    <>
      <Grp className={`v5-wcard${ring.over ? ' over' : ''}`}>
        <div className="v5-donut" role="img" aria-label={ringLabel}>
          <svg viewBox="0 0 104 104" aria-hidden="true" focusable="false">
            <circle className="track" cx="52" cy="52" r="44" />
            {arcs}
          </svg>
          <div className="c" aria-hidden="true">
            <b className="v5-num">{kgIn(locale, ring.totalG)}</b>
            <small>{ring.capacityG != null ? t('compas.v5.sac.ringOf', { max: kgIn(locale, ring.capacityG) }) : t('compas.v5.sac.ringKnown')}</small>
          </div>
        </div>
        <ul className="v5-legend" aria-label={t('compas.v5.sac.ringLabel')}>
          {ring.segments.map((s) => (
            <li key={s.group}>
              <i className={`dot-${s.group}`} aria-hidden="true" />
              <span>{t(`compas.v5.sac.group.${s.group}` as const)}</span>
              <b className="v5-num">{kgIn(locale, s.grams)}</b>
            </li>
          ))}
          {ring.segments.length === 0 && <li>{t('compas.v5.sac.ringEmpty')}</li>}
          {ring.unknownWeightCount > 0 && (
            <li>{countText(t, locale, ring.unknownWeightCount, 'compas.v5.sac.ringUnknownOne', 'compas.v5.sac.ringUnknownOther')}</li>
          )}
        </ul>
      </Grp>
      {ring.over && <p className="banner" role="status">{t('compas.v5.sac.ringOver')}</p>}
      <p className="v5-src">{t('compas.v5.sac.ringNote')}</p>

      <Cap right={adapt.totalAdvice > 0 ? t('compas.v5.sac.adaptCoverage', { covered: adapt.coveredAdvice, total: adapt.totalAdvice }) : undefined}>
        {t('compas.v5.sac.adaptCap')}
      </Cap>
      {adapt.added.length === 0 && adapt.advice.length === 0 ? (
        <p className="v5-note">{t('compas.v5.sac.adaptNone')}</p>
      ) : (
        <ul className="v5-why">
          {adapt.added.map((a) => {
            const line = lineById.get(a.lineId);
            const photo = line ? itemPhoto(line, data.shop) : null;
            return (
              <li key={a.lineId}>
                <div className="v5-rc v5-grp">
                  <div className="r">
                    <span className="ico good" aria-hidden="true">
                      <V5Icon name="check" size="s" />
                    </span>
                    <span className="why">{a.reason}</span>
                  </div>
                  <div className="it">
                    <span className="th">
                      <Pic src={photo?.src ?? null} icon={line ? itemIcon(line) : 'box'} alt={photo?.alt ?? a.name} />
                    </span>
                    <span className="t">
                      <b>{a.name}</b>
                      <small>
                        {t('compas.v5.sac.adaptAdded')}
                        {a.weightG != null ? ` · ${kgIn(locale, a.weightG)}` : ` · ${t('compas.sheets.common.toWeigh')}`}
                      </small>
                    </span>
                    {canEdit && line && (
                      <button type="button" className="u" disabled={ctl.busy} aria-label={t('compas.v5.sac.adaptRemoveLabel', { name: a.name })} onClick={() => remove(line)}>
                        {t('compas.v5.sac.adaptRemove')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {adapt.advice.map((a) => (
            <li key={a.adviceId}>
              <div className="v5-rc v5-grp">
                <div className="r">
                  <span className="ico warn" aria-hidden="true">
                    <V5Icon name="info" size="s" />
                  </span>
                  <span className="why">{a.reason}</span>
                </div>
                <div className="it">
                  <span className="th">
                    <Pic icon="box" />
                  </span>
                  <span className="t">
                    <b>{a.label}</b>
                    <small>{t('compas.v5.sac.adaptToAdd')}</small>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="u"
                      aria-label={t('compas.v5.sac.adaptAddLabel', { label: a.label })}
                      onClick={() => ctl.open({ kind: 'add', target: 'kit', suggest: { query: a.label, name: a.label } })}
                    >
                      {t('compas.v5.sac.adaptAdd')}
                    </button>
                  )}
                </div>
                <span className="src">{t('compas.v5.sac.adaptSource', { source: a.source })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adapt.added.length > 0 && (
        <p className="v5-src">
          {adapt.addedWeightG > 0 ? t('compas.v5.sac.adaptWeight', { weight: kgIn(locale, adapt.addedWeightG) }) : ''}
          {adapt.addedUnknownWeight > 0
            ? ` ${countText(t, locale, adapt.addedUnknownWeight, 'compas.v5.sac.adaptUnknownOne', 'compas.v5.sac.adaptUnknownOther')}`
            : ''}
        </p>
      )}

      {mine.length === 0 && <p className="v5-note">{t('compas.v5.sac.empty')}</p>}
      {groups.map((g) => (
        <section key={g.group} aria-label={t(`compas.v5.sac.group.${g.group}` as const)} style={{ display: 'contents' }}>
          <Cap right={g.lines.length}>{t(`compas.v5.sac.group.${g.group}` as const)}</Cap>
          <ul className="v5-gear">
            {g.lines.map((line) => (
              <ItemCard key={line.id} line={line} open={openId === line.id} onToggle={() => setOpenId(openId === line.id ? null : line.id)} solo={solo} />
            ))}
          </ul>
        </section>
      ))}
      {canEdit && (
        <PBtn disabled={ctl.busy} onClick={() => ctl.open({ kind: 'add', target: 'kit' })}>
          <V5Icon name="plus" size="s" />
          {t('compas.v5.sac.add')}
        </PBtn>
      )}
    </>
  );
}

function ItemCard({ line, open, onToggle, solo }: { line: CompasKitLine; open: boolean; onToggle: () => void; solo: boolean }) {
  const { data, ctl, t, locale, canEdit } = useV5();
  const { model } = data;
  const viewer = data.viewerId;
  const state = itemState(line, viewer);
  const photo = itemPhoto(line, data.shop);
  const editable = canEdit && stateEditable(line);
  const product = state === 'buy' || state === 'replace' ? shopProductFor(line, data.shop)?.product ?? null : null;
  const weight = lineWeightG(line);
  const label: Record<ItemState, string> = {
    have: t('compas.v5.sac.stateHave'),
    buy: t('compas.v5.sac.stateBuy'),
    borrow: t('compas.v5.sac.stateBorrow'),
    lent: t('compas.v5.sac.stateLent'),
    replace: t('compas.v5.sac.stateReplace'),
  };

  const setHave = () =>
    void ctl.run(
      t('compas.v5.sac.stateSetHave', { name: line.name }),
      () => setPurchaseStateAction(line.id, 'added', model.slug),
      () => setPurchaseStateAction(line.id, restorablePurchaseState(line), model.slug)
    );
  const setBuy = () => {
    if (state === 'borrow') {
      const previous = line.ownerId;
      void ctl.run(
        t('compas.v5.sac.stateSetBuy', { name: line.name }),
        () => compasSetCarrierAction({ tripId: model.tripId, tripSlug: model.slug, itemId: line.id, carrierId: viewer, shared: false }),
        () => compasSetCarrierAction({ tripId: model.tripId, tripSlug: model.slug, itemId: line.id, carrierId: previous, shared: true })
      );
      return;
    }
    void ctl.run(
      t('compas.v5.sac.stateSetBuy', { name: line.name }),
      () => setPurchaseStateAction(line.id, 'needed', model.slug),
      () => setPurchaseStateAction(line.id, 'added', model.slug)
    );
  };

  return (
    <li className={`v5-it2 v5-grp${open ? ' open' : ''}`}>
      <span className="im">
        <Pic src={photo?.src ?? null} icon={itemIcon(line)} alt={photo?.alt ?? line.name} />
      </span>
      <span className="tx">
        <button type="button" className="nm" aria-expanded={open} onClick={onToggle}>
          <b>{line.name}</b>
          <span className="m">
            <span className="v5-num">
              {weight == null ? t('compas.sheets.common.toWeigh') : `${kgIn(locale, line.weightGrams)}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
            </span>
            <span className={`v5-st ${STATE_CLASS[state]}`}>
              <i aria-hidden="true" />
              {label[state]}
            </span>
          </span>
        </button>
        {open && (
          <div className="xtra">
            {line.vital && <span className="vital">{t('compas.v5.sac.vital')}</span>}
            {editable ? (
              <div className="v5-chips" role="group" aria-label={t('compas.v5.sac.stateGroup', { name: line.name })}>
                <Chip pressed={state === 'have'} disabled={ctl.busy} onClick={state === 'have' ? undefined : setHave}>
                  {label.have}
                </Chip>
                <Chip pressed={state === 'buy' || state === 'replace'} disabled={ctl.busy} onClick={state === 'buy' || state === 'replace' ? undefined : setBuy}>
                  {label.buy}
                </Chip>
                {!solo && (
                  <Chip pressed={state === 'borrow'} disabled={ctl.busy} onClick={() => ctl.open({ kind: 'acquire', lineId: line.id, mode: 'emprunter' })}>
                    {label.borrow}
                  </Chip>
                )}
              </div>
            ) : (
              <p className="v5-note">{state === 'lent' ? t('compas.v5.sac.lentNote') : canEdit ? t('compas.v5.sac.stateLocked') : null}</p>
            )}
            {line.reason && <p className="v5-note">{t('compas.v5.sac.reasonLine', { reason: line.reason })}</p>}
            {line.shared && (
              <p className="v5-note">{line.ownerId ? t('compas.v5.sac.carriedBy', { name: ctl.memberName(line.ownerId) }) : t('compas.v5.sac.carrierNone')}</p>
            )}
            {product && (
              <p className="v5-note">
                {product.priceEur != null ? t('compas.v5.sac.shopLine', { price: moneyIn(locale, product.priceEur) }) : t('compas.v5.sac.shopLineNone')}
              </p>
            )}
            <div className="acts">
              <MBtn onClick={() => ctl.open({ kind: 'item', lineId: line.id })}>{t('compas.v5.sac.openItem')}</MBtn>
              {canEdit && line.shared && !solo && <MBtn onClick={() => ctl.open({ kind: 'carrier', lineId: line.id })}>{t('compas.v5.sac.openCarrier')}</MBtn>}
              {canEdit && (state === 'buy' || state === 'replace') && (
                <MBtn onClick={() => ctl.open({ kind: 'acquire', lineId: line.id, mode: 'acheter' })}>{t('compas.v5.sac.openFind')}</MBtn>
              )}
            </div>
          </div>
        )}
      </span>
    </li>
  );
}

/* ---------- Tes kits ---------- */

type KitsState = { status: 'loading' } | { status: 'error'; error: string | null } | { status: 'ok'; kits: MyKit[] };

function KitsTab() {
  const api = useV5();
  const { data, ctl, t, locale, canEdit } = api;
  const { model } = data;
  const [state, setState] = useState<KitsState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string>('trip');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    compasListMyKitsAction()
      .then((res) => alive && setState(res.success ? { status: 'ok', kits: res.kits } : { status: 'error', error: res.error }))
      .catch(() => alive && setState({ status: 'error', error: null }));
    return () => {
      alive = false;
    };
  }, [reload]);

  const tripNames = useMemo(() => ctl.lines.map((l) => l.name), [ctl.lines]);
  const forecasts = useMemo(
    () => (data.weather?.tripDays ?? []).map((d) => ({ day: d.day, date: d.date, forecast: d.forecast })),
    [data.weather]
  );
  const kits = state.status === 'ok' ? state.kits : [];
  const mineKit = kits.find((k) => k.id === selected) ?? null;
  const tripWeight = useMemo(() => {
    let g = 0;
    let unknown = 0;
    for (const l of ctl.lines) {
      const w = lineWeightG(l);
      if (w == null) unknown += 1;
      else g += w;
    }
    return { g, unknown };
  }, [ctl.lines]);

  const collage = (cells: Array<{ src: string | null; alt: string; icon: ReturnType<typeof itemIcon> }>) => (
    <span className="col" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => {
        const c = cells[i];
        return (
          <span className="cell" key={i}>
            {c ? <Pic src={c.src} icon={c.icon} alt="" /> : null}
          </span>
        );
      })}
    </span>
  );

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('kitName') ?? '').trim();
    const season = String(fd.get('season') ?? '');
    setSaving(true);
    const ok = await ctl.run(t('compas.sheets.kits.created', { name }), () =>
      compasCreateKitFromTripAction({
        tripId: model.tripId,
        tripSlug: model.slug,
        name,
        season: SEASONS.some((s) => s.id === season) ? (season as Season) : null,
      })
    );
    setSaving(false);
    if (ok) setReload((n) => n + 1);
  };

  return (
    <>
      <p className="v5-note">{t('compas.v5.sac.kitsNote')}</p>
      <ul className="v5-kits" aria-label={t('compas.v5.sac.kitsGroup')}>
        <li>
          <button type="button" className="v5-kc" aria-pressed={selected === 'trip'} onClick={() => setSelected('trip')}>
            {collage(
              ctl.lines.slice(0, 4).map((l) => {
                const p = itemPhoto(l, data.shop);
                return { src: p?.src ?? null, alt: l.name, icon: itemIcon(l) };
              })
            )}
            <b>{t('compas.v5.sac.kitTripTitle', { title: model.title })}</b>
            <small>{t('compas.v5.sac.kitTripSub')}</small>
          </button>
        </li>
        {kits.map((kit) => (
          <li key={kit.id}>
            <button type="button" className="v5-kc" aria-pressed={selected === kit.id} onClick={() => setSelected(kit.id)}>
              {collage(kit.items.slice(0, 4).map((i) => ({ src: null, alt: i.name, icon: itemIcon({ name: i.name, category: i.category }) })))}
              <b>{kit.name}</b>
              <small>{countText(t, locale, kit.items.length, 'compas.sheets.common.itemsOne', 'compas.sheets.common.itemsOther')}</small>
            </button>
          </li>
        ))}
      </ul>
      {state.status === 'loading' && <p className="v5-note" role="status">{t('compas.sheets.kits.loading')}</p>}
      {state.status === 'error' && (
        <p className="v5-note" role="alert">
          {state.error ?? t('compas.sheets.common.lostConnection')}
        </p>
      )}
      {state.status === 'ok' && kits.length === 0 && <p className="v5-note">{t('compas.sheets.kits.empty')}</p>}

      {selected === 'trip' || !mineKit ? (
        <Grp className="kitpanel">
          <div className="stats">
            <b>{countText(t, locale, ctl.lines.length, 'compas.sheets.common.itemsOne', 'compas.sheets.common.itemsOther')} · {kgIn(locale, tripWeight.g)}</b>
            {tripWeight.unknown > 0 && (
              <span>{countText(t, locale, tripWeight.unknown, 'compas.v5.sac.kitWeightUnknownOne', 'compas.v5.sac.kitWeightUnknownOther')}</span>
            )}
          </div>
          {canEdit && (
            <>
              <Cap>{t('compas.v5.sac.saveCap')}</Cap>
              <p className="v5-note">{t('compas.v5.sac.saveHelp')}</p>
              <form onSubmit={create} aria-label={t('compas.v5.sac.saveCap')}>
                <label>
                  {t('compas.v5.sac.saveName')}
                  <input className="v5-inp" name="kitName" required minLength={2} maxLength={80} autoComplete="off" defaultValue={t('compas.sheets.kits.defaultName', { title: model.title }).slice(0, 80)} />
                </label>
                <label>
                  {t('compas.sheets.kits.season')}
                  <select className="v5-inp" name="season" defaultValue="">
                    <option value="">{t('compas.sheets.season.optNone')}</option>
                    {SEASONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {t(`compas.sheets.season.${s.key}` as const)}
                      </option>
                    ))}
                  </select>
                </label>
                <PBtn type="submit" tone="dark" disabled={ctl.busy || saving || ctl.lines.length === 0}>
                  {ctl.lines.length === 0 ? t('compas.sheets.kits.addFirst') : t('compas.v5.sac.saveButton')}
                </PBtn>
              </form>
            </>
          )}
        </Grp>
      ) : (
        <KitPanel kit={mineKit} tripNames={tripNames} forecasts={forecasts} />
      )}
    </>
  );
}

function KitPanel({
  kit,
  tripNames,
  forecasts,
}: {
  kit: MyKit;
  tripNames: string[];
  forecasts: Parameters<typeof kitCompatibility>[0]['forecasts'];
}) {
  const { data, ctl, t, locale, canEdit } = useV5();
  const { model } = data;
  const summary = kitSummary(kit, tripNames);
  const compat = kitCompatibility({
    kit,
    tripNames,
    forecasts,
    dayPlans: model.route.dayPlans,
    waterPointsCount: null,
    context: data.kitContext,
  });
  const toAdd = summary.plan.toAdd.length;
  return (
    <Grp className="kitpanel">
      <div className="stats">
        <b>
          {countText(t, locale, summary.itemCount, 'compas.sheets.common.itemsOne', 'compas.sheets.common.itemsOther')}
          {summary.knownWeightG > 0 ? ` · ${kgIn(locale, summary.knownWeightG)}` : ''}
        </b>
        {summary.unknownWeightCount > 0 && (
          <span>{countText(t, locale, summary.unknownWeightCount, 'compas.v5.sac.kitWeightUnknownOne', 'compas.v5.sac.kitWeightUnknownOther')}</span>
        )}
        <span>{t('compas.sheets.kits.split', { already: summary.plan.alreadyThere, toAdd })}</span>
        <span>
          {compat.total > 0
            ? `${countText(t, locale, compat.covered, 'compas.sheets.kits.coversOne', 'compas.sheets.kits.coversOther', { covered: compat.covered, total: compat.total })}${compat.bringsNew ? ` (${t('compas.sheets.kits.bringsNew', { count: compat.bringsNew })})` : ''}`
            : t('compas.sheets.kits.noCompare')}
        </span>
      </div>
      {canEdit && (
        <PBtn
          tone="dark"
          disabled={ctl.busy || toAdd === 0}
          aria-label={t('compas.v5.sac.applyLabel', { name: kit.name })}
          onClick={() =>
            void ctl.run(countText(t, locale, toAdd, 'compas.sheets.kits.addedOne', 'compas.sheets.kits.addedOther'), () =>
              compasApplyKitAction({ tripId: model.tripId, tripSlug: model.slug, kitId: kit.id })
            )
          }
        >
          {toAdd === 0 ? t('compas.sheets.kits.complete') : t('compas.v5.sac.applyButton')}
        </PBtn>
      )}
      <p className="v5-src">{t('compas.v5.sac.applyNote')}</p>
    </Grp>
  );
}

/* ---------- Qui porte quoi ---------- */

function CarryTab() {
  const { data, ctl, t, locale, canEdit } = useV5();
  const { model } = data;
  const view = useMemo(() => carryView(model, ctl.lines), [model, ctl.lines]);

  const assign = (line: CompasKitLine, userId: string | null, name: string, previous: string | null) =>
    void ctl.run(
      t('compas.sheets.acquire.carries', { name, item: line.name }),
      () => compasSetCarrierAction({ tripId: model.tripId, tripSlug: model.slug, itemId: line.id, carrierId: userId, shared: true }),
      () => compasSetCarrierAction({ tripId: model.tripId, tripSlug: model.slug, itemId: line.id, carrierId: previous, shared: true })
    );

  return (
    <>
      <p className="v5-note">{t('compas.v5.sac.carryNote')}</p>
      {view.sharedCount === 0 && <p className="v5-note">{t('compas.v5.sac.carryEmpty')}</p>}
      {view.unassigned.length > 0 && (
        <>
          <Cap right={view.unassigned.length}>{t('compas.v5.sac.carryUnassigned')}</Cap>
          <Grp>
            <ul className="carry">
              {view.unassigned.map((line) => (
                <li key={line.id}>
                  <div className="who">
                    <span className="t">
                      <b>{line.name}</b>
                      <small>{line.weightGrams == null ? t('compas.sheets.common.toWeigh') : kgIn(locale, lineWeightG(line))}</small>
                    </span>
                  </div>
                  {canEdit && (
                    <div className="v5-chips">
                      {view.members.map((m) => (
                        <Chip key={m.userId} disabled={ctl.busy} aria-label={t('compas.v5.sac.carryToLabel', { item: line.name, name: m.name })} onClick={() => assign(line, m.userId, m.name, null)}>
                          {t('compas.v5.sac.carryTo', { name: m.name })}
                        </Chip>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Grp>
        </>
      )}
      <Grp>
        <ul className="carry">
          {view.members.map((m) => (
            <li key={m.userId}>
              <div className="who">
                <Avi name={m.name} />
                <span className="t">
                  <b>{m.name}</b>
                  <small>{m.shared.length ? m.shared.map((s) => s.name).join(', ') : t('compas.v5.sac.carryNothing')}</small>
                  <small>
                    {m.capacityKg != null ? t('compas.v5.sac.carryCapacity', { max: m.capacityKg }) : t('compas.sheets.common.capacityUnknown')}
                  </small>
                </span>
                <span className="v v5-num">{kgIn(locale, m.carriedG)}</span>
              </div>
              <div className="v5-chips">
                <MBtn onClick={() => ctl.open({ kind: 'bag', userId: m.userId })} aria-label={t('compas.v5.sac.carryOpenBag', { name: m.name })}>
                  {t('compas.v5.sac.carryOpenBag', { name: m.name })}
                </MBtn>
              </div>
            </li>
          ))}
        </ul>
      </Grp>
    </>
  );
}

/* ---------- Définition ---------- */

export const sacDrawer: V5DrawerDef = {
  space: 'sac',
  tabs: (api) => [
    { icon: 'bag', label: api.t('compas.v5.sac.tabBag') },
    { icon: 'spark', label: api.t('compas.v5.sac.tabKits') },
    ...(api.solo ? [] : [{ icon: 'people' as const, label: api.t('compas.v5.sac.tabCarry') }]),
  ],
  title: (api) => {
    const tab = api.solo ? Math.min(api.tab, 1) : Math.min(api.tab, 2);
    return tab === 0 ? api.t('compas.v5.sac.tabBag') : tab === 1 ? api.t('compas.v5.sac.tabKits') : api.t('compas.v5.sac.tabCarry');
  },
  subtitle: (api) => {
    const tab = api.solo ? Math.min(api.tab, 1) : Math.min(api.tab, 2);
    const { model } = api.data;
    if (tab === 0) {
      const mine = myLines(api.ctl.lines, api.data.viewerId, new Set(model.crew.loads.map((l) => l.userId)));
      return countText(api.t, api.locale, mine.length, 'compas.v5.sac.subItemsOne', 'compas.v5.sac.subItemsOther');
    }
    if (tab === 2) {
      const shared = api.ctl.lines.filter((l) => l.shared && l.kind !== 'worn').length;
      return countText(api.t, api.locale, shared, 'compas.v5.sac.subSharedOne', 'compas.v5.sac.subSharedOther');
    }
    return null;
  },
  Body: SacBody,
};
