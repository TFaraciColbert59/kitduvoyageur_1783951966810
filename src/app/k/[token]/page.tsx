'use client';
import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

interface SharedKit {
  id: string; name: string; description: string | null; total_weight_g: number;
  materiel_kit_items: { name: string; category: string | null; weight_g: number; quantity: number }[];
}
interface ShareResult { kit: SharedKit; permission: string }

const PERMISSION_LABEL: Record<string, string> = { lecture: 'Lecture', fork: 'Fork', co_edition: 'Co-édition' };

export default function SharedKitPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/materiel/share?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Lien invalide');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <main className="max-w-[720px] mx-auto px-4 py-10">
      <GlassCard className="p-6">
        {error && <p className="text-sm text-danger">{error}</p>}
        {!data && !error && <p className="text-sm text-[color:var(--label-secondary)]">Chargement…</p>}
        {data && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Kit partagé</Eyebrow>
              <Badge tone="sage">{PERMISSION_LABEL[data.permission] ?? data.permission}</Badge>
            </div>
            <h1 className="font-display font-semibold text-[28px] tracking-tight text-[color:var(--label)]">{data.kit.name}</h1>
            {data.kit.description && <p className="text-sm text-[color:var(--label-secondary)]">{data.kit.description}</p>}
            <p className="text-sm text-[color:var(--label-secondary)]">Poids total : {(data.kit.total_weight_g / 1000).toFixed(1)} kg</p>
            <ul className="flex flex-col gap-2">
              {(data.kit.materiel_kit_items ?? []).map((i, idx) => (
                <li key={idx} className="glass p-3 flex items-center justify-between">
                  <span className="text-sm text-[color:var(--label)]">{i.name}</span>
                  <span className="text-xs text-[color:var(--label-tertiary)]">
                    {i.category ?? '—'} · {((i.weight_g ?? 0) / 1000).toFixed(2)} kg × {i.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>
    </main>
  );
}
