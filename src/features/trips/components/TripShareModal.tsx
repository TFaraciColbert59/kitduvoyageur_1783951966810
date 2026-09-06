'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  EyeOff,
  Download,
  Printer,
  X,
  ShieldAlert,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatTripShareUrl } from '../engine/exportEngine';
import { updateTripVisibilityAction } from '@/app/voyages/share-actions';
import type { TripFull, TripVisibility } from '../types/trip.types';

interface TripShareModalProps {
  trip: TripFull;
  isOpen: boolean;
  onClose: () => void;
}

export function TripShareModal({ trip, isOpen, onClose }: TripShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<TripVisibility>(trip.visibility);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lekitduvoyageur.fr';
  const shareUrl = formatTripShareUrl(trip.slug, trip.share_token, origin);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleVisibilityChange = (newVis: TripVisibility) => {
    setVisibility(newVis);
    startTransition(async () => {
      const res = await updateTripVisibilityAction(trip.id, newVis, trip.slug);
      if (!res.success) {
        alert(res.error || 'Impossible de modifier la visibilité');
        setVisibility(trip.visibility);
      }
    });
  };

  const isOwner = trip.permissions.canInvite;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <GlassCard
        tone="neutral"
        className="w-full max-w-lg p-6 rounded-[24px] bg-white border border-white/80 shadow-2xl space-y-5"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#17402C] flex items-center gap-2">
            <Share2 size={20} className="text-[#5B7F55]" />
            <span>Partager &amp; Exporter l&apos;Expédition</span>
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Visibilité du voyage */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#17402C]">
            Niveau de confidentialité du voyage
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!isOwner || isPending}
              onClick={() => handleVisibilityChange('private')}
              className={`p-3 rounded-xl border text-left transition-all ${
                visibility === 'private'
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#17402C]/30'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Lock size={14} />
                <span>Privé</span>
              </div>
              <div className={`text-[10px] mt-1 ${visibility === 'private' ? 'text-white/80' : 'text-gray-500'}`}>
                Membres seuls
              </div>
            </button>

            <button
              type="button"
              disabled={!isOwner || isPending}
              onClick={() => handleVisibilityChange('unlisted')}
              className={`p-3 rounded-xl border text-left transition-all ${
                visibility === 'unlisted'
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#17402C]/30'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <EyeOff size={14} />
                <span>Lien secret</span>
              </div>
              <div className={`text-[10px] mt-1 ${visibility === 'unlisted' ? 'text-white/80' : 'text-gray-500'}`}>
                Ceux avec le lien
              </div>
            </button>

            <button
              type="button"
              disabled={!isOwner || isPending}
              onClick={() => handleVisibilityChange('public')}
              className={`p-3 rounded-xl border text-left transition-all ${
                visibility === 'public'
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#17402C]/30'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Globe size={14} />
                <span>Public</span>
              </div>
              <div className={`text-[10px] mt-1 ${visibility === 'public' ? 'text-white/80' : 'text-gray-500'}`}>
                Visible de tous
              </div>
            </button>
          </div>
        </div>

        {/* 2. Lien de partage */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#17402C]">
            Lien d&apos;accès direct
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-200 bg-gray-50 text-gray-700 select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#17402C] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#123323] transition-colors shrink-0 shadow-sm"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Règle RGPD Documents */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 text-[11px] text-gray-600 flex items-start gap-2">
          <ShieldAlert size={16} className="text-[#5B7F55] shrink-0 mt-0.5" />
          <span>
            <strong>Sécurité des documents :</strong> Les pièces sensibles (passeports, attestations) restent protégées et ne sont jamais partagées via ce lien.
          </span>
        </div>

        {/* 3. Exports disponibles */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="text-xs font-semibold text-[#17402C]">Exports de terrain</div>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/api/voyages/${trip.slug}/gpx?token=${trip.share_token}`}
              download={`${trip.slug}.gpx`}
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-[#17402C] hover:bg-gray-50 transition-colors shadow-xs"
            >
              <Download size={15} className="text-[#5B7F55]" />
              <span>Trace GPX 1.1</span>
            </a>

            <Link
              href={`/voyages/${trip.slug}/export`}
              target="_blank"
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-[#17402C] hover:bg-gray-50 transition-colors shadow-xs"
            >
              <Printer size={15} className="text-[#5B7F55]" />
              <span>Feuille de Route / PDF</span>
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
