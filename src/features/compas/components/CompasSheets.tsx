'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import {
  formatDayMonth,
  formatDuration,
  formatKg,
  formatMoney,
  weatherLabel,
} from '../engine/format';
import type { CompasShopProduct } from '../server/getCompasData';
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
  compasSearchPeopleAction,
  compasInviteMemberAction,
  compasCancelInvitationAction,
  compasInviteLinkAction,
  compasRestoreMemberAction,
  compasSetMemberRoleAction,
  compasRemoveMemberAction,
  type CompasPerson,
  compasSetPartySizeAction,
  compasSearchStaysAction,
  compasSetStayAction,
  compasExplainVerdictAction,
} from '../server/compasActions';
import { KitRow, LIVE_BOOKING, MemberAvatar, lineStatus, verticalOf } from './CompasCards';
import { AffiliateDisclosure } from '@/features/affiliation/components/AffiliateDisclosure';
import {
  ROUTE_POI_LABEL,
  countByCategory,
  poiLabel,
  type RoutePoiCategory,
} from '../engine/routePois';
import type { CompasStayOffer } from '../engine/stays';
import { kitCompatibility, planKitApply, type MyKit } from '../engine/kitApply';
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
import { proposeShift, watchRules } from '../engine/watch';
import { planWater } from '../engine/water';
import { addExpenseAction } from '@/app/voyages/budget-actions';
import { RESA_CATS, bookingCat, offerCat, type ResaCat } from '../engine/resaCats';
import { RESA_EXAMPLES, type CompasLiveVertical } from '../engine/resaExamples';
import { teamCount, teamCountLabel } from '../engine/team';
import { compasSearchOffersAction } from '../server/resaActions';
import { KIT_THRESHOLDS } from '../engine/kitRules';
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

const STEP_SHEET_TITLES: Record<CompasStepId, string> = {
  ou: 'Préparer',
  nous: 'Nous',
  resa: 'Mes réservations',
  verdict: 'Verdict',
  kit: 'Kit',
};

