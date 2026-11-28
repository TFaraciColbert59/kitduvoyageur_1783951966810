'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Flag,
  Footprints,
  Loader2,
  MapPin,
  ShieldAlert,
  Snowflake,
  WifiOff,
  X,
} from 'lucide-react';
import { CARNET_SPRING } from '@/components/carnet/v2/CarnetDrawerMotion';

export type SafetyReportCategoryId =
  | 'trail_blocked'
  | 'snow'
  | 'water_dry'
  | 'mud'
  | 'hazard'
  | 'clear';

export interface SafetyReportOfflinePayload {
  category: string;
  note: string;
  lat: number;
  lng: number;
}

export interface SafetyReportSubmittedPayload {
  category: string;
  label: string;
  note: string;
  lat: number;
  lng: number;
}

export interface SafetyReportModalProps {
  open: boolean;
  coords: [number, number];
  placeName?: string | null;
  onClose: () => void;
  onSubmitted?: (report?: SafetyReportSubmittedPayload) => void;
  onSubmitOffline?: (payload: SafetyReportOfflinePayload) => void;
}

interface ReportCategoryOption {
  id: SafetyReportCategoryId;
  label: string;
  apiCategory: 'obstacle' | 'snow_ice' | 'water' | 'mud' | 'rockfall' | 'marking';
  severity: 'info' | 'warning' | 'critical';
  passability: 'passable' | 'difficult' | 'impassable';
  tone: 'amber' | 'red' | 'blue' | 'green';
  icon: React.ReactNode;
}

const REPORT_CATEGORIES: readonly ReportCategoryOption[] = [
  {
    id: 'trail_blocked',
    label: 'Sentier coupé / Obstacle',
    apiCategory: 'obstacle',
    severity: 'warning',
    passability: 'impassable',
    tone: 'amber',
    icon: <AlertTriangle size={15} aria-hidden="true" />,
  },
  {
    id: 'snow',
    label: 'Neige / Verglas',
    apiCategory: 'snow_ice',
    severity: 'warning',
    passability: 'difficult',
    tone: 'blue',
    icon: <Snowflake size={15} aria-hidden="true" />,
  },
  {
    id: 'water_dry',
    label: "Point d'eau à sec",
    apiCategory: 'water',
    severity: 'warning',
    passability: 'passable',
    tone: 'blue',
    icon: <Droplets size={15} aria-hidden="true" />,
  },
  {
    id: 'mud',
    label: 'Boue / Glissant',
    apiCategory: 'mud',
    severity: 'info',
    passability: 'difficult',
    tone: 'amber',
    icon: <Footprints size={15} aria-hidden="true" />,
  },
  {
    id: 'hazard',
    label: 'Danger / Éboulement',
    apiCategory: 'rockfall',
    severity: 'critical',
    passability: 'impassable',
    tone: 'red',
    icon: <ShieldAlert size={15} aria-hidden="true" />,
  },
  {
    id: 'clear',
    label: 'Accès dégagé',
    apiCategory: 'marking',
    severity: 'info',
    passability: 'passable',
    tone: 'green',
    icon: <CheckCircle2 size={15} aria-hidden="true" />,
  },
];

const TONE_ACCENTS: Record<
  ReportCategoryOption['tone'],
  { bg: string; border: string; color: string }
> = {
  amber: {
    bg: 'rgba(180, 83, 9, 0.12)',
    border: 'rgba(180, 83, 9, 0.42)',
    color: '#92400E',
  },
  red: {
    bg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.44)',
    color: '#991B1B',
  },
  blue: {
    bg: 'rgba(2, 132, 199, 0.12)',
    border: 'rgba(2, 132, 199, 0.4)',
    color: '#0369A1',
  },
  green: {
    bg: 'rgba(21, 128, 61, 0.12)',
    border: 'rgba(21, 128, 61, 0.42)',
    color: '#166534',
  },
};

type SubmitStatus = 'idle' | 'submitting' | 'sent' | 'offline_queued' | 'auth' | 'error';

