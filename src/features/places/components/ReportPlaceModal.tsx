'use client';

import React, { useState, useTransition } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import { X, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { reportPlaceAction } from '@/app/lieux/actions';
import type { PlaceReportReason } from '../types/place.types';

export interface ReportPlaceModalProps {
  placeId: string;
  placeName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportPlaceModal({
  placeId,
  placeName,
  isOpen,
  onClose,
}: ReportPlaceModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md">
        <GlassCard
          tone="neutral"
          blur="lg"
          className="border border-white/70 shadow-2xl rounded-[28px] overflow-hidden p-6 relative bg-white/95"
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-4 pr-6">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Sécurité & Éthique Outdoor
            </span>
            <h2 className="text-xl font-black text-stone-900 mt-1">
              Signaler un problème
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Lieu concerné : <strong className="text-stone-900">{placeName}</strong>
            </p>
          </div>

          {success ? (
            <div className="py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                Signalement bien reçu
              </h3>
              <p className="text-xs text-stone-600 mb-6 leading-relaxed">
                Notre équipe de modération et les référents parcs examineront ce lieu sous 24h pour adapter le floutage ou la sensibilité.
              </p>
              <LkvButton
                variant="primary"
                className="w-full min-h-[44px]"
                onClick={handleClose}
              >
                Compris
              </LkvButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="report-reason"
                  className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Motif du signalement
                </label>
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as PlaceReportReason)}
                  className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                >
                  <option value="environmental_damage">Dégradation environnementale / déchets</option>
                  <option value="overcrowding">Surfréquentation menaçant le site</option>
                  <option value="safety_hazard">Danger physique (éboulement, crevasse, accès risqué)</option>
                  <option value="inaccurate_info">Informations erronées (source tarie, refuge fermé)</option>
                  <option value="private_property">Propriété privée / interdiction de bivouac</option>
                  <option value="other">Autre motif</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-details"
                  className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1"
                >
                  Précisions constatées sur le terrain
                </label>
                <textarea
                  id="report-details"
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Décrivez précisément les risques ou dégradations constatés..."
                  className="w-full p-3 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <LkvButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1 min-h-[44px]"
                  onClick={handleClose}
                >
                  Annuler
                </LkvButton>
                <LkvButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex-1 min-h-[44px]"
                  disabled={isPending}
                >
                  {isPending ? 'Envoi...' : 'Transmettre'}
                </LkvButton>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
