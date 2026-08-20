'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
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
      <GlassCard className="p-4 mt-4">
        <button onClick={validate} className="w-full glass interactive h-12 rounded-full flex items-center justify-center text-sm font-medium text-white bg-sage-800">
          Valider la préparation
        </button>
        {status && <p className="mt-2 text-sm text-[color:var(--label-secondary)]">{status}</p>}
      </GlassCard>
    </>
  );
}
