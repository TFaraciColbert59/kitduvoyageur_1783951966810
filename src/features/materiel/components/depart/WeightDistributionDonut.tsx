'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

const SAGE = ['#A6C1A0', '#82A47C', '#5B7F55', '#486944', '#365237', '#223B23'];

/** W-D-6 WeightDistributionDonut — répartition du poids par catégorie. */
export function WeightDistributionDonut({ items }: { items: { category: string; value: number }[] }) {
  const data = items.length ? items : [{ category: 'Vide', value: 1 }];
  return (
    <GlassCard as="article" ariaLabelledBy="weight-donut-title" className="p-4">
      <Eyebrow>Répartition du poids</Eyebrow>
      <h3 id="weight-donut-title" className="sr-only">Répartition du poids par catégorie</h3>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="category" innerRadius={50} outerRadius={75} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={SAGE[i % SAGE.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
