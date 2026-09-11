'use client';

/**
 * A10 (10.11) — Montage hub du cockpit Adventure Intelligence.
 *
 * Reçoit les données réelles sérialisées du serveur (`getAdventureIntelligence`),
 * résout l'état réseau côté client (pattern `useOfflineManager`, jamais
 * `navigator.onLine` directement) et rend le bloc hub + les conditions Terrain
 * Live (uniquement si le flag `terrain_live` est actif).
 *
 * Premier rendu identique serveur/client (état en ligne neutre, anti-CLS),
 * puis état réseau réel après montage. Aucun dialogue natif, aucun écran mort.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildCockpitView, type CockpitInput } from '../domain/cockpit';
import type { TerrainConfirmation } from '../schemas/live.schema';
import { useOfflineManager } from '@/features/hiking/offline/useOfflineManager';
import { TerrainReportsList } from '@/features/terrain-live';
import type { TerrainLiveReport } from '@/features/terrain-live';
import AdventureHubSection, { type HubQuickLink } from './AdventureHubSection';

export interface AdventureIntelligenceHubProps {
  /** Entrée cockpit réelle (sans `offline` : résolu côté client). */
  cockpit: Omit<CockpitInput, 'offline'>;
  /** Liens rapides réels du registre hub (déjà filtrés par nature). */
  sections?: HubQuickLink[];
  /** Destinations réelles des liens rapides (ids → URL registre). */
  sectionHrefs?: Record<string, string>;
  /** Flag `terrain_live` (défaut : inactif, comme les flags de domaine). */
  terrainEnabled?: boolean;
  terrainReports?: TerrainLiveReport[];
  className?: string;
}

export function AdventureIntelligenceHub({
  cockpit,
  sections = [],
  sectionHrefs = {},
  terrainEnabled = false,
  terrainReports = [],
  className = '',
}: AdventureIntelligenceHubProps) {
  const router = useRouter();
  const { isOffline, pendingCount } = useOfflineManager();
  const [mounted, setMounted] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Anti-hydratation : premier rendu neutre identique SSR/client, puis réel.
  const offline = mounted && isOffline;
  const view = useMemo(() => buildCockpitView({ ...cockpit, offline }), [cockpit, offline]);

  const handleSelectSection = useCallback(
    (sectionId: string) => {
      const href = sectionHrefs[sectionId];
      if (href) router.push(href);
    },
    [router, sectionHrefs]
  );

  const handleConfirm = useCallback(
    async (reportId: string, confirmation: TerrainConfirmation) => {
      setConfirmingId(reportId);
      setConfirmError(null);
      try {
        const response = await fetch(`/api/terrain/reports/${reportId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation }),
        });
        if (response.ok) {
          router.refresh();
        } else {
          setConfirmError('confirmation_failed');
        }
      } catch {
        setConfirmError('network_error');
      } finally {
        setConfirmingId(null);
      }
    },
    [router]
  );

  return (
    <div data-testid="adventure-intelligence" className={`space-y-3 ${className}`}>
      <AdventureHubSection
        view={view}
        sections={sections}
        onSelectSection={handleSelectSection}
        pendingSyncCount={pendingCount}
      />

      {terrainEnabled ? (
        <section
          data-testid="terrain-conditions"
          aria-label="Conditions terrain"
          className="space-y-2"
        >
          <h2 className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
            Conditions terrain
          </h2>
          <TerrainReportsList
            reports={terrainReports}
            loading={false}
            error={confirmError}
            onConfirm={handleConfirm}
            onRefresh={() => router.refresh()}
            confirmingId={confirmingId}
          />
        </section>
      ) : null}
    </div>
  );
}

export default AdventureIntelligenceHub;
