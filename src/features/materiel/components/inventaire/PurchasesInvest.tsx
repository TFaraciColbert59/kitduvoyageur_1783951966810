'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

export interface PurchasePoint { month: string; valueEur: number }

/** W-I-8 PurchasesInvest — achats & investissement (2 graphes recharts). */
export function PurchasesInvest({ series, totalEur }: { series: PurchasePoint[]; totalEur: number }) {
  return (
    <GlassCard as="article" ariaLabelledBy="purchases-title" className="p-4">
      <Eyebrow>Achats & investissement</Eyebrow>
      <h3 id="purchases-title" className="sr-only">Achats et investissement total</h3>
      <Metric value={`${totalEur.toFixed(0)} €`} size="md" tone="sage" />
      <div className="mt-3 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--label-tertiary)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--label-tertiary)' }} />
            <Tooltip />
            <Bar dataKey="valueEur" name="Dépensé (€)" fill="var(--sage-500)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