export function SafetyReportModal({
  open,
  coords,
  placeName = null,
  onClose,
  onSubmitted,
  onSubmitOffline,
}: SafetyReportModalProps) {
  const [selectedId, setSelectedId] = useState<SafetyReportCategoryId>('trail_blocked');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setErrorDetail(null);
    setNote('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const [lng, lat] = coords;
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const selectedOption =
    REPORT_CATEGORIES.find((item) => item.id === selectedId) ?? REPORT_CATEGORIES[0];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasValidCoords || status === 'submitting') return;

    const trimmedNote = note.trim();
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

    if (isOffline) {
      if (onSubmitOffline) {
        onSubmitOffline({
          category: selectedOption.id,
          note: trimmedNote,
          lat,
          lng,
        });
        setStatus('offline_queued');
        onSubmitted?.({
          category: selectedOption.id,
          label: selectedOption.label,
          note: trimmedNote,
          lat,
          lng,
        });
      } else {
        setErrorDetail('Connexion indisponible. Réessayez dès le retour du réseau.');
        setStatus('error');
      }
      return;
    }

    setStatus('submitting');
    setErrorDetail(null);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setStatus('auth');
        return;
      }

      const prefix = placeName?.trim()
        ? `${placeName.trim()} · ${selectedOption.label}`
        : selectedOption.label;
      const description = trimmedNote ? `${prefix} — ${trimmedNote}` : prefix;

      const res = await fetch('/api/explorer/v2/reports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat,
          lng,
          category: selectedOption.apiCategory,
          severity: selectedOption.severity,
          passability: selectedOption.passability,
          description: description.slice(0, 950),
        }),
      });

      if (res.status === 401) {
        setStatus('auth');
        return;
      }

      if (!res.ok) {
        setErrorDetail('Impossible d’enregistrer le signalement pour le moment.');
        setStatus('error');
        return;
      }

      setStatus('sent');
      onSubmitted?.({
        category: selectedOption.id,
        label: selectedOption.label,
        note: trimmedNote,
        lat,
        lng,
      });
    } catch {
      if (onSubmitOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
        onSubmitOffline({
          category: selectedOption.id,
          note: trimmedNote,
          lat,
          lng,
        });
        setStatus('offline_queued');
        onSubmitted?.({
          category: selectedOption.id,
          label: selectedOption.label,
          note: trimmedNote,
          lat,
          lng,
        });
        return;
      }
      setErrorDetail('Erreur réseau lors de l’envoi du signalement.');
      setStatus('error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Signaler une condition terrain"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        background: 'rgba(15, 29, 24, 0.34)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
        display: 'grid',
        placeItems: 'center',
        padding: 14,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={CARNET_SPRING}
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 24,
          background: 'rgba(251, 250, 246, 0.92)',
          backdropFilter: 'blur(26px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(26px) saturate(1.4)',
          border: '0.5px solid rgba(255, 255, 255, 0.78)',
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 24px 54px rgba(17, 36, 28, 0.24)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'rgba(180, 83, 9, 0.13)',
                color: '#B45309',
                display: 'inline-grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              <Flag size={17} aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#172B24' }}>
                Signaler une condition terrain
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#56665D',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <MapPin size={11} aria-hidden="true" />
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {placeName?.trim()
                    ? `${placeName.trim()} · ${hasValidCoords ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Position'}`
                    : hasValidCoords
                      ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                      : 'Coordonnées indisponibles'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le formulaire de signalement"
            style={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.16)',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#17402C',
              display: 'inline-grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Success / Offline queued state */}
        {status === 'sent' || status === 'offline_queued' ? (
          <div
            style={{
              padding: '20px 16px',
              borderRadius: 18,
              background:
                status === 'sent'
                  ? 'rgba(21, 128, 61, 0.09)'
                  : 'rgba(180, 83, 9, 0.09)',
              border:
                status === 'sent'
                  ? '0.5px solid rgba(21, 128, 61, 0.24)'
                  : '0.5px solid rgba(180, 83, 9, 0.24)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              textAlign: 'center',
            }}
          >
            {status === 'sent' ? (
              <CheckCircle2 size={28} color="#15803D" aria-hidden="true" />
            ) : (
              <WifiOff size={26} color="#B45309" aria-hidden="true" />
            )}
            <strong style={{ fontSize: 14, fontWeight: 800, color: '#172B24' }}>
              {status === 'sent'
                ? 'Signalement publié sur la carte'
                : 'Signalement sauvegardé hors-ligne'}
            </strong>
            <span style={{ fontSize: 12, color: '#56665D', lineHeight: 1.45 }}>
              {status === 'sent'
                ? 'Merci ! Les autres randonneurs du secteur verront immédiatement cette alerte.'
                : 'Il sera transmis automatiquement dès que votre appareil retrouvera du réseau.'}
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: 6,
                height: 36,
                padding: '0 18px',
                borderRadius: 999,
                border: 0,
                background: 'linear-gradient(180deg, #1f543a, #17402c)',
                color: '#FBFAF6',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Category grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#56665D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Type de condition
              </span>
              <div
                role="radiogroup"
                aria-label="Catégorie du signalement"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 7,
                }}
              >
                {REPORT_CATEGORIES.map((option) => {
                  const active = option.id === selectedId;
                  const accent = TONE_ACCENTS[option.tone];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedId(option.id)}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 14,
                        border: active
                          ? `1px solid ${accent.border}`
                          : '0.5px solid rgba(23, 64, 44, 0.14)',
                        background: active ? accent.bg : 'rgba(255, 255, 255, 0.82)',
                        color: active ? accent.color : '#172B24',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: active ? 800 : 600,
                        cursor: 'pointer',
                        lineHeight: 1.25,
                        boxShadow: active
                          ? 'none'
                          : 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                      }}
                    >
                      <span style={{ flex: 'none', color: accent.color }}>{option.icon}</span>
                      <span style={{ minWidth: 0 }}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional note */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label
                htmlFor="xp-safety-report-note"
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#56665D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Précisions utiles (optionnel)
              </label>
              <textarea
                id="xp-safety-report-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex. arbre tombé après la passerelle, névé raide en versant nord, source tarie…"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  borderRadius: 14,
                  border: '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: 'rgba(255, 255, 255, 0.88)',
                  padding: '9px 11px',
                  fontSize: 12.5,
                  color: '#172B24',
                  lineHeight: 1.4,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Guest / Auth notice */}
            {status === 'auth' ? (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: 'rgba(23, 64, 44, 0.07)',
                  border: '0.5px solid rgba(23, 64, 44, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  color: '#172B24',
                  fontWeight: 600,
                }}
              >
                <span>Connectez-vous pour publier un signalement vérifié.</span>
                <Link
                  href="/connexion?next=/explorer"
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: '#17402C',
                    color: '#FBFAF6',
                    fontSize: 11.5,
                    fontWeight: 700,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Se connecter
                </Link>
              </div>
            ) : null}

            {/* Error banner */}
            {status === 'error' && errorDetail ? (
              <div
                role="alert"
                style={{
                  padding: '9px 11px',
                  borderRadius: 12,
                  background: 'rgba(220, 38, 38, 0.09)',
                  border: '0.5px solid rgba(220, 38, 38, 0.24)',
                  color: '#991B1B',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {errorDetail}
              </div>
            ) : null}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  color: '#17402C',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!hasValidCoords || status === 'submitting'}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 999,
                  border: 0,
                  background: 'linear-gradient(180deg, #1f543a, #17402c)',
                  color: '#FBFAF6',
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: !hasValidCoords || status === 'submitting' ? 'not-allowed' : 'pointer',
                  opacity: !hasValidCoords || status === 'submitting' ? 0.65 : 1,
                  boxShadow: '0 4px 12px rgba(23, 64, 44, 0.24)',
                }}
              >
                {status === 'submitting' ? (
                  <Loader2 size={14} className="xp20-route-spin" aria-hidden="true" />
                ) : (
                  <Flag size={13} aria-hidden="true" />
                )}
                <span>{status === 'submitting' ? 'Envoi…' : 'Publier le signalement'}</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
