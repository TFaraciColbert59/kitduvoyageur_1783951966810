'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import {
  KitSheetData,
  KitSheetKit,
  KitTrustRow,
  KitSurvivalRow,
} from '../types';
import {
  scoreStatus,
  survivalRate,
  conservationPhrase,
  shouldDisplayScore,
} from '../trust';
import { Modal, Sheet } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const ORIGIN_LABEL: Record<string, string> = {
  configurateur: 'Conçu dans le configurateur',
  manuel: 'Créé à la main',
  fork: 'Adapté d’un autre kit',
  import_gpx: 'Importé d’une trace',
  souche_editoriale: 'Souche LKDV',
};

interface KitSheetModalProps {
  kitId: string;
  /** Contexte d'ouverture (tracking) — réservé pour l'attribution (Lot 6). */
  context?: string;
  onClose: () => void;
}

export default function KitSheetModal({ kitId, context: _context, onClose }: KitSheetModalProps) {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const [data, setData] = useState<KitSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError(null);
    fetch(`/api/kits/${kitId}/sheet`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Kit introuvable'))))
      .then((d: KitSheetData) => {
        if (!active) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kitId]);

  const close = useCallback(() => {
    haptic('light');
    onClose();
  }, [haptic, onClose]);

  const forkKit = useCallback(async () => {
    if (!data) return;
    haptic('medium');
    setBusy(true);
    try {
      const res = await fetch('/api/materiel/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: data.kit.id }),
      });
      if (!res.ok) throw new Error('Impossible de forker ce kit');
      onClose();
      router.push('/hub/kit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [data, haptic, onClose, router]);

  const shareKit = useCallback(async () => {
    if (!data) return;
    haptic('medium');
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/materiel/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: data.kit.id, permission: 'lecture' }),
      });
      if (!res.ok) throw new Error('Impossible de partager');
      const { url } = (await res.json()) as { url: string };
      const full = `${window.location.origin}${url}`;
      await navigator.clipboard?.writeText(full).catch(() => {});
      if (mounted.current) {
        haptic('success');
        setNotice('Lien de partage copié dans le presse-papier.');
      }
      if (mounted.current) setBusy(false);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Erreur');
      setBusy(false);
    }
  }, [data, haptic]);

  const carryKit = useCallback(() => {
    haptic('medium');
    router.push(`/randonnee-active?kitId=${data?.kit.id ?? ''}`);
  }, [data, haptic, router]);

  const isDesktop = useMediaQuery('(min-width: 768px)');
  const renderShell = (title: string, children: React.ReactNode) =>
    isDesktop ? (
      <Modal open onOpenChange={(v) => !v && close()} title={title} size="lg">
        {children}
      </Modal>
    ) : (
      <Sheet open onOpenChange={(v) => !v && close()} title={title} detent="large">
        {children}
      </Sheet>
    );

  if (loading) {
    return renderShell(
      'Lignée de kit',
      <div className="py-12 text-center">
        <p className="text-[14px] text-[color:var(--lkv-text-muted)]">Chargement de la lignée…</p>
      </div>
    );
  }

  if (error || !data) {
    return renderShell(
      'Lignée de kit',
      <div className="py-8 text-center">
        <p className="text-[color:var(--lkv-primary)]">⚠️ {error ?? 'Kit introuvable'}</p>
        <button onClick={close} className="mt-4 w-full rounded-xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn py-3 text-sm font-semibold text-[color:var(--lkv-surface)]">
          Fermer
        </button>
      </div>
    );
  }

  const { kit, journal, trust, survival, royalty_enabled: royaltyEnabled } = data;
  const status = scoreStatus(trust?.sessions_count ?? 0);
  const originLabel = ORIGIN_LABEL[kit.origin] ?? kit.origin;
  const hasItems = survival.length > 0;
  const fieldRegions = journal?.field?.regions ?? null;
  const fieldSeasons = journal?.field?.seasons ?? null;
  const fieldSessions = journal?.field?.session_count ?? 0;
  const fieldKm = journal?.field?.total_km ?? 0;
  const best = [...survival].sort((a, b) => (survivalRate(b.kept_count, b.dropped_count) ?? 0) - (survivalRate(a.kept_count, a.dropped_count) ?? 0))[0];
  const showScore = trust != null && shouldDisplayScore(trust.sessions_count);

  return renderShell(
    kit.name,
    <div className="flex flex-col gap-4 pb-6">
        {/* En-tête métadonnées */}
        <div>
          <Eyebrow>Lignée de kit</Eyebrow>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge tone={kit.is_souche ? 'sage' : 'info'}>{originLabel}</Badge>
            {kit.generation > 0 && <Badge tone="stone">Génération {kit.generation}</Badge>}
            {status.displayScore && <Badge tone="sage">{status.label}</Badge>}
            {!status.displayScore && <Badge tone="stone">{status.label}</Badge>}
          </div>
          {kit.parent_name && (
            <p className="mt-2 text-[13px] text-[color:var(--lkv-text-muted)]">
              Issu de <em className="font-serif italic text-[color:var(--lkv-primary)]">{kit.parent_name}</em>
            </p>
          )}
        </div>

        {/* Description */}
        {kit.description && (
          <p className="text-[13px] leading-relaxed text-[color:var(--lkv-text-secondary)]">{kit.description}</p>
        )}

        {/* État terrain */}
        <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--lkv-primary)]">
            Épreuve du terrain
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[26px] font-semibold text-[color:var(--lkv-primary)]">
              {fieldKm > 0 ? `${fieldKm.toLocaleString('fr-FR')} km` : '—'}
            </span>
            <span className="text-[12px] text-[color:var(--lkv-text-muted)]">
              {fieldSessions} sortie{fieldSessions > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[color:var(--lkv-text-muted)]">
            {fieldRegions && fieldRegions.length > 0 && (
              <span>Massifs : {fieldRegions.map((r) => r.region).slice(0, 3).join(', ')}</span>
            )}
            {fieldSeasons && (
              <span>{Object.keys(fieldSeasons).length} saison(s)</span>
            )}
          </div>
          {showScore && trust && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-[color:var(--lkv-primary)]">
              <div>
                <div className="font-mono text-[10px] uppercase opacity-70">Endurance</div>
                <div className="font-semibold">{trust.endurance_score.toFixed(2)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase opacity-70">Propagation</div>
                <div className="font-semibold">{trust.propagation_score.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Conservation par item */}
        {hasItems ? (
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--lkv-primary)]">
              Ce que la lignée garde
            </div>
            <div className="flex flex-col gap-2">
              {survival.map((row: KitSurvivalRow) => {
                const rate = survivalRate(row.kept_count, row.dropped_count);
                return (
                  <div key={row.item_key} className="flex items-center justify-between text-[13px]">
                    <span className="text-[color:var(--lkv-primary)]">{row.item_key.slice(0, 28)}</span>
                    {rate != null && (
                      <span className="font-mono text-[11px] text-[color:var(--lkv-primary)]">
                        {conservationPhrase(rate)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-[color:var(--lkv-text-muted)]">
            Pas encore de descendance pour mesurer la conservation. Ce kit est le début d’une lignée.
          </p>
        )}

        {best && best.total_pairs > 0 && (
          <p className="text-[12px] text-[color:var(--lkv-text-muted)]">
            Le plus conservé : <em className="font-serif italic text-[color:var(--lkv-primary)]">{best.item_key.slice(0, 32)}</em> —{' '}
            {conservationPhrase(survivalRate(best.kept_count, best.dropped_count) ?? 0)}
          </p>
        )}

        {/* Actions */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={carryKit}
            className="rounded-xl bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-2 py-2.5 text-[12px] font-semibold text-[color:var(--lkv-surface)]"
          >
            Emporter
          </button>
          <button
            onClick={forkKit}
            disabled={busy}
            className="rounded-xl border border-[color:var(--lkv-border)] px-2 py-2.5 text-[12px] font-medium text-[color:var(--lkv-primary)]"
          >
            {busy ? '…' : 'Forker'}
          </button>
          <button
            onClick={shareKit}
            disabled={busy}
            className="rounded-xl border border-[color:var(--lkv-border)] px-2 py-2.5 text-[12px] font-medium text-[color:var(--lkv-primary)]"
          >
            {busy ? '…' : 'Envoyer'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-center text-[12px] text-[color:var(--lkv-danger)]">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" aria-live="polite" className="text-center text-[12px] text-[color:var(--lkv-success)]">
            {notice}
          </p>
        )}

        {/* Transparence — mention obligatoire de la part créateur (Lot 6,
            affichée UNIQUEMENT quand la feature est active : KIT_ROYALTY_ENABLED) */}
        {royaltyEnabled && (
          <p className="text-[10px] leading-relaxed text-[color:var(--lkv-text-muted)]">
            Transparence : les créateurs de cette lignée perçoivent une part sur les commandes
            issues de leur kit. LKDV reste le vendeur unique.
          </p>
        )}
      </div>
  );
}