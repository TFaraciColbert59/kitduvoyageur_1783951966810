'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { shopRelevance } from '../engine/shopMatch';
import {
  compasAnswerApplicantAction,
  compasBottleStateAction,
  compasCloseBottleAction,
  compasLaunchBottleAction,
  type CompasBottleApplicant,
  type CompasBottleState,
} from '../server/bottleActions';
import Icon from '@/components/ui/Icon';
import { addToCart } from '@/lib/cart';
import {
  addCustomTripItemAction,
  addInventoryItemToTripAction,
  deleteTripItemAction,
} from '@/app/voyages/kit-actions';
import type { CompasKitLine, CompasStepId } from '../engine/compasModel';
import { formatDuration, weatherLabel } from '../engine/format';
import { fr } from '@/lib/i18n/translations';
import { t as translate, type TranslationKey } from '@/lib/i18n/translate';
import { rich, useSheetsI18n, type SheetsT } from './sheetsI18n';
import type { CompasData, CompasShopProduct } from '../server/getCompasData';
import {
  compasAddInventoryItemAction,
  compasAddShopProductToTripAction,
  compasMarkReturnedAction,
  compasPickShopProductAction,
  compasSetBudgetAction,
  compasSetCarrierAction,
  compasApplyKitAction,
  compasListMyKitsAction,
  compasCreateKitFromTripAction,
  compasSetPartySizeAction,
  compasSearchStaysAction,
  compasSetStayAction,
  compasExplainVerdictAction,
} from '../server/compasActions';
import { BudgetAlso, KitRow, LIVE_BOOKING, MemberAvatar, lineStatus, verticalOf } from './CompasCards';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import {
  ROUTE_POI_LABEL,
  countByCategory,
  poiLabel,
  type RoutePoiCategory,
} from '../engine/routePois';
import type { CompasStayOffer } from '../engine/stays';
import { kitCompatibility, planKitApply, type MyKit } from '../engine/kitApply';
import { acquireOverview, priceText, productsFor, weightDelta } from '../engine/acquire';
import { convertFromEur } from '../engine/currency';
import {
  Chip,
  DoubleTapRow,
  PagedList,
  Segments,
  Thumb,
  useDoubleTap,
  useTextFilter,
} from './CompasPrimitives';
import { DisLe } from './CompasDisLe';
import { alertsGapOf } from '../engine/danger';
import { proposeShift, watchRules } from '../engine/watch';
import { isMeteoalarmSource } from '../engine/meteoalarmFeeds';
import MeteoalarmNotice from './MeteoalarmNotice';
import OfficialAlertTexts from './OfficialAlertTexts';
import { RiskBars } from './CompasRisks';
import { ItemHistory } from './CompasItemHistory';
import { planWater } from '../engine/water';
import { addExpenseAction } from '@/app/voyages/budget-actions';
import { RESA_CATS, bookingCat, offerCat, type ResaCat } from '../engine/resaCats';
import { RESA_EXAMPLES, type CompasLiveVertical } from '../engine/resaExamples';
import { teamCount, teamCountLabel } from '../engine/team';
import { HUB_GROUP_PATH, memberView, memberViews } from '../engine/crewView';
import {
  HubGroupLink,
  LoadBar,
  MemberRow,
  MemberTags,
  PendingRow,
  memberFacts,
} from './CompasMembers';
import { compasSearchOffersAction } from '../server/resaActions';
import { KIT_THRESHOLDS } from '../engine/kitRules';
import { browserToday } from '../engine/zone';
import { inverseOps, runOps } from './compasApply';
import type { ApplyOp } from '../engine/intent';
import { ActiviteFlow, ParcoursFlow, PreferencesFlow, QuandFlow } from './CompasOuFlows';
import {
  STEP_FLOWS,
  type AcquireMode,
  type CompasCtl,
  type FlowHint,
  type SheetState,
  type StepFlow,
} from './compasTypes';

/* ---------- Titre de chaque tiroir ---------- */

/** « Verdict » et « Kit » s'écrivent pareil en anglais : pas de clé (la parité FR/EN l'interdit). */
const STEP_SHEET_TITLES: Record<CompasStepId, TranslationKey | { same: string }> = {
  ou: 'compas.sheets.title.ou',
  nous: 'compas.sheets.title.nous',
  resa: 'compas.sheets.title.resa',
  verdict: { same: 'Verdict' },
  kit: { same: 'Kit' },
};

/** Traduction française par défaut : l'appel historique `sheetTitle(sheet, ctl)` reste en français. */
const frT: SheetsT = (key, vars) => translate(fr, key, vars);

/** « · texte » : séparateur d'une précision ajoutée en fin de ligne. */
const dot = (text: string) => ` · ${text}`;

/**
 * Titre du tiroir. `t` vient de `useTranslation()` chez l'appelant (fonction pure, pas un hook) ;
 * sans `t`, le titre est en français, comme avant.
 */
export function sheetTitle(sheet: SheetState, ctl: CompasCtl, t: SheetsT = frT): string {
  const line = 'lineId' in sheet ? ctl.lines.find((l) => l.id === sheet.lineId) : undefined;
  switch (sheet.kind) {
    case 'item':
      return line?.name ?? t('compas.sheets.title.item');
    case 'acquire':
      return line
        ? t('compas.sheets.title.acquireOf', { name: line.name })
        : t('compas.sheets.title.acquire');
    case 'add':
      return sheet.target === 'kit'
        ? t('compas.sheets.common.addToKit')
        : t('compas.sheets.common.addToInventory');
    case 'bag':
      return sheet.userId === ctl.data.viewerId
        ? t('compas.sheets.title.myBag')
        : t('compas.sheets.title.bagOf', { name: ctl.memberName(sheet.userId) });
    case 'carrier':
      return line
        ? t('compas.sheets.title.carrierOf', { name: line.name })
        : t('compas.sheets.title.carrier');
    case 'step': {
      const title = STEP_SHEET_TITLES[sheet.step];
      return typeof title === 'string' ? t(title) : title.same;
    }
  }
}

export function SheetContent({ sheet, ctl }: { sheet: SheetState; ctl: CompasCtl }) {
  switch (sheet.kind) {
    case 'item':
      return <ItemSheet ctl={ctl} lineId={sheet.lineId} />;
    case 'acquire':
      return <AcquireSheet ctl={ctl} lineId={sheet.lineId} initialMode={sheet.mode} />;
    case 'add':
      return <AddSheet ctl={ctl} target={sheet.target} suggest={sheet.suggest} />;
    case 'bag':
      return <BagSheet ctl={ctl} userId={sheet.userId} />;
    case 'carrier':
      return <CarrierSheet ctl={ctl} lineId={sheet.lineId} />;
    case 'step':
      return <StepSheet ctl={ctl} step={sheet.step} flow={sheet.flow} hint={sheet.hint} />;
  }
}

function Missing() {
  const { t } = useSheetsI18n();
  return <p className="cp-note">{t('compas.sheets.item.missing')}</p>;
}

/* ---------- Fiche objet (appui long = tout, en grand) ---------- */