export function sheetTitle(sheet: SheetState, ctl: CompasCtl): string {
  const line = 'lineId' in sheet ? ctl.lines.find((l) => l.id === sheet.lineId) : undefined;
  switch (sheet.kind) {
    case 'item':
      return line?.name ?? 'Objet';
    case 'acquire':
      return line ? `Trouver : ${line.name}` : 'Trouver';
    case 'add':
      return sheet.target === 'kit' ? 'Ajouter au kit' : 'Ajouter à l’inventaire';
    case 'bag':
      return sheet.userId === ctl.data.viewerId
        ? 'Mon sac'
        : `Sac de ${ctl.memberName(sheet.userId)}`;
    case 'carrier':
      return line ? `Qui porte : ${line.name}` : 'Porteur';
    case 'step':
      return STEP_SHEET_TITLES[sheet.step];
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
  return <p className="cp-note">Cet objet n’est plus dans le kit.</p>;
}

/* ---------- Fiche objet (appui long = tout, en grand) ---------- */

function ItemSheet({ ctl, lineId }: { ctl: CompasCtl; lineId: string }) {
  const line = ctl.lines.find((l) => l.id === lineId);
  const [confirm, setConfirm] = useState(false);
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
              Vital
            </Chip>
          )}
          <Chip tone="soft">{line.shared ? 'Commun' : 'Personnel'}</Chip>
          {line.kind !== 'base' && (
            <Chip>{line.kind === 'worn' ? 'Porté sur soi' : 'Consommable'}</Chip>
          )}
          {line.packed && (
            <Chip tone="good" icon="check">
              Emballé
            </Chip>
          )}
        </div>
      </div>
      <dl className="cp-kv">
        <dt>Poids</dt>
        <dd>
          {line.weightGrams == null
            ? 'à peser'
            : `${formatKg(line.weightGrams)}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
        </dd>
        <dt>Porteur</dt>
        <dd>
          {line.ownerId
            ? ctl.memberName(line.ownerId)
            : line.shared
              ? 'personne pour l’instant'
              : 'chacun le sien'}
        </dd>
        {inv && (
          <>
            <dt>Inventaire</dt>
            <dd>{[inv.brand, inv.name].filter(Boolean).join(' ')}</dd>
          </>
        )}
        {product && (
          <>
            <dt>Produit choisi</dt>
            <dd>
              {[product.brand, product.name].filter(Boolean).join(' ')}
              {product.priceEur != null ? ` · ${formatMoney(product.priceEur)}` : ''}
            </dd>
          </>
        )}
        {line.condition && (
          <>
            <dt>État</dt>
            <dd>{line.condition.replace('_', ' ')}</dd>
          </>
        )}
        {line.reason && (
          <>
            <dt>Pourquoi</dt>
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
            {line.packed ? 'Déballer' : 'Emballer'}
          </button>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            onClick={() => ctl.open({ kind: 'carrier', lineId: line.id })}
          >
            <Icon name="user-plus" size={16} />
            Porteur
          </button>
        </div>
      )}
      {line.status === 'lent' && inv && (
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={ctl.busy}
          onClick={() =>
            ctl.run(`${inv.name} récupéré`, () =>
              compasMarkReturnedAction({ inventoryItemId: inv.id })
            )
          }
        >
          <Icon name="archive-restore" size={16} />
          Je l’ai récupéré
        </button>
      )}
      {edit && line.status !== 'owned' && (
        <div className="cp-seg" role="group" aria-label="Trouver cet objet">
          {(
            [
              { id: 'emprunter', label: 'Emprunter', icon: 'handshake' },
              { id: 'louer', label: 'Louer', icon: 'calendar-days' },
              { id: 'acheter', label: 'Acheter', icon: 'shopping-bag' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={false}
              onClick={() => ctl.open({ kind: 'acquire', lineId: line.id, mode: m.id })}
            >
              <Icon name={m.icon} size={15} />
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div className="cp-actions">
        {product?.slug && (
          <Link className="cp-btn" href={`/produit/${product.slug}`}>
            <Icon name="external-link" size={16} />
            Fiche produit
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
                  const ok = await ctl.run('Retiré du kit', () =>
                    deleteTripItemAction(line.id, slug)
                  );
                  if (ok) ctl.back();
                }}
              >
                <Icon name="trash2" size={16} />
                Confirmer le retrait
              </button>
              <button type="button" className="cp-btn" onClick={() => setConfirm(false)}>
                Annuler
              </button>
            </>
          ) : (
            <button type="button" className="cp-btn" onClick={() => setConfirm(true)}>
              <Icon name="trash2" size={16} />
              Retirer du kit
            </button>
          ))}
      </div>
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
}: {
  product: CompasShopProduct;
  action: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  const tap = useDoubleTap(() => {
    if (!disabled) onAction();
  });
  const price =
    product.mode === 'location' && product.pricePerDay != null
      ? `${formatMoney(product.pricePerDay)} / jour`
      : formatMoney(product.priceEur);
  return (
    <div
      className="cp-row"
      style={{ cursor: 'default' }}
      title={disabled ? undefined : `Double-touche : ${action.toLowerCase()}`}
      {...tap}
    >
      <Thumb
        image={product.image}
        alt={product.imageAlt}
        category={product.category}
        name={product.name}
      />
      <span className="cp-row__t">
        <b>{product.name}</b>
        <span>
          {[product.brand, product.weightG != null ? formatKg(product.weightG) : null, price]
            .filter(Boolean)
            .join(' · ')}
          {/* Une note sans avis n'est pas une note : « ★ 0 » laissait croire à un produit mal noté. */}
          {product.rating != null && (product.reviewCount ?? 0) > 0
            ? ` · ★ ${product.rating.toLocaleString('fr-FR')} (${product.reviewCount} avis)`
            : ''}
        </span>
      </span>
      <span className="cp-row__end">
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
  const [mode, setMode] = useState<AcquireMode>(initialMode);
  const { query, setQuery, matches } = useTextFilter();
  const { tripId, slug } = ctl.data.model;

  const products = useMemo(() => {
    if (!line) return [];
    const wanted = mode === 'louer' ? 'location' : 'achat';
    return ctl.data.shop
      .filter(
        (p) => (p.mode ?? 'achat') === wanted || (mode === 'acheter' && p.mode === 'occasion')
      )
      .map((p) => ({ p, score: relevance(line, p) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [ctl.data.shop, line, mode]);
  const shown = products.filter((p) => matches(p.name, p.brand, p.category));

  if (!line) return <Missing />;

  return (
    <>
      <Segments
        label="Comment trouver l’objet"
        value={mode}
        onChange={setMode}
        options={[
          { id: 'emprunter', label: 'Emprunter', icon: 'handshake' },
          { id: 'louer', label: 'Louer', icon: 'calendar-days' },
          { id: 'acheter', label: 'Acheter', icon: 'shopping-bag' },
        ]}
      />
      {mode === 'emprunter' ? (
        <>
          <p className="cp-note">
            Quelqu’un de l’équipe l’a ? Il le porte pour le groupe : l’objet devient commun.
          </p>
          <PagedList
            label="Équipe"
            items={ctl.data.model.crew.loads.filter((m) => m.userId !== ctl.data.viewerId)}
            empty={
              <p className="cp-note">
                Personne d’autre dans l’équipe pour l’instant.{' '}
                <button
                  type="button"
                  className="cp-linkbtn"
                  onClick={() => ctl.open({ kind: 'step', step: 'nous', flow: 'qui' })}
                >
                  Ajouter quelqu’un
                </button>
              </p>
            }
            render={(m) => (
              <div key={m.userId} className="cp-row" style={{ cursor: 'default' }}>
                <MemberAvatar name={m.name} url={m.avatarUrl} />
                <span className="cp-row__t">
                  <b>{m.name}</b>
                  <span>porte déjà {formatKg(m.carriedGrams)}</span>
                </span>
                <span className="cp-row__end">
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    disabled={ctl.busy}
                    onClick={async () => {
                      const ok = await ctl.run(`${m.name} porte ${line.name}`, () =>
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
                    Emprunter
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
            placeholder={`Chercher ${mode === 'louer' ? 'une location' : 'un produit'}`}
          />
          <PagedList
            label={mode === 'louer' ? 'Locations' : 'Produits'}
            resetKey={`${mode}-${query}`}
            items={shown}
            empty={
              <p className="cp-note">
                {mode === 'louer' ? (
                  <>
                    Aucune location disponible dans la boutique pour l’instant.{' '}
                    <Link href="/location">Voir la location</Link>
                  </>
                ) : (
                  'Aucun produit ne correspond.'
                )}
              </p>
            }
            render={(p) => (
              <ProductRow
                key={p.id}
                product={p}
                action={line.shopProductId === p.id ? 'Choisi' : 'Choisir'}
                disabled={ctl.busy || line.shopProductId === p.id}
                onAction={async () => {
                  const ok = await ctl.run('Ajouté au panier et relié au kit', () =>
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
          <div className="cp-actions">
            <Link className="cp-btn cp-btn--soft" href="/panier">
              <Icon name="shopping-cart" size={16} />
              Voir le panier
            </Link>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Ajouter : inventaire, boutique, objet libre ---------- */

const CATEGORIES = [
  { id: 'safety', label: 'Sécurité' },
  { id: 'shelter', label: 'Abri' },
  { id: 'sleep', label: 'Couchage' },
  { id: 'clothing', label: 'Vêtements' },
  { id: 'cook', label: 'Cuisine' },
  { id: 'water', label: 'Eau' },
  { id: 'tech', label: 'Électronique' },
  { id: 'misc', label: 'Divers' },
] as const;

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
          { id: 'inventaire', label: 'Inventaire', icon: 'archive' },
          { id: 'boutique', label: 'Boutique', icon: 'shopping-bag' },
          { id: 'libre', label: 'Autre', icon: 'plus' },
        ] as const)
      : ([
          { id: 'boutique', label: 'Boutique', icon: 'shopping-bag' },
          { id: 'libre', label: 'Autre', icon: 'plus' },
        ] as const);

  return (
    <>
      <Segments label="Source" value={source} onChange={setSource} options={options} />
      {source !== 'libre' && (
        <SearchField value={query} onChange={setQuery} placeholder="Chercher" />
      )}
      {source === 'inventaire' && (
        <PagedList
          label="Mon inventaire"
          resetKey={query}
          items={inventory}
          empty={
            <p className="cp-note">
              {ctl.data.inventory.length
                ? 'Tout ton inventaire est déjà dans le kit.'
                : 'Ton inventaire est vide.'}{' '}
              <button
                type="button"
                className="cp-linkbtn"
                onClick={() => ctl.open({ kind: 'add', target: 'inventaire' })}
              >
                Ajouter à l’inventaire
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
                    i.weightG != null ? formatKg(i.weightG) : 'à peser',
                    i.isLent ? 'prêté' : null,
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
                    ctl.run(`${i.name} ajouté au kit`, () =>
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
                  Ajouter
                </button>
              </span>
            </div>
          )}
        />
      )}
      {source === 'boutique' && (
        <PagedList
          label="Boutique"
          resetKey={query}
          items={shop}
          empty={
            <p className="cp-note">
              Aucun produit ne correspond{query.trim() ? ` à « ${query.trim()} »` : ''}.{' '}
              {query.trim() && (
                <button type="button" className="cp-linkbtn" onClick={() => setQuery('')}>
                  Voir toute la boutique
                </button>
              )}
            </p>
          }
          render={(p) => (
            <ProductRow
              key={p.id}
              product={p}
              action="Ajouter"
              disabled={ctl.busy}
              onAction={() =>
                target === 'kit'
                  ? ctl.run(`${p.name} ajouté au kit`, () =>
                      compasAddShopProductToTripAction({
                        tripId,
                        tripSlug: slug,
                        shopProductId: p.id,
                      })
                    )
                  : ctl.run(`${p.name} ajouté à l’inventaire`, () =>
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
      ok = await ctl.run(`${name} ajouté au kit`, () => addCustomTripItemAction(tripId, slug, fd));
    } else {
      const cat = CATEGORIES.find((c) => c.id === fd.get('category'))?.label;
      ok = await ctl.run(`${name} ajouté à l’inventaire`, () =>
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
        Nom
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
          Catégorie
          <select name="category" defaultValue="misc">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cp-field">
          Poids (g), si connu
          <input name="weightGrams" type="number" inputMode="numeric" min={1} max={1000000} />
        </label>
      </div>
      {target === 'kit' && (
        <div className="cp-actions">
          <label className="cp-check">
            <input type="checkbox" name="isVital" /> Vital
          </label>
          <label className="cp-check">
            <input type="checkbox" name="isConsumable" /> Consommable
          </label>
          <label className="cp-field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            Quantité
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
        Ajouter
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
  if (!load) return <p className="cp-note">Cette personne ne fait plus partie de l’équipe.</p>;
  const pct = load.ratio == null ? null : Math.round(load.ratio * 100);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MemberAvatar name={load.name} url={load.avatarUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{formatKg(load.carriedGrams)}</b>
          <span className="cp-note">
            {' '}
            {load.capacityKg != null
              ? `sur ${load.capacityKg} kg de capacité`
              : '· capacité non renseignée'}
          </span>
          {pct != null && (
            <div
              className="cp-meter"
              data-tone={pct > 100 ? 'bad' : pct > 85 ? 'warn' : undefined}
              style={{ marginTop: 6 }}
            >
              <i style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          )}
        </div>
      </div>
      <PagedList
        label="Contenu du sac"
        items={lines}
        empty={<p className="cp-note">Rien dans ce sac pour l’instant.</p>}
        render={(line) => <KitRow key={line.id} line={line} ctl={ctl} />}
      />
    </>
  );
}

/* ---------- Porteur ---------- */

function CarrierSheet({ ctl, lineId }: { ctl: CompasCtl; lineId: string }) {
  const line = ctl.lines.find((l) => l.id === lineId);
  const [shared, setShared] = useState(line?.shared ?? true);
  if (!line) return <Missing />;
  const { tripId, slug } = ctl.data.model;
  const assign = async (carrierId: string | null) => {
    const who = carrierId ? ctl.memberName(carrierId) : 'personne';
    const ok = await ctl.run(
      carrierId ? `${who} porte ${line.name}` : `${line.name} sans porteur`,
      () => compasSetCarrierAction({ tripId, tripSlug: slug, itemId: line.id, carrierId, shared })
    );
    if (ok) ctl.back();
  };
  return (
    <>
      <Segments
        label="Type d’objet"
        value={shared ? 'commun' : 'perso'}
        onChange={(v) => setShared(v === 'commun')}
        options={[
          { id: 'commun', label: 'Commun au groupe', icon: 'users' },
          { id: 'perso', label: 'Personnel', icon: 'user' },
        ]}
      />
      <PagedList
        label="Équipe"
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
                {m.name}
                {m.userId === ctl.data.viewerId ? ' (moi)' : ''}
              </b>
              <span>
                porte {formatKg(m.carriedGrams)}
                {m.capacityKg != null ? ` sur ${m.capacityKg} kg` : ''}
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
          Personne pour l’instant
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
      aria-label="Onglet précédent"
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
      Suivant
      <Icon name="chevron-right" size={16} />
    </button>
  ) : (
    <button type="button" className="cp-btn cp-btn--pg cp-sheet__next" onClick={() => ctl.close()}>
      Terminer
      <Icon name="check" size={16} />
    </button>
  );
  return (
    <>
      <Segments
        label="Parcours du tiroir"
        value={flow}
        onChange={(f) => ctl.replace({ kind: 'step', step, flow: f })}
        options={flows.map((f) => ({ id: f.id as StepFlow, label: f.label, icon: f.icon }))}
      />
      {step === 'ou' && flow === 'activite' && <ActiviteFlow ctl={ctl} />}
      {step === 'ou' && flow === 'parcours' && (
        <ParcoursFlow key={hint?.query ?? 'p'} ctl={ctl} hint={hint} />
      )}
      {step === 'ou' && flow === 'trace' && <TraceFlow ctl={ctl} />}
      {step === 'ou' && flow === 'sac' && <MesKitsFlow ctl={ctl} />}
      {step === 'ou' && flow === 'quand' && (
        <QuandFlow key={hint?.hours ?? 'q'} ctl={ctl} hint={hint} />
      )}
      {step === 'ou' && flow === 'preferences' && <PreferencesFlow ctl={ctl} />}
      {step === 'nous' && flow === 'equipe' && <EquipeFlow ctl={ctl} />}
      {step === 'nous' && flow === 'qui' && <QuiFlow ctl={ctl} />}
      {step === 'nous' && flow === 'budget' && <BudgetFlow ctl={ctl} />}
      {step === 'resa' && flow === 'nuits' && <NuitsFlow ctl={ctl} focusDay={hint?.day} />}
      {step === 'resa' && flow === 'reservations' && <ReservationsFlow ctl={ctl} />}
      {step === 'resa' && flow === 'offres' && (
        <OffresFlow key={hint?.resa ?? 'all'} ctl={ctl} initialCat={hint?.resa} />
      )}
      {step === 'verdict' && flow === 'raisons' && <RaisonsFlow ctl={ctl} />}
      {step === 'nous' && flow === 'annonce' && <AnnonceFlow ctl={ctl} />}
      {step === 'resa' && flow === 'etats' && <EtatsFlow ctl={ctl} />}
      {step === 'verdict' && flow === 'meteo' && <MeteoFlow ctl={ctl} />}
      {step === 'verdict' && flow === 'veille' && <VeilleFlow ctl={ctl} />}
      {step === 'verdict' && flow === 'sources' && <SourcesFlow ctl={ctl} />}
      {step === 'kit' && (flow === 'trouver' || flow === 'emballer' || flow === 'tout') && (
        <KitListFlow ctl={ctl} flow={flow} />
      )}
      {step === 'kit' && flow === 'conseils' && <ConseilsFlow ctl={ctl} />}
      {step === 'kit' && flow === 'mes-kits' && <MesKitsFlow ctl={ctl} />}
      {step === 'kit' && flow === 'inventaire' && <InventaireFlow ctl={ctl} />}
      {step === 'kit' && flow === 'sacs' && <SacsFlow ctl={ctl} />}
      {step === 'kit' && flow === 'eau' && <EauFlow ctl={ctl} />}
      {ctl.data.canEdit ? (
        <DisLe
          key={hint?.say ?? 'disle'}
          ctl={ctl}
          initial={hint?.say}
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

const staticRow = { cursor: 'default' } as const;

const LEVELS: Record<string, string> = {
  beginner: 'débutant',
  intermediate: 'intermédiaire',
  advanced: 'confirmé',
  expert: 'expert',
};

function PartySize({ ctl }: { ctl: CompasCtl }) {
  const { crew, tripId, slug } = ctl.data.model;
  const set = (n: number) =>
    void ctl.run('Nombre de personnes mis à jour', () =>
      compasSetPartySizeAction({ tripId, tripSlug: slug, partySize: n })
    );
  return (
    <div className="cp-between">
      <span className="cp-sub">
        <b>{crew.size}</b> personne{crew.size > 1 ? 's' : ''} dans ce voyage
        {crew.guests > 0 ? ` · dont ${crew.guests} sans compte dans le groupe` : ''}
      </span>
      {ctl.data.canEdit && (
        <span className="cp-actions" style={{ gap: 8 }}>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            aria-label="Une personne de moins"
            disabled={ctl.busy || crew.size <= Math.max(1, crew.loads.length)}
            onClick={() => set(crew.size - 1)}
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            type="button"
            className="cp-btn cp-btn--soft"
            aria-label="Une personne de plus"
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
  const { crew } = ctl.data.model;
  const slowest = crew.pace.slowest;
  return (
    <>
      <PartySize ctl={ctl} />
      <p className="cp-note">
        {slowest
          ? `Le groupe marche au rythme de ${slowest.name} (${String(slowest.speedKmh).replace('.', ',')} km/h à plat). Allure connue pour ${crew.pace.known} sur ${crew.pace.total}.`
          : 'Aucune allure connue : les temps de marche utilisent 4 km/h par défaut. Chaque membre peut la renseigner dans son profil terrain.'}
      </p>
      <PagedList
        label="Équipe"
        items={crew.loads}
        render={(m) => {
          const pct = m.ratio == null ? null : Math.round(m.ratio * 100);
          const level = m.experienceLevel ? (LEVELS[m.experienceLevel] ?? m.experienceLevel) : null;
          return (
            <button
              key={m.userId}
              type="button"
              className="cp-row"
              onClick={() => ctl.open({ kind: 'bag', userId: m.userId })}
            >
              <MemberAvatar name={m.name} url={m.avatarUrl} />
              <span className="cp-row__t">
                <b>
                  {m.name}
                  {m.userId === ctl.data.viewerId ? ' (moi)' : ''}
                </b>
                <span>
                  porte {formatKg(m.carriedGrams)}
                  {m.capacityKg != null ? ` sur ${m.capacityKg} kg` : ' · capacité non renseignée'}
                </span>
                <span>
                  {m.flatSpeedKmh != null
                    ? `${String(m.flatSpeedKmh).replace('.', ',')} km/h`
                    : 'allure non renseignée'}
                  {` · niveau ${level ?? 'non renseigné'}`}
                </span>
              </span>
              <span className="cp-row__end">
                {pct != null && (
                  <Chip tone={pct > 100 ? 'bad' : pct > 90 ? 'warn' : 'good'}>{pct} %</Chip>
                )}
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          );
        }}
      />
      <div className="cp-actions">
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          onClick={() => ctl.replace({ kind: 'step', step: 'nous', flow: 'qui' })}
        >
          <Icon name="user-plus" size={16} />
          Ajouter quelqu’un ou gérer les rôles
        </button>
      </div>
    </>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Organisateur',
  editor: 'Peut modifier',
  viewer: 'Lecture seule',
  member: 'Membre du groupe',
};

/**
 * Lien d'invitation pour l'extérieur : à coller dans un message, un club, un
 * groupe, un commentaire ou une autre application. Qui l'ouvre accepte ou
 * refuse ; l'accès au voyage vient seulement après acceptation.
 */
function InviteLinkBlock({ ctl, role }: { ctl: CompasCtl; role: 'editor' | 'viewer' }) {
  const { model } = ctl.data;
  const [link, setLink] = useState<{ url: string; role: 'editor' | 'viewer' } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = link?.role === role ? link.url : null;

  const create = async () => {
    setBusy(true);
    try {
      const res = await compasInviteLinkAction({ tripId: model.tripId, role });
      if (!res.success) return ctl.notify(res.error, 'bad');
      setLink({ url: `${window.location.origin}${res.path}`, role });
    } catch {
      ctl.notify('Connexion perdue : réessaie.', 'bad');
    } finally {
      setBusy(false);
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      ctl.notify('Lien copié', undefined, 'À coller dans un message, un club ou un groupe');
    } catch {
      ctl.notify('Copie impossible : sélectionne le lien.', 'bad');
    }
  };
  const share = async (url: string) => {
    if (typeof navigator.share !== 'function') return copy(url);
    try {
      await navigator.share({ title: model.title, text: `Rejoins « ${model.title} »`, url });
    } catch {
      /* partage refermé */
    }
  };

  return (
    <>
      <p className="cp-sub">
        <b>Lien d’invitation</b> · pour l’extérieur de l’app, un message, un club ou un groupe
      </p>
      {current ? (
        <div className="cp-row" style={staticRow}>
          <span className="cp-row__t">
            <b style={{ wordBreak: 'break-all' }}>{current.replace(/^https?:\/\//, '')}</b>
            <span>{ROLE_LABEL[role]} · valable 30 jours</span>
          </span>
          <span className="cp-row__end">
            <button type="button" className="cp-btn" onClick={() => void copy(current)}>
              Copier
            </button>
            <button type="button" className="cp-btn cp-btn--pg" onClick={() => void share(current)}>
              Partager
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className="cp-btn cp-btn--pg"
          disabled={busy}
          onClick={() => void create()}
        >
          {busy ? 'Création du lien…' : 'Créer le lien d’invitation'}
        </button>
      )}
    </>
  );
}

/**
 * Nous · Qui (maquette finale) : inviter qui on veut sans quitter le Compas.
 * Sans recherche : les personnes que je suis ; sinon par nom. L'invité
 * accepte ou refuse (notification, lien) et n'accède qu'après avoir accepté.
 */
function QuiFlow({ ctl }: { ctl: CompasCtl }) {
  const { model, viewerId, canEdit } = ctl.data;
  const pending = ctl.data.pendingInvites ?? [];
  const count = teamCountLabel(teamCount(model.crew.size, model.crew.loads.length, pending.length));
  const isOwner = viewerId != null && viewerId === model.ownerId;
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [state, setState] = useState<
    | { status: 'idle' | 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ok'; people: CompasPerson[]; searched: string }
  >({ status: 'idle' });

  // Seule la dernière recherche s'affiche : une réponse en retard est ignorée.
  const seq = useRef(0);
  const search = async (q: string) => {
    const mine = ++seq.current;
    setState({ status: 'loading' });
    try {
      const res = await compasSearchPeopleAction({ tripId: model.tripId, query: q });
      if (mine !== seq.current) return;
      setState(
        res.success
          ? { status: 'ok', people: res.people, searched: q }
          : { status: 'error', error: res.error }
      );
    } catch {
      if (mine === seq.current)
        setState({ status: 'error', error: 'Connexion perdue : réessaie.' });
    }
  };

  useEffect(() => {
    if (canEdit) void search('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suggestions à l'ouverture seulement
  }, [canEdit]);

  const invite = async (p: CompasPerson) => {
    let invitationId: string | undefined;
    const ok = await ctl.run(
      `Invitation envoyée à ${p.name}`,
      async () => {
        const res = await compasInviteMemberAction({
          tripId: model.tripId,
          tripSlug: model.slug,
          userId: p.userId,
          role,
          source: p.followed ? 'friend' : 'direct',
        });
        if (res.success) invitationId = res.invitationId;
        return res;
      },
      async () =>
        invitationId
          ? compasCancelInvitationAction({ tripId: model.tripId, invitationId })
          : { success: false, error: 'Invitation introuvable.' }
    );
    if (ok && state.status === 'ok')
      setState({ ...state, people: state.people.filter((x) => x.userId !== p.userId) });
  };

  return (
    <>
      {canEdit ? (
        <>
          <form
            className="cp-intent"
            role="search"
            aria-label="Chercher quelqu’un"
            onSubmit={(e) => {
              e.preventDefault();
              void search(query.trim());
            }}
          >
            <Icon name="search" size={15} aria-hidden="true" />
            <label className="sr-only" htmlFor="cp-qui-q">
              Nom
            </label>
            <input
              id="cp-qui-q"
              type="search"
              value={query}
              maxLength={60}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Nom d’un voyageur LKDV"
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <Segments
            label="Rôle proposé"
            value={role}
            onChange={setRole}
            options={[
              { id: 'editor', label: 'Peut modifier' },
              { id: 'viewer', label: 'Lecture seule' },
            ]}
          />
          {state.status === 'loading' && <p className="cp-note">Recherche…</p>}
          {state.status === 'error' && <p className="cp-note">{state.error}</p>}
          {state.status === 'ok' && (
            <PagedList
              label={state.searched ? 'Résultats' : 'Personnes que tu suis'}
              items={state.people}
              empty={
                <p className="cp-note">
                  {state.searched
                    ? 'Personne à ce nom (ou déjà dans le voyage).'
                    : 'Tape un nom pour trouver un voyageur LKDV.'}
                </p>
              }
              render={(p) => (
                <div key={p.userId} className="cp-row" style={staticRow}>
                  <MemberAvatar name={p.name} url={p.avatarUrl} />
                  <span className="cp-row__t">
                    <b>{p.name}</b>
                    <span>
                      {[p.followed ? 'tu le suis' : null, p.location].filter(Boolean).join(' · ') ||
                        'voyageur LKDV'}
                    </span>
                  </span>
                  <span className="cp-row__end">
                    <button
                      type="button"
                      className="cp-btn cp-btn--pg"
                      disabled={ctl.busy}
                      aria-label={`Inviter ${p.name}`}
                      onClick={() => void invite(p)}
                    >
                      Inviter
                    </button>
                  </span>
                </div>
              )}
            />
          )}
        </>
      ) : (
        <p className="cp-note">Lecture seule : seuls les organisateurs invitent des personnes.</p>
      )}

      {canEdit && <InviteLinkBlock ctl={ctl} role={role} />}

      {pending.length > 0 && (
        <>
          <p className="cp-sub">
            <b>En attente</b> · accès au voyage après acceptation
          </p>
          <TallList
            label="Invitations en attente"
            items={pending}
            empty={null}
            render={(inv) => (
              <div key={inv.id} className="cp-row" style={staticRow}>
                <MemberAvatar name={inv.name} url={inv.avatarUrl} />
                <span className="cp-row__t">
                  <b>{inv.name}</b>
                  <span>Invité · {ROLE_LABEL[inv.role].toLowerCase()}</span>
                </span>
                {canEdit && (
                  <span className="cp-row__end">
                    <button
                      type="button"
                      className="cp-btn cp-btn--bad"
                      disabled={ctl.busy}
                      aria-label={`Annuler l’invitation de ${inv.name}`}
                      onClick={() =>
                        void ctl.run(`Invitation de ${inv.name} annulée`, () =>
                          compasCancelInvitationAction({
                            tripId: model.tripId,
                            invitationId: inv.id,
                          })
                        )
                      }
                    >
                      Annuler
                    </button>
                  </span>
                )}
              </div>
            )}
          />
        </>
      )}

      <p className="cp-sub">
        <b>Dans le voyage</b> · {count}
      </p>
      <TallList
        label="Membres du voyage"
        items={model.crew.loads}
        empty={<p className="cp-note">Personne pour l’instant.</p>}
        render={(m) => {
          const editable = isOwner && m.userId !== model.ownerId && m.role !== 'member';
          return (
            <div key={m.userId} className="cp-row" style={staticRow}>
              <MemberAvatar name={m.name} url={m.avatarUrl} />
              <span className="cp-row__t">
                <b>
                  {m.name}
                  {m.userId === viewerId ? ' (moi)' : ''}
                </b>
                <span>
                  {m.userId === model.ownerId
                    ? ROLE_LABEL.owner
                    : (ROLE_LABEL[m.role ?? ''] ?? 'Membre')}
                </span>
              </span>
              {editable && (
                <span className="cp-row__end">
                  <select
                    aria-label={`Rôle de ${m.name}`}
                    value={m.role === 'viewer' ? 'viewer' : 'editor'}
                    disabled={ctl.busy}
                    onChange={(e) => {
                      const next = e.target.value === 'viewer' ? 'viewer' : 'editor';
                      void ctl.run(`${m.name} : ${ROLE_LABEL[next].toLowerCase()}`, () =>
                        compasSetMemberRoleAction({
                          tripId: model.tripId,
                          tripSlug: model.slug,
                          userId: m.userId,
                          role: next,
                        })
                      );
                    }}
                  >
                    <option value="editor">Peut modifier</option>
                    <option value="viewer">Lecture seule</option>
                  </select>
                  <button
                    type="button"
                    className="cp-btn cp-btn--bad"
                    disabled={ctl.busy}
                    aria-label={`Retirer ${m.name} du voyage`}
                    onClick={() =>
                      void ctl.run(
                        `${m.name} retiré du voyage`,
                        () =>
                          compasRemoveMemberAction({
                            tripId: model.tripId,
                            tripSlug: model.slug,
                            userId: m.userId,
                          }),
                        () =>
                          compasRestoreMemberAction({
                            tripId: model.tripId,
                            tripSlug: model.slug,
                            userId: m.userId,
                            role: m.role === 'viewer' ? 'viewer' : 'editor',
                          })
                      )
                    }
                  >
                    Retirer
                  </button>
                </span>
              )}
            </div>
          );
        }}
      />
    </>
  );
}

function SettlementBlock({ ctl }: { ctl: CompasCtl }) {
  const { crew, budget } = ctl.data.model;
  const st = crew.settlement;
  if (!st.countedAmount && !st.excludedCount) return null;
  return (
    <>
      <p className="cp-sub">
        <b>Qui doit quoi</b> · dépenses réelles partagées{' '}
        {formatMoney(st.countedAmount, budget.currency)}
      </p>
      {st.debts.length === 0 ? (
        <p className="cp-note">Les comptes sont équilibrés.</p>
      ) : (
        <ul className="cp-props">
          {st.debts.map((d) => (
            <li key={`${d.fromUserId}-${d.toUserId}`}>
              <b>{d.fromUserId === ctl.data.viewerId ? 'Toi' : d.fromName}</b> doit{' '}
              {formatMoney(d.amount, budget.currency)} à{' '}
              <b>{d.toUserId === ctl.data.viewerId ? 'toi' : d.toName}</b>
            </li>
          ))}
        </ul>
      )}
      {st.excludedCount > 0 && (
        <p className="cp-note">
          {st.excludedCount} dépense{st.excludedCount > 1 ? 's' : ''} à parts libres (
          {formatMoney(st.excludedAmount, budget.currency)}) non incluse
          {st.excludedCount > 1 ? 's' : ''} : la répartition exacte n’est pas calculée ici.
        </p>
      )}
    </>
  );
}

function BudgetFlow({ ctl }: { ctl: CompasCtl }) {
  const b = ctl.data.model.budget;
  const total = b.byCategory.reduce((t, c) => t + c.amount, 0);
  const { tripId, slug } = ctl.data.model;
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get('amount') ?? '')
      .replace(',', '.')
      .trim();
    const amount = raw === '' ? null : Number(raw);
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      ctl.notify('Montant invalide', 'bad');
      return;
    }
    const before = ctl.data.model.budget.target;
    void ctl.run(
      amount == null ? 'Enveloppe retirée' : 'Enveloppe enregistrée',
      () => compasSetBudgetAction({ tripId, tripSlug: slug, amount }),
      () => compasSetBudgetAction({ tripId, tripSlug: slug, amount: before })
    );
  };
  return (
    <>
      {ctl.data.canEdit && (
        <form onSubmit={onSubmit} className="cp-actions" style={{ alignItems: 'flex-end' }}>
          <label className="cp-field" style={{ flex: 1 }}>
            Enveloppe du voyage ({b.currency})
            <input
              key={b.target ?? 'vide'}
              name="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              defaultValue={b.target ?? ''}
              placeholder="Montant total"
            />
          </label>
          <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
            Enregistrer
          </button>
        </form>
      )}
      <dl className="cp-kv">
        <dt>Enveloppe</dt>
        <dd>{b.target != null ? formatMoney(b.target, b.currency) : 'non fixée'}</dd>
        <dt>Prévu</dt>
        <dd>{formatMoney(b.planned, b.currency)}</dd>
        <dt>Dépensé</dt>
        <dd>{formatMoney(b.spent, b.currency)}</dd>
        <dt>Par personne</dt>
        <dd>{formatMoney(b.perPerson, b.currency)}</dd>
      </dl>
      {ctl.data.canEdit && <ExpenseForm ctl={ctl} />}
      <SettlementBlock ctl={ctl} />
      <PagedList
        label="Dépenses par catégorie"
        items={b.byCategory}
        empty={<p className="cp-note">Aucune dépense saisie pour ce voyage.</p>}
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
            <span className="cp-row__end">{formatMoney(c.amount, b.currency)}</span>
          </div>
        )}
      />
    </>
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
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<'groupe' | 'pers'>('groupe');
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
        Ajouter une dépense
      </button>
    );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title') ?? '').trim();
    if (title.length < 2 || total == null) {
      ctl.notify('Nom (2 lettres au moins) et montant positif', 'bad');
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
      .run(`Dépense ajoutée : ${title}`, () => addExpenseAction(null, fd))
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
        Nom
        <input name="title" placeholder="Parking, guide, cadeau…" maxLength={100} required />
      </label>
      <div className="cp-actions" style={{ alignItems: 'flex-end' }}>
        <label className="cp-field" style={{ flex: 1 }}>
          Montant ({budget.currency})
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
          Catégorie
          <select name="category" defaultValue="divers">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Segments
        label="Montant pour"
        value={unit}
        onChange={setUnit}
        options={[
          { id: 'groupe', label: 'Groupe' },
          { id: 'pers', label: 'Par pers.' },
        ]}
      />
      <Segments
        label="État"
        value={paid}
        onChange={setPaid}
        options={[
          { id: 'prevue', label: 'Prévue' },
          { id: 'payee', label: 'Payée par moi' },
        ]}
      />
      <p className="cp-note">
        {total == null
          ? 'Montant à saisir.'
          : unit === 'pers'
            ? `Soit ${formatMoney(total, budget.currency)} pour ${crew.size} personne${crew.size > 1 ? 's' : ''}, partagé à parts égales.`
            : `${formatMoney(total, budget.currency)}, partagé à parts égales.`}
      </p>
      <div className="cp-actions">
        <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
          Ajouter
        </button>
        <button type="button" className="cp-btn" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Catégories du budget (mêmes valeurs que le Hub). */
const EXPENSE_CATEGORIES = [
  'hébergement',
  'nourriture',
  'transport',
  'activités',
  'matériel',
  'divers',
];

/**
 * Annonce (maquette finale : publier pour trouver des compagnons). Dans LKDV,
 * c'est la « Bouteille à la mer » du pays (seuil de confiance, majorité,
 * frais annoncés, chaque profil validé) et la gestion du groupe reste au Hub :
 * le Compas y mène, il ne publie rien lui-même.
 */
/** Nom du pays en français (« fr » → « France »), le code si inconnu. */
function countryLabel(code: string | null): string {
  if (!code) return 'non renseigné';
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code.toUpperCase();
  }
}

const MIXITE_LABEL = { all: 'Ouvert à tous', women_only: 'Femmes', men_only: 'Hommes' } as const;

/**
 * Nous · Bouteille à la mer (maquette finale) : le tiroir où l'on règle
 * l'annonce — où (le pays du voyage), à qui (confiance minimale, mixité,
 * places), quand, le message — puis où l'on accepte ou refuse chaque
 * candidature. Une personne acceptée rejoint aussi le voyage.
 */
function AnnonceFlow({ ctl }: { ctl: CompasCtl }) {
  const { crew, dates, tripId, slug, title } = ctl.data.model;
  const free = Math.max(0, crew.size - crew.loads.length);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: string }
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
      .catch(() => alive && setState({ status: 'error', error: 'Connexion perdue : réessaie.' }));
    return () => {
      alive = false;
    };
  }, [tripId, reload]);

  const launch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get('bottleAdult') !== 'on') {
      ctl.notify('Certifie avoir 18 ans ou plus', 'bad');
      return;
    }
    const date = (k: string) => {
      const v = String(fd.get(k) ?? '');
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    };
    const ok = await ctl.run('Bouteille à la mer lancée', () =>
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
        'Bouteille à la mer lancée',
        undefined,
        `Visible dans la communauté du pays · confiance ≥ ${minTrust}`
      );
      setReload((n) => n + 1);
    }
  };

  const answer = async (groupId: string, a: CompasBottleApplicant, accept: boolean) => {
    const ok = await ctl.run(
      accept ? `${a.name} rejoint le groupe et le voyage` : `Demande de ${a.name} refusée`,
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
            {crew.loads.length} membre{crew.loads.length > 1 ? 's' : ''} sur {crew.size} prévu
            {crew.size > 1 ? 's' : ''}
          </b>
          <span>
            {free > 0 ? `${free} place${free > 1 ? 's' : ''} à pourvoir` : 'Le groupe est complet'}
            {dates.start ? ` · départ le ${formatDayMonth(dates.start)}` : ''}
          </span>
        </span>
      </div>

      {state.status === 'loading' && <p className="cp-note">Lecture de tes bouteilles…</p>}
      {state.status === 'error' && <p className="cp-note">{state.error}</p>}

      {st?.bottles.map((b) => (
        <section key={b.id} className="cp-bottle cp-glass" aria-label={`Bouteille : ${b.name}`}>
          <div className="cp-bottle__h">
            <b>{b.name}</b>
            <Chip tone="good">En mer</Chip>
          </div>
          <span className="cp-sub">
            {b.departure ? formatDayMonth(b.departure) : 'dates libres'}
            {b.returnDate ? ` → ${formatDayMonth(b.returnDate)}` : ''} · {b.activeCount}/
            {b.maxMembers} places · confiance ≥ {b.minTrust} · {MIXITE_LABEL[b.mixite]}
          </span>
          {b.applicants.length === 0 ? (
            <p className="cp-note">Aucune candidature pour l’instant.</p>
          ) : (
            b.applicants.map((a) => (
              <div key={a.memberId} className="cp-row" style={staticRow}>
                <MemberAvatar name={a.name} url={a.avatarUrl} />
                <span className="cp-row__t">
                  <b>{a.name}</b>
                  <span>
                    {a.trustScore != null ? `confiance ${a.trustScore}/100` : 'confiance inconnue'}
                  </span>
                </span>
                <span className="cp-row__end">
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    disabled={ctl.busy}
                    aria-label={`Refuser ${a.name}`}
                    onClick={() => void answer(b.id, a, false)}
                  >
                    Refuser
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn--pg"
                    disabled={ctl.busy}
                    aria-label={`Accepter ${a.name}`}
                    onClick={() => void answer(b.id, a, true)}
                  >
                    Accepter
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
              const ok = await ctl.run('Bouteille retirée de la communauté', () =>
                compasCloseBottleAction({ tripId, tripSlug: slug, groupId: b.id })
              );
              if (ok) setReload((n) => n + 1);
            }}
          >
            Retirer de la communauté
          </button>
        </section>
      ))}

      {st && !st.canLaunch && st.blocked && <p className="cp-note">{st.blocked}</p>}

      {st?.canLaunch && (
        <form className="cp-bottle cp-glass" onSubmit={launch} aria-label="Lancer une bouteille">
          <div className="cp-bottle__h">
            <b>
              <Icon name="send" size={15} aria-hidden="true" /> Lancer une bouteille à la mer
            </b>
          </div>
          <p className="cp-sub">
            <b>Où</b> · communauté du pays : {countryLabel(st.country)}
          </p>
          <label className="cp-field">
            Titre
            <input
              name="bottleName"
              required
              minLength={3}
              maxLength={80}
              defaultValue={title.slice(0, 80)}
            />
          </label>
          <p className="cp-sub">
            <b>À qui</b>
          </p>
          <label className="cp-field">
            Confiance minimale : {minTrust}/100
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
            label="Mixité"
            value={mixite}
            onChange={setMixite}
            options={[
              { id: 'all', label: MIXITE_LABEL.all },
              { id: 'women_only', label: MIXITE_LABEL.women_only },
              { id: 'men_only', label: MIXITE_LABEL.men_only },
            ]}
          />
          <label className="cp-field">
            Places dans le groupe
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
            <b>Quand</b>
          </p>
          <div className="cp-grid2">
            <label className="cp-field">
              Départ
              <input name="bottleFrom" type="date" defaultValue={dates.start ?? ''} />
            </label>
            <label className="cp-field">
              Retour
              <input name="bottleTo" type="date" defaultValue={dates.end ?? ''} />
            </label>
          </div>
          <label className="cp-field">
            Message
            <textarea
              name="bottleMsg"
              rows={3}
              maxLength={600}
              placeholder="Rythme, niveau, frais partagés, ce que tu cherches…"
            />
          </label>
          <label className="cp-check">
            <input type="checkbox" name="bottleAdult" required /> J’ai 18 ans ou plus
          </label>
          <button type="submit" className="cp-btn cp-btn--pg" disabled={ctl.busy}>
            <Icon name="send" size={16} />
            Lancer
          </button>
          <p className="cp-note">
            Visible dans la communauté du pays. Tu acceptes ou refuses chaque candidature ici ; une
            personne acceptée rejoint le groupe et le voyage, en lecture seule.
          </p>
        </form>
      )}

      <button
        type="button"
        className="cp-btn"
        onClick={() => ctl.replace({ kind: 'step', step: 'nous', flow: 'qui' })}
      >
        <Icon name="users" size={16} />
        Ajouter quelqu’un que je connais
      </button>
    </>
  );
}

const BOOKING_STATUS: Record<string, { label: string; tone?: 'good' | 'warn' | 'bad' | 'soft' }> = {
  confirmed: { label: 'Confirmée', tone: 'good' },
  pending: { label: 'En attente', tone: 'warn' },
  held: { label: 'Bloquée', tone: 'warn' },
  draft: { label: 'Brouillon', tone: 'soft' },
  cancelled: { label: 'Annulée', tone: 'bad' },
  expired: { label: 'Expirée', tone: 'bad' },
  failed: { label: 'Échouée', tone: 'bad' },
  refunded: { label: 'Remboursée' },
};
const VERTICAL_LABEL: Record<string, { label: string; icon: string }> = {
  hotel: { label: 'Hébergement', icon: 'bed-double' },
  flight: { label: 'Vol', icon: 'plane' },
  car: { label: 'Voiture', icon: 'car' },
  activity: { label: 'Activité', icon: 'ticket' },
};

const STAY_OFFER = /h[ôo]tel|h[ée]berg|stay|refuge|g[îi]te|logement|nuit/i;

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
      setState({ status: 'error', error: 'Connexion perdue : réessaie.' });
    }
  };

  return (
    <>
      <div className="cp-actions" style={{ alignItems: 'flex-end' }}>
        <label className="cp-field" style={{ flex: 1 }}>
          Chercher un hébergement pour
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {nights.map((n) => (
              <option key={n} value={n}>
                la nuit du jour {n}
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
          Chercher
        </button>
      </div>
      {state.status === 'loading' && <p className="cp-note">Recherche en cours…</p>}
      {state.status === 'error' && <p className="cp-note">{state.error}</p>}
      {state.status === 'ok' && (
        <>
          {state.mode === 'sandbox' && (
            <p className="cp-note">
              <b>Mode test.</b> Ces résultats viennent du bac à sable du fournisseur : ce ne sont
              pas de vraies offres.
            </p>
          )}
          <TallList
            label="Offres d’hébergement"
            items={state.offers}
            empty={<p className="cp-note">Aucune offre trouvée pour cette nuit.</p>}
            render={(o) => (
              <DoubleTapRow
                key={o.id}
                className="cp-row cp-row--tall"
                style={staticRow}
                onDouble={
                  o.untitled || ctl.busy
                    ? null
                    : () =>
                        void ctl.run('Hébergement noté', () =>
                          compasSetStayAction({ tripId, tripSlug: slug, day, name: o.title })
                        )
                }
              >
                <span className="cp-thumb">
                  <Icon name="bed-double" size={20} />
                </span>
                <span className="cp-row__t cp-row__t--wrap">
                  <b>{o.title}</b>
                  {o.untitled && <span>Nom non communiqué par le fournisseur</span>}
                  <span>
                    {o.amount != null && o.currency
                      ? `${formatMoney(o.amount, o.currency)} · tarif à revalider avant tout paiement`
                      : 'Prix non confirmé par le fournisseur'}
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
                        void ctl.run('Hébergement noté', () =>
                          compasSetStayAction({ tripId, tripSlug: slug, day, name: o.title })
                        )
                      }
                    >
                      Noter
                    </button>
                  )}
                  {o.url && (
                    <a
                      className="cp-btn cp-btn--soft"
                      href={o.url}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                    >
                      Voir l’offre
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

  const save = (day: number, name: string) =>
    void ctl.run(name ? 'Hébergement noté' : 'Hébergement retiré', () =>
      compasSetStayAction({ tripId, tripSlug: slug, day, name })
    );

  if (nights.length === 0)
    return (
      <p className="cp-note">
        Pas de nuit à organiser : le voyage tient en une journée ou n’a pas encore d’étapes.
      </p>
    );

  return (
    <>
      <PagedList
        label="Nuits du voyage"
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
              <b>Nuit du jour {day}</b>
              {ctl.data.canEdit ? (
                <input
                  key={stay ?? 'vide'}
                  name="stay"
                  defaultValue={stay ?? ''}
                  maxLength={120}
                  placeholder={bivouac ? 'Bivouac, ou nom du lieu' : 'Nom de l’hébergement'}
                  aria-label={`Hébergement de la nuit du jour ${day}`}
                />
              ) : (
                <span>{stay ?? 'à trouver'}</span>
              )}
            </span>
            <span className="cp-row__end">
              {stay ? (
                <Chip tone="good">Noté</Chip>
              ) : (
                <Chip tone={bivouac ? 'soft' : 'warn'}>À trouver</Chip>
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
      <p className="cp-note">
        Noter un hébergement ne réserve rien : c’est ton repère. Aucune réservation ni paiement
        n’est lancé d’ici.
      </p>
      {offers.length > 0 && (
        <>
          <AffiliateDisclosure compact />
          <PagedList
            label="Hébergements partenaires"
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
                  <span>{l.partner ?? 'Partenaire'}</span>
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
        <p className="cp-disc">
          Recherche d’hébergements en direct : active dès que les clés partenaires sont posées. Rien
          n’est simulé d’ici là.
        </p>
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
  return (
    <>
      {bookings.total > 0 && (
        <p className="cp-sub">
          Total des réservations : <b>{formatMoney(bookings.amountEur)}</b>
          {converted
            ? ` ≈ ${formatMoney(converted.amount, converted.currency)} (1 € = ${String(converted.rate).replace('.', ',')} ${converted.currency}, taux BCE du ${converted.date})`
            : budget.currency !== 'EUR'
              ? ` · conversion en ${budget.currency} indisponible`
              : ''}
        </p>
      )}
      <PagedList
        label="Réservations du voyage"
        items={list}
        empty={
          <p className="cp-note">
            Aucune réservation pour ce voyage. Les offres partenaires sont dans l’onglet Offres.
          </p>
        }
        render={(b) => {
          const v = VERTICAL_LABEL[b.vertical] ?? { label: b.vertical, icon: 'ticket' };
          const st = BOOKING_STATUS[b.status] ?? { label: b.status };
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
                    ? 'Partenaire affilié'
                    : b.provider === 'routestack'
                      ? 'RouteStack'
                      : 'Viator'}
                </span>
              </span>
              <span className="cp-row__end">
                {formatMoney(b.amountEur)}
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
const STATE_HELP: Array<[string, string]> = [
  ['draft', 'Notée dans le plan et le budget, rien d’engagé.'],
  ['held', 'Place retenue chez le fournisseur, pas encore payée.'],
  ['pending', 'Demande envoyée, en attente du fournisseur.'],
  ['confirmed', 'Validée par le fournisseur ou par toi.'],
  ['cancelled', 'Annulée.'],
  ['expired', 'Délai dépassé sans confirmation.'],
  ['failed', 'Le fournisseur a refusé ou l’envoi a échoué.'],
  ['refunded', 'Remboursée.'],
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
  return (
    <>
      <div className="cp-row" style={staticRow}>
        <span className="cp-thumb">
          <Icon name="bed-double" size={20} />
        </span>
        <span className="cp-row__t">
          <b>À réserver</b>
          <span>Nuits du parcours sans hébergement noté.</span>
        </span>
        <span className="cp-row__end">
          <b>{toFind}</b>
        </span>
      </div>
      {rows.map(([s, help]) => (
        <div key={s} className="cp-row" style={staticRow}>
          <span className="cp-row__t">
            <b>{BOOKING_STATUS[s]?.label ?? s}</b>
            <span>{help}</span>
          </span>
          <span className="cp-row__end">
            <b>{count(s)}</b>
          </span>
        </div>
      ))}
      <p className="cp-note">Un clic vers un partenaire ne confirme jamais une réservation.</p>
    </>
  );
}

const OFFER_ICONS: Array<[RegExp, string]> = [
  [/vol|flight|avion/i, 'plane'],
  [/h[ôo]tel|h[ée]berg|stay|refuge|g[îi]te/i, 'bed-double'],
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
  return (
    <>
      <Segments
        label="Catégorie"
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
          <b>
            {booked.length} réservation{booked.length > 1 ? 's' : ''}
          </b>{' '}
          dans cette catégorie ·{' '}
          {booked
            .map((b) => BOOKING_STATUS[b.status]?.label ?? b.status)
            .join(', ')
            .toLowerCase()}
        </p>
      )}
      {live && <LiveSearch key={live} ctl={ctl} vertical={live} />}
      {cat === 'nuits' && (
        <button
          type="button"
          className="cp-btn cp-btn--pg"
          onClick={() => ctl.replace({ kind: 'step', step: 'resa', flow: 'nuits' })}
        >
          <Icon name="bed-double" size={16} />
          Chercher un hébergement nuit par nuit
        </button>
      )}
      {(offers.length > 0 || cat === 'extras') && (
        <>
          <AffiliateDisclosure compact />
          <PagedList
            label="Offres partenaires"
            resetKey={cat}
            items={offers}
            empty={
              <p className="cp-note">
                Aucune offre partenaire dans cette catégorie pour l’instant.
              </p>
            }
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
                  <span>{[l.partner, l.category].filter(Boolean).join(' · ') || 'Partenaire'}</span>
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
      setState({ status: 'error', error: 'Connexion perdue : réessaie.', unavailable: false });
    }
  };

  const when = model.dates.start
    ? `${formatDayMonth(model.dates.start)}${model.dates.end && vertical !== 'activity' ? ` → ${formatDayMonth(model.dates.end)}` : ''}`
    : 'dates à choisir';

  return (
    <>
      <form
        className="cp-bottle cp-glass"
        onSubmit={search}
        aria-label={`Chercher : ${vertical === 'activity' ? 'activités' : vertical === 'flight' ? 'vols' : 'trajets'}`}
      >
        {vertical === 'flight' && (
          <label className="cp-field">
            Départ de
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Ville ou aéroport"
              maxLength={80}
              required
            />
          </label>
        )}
        <label className="cp-field">
          {vertical === 'car' ? 'Prise du véhicule à' : vertical === 'flight' ? 'Vers' : 'Où'}
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Destination"
            maxLength={80}
            required
          />
        </label>
        <span className="cp-sub">
          {when} · {model.crew.size} personne{model.crew.size > 1 ? 's' : ''} · via{' '}
          {PARTNER_OF[vertical]}
        </span>
        <button
          type="submit"
          className="cp-btn cp-btn--pg"
          disabled={state.status === 'loading' || !model.dates.start}
        >
          <Icon name="search" size={16} />
          {state.status === 'loading' ? 'Recherche…' : 'Chercher en direct'}
        </button>
      </form>

      {state.status === 'error' && <p className="cp-note">{state.error}</p>}
      {state.status === 'error' && state.unavailable && (
        <PagedList
          label="Exemples"
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
                <Chip tone="soft">Exemple</Chip>
              </span>
            </div>
          )}
        />
      )}
      {state.status === 'ok' && (
        <>
          {state.mode === 'sandbox' && (
            <p className="cp-note">Mode test du partenaire : ces offres ne sont pas réservables.</p>
          )}
          <AffiliateDisclosure compact />
          <PagedList
            label="Offres en direct"
            items={state.offers}
            empty={<p className="cp-note">Aucune offre trouvée pour ces critères.</p>}
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
                        ? formatMoney(o.amount, o.currency)
                        : 'prix confirmé chez le partenaire'}
                      {o.requiresRevalidation ? ' · tarif à revalider' : ''}
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
          <p className="cp-disc">
            Rien n’est réservé ni payé d’ici : l’offre s’ouvre chez le partenaire, tarif revalidé
            avant tout paiement.
          </p>
        </>
      )}
    </>
  );
}

function RaisonsFlow({ ctl }: { ctl: CompasCtl }) {
  const { danger } = ctl.data;
  const dated = new Map(danger.signals.map((x) => [`${x.source}|${x.label}`, x.asOf]));
  const axes = ['physique', 'technique', 'conjoncturel'] as const;
  const unknown = axes.filter((a) => danger.axes[a].level === 'non_evalue');
  const partial = axes.filter(
    (a) => danger.axes[a].level !== 'non_evalue' && danger.axes[a].partial
  );
  return (
    <>
      {unknown.map((a) => (
        <p key={a} className="cp-note">
          <b>{a[0].toUpperCase() + a.slice(1)} non évalué.</b> {danger.axes[a].note}
        </p>
      ))}
      {partial.map((a) => (
        <p key={a} className="cp-note">
          <b>{a[0].toUpperCase() + a.slice(1)} évalué en partie.</b> {danger.axes[a].partial}
        </p>
      ))}
      <PagedList
        label="Signaux du verdict"
        items={ctl.data.model.verdict.reasons}
        empty={<p className="cp-note">Aucun signal bloquant ni point de vigilance.</p>}
        render={(r) => (
          <div key={`${r.source}-${r.label}`} className="cp-row" style={staticRow}>
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
                Source : {r.source}
                {dated.get(`${r.source}|${r.label}`)
                  ? ` · ${dated.get(`${r.source}|${r.label}`)}`
                  : ''}
              </span>
            </span>
            <span className="cp-row__end">
              <Chip
                tone={r.severity === 'block' ? 'bad' : r.severity === 'warn' ? 'warn' : undefined}
              >
                {r.severity === 'block' ? 'Bloquant' : r.severity === 'warn' ? 'Vigilance' : 'Info'}
              </Chip>
            </span>
          </div>
        )}
      />
      <VerdictExplain ctl={ctl} />
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
      setState({ status: 'error', error: 'Connexion perdue : réessaie.' });
    }
  };
  return (
    <section aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {state.status === 'done' && state.text ? (
        <div className="cp-note">
          <p style={{ margin: 0 }}>{state.text}</p>
          <p className="cp-sub" style={{ margin: '6px 0 0' }}>
            Rédigé par l’IA à partir des seuls signaux ci-dessus, puis vérifié par le Compas. Le
            niveau vient du moteur, pas de l’IA.
          </p>
        </div>
      ) : state.status === 'done' && state.refused ? (
        <p className="cp-note">
          Explication de l’IA écartée ({state.refused}) : les signaux ci-dessus restent la
          référence.
        </p>
      ) : state.status === 'done' && state.note ? (
        <p className="cp-note">{state.note}</p>
      ) : state.status === 'error' ? (
        <p className="cp-note">{state.error}</p>
      ) : null}
      {!(state.status === 'done' && state.text) && (
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          disabled={state.status === 'loading'}
          onClick={() => void explain()}
        >
          <Icon name="sparkles" size={16} />
          {state.status === 'loading' ? 'L’IA lit les signaux…' : 'Expliquer avec l’IA'}
        </button>
      )}
    </section>
  );
}

const WX_DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const deg = (v: number | null) => (v == null ? '—' : `${Math.round(v)} °C`);

/**
 * Météo des vrais jours du voyage (maquette finale : onglet « Météo » du
 * verdict). Prévision MET Norway aux points réels de chaque journée ; au-delà
 * de l'horizon de prévision, le jour le dit au lieu d'inventer une valeur.
 */
function MeteoFlow({ ctl }: { ctl: CompasCtl }) {
  const w = ctl.data.weather;
  const days = w?.tripDays ?? [];
  if (!w || days.length === 0) {
    return (
      <p className="cp-note">
        Météo non disponible : il faut des dates et au moins une étape localisée.
      </p>
    );
  }
  const horizon = WX_DAY.format(new Date(`${w.horizon}T12:00:00Z`));
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
                J{d.day} · {WX_DAY.format(new Date(`${d.date}T12:00:00Z`))}
              </b>
              {f ? (
                <>
                  {f.code != null && <span>{weatherLabel(f.code).label}</span>}
                  <span>
                    {deg(f.tMin)} / {deg(f.tMax)}
                    {f.precipPct != null ? ` · pluie ${Math.round(f.precipPct)} %` : ''}
                  </span>
                  <span>
                    {f.gustMax != null ? `Rafales ${Math.round(f.gustMax)} km/h` : 'Rafales —'}
                    {lowFreeze != null
                      ? ` · 0 °C à ${Math.round(lowFreeze).toLocaleString('fr-FR')} m`
                      : ''}
                  </span>
                </>
              ) : (
                <span>Au-delà de la prévision (jusqu’au {horizon}).</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="cp-note">
        Prévisions {w.source} jusqu’au {horizon}, aux points réels de chaque journée. Elles ne
        remplacent pas les bulletins officiels (vigilance Météo-France, bulletins avalanche).
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
  const active = rules.filter((r) => r.hits.length > 0).length;
  const shift = proposeShift({
    start: m.dates.start,
    end: m.dates.end,
    calendar: ctl.data.weather?.calendar ?? [],
  });
  const fmt = (iso: string) => WX_DAY.format(new Date(`${iso}T12:00:00Z`));
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
      `Voyage décalé de ${n} jour${n > 1 ? 's' : ''}`,
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
            Proposition de la veille
          </p>
          <p>
            {shift.now.length ? `${shift.now.join(', ')} sur les dates actuelles. ` : ''}
            Du {fmt(shift.startDate)} au {fmt(shift.endDate)}, la prévision ne montre aucun jour
            mauvais. Décaler de {Math.abs(shift.offsetDays)} jour
            {Math.abs(shift.offsetDays) > 1 ? 's' : ''}
            {shift.offsetDays > 0 ? ' plus tard' : ' plus tôt'} ?
          </p>
          <div className="cp-actions">
            <button type="button" className="cp-btn cp-btn--pg" disabled={ctl.busy} onClick={apply}>
              Décaler
            </button>
            <span className="cp-sub">L’agent propose, tu décides.</span>
          </div>
        </div>
      )}
      <ul className="cp-rules" aria-label="Règles de la veille">
        {rules.map((r) => (
          <li key={r.id} data-hit={r.hits.length ? '1' : undefined}>
            <b>{r.label}</b>
            <span>
              {r.hits.length
                ? r.hits.map((h) => h.label).join(' · ')
                : 'Rien à signaler sur ce voyage.'}
            </span>
          </li>
        ))}
      </ul>
      <p className="cp-note">
        {active} règle{active > 1 ? 's' : ''} déclenchée{active > 1 ? 's' : ''} sur {rules.length}.
        Vérifiées à chaque ouverture du Compas sur la prévision MET Norway et les alertes
        officielles ; aucun seuil n’est une norme légale.
      </p>
    </>
  );
}

function SourcesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const sources = [
    'Étapes et dépenses du voyage',
    'Ton inventaire',
    m.weather.days.length ? 'MET Norway (météo, CC BY 4.0)' : null,
    m.daylight ? 'Calcul astronomique (lumière)' : null,
    ctl.data.shop.length ? 'Boutique LKDV' : null,
    ctl.data.affiliateLinks.length ? 'Partenaires affiliés' : null,
  ].filter(Boolean) as string[];
  return (
    <>
      <dl className="cp-kv">
        <dt>Destination</dt>
        <dd>{m.destination ?? '—'}</dd>
        <dt>Objets du kit</dt>
        <dd>{ctl.lines.length}</dd>
        <dt>Inventaire</dt>
        <dd>
          {m.inventory.total} objet{m.inventory.total > 1 ? 's' : ''}
          {m.inventory.lent ? ` · ${m.inventory.lent} prêté${m.inventory.lent > 1 ? 's' : ''}` : ''}
        </dd>
        <dt>Entretien dû</dt>
        <dd>{m.inventory.maintenanceDue}</dd>
        <dt>Péremption proche</dt>
        <dd>{m.inventory.expiringSoon}</dd>
      </dl>
      <div className="cp-actions">
        {sources.map((s) => (
          <Chip key={s} tone="soft">
            {s}
          </Chip>
        ))}
      </div>
      <p className="cp-note">
        Aucune donnée n’est inventée : ce qui manque est affiché comme manquant, sans score.
      </p>
      <div className="cp-actions">
        <button
          type="button"
          className="cp-btn cp-btn--soft"
          onClick={() => ctl.open({ kind: 'add', target: 'inventaire' })}
        >
          <Icon name="archive" size={16} />
          Ajouter à l’inventaire
        </button>
      </div>
    </>
  );
}

function KitListFlow({ ctl, flow }: { ctl: CompasCtl; flow: 'trouver' | 'emballer' | 'tout' }) {
  const lines =
    flow === 'trouver'
      ? ctl.lines.filter((l) => l.status !== 'owned')
      : flow === 'emballer'
        ? ctl.lines.filter((l) => !l.packed)
        : ctl.lines;
  return (
    <>
      <PagedList
        label="Objets du kit"
        resetKey={flow}
        items={lines}
        empty={
          <p className="cp-note">
            {flow === 'trouver'
              ? 'Rien à trouver : tout le matériel est disponible.'
              : flow === 'emballer'
                ? 'Tout est emballé.'
                : 'Le kit est vide. Ajoute ton matériel depuis ton inventaire ou la boutique.'}
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
            Ajouter au kit
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
  froid: 'thermometer',
  chaud: 'thermometer',
  extremites: 'cloud-snow',
  soleil: 'sun',
  frontale: 'sunset',
  eau: 'droplet',
};

/** Mot cherché dans la boutique quand on ajoute depuis un conseil (sous-chaîne, sans accent). */
const ADVICE_QUERY: Record<string, string> = {
  pluie: 'imperm',
  froid: 'polaire',
  chaud: 'polaire',
  extremites: 'gant',
  soleil: 'solaire',
  frontale: 'frontale',
  eau: 'gourde',
};

function ConseilsFlow({ ctl }: { ctl: CompasCtl }) {
  const advice = ctl.data.kitAdvice;
  return (
    <>
      <p className="cp-note">
        Des repères tirés de la météo et du parcours, pas des ordres : chacun cite la donnée qui le
        déclenche. « Couvert » veut dire qu’un objet de ton kit porte un nom qui correspond.
      </p>
      <TallList
        label="Conseils de kit"
        items={advice}
        empty={
          <p className="cp-note">
            Aucun conseil : prévisions ou parcours indisponibles pour ce voyage.
          </p>
        }
        render={(a) => (
          <div key={a.id} className="cp-row cp-row--tall" style={staticRow}>
            <span className="cp-thumb">
              <Icon name={ADVICE_ICON[a.need] ?? 'sparkles'} size={20} />
            </span>
            <span className="cp-row__t cp-row__t--wrap">
              <b>{a.label}</b>
              <span>{a.reason}</span>
              <span>
                Source : {a.source}
                {a.coveredBy ? ` · couvert par « ${a.coveredBy} »` : ''}
              </span>
            </span>
            <span className="cp-row__end">
              {a.covered ? (
                <Chip tone="good">Couvert</Chip>
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
                    Ajouter
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
};

function TraceFlow({ ctl }: { ctl: CompasCtl }) {
  const pois = ctl.data.routePois;
  const counts = countByCategory(pois);
  const [filter, setFilter] = useState<'all' | RoutePoiCategory>('all');
  if (ctl.data.route.id == null)
    return (
      <p className="cp-note">
        Choisis d’abord un parcours du catalogue : les points d’eau, abris et points de vue sont
        cherchés le long de son tracé.
      </p>
    );
  const shown = filter === 'all' ? pois : pois.filter((p) => p.category === filter);
  const present = (Object.keys(counts) as RoutePoiCategory[]).filter((c) => counts[c] > 0);
  return (
    <>
      <p className="cp-note">
        Points à moins de 1 km du tracé, jusqu’à 20 par catégorie. Données OpenStreetMap : une
        source peut être tarie ou un refuge fermé, à vérifier avant de compter dessus.
      </p>
      {present.length > 0 && (
        <Segments
          label="Catégorie"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: `Tout (${pois.length})` },
            ...present.map((c) => ({ id: c, label: `${ROUTE_POI_LABEL[c]} (${counts[c]})` })),
          ]}
        />
      )}
      <PagedList
        label="Points sur le tracé"
        items={shown}
        empty={<p className="cp-note">Aucun point connu à moins de 1 km de ce tracé.</p>}
        render={(p) => (
          <div key={p.id} className="cp-row" style={staticRow}>
            <span className="cp-thumb">
              <Icon name={POI_ICON[p.category]} size={20} />
            </span>
            <span className="cp-row__t">
              <b>{poiLabel(p)}</b>
              <span>
                {p.name ? `${ROUTE_POI_LABEL[p.category]} · ` : ''}à {p.distanceM} m du tracé
                {p.elevationM != null ? ` · ${p.elevationM} m` : ''}
              </span>
            </span>
          </div>
        )}
      />
      <p className="cp-disc">© contributeurs OpenStreetMap (licence ODbL)</p>
    </>
  );
}

const SEASON_LABEL: Record<string, string> = {
  printemps: 'printemps',
  ete: 'été',
  automne: 'automne',
  hiver: 'hiver',
  toute_saison: 'toute saison',
};

function MesKitsFlow({ ctl }: { ctl: CompasCtl }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; kits: MyKit[] }
  >({ status: 'loading' });
  const [pending, setPending] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const model = ctl.data.model;
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
      .catch(() => alive && setState({ status: 'error', error: 'Connexion perdue : réessaie.' }));
    return () => {
      alive = false;
    };
  }, [reload]);

  if (state.status === 'loading') return <p className="cp-note">Lecture de tes kits…</p>;
  if (state.status === 'error') return <p className="cp-note">{state.error}</p>;

  const createKit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const season = String(fd.get('season') ?? '');
    setCreating(true);
    const ok = await ctl.run(`Kit « ${String(fd.get('kitName') ?? '').trim()} » créé`, () =>
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
          Créer mon kit
        </button>
      )}
      {ctl.data.canEdit && showCreate && (
        <form className="cp-mkkit cp-glass" onSubmit={createKit} aria-label="Créer mon kit">
          <b className="cp-mkkit__t">
            <Icon name="plus" size={15} aria-hidden="true" /> Créer mon kit
          </b>
          <span className="cp-note">
            Enregistre les {ctl.lines.length} objet{ctl.lines.length > 1 ? 's' : ''} du voyage comme
            un kit réutilisable, privé.
          </span>
          <div className="cp-grid2">
            <label className="cp-field">
              Nom
              <input
                name="kitName"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
                defaultValue={`Kit · ${model.title}`.slice(0, 80)}
              />
            </label>
            <label className="cp-field">
              Saison
              <select name="season" defaultValue="">
                <option value="">Non précisée</option>
                <option value="printemps">Printemps</option>
                <option value="ete">Été</option>
                <option value="automne">Automne</option>
                <option value="hiver">Hiver</option>
                <option value="toute_saison">Toute saison</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="cp-btn cp-btn--pg"
            disabled={ctl.busy || creating || ctl.lines.length === 0}
          >
            {ctl.lines.length === 0 ? 'Ajoute d’abord des objets' : 'Créer le kit'}
          </button>
        </form>
      )}
      <p className="cp-note">
        Appliquer un kit ajoute au voyage les objets qui n’y sont pas déjà (même nom). Rien n’est
        retiré ni emballé.
      </p>
      <TallList
        label="Mes kits"
        items={state.kits}
        empty={<p className="cp-note">Tu n’as encore aucun kit enregistré.</p>}
        render={(kit) => {
          const plan = planKitApply(kit, tripNames);
          const compat = kitCompatibility({
            kit,
            tripNames,
            forecasts,
            dayPlans: model.route.dayPlans,
            waterPointsCount: null,
          });
          return (
            <div key={kit.id} className="cp-row cp-row--tall" style={staticRow}>
              <span className="cp-thumb">
                <Icon name="package" size={20} />
              </span>
              <span className="cp-row__t cp-row__t--wrap">
                <b>
                  {kit.name}
                  {kit.season ? ` · ${SEASON_LABEL[kit.season] ?? kit.season}` : ''}
                </b>
                <span>
                  {kit.items.length} objet{kit.items.length > 1 ? 's' : ''} · {plan.alreadyThere}{' '}
                  déjà dans le voyage · {plan.toAdd.length} à ajouter
                </span>
                <span>
                  {compat.total > 0
                    ? `Couvre ${compat.covered} conseil${compat.covered > 1 ? 's' : ''} météo sur ${compat.total}${compat.bringsNew ? ` (dont ${compat.bringsNew} de plus qu’aujourd’hui)` : ''}`
                    : 'Aucun conseil météo à comparer'}
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
                        `${plan.toAdd.length} objet${plan.toAdd.length > 1 ? 's' : ''} ajouté${plan.toAdd.length > 1 ? 's' : ''}`,
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
                    {plan.toAdd.length === 0 ? 'Déjà complet' : 'Appliquer'}
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

const litres = (n: number) => `${String(n).replace('.', ',')} L`;

/**
 * Eau (maquette finale, onglet du Kit) : besoin par personne jour par jour
 * (repère par heure de marche, chaud compris), contenants du kit au volume
 * écrit, et points d'eau réels du tracé. Rien n'est supposé : un volume non
 * écrit ou une marche inconnue reste « non renseigné ».
 */
function EauFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
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
  if (need == null) verdict = 'Durée de marche non renseignée : besoin en eau non calculé.';
  else if (plan.containers.length === 0)
    verdict = `Aucun contenant d’eau dans le kit pour ${litres(need)} le jour ${peak?.day}.`;
  else if (plan.knownLiters == null)
    verdict = 'Volume des contenants non écrit dans leur nom : couverture non vérifiable.';
  else if (plan.knownLiters >= need)
    verdict = `Contenants du kit (${litres(plan.knownLiters)}) suffisants pour la plus longue journée sans recharger.`;
  else
    verdict = `Il manque ${litres(Math.round((need - plan.knownLiters) * 10) / 10)} de contenants pour le jour ${peak?.day} sans recharger${water.length > 0 ? ', ou recharger aux points d’eau du tracé' : ''}.`;

  return (
    <>
      <div className="cp-row" style={staticRow}>
        <span className="cp-thumb">
          <Icon name="droplet" size={20} />
        </span>
        <span className="cp-row__t">
          <b>
            {peak?.liters != null
              ? `Eau par personne : jusqu’à ${litres(peak.liters)}`
              : 'Eau par personne : non renseignée'}
          </b>
          <span>
            {peak?.liters != null
              ? `Jour ${peak.day}${people > 1 ? ` · ${litres(need as number)} pour ${people} personnes` : ''}`
              : 'Il faut des étapes avec une durée de marche.'}
          </span>
        </span>
      </div>
      {plan.days.length > 0 && (
        <div className="cp-wx">
          {plan.days.map((d) => (
            <div key={d.day}>
              <b>
                J{d.day}
                {d.date ? ` · ${WX_DAY.format(new Date(`${d.date}T12:00:00Z`))}` : ''}
              </b>
              <span>{d.liters != null ? litres(d.liters) : 'non renseigné'}</span>
              <span>
                {d.walkMin != null ? `${formatDuration(d.walkMin)} de marche` : 'marche inconnue'}
                {d.hot ? ' · chaud' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="cp-note">{verdict}</p>
      <PagedList
        label="Contenants du kit"
        items={plan.containers}
        empty={<p className="cp-note">Aucune gourde, poche à eau ni bouteille dans le kit.</p>}
        render={(c) => (
          <div key={c.id} className="cp-row" style={staticRow}>
            <Thumb category={null} name={c.name} />
            <span className="cp-row__t">
              <b>{c.name}</b>
              <span>
                {c.quantity > 1 ? `${c.quantity} × · ` : ''}
                {c.liters != null ? litres(c.liters) : 'volume non écrit'}
              </span>
            </span>
          </div>
        )}
      />
      {ctl.data.route.id != null && (
        <PagedList
          label="Points d’eau sur le tracé"
          items={water}
          empty={
            <p className="cp-note">
              Aucun point d’eau connu à moins de 1 km du tracé : tout emporter.
            </p>
          }
          render={(p) => (
            <div key={p.id} className="cp-row" style={staticRow}>
              <span className="cp-thumb">
                <Icon name="droplet" size={20} />
              </span>
              <span className="cp-row__t">
                <b>{poiLabel(p)}</b>
                <span>
                  à {p.distanceM} m du tracé{p.elevationM != null ? ` · ${p.elevationM} m` : ''}
                </span>
              </span>
            </div>
          )}
        />
      )}
      <p className="cp-note">
        Repère courant : {litres(KIT_THRESHOLDS.waterLPerHour)} par heure de marche,{' '}
        {litres(KIT_THRESHOLDS.waterLPerHourHot)} au-delà de {KIT_THRESHOLDS.sunC} °C (prévision du
        jour). Une source OpenStreetMap peut être tarie : à vérifier avant de compter dessus.
      </p>
      {water.length > 0 && <p className="cp-disc">© contributeurs OpenStreetMap (licence ODbL)</p>}
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
      const c = i.category ?? 'Sans catégorie';
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
  }, [ctl.data.inventory]);
  const [cat, setCat] = useState<string>('all');
  const today = new Date().toISOString().slice(0, 10);
  const shown = ctl.data.inventory
    .filter((i) => cat === 'all' || (i.category ?? 'Sans catégorie') === cat)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (ctl.data.inventory.length === 0)
    return (
      <p className="cp-note">
        Ton inventaire est vide.{' '}
        <button
          type="button"
          className="cp-linkbtn"
          onClick={() => ctl.open({ kind: 'add', target: 'inventaire' })}
        >
          Ajouter à l’inventaire
        </button>
      </p>
    );
  return (
    <>
      {cats.length > 1 && (
        <Segments
          label="Catégorie"
          value={cat}
          onChange={setCat}
          options={[
            { id: 'all', label: `Tout (${ctl.data.inventory.length})` },
            ...cats.map(([c, n]) => ({ id: c, label: `${c} (${n})` })),
          ]}
        />
      )}
      <PagedList
        label="Mon inventaire"
        resetKey={cat}
        items={shown}
        render={(i) => {
          const lineId = lineByInv.get(i.id) ?? null;
          const notes = [
            i.brand,
            i.weightG != null ? formatKg(i.weightG) : 'à peser',
            i.isLent ? 'prêté' : null,
            i.maintenanceDueAt && i.maintenanceDueAt <= today ? 'entretien dû' : null,
            i.expiryDate && i.expiryDate <= today ? 'périmé' : null,
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
                    aria-label={`Fiche : ${i.name}`}
                  >
                    Dans le kit
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cp-btn cp-btn--soft"
                    disabled={ctl.busy || !ctl.data.canEdit}
                    aria-label={`Ajouter au kit : ${i.name}`}
                    onClick={() =>
                      ctl.run(`${i.name} ajouté au kit`, () =>
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
                    Ajouter
                  </button>
                )}
              </span>
            </div>
          );
        }}
      />
      <p className="cp-note">
        Les objets de ton inventaire. Ajouter au kit ne change rien à l’inventaire.
      </p>
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
  return (
    <>
      {unassigned.size > 0 && (
        <p className="cp-note">
          Touche un objet commun pour choisir qui le porte : la charge de chacun se met à jour.
        </p>
      )}
      <PagedList
        label="Sacs et matériel commun"
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
                    Commun sans porteur ·{' '}
                    {line.weightGrams == null
                      ? 'à peser'
                      : formatKg(line.weightGrams * line.quantity)}
                  </span>
                </span>
                <span className="cp-row__end">
                  <Chip tone="warn">Qui porte ?</Chip>
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
                <b>Sac de {m.name}</b>
                <span>
                  {formatKg(m.carriedGrams)}
                  {m.capacityKg != null ? ` sur ${m.capacityKg} kg` : ' · capacité non renseignée'}
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
