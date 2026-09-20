'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { CalendarClock, ExternalLink, FileText, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/features/trips/components/ConfirmDialog';
import { Badge, Button, IconButton, ListItem, Tabs, type BadgeTone } from '@/components/ui';
import type { TripFull } from '@/features/trips/types/trip.types';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { addTripDocumentAction, deleteTripDocumentAction } from '@/app/voyages/document-actions';
import { buildDocsView, type DocsRow, type DocsStatus } from '../../../mobile/docsEngine';
import { GroupeChipsRow, type GroupeChipDef } from '../groupe/GroupeChipsRow';
import { GroupeDrawer } from '../groupe/GroupeDrawer';
import { GroupeRail } from '../groupe/GroupeRail';

export interface DocsMobileExperienceProps {
  trip: TripFull;
}

const CATEGORY_LABELS: Record<string, string> = {
  passport: 'Passeport / ID',
  insurance: 'Assurance',
  booking: 'Réservation',
  ticket: 'Billet transport',
  medical: 'Médical / Vaccin',
  other: 'Autre',
};

const STATUS_BADGE_TONES: Record<DocsStatus, BadgeTone> = {
  expired: 'danger',
  warning: 'warn',
  valid: 'sage',
  none: 'stone',
};

type DocsFilter = 'all' | DocsStatus;

function statusShortLabel(status: DocsStatus): string {
  if (status === 'expired') return 'Expiré';
  if (status === 'warning') return 'À renouveler';
  if (status === 'valid') return 'Valide';
  return 'Sans échéance';
}

