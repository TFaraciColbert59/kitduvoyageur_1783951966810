'use client';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

/** W-D-4 ChecklistDonut — donut radial 96px de complétude de checklist. */
export function ChecklistDonut({ pct }: { pct: number }) {
  const data = [{ name: 'checklist', value: Math.min(100, Math.max(0, pct)) }];
  return (
    <GlassCard as="article" ariaLabelledBy="checklist-donut-title" className="p-4">
      <Eyebrow>Checklist condensée</Eyebrow>
      <h3 id="checklist-donut-title" className="sr-only">Complétude de la checklist</h3>
      <div className="h-[120px] flex items-center justify-center">
        <ResponsiveContainer width={120} height={120}>
          <RadialBarChart data={data} innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill="var(--sage-500)" background={{ fill: 'var(--stone-200)' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <span className="absolute font-display font-semibold text-[18px] text-[color:var(--label)]">{Math.round(pct)}%</span>
      </div>
    </GlassCard>
  );
}
