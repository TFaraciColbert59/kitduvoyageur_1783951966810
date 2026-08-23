'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** W-A-10 CollectiveActions — actions collectives sur les prêts. */
export function CollectiveActions() {
  const [status, setStatus] = useState<string | null>(null);

  const remind = () => setStatus('Rappels envoyés aux emprunteurs.');
  const extend = () => setStatus('Demande de prolongation transmise.');
  const reload = () => { window.location.reload(); };

  return (
    <GlassCard as="article" ariaLabelledBy="actions-title" className="p-4">
      <Eyebrow>Actions collectives</Eyebrow>
      <h3 id="actions-title" className="sr-only">Actions collectives sur les prêts</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={remind} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Relancer</button>
        <button type="button" onClick={extend} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Prolonger</button>
        <button type="button" onClick={reload} className="glass interactive h-10 px-4 rounded-full text-sm font-medium">Rafraîchir</button>
      </div>
      {status && <p className="mt-2 text-sm text-[color:var(--label-secondary)]">{status}</p>}
    </GlassCard>
  );
}
