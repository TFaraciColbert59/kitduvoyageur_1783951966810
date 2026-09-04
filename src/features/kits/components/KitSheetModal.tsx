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
import PremiumBottomSheet from '@/components/ui/PremiumBottomSheet';

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
      router.push('/mon-materiel');
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

  if (loading) {
    return (
      <PremiumBottomSheet isOpen={true} onClose={close} title="Lignée de kit">
        <div className="py-12 text-center">
          <p style={{ color: '#6B7A72', fontSize: 14 }}>Chargement de la lignée…</p>
        </div>
      </PremiumBottomSheet>
    );
  }

  if (error || !data) {
    return (
      <PremiumBottomSheet isOpen={true} onClose={close} title="Lignée de kit">
        <div className="py-8 text-center">
          <p style={{ color: '#17402C' }}>⚠️ {error ?? 'Kit introuvable'}</p>
          <button onClick={close} className="mt-4 w-full py-3 rounded-xl font-semibold text-sm" style={{ background: '#17402C', color: '#FBFAF6' }}>
            Fermer
          </button>
        </div>
      </PremiumBottomSheet>
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

  return (
    <PremiumBottomSheet
      isOpen={true}
      onClose={close}
      title={kit.name}
      snapPoints={['half', 'full']}
      defaultSnap="full"
      className="md:max-w-[420px] md:left-1/2 md:-translate-x-1/2 md:rounded-3xl"
    >
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
            <p className="mt-2 text-[13px]" style={{ color: '#6B7A72' }}>
              Issu de <em className="font-serif italic" style={{ color: '#17402C' }}>{kit.parent_name}</em>
            </p>
          )}
        </div>

        {/* Description */}
        {kit.description && (
          <p className="text-[13px] leading-relaxed" style={{ color: '#3A4A42' }}>{kit.description}</p>
        )}

        {/* État terrain */}
        <div className="rounded-2xl p-4" style={{ background: '#EDF3ED', border: '1px solid rgba(163,196,163,0.5)' }}>
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: '#17402C' }}>
            Épreuve du terrain
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[26px] font-semibold" style={{ color: '#17402C' }}>
              {fieldKm > 0 ? `${fieldKm.toLocaleString('fr-FR')} km` : '—'}
            </span>
            <span className="text-[12px]" style={{ color: '#6B7A72' }}>
              {fieldSessions} sortie{fieldSessions > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: '#6B7A72' }}>
            {fieldRegions && fieldRegions.length > 0 && (
              <span>Massifs : {fieldRegions.map((r) => r.region).slice(0, 3).join(', ')}</span>
            )}
            {fieldSeasons && (
              <span>{Object.keys(fieldSeasons).length} saison(s)</span>
            )}
          </div>
          {showScore && trust && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]" style={{ color: '#17402C' }}>
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
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase mb-2" style={{ color: '#17402C' }}>
              Ce que la lignée garde
            </div>
            <div className="flex flex-col gap-2">
              {survival.map((row: KitSurvivalRow) => {
                const rate = survivalRate(row.kept_count, row.dropped_count);
                return (
                  <div key={row.item_key} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: '#17402C' }}>{row.item_key.slice(0, 28)}</span>
                    {rate != null && (
                      <span className="font-mono text-[11px]" style={{ color: '#17402C' }}>
                        {conservationPhrase(rate)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: '#6B7A72' }}>
            Pas encore de descendance pour mesurer la conservation. Ce kit est le début d’une lignée.
          </p>
        )}

        {best && best.total_pairs > 0 && (
          <p className="text-[12px]" style={{ color: '#6B7A72' }}>
            Le plus conservé : <em className="font-serif italic" style={{ color: '#17402C' }}>{best.item_key.slice(0, 32)}</em> —{' '}
            {conservationPhrase(survivalRate(best.kept_count, best.dropped_count) ?? 0)}
          </p>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <button
            onClick={carryKit}
            className="py-2.5 px-2 rounded-xl text-[12px] font-semibold"
            style={{ background: '#17402C', color: '#FBFAF6' }}
          >
            Emporter
          </button>
          <button
            onClick={forkKit}
            disabled={busy}
            className="py-2.5 px-2 rounded-xl text-[12px] font-medium border"
            style={{ borderColor: 'rgba(163,196,163,0.8)', color: '#17402C' }}
          >
            {busy ? '…' : 'Forker'}
          </button>
          <button
            onClick={shareKit}
            disabled={busy}
            className="py-2.5 px-2 rounded-xl text-[12px] font-medium border"
            style={{ borderColor: 'rgba(163,196,163,0.8)', color: '#17402C' }}
          >
            {busy ? '…' : 'Envoyer'}
          </button>
        </div>

        {/* Transparence — mention obligatoire de la part créateur (Lot 6,
            affichée UNIQUEMENT quand la feature est active : KIT_ROYALTY_ENABLED) */}
        {royaltyEnabled && (
          <p className="text-[10px] leading-relaxed" style={{ color: '#6B7A72' }}>
            Transparence : les créateurs de cette lignée perçoivent une part sur les commandes
            issues de leur kit. LKDV reste le vendeur unique.
          </p>
        )}
      </div>
    </PremiumBottomSheet>
  );
}