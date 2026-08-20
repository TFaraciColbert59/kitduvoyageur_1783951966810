'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { computeDiff, diffSummary, type OptimizeAction } from '@/lib/materiel/optimizer';
import type { KitListItem } from '@/features/materiel/services/getKits';

interface OptimizeResult {
  analysis: string;
  removals: OptimizeAction[];
  replacements: OptimizeAction[];
  additions: OptimizeAction[];
  after_weight_kg: number;
  after_price_eur_estimate: number;
  co2_kg_saved_estimate: number;
  score: number;
}

/** W-K-5 KitOptimizer — optimise un kit via /api/materiel/optimize (SSE). */
export function KitOptimizer({ kits }: { kits: KitListItem[] }) {
  const active = kits.filter((k) => !k.is_trashed);
  const [kitId, setKitId] = useState(active[0]?.id ?? '');
  const [goal, setGoal] = useState('alléger le kit');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!kitId) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/materiel/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId, goal }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Erreur IA');
      }
      const text = await res.text();
      let parsed: OptimizeResult | null = null;
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.type === 'chunk' && payload.chunk?.content) {
          parsed = JSON.parse(payload.chunk.content);
        }
      }
      if (!parsed) throw new Error('Réponse IA vide');
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const kit = active.find((k) => k.id === kitId);
  const diff = result && kit ? computeDiff({
    current: kit.items,
    afterWeightKg: result.after_weight_kg ?? kit.total_weight_g / 1000,
    removals: result.removals ?? [],
    additions: result.additions ?? [],
    replacements: result.replacements ?? [],
  }) : null;

  return (
    <GlassCard as="article" ariaLabelledBy="optimizer-title" className="p-4">
      <Eyebrow>Optimiseur IA</Eyebrow>
      <h3 id="optimizer-title" className="sr-only">Optimisation de kit par IA</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={kitId} onChange={(e) => setKitId(e.target.value)} aria-label="Kit à optimiser" className="glass-input flex-1 min-w-[140px]">
          {active.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Objectif (ex: alléger le kit)"
          aria-label="Objectif d'optimisation"
          className="glass-input flex-1 min-w-[140px]"
        />
        <button type="button" onClick={run} disabled={loading} className="glass interactive h-11 px-4 rounded-full text-sm font-medium text-white bg-sage-800 disabled:opacity-40">
          {loading ? 'Analyse…' : 'Optimiser ✨'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {result && diff && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="sage">Score {result.score ?? diff.score}/100</Badge>
            <Badge tone="info">{(diff.beforeG / 1000).toFixed(1)} → {(diff.afterG / 1000).toFixed(1)} kg</Badge>
          </div>
          <p className="text-sm text-[color:var(--label)]">{result.analysis}</p>
          {diffSummary(diff).map((s) => <p key={s} className="text-xs text-[color:var(--label-secondary)]">{s}</p>)}
        </div>
      )}
    </GlassCard>
  );
}
