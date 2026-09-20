'use client';

import React, { useState, useEffect } from 'react';
import type { HumanParticipant } from '../../types/preparation.types';
import { Badge, Button, Card, Modal } from '@/components/ui';

interface GlassBreakModalProps {
  participant: HumanParticipant | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (id: string) => void;
  onLock: (id: string) => void;
}

/**
 * GlassBreakModal — accès d'urgence aux données médicales privées.
 * Overlay spécialisé : consomme les primitives/tokens canoniques, conserve le
 * verrouillage automatique et la divulgation explicite (Glass Break).
 */
export const GlassBreakModal: React.FC<GlassBreakModalProps> = ({
  participant,
  isOpen,
  onClose,
  onUnlock,
  onLock,
}) => {
  const [timeLeft, setTimeLeft] = useState(60);

  const isUnlocked = participant?.isUnlocked ?? false;
  const participantId = participant?.id;

  // Auto-lock timer when unlocked
  useEffect(() => {
    if (!isOpen || !participantId) return;

    if (isUnlocked) {
      setTimeLeft(60);
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onLock(participantId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, isUnlocked, participantId, onLock]);

  if (!isOpen || !participant) return null;

  const { publicData, privateData } = participant;

  const handleClose = () => {
    onLock(participant.id);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title={publicData.firstName}
      size="md"
    >
      <div className="space-y-[var(--space-5)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)] text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">
            {publicData.firstName[0]}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
            FICHE ÉQUIPIER
          </span>
        </div>

        <div className="grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)]">
          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
              Poids du Sac
            </span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {publicData.packWeightKg} kg
            </span>
          </Card>
          <Card variant="compact" className="flex flex-col">
            <span className="block font-mono text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
              Score Forme
            </span>
            <span className="font-mono text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]">
              {publicData.fitnessScore} / 100
            </span>
          </Card>
        </div>

        {!isUnlocked ? (
          <Card
            tone="danger"
            className="flex flex-col items-center gap-[var(--space-3)] text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--lkv-danger-bg)] text-[length:var(--lkv-text-title-sm)]">
              🔒
            </div>
            <div>
              <h4 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                Données Médicales & ICE Verrouillées
              </h4>
              <p className="mx-auto mt-1 max-w-xs text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--lkv-text-muted)]">
                Conformément au protocole de sécurité LKDV, les données médicales ne sont pas
                envoyées au DOM public sans action explicite d&apos;urgence.
              </p>
            </div>

            <Button
              variant="destructive"
              fullWidth
              onClick={() => onUnlock(participant.id)}
            >
              ⚡ Déverrouiller l&apos;accès d&apos;urgence (Glass Break)
            </Button>
          </Card>
        ) : (
          <div className="space-y-[var(--space-4)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-warning)]/40 bg-[color:var(--lkv-warning-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-warning-dark)]">
              <span className="font-semibold">⚠️ Mode Glass Break Actif</span>
              <span className="font-mono font-bold">Verrouillage auto : {timeLeft}s</span>
            </div>

            <div className="space-y-[var(--space-3)]">
              <Card variant="compact" className="flex flex-col">
                <span className="block font-mono text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
                  Groupe Sanguin
                </span>
                <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
                  {privateData.bloodType}
                </span>
              </Card>

              <Card variant="compact">
                <span className="block font-mono text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
                  Allergies & Intolérances
                </span>
                <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)]">
                  {privateData.allergies.length > 0 ? (
                    privateData.allergies.map((allergy) => (
                      <Badge key={allergy} tone="danger">
                        {allergy}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                      Aucune allergie connue
                    </span>
                  )}
                </div>
              </Card>

              <Card variant="compact">
                <span className="block font-mono text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
                  Contact d&apos;Urgence (ICE)
                </span>
                <div className="mt-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)]">
                  <div>
                    <span className="block text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                      {privateData.iceContact.name} ({privateData.iceContact.relationship})
                    </span>
                    <span className="font-mono text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                      {privateData.iceContact.phone}
                    </span>
                  </div>

                  <a
                    href={`tel:${privateData.iceContact.phone.replace(/\s+/g, '')}`}
                    className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-1)] rounded-full bg-[color:var(--lkv-action)] px-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-on-action)] transition-colors hover:bg-[color:var(--lkv-action-hover)]"
                  >
                    📞 Appeler
                  </a>
                </div>
              </Card>

              {privateData.medications && privateData.medications.length > 0 && (
                <Card variant="compact">
                  <span className="block font-mono text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
                    Traitements / Médicaments
                  </span>
                  <ul className="mt-[var(--space-1)] list-inside list-disc space-y-0.5 text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
                    {privateData.medications.map((med) => (
                      <li key={med}>{med}</li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <Button variant="secondary" fullWidth onClick={() => onLock(participant.id)}>
              🔒 Re-verrouiller immédiatement
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
