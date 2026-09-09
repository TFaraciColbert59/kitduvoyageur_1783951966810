'use client';

import React, { useState, useTransition } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { EmptyState } from '@/components/ui/EmptyState';
import { checkDocumentExpiry } from '../engine/exportEngine';
import { ConfirmDialog } from './ConfirmDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { addTripDocumentAction, deleteTripDocumentAction } from '@/app/voyages/document-actions';
import type { TripFull, TripDocumentCategory, TripDocument } from '../types/trip.types';

interface TripDocumentsViewProps {
  trip: TripFull;
}

const CATEGORY_LABELS: Record<TripDocumentCategory, string> = {
  passport: 'Passeport & Pièce d\'identité',
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
        setErrorMsg(res.error || 'Erreur lors de l\'enregistrement');
      } else {
        triggerHaptic('success');
        setIsAddOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {canEdit && (
          <GlassCapsuleBtn
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            icon={<Plus size={16} />}
          >
            Attacher un document
          </GlassCapsuleBtn>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs">
          {errorMsg}
        </div>
      )}
      <p className="flex items-center gap-2 text-[11px] text-[var(--lkv-text-muted)] px-1">
        <ShieldCheck size={14} className="text-lkv-secondary shrink-0" aria-hidden="true" />
        <span>Chiffrés, jamais exposés aux visiteurs anonymes.</span>
      </p>

      {/* Bloc « Documents nécessaires » : sous-ensemble requis, importance-first */}
      {trip.documents.length === 0 ? (
        <EmptyState
          icon={<FileCheck size={32} className="text-lkv-secondary" />}
          title="Aucun document attaché"
          description="Attachez vos billets d'avion, réservations de refuges, assurances et passeports pour les garder accessibles partout."
          actionLabel={canEdit ? "Attacher un document" : undefined}
          onAction={canEdit ? () => setIsAddOpen(true) : undefined}
        />
      ) : (
        <>
          {topRequired.length > 0 && (
            <section
              id="documents-necessaires"
              aria-label="Documents nécessaires"
              className="glass rounded-[var(--lkv-radius-card)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-display text-xs font-bold text-lkv-primary flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-lkv-secondary shrink-0" aria-hidden="true" />
                  Documents nécessaires
                </h3>
                <span className="glass-pill text-[10px] font-semibold text-[var(--lkv-text-secondary)]">
                  {requiredDocs.length} requis pour ce voyage
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topRequired.map(doc => (
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
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3 -mx-1 text-xs font-semibold text-lkv-primary hover:bg-white/40 rounded-xl transition-colors"
                >
                  +{overflowRequiredCount} autres documents ↓
                </a>
              )}
            </section>
          )}

          {/* Suite de la liste : requis restants + documents secondaires */}
          <section id="tous-les-documents" aria-label="Tous les documents" className="space-y-3 scroll-mt-4">
            <h3 className="font-display text-xs font-bold text-lkv-primary px-1">
              Tous les documents ({trip.documents.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {remainingDocs.map(doc => (
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
      <GlassModal open={isAddOpen} onOpenChange={setIsAddOpen} title="Attacher un document sécurisé" variant="sheet">
        <div className="pb-2">
          {errorMsg && (
            <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs mb-4">
              {errorMsg}
            </div>
          )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Nom du document
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="ex: Passeport biométrique, Billet Vol AR Lima"
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Catégorie
                  </label>
                  <select
                    name="category"
                    defaultValue="passport"
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  >
                    <option value="passport">Passeport / ID</option>
                    <option value="insurance">Assurance</option>
                    <option value="booking">Réservation</option>
                    <option value="ticket">Billet transport</option>
                    <option value="medical">Médical / Vaccin</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-lkv-primary mb-1">
                    Date d&apos;expiration (optionnelle)
                  </label>
                  <input
                    type="date"
                    name="expiresAt"
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Lien sécurisé (URL Cloud / Drive)
                </label>
                <input
                  type="url"
                  name="fileUrl"
                  required
                  placeholder="https://..."
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Notes ou consignes particulières
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="ex: N° d'assuré 12345, contact d'urgence 24/7"
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <GlassCapsuleBtn
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                >
                  Annuler
                </GlassCapsuleBtn>
                <GlassCapsuleBtn
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? 'Enregistrement...' : 'Attacher le document'}
                </GlassCapsuleBtn>
              </div>
            </form>
        </div>
      </GlassModal>

      {/* Modale de confirmation de suppression */}
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

interface DocCardProps {
  doc: TripDocument;
  required?: boolean;
  canEdit: boolean;
  isPending: boolean;
  onDelete: (docId: string) => void;
}

function DocCard({ doc, required = false, canEdit, isPending, onDelete }: DocCardProps) {
  const expiryCheck = checkDocumentExpiry(doc);

  return (
    <div className="glass p-4 rounded-[var(--lkv-radius-lg)] border border-white/60 flex flex-col justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lkv-primary/10 text-lkv-primary flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-lkv-primary leading-snug">{doc.title}</div>
              <div className="text-[11px] text-lkv-secondary">
                {CATEGORY_LABELS[doc.category] || doc.category}
              </div>
            </div>
          </div>

          {/* Badge d'échéance (expiré / avertissement en premier) */}
          {expiryCheck.status !== 'none' && (
            <span
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 shrink-0 ${
                expiryCheck.status === 'expired'
                  ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)] border-[var(--lkv-danger)]/20'
                  : expiryCheck.status === 'warning'
                  ? 'bg-[var(--lkv-warning)]/10 text-[var(--lkv-warning)] border-[var(--lkv-warning)]/20'
                  : 'bg-[var(--lkv-success)]/10 text-[var(--lkv-success)] border-[var(--lkv-success)]/20'
              }`}
            >
              {expiryCheck.status === 'expired' && <AlertTriangle size={10} />}
              {expiryCheck.status === 'warning' && <Clock size={10} />}
              {expiryCheck.status === 'valid' && <CheckCircle2 size={10} />}
              <span>{expiryCheck.label}</span>
            </span>
          )}
        </div>

        {required && (
          <span className="glass-pill text-[10px] font-bold text-lkv-primary inline-flex items-center gap-1">
            <ShieldCheck size={11} aria-hidden="true" />
            requis
          </span>
        )}

        {doc.notes && (
          <p className="text-xs text-[var(--lkv-text-muted)] glass-sub-card p-2 rounded-[var(--lkv-radius-md)] border border-white/60 shadow-2xs">
            {doc.notes}
          </p>
        )}
      </div>

      {/* Barre d'action document */}
      <div className="flex items-center justify-between pt-3 border-t border-white/40 text-xs">
        <a
          href={doc.file_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-lkv-primary hover:text-lkv-secondary transition-colors py-1"
        >
          <span>Ouvrir le document</span>
          <ExternalLink size={13} />
        </a>

        {canEdit && (
          <button
            onClick={() => onDelete(doc.id)}
            disabled={isPending}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
            title="Supprimer ce document"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
