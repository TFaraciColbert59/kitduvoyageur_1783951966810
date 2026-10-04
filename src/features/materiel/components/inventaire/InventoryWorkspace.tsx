'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingState,
  SearchField,
  Tabs,
} from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { useToast } from '@/contexts/ToastContext';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import Link from 'next/link';
import {
  INVENTORY_MODES,
  INVENTORY_STATUSES,
  getInventoryStatus,
  allowedInventoryTransitions,
  type InventoryMode,
  type InventoryStatus,
} from '../../domain/inventory';
import type { InventoryCatalogProduct } from '../../services/getInventoryCatalog';
import { InventoryVirtualGrid } from './InventoryVirtualGrid';

type View = 'grid' | 'table';

const FIELD_CLASS =
  'min-h-11 rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const CATEGORIES = [
  'Sacs & Portage',
  'Couchage & Tentes',
  'Vêtements & Vestes',
  'Cuisine & Réchauds',
  'Eau & Filtres',
  'Lampes & Éclairage',
  'Navigation & GPS',
  'Sécurité & Soins',
  'Accessoires & Outils',
  'Autre',
];
const CONDITIONS = {
  neuf: 'Neuf',
  bon: 'Bon état',
  use: 'Usé',
  a_remplacer: 'À remplacer',
  pour_pieces: 'Pour pièces',
};
const EMPTY_FORM = {
  name: '',
  brand: '',
  category: 'Autre',
  weight_g: '',
  price_eur: '',
  condition: 'bon',
  serial_number: '',
  description: '',
  location: '',
  quantity: '1',
  listing_mode: 'personnel' as InventoryMode,
  status: 'en_stock' as InventoryStatus,
  rental_eur: '',
  deposit_eur: '',
  product_id: null as string | null,
};
type ItemFormState = typeof EMPTY_FORM;
function toForm(i: InventoryItem): ItemFormState {
  return {
    ...EMPTY_FORM,
    name: i.name,
    brand: i.brand ?? '',
    category: i.category ?? 'Autre',
    weight_g: String(i.weight_g ?? 0),
    price_eur: i.price_cents == null ? '' : String(i.price_cents / 100),
    condition: i.condition ?? 'bon',
    serial_number: i.serial_number ?? '',
    description: i.description ?? '',
    location: i.location ?? '',
    quantity: String(i.quantity ?? 1),
    listing_mode: i.listing_mode ?? 'personnel',
    status: getInventoryStatus(i),
    rental_eur: i.rental_price_cents == null ? '' : String(i.rental_price_cents / 100),
    deposit_eur: i.deposit_cents == null ? '' : String(i.deposit_cents / 100),
    product_id: i.product_id ?? null,
  };
}
const locked = (i: InventoryItem) =>
  ['en_pret', 'en_location', 'vendu'].includes(getInventoryStatus(i));
function transitionLabel(item: InventoryItem, status: InventoryStatus) {
  if (status === 'vendu') return 'Confirmer la vente';
  if (status === 'en_stock')
    return getInventoryStatus(item) === 'a_acheter'
      ? 'Réceptionner l’achat'
      : ['en_pret', 'en_location'].includes(getInventoryStatus(item))
        ? 'Enregistrer le retour'
        : 'Remettre en stock';
  return {
    a_acheter: 'Prévoir un achat',
    a_louer: 'Rendre disponible à la location',
    a_preter: 'Rendre disponible au prêt',
    en_location: 'Démarrer la location',
    en_pret: 'Démarrer le prêt',
  }[status];
}

