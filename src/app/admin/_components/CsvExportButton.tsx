'use client';

import { useState } from 'react';

import { Button } from '@/components/ui';
import { buildProductsCsv, type ShopProduct } from '@/features/admin/productUtils';

/** Îlot client : export CSV du catalogue (recherche courante, toutes pages). */
export function CsvExportButton({ q }: { q: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const all: ShopProduct[] = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;
      while (all.length < total) {
        const res = await fetch(
          `/api/admin/products?q=${encodeURIComponent(q)}&page=${page}&pageSize=100`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`Échec (${res.status})`);
        const j = (await res.json()) as { data: ShopProduct[]; total: number };
        all.push(...j.data);
        total = j.total;
        page += 1;
        if (page > 100) break;
      }
      const blob = new Blob([buildProductsCsv(all)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalogue.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="secondary" size="sm" disabled={busy} onClick={run}>
        Exporter CSV
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
