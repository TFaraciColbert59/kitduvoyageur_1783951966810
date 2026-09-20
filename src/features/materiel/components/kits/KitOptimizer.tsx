'use client';
import { useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
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

/** W-K-5 KitOptimizer — optimise un kit via /api/materiel/optimize en Liquid Glass. */
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
    <Card as="article" tone="sage" ariaLabelledBy="optimizer-title" className="p-4 sm:p-5">
      <Eyebrow>Optimiseur IA</Eyebrow>
      <h3 id="optimizer-title" className="font-display font-bold text-[20px] text-[var(--lkv-primary)] mt-0.5 mb-3">Optimisation intelligente</h3>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={kitId}
          onChange={(e) => setKitId(e.target.value)}
          aria-label="Kit à optimiser"
          className="min-h-[var(--control-height-md)] min-w-[140px] flex-1 rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-xs text-[var(--lkv-primary)] sm:text-sm"
        >
          {active.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Objectif (ex: alléger le kit)"
          aria-label="Objectif d'optimisation"
          className="min-h-[var(--control-height-md)] min-w-[140px] flex-1 rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-xs text-[var(--lkv-primary)] sm:text-sm"
        />
        <Button
          onClick={run}
          disabled={loading}
          loading={loading}
          className="h-10 shrink-0"
        >
          {loading ? 'Analyse…' : 'Optimiser ✨'}
        </Button>
      </div>

      {error && <p className="mt-3 text-xs text-[var(--lkv-danger)]">{error}</p>}

      {result && diff && (
        <Card variant="compact" className="mt-4 flex flex-col gap-2.5 p-3.5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="sage">Score {result.score ?? diff.score}/100</Badge>
            <Badge tone="info">{(diff.beforeG / 1000).toFixed(1)} → {(diff.afterG / 1000).toFixed(1)} kg</Badge>
          </div>
          <p className="text-xs sm:text-sm text-[var(--lkv-primary)] leading-relaxed">{result.analysis}</p>
          {diffSummary(diff).map((s) => <p key={s} className="text-xs text-[var(--lkv-primary-soft)] font-medium">{s}</p>)}
        </Card>
      )}
    </Card>
  );
}
