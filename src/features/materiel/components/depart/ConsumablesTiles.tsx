'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

interface ConsumableField { key: string; label: string; unit: string; min: number }

const FIELDS: ConsumableField[] = [
  { key: 'water', label: 'Eau', unit: 'L', min: 0 },
  { key: 'gas', label: 'Gaz', unit: 'g', min: 0 },
  { key: 'meals', label: 'Repas', unit: 'nb', min: 0 },
  { key: 'snacks', label: 'En-cas', unit: 'nb', min: 0 },
];

/** W-D-5 ConsumablesTiles — tuiles consommables éditées inline. */
export function ConsumablesTiles({ initial }: { initial?: Record<string, number> }) {
  const [values, setValues] = useState<Record<string, number>>(() => ({
    water: initial?.water ?? 3,
    gas: initial?.gas ?? 230,
    meals: initial?.meals ?? 6,
    snacks: initial?.snacks ?? 4,
  }));

  return (
    <GlassCard as="article" ariaLabelledBy="consumables-title" className="p-4">
      <Eyebrow>Consommables</Eyebrow>
      <h3 id="consumables-title" className="sr-only">Consommables à prévoir</h3>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="glass size-sm p-2 flex flex-col gap-1">
            <span className="text-[11px] text-[color:var(--label-secondary)]">{f.label}</span>
            <span className="flex items-baseline gap-1">
              <input
                type="number"
                min={f.min}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                aria-label={f.label}
                className="w-full bg-transparent font-display font-semibold text-[20px] text-[color:var(--label)] outline-none tabular-nums"
              />
              <span className="text-xs text-[color:var(--label-tertiary)]">{f.unit}</span>
            </span>
          </label>
        ))}
      </div>
    </GlassCard>
  );
}
