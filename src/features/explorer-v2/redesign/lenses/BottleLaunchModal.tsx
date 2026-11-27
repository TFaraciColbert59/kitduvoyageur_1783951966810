'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calendar,
  Check,
  Compass,
  Lock,
  MapPin,
  MessageSquareText,
  Minus,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

export interface BottleLaunchModalProps {
  open: boolean;
  countryIso: string | null;
  countryName: string;
  /** Optional map coordinates `[lng, lat]` where the bottle is launched. */
  initialCoords?: [number, number] | null;
  /** Optional human-readable location label for the launch spot. */
  initialPlaceLabel?: string | null;
  onClose: () => void;
  onLaunched?: () => void;
}

const CREATION_TRUST_THRESHOLD = 65;
const MIN_TRUST_FLOOR = 50;
const MAX_ACTIVE_OWNED_GROUPS = 3;
const MAX_DESCRIPTION_LEN = 240;
const MIN_PLACES = 2;
const MAX_PLACES = 12;

type MixiteOption = 'all' | 'women_only' | 'men_only';

const MIXITE_CHOICES: ReadonlyArray<{ id: MixiteOption; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'women_only', label: 'Femmes' },
  { id: 'men_only', label: 'Hommes' },
];

const TRUST_PRESETS = [50, 60, 70, 80] as const;

function readSuspensionFlag(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;
  const rec = profile as Record<string, unknown>;
  return Boolean(rec.is_suspended_groups) || Boolean(rec.suspended_from_groups_at);
}

function normalizeCoords(coords: [number, number] | null | undefined): [number, number] | null {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return [lng, lat];
}

function isMissingGeoColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof rec.code === 'string' ? rec.code : '';
  if (code === '42703' || code === 'PGRST204') return true;
  const combined = `${String(rec.message ?? '')} ${String(rec.details ?? '')} ${String(rec.hint ?? '')}`.toLowerCase();
  return (
    combined.includes('place_label') ||
    combined.includes('schema cache') ||
    (combined.includes('column') && (combined.includes('lat') || combined.includes('lng')))
  );
}