function ItemSheet({ ctl, lineId }: { ctl: CompasCtl; lineId: string }) {
  const line = ctl.lines.find((l) => l.id === lineId);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<'fiche' | 'historique'>('fiche');
  const { t, kg, money } = useSheetsI18n();
  if (!line) return <Missing />;
  const product = ctl.product(line.shopProductId);
  const inv = line.inventoryItemId
    ? ctl.data.inventory.find((i) => i.id === line.inventoryItemId)
    : undefined;
  const status = lineStatus(line);
  const { slug } = ctl.data.model;
  const edit = ctl.data.canEdit;

  return (
    <>
      <Segments
        label={t('compas.sheets.item.tabs')}
        value={tab}
        onChange={setTab}
        options={[
          { id: 'fiche', label: t('compas.sheets.item.tabSheet'), icon: 'package' },
          { id: 'historique', label: t('compas.sheets.item.tabHistory'), icon: 'clock' },
        ]}
      />
      {tab === 'historique' ? (
        <ItemHistory tripId={ctl.data.model.tripId} line={line} data={ctl.data} />
      ) : (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Thumb
          large
          image={product?.image}
          alt={product?.imageAlt}
          category={line.category}
          name={line.name}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
          <Chip tone={status.tone}>{status.label}</Chip>
          {line.vital && (
            <Chip tone="bad" icon="shield-alert">
              {t('compas.sheets.item.vital')}
            </Chip>
          )}
          <Chip tone="soft">
            {line.shared ? t('compas.sheets.item.shared') : t('compas.sheets.common.personal')}
          </Chip>
          {line.kind !== 'base' && (
            <Chip>
              {line.kind === 'worn'
                ? t('compas.sheets.item.worn')
                : t('compas.sheets.item.consumable')}
            </Chip>
          )}
          {line.packed && (
            <Chip tone="good" icon="check">
              {t('compas.sheets.item.packed')}
            </Chip>
          )}
        </div>
      </div>
      <dl className="cp-kv">
        <dt>{t('compas.sheets.item.weight')}</dt>
        <dd>
          {line.weightGrams == null
            ? t('compas.sheets.common.toWeigh')
            : `${kg(line.weightGrams)}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
        </dd>
        <dt>{t('compas.sheets.title.carrier')}</dt>
        <dd>
          {line.ownerId
            ? ctl.memberName(line.ownerId)
            : line.shared
              ? t('compas.sheets.item.nobodyYet')
              : t('compas.sheets.item.eachOwn')}
        </dd>
        {inv && (
          <>
            <dt>{t('compas.sheets.common.inventory')}</dt>
            <dd>{[inv.brand, inv.name].filter(Boolean).join(' ')}</dd>
          </>
        )}
        {product && (
          <>
            <dt>{t('compas.sheets.item.chosenProduct')}</dt>
            <dd>
              {[product.brand, product.name].filter(Boolean).join(' ')}
              {product.priceEur != null ? ` · ${money(product.priceEur)}` : ''}
            </dd>
          </>
        )}
        {line.condition && (
          <>
            <dt>{t('compas.sheets.item.condition')}</dt>
            <dd>{line.condition.replace('_', ' ')}</dd>
          </>
        )}
        {line.reason && (
          <>
            <dt>{t('compas.sheets.item.reason')}</dt>
            <dd title={line.reason}>{line.reason}</dd>
          </>
        )}
      </dl>
      {edit && (
        <div className="cp-actions">
          <button
            type="button"
            className="cp-btn cp-btn--pg"
            onClick={() => ctl.togglePacked(line)}
          >
            <Icon name={line.packed ? 'rotate-ccw' : 'check'} size={16} />
            {line.packed ? t('compas.sheets.item.unpack') : t('compas.sheets.item.pack')}
          </button>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            onClick={() => ctl.open({ kind: 'carrier', lineId: line.id })}
          >
            <Icon name="user-plus" size={16} />
            {t('compas.sheets.title.carrier')}
          </button>
        </div>
      )}
      {line.status === 'lent' && inv && (
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={ctl.busy}
          onClick={() =>
            ctl.run(t('compas.sheets.item.returned', { name: inv.name }), () =>
              compasMarkReturnedAction({ inventoryItemId: inv.id })
            )
          }
        >
          <Icon name="archive-restore" size={16} />
          {t('compas.sheets.item.gotBack')}
        </button>
      )}
      {edit && line.status !== 'owned' && (
        <div className="cp-seg" role="group" aria-label={t('compas.sheets.item.find')}>
          {(
            [
              { id: 'emprunter', label: t('compas.sheets.common.borrow'), icon: 'handshake' },
              { id: 'louer', label: t('compas.sheets.common.rent'), icon: 'calendar-days' },
              { id: 'acheter', label: t('compas.sheets.common.buy'), icon: 'shopping-bag' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={false}
              onClick={() => ctl.open({ kind: 'acquire', lineId: line.id, mode: m.id })}
            >
              <Icon name={m.icon} size={15} aria-hidden="true" />
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div className="cp-actions">
        {product?.slug && (
          <Link className="cp-btn" href={`/produit/${product.slug}`}>
            <Icon name="external-link" size={16} />
            {t('compas.sheets.item.productPage')}
          </Link>
        )}
        {edit &&
          (confirm ? (
            <>
              <button
                type="button"
                className="cp-btn cp-btn--bad"
                disabled={ctl.busy}
                onClick={async () => {
                  const ok = await ctl.run(t('compas.sheets.item.removed'), () =>
                    deleteTripItemAction(line.id, slug)
                  );
                  if (ok) ctl.back();
                }}
              >
                <Icon name="trash2" size={16} />
                {t('compas.sheets.item.confirmRemove')}
              </button>
              <button type="button" className="cp-btn" onClick={() => setConfirm(false)}>
                {t('compas.sheets.common.cancel')}
              </button>
            </>
          ) : (
            <button type="button" className="cp-btn" onClick={() => setConfirm(true)}>
              <Icon name="trash2" size={16} />
              {t('compas.sheets.item.remove')}
            </button>
          ))}
      </div>
    </>
      )}
    </>
  );
}

/* ---------- Emprunter / Louer / Acheter : l'objet précis ---------- */

/** Pertinence d'un produit pour un objet du kit : mots communs, catégorie. */
const relevance = (line: CompasKitLine, p: CompasShopProduct) => shopRelevance(line, p);

function ProductRow({
  product,
  action,
  onAction,
  disabled,
  days,
  plannedG,
}: {
  product: CompasShopProduct;
  action: string;
  onAction: () => void;
  disabled?: boolean;
  /** Jours datés du voyage (null : non datés) ; absent : prix tel quel (ajout depuis la boutique). */
  days?: number | null;
  /** Poids de l'objet prévu, pour dire l'écart ; absent ou null : pas d'écart. */
  plannedG?: number | null;
}) {
  const { t, locale, kg, money, num, pl } = useSheetsI18n();
  const tap = useDoubleTap(() => {
    if (!disabled) onAction();
  });
  const price =
    days !== undefined
      ? priceText(product, days)
      : product.mode === 'location' && product.pricePerDay != null
        ? t('compas.sheets.product.perDay', { price: money(product.pricePerDay) })
        : money(product.priceEur);
  const delta = plannedG === undefined ? null : weightDelta(plannedG, product.weightG);
  return (
    <div
      className="cp-row"
      style={{ cursor: 'default' }}
      title={
        disabled
          ? undefined
          : t('compas.sheets.product.doubleTap', { action: action.toLocaleLowerCase(locale) })
      }
      {...tap}
    >
      <Thumb
        image={product.image}
        alt={product.imageAlt}
        category={product.category}
        name={product.name}
      />
      <span className="cp-row__t cp-row__t--wrap">
        <b>
          {product.mode === 'occasion'
            ? t('compas.sheets.product.used', { name: product.name })
            : product.name}
        </b>
        <span>
          {[product.brand, product.weightG != null ? kg(product.weightG) : null, price]
            .filter(Boolean)
            .join(' · ')}
          {/* Une note sans avis n'est pas une note : « ★ 0 » laissait croire à un produit mal noté. */}
          {product.rating != null && (product.reviewCount ?? 0) > 0
            ? ` · ${pl(
                product.reviewCount ?? 0,
                'compas.sheets.product.reviewsOne',
                'compas.sheets.product.reviewsOther',
                { rating: num(product.rating), count: String(product.reviewCount) }
              )}`
            : ''}
        </span>
        {delta && <span>{delta.text}</span>}
      </span>
      <span className="cp-row__end">
        {product.slug && (
          <Link
            className="cp-ibtn cp-ibtn--tap"
            href={`/produit/${product.slug}`}
            aria-label={t('compas.sheets.product.pageOf', { name: product.name })}
          >
            <Icon name="external-link" size={16} aria-hidden="true" />
          </Link>
        )}
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={disabled}
          onClick={onAction}
        >
          {action}
        </button>
      </span>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="cp-field">
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function AcquireSheet({
  ctl,
  lineId,
  initialMode,
}: {
  ctl: CompasCtl;
  lineId: string;
  initialMode: AcquireMode;
}) {
  const line = ctl.lines.find((l) => l.id === lineId);
  const { t, kg } = useSheetsI18n();
  const [mode, setMode] = useState<AcquireMode>(initialMode);
  const { query, setQuery, matches } = useTextFilter();
  const { tripId, slug, dates } = ctl.data.model;
  const days = dates.days;
  const teammates = ctl.data.model.crew.loads.filter((m) => m.userId !== ctl.data.viewerId);

  const products = useMemo(() => {
    if (!line || mode === 'emprunter') return [];
    return productsFor(ctl.data.shop, mode)
      .map((p) => ({ p, score: relevance(line, p) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [ctl.data.shop, line, mode]);
  const shown = products.filter((p) => matches(p.name, p.brand, p.category));
  const overview = useMemo(
    () => acquireOverview({ shop: ctl.data.shop, teammates: teammates.length, days }),
    [ctl.data.shop, teammates.length, days]
  );
  const counts = useMemo(
    () => ({
      louer: productsFor(ctl.data.shop, 'louer').length,
      acheter: productsFor(ctl.data.shop, 'acheter').length,
    }),
    [ctl.data.shop]
  );

  if (!line) return <Missing />;

  return (
    <>
      <Segments
        label={t('compas.sheets.acquire.modes')}
        value={mode}
        onChange={setMode}
        options={[
          {
            id: 'emprunter',
            label: `${t('compas.sheets.common.borrow')} · ${teammates.length}`,
            icon: 'handshake',
          },
          {
            id: 'louer',
            label: `${t('compas.sheets.common.rent')} · ${counts.louer}`,
            icon: 'calendar-days',
          },
          {
            id: 'acheter',
            label: `${t('compas.sheets.common.buy')} · ${counts.acheter}`,
            icon: 'shopping-bag',
          },
        ]}
      />
      <p className="cp-note" data-testid="acquire-overview">
        {overview[mode]}
      </p>
      {mode === 'emprunter' ? (
        <>
          <p className="cp-note">{t('compas.sheets.acquire.borrowNote')}</p>
          <PagedList
            label={t('compas.sheets.common.team')}
            items={teammates}
            empty={
              <p className="cp-note">
                {t('compas.sheets.acquire.noTeammates')}{' '}
                <Link className="cp-linkbtn" href={HUB_GROUP_PATH}>
                  {t('compas.sheets.acquire.inviteHub')}
                </Link>
              </p>
            }
            render={(m) => (
              <div key={m.userId} className="cp-row" style={{ cursor: 'default' }}>
                <MemberAvatar name={m.name} url={m.avatarUrl} />
                <span className="cp-row__t">
                  <b>{m.name}</b>
                  <span>
                    {t('compas.sheets.acquire.carriesAlready', { weight: kg(m.carriedGrams) })}
                  </span>
                </span>
                <span className="cp-row__end">
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    disabled={ctl.busy}
                    onClick={async () => {
                      const msg = t('compas.sheets.acquire.carries', {
                        name: m.name,
                        item: line.name,
                      });
                      const ok = await ctl.run(msg, () =>
                        compasSetCarrierAction({
                          tripId,
                          tripSlug: slug,
                          itemId: line.id,
                          carrierId: m.userId,
                          shared: true,
                        })
                      );
                      if (ok) ctl.back();
                    }}
                  >
                    {t('compas.sheets.common.borrow')}
                  </button>
                </span>
              </div>
            )}
          />
        </>
      ) : (
        <>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={
              mode === 'louer'
                ? t('compas.sheets.acquire.searchRental')
                : t('compas.sheets.acquire.searchProduct')
            }
          />
          <PagedList
            label={
              mode === 'louer'
                ? t('compas.sheets.acquire.rentals')
                : t('compas.sheets.acquire.products')
            }
            resetKey={`${mode}-${query}`}
            items={shown}
            empty={
              <p className="cp-note">
                {mode === 'louer' ? (
                  <>
                    {t('compas.sheets.acquire.noRental')}{' '}
                    <Link href="/location">{t('compas.sheets.acquire.seeRental')}</Link>
                  </>
                ) : (
                  t('compas.sheets.common.noProductMatch')
                )}
              </p>
            }
            render={(p) => (
              <ProductRow
                key={p.id}
                product={p}
                days={days}
                plannedG={line.weightGrams}
                action={
                  line.shopProductId === p.id
                    ? t('compas.sheets.acquire.chosen')
                    : t('compas.sheets.acquire.choose')
                }
                disabled={ctl.busy || line.shopProductId === p.id}
                onAction={async () => {
                  const ok = await ctl.run(t('compas.sheets.acquire.picked'), () =>
                    compasPickShopProductAction({
                      tripId,
                      tripSlug: slug,
                      itemId: line.id,
                      shopProductId: p.id,
                    })
                  );
                  if (ok && p.slug && p.priceEur != null) {
                    addToCart({
                      id: p.id,
                      slug: p.slug,
                      name: p.name,
                      brand: p.brand ?? '',
                      priceEur: p.priceEur,
                      weightG: p.weightG ?? 0,
                      image: p.image ?? '',
                      imageAlt: p.imageAlt ?? p.name,
                      category: p.category ?? '',
                    });
                  }
                }}
              />
            )}
          />
          <p className="cp-note">{t('compas.sheets.acquire.payNote')}</p>
          <div className="cp-actions">
            <Link className="cp-btn cp-btn--soft" href="/panier">
              <Icon name="shopping-cart" size={16} />
              {t('compas.sheets.acquire.seeCart')}
            </Link>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Ajouter : inventaire, boutique, objet libre ---------- */

/**
 * Catégories d'un objet libre. Le libellé affiché suit la langue ; la catégorie ENREGISTRÉE
 * dans l'inventaire reste le libellé français (donnée partagée avec le reste du site).
 */
const CATEGORIES = [
  { id: 'safety', key: 'compas.sheets.category.safety' },
  { id: 'shelter', key: 'compas.sheets.category.shelter' },
  { id: 'sleep', key: 'compas.sheets.category.sleep' },
  { id: 'clothing', key: 'compas.sheets.category.clothing' },
  { id: 'cook', key: 'compas.sheets.category.cook' },
  { id: 'water', key: 'compas.sheets.category.water' },
  { id: 'tech', key: 'compas.sheets.category.tech' },
  { id: 'misc', key: 'compas.sheets.category.misc' },
] as const satisfies ReadonlyArray<{ id: string; key: TranslationKey }>;

type AddSource = 'inventaire' | 'boutique' | 'libre';

function AddSheet({
  ctl,
  target,
  suggest,
}: {
  ctl: CompasCtl;
  target: 'kit' | 'inventaire';
  suggest?: { query: string; name: string };
}) {
  const { t, kg } = useSheetsI18n();
  const [source, setSource] = useState<AddSource>(
    target === 'kit' && ctl.data.inventory.length ? 'inventaire' : 'boutique'
  );
  const { query, setQuery, matches } = useTextFilter(suggest?.query ?? '');
  const { tripId, slug } = ctl.data.model;
  const inKit = useMemo(
    () => new Set(ctl.lines.map((l) => l.inventoryItemId).filter(Boolean)),
    [ctl.lines]
  );
  const inventory = ctl.data.inventory.filter(
    (i) => !inKit.has(i.id) && matches(i.name, i.brand, i.category)
  );
  const shop = ctl.data.shop.filter((p) => matches(p.name, p.brand, p.category));

  const options =
    target === 'kit'
      ? ([
          { id: 'inventaire', label: t('compas.sheets.common.inventory'), icon: 'archive' },
          { id: 'boutique', label: t('compas.sheets.add.shop'), icon: 'shopping-bag' },
          { id: 'libre', label: t('compas.sheets.add.other'), icon: 'plus' }, // i18n-ok : icône
        ] as const)
      : ([
          { id: 'boutique', label: t('compas.sheets.add.shop'), icon: 'shopping-bag' },
          { id: 'libre', label: t('compas.sheets.add.other'), icon: 'plus' }, // i18n-ok : icône
        ] as const);

  return (
    <>
      {/* « Source » : même mot en anglais. */}
      <Segments label="Source" value={source} onChange={setSource} options={options} />
      {source !== 'libre' && (
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t('compas.sheets.common.search')}
        />
      )}
      {source === 'inventaire' && (
        <PagedList
          label={t('compas.sheets.common.myInventory')}
          resetKey={query}
          items={inventory}
          empty={
            <p className="cp-note">
              {ctl.data.inventory.length
                ? t('compas.sheets.add.allInKit')
                : t('compas.sheets.common.inventoryEmpty')}{' '}
              <button
                type="button"
                className="cp-linkbtn"
                onClick={() => ctl.open({ kind: 'add', target: 'inventaire' })}
              >
                {t('compas.sheets.common.addToInventory')}
              </button>
            </p>
          }
          render={(i) => (
            <div key={i.id} className="cp-row" style={{ cursor: 'default' }}>
              <Thumb category={i.category} name={i.name} />
              <span className="cp-row__t">
                <b>{i.name}</b>
                <span>
                  {[
                    i.brand,
                    i.weightG != null ? kg(i.weightG) : t('compas.sheets.common.toWeigh'),
                    i.isLent ? t('compas.sheets.common.lent') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="cp-row__end">
                <button
                  type="button"
                  className="cp-btn cp-btn--soft"
                  disabled={ctl.busy}
                  onClick={() =>
                    ctl.run(t('compas.sheets.common.addedToKit', { name: i.name }), () =>
                      addInventoryItemToTripAction(
                        tripId,
                        slug,
                        i.id,
                        i.name,
                        i.category ?? undefined,
                        i.weightG ?? undefined
                      )
                    )
                  }
                >
                  {t('compas.sheets.common.add')}
                </button>
              </span>
            </div>
          )}
        />
      )}
      {source === 'boutique' && (
        <PagedList
          label={t('compas.sheets.add.shop')}
          resetKey={query}
          items={shop}
          empty={
            <p className="cp-note">
              {query.trim()
                ? t('compas.sheets.add.noMatchQuery', { query: query.trim() })
                : t('compas.sheets.common.noProductMatch')}{' '}
              {query.trim() && (
                <button type="button" className="cp-linkbtn" onClick={() => setQuery('')}>
                  {t('compas.sheets.add.seeAllShop')}
                </button>
              )}
            </p>
          }
          render={(p) => (
            <ProductRow
              key={p.id}
              product={p}
              action={t('compas.sheets.common.add')}
              disabled={ctl.busy}
              onAction={() =>
                target === 'kit'
                  ? ctl.run(t('compas.sheets.common.addedToKit', { name: p.name }), () =>
                      compasAddShopProductToTripAction({
                        tripId,
                        tripSlug: slug,
                        shopProductId: p.id,
                      })
                    )
                  : ctl.run(t('compas.sheets.common.addedToInventory', { name: p.name }), () =>
                      compasAddInventoryItemAction({ name: p.name, fromShopProductId: p.id })
                    )
              }
            />
          )}
        />
      )}
      {source === 'libre' && <FreeItemForm ctl={ctl} target={target} defaultName={suggest?.name} />}
    </>
  );
}

function FreeItemForm({
  ctl,
  target,
  defaultName,
}: {
  ctl: CompasCtl;
  target: 'kit' | 'inventaire';
  defaultName?: string;
}) {
  const { t } = useSheetsI18n();
  const { tripId, slug } = ctl.data.model;
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('itemName') ?? '').trim();
    const weight = Number(fd.get('weightGrams'));
    let ok: boolean;
    if (target === 'kit') {
      fd.set('isVital', fd.get('isVital') ? 'true' : 'false');
      fd.set('isWorn', 'false');
      fd.set('isConsumable', fd.get('isConsumable') ? 'true' : 'false');
      fd.set('quantity', String(Math.max(1, Number(fd.get('quantity')) || 1)));
      ok = await ctl.run(t('compas.sheets.common.addedToKit', { name }), () =>
        addCustomTripItemAction(tripId, slug, fd)
      );
    } else {
      const found = CATEGORIES.find((c) => c.id === fd.get('category'));
      // Donnée de l'inventaire : toujours le libellé français, quelle que soit la langue affichée.
      const cat = found ? frT(found.key) : undefined;
      ok = await ctl.run(t('compas.sheets.common.addedToInventory', { name }), () =>
        compasAddInventoryItemAction({
          name,
          category: cat,
          weightG: weight > 0 ? Math.round(weight) : null,
        })
      );
    }
    if (ok) form.reset();
  };
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="cp-field">
        {t('compas.sheets.common.name')}
        <input
          name="itemName"
          required
          maxLength={160}
          autoComplete="off"
          defaultValue={defaultName}
        />
      </label>
      <div className="cp-grid2">
        <label className="cp-field">
          {t('compas.sheets.common.category')}
          <select name="category" defaultValue="misc">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field">
          {t('compas.sheets.add.weight')}
          <input name="weightGrams" type="number" inputMode="numeric" min={1} max={1000000} />
        </label>
      </div>
      {target === 'kit' && (
        <div className="cp-actions">
          <label className="cp-check">
            <input type="checkbox" name="isVital" /> {t('compas.sheets.item.vital')}
          </label>
          <label className="cp-check">
            <input type="checkbox" name="isConsumable" /> {t('compas.sheets.item.consumable')}
          </label>
          <label className="cp-field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            {t('compas.sheets.add.quantity')}
            <input
              name="quantity"
              type="number"
              min={1}
              max={999}
              defaultValue={1}
              style={{ width: 72 }}
            />
          </label>
        </div>
      )}
      <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
        <Icon name="plus" size={16} />
        {t('compas.sheets.common.add')}
      </button>
    </form>
  );
}

/* ---------- Sac d'une personne ---------- */

function BagSheet({ ctl, userId }: { ctl: CompasCtl; userId: string }) {
  const load = ctl.data.model.crew.loads.find((l) => l.userId === userId);
  const lines = useMemo(() => {
    const shared = new Set(load?.sharedItemIds ?? []);
    return ctl.lines.filter(
      (l) => shared.has(l.id) || (!l.shared && (l.ownerId === userId || l.ownerId == null))
    );
  }, [ctl.lines, load, userId]);
  const { t, kg } = useSheetsI18n();
  if (!load) return <p className="cp-note">{t('compas.sheets.bag.gone')}</p>;
  const view = memberView(load, ctl.data.model.ownerId);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MemberAvatar name={load.name} url={load.avatarUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{kg(load.carriedGrams)}</b>
          <span className="cp-note">
            {' '}
            {view.load.limit
              ? view.load.limitNote
                ? t('compas.sheets.bag.limitNote', {
                    limit: view.load.limit,
                    note: view.load.limitNote,
                  })
                : t('compas.sheets.bag.limit', { limit: view.load.limit })
              : `· ${t('compas.sheets.common.capacityUnknown')}`}
          </span>
          <LoadBar load={view.load} />
        </div>
      </div>
      <p className="cp-row__t cp-mem__facts">
        <MemberTags view={view} />
        <span>{memberFacts(view)}</span>
      </p>
      <PagedList
        label={t('compas.sheets.bag.contents')}
        items={lines}
        empty={<p className="cp-note">{t('compas.sheets.bag.empty')}</p>}
        render={(line) => <KitRow key={line.id} line={line} ctl={ctl} />}
      />
    </>
  );
}

/* ---------- Porteur ---------- */

function CarrierSheet({ ctl, lineId }: { ctl: CompasCtl; lineId: string }) {
  const line = ctl.lines.find((l) => l.id === lineId);
  const [shared, setShared] = useState(line?.shared ?? true);
  const { t, kg } = useSheetsI18n();
  if (!line) return <Missing />;
  const { tripId, slug } = ctl.data.model;
  const assign = async (carrierId: string | null) => {
    const ok = await ctl.run(
      carrierId
        ? t('compas.sheets.acquire.carries', { name: ctl.memberName(carrierId), item: line.name })
        : t('compas.sheets.carrier.none', { item: line.name }),
      () => compasSetCarrierAction({ tripId, tripSlug: slug, itemId: line.id, carrierId, shared })
    );
    if (ok) ctl.back();
  };
  return (
    <>
      <Segments
        label={t('compas.sheets.carrier.type')}
        value={shared ? 'commun' : 'perso'}
        onChange={(v) => setShared(v === 'commun')}
        options={[
          { id: 'commun', label: t('compas.sheets.carrier.sharedGroup'), icon: 'users' },
          { id: 'perso', label: t('compas.sheets.common.personal'), icon: 'user' },
        ]}
      />
      <PagedList
        label={t('compas.sheets.common.team')}
        items={ctl.data.model.crew.loads}
        render={(m) => (
          <button
            key={m.userId}
            type="button"
            className="cp-row"
            disabled={ctl.busy}
            onClick={() => assign(m.userId)}
          >
            <MemberAvatar name={m.name} url={m.avatarUrl} />
            <span className="cp-row__t">
              <b>
                {m.userId === ctl.data.viewerId
                  ? t('compas.sheets.common.withMe', { name: m.name })
                  : m.name}
              </b>
              <span>
                {m.capacityKg != null
                  ? t('compas.sheets.carrier.carriesOf', {
                      weight: kg(m.carriedGrams),
                      capacity: m.capacityKg,
                    })
                  : t('compas.sheets.carrier.carries', { weight: kg(m.carriedGrams) })}
              </span>
            </span>
            <span className="cp-row__end">
              {line.ownerId === m.userId && <Icon name="check" size={18} />}
            </span>
          </button>
        )}
      />
      {shared && (
        <button type="button" className="cp-btn" disabled={ctl.busy} onClick={() => assign(null)}>
          {t('compas.sheets.carrier.nobody')}
        </button>
      )}
    </>
  );
}

/* =============================================================================
   Tiroir d'une étape (≡) : ses parcours internes dans la même capsule que les
   étapes, puis la liste paginée. Tout vient des données réelles du voyage.
   ============================================================================= */

function StepSheet({
  ctl,
  step,
  flow,
  hint,
}: {
  ctl: CompasCtl;
  step: CompasStepId;
  flow: StepFlow;
  hint?: FlowHint;
}) {
  const { t } = useSheetsI18n();
  const flows = STEP_FLOWS[step];
  // Maquette finale : le tiroir se parcourt dans l'ordre, « Retour » et
  // « Suivant » au pied, de part et d'autre de « Dis-le ».
  const at = flows.findIndex((f) => f.id === flow);
  const before = at > 0 ? flows[at - 1] : null;
  const after = at >= 0 && at < flows.length - 1 ? flows[at + 1] : null;
  const prev = (
    <button
      type="button"
      className="cp-ibtn cp-glass cp-sheet__prev"
      disabled={!before}
      aria-label={
        before
          ? t('compas.sheets.step.prevOf', { label: before.label })
          : t('compas.sheets.step.prev')
      }
      title={before?.label}
      onClick={() => before && ctl.replace({ kind: 'step', step, flow: before.id as StepFlow })}
    >
      <Icon name="chevron-left" size={18} />
    </button>
  );
  const next = after ? (
    <button
      type="button"
      className="cp-btn cp-btn--pg cp-sheet__next"
      onClick={() => ctl.replace({ kind: 'step', step, flow: after.id as StepFlow })}
    >
      {t('compas.sheets.step.next')}
      <Icon name="chevron-right" size={16} />
    </button>
  ) : (
    <button type="button" className="cp-btn cp-btn--pg cp-sheet__next" onClick={() => ctl.close()}>
      {t('compas.sheets.step.finish')}
      <Icon name="check" size={16} />
    </button>
  );
  return (
    <>
      <Segments
        label={t('compas.sheets.step.flows')}
        value={flow}
        onChange={(f) => ctl.replace({ kind: 'step', step, flow: f })}
        options={flows.map((f) => ({ id: f.id as StepFlow, label: f.label, icon: f.icon }))}
      />
      {
        // Le contenu du parcours ouvert. Table plutôt qu'une suite de comparaisons : les
        // identifiants d'étapes et de parcours (« ou », « nuits », « tout »…) sont des clés
        // techniques, pas des textes à traduire.
        (FLOW_VIEWS[step] as FlowViews<CompasStepId>)[flow]?.({ ctl, flow, hint })
      }
      {ctl.data.canEdit ? (
        <DisLe
          key={hint?.say ?? 'disle'}
          ctl={ctl}
          initial={hint?.say}
          initialIsStart={hint?.start === true}
          before={prev}
          after={next}
        />
      ) : (
        <div className="cp-disle__row cp-disle__row--nav">
          {prev}
          {next}
        </div>
      )}
    </>
  );
}

type FlowProps = { ctl: CompasCtl; flow: StepFlow; hint?: FlowHint };
type FlowViews<S extends CompasStepId> = Partial<
  Record<StepFlow<S>, (p: FlowProps) => ReactNode>
>;

/** Parcours de la liste du kit (identifiants de `STEP_FLOWS.kit`). */
type KitListMode = Extract<StepFlow<'kit'>, 'trouver' | 'emballer' | 'tout'>; // i18n-ok : identifiants
const kitList = ({ ctl, flow }: FlowProps) => (
  <KitListFlow ctl={ctl} flow={flow as KitListMode} />
);

/** Ce qu'affiche chaque parcours de chaque étape (les clés sont celles de `STEP_FLOWS`). */
const FLOW_VIEWS: { [S in CompasStepId]: FlowViews<S> } = {
  ou: {
    activite: ({ ctl }) => <ActiviteFlow ctl={ctl} />,
    parcours: ({ ctl, hint }) => <ParcoursFlow key={hint?.query ?? 'p'} ctl={ctl} hint={hint} />,
    trace: ({ ctl }) => <TraceFlow ctl={ctl} />,
    sac: ({ ctl }) => <MesKitsFlow ctl={ctl} />,
    quand: ({ ctl, hint }) => <QuandFlow key={hint?.hours ?? 'q'} ctl={ctl} hint={hint} />,
    preferences: ({ ctl }) => <PreferencesFlow ctl={ctl} />,
  },
  nous: {
    equipe: ({ ctl }) => <EquipeFlow ctl={ctl} />,
    qui: ({ ctl }) => <QuiFlow ctl={ctl} />,
    budget: ({ ctl }) => <BudgetFlow ctl={ctl} />,
    annonce: ({ ctl }) => <AnnonceFlow ctl={ctl} />,
  },
  resa: {
    nuits: ({ ctl, hint }) => <NuitsFlow ctl={ctl} focusDay={hint?.day} />,
    reservations: ({ ctl }) => <ReservationsFlow ctl={ctl} />,
    offres: ({ ctl, hint }) => (
      <OffresFlow key={hint?.resa ?? 'all'} ctl={ctl} initialCat={hint?.resa} />
    ),
    etats: ({ ctl }) => <EtatsFlow ctl={ctl} />,
  },
  verdict: {
    raisons: ({ ctl }) => <RaisonsFlow ctl={ctl} />,
    meteo: ({ ctl }) => <MeteoFlow ctl={ctl} />,
    veille: ({ ctl }) => <VeilleFlow ctl={ctl} />,
    sources: ({ ctl }) => <SourcesFlow ctl={ctl} />,
  },
  kit: {
    conseils: ({ ctl }) => <ConseilsFlow ctl={ctl} />,
    'mes-kits': ({ ctl }) => <MesKitsFlow ctl={ctl} />,
    inventaire: ({ ctl }) => <InventaireFlow ctl={ctl} />,
    trouver: kitList,
    emballer: kitList,
    tout: kitList,
    sacs: ({ ctl }) => <SacsFlow ctl={ctl} />,
    eau: ({ ctl }) => <EauFlow ctl={ctl} />,
  },
};

const staticRow = { cursor: 'default' } as const;

function PartySize({ ctl }: { ctl: CompasCtl }) {
  const { t, pl, num } = useSheetsI18n();
  const { crew, tripId, slug } = ctl.data.model;
  const set = (n: number) =>
    void ctl.run(t('compas.sheets.party.updated'), () =>
      compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: n })
    );
  return (
    <div className="cp-between">
      <span className="cp-sub">
        {rich(
          pl(crew.size, 'compas.sheets.party.sizeOne', 'compas.sheets.party.sizeOther', {
            count: '{count}',
          }),
          { count: <b>{num(crew.size)}</b> }
        )}
        {crew.guests > 0
          ? ` · ${t('compas.sheets.party.guests', { count: num(crew.guests) })}`
          : ''}
      </span>
      {ctl.data.canEdit && (
        <span className="cp-actions" style={{ gap: 8 }}>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            aria-label={t('compas.sheets.party.less')}
            disabled={ctl.busy || crew.size <= Math.max(1, crew.loads.length)}
            onClick={() => set(crew.size - 1)}
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            aria-label={t('compas.sheets.party.more')}
            disabled={ctl.busy || crew.size >= 50}
            onClick={() => set(crew.size + 1)}
          >
            <Icon name="plus" size={16} />
          </button>
        </span>
      )}
    </div>
  );
}

function EquipeFlow({ ctl }: { ctl: CompasCtl }) {
  const { crew, ownerId } = ctl.data.model;
  const pending = ctl.data.pendingInvites ?? [];
  const slowest = crew.pace.slowest;
  const views = useMemo(() => memberViews(crew.loads, ownerId), [crew.loads, ownerId]);
  const count = teamCountLabel(teamCount(crew.size, crew.loads.length, pending.length));
  const { t, pl, num, decimal } = useSheetsI18n();
  return (
    <>
      <PartySize ctl={ctl} />
      <p className="cp-note">
        {slowest
          ? t('compas.sheets.team.pace', {
              name: slowest.name,
              speed: decimal(slowest.speedKmh),
              known: crew.pace.known,
              total: crew.pace.total,
            })
          : t('compas.sheets.team.noPace')}
      </p>
      <p className="cp-sub">
        <b>{t('compas.sheets.common.inTrip')}</b> · {count}
      </p>
      {/* Lignes hautes (rôle, niveau, charge) : le tiroir défile, la liste ne se pagine pas. */}
      <TallList
        label={t('compas.sheets.common.team')}
        items={views}
        empty={null}
        render={(v) => (
          <MemberRow
            key={v.userId}
            view={v}
            isViewer={v.userId === ctl.data.viewerId}
            onOpenBag={() => ctl.open({ kind: 'bag', userId: v.userId })}
          />
        )}
      />
      {pending.length > 0 && (
        <>
          <p className="cp-sub">
            <b>{t('compas.sheets.common.pendingTitle')}</b> · {t('compas.sheets.common.pendingSub')}
          </p>
          <TallList
            label={t('compas.sheets.common.pendingLabel')}
            items={pending}
            empty={null}
            render={(inv) => <PendingRow key={inv.id} invite={inv} />}
          />
        </>
      )}
      {crew.unassignedShared.length > 0 && (
        <button
          type="button"
          className="cp-alertline"
          onClick={() => ctl.open({ kind: 'step', step: 'kit', flow: 'sacs' })}
        >
          <Icon name="users" size={16} />
          <span className="cp-alertline__t">
            {pl(
              crew.unassignedShared.length,
              'compas.sheets.team.unassignedOne',
              'compas.sheets.team.unassignedOther',
              { count: num(crew.unassignedShared.length) }
            )}
          </span>
          <Icon name="chevron-right" size={14} />
        </button>
      )}
      <HubGroupLink />
    </>
  );
}


/**
 * Nous · Qui : QUI est dans le voyage, EN LECTURE (rôle, niveau, invitations sans réponse).
 * `/hub/groupe` est la seule source de vérité du groupe : inviter, changer un rôle ou retirer
 * quelqu'un se fait là-bas, jamais ici. Le Compas n'a aucune commande de gestion d'équipe, il renvoie.
 */
function QuiFlow({ ctl }: { ctl: CompasCtl }) {
  const { model, viewerId, canEdit } = ctl.data;
  const pending = ctl.data.pendingInvites ?? [];
  const views = useMemo(() => memberViews(model.crew.loads, model.ownerId), [model.crew.loads, model.ownerId]);
  const count = teamCountLabel(teamCount(model.crew.size, model.crew.loads.length, pending.length));
  const { t } = useSheetsI18n();
  return (
    <>
      <HubGroupLink />
      {!canEdit && <p className="cp-note">{t('compas.sheets.team.readOnly')}</p>}
      <p className="cp-sub">
        <b>{t('compas.sheets.common.inTrip')}</b> · {count}
      </p>
      <TallList
        label={t('compas.sheets.team.members')}
        items={views}
        empty={<p className="cp-note">{t('compas.sheets.common.nobodyYet')}</p>}
        render={(v) => (
          <div key={v.userId} className="cp-row cp-mem" style={staticRow}>
            <MemberAvatar name={v.name} url={v.avatarUrl} />
            <span className="cp-row__t">
              <b>
                {v.userId === viewerId ? t('compas.sheets.common.withMe', { name: v.name }) : v.name}
              </b>
              <MemberTags view={v} />
            </span>
          </div>
        )}
      />
      {pending.length > 0 && (
        <>
          <p className="cp-sub">
            <b>{t('compas.sheets.common.pendingTitle')}</b> · {t('compas.sheets.common.pendingSub')}
          </p>
          <TallList
            label={t('compas.sheets.common.pendingLabel')}
            items={pending}
            empty={null}
            render={(inv) => <PendingRow key={inv.id} invite={inv} />}
          />
        </>
      )}
    </>
  );
}

function SettlementBlock({ ctl }: { ctl: CompasCtl }) {
  const { crew, budget } = ctl.data.model;
  const st = crew.settlement;
  const { t, pl, money } = useSheetsI18n();
  if (!st.countedAmount && !st.excludedCount) return null;
  return (
    <>
      <p className="cp-sub">
        <b>{t('compas.sheets.settle.title')}</b> ·{' '}
        {t('compas.sheets.settle.sub', { amount: money(st.countedAmount, budget.currency) })}
      </p>
      {st.debts.length === 0 ? (
        <p className="cp-note">{t('compas.sheets.settle.balanced')}</p>
      ) : (
        <ul className="cp-props">
          {st.debts.map((d) => {
            const byYou = d.fromUserId === ctl.data.viewerId;
            return (
              <li key={`${d.fromUserId}-${d.toUserId}`}>
                {rich(
                  byYou ? t('compas.sheets.settle.debtByYou') : t('compas.sheets.settle.debt'),
                  {
                    amount: money(d.amount, budget.currency),
                    from: <b>{byYou ? t('compas.sheets.settle.you') : d.fromName}</b>,
                    to: (
                      <b>
                        {d.toUserId === ctl.data.viewerId
                          ? t('compas.sheets.settle.youTo')
                          : d.toName}
                      </b>
                    ),
                  }
                )}
              </li>
            );
          })}
        </ul>
      )}
      {st.excludedCount > 0 && (
        <p className="cp-note">
          {pl(
            st.excludedCount,
            'compas.sheets.settle.excludedOne',
            'compas.sheets.settle.excludedOther',
            { amount: money(st.excludedAmount, budget.currency) }
          )}
        </p>
      )}
    </>
  );
}

function BudgetFlow({ ctl }: { ctl: CompasCtl }) {
  const b = ctl.data.model.budget;
  const total = b.byCategory.reduce((sum, c) => sum + c.amount, 0);
  const { tripId, slug } = ctl.data.model;
  const { t, money } = useSheetsI18n();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get('amount') ?? '')
      .replace(',', '.')
      .trim();
    const amount = raw === '' ? null : Number(raw);
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      ctl.notify(t('compas.sheets.budget.invalid'), 'bad');
      return;
    }
    const before = ctl.data.model.budget.target;
    void ctl.run(
      amount == null ? t('compas.sheets.budget.removed') : t('compas.sheets.budget.saved'),
      () => compasSetBudgetAction({ tripId, tripSlug: slug, amount }),
      () => compasSetBudgetAction({ tripId, tripSlug: slug, amount: before })
    );
  };
  return (
    <>
      {ctl.data.canEdit && (
        <form onSubmit={onSubmit} className="cp-actions" style={{ alignItems: 'flex-end' }}>
          <label className="cp-field" style={{ flex: 1 }}>
            {t('compas.sheets.budget.field', { currency: b.currency })}
            <input
              key={b.target ?? 'vide'}
              name="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              defaultValue={b.target ?? ''}
              placeholder={t('compas.sheets.budget.placeholder')}
            />
          </label>
          <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
            {t('compas.sheets.budget.save')}
          </button>
        </form>
      )}
      <dl className="cp-kv">
        <dt>{t('compas.sheets.budget.envelope')}</dt>
        <dd>{b.target != null ? money(b.target, b.currency) : t('compas.sheets.budget.notSet')}</dd>
        <dt>{t('compas.sheets.budget.planned')}</dt>
        <dd>{money(b.planned, b.currency)}</dd>
        <dt>{t('compas.sheets.budget.spent')}</dt>
        <dd>{money(b.spent, b.currency)}</dd>
        <dt>{t('compas.sheets.budget.perPerson')}</dt>
        <dd>{money(b.perPerson, b.currency)}</dd>
      </dl>
      <BudgetAlso
        fx={ctl.data.budgetFx}
        currency={b.currency}
        items={[
          { label: t('compas.sheets.budget.alsoEnvelope'), amount: b.target },
          { label: t('compas.sheets.budget.alsoPlanned'), amount: b.planned },
          { label: t('compas.sheets.budget.alsoSpent'), amount: b.spent },
          { label: t('compas.sheets.budget.alsoPerPerson'), amount: b.perPerson },
        ]}
      />
      <FormalitiesLine formalities={ctl.data.formalities} />
      {ctl.data.canEdit && <ExpenseForm ctl={ctl} />}
      <SettlementBlock ctl={ctl} />
      <PagedList
        label={t('compas.sheets.budget.byCategory')}
        items={b.byCategory}
        empty={<p className="cp-note">{t('compas.sheets.budget.noExpense')}</p>}
        render={(c) => (
          <div key={c.category} className="cp-row" style={staticRow}>
            <span className="cp-thumb">
              <Icon name="coins" size={18} />
            </span>
            <span className="cp-row__t">
              <b>{c.category}</b>
              <span className="cp-bar" style={{ marginTop: 6 }}>
                <i style={{ width: `${total ? Math.round((c.amount / total) * 100) : 0}%` }} />
              </span>
            </span>
            <span className="cp-row__end">{money(c.amount, b.currency)}</span>
          </div>
        )}
      />
    </>
  );
}

/**
 * Les formalités d'entrée (visa, ESTA) de la personne qui regarde : calculées à la lecture avec SON
 * profil, jamais rangées sur le voyage (elles diraient sa nationalité), donc à part des catégories et
 * hors du total. La base dit d'où vient le chiffre.
 */
function FormalitiesLine({ formalities: f }: { formalities: CompasData['formalities'] }) {
  const { t, pl, money } = useSheetsI18n();
  if (!f) return null;
  return (
    <div data-testid="formalities-line">
      <div className="cp-row" style={staticRow}>
        <span className="cp-thumb">
          <Icon name="coins" size={18} />
        </span>
        <span className="cp-row__t">
          <b>{f.title}</b>
          <span className="cp-sub">
            {pl(f.party, 'compas.sheets.budget.formalitiesOne', 'compas.sheets.budget.formalitiesOther', {
              amount: money(f.perPerson, f.currency),
            })}
            {/* Le profil des autres membres est privé : le calcul suppose le même passeport pour tous. */}
            {f.party > 1 ? dot(t('compas.sheets.budget.sameNationality')) : ''}
          </span>
        </span>
        <span className="cp-row__end">{money(f.amount, f.currency)}</span>
      </div>
      <p className="cp-disc">{f.basis}</p>
    </div>
  );
}

/**
 * « + Ajouter une dépense » (maquette finale) : nom, montant, pour le groupe
 * ou par personne, prévue ou payée. « Par personne » est multiplié par la
 * taille réelle du groupe, et le total est affiché avant d'enregistrer.
 * Passe par l'action budget existante (permissions du voyage vérifiées).
 */
function ExpenseForm({ ctl }: { ctl: CompasCtl }) {
  const { tripId, slug, budget, crew } = ctl.data.model;
  const { t, pl, money } = useSheetsI18n();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<'groupe' | 'pers'>('groupe'); // i18n-ok : identifiants
  const [paid, setPaid] = useState<'prevue' | 'payee'>('prevue');
  const [amount, setAmount] = useState('');
  const value = Number(amount.replace(',', '.'));
  const total =
    Number.isFinite(value) && value > 0
      ? Math.round((unit === 'pers' ? value * crew.size : value) * 100) / 100
      : null;
  if (!open)
    return (
      <button type="button" className="cp-btn cp-btn--soft" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} />
        {t('compas.sheets.expense.open')}
      </button>
    );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title') ?? '').trim();
    if (title.length < 2 || total == null) {
      ctl.notify(t('compas.sheets.expense.invalid'), 'bad');
      return;
    }
    const fd = new FormData();
    fd.set('tripId', tripId);
    fd.set('tripSlug', slug);
    fd.set('title', title);
    fd.set('amount', String(total));
    fd.set('currency', budget.currency);
    fd.set('category', String(f.get('category') ?? 'divers'));
    fd.set('splitType', 'equal');
    fd.set('isPlanned', paid === 'prevue' ? 'true' : 'false');
    void ctl
      .run(t('compas.sheets.expense.added', { title }), () => addExpenseAction(null, fd))
      .then((ok) => {
        if (ok) {
          setOpen(false);
          setAmount('');
        }
      });
  };
  return (
    <form onSubmit={onSubmit} className="cp-expense">
      <label className="cp-field">
        {t('compas.sheets.common.name')}
        <input
          name="title"
          placeholder={t('compas.sheets.expense.placeholder')}
          maxLength={100}
          required
        />
      </label>
      <div className="cp-actions" style={{ alignItems: 'flex-end' }}>
        <label className="cp-field" style={{ flex: 1 }}>
          {t('compas.sheets.expense.amount', { currency: budget.currency })}
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="cp-field" style={{ flex: 1 }}>
          {t('compas.sheets.common.category')}
          <select name="category" defaultValue="divers">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {t(c.key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Segments
        label={t('compas.sheets.expense.forLabel')}
        value={unit}
        onChange={setUnit}
        options={[
          { id: 'groupe', label: t('compas.sheets.expense.group') }, // i18n-ok : identifiant
          { id: 'pers', label: t('compas.sheets.expense.perPerson') },
        ]}
      />
      <Segments
        label={t('compas.sheets.expense.state')}
        value={paid}
        onChange={setPaid}
        options={[
          { id: 'prevue', label: t('compas.sheets.expense.planned') },
          { id: 'payee', label: t('compas.sheets.expense.paidByMe') },
        ]}
      />
      <p className="cp-note">
        {total == null
          ? t('compas.sheets.expense.toEnter')
          : unit === 'pers'
            ? pl(
                crew.size,
                'compas.sheets.expense.perPersonTotalOne',
                'compas.sheets.expense.perPersonTotalOther',
                { amount: money(total, budget.currency) }
              )
            : t('compas.sheets.expense.total', { amount: money(total, budget.currency) })}
      </p>
      <div className="cp-actions">
        <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
          {t('compas.sheets.common.add')}
        </button>
        <button type="button" className="cp-btn" onClick={() => setOpen(false)}>
          {t('compas.sheets.common.cancel')}
        </button>
      </div>
    </form>
  );
}

/**
 * Catégories du budget : `value` est la valeur ENREGISTRÉE (mêmes valeurs que le Hub, en
 * français dans la base), `key` le libellé affiché dans la langue du site.
 */
const EXPENSE_CATEGORIES = [
  { value: 'hébergement', key: 'compas.sheets.expense.catLodging' }, // i18n-ok : valeur stockée
  { value: 'nourriture', key: 'compas.sheets.expense.catFood' },
  { value: 'transport', key: 'compas.sheets.expense.catTransport' },
  { value: 'activités', key: 'compas.sheets.expense.catActivities' }, // i18n-ok : valeur stockée
  { value: 'matériel', key: 'compas.sheets.expense.catGear' }, // i18n-ok : valeur stockée
  { value: 'divers', key: 'compas.sheets.expense.catMisc' },
] as const satisfies ReadonlyArray<{ value: string; key: TranslationKey }>;

/**
 * Annonce (maquette finale : publier pour trouver des compagnons). Dans LKDV,
 * c'est la « Bouteille à la mer » du pays (seuil de confiance, majorité,
 * frais annoncés, chaque profil validé) et la gestion du groupe reste au Hub :
 * le Compas y mène, il ne publie rien lui-même.
 */
/** Nom du pays dans la langue du site (« fr » → « France »), le code si inconnu. */
function countryLabel(code: string | null, locale: string, t: SheetsT): string {
  if (!code) return t('compas.sheets.common.notSet');
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

const MIXITE_LABEL = {
  all: 'compas.sheets.bottle.mixAll',
  women_only: 'compas.sheets.bottle.mixWomen',
  men_only: 'compas.sheets.bottle.mixMen',
} as const satisfies Record<string, TranslationKey>;

/**
 * Nous · Bouteille à la mer (maquette finale) : le tiroir où l'on règle
 * l'annonce — où (le pays du voyage), à qui (confiance minimale, mixité,
 * places), quand, le message — puis où l'on accepte ou refuse chaque
 * candidature. Une personne acceptée rejoint aussi le voyage.
 */
function AnnonceFlow({ ctl }: { ctl: CompasCtl }) {
  const { crew, dates, tripId, slug, title } = ctl.data.model;
  const { t, pl, locale, dayMonth } = useSheetsI18n();
  const free = Math.max(0, crew.size - crew.loads.length);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: string | null }
    | { status: 'ok'; data: CompasBottleState }
  >({ status: 'loading' });
  const [minTrust, setMinTrust] = useState(60);
  const [mixite, setMixite] = useState<'all' | 'women_only' | 'men_only'>('all');
  const [places, setPlaces] = useState(Math.max(2, Math.min(20, free + crew.loads.length || 4)));

  useEffect(() => {
    let alive = true;
    compasBottleStateAction({ tripId })
      .then((res) => {
        if (!alive) return;
        setState(
          res.success ? { status: 'ok', data: res.state } : { status: 'error', error: res.error }
        );
      })
      // `null` : connexion perdue, dit dans la langue au moment de l'afficher.
      .catch(() => alive && setState({ status: 'error', error: null }));
    return () => {
      alive = false;
    };
  }, [tripId, reload]);

  const launch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get('bottleAdult') !== 'on') {
      ctl.notify(t('compas.sheets.bottle.adult'), 'bad');
      return;
    }
    const date = (k: string) => {
      const v = String(fd.get(k) ?? '');
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    };
    const ok = await ctl.run(t('compas.sheets.bottle.launched'), () =>
      compasLaunchBottleAction({
        tripId,
        tripSlug: slug,
        name: String(fd.get('bottleName') ?? ''),
        description: String(fd.get('bottleMsg') ?? ''),
        departure: date('bottleFrom'),
        returnDate: date('bottleTo'),
        maxMembers: places,
        minTrust,
        mixite,
        isAdult: true,
      })
    );
    if (ok) {
      ctl.notify(
        t('compas.sheets.bottle.launched'),
        undefined,
        t('compas.sheets.bottle.launchedSub', { trust: minTrust })
      );
      setReload((n) => n + 1);
    }
  };

  const answer = async (groupId: string, a: CompasBottleApplicant, accept: boolean) => {
    const ok = await ctl.run(
      accept
        ? t('compas.sheets.bottle.joined', { name: a.name })
        : t('compas.sheets.bottle.refused', { name: a.name }),
      () =>
        compasAnswerApplicantAction({
          tripId,
          tripSlug: slug,
          groupId,
          memberId: a.memberId,
          accept,
        })
    );
    if (ok) setReload((n) => n + 1);
  };

  const st = state.status === 'ok' ? state.data : null;

  return (
    <>
      <div className="cp-row" style={staticRow}>
        <span className="cp-thumb">
          <Icon name="users" size={20} />
        </span>
        <span className="cp-row__t">
          <b>
            {pl(crew.loads.length, 'compas.sheets.bottle.membersOne', 'compas.sheets.bottle.membersOther')}{' '}
            {pl(crew.size, 'compas.sheets.bottle.plannedOne', 'compas.sheets.bottle.plannedOther')}
          </b>
          <span>
            {free > 0
              ? pl(free, 'compas.sheets.bottle.freeOne', 'compas.sheets.bottle.freeOther')
              : t('compas.sheets.bottle.full')}
            {dates.start
              ? ` · ${t('compas.sheets.bottle.departure', { date: dayMonth(dates.start) })}`
              : ''}
          </span>
        </span>
      </div>

      {state.status === 'loading' && (
        <p className="cp-note">{t('compas.sheets.bottle.loading')}</p>
      )}
      {state.status === 'error' && (
        <p className="cp-note" role="alert">
          {state.error ?? t('compas.sheets.common.lostConnection')}
        </p>
      )}

      {st?.bottles.map((b) => (
        <section
          key={b.id}
          className="cp-bottle cp-glass"
          aria-label={t('compas.sheets.bottle.aria', { name: b.name })}
        >
          <div className="cp-bottle__h">
            <b>{b.name}</b>
            <Chip tone="good">{t('compas.sheets.bottle.atSea')}</Chip>
          </div>
          <span className="cp-sub">
            {b.departure ? dayMonth(b.departure) : t('compas.sheets.bottle.freeDates')}
            {b.returnDate ? ` → ${dayMonth(b.returnDate)}` : ''} ·{' '}
            {t('compas.sheets.bottle.spec', {
              active: b.activeCount,
              max: b.maxMembers,
              trust: b.minTrust,
              mix: t(MIXITE_LABEL[b.mixite]),
            })}
          </span>
          {b.applicants.length === 0 ? (
            <p className="cp-note">{t('compas.sheets.bottle.noApplicants')}</p>
          ) : (
            b.applicants.map((a) => (
              <div key={a.memberId} className="cp-row" style={staticRow}>
                <MemberAvatar name={a.name} url={a.avatarUrl} />
                <span className="cp-row__t">
                  <b>{a.name}</b>
                  <span>
                    {a.trustScore != null
                      ? t('compas.sheets.bottle.trust', { score: a.trustScore })
                      : t('compas.sheets.bottle.trustUnknown')}
                  </span>
                </span>
                <span className="cp-row__end">
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    disabled={ctl.busy}
                    aria-label={t('compas.sheets.bottle.refuseOf', { name: a.name })}
                    onClick={() => void answer(b.id, a, false)}
                  >
                    {t('compas.sheets.bottle.refuse')}
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn--pg"
                    disabled={ctl.busy}
                    aria-label={t('compas.sheets.bottle.acceptOf', { name: a.name })}
                    onClick={() => void answer(b.id, a, true)}
                  >
                    {t('compas.sheets.bottle.accept')}
                  </button>
                </span>
              </div>
            ))
          )}
          <button
            type="button"
            className="cp-linkbtn"
            disabled={ctl.busy}
            onClick={async () => {
              const ok = await ctl.run(t('compas.sheets.bottle.closed'), () =>
                compasCloseBottleAction({ tripId, tripSlug: slug, groupId: b.id })
              );
              if (ok) setReload((n) => n + 1);
            }}
          >
            {t('compas.sheets.bottle.close')}
          </button>
        </section>
      ))}

      {st && !st.canLaunch && st.blocked && <p className="cp-note">{st.blocked}</p>}

      {st?.canLaunch && (
        <form
          className="cp-bottle cp-glass"
          onSubmit={launch}
          aria-label={t('compas.sheets.bottle.form')}
        >
          <div className="cp-bottle__h">
            <b>
              <Icon name="send" size={15} aria-hidden="true" /> {t('compas.sheets.bottle.formTitle')}
            </b>
          </div>
          <p className="cp-sub">
            <b>{t('compas.sheets.bottle.where')}</b> ·{' '}
            {t('compas.sheets.bottle.whereSub', { country: countryLabel(st.country, locale, t) })}
          </p>
          <label className="cp-field">
            {t('compas.sheets.bottle.titleField')}
            <input
              name="bottleName"
              required
              minLength={3}
              maxLength={80}
              defaultValue={title.slice(0, 80)}
            />
          </label>
          <p className="cp-sub">
            <b>{t('compas.sheets.bottle.toWhom')}</b>
          </p>
          <label className="cp-field">
            {t('compas.sheets.bottle.minTrust', { trust: minTrust })}
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={minTrust}
              onChange={(e) => setMinTrust(Number(e.target.value))}
            />
          </label>
          <Segments
            label={t('compas.sheets.bottle.mix')}
            value={mixite}
            onChange={setMixite}
            options={[
              { id: 'all', label: t(MIXITE_LABEL.all) },
              { id: 'women_only', label: t(MIXITE_LABEL.women_only) },
              { id: 'men_only', label: t(MIXITE_LABEL.men_only) },
            ]}
          />
          <label className="cp-field">
            {t('compas.sheets.bottle.places')}
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={20}
              value={places}
              onChange={(e) =>
                setPlaces(Math.max(2, Math.min(20, Math.round(Number(e.target.value) || 2))))
              }
            />
          </label>
          <p className="cp-sub">
            <b>{t('compas.sheets.bottle.when')}</b>
          </p>
          <div className="cp-grid2">
            <label className="cp-field">
              {t('compas.sheets.bottle.departureField')}
              <input name="bottleFrom" type="date" defaultValue={dates.start ?? ''} />
            </label>
            <label className="cp-field">
              {t('compas.sheets.bottle.returnField')}
              <input name="bottleTo" type="date" defaultValue={dates.end ?? ''} />
            </label>
          </div>
          <label className="cp-field">
            {/* « Message » : même mot en anglais. */}
            Message
            <textarea
              name="bottleMsg"
              rows={3}
              maxLength={600}
              placeholder={t('compas.sheets.bottle.messagePlaceholder')}
            />
          </label>
          <label className="cp-check">
            <input type="checkbox" name="bottleAdult" required />{' '}
            {t('compas.sheets.bottle.adultCheck')}
          </label>
          <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
            <Icon name="send" size={16} />
            {t('compas.sheets.bottle.launch')}
          </button>
          <p className="cp-note">{t('compas.sheets.bottle.launchNote')}</p>
        </form>
      )}

      <Link className="cp-btn cp-btn--tap" href={HUB_GROUP_PATH}>
        <Icon name="users" size={16} aria-hidden="true" />
        {t('compas.sheets.bottle.inviteKnown')}
      </Link>
    </>
  );
}

const BOOKING_STATUS: Record<
  string,
  { key: TranslationKey; tone?: 'good' | 'warn' | 'bad' | 'soft' }
> = {
  confirmed: { key: 'compas.sheets.booking.confirmed', tone: 'good' },
  pending: { key: 'compas.sheets.booking.pending', tone: 'warn' },
  held: { key: 'compas.sheets.booking.held', tone: 'warn' },
  draft: { key: 'compas.sheets.booking.draft', tone: 'soft' },
  cancelled: { key: 'compas.sheets.booking.cancelled', tone: 'bad' },
  expired: { key: 'compas.sheets.booking.expired', tone: 'bad' },
  failed: { key: 'compas.sheets.booking.failed', tone: 'bad' },
  refunded: { key: 'compas.sheets.booking.refunded' },
};
/** Libellé d'un état de réservation ; un état inconnu s'affiche tel quel. */
const bookingLabel = (t: SheetsT, status: string) => {
  const s = BOOKING_STATUS[status];
  return s ? t(s.key) : status;
};
const VERTICAL_LABEL: Record<string, { key: TranslationKey; icon: string }> = {
  hotel: { key: 'compas.sheets.booking.hotel', icon: 'bed-double' },
  flight: { key: 'compas.sheets.booking.flight', icon: 'plane' },
  car: { key: 'compas.sheets.booking.car', icon: 'car' },
  activity: { key: 'compas.sheets.booking.activity', icon: 'ticket' },
};

// Motif sur la catégorie (donnée partenaire), pas un texte affiché.
const STAY_OFFER = /h[ôo]tel|h[ée]berg|stay|refuge|g[îi]te|logement|nuit/i; // i18n-ok

type StaySearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ok'; mode: 'sandbox' | 'live'; offers: CompasStayOffer[] };

/** Recherche d'hébergement pour une nuit : liste des offres, rien n'est réservé. */
function StaySearch({
  ctl,
  nights,
  focusDay,
}: {
  ctl: CompasCtl;
  nights: number[];
  focusDay?: number;
}) {
  const { tripId, slug } = ctl.data.model;
  const { t, money } = useSheetsI18n();
  const [day, setDay] = useState<number>(
    focusDay != null && nights.includes(focusDay) ? focusDay : nights[0]
  );
  const [state, setState] = useState<StaySearchState>({ status: 'idle' });

  const search = async () => {
    setState({ status: 'loading' });
    try {
      const res = await compasSearchStaysAction({ tripId, day });
      setState(
        res.success
          ? { status: 'ok', mode: res.mode, offers: res.offers }
          : { status: 'error', error: res.error }
      );
    } catch {
      setState({ status: 'error', error: t('compas.sheets.common.lostConnection') });
    }
  };

  return (
    <>
      <div className="cp-actions" style={{ alignItems: 'flex-end' }}>
        <label className="cp-field" style={{ flex: 1 }}>
          {t('compas.sheets.stay.for')}
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {nights.map((n) => (
              <option key={n} value={n}>
                {t('compas.sheets.stay.nightOf', { day: n })}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="cp-btn cp-btn--pg"
          disabled={state.status === 'loading'}
          onClick={search}
        >
          {t('compas.sheets.common.search')}
        </button>
      </div>
      {state.status === 'loading' && <p className="cp-note">{t('compas.sheets.stay.loading')}</p>}
      {state.status === 'error' && <p className="cp-note" role="alert">{state.error}</p>}
      {state.status === 'ok' && (
        <>
          {state.mode === 'sandbox' && (
            <p className="cp-note">
              <b>{t('compas.sheets.stay.testMode')}</b> {t('compas.sheets.stay.sandbox')}
            </p>
          )}
          {/* Les offres s'ouvrent chez un partenaire rémunéré : la divulgation vient AVANT la liste
              (Art. L121-2 et L121-3 du Code de la consommation), jamais pour une liste vide. */}
          {state.offers.length > 0 && <AffiliateDisclosure compact />}
          <TallList
            label={t('compas.sheets.stay.offers')}
            items={state.offers}
            empty={<p className="cp-note">{t('compas.sheets.stay.noOffer')}</p>}
            render={(o) => (
              <DoubleTapRow
                key={o.id}
                className="cp-row cp-row--tall"
                style={staticRow}
                onDouble={
                  o.untitled || ctl.busy
                    ? null
                    : () =>
                        void ctl.run(t('compas.sheets.stay.noted'), () =>
                          compasSetStayAction({ tripId, tripSlug: slug, day, name: o.title })
                        )
                }
              >
                <span className="cp-thumb">
                  <Icon name="bed-double" size={20} />
                </span>
                <span className="cp-row__t cp-row__t--wrap">
                  <b>{o.title}</b>
                  {o.untitled && <span>{t('compas.sheets.stay.untitled')}</span>}
                  <span>
                    {o.amount != null && o.currency
                      ? t('compas.sheets.stay.price', { price: money(o.amount, o.currency) })
                      : t('compas.sheets.stay.noPrice')}
                  </span>
                  {o.description && <span>{o.description}</span>}
                </span>
                <span className="cp-row__end" style={{ flexDirection: 'column', gap: 6 }}>
                  {/* Un libellé de repli n'est pas un lieu : il n'est jamais
                      enregistré comme hébergement de la nuit. */}
                  {!o.untitled && (
                    <button
                      type="button"
                      className="cp-btn cp-btn--soft"
                      disabled={ctl.busy}
                      onClick={() =>
                        void ctl.run(t('compas.sheets.stay.noted'), () =>
                          compasSetStayAction({ tripId, tripSlug: slug, day, name: o.title })
                        )
                      }
                    >
                      {t('compas.sheets.stay.note')}
                    </button>
                  )}
                  {o.url && (
                    <a
                      className="cp-btn cp-btn--soft"
                      href={o.url}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                    >
                      {t('compas.sheets.stay.seeOffer')}
                    </a>
                  )}
                </span>
              </DoubleTapRow>
            )}
          />
        </>
      )}
    </>
  );
}

function NuitsFlow({ ctl, focusDay }: { ctl: CompasCtl; focusDay?: number }) {
  const { tripId, slug } = ctl.data.model;
  const byDay = new Map<number, string | null>();
  for (const st of ctl.data.itinerary) byDay.set(st.day, byDay.get(st.day) ?? st.accommodation);
  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  const lastDay = days.length ? days[days.length - 1][0] : 0;
  const nights = days.filter(([day]) => day < lastDay);
  const bivouac = ctl.data.model.preferences.nights === 'bivouac';
  const offers = ctl.data.affiliateLinks.filter((l) => STAY_OFFER.test(l.category ?? ''));
  const live = ctl.data.providers.routestack !== 'disabled';
  const { t } = useSheetsI18n();

  const save = (day: number, name: string) =>
    void ctl.run(
      name ? t('compas.sheets.stay.noted') : t('compas.sheets.nights.removed'),
      () => compasSetStayAction({ tripId, tripSlug: slug, day, name })
    );

  if (nights.length === 0) return <p className="cp-note">{t('compas.sheets.nights.none')}</p>;

  return (
    <>
      <PagedList
        label={t('compas.sheets.nights.label')}
        items={nights}
        focusIndex={nights.findIndex(([day]) => day === focusDay)}
        render={([day, stay]) => (
          <form
            key={day}
            className="cp-row"
            style={staticRow}
            onSubmit={(e) => {
              e.preventDefault();
              save(day, String(new FormData(e.currentTarget).get('stay') ?? ''));
            }}
          >
            <span className="cp-thumb">
              <Icon name="bed-double" size={20} />
            </span>
            <span className="cp-row__t">
              <b>{t('compas.sheets.nights.night', { day })}</b>
              {ctl.data.canEdit ? (
                <input
                  key={stay ?? 'vide'}
                  name="stay"
                  defaultValue={stay ?? ''}
                  maxLength={120}
                  placeholder={
                    bivouac
                      ? t('compas.sheets.nights.placeholderBivouac')
                      : t('compas.sheets.nights.placeholderStay')
                  }
                  aria-label={t('compas.sheets.nights.stayOf', { day })}
                />
              ) : (
                <span>{stay ?? t('compas.sheets.nights.toFind')}</span>
              )}
            </span>
            <span className="cp-row__end">
              {stay ? (
                <Chip tone="good">{t('compas.sheets.nights.noted')}</Chip>
              ) : (
                <Chip tone={bivouac ? 'soft' : 'warn'}>{t('compas.sheets.nights.toFindChip')}</Chip>
              )}
              {ctl.data.canEdit && (
                <button type="submit" className="cp-btn cp-btn--soft" disabled={ctl.busy}>
                  OK
                </button>
              )}
            </span>
          </form>
        )}
      />
      <p className="cp-note">{t('compas.sheets.nights.note')}</p>
      {offers.length > 0 && (
        <>
          <AffiliateDisclosure compact />
          <PagedList
            label={t('compas.sheets.nights.partners')}
            items={offers}
            render={(l) => (
              <a
                key={l.id}
                className="cp-row"
                href={l.url}
                target="_blank"
                rel="sponsored nofollow noopener"
              >
                <span className="cp-thumb">
                  <Icon name="bed-double" size={20} />
                </span>
                <span className="cp-row__t">
                  <b>{l.label}</b>
                  <span>{l.partner ?? t('compas.sheets.common.partner')}</span>
                </span>
                <span className="cp-row__end">
                  <Icon name="external-link" size={16} />
                </span>
              </a>
            )}
          />
        </>
      )}
      {live && ctl.data.canEdit && nights.length > 0 ? (
        <StaySearch ctl={ctl} nights={nights.map(([day]) => day)} focusDay={focusDay} />
      ) : (
        <p className="cp-disc">{t('compas.sheets.nights.liveOff')}</p>
      )}
    </>
  );
}

function ReservationsFlow({ ctl }: { ctl: CompasCtl }) {
  const list = [...ctl.data.bookings].sort(
    (a, b) => Number(LIVE_BOOKING(b.status)) - Number(LIVE_BOOKING(a.status))
  );
  const { bookings, budget } = ctl.data.model;
  const converted = convertFromEur(bookings.amountEur, ctl.data.fx);
  const { t, money, decimal } = useSheetsI18n();
  return (
    <>
      {bookings.total > 0 && (
        <p className="cp-sub">
          {rich(t('compas.sheets.resa.total'), { amount: <b>{money(bookings.amountEur)}</b> })}
          {converted
            ? ` ≈ ${t('compas.sheets.resa.converted', {
                amount: money(converted.amount, converted.currency),
                rate: decimal(converted.rate),
                currency: converted.currency,
                date: converted.date,
                source: converted.source,
              })}`
            : budget.currency !== 'EUR'
              ? dot(t('compas.sheets.resa.noConversion', { currency: budget.currency }))
              : ''}
        </p>
      )}
      <PagedList
        label={t('compas.sheets.resa.label')}
        items={list}
        empty={<p className="cp-note">{t('compas.sheets.resa.empty')}</p>}
        render={(b) => {
          const known = VERTICAL_LABEL[b.vertical];
          const v = known
            ? { label: t(known.key), icon: known.icon }
            : { label: b.vertical, icon: 'ticket' };
          const st = { label: bookingLabel(t, b.status), tone: BOOKING_STATUS[b.status]?.tone };
          return (
            <div
              key={b.id}
              className="cp-row"
              style={staticRow}
              data-vertical={verticalOf(b.vertical)}
            >
              <span className="cp-thumb">
                <Icon name={v.icon} size={20} />
              </span>
              <span className="cp-row__t">
                <b>{v.label}</b>
                <span>
                  {b.provider === 'affiliate'
                    ? t('compas.sheets.booking.affiliate')
                    : b.provider === 'routestack'
                      ? 'RouteStack'
                      : 'Viator'}
                </span>
              </span>
              <span className="cp-row__end">
                {money(b.amountEur)}
                <Chip tone={st.tone}>{st.label}</Chip>
              </span>
            </div>
          );
        }}
      />
    </>
  );
}

/** Ce que veut dire chaque état, dans l'ordre où une réservation avance. */
const STATE_HELP: Array<[string, TranslationKey]> = [
  ['draft', 'compas.sheets.states.draft'],
  ['held', 'compas.sheets.states.held'],
  ['pending', 'compas.sheets.states.pending'],
  ['confirmed', 'compas.sheets.states.confirmed'],
  ['cancelled', 'compas.sheets.states.cancelled'],
  ['expired', 'compas.sheets.states.expired'],
  ['failed', 'compas.sheets.states.failed'],
  ['refunded', 'compas.sheets.states.refunded'],
];

/**
 * États (maquette finale, Mes réservations) : les réservations réelles du
 * voyage comptées par état, et les nuits encore à trouver. Un clic vers un
 * partenaire ne confirme jamais rien.
 */
function EtatsFlow({ ctl }: { ctl: CompasCtl }) {
  const count = (s: string) => ctl.data.bookings.filter((b) => b.status === s).length;
  const toFind = ctl.data.model.route.nightsToFind;
  const rows = STATE_HELP.filter(([s], i) => i < 4 || count(s) > 0);
  const { t } = useSheetsI18n();
  return (
    <>
      <div className="cp-row" style={staticRow}>
        <span className="cp-thumb">
          <Icon name="bed-double" size={20} />
        </span>
        <span className="cp-row__t">
          <b>{t('compas.sheets.states.toBook')}</b>
          <span>{t('compas.sheets.states.toBookSub')}</span>
        </span>
        <span className="cp-row__end">
          <b>{toFind}</b>
        </span>
      </div>
      {rows.map(([s, help]) => (
        <div key={s} className="cp-row" style={staticRow}>
          <span className="cp-row__t">
            <b>{bookingLabel(t, s)}</b>
            <span>{t(help)}</span>
          </span>
          <span className="cp-row__end">
            <b>{count(s)}</b>
          </span>
        </div>
      ))}
      <p className="cp-note">{t('compas.sheets.states.clickNote')}</p>
    </>
  );
}

// Motifs sur la catégorie (donnée partenaire), pas des textes affichés.
const OFFER_ICONS: Array<[RegExp, string]> = [
  [/vol|flight|avion/i, 'plane'],
  [/h[ôo]tel|h[ée]berg|stay|refuge|g[îi]te/i, 'bed-double'], // i18n-ok
  [/voiture|car|location/i, 'car'],
  [/train|rail/i, 'train'],
];

function offerIcon(category: string | null): string {
  for (const [re, icon] of OFFER_ICONS) if (re.test(category ?? '')) return icon;
  return 'ticket';
}

/**
 * Offres (maquette finale : une catégorie touchée sur la carte Résa ouvre ses
 * offres). Les réservations réelles de la catégorie passent devant ; les
 * offres partenaires suivent, balisées, et ne réservent jamais rien.
 */
const LIVE_OF: Partial<Record<ResaCat, CompasLiveVertical>> = {
  activites: 'activity',
  vols: 'flight',
  trajets: 'car',
};
const PARTNER_OF: Record<CompasLiveVertical, string> = {
  activity: 'Viator',
  flight: 'RouteStack',
  car: 'RouteStack',
};

/**
 * Résa (maquette finale) : six catégories. Activités (Viator), Vols et
 * Trajets (RouteStack) se cherchent en direct ici ; Nuits ouvre la recherche
 * par nuit ; Extras liste les offres partenaires (assurance, eSIM…).
 */
function OffresFlow({ ctl, initialCat }: { ctl: CompasCtl; initialCat?: ResaCat }) {
  const [cat, setCat] = useState<ResaCat>(
    initialCat && initialCat !== 'randos' ? initialCat : 'activites'
  );
  const offers = ctl.data.affiliateLinks.filter((l) => offerCat(l.category) === cat);
  const booked = ctl.data.bookings.filter(
    (b) => LIVE_BOOKING(b.status) && bookingCat(b.vertical) === cat
  );
  const live = LIVE_OF[cat];
  const { t, pl, locale } = useSheetsI18n();
  return (
    <>
      <Segments
        label={t('compas.sheets.common.category')}
        value={cat}
        onChange={setCat}
        options={RESA_CATS.filter((c) => c.id !== 'randos').map((c) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
        }))}
      />
      {booked.length > 0 && (
        <p className="cp-sub">
          <b>{pl(booked.length, 'compas.sheets.offers.bookedOne', 'compas.sheets.offers.bookedOther')}</b>{' '}
          {t('compas.sheets.offers.inCategory')} ·{' '}
          {booked
            .map((b) => bookingLabel(t, b.status))
            .join(', ')
            .toLocaleLowerCase(locale)}
        </p>
      )}
      {live && <LiveSearch key={live} ctl={ctl} vertical={live} />}
      {cat === 'nuits' && ( // i18n-ok : identifiant de catégorie
        <button
          type="button"
          className="cp-btn cp-btn--pg"
          onClick={() =>
            ctl.replace({ kind: 'step', step: 'resa', flow: 'nuits' }) // i18n-ok : identifiant
          }
        >
          <Icon name="bed-double" size={16} />
          {t('compas.sheets.offers.nightly')}
        </button>
      )}
      {(offers.length > 0 || cat === 'extras') && (
        <>
          <AffiliateDisclosure compact />
          <PagedList
            label={t('compas.sheets.offers.partners')}
            resetKey={cat}
            items={offers}
            empty={<p className="cp-note">{t('compas.sheets.offers.noPartner')}</p>}
            render={(l) => (
              <a
                key={l.id}
                className="cp-row"
                href={l.url}
                target="_blank"
                rel="sponsored nofollow noopener"
              >
                <span className="cp-thumb">
                  <Icon name={offerIcon(l.category)} size={20} />
                </span>
                <span className="cp-row__t">
                  <b>{l.label}</b>
                  <span>
                    {[l.partner, l.category].filter(Boolean).join(' · ') ||
                      t('compas.sheets.common.partner')}
                  </span>
                </span>
                <span className="cp-row__end">
                  <Icon name="external-link" size={16} />
                </span>
              </a>
            )}
          />
        </>
      )}
    </>
  );
}

/** Recherche en direct chez le partenaire de la catégorie ; rien n'est réservé d'ici. */
function LiveSearch({ ctl, vertical }: { ctl: CompasCtl; vertical: CompasLiveVertical }) {
  const { model } = ctl.data;
  const { t, pl, money, dayMonth } = useSheetsI18n();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(model.destination ?? '');
  const [state, setState] = useState<
    | { status: 'idle' | 'loading' }
    | { status: 'error'; error: string; unavailable: boolean }
    | { status: 'ok'; mode: 'sandbox' | 'live'; offers: CompasStayOffer[] }
  >({ status: 'idle' });

  const seq = useRef(0);
  const search = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const mine = ++seq.current;
    setState({ status: 'loading' });
    try {
      const res = await compasSearchOffersAction({
        tripId: model.tripId,
        vertical,
        ...(vertical === 'flight' ? { from } : {}),
        ...(to.trim() ? { to: to.trim() } : {}),
      });
      if (mine !== seq.current) return;
      setState(
        res.success
          ? { status: 'ok', mode: res.mode, offers: res.offers }
          : { status: 'error', error: res.error, unavailable: res.unavailable === true }
      );
    } catch {
      setState({
        status: 'error',
        error: t('compas.sheets.common.lostConnection'),
        unavailable: false,
      });
    }
  };

  const when = model.dates.start
    ? `${dayMonth(model.dates.start)}${model.dates.end && vertical !== 'activity' ? ` → ${dayMonth(model.dates.end)}` : ''}`
    : t('compas.sheets.live.datesToChoose');

  return (
    <>
      <form
        className="cp-bottle cp-glass"
        onSubmit={search}
        aria-label={
          vertical === 'activity'
            ? t('compas.sheets.live.ariaActivity')
            : vertical === 'flight'
              ? t('compas.sheets.live.ariaFlight')
              : t('compas.sheets.live.ariaCar')
        }
      >
        {vertical === 'flight' && (
          <label className="cp-field">
            {t('compas.sheets.live.from')}
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={t('compas.sheets.live.fromPlaceholder')}
              maxLength={80}
              required
            />
          </label>
        )}
        <label className="cp-field">
          {vertical === 'car'
            ? t('compas.sheets.live.carTo')
            : vertical === 'flight'
              ? t('compas.sheets.live.flightTo')
              : t('compas.sheets.bottle.where')}
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Destination"
            maxLength={80}
            required
          />
        </label>
        <span className="cp-sub">
          {pl(model.crew.size, 'compas.sheets.live.lineOne', 'compas.sheets.live.lineOther', {
            when,
            partner: PARTNER_OF[vertical],
          })}
        </span>
        <button
          type="submit"
          className="cp-btn cp-btn--pg"
          disabled={state.status === 'loading' || !model.dates.start}
        >
          <Icon name="search" size={16} />
          {state.status === 'loading'
            ? t('compas.sheets.live.searching')
            : t('compas.sheets.live.search')}
        </button>
      </form>

      {state.status === 'error' && <p className="cp-note" role="alert">{state.error}</p>}
      {state.status === 'error' && state.unavailable && (
        <PagedList
          label={t('compas.sheets.live.examples')}
          items={[...RESA_EXAMPLES[vertical]]}
          empty={null}
          render={(x) => (
            <div key={x.title} className="cp-row" style={staticRow}>
              <span className="cp-thumb">
                <Icon
                  name={vertical === 'flight' ? 'plane' : vertical === 'car' ? 'car' : 'ticket'}
                  size={20}
                />
              </span>
              <span className="cp-row__t">
                <b>{x.title}</b>
                <span>{x.detail}</span>
              </span>
              <span className="cp-row__end">
                <Chip tone="soft">{t('compas.sheets.live.example')}</Chip>
              </span>
            </div>
          )}
        />
      )}
      {state.status === 'ok' && (
        <>
          {state.mode === 'sandbox' && (
            <p className="cp-note">{t('compas.sheets.live.sandbox')}</p>
          )}
          <AffiliateDisclosure compact />
          <PagedList
            label={t('compas.sheets.live.offers')}
            items={state.offers}
            empty={<p className="cp-note">{t('compas.sheets.live.noOffer')}</p>}
            render={(o) => {
              const body = (
                <>
                  <span className="cp-thumb">
                    <Icon
                      name={vertical === 'flight' ? 'plane' : vertical === 'car' ? 'car' : 'ticket'}
                      size={20}
                    />
                  </span>
                  <span className="cp-row__t">
                    <b>{o.title}</b>
                    <span>
                      {o.amount != null && o.currency
                        ? money(o.amount, o.currency)
                        : t('compas.sheets.live.priceAtPartner')}
                      {o.requiresRevalidation ? ` · ${t('compas.sheets.live.revalidate')}` : ''}
                    </span>
                  </span>
                </>
              );
              return o.url ? (
                <a
                  key={o.id}
                  className="cp-row"
                  href={o.url}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                >
                  {body}
                  <span className="cp-row__end">
                    <Icon name="external-link" size={16} />
                  </span>
                </a>
              ) : (
                <div key={o.id} className="cp-row" style={staticRow}>
                  {body}
                </div>
              );
            }}
          />
          <p className="cp-disc">{t('compas.sheets.live.disclaimer')}</p>
        </>
      )}
    </>
  );
}

function RaisonsFlow({ ctl }: { ctl: CompasCtl }) {
  const { danger } = ctl.data;
  const dated = new Map(danger.signals.map((x) => [`${x.source}|${x.label}`, x.asOf]));
  // Alertes officielles affichées dans les signaux, avec le texte du service national.
  const shownKeys = new Set(ctl.data.model.verdict.reasons.map((r) => `${r.source}|${r.label}`));
  const officials = danger.signals.filter((x) => x.official && shownKeys.has(`${x.source}|${x.label}`));
  const { t } = useSheetsI18n();
  return (
    <>
      {/* Un axe non évalué ou évalué en partie le dit ici, sous sa barre (jamais un « RAS » muet). */}
      <RiskBars danger={danger} />
      <PagedList
        label={t('compas.sheets.risks.label')}
        items={ctl.data.model.verdict.reasons}
        empty={<p className="cp-note">{t('compas.sheets.risks.none')}</p>}
        render={(r) => (
          // Ligne qui s'agrandit : le service national et l'heure d'émission d'une alerte
          // doivent se lire en entier (Meteoalarm), pas finir en points de suspension.
          <div key={`${r.source}-${r.label}`} className="cp-row cp-row--tall cp-row--wrap" style={staticRow}>
            <span className="cp-thumb">
              <Icon
                name={
                  r.severity === 'block'
                    ? 'shield-alert'
                    : r.severity === 'warn'
                      ? 'alert-triangle'
                      : 'info'
                }
                size={20}
              />
            </span>
            <span className="cp-row__t">
              <b>{r.label}</b>
              <span>
                {t('compas.sheets.common.source', { source: r.source })}
                {dated.get(`${r.source}|${r.label}`)
                  ? ` · ${dated.get(`${r.source}|${r.label}`)}`
                  : ''}
              </span>
            </span>
            <span className="cp-row__end">
              <Chip
                tone={r.severity === 'block' ? 'bad' : r.severity === 'warn' ? 'warn' : undefined}
              >
                {/* « Info » : même mot en anglais. */}
                {r.severity === 'block'
                  ? t('compas.sheets.risks.block')
                  : r.severity === 'warn'
                    ? t('compas.sheets.risks.warn')
                    : 'Info'}
              </Chip>
            </span>
          </div>
        )}
      />
      {officials.map((x) => (
        <OfficialAlertTexts key={x.id} title={x.official?.title} texts={x.official?.texts ?? []} />
      ))}
      {ctl.data.model.verdict.reasons.some((r) => isMeteoalarmSource(r.source)) && (
        <MeteoalarmNotice readAt={ctl.data.alertsReadAt} />
      )}
      {/* IA éteinte (`AI_MODE=off`) : le bouton n'est pas proposé, rien ne parle d'IA (PLAN-100 5.3). */}
      {ctl.data.aiOn && <VerdictExplain ctl={ctl} />}
    </>
  );
}

type ExplainState =
  | { status: 'idle' | 'loading' }
  | { status: 'done'; text: string | null; refused: string | null; note: string | null }
  | { status: 'error'; error: string };

/** L'IA reformule les signaux ci-dessus ; le niveau reste celui du moteur. */
function VerdictExplain({ ctl }: { ctl: CompasCtl }) {
  const [state, setState] = useState<ExplainState>({ status: 'idle' });
  const { t } = useSheetsI18n();
  const explain = async () => {
    setState({ status: 'loading' });
    try {
      const res = await compasExplainVerdictAction({ tripId: ctl.data.model.tripId });
      setState(
        res.success
          ? { status: 'done', text: res.text, refused: res.refused, note: res.note }
          : { status: 'error', error: res.error }
      );
    } catch {
      setState({ status: 'error', error: t('compas.sheets.common.lostConnection') });
    }
  };
  return (
    <section aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {state.status === 'done' && state.text ? (
        <div className="cp-note">
          <p style={{ margin: 0 }}>{state.text}</p>
          <p className="cp-sub" style={{ margin: '6px 0 0' }}>
            {t('compas.sheets.explain.byAi')}
          </p>
        </div>
      ) : state.status === 'done' && state.refused ? (
        <p className="cp-note">{t('compas.sheets.explain.refused', { reason: state.refused })}</p>
      ) : state.status === 'done' && state.note ? (
        <p className="cp-note">{state.note}</p>
      ) : state.status === 'error' ? (
        <p className="cp-note" role="alert">{state.error}</p>
      ) : null}
      {!(state.status === 'done' && state.text) && (
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={state.status === 'loading'}
          onClick={() => void explain()}
        >
          <Icon name="sparkles" size={16} aria-hidden="true" />
          {state.status === 'loading'
            ? t('compas.sheets.explain.loading')
            : t('compas.sheets.explain.button')}
        </button>
      )}
    </section>
  );
}

const deg = (v: number | null) => (v == null ? '—' : `${Math.round(v)} °C`);

/**
 * Météo des vrais jours du voyage (maquette finale : onglet « Météo » du
 * verdict). Prévision MET Norway aux points réels de chaque journée ; au-delà
 * de l'horizon de prévision, le jour le dit au lieu d'inventer une valeur.
 */
function MeteoFlow({ ctl }: { ctl: CompasCtl }) {
  const w = ctl.data.weather;
  const days = w?.tripDays ?? [];
  const { t, num, wxDay } = useSheetsI18n();
  if (!w || days.length === 0) {
    return <p className="cp-note">{t('compas.sheets.weather.unavailable')}</p>;
  }
  const horizon = wxDay(w.horizon);
  return (
    <>
      <div className="cp-wx">
        {days.map((d) => {
          const f = d.forecast;
          const freezing = f
            ? f.hours.map((h) => h.freezingM).filter((v): v is number => v != null)
            : [];
          const lowFreeze = freezing.length ? Math.min(...freezing) : null;
          return (
            <div key={d.day}>
              <b>
                {t('compas.sheets.common.dayShort', { day: d.day })} · {wxDay(d.date)}
              </b>
              {f ? (
                <>
                  {f.code != null && <span>{weatherLabel(f.code).label}</span>}
                  <span>
                    {deg(f.tMin)} / {deg(f.tMax)}
                    {f.precipPct != null
                      ? ` · ${t('compas.sheets.weather.rain', { pct: Math.round(f.precipPct) })}`
                      : ''}
                  </span>
                  <span>
                    {f.gustMax != null
                      ? t('compas.sheets.weather.gusts', { speed: Math.round(f.gustMax) })
                      : t('compas.sheets.weather.gustsNone')}
                    {lowFreeze != null
                      ? ` · ${t('compas.sheets.weather.freezing', { altitude: num(Math.round(lowFreeze)) })}`
                      : ''}
                  </span>
                </>
              ) : (
                <span>{t('compas.sheets.weather.beyond', { date: horizon })}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="cp-note">
        {t('compas.sheets.weather.note', { source: w.source, date: horizon })}
      </p>
    </>
  );
}

/**
 * Veille (maquette finale) : les seuils réellement appliqués par le moteur de
 * danger, ce que chacun a déclenché, et — seulement si le calendrier des
 * conditions le justifie — une proposition de décalage. L'agent propose, la
 * personne décide : le décalage n'est écrit qu'au clic.
 */
function VeilleFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const rules = watchRules(ctl.data.danger.signals);
  // « Rien à signaler » sur la vigilance officielle n'a de sens que si les alertes ont été lues.
  const alertsGap = alertsGapOf(ctl.data.alertsStatus);
  const active = rules.filter((r) => r.hits.length > 0).length;
  const shift = proposeShift({
    start: m.dates.start,
    end: m.dates.end,
    calendar: ctl.data.weather?.calendar ?? [],
  });
  const { t, pl, wxDay: fmt } = useSheetsI18n();
  const apply = () => {
    if (!shift) return;
    const n = Math.abs(shift.offsetDays);
    const ops: ApplyOp[] = [
      {
        op: 'dates',
        startDate: shift.startDate,
        endDate: shift.endDate,
        durationHours: m.dates.hours != null && m.dates.hours < 24 ? m.dates.hours : null,
        resplit: false,
      },
    ];
    const undo = inverseOps(ctl, ops);
    void ctl.run(
      pl(n, 'compas.sheets.watch.shiftedOne', 'compas.sheets.watch.shiftedOther'),
      () => runOps(ctl, ops),
      undo ? () => runOps(ctl, undo) : undefined
    );
  };
  return (
    <>
      {shift && ctl.data.canEdit && (
        <div className="cp-vb">
          <p className="cp-vb__h">
            <span className="cp-pd" aria-hidden="true" />
            {t('compas.sheets.watch.proposal')}
          </p>
          <p>
            {shift.now.length
              ? `${t('compas.sheets.watch.now', { list: shift.now.join(', ') })} `
              : ''}
            {(() => {
              const vars = { from: fmt(shift.startDate), to: fmt(shift.endDate) };
              const n = Math.abs(shift.offsetDays);
              return shift.offsetDays > 0
                ? pl(n, 'compas.sheets.watch.laterOne', 'compas.sheets.watch.laterOther', vars)
                : pl(n, 'compas.sheets.watch.earlierOne', 'compas.sheets.watch.earlierOther', vars);
            })()}
          </p>
          <div className="cp-actions">
            <button type="button" className="cp-btn cp-btn--pg" disabled={ctl.busy} onClick={apply}>
              {t('compas.sheets.watch.shift')}
            </button>
            <span className="cp-sub">{t('compas.sheets.watch.agent')}</span>
          </div>
        </div>
      )}
      <ul className="cp-rules" aria-label={t('compas.sheets.watch.rules')}>
        {rules.map((r) => (
          <li key={r.id} data-hit={r.hits.length ? '1' : undefined}>
            <b>{r.label}</b>
            {r.hits.length ? (
              // Chaque alerte nomme son service national (conditions de Meteoalarm, § 5), comme
              // dans les signaux du verdict.
              r.hits.map((h, i) => (
                <Fragment key={i}>
                  <span>{h.label}</span>
                  <span>{t('compas.sheets.common.source', { source: h.source })}</span>
                </Fragment>
              ))
            ) : (
              <span>
                {r.id === 'alert' && alertsGap
                  ? t('compas.sheets.watch.unverified', { gap: alertsGap })
                  : t('compas.sheets.watch.nothing')}
              </span>
            )}
            {r.hits.map(
              (h, i) =>
                h.official && (
                  <OfficialAlertTexts key={i} title={h.official.title} texts={h.official.texts} />
                )
            )}
          </li>
        ))}
      </ul>
      <p className="cp-note">
        {pl(active, 'compas.sheets.watch.summaryOne', 'compas.sheets.watch.summaryOther', {
          total: rules.length,
        })}{' '}
        {t('compas.sheets.watch.summaryNote')}
      </p>
      {rules.some((r) => r.id === 'alert' && r.hits.length > 0) && (
        <MeteoalarmNotice readAt={ctl.data.alertsReadAt} />
      )}
    </>
  );
}

function SourcesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  // NASA POWER (domaine public, citation demandée) : tendance du calendrier au-delà
  // de la prévision, et normales 2001-2020 d'une période proposée par la préparation.
  // Seul l'usage réel est cité.
  const powerTrend = Boolean(ctl.data.weather?.calendar.some((c) => c.kind === 'tendance'));
  const powerNormals = Boolean(ctl.data.autofillNotes?.some((n) => n.includes('NASA POWER')));
  const { t, pl } = useSheetsI18n();
  const powerUses = [
    powerTrend ? t('compas.sheets.sources.powerTrend') : null,
    powerNormals ? t('compas.sheets.sources.powerNormals') : null,
  ].filter(Boolean);
  // Meteoalarm n'est cité que si ses flux ont été lus (même sans alerte à montrer).
  const alertsRead = ctl.data.alertsStatus === 'lues' || ctl.data.alertsStatus === 'partielles';
  const sources = [
    t('compas.sheets.sources.trip'),
    t('compas.sheets.sources.inventory'),
    m.weather.days.length ? t('compas.sheets.sources.metno') : null,
    alertsRead ? t('compas.sheets.sources.meteoalarm') : null,
    powerUses.length ? `NASA POWER (${powerUses.join(', ')})` : null,
    m.daylight ? t('compas.sheets.sources.daylight') : null,
    ctl.data.shop.length ? t('compas.sheets.sources.shop') : null,
    ctl.data.affiliateLinks.length ? t('compas.sheets.sources.affiliates') : null,
  ].filter(Boolean) as string[];
  return (
    <>
      <dl className="cp-kv">
        {/* « Destination » : même mot en anglais. */}
        <dt>Destination</dt>
        <dd>{m.destination ?? '—'}</dd>
        <dt>{t('compas.sheets.common.kitItems')}</dt>
        <dd>{ctl.lines.length}</dd>
        <dt>{t('compas.sheets.common.inventory')}</dt>
        <dd>
          {pl(m.inventory.total, 'compas.sheets.common.itemsOne', 'compas.sheets.common.itemsOther')}
          {m.inventory.lent
            ? ` · ${pl(m.inventory.lent, 'compas.sheets.sources.lentOne', 'compas.sheets.sources.lentOther')}`
            : ''}
        </dd>
        <dt>{t('compas.sheets.sources.maintenance')}</dt>
        <dd>{m.inventory.maintenanceDue}</dd>
        <dt>{t('compas.sheets.sources.expiring')}</dt>
        <dd>{m.inventory.expiringSoon}</dd>
      </dl>
      <div className="cp-actions">
        {sources.map((s) => (
          <Chip key={s} tone="soft">
            {s}
          </Chip>
        ))}
      </div>
      <p className="cp-note">{t('compas.sheets.sources.noInvented')}</p>
      {alertsRead && <MeteoalarmNotice readAt={ctl.data.alertsReadAt} />}
      <div className="cp-actions">
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          onClick={() => ctl.open({ kind: 'add', target: 'inventaire' })}
        >
          <Icon name="archive" size={16} />
          {t('compas.sheets.common.addToInventory')}
        </button>
      </div>
    </>
  );
}

function KitListFlow({ ctl, flow }: { ctl: CompasCtl; flow: KitListMode }) {
  const lines =
    flow === 'trouver'
      ? ctl.lines.filter((l) => l.status !== 'owned')
      : flow === 'emballer'
        ? ctl.lines.filter((l) => !l.packed)
        : ctl.lines;
  const { t } = useSheetsI18n();
  return (
    <>
      <PagedList
        label={t('compas.sheets.common.kitItems')}
        resetKey={flow}
        items={lines}
        empty={
          <p className="cp-note">
            {flow === 'trouver'
              ? t('compas.sheets.kitList.nothingToFind')
              : flow === 'emballer'
                ? t('compas.sheets.kitList.allPacked')
                : t('compas.sheets.kitList.empty')}
          </p>
        }
        render={(line) => <KitRow key={line.id} line={line} ctl={ctl} />}
      />
      {ctl.data.canEdit && (
        <div className="cp-actions">
          <button
            type="button"
            className="cp-btn cp-btn--pg cp-btn--block"
            onClick={() => ctl.open({ kind: 'add', target: 'kit' })}
          >
            <Icon name="plus" size={16} />
            {t('compas.sheets.common.addToKit')}
          </button>
        </div>
      )}
    </>
  );
}

/** Liste à lignes de hauteur libre (texte long) : pas de pagination, le tiroir défile. */
function TallList<T>({
  label,
  items,
  empty,
  render,
}: {
  label: string;
  items: T[];
  empty: ReactNode;
  render: (item: T) => ReactNode;
}) {
  if (!items.length) return <>{empty}</>;
  return (
    <div className="cp-list__page" role="group" aria-label={label}>
      {items.map(render)}
    </div>
  );
}

const ADVICE_ICON: Record<string, string> = {
  pluie: 'cloud-rain',
  etanche: 'package',
  froid: 'thermometer',
  chaud: 'thermometer',
  extremites: 'cloud-snow',
  soleil: 'sun',
  moustiques: 'shield',
  filtre: 'filter',
  frontale: 'sunset',
  eau: 'droplet',
};

/** Mot cherché dans la boutique quand on ajoute depuis un conseil (sous-chaîne, sans accent). */
const ADVICE_QUERY: Record<string, string> = {
  pluie: 'imperm',
  etanche: 'etanche',
  froid: 'polaire',
  chaud: 'polaire',
  extremites: 'gant',
  soleil: 'solaire',
  moustiques: 'repulsif',
  filtre: 'filtre',
  frontale: 'frontale',
  eau: 'gourde',
};

function ConseilsFlow({ ctl }: { ctl: CompasCtl }) {
  const advice = ctl.data.kitAdvice;
  const { t } = useSheetsI18n();
  return (
    <>
      <p className="cp-note">{t('compas.sheets.advice.intro')}</p>
      <TallList
        label={t('compas.sheets.advice.label')}
        items={advice}
        empty={<p className="cp-note">{t('compas.sheets.advice.empty')}</p>}
        render={(a) => (
          <div key={a.id} className="cp-row cp-row--tall" style={staticRow}>
            <span className="cp-thumb">
              <Icon name={ADVICE_ICON[a.need] ?? 'sparkles'} size={20} />
            </span>
            <span className="cp-row__t cp-row__t--wrap">
              <b>{a.label}</b>
              <span>{a.reason}</span>
              <span>
                {t('compas.sheets.common.source', { source: a.source })}
                {a.coveredBy
                  ? ` · ${t('compas.sheets.advice.coveredBy', { name: a.coveredBy })}`
                  : ''}
              </span>
            </span>
            <span className="cp-row__end">
              {a.covered ? (
                <Chip tone="good">{t('compas.sheets.advice.covered')}</Chip>
              ) : (
                ctl.data.canEdit && (
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    onClick={() =>
                      ctl.open(
                        {
                          kind: 'add',
                          target: 'kit',
                          suggest: { query: ADVICE_QUERY[a.need] ?? '', name: a.label },
                        },
                        'large'
                      )
                    }
                  >
                    {t('compas.sheets.common.add')}
                  </button>
                )
              )}
            </span>
          </div>
        )}
      />
    </>
  );
}

const POI_ICON: Record<RoutePoiCategory, string> = {
  water: 'droplet',
  refuge: 'home',
  camping: 'tent',
  viewpoint: 'eye',
  peak: 'mountain',
  parking: 'car',
  resto: 'flame',
  commerce: 'shopping-cart',
  sante: 'heart-pulse',
  hebergement: 'bed-double',
  transport: 'bus',
  toilets: 'droplets',
  via_ferrata: 'link',
  aerialway_station: 'arrow-up-right',
};

function TraceFlow({ ctl }: { ctl: CompasCtl }) {
  const pois = ctl.data.routePois;
  const counts = countByCategory(pois);
  const [filter, setFilter] = useState<'all' | RoutePoiCategory>('all');
  const onRoute = ctl.data.route.id != null;
  const { t } = useSheetsI18n();
  if (!onRoute && pois.length === 0)
    return (
      <p className="cp-note">
        {!ctl.data.itinerary.length
          ? t('compas.sheets.trace.noStages')
          : ctl.data.stagePoisDone
            ? t('compas.sheets.trace.noneFound')
            : t('compas.sheets.trace.searching')}
      </p>
    );
  const shown = filter === 'all' ? pois : pois.filter((p) => p.category === filter);
  const present = (Object.keys(counts) as RoutePoiCategory[]).filter((c) => counts[c] > 0);
  return (
    <>
      <p className="cp-note">
        {onRoute ? t('compas.sheets.trace.onRoute') : t('compas.sheets.trace.aroundStages')}{' '}
        {t('compas.sheets.trace.osmNote')}
      </p>
      {present.length > 0 && (
        <Segments
          label={t('compas.sheets.common.category')}
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: t('compas.sheets.common.allCount', { count: pois.length }) },
            ...present.map((c) => ({ id: c, label: `${ROUTE_POI_LABEL[c]} (${counts[c]})` })),
          ]}
        />
      )}
      <PagedList
        label={t('compas.sheets.trace.label')}
        items={shown}
        empty={<p className="cp-note">{t('compas.sheets.trace.empty')}</p>}
        render={(p) => (
          <div key={p.id} className="cp-row" style={staticRow}>
            <span className="cp-thumb">
              <Icon name={POI_ICON[p.category]} size={20} />
            </span>
            <span className="cp-row__t">
              <b>{poiLabel(p)}</b>
              <span>
                {p.name ? `${ROUTE_POI_LABEL[p.category]} · ` : ''}
                {onRoute
                  ? t('compas.sheets.common.distanceTrack', { distance: p.distanceM })
                  : t('compas.sheets.trace.distanceStage', { distance: p.distanceM })}
                {p.elevationM != null ? ` · ${p.elevationM} m` : ''}
              </span>
            </span>
          </div>
        )}
      />
      <p className="cp-disc">{t('compas.sheets.common.osmCredit')}</p>
    </>
  );
}

const SEASON_LABEL: Record<string, TranslationKey> = {
  printemps: 'compas.sheets.season.printemps',
  ete: 'compas.sheets.season.ete',
  automne: 'compas.sheets.season.automne',
  hiver: 'compas.sheets.season.hiver',
  toute_saison: 'compas.sheets.season.toute_saison',
};

function MesKitsFlow({ ctl }: { ctl: CompasCtl }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: string | null }
    | { status: 'ok'; kits: MyKit[] }
  >({ status: 'loading' });
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const model = ctl.data.model;
  const { t, pl } = useSheetsI18n();
  const tripNames = useMemo(() => ctl.lines.map((l) => l.name), [ctl.lines]);
  const forecasts = useMemo(
    () =>
      (ctl.data.weather?.tripDays ?? []).map((d) => ({
        day: d.day,
        date: d.date,
        forecast: d.forecast,
      })),
    [ctl.data.weather]
  );

  useEffect(() => {
    let alive = true;
    compasListMyKitsAction()
      .then((res) => {
        if (!alive) return;
        setState(
          res.success ? { status: 'ok', kits: res.kits } : { status: 'error', error: res.error }
        );
      })
      // `null` : connexion perdue, dit dans la langue au moment de l'afficher.
      .catch(() => alive && setState({ status: 'error', error: null }));
    return () => {
      alive = false;
    };
  }, [reload]);

  if (state.status === 'loading') return <p className="cp-note">{t('compas.sheets.kits.loading')}</p>;
  if (state.status === 'error')
    return (
      <p className="cp-note" role="alert">
        {state.error ?? t('compas.sheets.common.lostConnection')}
      </p>
    );

  const createKit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const season = String(fd.get('season') ?? '');
    setCreating(true);
    const created = t('compas.sheets.kits.created', {
      name: String(fd.get('kitName') ?? '').trim(),
    });
    const ok = await ctl.run(created, () =>
      compasCreateKitFromTripAction({
        tripId: model.tripId,
        tripSlug: model.slug,
        name: String(fd.get('kitName') ?? ''),
        season:
          season === 'printemps' ||
          season === 'ete' ||
          season === 'automne' ||
          season === 'hiver' ||
          season === 'toute_saison'
            ? season
            : null,
      })
    );
    setCreating(false);
    if (ok) {
      setReload((n) => n + 1);
      setShowCreate(false);
    }
  };

  return (
    <>
      {ctl.data.canEdit && !showCreate && (
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          aria-expanded={false}
          onClick={() => setShowCreate(true)}
        >
          <Icon name="plus" size={16} />
          {t('compas.sheets.kits.create')}
        </button>
      )}
      {ctl.data.canEdit && showCreate && (
        <form
          className="cp-mkkit cp-glass"
          onSubmit={createKit}
          aria-label={t('compas.sheets.kits.create')}
        >
          <b className="cp-mkkit__t">
            <Icon name="plus" size={15} aria-hidden="true" /> {t('compas.sheets.kits.create')}
          </b>
          <span className="cp-note">
            {pl(ctl.lines.length, 'compas.sheets.kits.saveAsOne', 'compas.sheets.kits.saveAsOther')}
          </span>
          <div className="cp-grid2">
            <label className="cp-field">
              {t('compas.sheets.common.name')}
              <input
                name="kitName"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
                defaultValue={t('compas.sheets.kits.defaultName', { title: model.title }).slice(
                  0,
                  80
                )}
              />
            </label>
            <label className="cp-field">
              {t('compas.sheets.kits.season')}
              <select name="season" defaultValue="">
                <option value="">{t('compas.sheets.season.optNone')}</option>
                <option value="printemps">{t('compas.sheets.season.optPrintemps')}</option>
                <option value="ete">{t('compas.sheets.season.optEte')}</option>
                <option value="automne">{t('compas.sheets.season.optAutomne')}</option>
                <option value="hiver">{t('compas.sheets.season.optHiver')}</option>
                <option value="toute_saison">{t('compas.sheets.season.optToute')}</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="cp-btn cp-btn--pg"
            disabled={ctl.busy || creating || ctl.lines.length === 0}
          >
            {ctl.lines.length === 0
              ? t('compas.sheets.kits.addFirst')
              : t('compas.sheets.kits.createKit')}
          </button>
        </form>
      )}
      <p className="cp-note">{t('compas.sheets.kits.applyNote')}</p>
      <TallList
        label={t('compas.sheets.kits.label')}
        items={state.kits}
        empty={<p className="cp-note">{t('compas.sheets.kits.empty')}</p>}
        render={(kit) => {
          const plan = planKitApply(kit, tripNames);
          const compat = kitCompatibility({
            kit,
            tripNames,
            forecasts,
            dayPlans: model.route.dayPlans,
            waterPointsCount: null,
            context: ctl.data.kitContext,
          });
          return (
            <div key={kit.id} className="cp-row cp-row--tall" style={staticRow}>
              <span className="cp-thumb">
                <Icon name="package" size={20} />
              </span>
              <span className="cp-row__t cp-row__t--wrap">
                <b>
                  {kit.name}
                  {kit.season
                    ? ` · ${SEASON_LABEL[kit.season] ? t(SEASON_LABEL[kit.season]) : kit.season}`
                    : ''}
                </b>
                <span>
                  {pl(kit.items.length, 'compas.sheets.common.itemsOne', 'compas.sheets.common.itemsOther')}{' '}
                  ·{' '}
                  {t('compas.sheets.kits.split', {
                    already: plan.alreadyThere,
                    toAdd: plan.toAdd.length,
                  })}
                </span>
                <span>
                  {compat.total > 0
                    ? `${pl(compat.covered, 'compas.sheets.kits.coversOne', 'compas.sheets.kits.coversOther', { covered: compat.covered, total: compat.total })}${compat.bringsNew ? ` (${t('compas.sheets.kits.bringsNew', { count: compat.bringsNew })})` : ''}`
                    : t('compas.sheets.kits.noCompare')}
                </span>
              </span>
              <span className="cp-row__end">
                {ctl.data.canEdit && (
                  <button
                    type="button"
                    className="cp-btn cp-btn--pg"
                    disabled={ctl.busy || pending !== null || plan.toAdd.length === 0}
                    onClick={async () => {
                      setPending(kit.id);
                      await ctl.run(
                        pl(plan.toAdd.length, 'compas.sheets.kits.addedOne', 'compas.sheets.kits.addedOther'),
                        () =>
                          compasApplyKitAction({
                            tripId: model.tripId,
                            tripSlug: model.slug,
                            kitId: kit.id,
                          })
                      );
                      setPending(null);
                    }}
                  >
                    {plan.toAdd.length === 0
                      ? t('compas.sheets.kits.complete')
                      : t('compas.sheets.kits.apply')}
                  </button>
                )}
              </span>
            </div>
          );
        }}
      />
    </>
  );
}

/**
 * Eau (maquette finale, onglet du Kit) : besoin par personne jour par jour
 * (repère par heure de marche, chaud compris), contenants du kit au volume
 * écrit, et points d'eau réels du tracé. Rien n'est supposé : un volume non
 * écrit ou une marche inconnue reste « non renseigné ».
 */
function EauFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const { t, wxDay, liters: litres } = useSheetsI18n();
  const plan = planWater({
    dayPlans: m.route.dayPlans,
    forecasts: (ctl.data.weather?.tripDays ?? []).map((d) => ({
      day: d.day,
      forecast: d.forecast,
    })),
    lines: ctl.lines,
  });
  const people = m.crew.size;
  const water = ctl.data.routePois
    .filter((p) => p.category === 'water')
    .sort((a, b) => a.distanceM - b.distanceM);
  const peak = plan.peak;
  const need = peak?.liters != null ? Math.round(peak.liters * people * 10) / 10 : null;
  let verdict: string;
  if (need == null) verdict = t('compas.sheets.water.noWalk');
  else if (plan.containers.length === 0)
    verdict = t('compas.sheets.water.noContainer', {
      liters: litres(need),
      day: String(peak?.day),
    });
  else if (plan.knownLiters == null) verdict = t('compas.sheets.water.unknownVolume');
  else if (plan.knownLiters >= need)
    verdict = t('compas.sheets.water.enough', { liters: litres(plan.knownLiters) });
  else {
    const vars = {
      liters: litres(Math.round((need - plan.knownLiters) * 10) / 10),
      day: String(peak?.day),
    };
    verdict =
      water.length > 0
        ? t('compas.sheets.water.missingRefill', vars)
        : t('compas.sheets.water.missing', vars);
  }

  return (
    <>
      <div className="cp-row" style={staticRow}>
        <span className="cp-thumb">
          <Icon name="droplet" size={20} />
        </span>
        <span className="cp-row__t">
          <b>
            {peak?.liters != null
              ? t('compas.sheets.water.perPerson', { liters: litres(peak.liters) })
              : t('compas.sheets.water.perPersonUnknown')}
          </b>
          <span>
            {peak?.liters != null
              ? `${t('compas.sheets.water.day', { day: peak.day })}${
                  people > 1
                    ? ` · ${t('compas.sheets.water.forGroup', { liters: litres(need as number), count: people })}`
                    : ''
                }`
              : t('compas.sheets.water.needStages')}
          </span>
        </span>
      </div>
      {plan.days.length > 0 && (
        <div className="cp-wx">
          {plan.days.map((d) => (
            <div key={d.day}>
              <b>
                {t('compas.sheets.common.dayShort', { day: d.day })}
                {d.date ? ` · ${wxDay(d.date)}` : ''}
              </b>
              <span>{d.liters != null ? litres(d.liters) : t('compas.sheets.common.notSet')}</span>
              <span>
                {d.walkMin != null
                  ? t('compas.sheets.water.walk', { duration: formatDuration(d.walkMin) })
                  : t('compas.sheets.water.walkUnknown')}
                {d.hot ? ` · ${t('compas.sheets.water.hot')}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="cp-note">{verdict}</p>
      <PagedList
        label={t('compas.sheets.water.containers')}
        items={plan.containers}
        empty={<p className="cp-note">{t('compas.sheets.water.noContainers')}</p>}
        render={(c) => (
          <div key={c.id} className="cp-row" style={staticRow}>
            <Thumb category={null} name={c.name} />
            <span className="cp-row__t">
              <b>{c.name}</b>
              <span>
                {c.quantity > 1 ? `${c.quantity} × · ` : ''}
                {c.liters != null ? litres(c.liters) : t('compas.sheets.water.volumeUnknown')}
              </span>
            </span>
          </div>
        )}
      />
      {ctl.data.route.id != null && (
        <PagedList
          label={t('compas.sheets.water.points')}
          items={water}
          empty={<p className="cp-note">{t('compas.sheets.water.noPoints')}</p>}
          render={(p) => (
            <div key={p.id} className="cp-row" style={staticRow}>
              <span className="cp-thumb">
                <Icon name="droplet" size={20} />
              </span>
              <span className="cp-row__t">
                <b>{poiLabel(p)}</b>
                <span>
                  {t('compas.sheets.common.distanceTrack', { distance: p.distanceM })}
                  {p.elevationM != null ? ` · ${p.elevationM} m` : ''}
                </span>
              </span>
            </div>
          )}
        />
      )}
      <p className="cp-note">
        {t('compas.sheets.water.rule', {
          perHour: litres(KIT_THRESHOLDS.waterLPerHour),
          perHourHot: litres(KIT_THRESHOLDS.waterLPerHourHot),
          temp: KIT_THRESHOLDS.sunC,
        })}
      </p>
      {water.length > 0 && <p className="cp-disc">{t('compas.sheets.common.osmCredit')}</p>}
    </>
  );
}

/**
 * Inventaire (maquette finale, onglet du Kit) : l'inventaire réel classé par
 * catégorie. Un objet déjà dans le kit ouvre sa fiche ; les autres s'ajoutent
 * d'un geste. Prêté, à entretenir, périmé : dit, jamais caché.
 */
function InventaireFlow({ ctl }: { ctl: CompasCtl }) {
  const { tripId, slug } = ctl.data.model;
  const { t, kg } = useSheetsI18n();
  const noCategory = t('compas.sheets.inventory.noCategory');
  const lineByInv = useMemo(
    () =>
      new Map(
        ctl.lines
          .filter((l) => l.inventoryItemId)
          .map((l) => [l.inventoryItemId as string, l.id] as const)
      ),
    [ctl.lines]
  );
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of ctl.data.inventory) {
      const c = i.category ?? noCategory;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    // Tri des noms : l'ordre d'avant (français) quelle que soit la langue, pour rester stable.
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
  }, [ctl.data.inventory, noCategory]);
  const [cat, setCat] = useState<string>('all');
  // Entretien et péremption : la date du jour du navigateur, pas celle d'UTC.
  const today = browserToday();
  const shown = ctl.data.inventory
    .filter((i) => cat === 'all' || (i.category ?? noCategory) === cat)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (ctl.data.inventory.length === 0)
    return (
      <p className="cp-note">
        {t('compas.sheets.common.inventoryEmpty')}{' '}
        <button
          type="button"
          className="cp-linkbtn"
          onClick={() => ctl.open({ kind: 'add', target: 'inventaire' })}
        >
          {t('compas.sheets.common.addToInventory')}
        </button>
      </p>
    );
  return (
    <>
      {cats.length > 1 && (
        <Segments
          label={t('compas.sheets.common.category')}
          value={cat}
          onChange={setCat}
          options={[
            {
              id: 'all',
              label: t('compas.sheets.common.allCount', { count: ctl.data.inventory.length }),
            },
            ...cats.map(([c, n]) => ({ id: c, label: `${c} (${n})` })),
          ]}
        />
      )}
      <PagedList
        label={t('compas.sheets.common.myInventory')}
        resetKey={cat}
        items={shown}
        render={(i) => {
          const lineId = lineByInv.get(i.id) ?? null;
          const notes = [
            i.brand,
            i.weightG != null ? kg(i.weightG) : t('compas.sheets.common.toWeigh'),
            i.isLent ? t('compas.sheets.common.lent') : null,
            i.maintenanceDueAt && i.maintenanceDueAt <= today
              ? t('compas.sheets.inventory.maintenance')
              : null,
            i.expiryDate && i.expiryDate <= today ? t('compas.sheets.inventory.expired') : null,
          ].filter(Boolean);
          return (
            <div key={i.id} className="cp-row" style={staticRow}>
              <Thumb category={i.category} name={i.name} />
              <span className="cp-row__t">
                <b>{i.name}</b>
                <span>{notes.join(' · ')}</span>
              </span>
              <span className="cp-row__end">
                {lineId ? (
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    onClick={() => ctl.open({ kind: 'item', lineId })}
                    aria-label={t('compas.sheets.inventory.itemOf', { name: i.name })}
                  >
                    {t('compas.sheets.inventory.inKit')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    disabled={ctl.busy || !ctl.data.canEdit}
                    aria-label={t('compas.sheets.inventory.addOf', { name: i.name })}
                    onClick={() =>
                      ctl.run(t('compas.sheets.common.addedToKit', { name: i.name }), () =>
                        addInventoryItemToTripAction(
                          tripId,
                          slug,
                          i.id,
                          i.name,
                          i.category ?? undefined,
                          i.weightG ?? undefined
                        )
                      )
                    }
                  >
                    {t('compas.sheets.common.add')}
                  </button>
                )}
              </span>
            </div>
          );
        }}
      />
      <p className="cp-note">{t('compas.sheets.inventory.note')}</p>
    </>
  );
}

function SacsFlow({ ctl }: { ctl: CompasCtl }) {
  const unassigned = new Set(ctl.data.model.crew.unassignedShared.map((l) => l.id));
  const rows: Array<{ kind: 'line'; line: CompasKitLine } | { kind: 'member'; id: string }> = [
    ...ctl.lines
      .filter((l) => unassigned.has(l.id))
      .map((line) => ({ kind: 'line' as const, line })),
    ...ctl.data.model.crew.loads.map((m) => ({ kind: 'member' as const, id: m.userId })),
  ];
  const { t, kg } = useSheetsI18n();
  return (
    <>
      {unassigned.size > 0 && <p className="cp-note">{t('compas.sheets.bags.tap')}</p>}
      <PagedList
        label={t('compas.sheets.bags.label')}
        items={rows}
        render={(r) => {
          if (r.kind === 'line') {
            const line = r.line;
            return (
              <button
                key={line.id}
                type="button"
                className="cp-row"
                onClick={() => ctl.open({ kind: 'carrier', lineId: line.id })}
              >
                <Thumb category={line.category} name={line.name} />
                <span className="cp-row__t">
                  <b>{line.name}</b>
                  <span>
                    {t('compas.sheets.bags.unassigned', {
                      weight:
                        line.weightGrams == null
                          ? t('compas.sheets.common.toWeigh')
                          : kg(line.weightGrams * line.quantity),
                    })}
                  </span>
                </span>
                <span className="cp-row__end">
                  <Chip tone="warn">{t('compas.sheets.bags.who')}</Chip>
                </span>
              </button>
            );
          }
          const m = ctl.data.model.crew.loads.find((x) => x.userId === r.id);
          if (!m) return null;
          return (
            <button
              key={m.userId}
              type="button"
              className="cp-row"
              onClick={() => ctl.open({ kind: 'bag', userId: m.userId })}
            >
              <MemberAvatar name={m.name} url={m.avatarUrl} />
              <span className="cp-row__t">
                <b>{t('compas.sheets.title.bagOf', { name: m.name })}</b>
                <span>
                  {kg(m.carriedGrams)}
                  {m.capacityKg != null
                    ? ` ${t('compas.sheets.bags.ofCapacity', { capacity: m.capacityKg })}`
                    : ` · ${t('compas.sheets.common.capacityUnknown')}`}
                </span>
              </span>
              <span className="cp-row__end">
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          );
        }}
      />
    </>
  );
}
