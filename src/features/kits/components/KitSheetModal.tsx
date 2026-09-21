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
        <p style={{ color: 'var(--lkv-text-muted)', fontSize: 14 }}>Chargement de la lignée…</p>
      </div>
    );
  }

  if (error || !data) {
    return renderShell(
      'Lignée de kit',
      <div className="py-8 text-center">
        <p style={{ color: 'var(--lkv-primary)' }}>⚠️ {error ?? 'Kit introuvable'}</p>
        <button onClick={close} className="mt-4 w-full py-3 rounded-xl font-semibold text-sm" style={{ background: 'var(--lkv-primary)', color: 'var(--lkv-surface)' }}>
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
            <p className="mt-2 text-[13px]" style={{ color: 'var(--lkv-text-muted)' }}>
              Issu de <em className="font-serif italic" style={{ color: 'var(--lkv-primary)' }}>{kit.parent_name}</em>
            </p>
          )}
        </div>

        {/* Description */}
        {kit.description && (
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--lkv-text-secondary)' }}>{kit.description}</p>
        )}

        {/* État terrain */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--lkv-surface-muted)', border: '1px solid rgba(163,196,163,0.5)' }}>
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: 'var(--lkv-primary)' }}>
            Épreuve du terrain
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[26px] font-semibold" style={{ color: 'var(--lkv-primary)' }}>
              {fieldKm > 0 ? `${fieldKm.toLocaleString('fr-FR')} km` : '—'}
            </span>
            <span className="text-[12px]" style={{ color: 'var(--lkv-text-muted)' }}>
              {fieldSessions} sortie{fieldSessions > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--lkv-text-muted)' }}>
            {fieldRegions && fieldRegions.length > 0 && (
              <span>Massifs : {fieldRegions.map((r) => r.region).slice(0, 3).join(', ')}</span>
            )}
            {fieldSeasons && (
              <span>{Object.keys(fieldSeasons).length} saison(s)</span>
            )}
          </div>
          {showScore && trust && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]" style={{ color: 'var(--lkv-primary)' }}>
              <div>
                <div className="font-mono text-[10px] uppercase" style={{ opacity: 0.7 }}>Endurance</div>
                <div className="font-semibold">{trust.endurance_score.toFixed(2)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase" style={{ opacity: 0.7 }}>Propagation</div>
                <div className="font-semibold">{trust.propagation_score.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Conservation par item */}
        {hasItems ? (
          <div>
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase mb-2" style={{ color: 'var(--lkv-primary)' }}>
              Ce que la lignée garde
            </div>
            <div className="flex flex-col gap-2">
              {survival.map((row: KitSurvivalRow) => {
                const rate = survivalRate(row.kept_count, row.dropped_count);
                return (
                  <div key={row.item_key} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: 'var(--lkv-primary)' }}>{row.item_key.slice(0, 28)}</span>
                    {rate != null && (
                      <span className="font-mono text-[11px]" style={{ color: 'var(--lkv-primary)' }}>
                        {conservationPhrase(rate)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: 'var(--lkv-text-muted)' }}>
            Pas encore de descendance pour mesurer la conservation. Ce kit est le début d’une lignée.
          </p>
        )}

        {best && best.total_pairs > 0 && (
          <p className="text-[12px]" style={{ color: 'var(--lkv-text-muted)' }}>
            Le plus conservé : <em className="font-serif italic" style={{ color: 'var(--lkv-primary)' }}>{best.item_key.slice(0, 32)}</em> —{' '}
            {conservationPhrase(survivalRate(best.kept_count, best.dropped_count) ?? 0)}
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <button
            onClick={carryKit}
            className="py-2.5 px-2 rounded-xl text-[12px] font-semibold"
            style={{ background: 'var(--lkv-primary)', color: 'var(--lkv-surface)' }}
          >
            Emporter
          </button>
          <button
            onClick={forkKit}
            disabled={busy}
            className="py-2.5 px-2 rounded-xl text-[12px] font-medium border"
            style={{ borderColor: 'rgba(163,196,163,0.8)', color: 'var(--lkv-primary)' }}
          >
            {busy ? '…' : 'Forker'}
          </button>
          <button
            onClick={shareKit}
            disabled={busy}
            className="py-2.5 px-2 rounded-xl text-[12px] font-medium border"
            style={{ borderColor: 'rgba(163,196,163,0.8)', color: 'var(--lkv-primary)' }}
          >
            {busy ? '…' : 'Envoyer'}
          </button>
        </div>

        {/* Transparence — mention obligatoire de la part créateur (Lot 6,
            affichée UNIQUEMENT quand la feature est active : KIT_ROYALTY_ENABLED) */}
        {royaltyEnabled && (
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--lkv-text-muted)' }}>
            Transparence : les créateurs de cette lignée perçoivent une part sur les commandes
            issues de leur kit. LKDV reste le vendeur unique.
          </p>
        )}
      </div>
  );
}