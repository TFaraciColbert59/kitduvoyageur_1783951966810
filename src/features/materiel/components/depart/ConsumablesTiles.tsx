'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/contexts/ToastContext';

interface ConsumableField { key: string; label: string; unit: string; min: number }

const FIELDS: ConsumableField[] = [
  { key: 'water', label: 'Eau', unit: 'L', min: 0 },
  { key: 'gas', label: 'Gaz', unit: 'g', min: 0 },
  { key: 'meals', label: 'Repas', unit: 'nb', min: 0 },
  { key: 'snacks', label: 'En-cas', unit: 'nb', min: 0 },
];

/** Estimation automatique selon durée (jours) et nombre de participants. */
function estimate(days: number, pax: number): Record<string, number> {
  const d = Math.max(1, Math.round(days) || 1);
  const p = Math.max(1, Math.round(pax) || 1);
  return {
    water: Math.round(d * p * 2.5 * 10) / 10,
    gas: d * 60 * p,
    meals: d * p,
    snacks: d * p,
  };
}

/** W-D-5 ConsumablesTiles — sans icône titre, typo vert foncé (#17402C). */
export function ConsumablesTiles({
  kitId,
  initial,
  durationDays = 3,
  participants = 1,
}: {
  kitId?: string;
  initial?: Record<string, number>;
  durationDays?: number;
  participants?: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, number>>(() => ({
    water: initial?.water ?? 3,
    gas: initial?.gas ?? 230,
    meals: initial?.meals ?? 6,
    snacks: initial?.snacks ?? 4,
  }));

  const suggested = estimate(durationDays, participants);

  const applyAuto = () => {
    setValues(suggested);
    toast('Estimation recalculée (durée × participants)', 'success');
  };

  const save = async () => {
    if (!kitId) return;
    const res = await fetch(`/api/materiel/kits/${kitId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consumables: values }),
    });
    if (res.ok) { toast('Consommables enregistrés', 'success'); router.refresh(); }
    else toast('Erreur', 'error');
  };

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="consumables-title" className="p-3 md:p-4">
      <button type="button" onClick={applyAuto} aria-label="Recalculer l'estimation" className="!absolute top-1.5 right-[60px] md:top-2 md:right-20 z-10 glass interactive h-6 w-6 md:h-8 md:w-8 !rounded-full flex items-center justify-center text-[#365233]">
        <RefreshCw size={12} className="md:hidden" aria-hidden="true" />
        <RefreshCw size={15} className="hidden md:block" aria-hidden="true" />
      </button>
      {kitId && (
        <button type="button" onClick={save} aria-label="Enregistrer les consommables" className="!absolute top-1.5 right-8 md:top-2 md:right-11 z-10 glass interactive h-6 w-6 md:h-8 md:w-8 !rounded-full flex items-center justify-center text-[#365233]">
          <Check size={12} className="md:hidden" aria-hidden="true" />
          <Check size={15} className="hidden md:block" aria-hidden="true" />
        </button>
      )}
      <div className="flex items-center gap-1.5 md:gap-2 pr-[88px] md:pr-[120px]">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">Consommables</p>
      </div>
      <h3 id="consumables-title" className="sr-only">Consommables à prévoir</h3>
      <div className="mt-1.5 flex-1 grid grid-cols-2 md:grid-cols-4 gap-1.5 items-stretch">
        {FIELDS.map((f) => (
          <label key={f.key} className="glass-sub-card p-1.5 md:p-2 flex flex-col justify-center gap-0.5">
            <span className="text-[8px] md:text-[9px] font-semibold uppercase tracking-wide text-[#365233]">{f.label}</span>
            <span className="flex items-baseline gap-0.5">
              <input
                type="number"
                min={f.min}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                aria-label={f.label}
                className="w-full bg-transparent font-display font-semibold text-[15px] md:text-[18px] text-[#17402C] outline-none tabular-nums"
              />
              <span className="text-[9px] md:text-[10px] text-[#365233] font-medium">{f.unit}</span>
            </span>
          </label>
        ))}
      </div>
    </GlassCard>
  );
}
