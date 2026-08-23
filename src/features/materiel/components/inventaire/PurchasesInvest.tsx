'use client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

export interface PurchasePoint { month: string; valueEur: number }

/** W-I-8 PurchasesInvest — graphe d'achats & investissement ultra-rapide en SVG natif (zéro Recharts). */
export function PurchasesInvest({ series, totalEur }: { series: PurchasePoint[]; totalEur: number }) {
  const maxVal = Math.max(...series.map((s) => s.valueEur), 50);

  return (
    <GlassCard as="article" ariaLabelledBy="purchases-title" className="p-4">
      <Eyebrow>Achats & investissement</Eyebrow>
      <h3 id="purchases-title" className="sr-only">Achats et investissement total</h3>
      <Metric value={`${totalEur.toFixed(0)} €`} size="md" tone="sage" />

      <div className="mt-4 h-[180px] w-full flex flex-col justify-between">
        {/* Bar chart area */}
        <div className="flex-1 w-full flex items-end gap-1.5 pt-4 pb-2 border-b border-stone-200/50">
          {series.length > 0 ? (
            series.map((s) => {
              const heightPct = maxVal > 0 ? Math.max(4, Math.round((s.valueEur / maxVal) * 100)) : 4;
              return (
                <div key={s.month} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip on hover/touch */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none bg-stone-900 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-10 shadow">
                    {s.valueEur} €
                  </div>
                  {/* Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[28px] rounded-t-md bg-[#5B7F55]/80 group-hover:bg-[#486944] transition-all"
                  />
                </div>
              );
            })
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-[color:var(--label-tertiary)]">
              Aucun achat enregistré sur cette période.
            </div>
          )}
        </div>

        {/* X-Axis labels */}
        {series.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1.5">
            {series.map((s) => (
              <div key={s.month} className="flex-1 text-center truncate text-[9px] md:text-[10px] text-[color:var(--label-tertiary)] font-mono">
                {s.month.slice(5)}
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
