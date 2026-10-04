'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { AdminField, AdminInput, AdminSelect, AdminTextarea } from './AdminField';
import { slugify } from '@/features/admin/productUtils';

export interface ProductFormState {
  name: string;
  slug: string;
  brand: string;
  model: string;
  category: string;
  category_main: string;
  category_sub: string;
  price_eur: string;
  original_price: string;
  weight_g: string;
  stock: string;
  dimensions: string;
  materials: string;
  warranty: string;
  description_why: string;
  advantages: string;
  disadvantages: string;
  essentiality: string;
  transaction_type: string;
  score_kdv: string;
  rating: string;
  image: string;
  image_alt: string;
  available: boolean;
  is_active: boolean;
  available_europe: boolean;
  available_usa: boolean;
  cabin_compatible: boolean;
}

export const EMPTY_FORM: ProductFormState = {
  name: '',
  slug: '',
  brand: '',
  model: '',
  category: '',
  category_main: '',
  category_sub: '',
  price_eur: '0',
  original_price: '',
  weight_g: '0',
  stock: '0',
  dimensions: '',
  materials: '',
  warranty: '2 ans',
  description_why: '',
  advantages: '',
  disadvantages: '',
  essentiality: 'Recommandé',
  transaction_type: 'achat',
  score_kdv: '0',
  rating: '0',
  image: '',
  image_alt: '',
  available: true,
  is_active: true,
  available_europe: true,
  available_usa: false,
  cabin_compatible: false,
};

function toPayload(form: ProductFormState): Record<string, unknown> {
  const num = (s: string, fallback = 0) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  };
  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || slugify(form.name),
    brand: form.brand,
    model: form.model,
    category: form.category,
    category_main: form.category_main,
    category_sub: form.category_sub,
    price_eur: num(form.price_eur),
    original_price: form.original_price === '' ? null : num(form.original_price),
    weight_g: Math.trunc(num(form.weight_g)),
    weight_grams: Math.trunc(num(form.weight_g)),
    stock: Math.trunc(num(form.stock)),
    dimensions: form.dimensions,
    materials: form.materials,
    warranty: form.warranty,
    description_why: form.description_why,
    advantages_array: lines(form.advantages),
    disadvantages_array: lines(form.disadvantages),
    essentiality: form.essentiality,
    transaction_type: form.transaction_type,
    score_kdv: Math.trunc(num(form.score_kdv)),
    rating: num(form.rating),
    image: form.image,
    image_alt: form.image_alt,
    available: form.available,
    is_active: form.is_active,
    available_europe: form.available_europe,
    available_usa: form.available_usa,
    cabin_compatible: form.cabin_compatible,
  };
}

