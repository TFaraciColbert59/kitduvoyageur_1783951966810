'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Badge, Button, Card, EmptyState, IconButton, type BadgeTone } from '@/components/ui';
import { checkDocumentExpiry } from '../engine/exportEngine';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { addTripDocumentAction, deleteTripDocumentAction } from '@/app/voyages/document-actions';
import type { TripFull, TripDocumentCategory, TripDocument } from '../types/trip.types';

interface TripDocumentsViewProps {
  trip: TripFull;
}

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

const CATEGORY_LABELS: Record<TripDocumentCategory, string> = {
  passport: "Passeport & Pièce d'identité",
  insurance: 'Assurance rapatriement & secours',
  booking: 'Réservation (Refuge / Hôtel)',
  ticket: 'Billet de transport (Vol, train, bus)',
  medical: 'Certificat médical & vaccins',
  other: 'Autre document',
};

/** Priorité d'importance par catégorie (plus bas = plus critique). */
const CATEGORY_PRIORITY: Record<TripDocumentCategory, number> = {
  passport: 0,
  insurance: 1,
  ticket: 2,
  booking: 3,
  medical: 4,
  other: 9,
};

/** Catégories indispensables pour tout voyage. */
const REQUIRED_CATEGORIES: Set<TripDocumentCategory> = new Set([
  'passport',
  'insurance',
  'ticket',
  'booking',
]);

/** Top 6 requis affichés dans le bloc « Documents nécessaires » (le reste reste listé dessous). */
const REQUIRED_TOP_LIMIT = 6;

function isRequired(doc: TripDocument): boolean {
  return REQUIRED_CATEGORIES.has(doc.category);
}

/**
 * Tri importance-first : priorité de catégorie, puis expiration la plus
 * proche en premier (nulls en dernier), puis création la plus récente.
 */
