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
  X,
  FileCheck,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { checkDocumentExpiry } from '../engine/exportEngine';
import { addTripDocumentAction, deleteTripDocumentAction } from '@/app/voyages/document-actions';
import type { TripFull, TripDocumentCategory } from '../types/trip.types';

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

export function TripDocumentsView({ trip }: TripDocumentsViewProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = trip.permissions.canEdit;

  const handleDelete = (docId: string, title: string) => {
    if (confirm(`Supprimer le document "${title}" ?`)) {
      startTransition(async () => {
        const res = await deleteTripDocumentAction(trip.id, docId, trip.slug);
        if (!res.success) {
          alert(res.error || 'Impossible de supprimer ce document');
        }
      });
    }
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
        setIsAddOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-lkv-primary flex items-center gap-2">
            <FileText size={22} className="text-lkv-secondary" />
            <span>Papiers & Documents Sécurisés</span>
          </h3>
          <p className="text-xs text-lkv-secondary mt-1">
            Coffre-fort chiffré des réservations, passeports et attestations avec surveillance automatique des échéances.
          </p>
        </div>

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

      {/* Garantie RGPD */}
      <GlassCard tone="neutral" className="p-4 rounded-[20px] border border-white/60 text-xs text-[var(--lkv-text-muted)]">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-lkv-secondary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-lkv-primary">Protection RGPD & Chiffrement de vos documents</div>
            <p className="text-[11px] text-lkv-secondary leading-relaxed">
              Ces documents ne sont jamais exposés aux visiteurs anonymes ni sur les liens publics de partage. Seuls les organisateurs et éditeurs authentifiés peuvent les consulter.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Liste des documents */}
      {trip.documents.length === 0 ? (
        <GlassCard tone="neutral" className="p-8 rounded-[24px] text-center space-y-2 border border-white/60">
          <FileCheck size={32} className="text-lkv-secondary mx-auto" />
          <div className="text-sm font-semibold text-lkv-primary">Aucun document attaché</div>
          <p className="text-xs text-[var(--lkv-text-muted)] max-w-sm mx-auto">
            Attachez vos billets d&apos;avion, réservations de refuges, assurances et passeports pour les garder accessibles partout.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trip.documents.map(doc => {
            const expiryCheck = checkDocumentExpiry(doc);

            return (
              <GlassCard
                key={doc.id}
                tone="neutral"
                className="p-4 rounded-[20px] border border-white/60 flex flex-col justify-between gap-4 shadow-sm"
              >
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

                    {/* Badge d'échéance */}
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
                      onClick={() => handleDelete(doc.id, doc.title)}
                      disabled={isPending}
                      className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
                      title="Supprimer ce document"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Modal d'ajout de document */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <GlassCard
            tone="neutral"
            className="w-full max-w-md p-6 rounded-[24px] border border-white/80 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/40">
              <h4 className="text-base font-bold text-lkv-primary flex items-center gap-2">
                <FileText size={18} className="text-lkv-secondary" />
                <span>Attacher un document sécurisé</span>
              </h4>
              <button
                onClick={() => setIsAddOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl glass tone-danger text-[var(--lkv-danger)] text-xs">
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
                  placeholder="ex: Numéro d'assuré #12345, contact d'urgence 24/7"
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
          </GlassCard>
        </div>
      )}
    </div>
  );
}