/** Formulaire création / édition produit (colonnes vérifiées uniquement). */
export function ProductEditor({
  productId,
  initial,
}: {
  productId?: string;
  initial?: Partial<ProductFormState>;
}) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [form, setForm] = useState<ProductFormState>({ ...EMPTY_FORM, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ProductFormState, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }) as ProductFormState);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (!payload.name) throw new Error('Le nom est requis');
      const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
      const res = await call(url, {
        method: productId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? `Échec (${res.status})`);
      const id = (j?.data as { id?: string } | undefined)?.id ?? productId;
      router.push(`/admin/produits/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AdminField label="Nom *">
          <AdminInput value={form.name} onChange={(e) => set('name', e.target.value)} disabled={busy} maxLength={255} />
        </AdminField>
        <AdminField label="Slug (auto si vide)" hint="a-z, 0-9, tirets">
          <AdminInput value={form.slug} onChange={(e) => set('slug', e.target.value)} disabled={busy} maxLength={255} />
        </AdminField>
        <AdminField label="Marque">
          <AdminInput value={form.brand} onChange={(e) => set('brand', e.target.value)} disabled={busy} maxLength={120} />
        </AdminField>
        <AdminField label="Modèle">
          <AdminInput value={form.model} onChange={(e) => set('model', e.target.value)} disabled={busy} maxLength={120} />
        </AdminField>
        <AdminField label="Catégorie">
          <AdminInput value={form.category} onChange={(e) => set('category', e.target.value)} disabled={busy} maxLength={120} />
        </AdminField>
        <AdminField label="Catégorie principale">
          <AdminInput value={form.category_main} onChange={(e) => set('category_main', e.target.value)} disabled={busy} maxLength={120} />
        </AdminField>
        <AdminField label="Prix (€)">
          <AdminInput type="number" min="0" step="0.01" value={form.price_eur} onChange={(e) => set('price_eur', e.target.value)} disabled={busy} />
        </AdminField>
        <AdminField label="Prix d'origine (€, optionnel)">
          <AdminInput type="number" min="0" step="0.01" value={form.original_price} onChange={(e) => set('original_price', e.target.value)} disabled={busy} />
        </AdminField>
        <AdminField label="Poids (g)">
          <AdminInput type="number" min="0" step="1" value={form.weight_g} onChange={(e) => set('weight_g', e.target.value)} disabled={busy} />
        </AdminField>
        {!productId ? (
          <AdminField label="Stock initial">
            <AdminInput type="number" min="0" step="1" value={form.stock} onChange={(e) => set('stock', e.target.value)} disabled={busy} />
          </AdminField>
        ) : null}
        <AdminField label="Type de transaction">
          <AdminSelect value={form.transaction_type} onChange={(e) => set('transaction_type', e.target.value)} disabled={busy}>
            <option value="achat">achat</option>
            <option value="location">location</option>
            <option value="occasion">occasion</option>
            <option value="enchere">enchère</option>
          </AdminSelect>
        </AdminField>
        <AdminField label="Essentialité">
          <AdminSelect value={form.essentiality} onChange={(e) => set('essentiality', e.target.value)} disabled={busy}>
            {['Indispensable', 'Recommandé', 'Optionnel', 'Confort', 'Luxe'].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Image (URL)">
          <AdminInput value={form.image} onChange={(e) => set('image', e.target.value)} disabled={busy} maxLength={2048} />
        </AdminField>
        <AdminField label="Texte alternatif image">
          <AdminInput value={form.image_alt} onChange={(e) => set('image_alt', e.target.value)} disabled={busy} maxLength={1024} />
        </AdminField>
      </div>

      <AdminField label="Pourquoi ce produit (description)">
        <AdminTextarea value={form.description_why} onChange={(e) => set('description_why', e.target.value)} disabled={busy} rows={4} />
      </AdminField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AdminField label="Avantages (un par ligne)">
          <AdminTextarea value={form.advantages} onChange={(e) => set('advantages', e.target.value)} disabled={busy} />
        </AdminField>
        <AdminField label="Inconvénients (un par ligne)">
          <AdminTextarea value={form.disadvantages} onChange={(e) => set('disadvantages', e.target.value)} disabled={busy} />
        </AdminField>
        <AdminField label="Dimensions">
          <AdminInput value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} disabled={busy} maxLength={500} />
        </AdminField>
        <AdminField label="Matériaux">
          <AdminInput value={form.materials} onChange={(e) => set('materials', e.target.value)} disabled={busy} maxLength={500} />
        </AdminField>
      </div>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Disponibilité</legend>
        {(
          [
            ['available', 'Disponible'],
            ['is_active', 'Actif'],
            ['available_europe', 'Europe'],
            ['available_usa', 'USA'],
            ['cabin_compatible', 'Cabine'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={form[key]}
              onChange={(e) => set(key, e.target.checked)}
              disabled={busy}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
      <div>
        <Button variant="primary" disabled={!csrfReady || busy} onClick={save}>
          {productId ? 'Enregistrer' : 'Créer le produit'}
        </Button>
      </div>
    </div>
  );
}
