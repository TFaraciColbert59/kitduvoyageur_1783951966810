'use client';

import { useState } from 'react';

import { Button } from '@/components/ui';

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

/** Bouton Rapport : export CSV du dataset d'une section via `/api/admin/report`. */
export function ReportButton({ section, label }: { section: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/report?section=${encodeURIComponent(section)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Échec (${res.status})`);
      const j = (await res.json()) as { columns: string[]; rows: (string | number)[][] };
      const lines = [
        j.columns.join(';'),
        ...j.rows.map((r) => r.map(csvCell).join(';')),
      ];
      const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-${section}.csv`;
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
      <Button variant="secondary" disabled={busy} onClick={run}>
        {label}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