/** W-I-2..W-I-7 — workspace inventaire avec CRUD complet (connecté Supabase). */
export function InventoryWorkspace({
  items,
  initialProduct,
  catalogLinks = {},
}: {
  items: InventoryItem[];
  initialProduct?: InventoryCatalogProduct | null;
  catalogLinks?: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [mode, setMode] = useState('all');
  const [status, setStatus] = useState('all');
  const [location, setLocation] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [saleConfirm, setSaleConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [view, setView] = useState<View>('grid');
  const [sort, setSort] = useState<'recent' | 'weight' | 'price'>('recent');
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');
  const [formOpen, setFormOpen] = useState(Boolean(initialProduct));
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemFormState>(() =>
    initialProduct
      ? {
          ...EMPTY_FORM,
          name: initialProduct.name,
          brand: initialProduct.brand ?? '',
          category: initialProduct.category,
          weight_g: String(initialProduct.weight_g ?? 0),
          price_eur:
            initialProduct.price_cents == null ? '' : String(initialProduct.price_cents / 100),
          product_id: initialProduct.id,
        }
      : EMPTY_FORM
  );
  const prefillId = useRef(initialProduct?.id);
  useEffect(() => {
    if (initialProduct && initialProduct.id !== prefillId.current) {
      prefillId.current = initialProduct.id;
      setForm({
        ...EMPTY_FORM,
        name: initialProduct.name,
        brand: initialProduct.brand ?? '',
        category: initialProduct.category,
        weight_g: String(initialProduct.weight_g ?? 0),
        price_eur:
          initialProduct.price_cents == null ? '' : String(initialProduct.price_cents / 100),
        product_id: initialProduct.id,
      });
      setEditing(null);
      setSelected(null);
      setError(null);
      setFormOpen(true);
    }
  }, [initialProduct]);
  const selectedId = selected?.id;
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formOpen || selectedId) {
      panelRef.current?.focus();
      panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }
  }, [formOpen, selectedId]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items]
  );

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (mode !== 'all' && (i.listing_mode ?? 'personnel') !== mode) return false;
      if (status !== 'all' && getInventoryStatus(i) !== status) return false;
      if (location !== 'all' && i.location !== location) return false;
      if (category !== 'all' && i.category !== category) return false;
      if (
        query &&
        !`${i.name} ${i.brand ?? ''} ${i.category ?? ''} ${i.serial_number ?? ''} ${i.description ?? ''} ${i.location ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      return true;
    });
    if (sort === 'weight') list = [...list].sort((a, b) => (b.weight_g ?? 0) - (a.weight_g ?? 0));
    else if (sort === 'price')
      list = [...list].sort((a, b) => (b.price_cents ?? 0) - (a.price_cents ?? 0));
    return list;
  }, [items, query, category, mode, status, location, sort]);

  const cmpAItem = items.find((i) => i.id === cmpA);
  const cmpBItem = items.find((i) => i.id === cmpB);

  const openCreate = () => {
    setSaleConfirm(false);
    setDeleteConfirm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (i: InventoryItem) => {
    if (locked(i)) return;
    setEditing(i);
    setForm(toForm(i));
    setError(null);
    setSelected(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Le nom est requis');
      return;
    }
    if (saving) return;
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      brand: form.brand || null,
      category: form.category,
      weight_g: form.weight_g ? Number(form.weight_g) : 0,
      price_cents: form.price_eur
        ? Math.round(Number(form.price_eur.replace(',', '.')) * 100)
        : null,
      product_id: form.product_id,
      serial_number: form.serial_number.trim() || null,
      description: form.description || null,
      location: form.location.trim() || null,
      quantity: form.serial_number.trim() ? 1 : Number(form.quantity),
      listing_mode: form.listing_mode,
      rental_price_cents:
        form.listing_mode === 'location'
          ? Math.round(Number(form.rental_eur.replace(',', '.')) * 100)
          : null,
      deposit_cents:
        ['location', 'pret'].includes(form.listing_mode) && form.deposit_eur
          ? Math.round(Number(form.deposit_eur.replace(',', '.')) * 100)
          : null,
      ...(!editing ? { status: form.status } : {}),
      condition: form.condition,
    };
    try {
      const url = editing ? `/api/materiel/items/${editing.id}` : '/api/materiel/items';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      toast(editing ? 'Objet modifié' : 'Objet ajouté', 'success');
      setFormOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/materiel/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur');
      toast('Objet supprimé', 'success');
      setSelected(null);
      setDeleteConfirm(false);
      router.refresh();
    } catch {
      setError('Erreur de suppression');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (item: InventoryItem, status: InventoryStatus) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/materiel/items/${item.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expected_status: getInventoryStatus(item) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Impossible de changer le statut');
      setSelected({ ...item, ...data.item });
      setSaleConfirm(false);
      toast('Statut mis à jour', 'success');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };
  const selectItem = (item: InventoryItem) => {
    if (saving) return;
    setSelected(item);
    setFormOpen(false);
    setError(null);
    setSaleConfirm(false);
    setDeleteConfirm(false);
  };

  const handleScan = async (file: File) => {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/materiel/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data_url: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur scan');
      setScanResult(data.draft?.name ?? 'Article scanné');
      toast('Article scanné — ajouté à l’inventaire', 'success');
      router.refresh();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      <Card className="p-3" ariaLabelledBy="inv-toolbar">
        <h2 id="inv-toolbar" className="sr-only">
          Recherche et tri
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            placeholder="Rechercher un objet…"
            aria-label="Rechercher"
            containerClassName="min-w-[160px] flex-1"
          />
          <select
            className={FIELD_CLASS}
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Trier"
          >
            <option value="recent">Récents</option>
            <option value="weight">Poids</option>
            <option value="price">Prix</option>
          </select>
          <Tabs
            ariaLabel="Vue"
            value={view}
            onChange={(id) => setView(id === 'table' ? 'table' : 'grid')}
            options={[
              { id: 'grid', label: 'Cartes' },
              { id: 'table', label: 'Table' },
            ]}
            className="w-auto"
          />
          <Button disabled={saving} onClick={openCreate} icon={<span aria-hidden="true">+</span>}>
            Ajouter
          </Button>
        </div>
      </Card>

      <div ref={panelRef} tabIndex={-1} className="outline-none space-y-3">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--lkv-field-bg)] p-4 text-[var(--lkv-danger)]"
          >
            {error}
          </p>
        )}
        {selected && !formOpen && (
          <Card as="section" className="p-5 space-y-4" ariaLabelledBy="inventory-detail-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="inventory-detail-title" className="text-xl font-semibold">
                {selected.name}
              </h2>
              <Button variant="ghost" disabled={saving} onClick={() => setSelected(null)}>
                Fermer
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="stone">{INVENTORY_STATUSES[getInventoryStatus(selected)]}</Badge>
              <Badge tone="sage">{INVENTORY_MODES[selected.listing_mode ?? 'personnel']}</Badge>
            </div>
            <p className="text-sm text-[var(--lkv-text-secondary)]">
              Suivi privé de votre matériel. Ces états ne publient pas d’annonce.
            </p>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              {[
                ['Marque', selected.brand],
                ['Catégorie', selected.category],
                ['Localisation', selected.location],
                ['Numéro de série (privé)', selected.serial_number],
                ['Quantité', selected.quantity],
                ['État physique', CONDITIONS[selected.condition as keyof typeof CONDITIONS]],
                ['Poids', `${selected.weight_g ?? 0} g`],
                [
                  'Prix',
                  selected.price_cents == null
                    ? '—'
                    : `${(selected.price_cents / 100).toFixed(2)} €`,
                ],
                [
                  'Location / jour',
                  selected.rental_price_cents == null
                    ? '—'
                    : `${(selected.rental_price_cents / 100).toFixed(2)} €`,
                ],
                [
                  'Caution',
                  selected.deposit_cents == null
                    ? '—'
                    : `${(selected.deposit_cents / 100).toFixed(2)} €`,
                ],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-[var(--lkv-text-muted)]">{l}</dt>
                  <dd>{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
            {selected.description && (
              <p className="whitespace-pre-wrap text-sm">{selected.description}</p>
            )}
            {selected.product_id && catalogLinks[selected.product_id] && (
              <Link
                className="inline-flex min-h-11 items-center underline"
                href={`/produit/${encodeURIComponent(catalogLinks[selected.product_id])}`}
              >
                Voir la fiche catalogue
              </Link>
            )}
            <div className="flex flex-wrap gap-2">
              {!locked(selected) && (
                <>
                  <Button disabled={saving} variant="secondary" onClick={() => openEdit(selected)}>
                    Modifier
                  </Button>
                  <Button
                    disabled={saving}
                    variant="destructive"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Supprimer
                  </Button>
                </>
              )}
              {allowedInventoryTransitions(selected).map((st) => (
                <Button
                  disabled={saving}
                  key={st}
                  variant="secondary"
                  onClick={() =>
                    st === 'vendu' ? setSaleConfirm(true) : handleTransition(selected, st)
                  }
                >
                  {transitionLabel(selected, st)}
                </Button>
              ))}
            </div>
            {saleConfirm && (
              <div className="rounded-xl bg-[var(--lkv-field-bg)] p-4 space-y-3">
                <p>
                  Suivi manuel : aucun paiement n’est déclenché. La vente concerne toute la quantité
                  et est définitive ; l’objet sera archivé sans modification possible.
                </p>
                <Button disabled={saving} onClick={() => handleTransition(selected, 'vendu')}>
                  Marquer définitivement vendu
                </Button>
                <Button disabled={saving} variant="ghost" onClick={() => setSaleConfirm(false)}>
                  Annuler la vente
                </Button>
              </div>
            )}
            {deleteConfirm && (
              <div className="space-y-3">
                <p>Supprimer définitivement cet objet ?</p>
                <Button
                  disabled={saving}
                  variant="destructive"
                  onClick={() => handleDelete(selected)}
                >
                  Confirmer la suppression
                </Button>
                <Button disabled={saving} variant="ghost" onClick={() => setDeleteConfirm(false)}>
                  Annuler
                </Button>
              </div>
            )}
          </Card>
        )}
        {formOpen && (
          <Card as="section" className="p-5" ariaLabelledBy="inventory-form-title">
            <h2 id="inventory-form-title" className="text-xl font-semibold mb-4">
              {editing ? 'Modifier l’objet' : 'Ajouter un objet'}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
              className="space-y-4"
            >
              <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  Mode
                  <select
                    className={FIELD_CLASS}
                    aria-label="Mode"
                    value={form.listing_mode}
                    disabled={Boolean(
                      editing && ['a_louer', 'a_preter'].includes(getInventoryStatus(editing))
                    )}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        listing_mode: e.target.value as InventoryMode,
                        status:
                          form.status === 'a_louer' || form.status === 'a_preter'
                            ? 'en_stock'
                            : form.status,
                      })
                    }
                  >
                    {Object.entries(INVENTORY_MODES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {!editing && (
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    Statut initial
                    <select
                      className={FIELD_CLASS}
                      aria-label="Statut initial"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value as InventoryStatus })
                      }
                    >
                      {(
                        [
                          'en_stock',
                          'a_acheter',
                          ...(form.listing_mode === 'location'
                            ? ['a_louer']
                            : form.listing_mode === 'pret'
                              ? ['a_preter']
                              : []),
                        ] as InventoryStatus[]
                      ).map((st) => (
                        <option key={st} value={st}>
                          {INVENTORY_STATUSES[st]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {editing && (
                  <p className="sm:col-span-2 text-sm">
                    Statut : {INVENTORY_STATUSES[getInventoryStatus(editing)]}. Utilisez les actions
                    de la fiche pour le changer. Revenez en stock avant de changer le mode d’un
                    objet disponible au prêt ou à la location.
                  </p>
                )}
                {(
                  [
                    ['name', 'Nom *'],
                    ['brand', 'Marque'],
                    ['serial_number', 'Numéro de série (privé)'],
                    ['location', 'Localisation'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    {label}
                    <input
                      required={key === 'name'}
                      maxLength={
                        key === 'name'
                          ? 120
                          : key === 'brand'
                            ? 80
                            : key === 'serial_number'
                              ? 120
                              : 160
                      }
                      className={FIELD_CLASS}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]: e.target.value,
                          ...(key === 'serial_number' && e.target.value.trim()
                            ? { quantity: '1' }
                            : {}),
                        })
                      }
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1">
                  Catégorie
                  <select
                    className={FIELD_CLASS}
                    aria-label="Catégorie"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  État physique
                  <select
                    className={FIELD_CLASS}
                    aria-label="État physique"
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    {Object.entries(CONDITIONS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Poids unitaire (g)
                  <input
                    className={FIELD_CLASS}
                    type="number"
                    min="0"
                    max="50000"
                    step="1"
                    value={form.weight_g}
                    onChange={(e) => setForm({ ...form, weight_g: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Quantité
                  <input
                    aria-label="Quantité"
                    aria-describedby={form.serial_number.trim() ? 'serialized-help' : undefined}
                    className={FIELD_CLASS}
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    disabled={Boolean(form.serial_number.trim())}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                  {form.serial_number.trim() && (
                    <small id="serialized-help">
                      Un numéro de série correspond à un seul exemplaire.
                    </small>
                  )}
                </label>
                {(
                  [
                    [
                      'price_eur',
                      form.listing_mode === 'vente' ? 'Prix de vente (€)' : 'Prix d’achat (€)',
                    ],
                    ...(form.listing_mode === 'location'
                      ? [['rental_eur', 'Tarif de location (€ / jour) *']]
                      : []),
                    ...(['location', 'pret'].includes(form.listing_mode)
                      ? [['deposit_eur', 'Caution (€)']]
                      : []),
                  ] as [keyof ItemFormState, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    {label}
                    <input
                      className={FIELD_CLASS}
                      type="number"
                      min={key === 'rental_eur' ? '0.01' : '0'}
                      max="1000000"
                      step="0.01"
                      required={key === 'rental_eur'}
                      value={form[key] ?? ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1 sm:col-span-2">
                  Description
                  <textarea
                    className={`${FIELD_CLASS} py-3 min-h-24`}
                    maxLength={2000}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
              </fieldset>
              <p className="text-sm text-[var(--lkv-text-muted)]">
                Gestion privée. Numéro de série non vérifié ; prix et caution sont un suivi manuel.
              </p>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} loading={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    setFormOpen(false);
                    setError(null);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-3 p-4 self-start" ariaLabelledBy="inv-filters">
          <h2 id="inv-filters" className="sr-only">
            Filtres
          </h2>
          <Eyebrow>Filtres</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            <select
              className={FIELD_CLASS}
              aria-label="Filtrer par mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="all">Tous les modes</option>
              {Object.entries(INVENTORY_MODES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={FIELD_CLASS}
              aria-label="Filtrer par statut"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(INVENTORY_STATUSES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={FIELD_CLASS}
              aria-label="Filtrer par localisation"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="all">Toutes localisations</option>
              {Array.from(new Set(items.map((i) => i.location).filter(Boolean))).map((l) => (
                <option key={l} value={l!}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={FIELD_CLASS}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filtrer par catégorie"
            >
              <option value="all">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <div className="col-span-12 md:col-span-9">
          {view === 'grid' &&
            (filtered.length > 0 ? (
              <InventoryVirtualGrid items={filtered} onSelect={selectItem} />
            ) : (
              <EmptyState compact title="Aucun objet ne correspond." />
            ))}
          {view === 'table' && (
            <Card className="p-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[color:var(--lkv-text-muted)]">
                    <th className="py-2">Nom</th>
                    <th className="py-2">Catégorie</th>
                    <th className="py-2">Poids</th>
                    <th className="py-2">Prix</th>
                    <th className="py-2">Statut / état physique</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="border-t border-[color:var(--lkv-border-subtle)]">
                      <td className="py-2 text-[color:var(--lkv-text-primary)]">
                        <button
                          className="min-h-11 px-2 text-left focus-visible:ring-2"
                          onClick={() => selectItem(i)}
                        >
                          {i.name}
                        </button>
                      </td>
                      <td className="py-2 text-[color:var(--lkv-text-secondary)]">
                        {i.category ?? '—'}
                      </td>
                      <td className="py-2">
                        {i.weight_g ? `${(i.weight_g / 1000).toFixed(2)} kg` : '—'}
                      </td>
                      <td className="py-2">
                        {i.price_cents ? `${(i.price_cents / 100).toFixed(2)} €` : '—'}
                      </td>
                      <td className="py-2">
                        <Badge tone="stone">{INVENTORY_STATUSES[getInventoryStatus(i)]}</Badge>
                        <span className="block">
                          {CONDITIONS[i.condition as keyof typeof CONDITIONS] ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>

      {/* W-I-7 Comparateur */}
      <Card className="p-4" ariaLabelledBy="inv-comparator">
        <h3 id="inv-comparator" className="sr-only">
          Comparateur d&apos;objets
        </h3>
        <Eyebrow>Comparateur</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className={`${FIELD_CLASS} min-w-[120px] flex-1`}
            value={cmpA}
            onChange={(e) => setCmpA(e.target.value)}
            aria-label="Objet A"
          >
            <option value="">— Objet A —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-[color:var(--lkv-text-muted)]">vs</span>
          <select
            className={`${FIELD_CLASS} min-w-[120px] flex-1`}
            value={cmpB}
            onChange={(e) => setCmpB(e.target.value)}
            aria-label="Objet B"
          >
            <option value="">— Objet B —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        {cmpAItem && cmpBItem && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {(['weight_g', 'price_cents', 'condition', 'brand'] as const).map((field) => (
              <Card key={field} variant="compact" className="flex flex-col gap-1 p-2">
                <span className="text-[10px] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                  {field}
                </span>
                <span className="flex justify-between">
                  <span className="text-[color:var(--lkv-text-primary)]">
                    {field === 'weight_g'
                      ? `${(cmpAItem[field] ?? 0) / 1000} kg`
                      : (cmpAItem[field] ?? '—')}
                  </span>
                  <span className="text-[color:var(--lkv-text-primary)]">
                    {field === 'weight_g'
                      ? `${(cmpBItem[field] ?? 0) / 1000} kg`
                      : (cmpBItem[field] ?? '—')}
                  </span>
                </span>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* W-I-6 Scan */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleScan(f);
          e.target.value = '';
        }}
        aria-label="Scanner un article"
      />
      {!formOpen && !selected && (
        <IconButton
          variant="glass"
          size="lg"
          onClick={() => fileRef.current?.click()}
          className="fixed bottom-24 right-5 z-[var(--z-fab)] h-14 w-14 text-[color:var(--lkv-text-primary)] shadow-elevation-4"
          aria-label="Scanner un article (OCR)"
        >
          <span aria-hidden="true">📷</span>
        </IconButton>
      )}
      {scanning && <LoadingState compact label="Analyse…" />}
      {scanError && <p className="text-sm text-[var(--lkv-danger)]">{scanError}</p>}
      {scanResult && (
        <p className="text-sm text-[color:var(--lkv-text-secondary)]">Ajouté : {scanResult}</p>
      )}
    </>
  );
}
