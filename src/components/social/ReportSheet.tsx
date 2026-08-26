'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
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

  if (!isOpen) return null;

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
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet Content */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative z-10 w-full max-w-lg glass rounded-t-3xl p-5 pb-8 flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2" />

          {submitted ? (
            <div className="py-10 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Icon name="CheckCircleIcon" size={28} />
              </div>
              <h4 className="font-bold text-[#17402C] text-base">Signalement envoyé</h4>
              <p className="text-xs text-[#5C6B5E] max-w-xs">
                Merci de nous aider à préserver la sécurité et la bienveillance de la communauté.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h3 className="font-display font-bold text-lg text-[#17402C]">
                  Signaler ce contenu
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#F5F2E8] flex items-center justify-center text-[#5C6B5E] hover:bg-[#E8E4D8] transition-colors"
                >
                  <Icon name="XMarkIcon" size={16} />
                </button>
              </div>

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

              <div className="flex items-center gap-3 pt-2">
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
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