export function BottleLaunchModal({
  open,
  countryIso,
  countryName,
  initialCoords = null,
  initialPlaceLabel = null,
  onClose,
  onLaunched,
}: BottleLaunchModalProps) {
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const cleanCountryName = countryName.trim() || 'Aventure';
  const cleanPlaceLabel = initialPlaceLabel?.trim() || null;
  const normalizedIso = (countryIso || 'fr').trim().toLowerCase() || 'fr';
  const validInitialCoords = useMemo(() => normalizeCoords(initialCoords), [initialCoords]);

  const defaultBottleName = cleanPlaceLabel
    ? `Aventure · ${cleanPlaceLabel}`
    : `Aventure · ${cleanCountryName}`;

  const [name, setName] = useState(defaultBottleName);
  const [description, setDescription] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [mixite, setMixite] = useState<MixiteOption>('all');
  const [minTrustScore, setMinTrustScore] = useState(MIN_TRUST_FLOOR);
  const [isAdult, setIsAdult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeOwnedCount, setActiveOwnedCount] = useState<number | null>(null);
  const [checkingQuota, setCheckingQuota] = useState(false);

  const userTrustScore =
    typeof profile?.trust_score === 'number' && Number.isFinite(profile.trust_score)
      ? Math.max(0, Math.min(100, Math.round(profile.trust_score)))
      : 50;
  const isSuspended = readSuspensionFlag(profile);
  const canLaunch = userTrustScore >= CREATION_TRUST_THRESHOLD && !isSuspended;

  useEffect(() => {
    if (!open) return;
    setName(defaultBottleName);
    setDescription('');
    setErrorMsg(null);
  }, [open, defaultBottleName]);

  // Pre-check active public bottle quota immediately when modal opens
  useEffect(() => {
    if (!open || !user || !canLaunch) {
      setActiveOwnedCount(null);
      setCheckingQuota(false);
      return;
    }

    let cancelled = false;
    setCheckingQuota(true);

    const checkQuota = async () => {
      try {
        const { count, error } = await supabase
          .from('travel_groups')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('visibility', 'public');

        if (!cancelled && !error && typeof count === 'number') {
          setActiveOwnedCount(count);
        }
      } catch {
        // Keep quota check resilient; handleSubmit still verifies server-side
      } finally {
        if (!cancelled) {
          setCheckingQuota(false);
        }
      }
    };

    void checkQuota();
    return () => {
      cancelled = true;
    };
  }, [open, user, canLaunch, supabase]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const quotaReached =
    activeOwnedCount !== null && activeOwnedCount >= MAX_ACTIVE_OWNED_GROUPS;
  const trustProgressPct = Math.min(
    100,
    Math.round((userTrustScore / CREATION_TRUST_THRESHOLD) * 100),
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !canLaunch || submitting || quotaReached) return;

    const trimmedName = name.trim();
    const trimmedDescription = description.trim().slice(0, MAX_DESCRIPTION_LEN);
    if (!trimmedName) {
      setErrorMsg('Indiquez un nom pour votre bouteille.');
      return;
    }
    if (departureDate && returnDate && returnDate < departureDate) {
      setErrorMsg('La date de retour doit être postérieure au départ.');
      return;
    }
    if (!isAdult) {
      setErrorMsg('Confirmez avoir 18 ans ou plus pour lancer une bouteille.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const { count: ownedCount, error: countError } = await supabase
        .from('travel_groups')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('visibility', 'public');

      if (countError) {
        throw countError;
      }

      if (typeof ownedCount === 'number') {
        setActiveOwnedCount(ownedCount);
      }

      if ((ownedCount ?? 0) >= MAX_ACTIVE_OWNED_GROUPS) {
        setErrorMsg(
          `Limite atteinte : ${ownedCount}/${MAX_ACTIVE_OWNED_GROUPS} bouteilles publiques actives.`,
        );
        return;
      }

      await supabase
        .from('user_profiles')
        .update({ age_confirmed_at: new Date().toISOString() })
        .eq('id', user.id);

      const clampedMaxMembers = Math.max(MIN_PLACES, Math.min(MAX_PLACES, maxMembers));
      const enforcedMinTrust = Math.max(MIN_TRUST_FLOOR, Math.min(100, minTrustScore));

      const baseInsertPayload = {
        name: trimmedName,
        description: trimmedDescription || null,
        owner_id: user.id,
        departure_date: departureDate || null,
        return_date: returnDate || null,
        max_members: clampedMaxMembers,
        theme: '🌍',
        destination: cleanPlaceLabel || cleanCountryName,
        country_iso: normalizedIso,
        visibility: 'public',
        min_trust_score: enforcedMinTrust,
        mixite,
      };

      const hasGeoExtras = validInitialCoords !== null || Boolean(cleanPlaceLabel);
      const geoInsertPayload = hasGeoExtras
        ? {
            ...baseInsertPayload,
            ...(validInitialCoords
              ? { lat: validInitialCoords[1], lng: validInitialCoords[0] }
              : {}),
            ...(cleanPlaceLabel ? { place_label: cleanPlaceLabel } : {}),
          }
        : baseInsertPayload;

      let { error: insertError } = await supabase
        .from('travel_groups')
        .insert(geoInsertPayload);

      // Automatic graceful retry if remote Postgres schema hasn't applied lat/lng/place_label yet
      if (insertError && hasGeoExtras && isMissingGeoColumnError(insertError)) {
        const retryRes = await supabase
          .from('travel_groups')
          .insert(baseInsertPayload);
        insertError = retryRes.error;
      }

      if (insertError) {
        throw insertError;
      }

      setDescription('');
      setDepartureDate('');
      setReturnDate('');
      setMaxMembers(6);
      setMixite('all');
      setMinTrustScore(MIN_TRUST_FLOOR);
      setIsAdult(false);
      onLaunched?.();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Impossible de lancer cette bouteille pour le moment.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lancer une bouteille à la mer"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1450,
        isolation: 'isolate',
        background: 'rgba(14, 24, 19, 0.44)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 10,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: 28,
          background: 'rgba(251, 250, 246, 0.96)',
          backdropFilter: 'blur(24px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.15)',
          border: '0.5px solid rgba(23, 64, 44, 0.14)',
          boxShadow: '0 24px 60px rgba(11, 31, 23, 0.30)',
          padding: '10px 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          color: '#172B24',
        }}
      >
        {/* Top drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: 'rgba(23, 64, 44, 0.18)',
            }}
          />
        </div>

        {/* Header with circular X close pill (zero text) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(23, 64, 44, 0.10)',
                color: '#17402C',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
              }}
            >
              <Send size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: '#172B24',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                }}
              >
                Bouteille à la mer
              </strong>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#56665D',
                }}
              >
                {cleanPlaceLabel ? (
                  <>
                    <MapPin size={11} aria-hidden="true" />
                    {cleanPlaceLabel} · {normalizedIso.toUpperCase()}
                  </>
                ) : (
                  <>
                    <Compass size={11} aria-hidden="true" />
                    {cleanCountryName} · {normalizedIso.toUpperCase()}
                  </>
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 0,
              background: 'rgba(23, 64, 44, 0.08)',
              color: '#172B24',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flex: 'none',
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Gate 1: Unauthenticated */}
        {!user ? (
          <div
            style={{
              borderRadius: 20,
              background: '#fff',
              border: '0.5px solid rgba(23, 64, 44, 0.10)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(23, 64, 44, 0.08)',
                color: '#17402C',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Lock size={18} />
            </span>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#172B24' }}>
              Connectez-vous pour lancer une bouteille
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#56665D', lineHeight: 1.4 }}>
              Trust Score ≥ {CREATION_TRUST_THRESHOLD} requis · max {MAX_ACTIVE_OWNED_GROUPS}{' '}
              expéditions actives.
            </p>
            <Link
              href="/connexion?next=/explorer"
              onClick={onClose}
              style={{
                marginTop: 4,
                height: 42,
                padding: '0 22px',
                borderRadius: 999,
                background: '#17402C',
                color: '#FBFAF6',
                fontSize: 13.5,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(23, 64, 44, 0.20)',
              }}
            >
              Se connecter
            </Link>
          </div>
        ) : !canLaunch ? (
          /* Gate 2: Suspended or Trust Score < 65 */
          <div
            style={{
              borderRadius: 20,
              background: '#fff',
              border: '0.5px solid rgba(23, 64, 44, 0.12)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(23, 64, 44, 0.09)',
                  color: '#17402C',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <ShieldAlert size={18} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#172B24' }}>
                  {isSuspended ? 'Création temporairement restreinte' : 'Trust Score insuffisant'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#56665D',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {userTrustScore} / {CREATION_TRUST_THRESHOLD} requis
                </div>
              </div>
            </div>

            {/* Honest Trust Score progress bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                role="progressbar"
                aria-valuenow={userTrustScore}
                aria-valuemin={0}
                aria-valuemax={CREATION_TRUST_THRESHOLD}
                aria-label="Progression du Trust Score"
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(23, 64, 44, 0.10)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${trustProgressPct}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #96BA8E, #17402C)',
                    transition: 'width 240ms ease',
                  }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#56665D', lineHeight: 1.45 }}>
                {isSuspended
                  ? 'Votre compte fait actuellement l’objet d’une restriction sur les groupes publics.'
                  : `Un Trust Score d’au moins ${CREATION_TRUST_THRESHOLD}/100 est requis pour ouvrir une bouteille publique (plancher ${MIN_TRUST_FLOOR} pour rejoindre). Complétez votre profil et participez à des sorties pour progresser.`}
              </p>
            </div>
          </div>
        ) : (
          /* Gate 3: Eligible — Grouped iOS Card Form */
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {/* Pre-checked active quota banner (3/3) */}
            {quotaReached ? (
              <div
                role="alert"
                style={{
                  borderRadius: 20,
                  background: 'rgba(166, 38, 38, 0.06)',
                  border: '1px solid rgba(166, 38, 38, 0.22)',
                  padding: '13px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'rgba(166, 38, 38, 0.12)',
                      color: '#8C1D1D',
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    <ShieldAlert size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#8C1D1D',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Limite atteinte : {activeOwnedCount}/{MAX_ACTIVE_OWNED_GROUPS} bouteilles actives
                    </div>
                    <p
                      style={{
                        margin: '3px 0 0',
                        fontSize: 12,
                        color: '#56665D',
                        lineHeight: 1.4,
                      }}
                    >
                      Archivez ou fermez une bouteille existante pour en lancer une nouvelle sur la carte.
                    </p>
                  </div>
                </div>
                <Link
                  href="/hub/groupe"
                  onClick={onClose}
                  style={{
                    height: 38,
                    padding: '0 16px',
                    borderRadius: 999,
                    background: '#17402C',
                    color: '#FBFAF6',
                    fontSize: 12.5,
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                    boxShadow: '0 6px 16px rgba(23, 64, 44, 0.18)',
                  }}
                >
                  <span>Gérer mes bouteilles actives</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </div>
            ) : activeOwnedCount !== null ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(23, 64, 44, 0.06)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#56665D',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>
                  Quota actif : {activeOwnedCount}/{MAX_ACTIVE_OWNED_GROUPS} bouteilles
                </span>
                {validInitialCoords ? (
                  <span style={{ color: '#17402C', fontWeight: 700 }}>
                    Position exacte liée
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Grouped iOS card: Name + Message + Departure / Return Dates */}
            <div
              style={{
                borderRadius: 20,
                background: '#fff',
                border: '0.5px solid rgba(23, 64, 44, 0.10)',
                boxShadow: '0 2px 10px rgba(23, 43, 36, 0.04)',
                overflow: 'hidden',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                }}
              >
                <Compass size={15} color="#17402C" style={{ flex: 'none' }} aria-hidden="true" />
                <input
                  type="text"
                  required
                  maxLength={80}
                  disabled={quotaReached}
                  aria-label="Nom de la bouteille"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={defaultBottleName}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#172B24',
                  }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: '10px 14px',
                  borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#56665D',
                    }}
                  >
                    <MessageSquareText size={11} aria-hidden="true" />
                    Message (optionnel)
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: description.length >= MAX_DESCRIPTION_LEN ? '#8C1D1D' : '#7A8B81',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {description.length}/{MAX_DESCRIPTION_LEN}
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={MAX_DESCRIPTION_LEN}
                  disabled={quotaReached}
                  aria-label="Message ou description de la bouteille"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LEN))}
                  placeholder="Itinéraire prévu, rythme, matériel ou ambiance souhaitée..."
                  style={{
                    width: '100%',
                    border: 0,
                    outline: 'none',
                    resize: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    color: '#172B24',
                    fontFamily: 'inherit',
                  }}
                />
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 0.5px 1fr',
                  alignItems: 'center',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    padding: '10px 14px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#56665D',
                    }}
                  >
                    <Calendar size={11} aria-hidden="true" />
                    Départ
                  </span>
                  <input
                    type="date"
                    aria-label="Date de départ"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    style={{
                      border: 0,
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#172B24',
                      width: '100%',
                    }}
                  />
                </label>

                <div
                  aria-hidden="true"
                  style={{ height: 28, background: 'rgba(23, 64, 44, 0.10)' }}
                />

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    padding: '10px 14px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#56665D',
                    }}
                  >
                    <Calendar size={11} aria-hidden="true" />
                    Retour
                  </span>
                  <input
                    type="date"
                    aria-label="Date de retour"
                    min={departureDate || undefined}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    style={{
                      border: 0,
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#172B24',
                      width: '100%',
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Grouped iOS card: Places stepper + Mixité + Min Trust */}
            <div
              style={{
                borderRadius: 20,
                background: '#fff',
                border: '0.5px solid rgba(23, 64, 44, 0.10)',
                boxShadow: '0 2px 10px rgba(23, 43, 36, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Places (2-12) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#172B24',
                  }}
                >
                  <Users size={14} color="#17402C" aria-hidden="true" />
                  Places
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    aria-label="Diminuer les places"
                    disabled={maxMembers <= MIN_PLACES}
                    onClick={() => setMaxMembers((v) => Math.max(MIN_PLACES, v - 1))}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '0.5px solid rgba(23, 64, 44, 0.16)',
                      background: maxMembers <= MIN_PLACES ? 'rgba(23, 64, 44, 0.04)' : '#fff',
                      color: maxMembers <= MIN_PLACES ? '#96A69D' : '#17402C',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: maxMembers <= MIN_PLACES ? 'default' : 'pointer',
                    }}
                  >
                    <Minus size={13} aria-hidden="true" />
                  </button>
                  <span
                    style={{
                      minWidth: 20,
                      textAlign: 'center',
                      fontSize: 14.5,
                      fontWeight: 700,
                      color: '#172B24',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {maxMembers}
                  </span>
                  <button
                    type="button"
                    aria-label="Augmenter les places"
                    disabled={maxMembers >= MAX_PLACES}
                    onClick={() => setMaxMembers((v) => Math.min(MAX_PLACES, v + 1))}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: 0,
                      background: maxMembers >= MAX_PLACES ? 'rgba(23, 64, 44, 0.25)' : '#17402C',
                      color: '#FBFAF6',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: maxMembers >= MAX_PLACES ? 'default' : 'pointer',
                    }}
                  >
                    <Plus size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Mixité pill toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '10px 14px',
                  borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#172B24' }}>Mixité</span>
                <div
                  role="radiogroup"
                  aria-label="Mixité du groupe"
                  style={{
                    display: 'inline-flex',
                    padding: 2,
                    borderRadius: 999,
                    background: 'rgba(23, 64, 44, 0.07)',
                    gap: 2,
                  }}
                >
                  {MIXITE_CHOICES.map((opt) => {
                    const active = mixite === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMixite(opt.id)}
                        style={{
                          height: 26,
                          padding: '0 10px',
                          borderRadius: 999,
                          border: 0,
                          background: active ? '#17402C' : 'transparent',
                          color: active ? '#FBFAF6' : '#56665D',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trust min (>= 50 floor) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '10px 14px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#172B24',
                  }}
                >
                  <ShieldCheck size={14} color="#17402C" aria-hidden="true" />
                  Trust min
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {TRUST_PRESETS.map((score) => {
                    const active = minTrustScore === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setMinTrustScore(score)}
                        style={{
                          height: 26,
                          padding: '0 9px',
                          borderRadius: 999,
                          border: 0,
                          background: active ? '#17402C' : 'rgba(23, 64, 44, 0.07)',
                          color: active ? '#FBFAF6' : '#17402C',
                          fontSize: 11.5,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          cursor: 'pointer',
                        }}
                      >
                        ≥{score}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* +18 Majority check */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 16,
                background: isAdult ? 'rgba(150, 186, 142, 0.18)' : '#fff',
                border: isAdult
                  ? '1px solid rgba(23, 64, 44, 0.30)'
                  : '0.5px solid rgba(23, 64, 44, 0.10)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isAdult}
                onChange={(e) => setIsAdult(e.target.checked)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              />
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: isAdult ? '#17402C' : 'rgba(23, 64, 44, 0.08)',
                  color: '#FBFAF6',
                  display: 'grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                {isAdult ? <Check size={12} /> : null}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#172B24', lineHeight: 1.3 }}>
                Je confirme avoir 18 ans ou plus (+18)
              </span>
            </label>

            {errorMsg ? (
              <div
                role="alert"
                style={{
                  padding: '9px 12px',
                  borderRadius: 14,
                  background: 'rgba(166, 38, 38, 0.08)',
                  border: '0.5px solid rgba(166, 38, 38, 0.24)',
                  color: '#8C1D1D',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            ) : null}

            {/* Primary pill CTA */}
            <button
              type="submit"
              disabled={quotaReached || checkingQuota || submitting || !name.trim() || !isAdult}
              style={{
                height: 46,
                borderRadius: 999,
                border: 0,
                background: '#17402C',
                color: '#FBFAF6',
                fontSize: 14,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor:
                  quotaReached || checkingQuota || submitting || !name.trim() || !isAdult
                    ? 'default'
                    : 'pointer',
                opacity:
                  quotaReached || checkingQuota || submitting || !name.trim() || !isAdult
                    ? 0.5
                    : 1,
                boxShadow: '0 8px 20px rgba(23, 64, 44, 0.22)',
              }}
            >
              <Send size={14} aria-hidden="true" />
              {quotaReached
                ? `Quota atteint (${activeOwnedCount}/${MAX_ACTIVE_OWNED_GROUPS})`
                : submitting
                  ? 'Lancement…'
                  : 'Lancer la bouteille'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
