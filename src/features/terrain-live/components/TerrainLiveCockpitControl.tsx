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
import { Badge, Button, Card, IconButton } from '@/components/ui';
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

  // Focus + Escape : entrée dans le dialogue, restitution au déclencheur.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, panelRef]);

  const handleTabTrap = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
      <IconButton
        variant="glass"
        size="lg"
        onClick={() => setOpen(true)}
        aria-label={`Conditions terrain${reports.length > 0 ? ` (${reports.length})` : ''}`}
        aria-haspopup="dialog"
        className="absolute right-3.5 bottom-[calc(var(--safe-bottom)+96px)] z-[var(--z-fab)] shadow-md md:right-6"
      >
        <Icon name="radio" size={18} aria-hidden="true" />
        {reports.length > 0 ? (
          <Badge
            className="absolute -right-1 -top-1 min-h-0 border-transparent bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-1 font-semibold text-[color:var(--lkv-text-primary)]"
          >
            {reports.length > 99 ? '99+' : reports.length}
          </Badge>
        ) : null}
      </IconButton>

      {render ? (
          <div
            className={`lkv-fade-in${closing ? ' lkv-fade-in--closing' : ''} fixed inset-0 z-[var(--z-sheet)] flex items-end justify-center`}
          >
            <button
              type="button"
              aria-label="Fermer les conditions terrain"
              className="absolute inset-0 bg-[color:var(--lkv-overlay-scrim)]"
              onClick={() => setOpen(false)}
            />
            <section
              ref={panelRef as React.Ref<HTMLElement>}
              role="dialog"
              aria-modal="true"
              aria-label="Conditions terrain autour de moi"
              tabIndex={-1}
              onKeyDown={handleTabTrap}
              className={`lkv-sheet-up${closing ? ' lkv-sheet-up--closing' : ''} relative flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-[var(--lkv-radius-sheet)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] pb-[calc(var(--safe-bottom)+16px)] shadow-2xl`}
              {...dragHandlers}
            >
              <div
                className="mx-auto mt-2 h-1 w-9 rounded-full bg-[color:var(--lkv-border-subtle)]"
                aria-hidden="true"
              />
              <div className="flex items-center justify-between px-5 pt-3">
                <h2 className="text-[length:var(--lkv-text-title-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
                  Conditions terrain
                </h2>
                <IconButton
                  variant="ghost"
                  size="lg"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                >
                  <Icon name="x" size={18} aria-hidden="true" />
                </IconButton>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {!position ? (
                  <Card
                    variant="compact"
                    role="status"
                    className="mb-3 px-3 py-2 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-secondary)]"
                  >
                    Position GPS en attente — les conditions autour de toi arriveront dès le
                    premier point.
                  </Card>
                ) : null}

                {notice ? (
                  <Card
                    variant="compact"
                    role="status"
                    aria-live="polite"
                    className="mb-3 bg-[color:var(--lkv-secondary-subtle)] px-3 py-2 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]"
                  >
                    {notice}
                  </Card>
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
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => setQuickOpen(true)}
                  disabled={!position}
                  className="min-h-[50px] gap-2"
                >
                  <Icon name="plus" size={16} aria-hidden="true" />
                  Signaler un problème
                </Button>
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
