'use client';

import React, { useState, useTransition } from 'react';
import {
  Copy,
  Check,
  Globe,
  Lock,
  EyeOff,
  Download,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { formatTripShareUrl } from '../engine/exportEngine';
import { tripSectionHref } from '../registry/tripSectionRegistry';
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
  const [visError, setVisError] = useState<string | null>(null);
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
    setVisError(null);
    startTransition(async () => {
      const res = await updateTripVisibilityAction(trip.id, newVis, trip.slug);
      if (!res.success) {
        setVisError(res.error || 'Impossible de modifier la visibilité');
        setVisibility(trip.visibility);
      }
    });
  };

  const isOwner = trip.permissions.canInvite;

  return (
    <GlassModal open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }} title="Partager &amp; Exporter l'Expédition" variant="sheet">
      <div className="space-y-5 pb-2">

        {/* 1. Visibilité du voyage */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-lkv-primary">
            Niveau de confidentialité du voyage
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!isOwner || isPending}
              onClick={() => handleVisibilityChange('private')}
              className={`p-3 rounded-xl border text-left transition-all ${
                visibility === 'private'
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Lock size={14} />
                <span>Privé</span>
              </div>
              <div className={`text-[10px] mt-1 ${visibility === 'private' ? 'text-white/80' : 'text-[var(--lkv-text-muted)]'}`}>
                Membres seuls
              </div>
            </button>

            <button
              type="button"
              disabled={!isOwner || isPending}
              onClick={() => handleVisibilityChange('unlisted')}
              className={`p-3 rounded-xl border text-left transition-all ${
                visibility === 'unlisted'
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <EyeOff size={14} />
                <span>Lien secret</span>
              </div>
              <div className={`text-[10px] mt-1 ${visibility === 'unlisted' ? 'text-white/80' : 'text-[var(--lkv-text-muted)]'}`}>
                Ceux avec le lien
              </div>
            </button>

            <button
              type="button"
              disabled={!isOwner || isPending}
              onClick={() => handleVisibilityChange('public')}
              className={`p-3 rounded-xl border text-left transition-all ${
                visibility === 'public'
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Globe size={14} />
                <span>Public</span>
              </div>
              <div className={`text-[10px] mt-1 ${visibility === 'public' ? 'text-white/80' : 'text-[var(--lkv-text-muted)]'}`}>
                Visible de tous
              </div>
            </button>
          </div>
        </div>
        {visError && (
          <div className="p-3 rounded-xl glass tone-danger text-xs text-[var(--lkv-danger)]">
            {visError}
          </div>
        )}

        {/* 2. Lien de partage */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-lkv-primary">
            Lien d&apos;accès direct
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="glass-input w-full px-3 py-2 text-xs font-mono text-[var(--lkv-text-primary)] select-all"
            />
            <GlassCapsuleBtn
              onClick={handleCopy}
              variant="primary"
              size="sm"
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              className="shrink-0"
            >
              {copied ? 'Copié !' : 'Copier'}
            </GlassCapsuleBtn>
          </div>
        </div>

        {/* Règle RGPD Documents */}
        <div className="p-3 rounded-xl glass-sub-card border border-white/60 text-[11px] text-[var(--lkv-text-muted)] flex items-start gap-2 shadow-2xs">
          <ShieldAlert size={16} className="text-lkv-secondary shrink-0 mt-0.5" />
          <span>
            <strong>Sécurité des documents :</strong> Les pièces sensibles (passeports, attestations) restent protégées et ne sont jamais partagées via ce lien.
          </span>
        </div>

        {/* 3. Exports disponibles */}
        <div className="space-y-2 pt-2 border-t border-white/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={`/api/voyages/${trip.slug}/gpx?token=${trip.share_token}`}
              download={`${trip.slug}.gpx`}
              className="flex items-center justify-center gap-2 p-3 rounded-full glass-capsule-btn text-xs font-semibold text-lkv-primary min-h-[44px]"
            >
              <Download size={15} className="text-lkv-secondary" />
              <span>Trace GPX 1.1</span>
            </a>

            <a
              href={tripSectionHref(trip.slug, 'export')}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-capsule-btn w-full flex items-center gap-1.5 min-h-[44px]"
            >
              <Printer size={15} className="text-lkv-secondary" />
              <span>Feuille de Route / PDF</span>
            </a>
          </div>
        </div>
      </div>
    </GlassModal>
  );
}
