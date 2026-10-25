'use client';
import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** W-A-10 CollectiveActions — actions collectives sur les prêts. */
export function CollectiveActions() {
  const [status, setStatus] = useState<string | null>(null);

  const remind = () => setStatus('Rappels envoyés aux emprunteurs.');
  const extend = () => setStatus('Demande de prolongation transmise.');
  const reload = () => { window.location.reload(); };

  return (
    <Card as="article" ariaLabelledBy="actions-title" className="p-4">
      <Eyebrow>Actions collectives</Eyebrow>
      <h3 id="actions-title" className="sr-only">Actions collectives sur les prêts</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={remind}>Relancer</Button>
        <Button variant="secondary" onClick={extend}>Prolonger</Button>
        <Button variant="secondary" onClick={reload}>Rafraîchir</Button>
      </div>
      {status && <p className="mt-2 text-sm text-[color:var(--lkv-text-secondary)]">{status}</p>}
    </Card>
  );
}
