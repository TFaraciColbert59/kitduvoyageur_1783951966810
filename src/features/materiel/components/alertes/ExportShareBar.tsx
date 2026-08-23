'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** W-L-10 ExportShareBar — export (CSV/JSON), partage, calendrier. */
export function ExportShareBar() {
  const [status, setStatus] = useState<string | null>(null);

  const exportInv = async (format: 'csv' | 'json') => {
    const res = await fetch('/api/materiel/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, scope: 'inventory' }),
    });
    if (!res.ok) { setStatus('Erreur export'); return; }
    if (format === 'csv') {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'inventaire.csv'; a.click();
      URL.revokeObjectURL(url);
      setStatus('Inventaire exporté (CSV)');
    } else {
      setStatus('Inventaire exporté (JSON) — ouvert dans la console');
      const data = await res.json();
      console.log(data);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/materiel');
      setStatus('Lien copié');
    } catch {
      setStatus('Partage non disponible');
    }
  };

  const calendar = () => { window.location.href = '/api/materiel/calendar'; };

  return (
    <GlassCard as="article" ariaLabelledBy="export-title" className="p-4">
      <Eyebrow>Export & partage</Eyebrow>
      <h3 id="export-title" className="sr-only">Export et partage</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => exportInv('csv')} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Export CSV</button>
        <button type="button" onClick={() => exportInv('json')} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Export JSON</button>
        <button type="button" onClick={share} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Partager</button>
        <button type="button" onClick={calendar} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Calendrier (ICS)</button>
      </div>
      {status && <p className="mt-2 text-sm text-[color:var(--label-secondary)]">{status}</p>}
    </GlassCard>
  );
}