export function DocsMobileExperience({ trip }: DocsMobileExperienceProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [now] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<DocsFilter>('all');
  const [listOpen, setListOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<DocsRow | null>(null);
  const [confirmState, setConfirmState] = useState<{ id: string; title: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canEdit = trip.permissions.canEdit;
  const view = useMemo(() => buildDocsView(trip.documents || [], now), [trip.documents, now]);
  const priorityRows = useMemo(
    () => view.rows.filter((row) => row.status === 'expired' || row.status === 'warning'),
    [view.rows]
  );

  const openList = (nextFilter: DocsFilter) => {
    setFilter(nextFilter);
    setListOpen(true);
  };

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);
    startTransition(async () => {
      const res = await addTripDocumentAction(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || "Impossible d'attacher ce document");
      } else {
        triggerHaptic('success');
        form.reset();
        setAddOpen(false);
      }
    });
  };

  const confirmDelete = () => {
    if (!confirmState) return;
    const { id } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    startTransition(async () => {
      const res = await deleteTripDocumentAction(trip.id, id, trip.slug);
      if (!res.success) {
        setErrorMsg(res.error || 'Impossible de supprimer ce document');
      } else {
        setSelected((prev) => (prev?.id === id ? null : prev));
      }
    });
  };

  const chips: GroupeChipDef[] = [
    {
      key: 'total',
      icon: FileText,
      value: String(view.total),
      label: 'documents',
      onClick: () => openList('all'),
    },
    {
      key: 'expired',
      icon: ShieldCheck,
      value: String(view.expired),
      label: 'expirés',
      tone: view.expired > 0 ? 'warn' : 'default',
      onClick: () => openList('expired'),
    },
    {
      key: 'warning',
      icon: CalendarClock,
      value: String(view.warning),
      label: 'à renouveler',
      tone: view.warning > 0 ? 'accent' : 'default',
      onClick: () => openList('warning'),
    },
  ];

  const filtered = view.rows.filter((row) => (filter === 'all' ? true : row.status === filter));

  const docCard = (row: DocsRow) => (
    <li key={row.id} className="shrink-0 snap-start">
      <Button
        variant="secondary"
        onClick={() => {
          triggerHaptic('selection');
          setSelected(row);
        }}
        aria-label={`Document ${row.title} — ${statusShortLabel(row.status)}`}
        className="flex h-[10rem] w-[10rem] !flex-col !items-start !justify-start !rounded-[var(--lkv-radius-lg)] !p-3 text-left"
      >
        <Badge tone={STATUS_BADGE_TONES[row.status]} className="w-fit px-2 py-0.5">
          {statusShortLabel(row.status)}
        </Badge>
        <span className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-snug">
          {row.title}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em]">
          {CATEGORY_LABELS[row.category ?? 'other'] ?? 'Autre'}
        </span>
        <span className="mt-auto text-[10px] font-medium leading-snug">
          {row.label}
        </span>
      </Button>
    </li>
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-1">
      {errorMsg && (
        <div
          className="glass tone-danger flex items-center justify-between gap-2 rounded-xl p-3 text-xs text-[var(--lkv-danger)]"
          role="alert"
        >
          <span>{errorMsg}</span>
          <IconButton
            variant="glass"
            size="lg"
            onClick={() => setErrorMsg(null)}
            className="shrink-0 text-[var(--lkv-text-muted)]"
            aria-label="Fermer le message"
          >
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
      )}

      <section className="glass relative overflow-hidden rounded-[var(--lkv-radius-card)] p-4" aria-label="Documents du voyage">
        <header className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
            Documents du voyage
          </p>
          <Badge tone="stone" className="shrink-0 uppercase tracking-[0.08em]">{view.total} docs</Badge>
        </header>

        <ul className="mt-3 grid grid-cols-3 gap-2">
          <li className="glass-sub-card rounded-2xl p-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Expirés
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-danger)]">
              {view.expired}
            </p>
          </li>
          <li className="glass-sub-card rounded-2xl p-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              À renouveler
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-warning)]">
              {view.warning}
            </p>
          </li>
          <li className="glass-sub-card rounded-2xl p-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
              Valides
            </p>
            <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-[var(--lkv-primary)]">
              {view.valid}
            </p>
          </li>
        </ul>

        <div className="mt-4 flex gap-2">
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => {
                triggerHaptic('light');
                setAddOpen(true);
              }}
              icon={<Plus size={15} aria-hidden="true" />}
              className="flex-1 !py-3 text-sm font-bold"
            >
              Attacher
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => openList('all')}
            className="flex-1 !py-3 text-sm font-bold"
          >
            Tous les documents
          </Button>
        </div>
      </section>

      <GroupeChipsRow chips={chips} />

      <GroupeRail
        title="À traiter"
        subtitle={priorityRows.length > 0 ? `${priorityRows.length} document(s) à vérifier` : 'Rien à signaler'}
        actionLabel="Tout voir"
        onAction={() => openList('all')}
        ariaLabel="Documents à traiter"
      >
        {priorityRows.length === 0 ? (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[10rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[var(--lkv-radius-lg)] p-4">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Documents à jour</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Aucune échéance dans les 6 mois.
              </span>
            </div>
          </li>
        ) : (
          priorityRows.map(docCard)
        )}
      </GroupeRail>

      <GroupeRail
        title="Tous les documents"
        subtitle={`${view.total} pièce(s) sécurisée(s)`}
        actionLabel="Tout voir"
        onAction={() => openList('all')}
        ariaLabel="Tous les documents"
      >
        {view.rows.slice(0, 8).map(docCard)}
        {view.rows.length === 0 && (
          <li className="shrink-0 snap-start">
            <div className="glass-sub-card flex h-[10rem] w-[13rem] flex-col items-start justify-center gap-1 rounded-[var(--lkv-radius-lg)] p-4">
              <span className="text-sm font-bold text-[var(--lkv-text-primary)]">Aucun document</span>
              <span className="text-xs font-medium text-[var(--lkv-text-primary)]/70">
                Attachez passeport, assurance ou billets.
              </span>
            </div>
          </li>
        )}
      </GroupeRail>

      {/* Tiroir : liste complète filtrable */}
      <GroupeDrawer open={listOpen} onOpenChange={setListOpen} title="Documents" width={460}>
        <Tabs
          variant="scrollable"
          ariaLabel="Filtrer les documents"
          value={filter}
          onChange={(id) => setFilter(id as DocsFilter)}
          options={[
            { id: 'all', label: 'Tout' },
            { id: 'expired', label: 'Expirés' },
            { id: 'warning', label: 'À renouveler' },
            { id: 'valid', label: 'Valides' },
            { id: 'none', label: 'Sans échéance' },
          ]}
        />

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-[var(--lkv-text-primary)]/70">
            Aucun document dans ce filtre.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((row) => (
              <ListItem
                key={row.id}
                onClick={() => {
                  setListOpen(false);
                  setSelected(row);
                }}
                leading={
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <FileText size={15} aria-hidden="true" />
                  </span>
                }
                title={row.title}
                subtitle={`${CATEGORY_LABELS[row.category ?? 'other'] ?? 'Autre'} · ${row.label}`}
                trailing={
                  <Badge tone={STATUS_BADGE_TONES[row.status]} className="px-2 py-0.5">
                    {statusShortLabel(row.status)}
                  </Badge>
                }
              />
            ))}
          </ul>
        )}
      </GroupeDrawer>

      {/* Tiroir : détail document */}
      <GroupeDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.title ?? 'Document'}
        width={430}
      >
        {selected && (
          <div className="space-y-4">
            <div className="glass-sub-card space-y-2 rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/60">
                  {CATEGORY_LABELS[selected.category ?? 'other'] ?? 'Autre'}
                </span>
                <Badge tone={STATUS_BADGE_TONES[selected.status]} className="px-2.5 py-1">
                  {statusShortLabel(selected.status)}
                </Badge>
              </div>
              <p className="text-sm font-bold text-[var(--lkv-text-primary)]">{selected.title}</p>
              <p className="text-[11.5px] font-medium text-[var(--lkv-text-primary)]/70">{selected.label}</p>
              {selected.expires_at && (
                <p className="text-[10.5px] font-medium text-[var(--lkv-text-primary)]/60">
                  Expire le {new Date(selected.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {selected.notes && (
                <p className="text-[11px] font-medium leading-snug text-[var(--lkv-text-primary)]/70">
                  {selected.notes}
                </p>
              )}
            </div>

            {selected.file_url && (
              <a
                href={selected.file_url}
                target="_blank"
                rel="noreferrer"
                className="glass-capsule-btn primary inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
              >
                <ExternalLink size={15} aria-hidden="true" />
                Ouvrir le document
              </a>
            )}

            {canEdit && (
              <Button
                variant="destructive"
                fullWidth
                onClick={() => setConfirmState({ id: selected.id, title: selected.title })}
                icon={<Trash2 size={15} aria-hidden="true" />}
                className="!py-3 text-sm font-bold"
              >
                Supprimer
              </Button>
            )}
          </div>
        )}
      </GroupeDrawer>

      {/* Tiroir : ajout */}
      <GroupeDrawer open={addOpen} onOpenChange={setAddOpen} title="Attacher un document" width={460}>
        {errorMsg && (
          <p className="glass tone-danger rounded-xl p-3 text-xs text-[var(--lkv-danger)]" role="alert">
            {errorMsg}
          </p>
        )}
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <input
            type="text"
            name="title"
            required
            placeholder="Nom du document"
            aria-label="Nom du document"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="category"
              defaultValue="passport"
              aria-label="Catégorie du document"
              className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="expiresAt"
              aria-label="Date d'expiration"
              className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
            />
          </div>
          <input
            type="url"
            name="fileUrl"
            required
            placeholder="https://… (lien Cloud / Drive)"
            aria-label="Lien sécurisé du document"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)] min-h-[44px]"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Notes ou consignes particulières"
            aria-label="Notes sur le document"
            className="glass-input w-full px-3 py-2.5 text-sm text-[var(--lkv-text-primary)]"
          />
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isPending}
            className="!py-3 text-sm font-bold"
          >
            {isPending ? 'Enregistrement…' : 'Attacher le document'}
          </Button>
        </form>
      </GroupeDrawer>

      <ConfirmDialog
        open={confirmState !== null}
        title="Supprimer ce document ?"
        message={confirmState ? `Le document « ${confirmState.title} » sera définitivement supprimé.` : undefined}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

export default DocsMobileExperience;
