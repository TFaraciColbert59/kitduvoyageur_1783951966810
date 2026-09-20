'use client';
import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { ForgetChecklist } from './ForgetChecklist';
import type { ForgetItem } from '@/features/materiel/services/getForgetChecklist';

/** ForgetWorkspace — checklist connectée + validation (persiste is_checked via API). */
export function ForgetWorkspace({ items }: { items: ForgetItem[] }) {
  const [status, setStatus] = useState<string | null>(null);

  const handleToggle = async (item: ForgetItem) => {
    const target = !item.is_checked;
    item.is_checked = target;
    const res = await fetch(`/api/materiel/kit-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: target }),
    });
    if (!res.ok) setStatus('Erreur de sauvegarde');
  };

  const validate = () => setStatus('Préparation validée ✓');

  return (
    <>
      <ForgetChecklist items={items} onToggle={handleToggle} />
      <Card className="mt-4 p-4">
        <Button onClick={validate} fullWidth size="lg">
          Valider la préparation
        </Button>
        {status && <p className="mt-2 text-sm text-[color:var(--lkv-text-secondary)]">{status}</p>}
      </Card>
    </>
  );
}
