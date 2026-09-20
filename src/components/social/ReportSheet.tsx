'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, ListItem, Sheet } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentType: 'post' | 'carnet' | 'group' | 'club' | 'comment';
  onSubmitReport: (reason: string, details?: string) => Promise<void>;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam ou contenu indésirable', icon: 'ArchiveBoxXMarkIcon' },
  { id: 'harassment', label: 'Harcèlement ou intimidation', icon: 'ExclamationTriangleIcon' },
  { id: 'inappropriate', label: 'Contenu inapproprié ou offensant', icon: 'NoSymbolIcon' },
  { id: 'misinformation', label: 'Fausse information sur un itinéraire', icon: 'QuestionMarkCircleIcon' },
  { id: 'other', label: 'Autre motif', icon: 'EllipsisHorizontalIcon' },
];

export default function ReportSheet({
  isOpen,
  onClose,
  contentId,
  contentType,
  onSubmitReport,
}: ReportSheetProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    triggerHaptic('selection');
    setSubmitting(true);
    try {
      await onSubmitReport(selectedReason, details);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedReason(null);
        setDetails('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error reporting content:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={submitted ? 'Signalement envoyé' : 'Signaler ce contenu'}
      dragToDismiss
      footer={
        submitted ? undefined : (
          <div className="flex items-center gap-[var(--space-3)]">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={submitting}
              disabled={!selectedReason || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Envoi...' : 'Envoyer le signalement'}
            </Button>
          </div>
        )
      }
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-10)] text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-primary)]">
            <Icon name="CheckCircleIcon" size={28} />
          </div>
          <h4 className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
            Signalement envoyé
          </h4>
          <p className="max-w-xs text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            Merci de nous aider à préserver la sécurité et la bienveillance de la communauté.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
            Pourquoi signalez-vous ce contenu ? Votre signalement reste anonyme.
          </p>

          {/* Reasons list */}
          <Card className="my-[var(--space-2)] overflow-hidden p-0">
            {REPORT_REASONS.map(reason => {
              const isSelected = selectedReason === reason.id;
              return (
                <ListItem
                  key={reason.id}
                  as="div"
                  selected={isSelected}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedReason(reason.id);
                  }}
                  leading={<Icon name={reason.icon} size={18} className="text-[color:var(--lkv-text-secondary)]" />}
                  title={reason.label}
                  trailing={
                    <span
                      className={`flex size-4 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-[color:var(--lkv-action)] bg-[color:var(--lkv-action)]'
                          : 'border-[color:var(--lkv-border-strong)]'
                      }`}
                    >
                      {isSelected && <span className="size-1.5 rounded-full bg-[color:var(--lkv-on-action)]" />}
                    </span>
                  }
                />
              );
            })}
          </Card>

          {selectedReason && (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Précisions supplémentaires (facultatif)..."
              className="h-20 w-full resize-none rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]"
            />
          )}
        </>
      )}
    </Sheet>
  );
}