function sortDocuments(docs: TripDocument[]): TripDocument[] {
  return [...docs].sort((a, b) => {
    const prioDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (prioDiff !== 0) return prioDiff;

    if (a.expires_at && b.expires_at) {
      const expDiff = new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      if (expDiff !== 0) return expDiff;
    } else if (a.expires_at) {
      return -1;
    } else if (b.expires_at) {
      return 1;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function TripDocumentsView({ trip }: TripDocumentsViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ docId: string; title: string } | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const canEdit = trip.permissions.canEdit;

  const allSorted = sortDocuments(trip.documents);
  const requiredDocs = allSorted.filter(isRequired);
  const topRequired = requiredDocs.slice(0, REQUIRED_TOP_LIMIT);
  const overflowRequiredCount = requiredDocs.length - topRequired.length;
  const topRequiredIds = new Set(topRequired.map((d) => d.id));
  const remainingDocs = allSorted.filter((d) => !topRequiredIds.has(d.id));

  const handleDelete = (docId: string) => {
    setConfirmState({ docId, title: allSorted.find((d) => d.id === docId)?.title || 'document' });
  };

  const confirmDelete = () => {
    if (!confirmState) return;
    const { docId } = confirmState;
    setConfirmState(null);
    triggerHaptic('medium');
    startTransition(async () => {
      const res = await deleteTripDocumentAction(trip.id, docId, trip.slug);
      if (!res.success) {
        setErrorMsg(res.error || 'Impossible de supprimer ce document');
      }
    });
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set('tripId', trip.id);
    formData.set('tripSlug', trip.slug);

    startTransition(async () => {
      const res = await addTripDocumentAction(null, formData);
      if (!res.success) {
        setErrorMsg(res.error || "Erreur lors de l'enregistrement");
      } else {
        triggerHaptic('success');
        setIsAddOpen(false);
      }
    });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex items-center justify-end">
        {canEdit && (
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            icon={<Icon name="plus" size={16} />}
          >
            Attacher un document
          </Button>
        )}
      </div>

      {errorMsg && (
        <Card
          role="alert"
          tone="danger"
          className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
        >
          {errorMsg}
        </Card>
      )}
      <p className="flex items-center gap-[var(--space-2)] px-1 text-[11px] text-[color:var(--lkv-text-muted)]">
        <Icon
          name="shield-check"
          size={14}
          className="shrink-0 text-[color:var(--lkv-secondary)]"
          aria-hidden="true"
        />
        <span>Chiffrés, jamais exposés aux visiteurs anonymes.</span>
      </p>

      {/* Bloc « Documents nécessaires » : sous-ensemble requis, importance-first */}
      {trip.documents.length === 0 ? (
        <EmptyState
          icon={<Icon name="file-check" size={32} className="text-[color:var(--lkv-secondary)]" />}
          title="Aucun document attaché"
          description="Attachez vos billets d'avion, réservations de refuges, assurances et passeports pour les garder accessibles partout."
          actionLabel={canEdit ? 'Attacher un document' : undefined}
          onAction={canEdit ? () => setIsAddOpen(true) : undefined}
        />
      ) : (
        <>
          {topRequired.length > 0 && (
            <Card as="section" id="documents-necessaires" aria-label="Documents nécessaires" className="space-y-[var(--space-3)]">
              <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
                <h3 className="flex items-center gap-[var(--space-2)] font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                  <Icon
                    name="shield-check"
                    size={14}
                    className="shrink-0 text-[color:var(--lkv-secondary)]"
                    aria-hidden="true"
                  />
                  Documents nécessaires
                </h3>
                <Badge tone="stone">{requiredDocs.length} requis pour ce voyage</Badge>
              </div>
              <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                {topRequired.map((doc) => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    required
                    canEdit={canEdit}
                    isPending={isPending}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
              {overflowRequiredCount > 0 && (
                <a
                  href="#tous-les-documents"
                  className="-mx-1 inline-flex min-h-[44px] items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-sm)] px-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
                >
                  +{overflowRequiredCount} autres documents ↓
                </a>
              )}
            </Card>
          )}

          {/* Suite de la liste : requis restants + documents secondaires */}
          <section
            id="tous-les-documents"
            aria-label="Tous les documents"
            className="space-y-[var(--space-3)] scroll-mt-4"
          >
            <h3 className="px-1 font-display text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
              Tous les documents ({trip.documents.length})
            </h3>
            <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
              {remainingDocs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  canEdit={canEdit}
                  isPending={isPending}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Modal d'ajout de document */}
      <Sheet
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Attacher un document sécurisé"
      >
        <div className="pb-2">
          {errorMsg && (
            <Card
              role="alert"
              tone="danger"
              className="mb-[var(--space-4)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
            >
              {errorMsg}
            </Card>
          )}

          <form onSubmit={handleAddSubmit} className="space-y-[var(--space-4)]">
            <label className="block">
              <span className={LABEL_CLASS}>Nom du document</span>
              <input
                type="text"
                name="title"
                required
                placeholder="ex: Passeport biométrique, Billet Vol AR Lima"
                className={FIELD_CLASS}
              />
            </label>

            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <label className="block">
                <span className={LABEL_CLASS}>Catégorie</span>
                <select name="category" defaultValue="passport" className={FIELD_CLASS}>
                  <option value="passport">Passeport / ID</option>
                  <option value="insurance">Assurance</option>
                  <option value="booking">Réservation</option>
                  <option value="ticket">Billet transport</option>
                  <option value="medical">Médical / Vaccin</option>
                  <option value="other">Autre</option>
                </select>
              </label>

              <label className="block">
                <span className={LABEL_CLASS}>Date d&apos;expiration (optionnelle)</span>
                <input type="date" name="expiresAt" className={FIELD_CLASS} />
              </label>
            </div>

            <label className="block">
              <span className={LABEL_CLASS}>Lien sécurisé (URL Cloud / Drive)</span>
              <input
                type="url"
                name="fileUrl"
                required
                placeholder="https://..."
                className={FIELD_CLASS}
              />
            </label>

            <label className="block">
              <span className={LABEL_CLASS}>Notes ou consignes particulières</span>
              <textarea
                name="notes"
                rows={2}
                placeholder="ex: N° d'assuré 12345, contact d'urgence 24/7"
                className={FIELD_CLASS}
              />
            </label>

            <div className="flex items-center justify-end gap-[var(--space-3)] pt-[var(--space-2)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" loading={isPending}>
                {isPending ? 'Enregistrement...' : 'Attacher le document'}
              </Button>
            </div>
          </form>
        </div>
      </Sheet>

      {/* Modale de confirmation de suppression */}
      <ConfirmDialog
        open={confirmState !== null}
        title="Supprimer ce document ?"
        message={
          confirmState
            ? `Le document « ${confirmState.title} » sera définitivement supprimé.`
            : undefined
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

interface DocCardProps {
  doc: TripDocument;
  required?: boolean;
  canEdit: boolean;
  isPending: boolean;
  onDelete: (docId: string) => void;
}

function DocCard({ doc, required = false, canEdit, isPending, onDelete }: DocCardProps) {
  const expiryCheck = checkDocumentExpiry(doc);
  const expiryTone: BadgeTone =
    expiryCheck.status === 'expired' ? 'danger' : expiryCheck.status === 'warning' ? 'warn' : 'sage';

  return (
    <Card as="article" className="flex flex-col justify-between gap-[var(--space-4)]">
      <div className="space-y-[var(--space-2)]">
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)]/10 text-[color:var(--lkv-primary)]">
              <Icon name="file-text" size={18} />
            </div>
            <div>
              <div className="text-[length:var(--lkv-text-footnote)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                {doc.title}
              </div>
              <div className="text-[11px] text-[color:var(--lkv-text-secondary)]">
                {CATEGORY_LABELS[doc.category] || doc.category}
              </div>
            </div>
          </div>

          {/* Badge d'échéance (expiré / avertissement en premier) */}
          {expiryCheck.status !== 'none' && (
            <Badge tone={expiryTone} className="shrink-0">
              {expiryCheck.status === 'expired' && <Icon name="alert-triangle" size={10} />}
              {expiryCheck.status === 'warning' && <Icon name="clock" size={10} />}
              {expiryCheck.status === 'valid' && <Icon name="check-circle2" size={10} />}
              <span>{expiryCheck.label}</span>
            </Badge>
          )}
        </div>

        {required && (
          <Badge tone="sage">
            <Icon name="shield-check" size={11} aria-hidden="true" />
            requis
          </Badge>
        )}

        {doc.notes && (
          <Card variant="compact" className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
            {doc.notes}
          </Card>
        )}
      </div>

      {/* Barre d'action document */}
      <div className="flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)] text-[length:var(--lkv-text-footnote)]">
        <a
          href={doc.file_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-[var(--space-2)] py-1 font-semibold text-[color:var(--lkv-text-primary)] transition-colors hover:text-[color:var(--lkv-secondary)]"
        >
          <span>Ouvrir le document</span>
          <Icon name="external-link" size={13} />
        </a>

        {canEdit && (
          <IconButton
            type="button"
            size="sm"
            onClick={() => onDelete(doc.id)}
            disabled={isPending}
            aria-label="Supprimer ce document"
            title="Supprimer ce document"
          >
            <Icon name="trash2" size={15} />
          </IconButton>
        )}
      </div>
    </Card>
  );
}
