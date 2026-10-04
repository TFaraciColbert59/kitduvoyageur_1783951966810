'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { AdminField, AdminInput } from './AdminField';
import type { ProductImage } from '@/features/admin/productUtils';

/** Îlot client : visuels du produit (téléversement, principal, suppression). */
export function ProductImagesManager({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const tokenRes = await fetch('/api/admin/csrf', { cache: 'no-store' });
      const { csrfToken } = (await tokenRes.json()) as { csrfToken: string };
      const form = new FormData();
      form.append('product_id', productId);
      form.append('alt', alt);
      form.append('file', file);
      const res = await fetch('/api/admin/products/upload', {
        method: 'POST',
        headers: { 'x-admin-csrf': csrfToken },
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Échec (${res.status})`);
      }
      setAlt('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(imageId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await call(`/api/admin/products/images/${imageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_primary: true }),
      });
      if (!res.ok) throw new Error(`Échec (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await call(`/api/admin/products/images/${imageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Échec (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <AdminField label="Texte alternatif du nouveau visuel">
          <AdminInput
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={255}
            disabled={busy}
          />
        </AdminField>
        <AdminField label="Fichier (jpeg/png/webp, ≤5 Mo)">
          <AdminInput
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!csrfReady || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
        </AdminField>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-[color:var(--glass-label-tertiary)]">Aucun visuel.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {images.map((img) => (
            <li
              key={img.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--glass-rim)] p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || ''} className="h-14 w-14 rounded-xl object-cover" />
              <span className="text-xs text-[color:var(--glass-label-secondary)]">
                {img.is_primary ? 'principal' : `ordre ${img.sort_order}`}
              </span>
              <span className="flex gap-2">
                {!img.is_primary ? (
                  <Button variant="secondary" size="sm" disabled={!csrfReady || busy} onClick={() => setPrimary(img.id)}>
                    Principal
                  </Button>
                ) : null}
                <Button variant="destructive" size="sm" disabled={!csrfReady || busy} onClick={() => remove(img.id)}>
                  Supprimer
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
