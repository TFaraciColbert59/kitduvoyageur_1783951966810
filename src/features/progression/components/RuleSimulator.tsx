'use client';

import { useState } from 'react';
import type { RuleSimulationReport } from '@/features/progression/server/rulePublication';

interface SampleRow {
  action: string;
  count: string;
}

const DEFAULT_ROW: SampleRow = { action: 'hike_session_processed', count: '1' };

/**
 * T42 — Simulateur de barème (admin) : prévisualisation SANS écriture.
 * Les faits échantillonnés sont envoyés à la route admin (garde is_admin) qui
 * ne renvoie qu'un rapport projeté — jamais un solde, jamais une publication.
 */
export default function RuleSimulator() {
  const [samples, setSamples] = useState<SampleRow[]>([DEFAULT_ROW]);
  const [report, setReport] = useState<RuleSimulationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateRow = (index: number, patch: Partial<SampleRow>) => {
    setSamples((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setSamples((current) => [...current, { ...DEFAULT_ROW, count: '0' }]);

  const removeRow = (index: number) => {
    setSamples((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = samples.map((row) => ({
        action: row.action.trim(),
        count: Number(row.count),
      }));
      const response = await fetch('/api/admin/progression/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ samples: payload }),
      });
      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; report?: RuleSimulationReport; error?: string }
        | null;
      if (!response.ok || !body?.success || !body.report) {
        setReport(null);
        setError(body?.error ?? 'Simulation impossible');
        return;
      }
      setReport(body.report);
    } catch {
      setReport(null);
      setError('Simulation impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[color:var(--lkv-forest-900)]/60 p-5">
        <h2 className="text-sm font-semibold text-white">Faits échantillonnés</h2>
        <p className="mt-1 text-xs text-white/45">
          Simulation pure : aucune écriture de solde ni de règle. Seules les actions
          publiées produisent des XP projetés ; toute autre est refusée avec son motif.
        </p>

        <div className="mt-4 space-y-3">
          {samples.map((row, index) => (
            <div key={index} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor={`sim-action-${index}`}
                  className="mb-1 block text-xs font-medium text-white/60"
                >
                  Action
                </label>
                <input
                  id={`sim-action-${index}`}
                  type="text"
                  value={row.action}
                  onChange={(event) => updateRow(index, { action: event.target.value })}
                  placeholder="hike_session_processed"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                />
              </div>
              <div className="w-full sm:w-40">
                <label
                  htmlFor={`sim-count-${index}`}
                  className="mb-1 block text-xs font-medium text-white/60"
                >
                  Nombre de faits
                </label>
                <input
                  id={`sim-count-${index}`}
                  type="number"
                  min={0}
                  value={row.count}
                  onChange={(event) => updateRow(index, { count: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={samples.length <= 1}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition-colors hover:text-white disabled:opacity-30"
                aria-label={`Retirer la ligne ${index + 1}`}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:text-white"
          >
            + Ajouter une action
          </button>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="rounded-xl bg-[color:var(--lkv-primary)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Simulation…' : 'Simuler'}
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-xs text-[color:var(--lkv-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      {report ? (
        <div className="rounded-2xl border border-white/10 bg-[color:var(--lkv-forest-900)]/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              Rapport projeté — registre {report.version}
            </h2>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
              {report.totalProjectedXp} XP projetés · {report.refused} refus
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-white/40">
                  <th className="pb-2 pr-4 font-medium">Action</th>
                  <th className="pb-2 pr-4 font-medium">Faits</th>
                  <th className="pb-2 pr-4 font-medium">XP projetés</th>
                  <th className="pb-2 pr-4 font-medium">Refus</th>
                  <th className="pb-2 font-medium">Motif</th>
                </tr>
              </thead>
              <tbody className="text-white/75">
                {report.lines.map((line, index) => (
                  <tr key={index} className="border-t border-white/5">
                    <td className="py-2 pr-4 font-mono">{line.action}</td>
                    <td className="py-2 pr-4">{line.count}</td>
                    <td className="py-2 pr-4">{line.projectedXp}</td>
                    <td className="py-2 pr-4">{line.refusals}</td>
                    <td className="py-2 font-mono text-white/50">{line.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-white/35">
            Prévisualisation uniquement : la publication d'une version du barème est une
            opération journalisée distincte, et l'activation reste fermée tant que ses
            conditions (date d'effet, preuves, cohortes) ne sont pas réunies.
          </p>
        </div>
      ) : null}
    </div>
  );
}
