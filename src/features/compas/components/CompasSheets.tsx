'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { addToCart } from '@/lib/cart';
import {
  addCustomTripItemAction,
  addInventoryItemToTripAction,
  deleteTripItemAction,
} from '@/app/voyages/kit-actions';
import type { CompasKitLine, CompasStepId } from '../engine/compasModel';
import { formatKg, formatMoney } from '../engine/format';
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
import { Chip, PagedList, Segments, Thumb, useTextFilter } from './CompasPrimitives';
import { DisLe } from './CompasDisLe';
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
  ou: 'Où et quand',
  nous: 'Nous',
  resa: 'Réserver',
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

function tokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Pertinence d'un produit pour un objet du kit : mots communs, catégorie. */
function relevance(line: CompasKitLine, p: CompasShopProduct): number {
  const want = new Set(tokens(`${line.name} ${line.category ?? ''}`));
  const have = tokens(`${p.name} ${p.category ?? ''} ${p.brand ?? ''}`);
  return have.reduce((s, t) => s + (want.has(t) ? 1 : 0), 0);
}

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
  const price =
    product.mode === 'location' && product.pricePerDay != null
      ? `${formatMoney(product.pricePerDay)} / jour`
      : formatMoney(product.priceEur);
  return (
    <div className="cp-row" style={{ cursor: 'default' }}>
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
                <Link href="/hub/groupe">Inviter quelqu’un</Link>
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
              <Link href="/hub/inventaire">Ouvrir l’inventaire</Link>
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
      {source === 'libre' && (
        <FreeItemForm ctl={ctl} target={target} defaultName={suggest?.name} />
      )}
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
      Terminé
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
      {step === 'ou' && flow === 'quand' && (
        <QuandFlow key={hint?.hours ?? 'q'} ctl={ctl} hint={hint} />
      )}
      {step === 'ou' && flow === 'preferences' && <PreferencesFlow ctl={ctl} />}
      {step === 'nous' && flow === 'equipe' && <EquipeFlow ctl={ctl} />}
      {step === 'nous' && flow === 'budget' && <BudgetFlow ctl={ctl} />}
      {step === 'resa' && flow === 'nuits' && <NuitsFlow ctl={ctl} focusDay={hint?.day} />}
      {step === 'resa' && flow === 'reservations' && <ReservationsFlow ctl={ctl} />}
      {step === 'resa' && flow === 'offres' && <OffresFlow ctl={ctl} />}
      {step === 'verdict' && flow === 'raisons' && <RaisonsFlow ctl={ctl} />}
      {step === 'verdict' && flow === 'sources' && <SourcesFlow ctl={ctl} />}
      {step === 'kit' && (flow === 'trouver' || flow === 'emballer' || flow === 'tout') && (
        <KitListFlow ctl={ctl} flow={flow} />
      )}
      {step === 'kit' && flow === 'conseils' && <ConseilsFlow ctl={ctl} />}
      {step === 'kit' && flow === 'mes-kits' && <MesKitsFlow ctl={ctl} />}
      {step === 'kit' && flow === 'sacs' && <SacsFlow ctl={ctl} />}
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
        <Link className="cp-btn cp-btn--soft" href="/hub/groupe">
          <Icon name="user-plus" size={16} />
          Inviter ou gérer les rôles dans le hub
        </Link>
      </div>
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
    void ctl.run(amount == null ? 'Enveloppe retirée' : 'Enveloppe enregistrée', () =>
      compasSetBudgetAction({ tripId, tripSlug: slug, amount })
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
              <div key={o.id} className="cp-row cp-row--tall" style={staticRow}>
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
              </div>
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
          <AffiliateDisclosure />
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

function OffresFlow({ ctl }: { ctl: CompasCtl }) {
  const live = ctl.data.providers.routestack !== 'disabled';
  return (
    <>
      <AffiliateDisclosure />
      <PagedList
        label="Offres partenaires"
        items={ctl.data.affiliateLinks}
        empty={
          <p className="cp-note">Aucune offre partenaire pour cette destination pour l’instant.</p>
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
      <p className="cp-disc">
        {live
          ? 'Hôtels, vols et voitures en direct : tarif revalidé avant tout paiement, jamais de commande sans ton accord.'
          : 'Recherche en direct (hôtels, vols, voitures) : active dès que les clés partenaires sont posées. Rien n’est simulé d’ici là.'}
      </p>
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

function SourcesFlow({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const sources = [
    'Étapes et dépenses du voyage',
    'Ton inventaire',
    m.weather.days.length ? 'Open-Meteo (météo)' : null,
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

function MesKitsFlow({ ctl }: { ctl: CompasCtl }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; kits: MyKit[] }
  >({ status: 'loading' });
  const [pending, setPending] = useState<string | null>(null);
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
  }, []);

  if (state.status === 'loading') return <p className="cp-note">Lecture de tes kits…</p>;
  if (state.status === 'error') return <p className="cp-note">{state.error}</p>;

  return (
    <>
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
                  {kit.season ? ` · ${kit.season}` : ''}
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
