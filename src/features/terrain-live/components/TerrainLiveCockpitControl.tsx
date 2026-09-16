'use client';

/**
 * A13 (S7) — Contrôle Terrain Live du cockpit (randonnée active).
 *
 * Bouton flottant 44 px + bottom sheet iOS : liste verticale des signalements,
 * confirmations branchées sur `/api/terrain/reports/[id]/confirm`, création en
 * 3 gestes via `QuickReportSheet` branchée sur `/api/terrain/reports`.
 *
 * Flag `terrain_live` OFF ⇒ rien n'est rendu. Tokens `--lkv-*`, safe-area,
 * `prefers-reduced-motion` honoré, zéro orange, aucun dialogue natif.
 */
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import type { TerrainConfirmation } from '@/features/adventure-intelligence/schemas/live.schema';
import QuickReportSheet, { type QuickReportSubmission } from './QuickReportSheet';
import TerrainReportsList from './TerrainReportsList';
import { confirmTerrainReportViaApi, createTerrainReportViaApi } from '../lib/terrainMap';
import type { TerrainLiveReport } from '../lib/terrainDisplay';

export interface TerrainLiveCockpitControlProps {
  /** Flag `terrain_live` — faux ⇒ composant invisible. */
  enabled: boolean;
  reports: TerrainLiveReport[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Position réelle courante (null tant que le GPS n'a rien fourni). */
  position: { lat: number; lng: number } | null;
  gpsAccuracyM?: number | null;
}

export default function TerrainLiveCockpitControl({
  enabled,
  reports,
  loading,
  error,
  onRefresh,
  position,
  gpsAccuracyM = null,
}: TerrainLiveCockpitControlProps) {
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // P1-3 (fin) — sortie animée sans framer (--closing) puis unmount.
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (!render) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setClosing(false);
      setRender(false);
    }, 340);
    return () => clearTimeout(timer);
  }, [open, render]);

  const { panelRef, dragHandlers } = useSheetDrag({ onDismiss: () => setOpen(false) });

  const handleConfirm = useCallback(
    async (reportId: string, confirmation: TerrainConfirmation) => {
      setConfirmingId(reportId);
      setNotice(null);
      const result = await confirmTerrainReportViaApi(reportId, confirmation);
      setConfirmingId(null);
      if (result.ok) {
        setNotice('Merci — confirmation enregistrée.');
        onRefresh();
        return;
      }
      if (result.status === 429) {
        setNotice('Trop de confirmations récentes — réessaie dans quelques minutes.');
      } else if (result.status === 409) {
        setNotice('Ce signalement est déjà clos.');
      } else if (result.status === 401) {
        setNotice('Connecte-toi pour confirmer un signalement.');
      } else if (result.status === 503) {
        setNotice('Terrain Live est momentanément indisponible.');
      } else {
        setNotice('Confirmation impossible — vérifie ta connexion.');
      }
    },
    [onRefresh]
  );

  const handleSubmitReport = useCallback(
    async (submission: QuickReportSubmission) => {
      if (!position) {
        setNotice('Position GPS en attente — impossible de signaler pour le moment.');
        return;
      }
      setBusy(true);
      setNotice(null);
      const result = await createTerrainReportViaApi({
        category: submission.category,
        severity: submission.severity,
        passability: submission.passability,
        description: submission.description,
        lat: position.lat,
        lng: position.lng,
        gpsAccuracyM,
      });
      setBusy(false);
      if (result.ok) {
        setQuickOpen(false);
        setNotice(
          result.status === 200
            ? 'Signalement fusionné avec un signalement existant.'
            : 'Merci — signalement envoyé.'
        );
        onRefresh();
        return;
      }
      if (result.status === 422) {
        setNotice('Signalement refusé par la modération.');
      } else if (result.status === 503) {
        setNotice('Terrain Live est momentanément indisponible.');
      } else if (result.status === 401) {
        setNotice('Connecte-toi pour signaler un problème.');
      } else {
        setNotice('Envoi impossible — vérifie ta connexion.');
      }
    },
    [gpsAccuracyM, onRefresh, position]
  );

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Conditions terrain${reports.length > 0 ? ` (${reports.length})` : ''}`}
        aria-haspopup="dialog"
        className="absolute right-3.5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--lkv-border,rgba(23,64,44,0.12))] bg-[var(--lkv-surface-card,#FFFFFF)] text-[var(--lkv-text-primary,#17402C)] shadow-md active:opacity-70 md:right-6"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >
        <Icon name="radio" size={18} aria-hidden="true" />
        {reports.length > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--lkv-secondary,#17402C)] px-1 text-[11px] font-semibold text-white"
          >
            {reports.length > 99 ? '99+' : reports.length}
          </span>
        ) : null}
      </button>

      {render ? (
          <div
            className={`lkv-fade-in${closing ? ' lkv-fade-in--closing' : ''} fixed inset-0 z-50 flex items-end justify-center`}
          >
            <button
              type="button"
              aria-label="Fermer les conditions terrain"
              className="absolute inset-0 bg-[var(--lkv-overlay,rgba(11,31,23,0.4))]"
              onClick={() => setOpen(false)}
            />
            <section
              ref={panelRef as React.Ref<HTMLElement>}
              role="dialog"
              aria-modal="true"
              aria-label="Conditions terrain autour de moi"
              className={`lkv-sheet-up${closing ? ' lkv-sheet-up--closing' : ''} relative flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[var(--lkv-surface,#FBFAF6)] pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-2xl`}
              {...dragHandlers}
            >
              <div
                className="mx-auto mt-2 h-1 w-9 rounded-full bg-[var(--lkv-border-subtle,#D8D2C4)]"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between px-5 pt-3">
                <h2 className="text-[17px] font-semibold text-[var(--lkv-text-primary,#0B1F17)]">
                  Conditions terrain
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--lkv-text-secondary,#4A5D52)] active:opacity-60"
                  aria-label="Fermer"
                >
                  <Icon name="x" size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {!position ? (
                  <p
                    role="status"
                    className="mb-3 rounded-xl bg-[var(--lkv-surface-card,#FFFFFF)] px-3 py-2 text-[12px] text-[var(--lkv-text-secondary,#4A5D52)]"
                  >
                    Position GPS en attente — les conditions autour de toi arriveront dès le
                    premier point.
                  </p>
                ) : null}

                {notice ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mb-3 rounded-xl bg-[var(--lkv-secondary-subtle,#D8E5D5)] px-3 py-2 text-[12px] text-[var(--lkv-text-primary,#0B1F17)]"
                  >
                    {notice}
                  </p>
                ) : null}

                <TerrainReportsList
                  reports={reports}
                  loading={loading}
                  error={error}
                  onConfirm={handleConfirm}
                  onRefresh={onRefresh}
                  confirmingId={confirmingId}
                />
              </div>

              <div className="px-5 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickOpen(true)}
                  disabled={!position}
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--lkv-secondary,#17402C)] text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-50"
                >
                  <Icon name="plus" size={16} aria-hidden="true" />
                  Signaler un problème
                </button>
              </div>
            </section>
        </div>
      ) : null}

      <QuickReportSheet
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onSubmit={handleSubmitReport}
        busy={busy}
      />
    </>
  );
}
