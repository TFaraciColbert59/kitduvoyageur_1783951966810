'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { Button, Modal } from '@/components/ui';
import { reportPlaceAction } from '@/app/lieux/actions';
import type { PlaceReportReason } from '../types/place.types';

export interface ReportPlaceModalProps {
  placeId: string;
  placeName: string;
  isOpen: boolean;
  onClose: () => void;
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] text-[length:var(--lkv-text-caption-1)] font-medium text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export function ReportPlaceModal({ placeId, placeName, isOpen, onClose }: ReportPlaceModalProps) {
  const [reason, setReason] = useState<PlaceReportReason>('environmental_damage');
  const [details, setDetails] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim() || details.trim().length < 10) {
      setErrorMsg('Merci de décrire le problème en au moins 10 caractères.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await reportPlaceAction({
        place_id: placeId,
        reason,
        details: details.trim(),
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccess(true);
      }
    });
  };

  const handleClose = () => {
    setSuccess(false);
    setErrorMsg(null);
    setDetails('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title="Signaler un problème"
      description={`Lieu concerné : ${placeName}`}
      size="md"
      dismissible={!isPending}
    >
      <div className="space-y-[var(--space-4)]">
        <span className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-warning-dark)]">
          <Icon name="alert-triangle" className="h-4 w-4" />
          Sécurité & Éthique Outdoor
        </span>

        {success ? (
          <div className="py-[var(--space-4)] text-center">
            <div className="mx-auto mb-[var(--space-3)] flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-primary)]">
              <Icon name="check-circle2" className="h-6 w-6" />
            </div>
            <h3 className="mb-[var(--space-1)] text-[length:var(--lkv-text-body)] font-bold text-[color:var(--lkv-text-primary)]">
              Signalement bien reçu
            </h3>
            <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-caption-1)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
              Notre équipe de modération et les référents parcs examineront ce lieu sous 24h pour
              adapter le floutage ou la sensibilité.
            </p>
            <Button variant="primary" fullWidth onClick={handleClose}>
              Compris
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-[var(--space-4)]">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)]/40 bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-danger-dark)]">
                <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="report-reason"
                className="mb-1 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]"
              >
                Motif du signalement
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as PlaceReportReason)}
                className={`${FIELD_CLASS} h-11 px-3`}
              >
                <option value="environmental_damage">
                  Dégradation environnementale / déchets
                </option>
                <option value="overcrowding">Surfréquentation menaçant le site</option>
                <option value="safety_hazard">
                  Danger physique (éboulement, crevasse, accès risqué)
                </option>
                <option value="inaccurate_info">
                  Informations erronées (source tarie, refuge fermé)
                </option>
                <option value="private_property">
                  Propriété privée / interdiction de bivouac
                </option>
                <option value="other">Autre motif</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="report-details"
                className="mb-1 block text-[length:var(--lkv-text-caption-1)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]"
              >
                Précisions constatées sur le terrain
              </label>
              <textarea
                id="report-details"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Décrivez précisément les risques ou dégradations constatés..."
                className={`${FIELD_CLASS} p-3`}
                required
              />
            </div>

            <div className="flex gap-3 pt-[var(--space-2)]">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={handleClose}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={isPending}
              >
                {isPending ? 'Envoi...' : 'Transmettre'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
