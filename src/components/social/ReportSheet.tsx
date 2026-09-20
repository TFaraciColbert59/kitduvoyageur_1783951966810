'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Sheet } from '@/components/ui';
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#F5F2E8] hover:bg-[#E8E4D8] text-[#17402C] rounded-2xl text-xs font-bold transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!selectedReason || submitting}
              onClick={handleSubmit}
              className="flex-1 py-3 bg-[#17402C] hover:bg-[#122e20] text-white rounded-2xl text-xs font-bold transition-colors disabled:opacity-50  flex items-center justify-center gap-2"
            >
              {submitting ? 'Envoi...' : 'Envoyer le signalement'}
            </button>
          </div>
        )
      }
    >
      {submitted ? (
        <div className="py-10 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center">
            <Icon name="CheckCircleIcon" size={28} />
          </div>
          <h4 className="font-bold text-[#17402C] text-base">Signalement envoyé</h4>
          <p className="text-xs text-[#5C6B5E] max-w-xs">
            Merci de nous aider à préserver la sécurité et la bienveillance de la communauté.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#5C6B5E]">
            Pourquoi signalez-vous ce contenu ? Votre signalement reste anonyme.
          </p>

          {/* Reasons list */}
          <div className="flex flex-col gap-2 my-2">
            {REPORT_REASONS.map(reason => {
              const isSelected = selectedReason === reason.id;
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedReason(reason.id);
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-semibold transition-all text-left ${
                    isSelected
                      ? 'border-[#17402C] bg-[#17402C]/5 text-[#17402C]'
                      : 'border-[#17402C]/10 bg-[#F5F2E8]/40 text-[#17402C] hover:bg-[#F5F2E8]'
                  }`}
                >
                  <span>{reason.label}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-[#17402C] bg-[#17402C]' : 'border-gray-300'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedReason && (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Précisions supplémentaires (facultatif)..."
              className="w-full h-20 bg-[#F5F2E8] border-none rounded-2xl p-3 text-xs text-[#17402C] focus:ring-2 focus:ring-[#17402C] resize-none"
            />
          )}
        </>
      )}
    </Sheet>
  );
}
