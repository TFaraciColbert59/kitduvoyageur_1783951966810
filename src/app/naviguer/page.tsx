'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveHikeMode } from '@/hooks/useActiveHikeMode';
import { useGeolocation } from '@/hooks/useGeolocation';

// ─── SOS Modal ────────────────────────────────────────────────────────────────
function SOSModal({
  onClose,
  position,
  emergencyContact,
  onSetContact,
}: {
  onClose: () => void;
  position: GeolocationPosition | null;
  emergencyContact: string | null;
  onSetContact: (c: string) => void;
}) {
  const [step, setStep] = useState<'confirm' | 'contact' | 'sent'>('confirm');
  const [contactInput, setContactInput] = useState(emergencyContact || '');

  const handleSend = () => {
    if (!emergencyContact && !contactInput.trim()) {
      setStep('contact');
      return;
    }
    if (contactInput.trim()) onSetContact(contactInput.trim());
    setStep('sent');
  };

  const lat = position?.coords.latitude.toFixed(5);
  const lng = position?.coords.longitude.toFixed(5);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alerte d'urgence SOS"
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6"
        style={{ background: '#1C2620', color: '#E7E3D6', paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
      >
        {step === 'confirm' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center rounded-full" style={{ width: '48px', height: '48px', background: '#DC2626' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg" style={{ color: '#E7E3D6' }}>Alerte d&apos;urgence</h2>
                <p className="text-sm" style={{ color: '#9AAD9E' }}>Confirmer l&apos;envoi de votre position</p>
              </div>
            </div>

            {lat && lng && (
              <div className="rounded-xl p-3 mb-4 font-mono text-sm" style={{ background: 'rgba(255,255,255,0.07)', color: '#9AAD9E' }}>
                📍 {lat}, {lng}
              </div>
            )}

            <p className="text-sm mb-6" style={{ color: '#C5D0C7' }}>
              Votre position GPS sera envoyée à votre contact d&apos;urgence
              {emergencyContact ? ` (${emergencyContact})` : ''}.
            </p>

            <button
              onClick={handleSend}
              className="w-full py-4 rounded-2xl font-bold text-lg font-display mb-3"
              style={{ background: '#DC2626', color: 'white', minHeight: '56px' }}
              aria-label="Confirmer et envoyer l'alerte d'urgence"
            >
              🆘 Envoyer l&apos;alerte
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl font-medium text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#E7E3D6' }}
            >
              Annuler
            </button>
          </>
        )}

        {step === 'contact' && (
          <>
            <h2 className="font-display font-bold text-lg mb-2" style={{ color: '#E7E3D6' }}>Contact d&apos;urgence</h2>
            <p className="text-sm mb-4" style={{ color: '#9AAD9E' }}>Entrez un numéro ou email pour l&apos;alerte</p>
            <input
              type="text"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="+33 6 00 00 00 00"
              className="w-full px-4 py-3 rounded-xl mb-4 text-base"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#E7E3D6', border: '1px solid rgba(255,255,255,0.15)' }}
              autoFocus
              aria-label="Numéro ou email du contact d'urgence"
            />
            <button
              onClick={() => { if (contactInput.trim()) { onSetContact(contactInput.trim()); setStep('sent'); } }}
              className="w-full py-4 rounded-2xl font-bold text-lg mb-3"
              style={{ background: '#DC2626', color: 'white', minHeight: '56px' }}
            >
              🆘 Envoyer l&apos;alerte
            </button>
            <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#E7E3D6' }}>
              Annuler
            </button>
          </>
        )}

        {step === 'sent' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="flex items-center justify-center rounded-full mb-4" style={{ width: '64px', height: '64px', background: '#16A34A' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-display font-bold text-xl mb-2" style={{ color: '#E7E3D6' }}>Alerte envoyée</h2>
            <p className="text-sm mb-6" style={{ color: '#9AAD9E' }}>
              Votre position a été transmise. Restez visible et attendez les secours.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl font-medium"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#E7E3D6' }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stop Hike Confirmation ───────────────────────────────────────────────────
function StopHikeModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terminer la randonnée"
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6"
        style={{ background: '#E7E3D6', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <h2 className="font-display font-bold text-lg mb-2" style={{ color: '#1C2620' }}>Terminer la rando ?</h2>
        <p className="text-sm mb-6" style={{ color: '#5C6B5E' }}>Votre session sera sauvegardée dans votre historique.</p>
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-2xl font-semibold mb-3"
          style={{ background: '#1C2620', color: '#E7E3D6' }}
        >
          Terminer la rando
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl font-medium"
          style={{ background: 'rgba(28,38,32,0.08)', color: '#1C2620' }}
        >
          Continuer la rando
        </button>
      </div>
    </div>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(pace: number): string {
  if (!pace || pace > 99) return '--:--';
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NaviguerPage() {
  const { isActive, stats, startHike, stopHike, emergencyContact, setEmergencyContact } = useActiveHikeMode();
  const { position, requestPermission } = useGeolocation();
  const [showSOS, setShowSOS] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [geoRequested, setGeoRequested] = useState(false);

  useEffect(() => {
    if (!geoRequested) {
      requestPermission();
      setGeoRequested(true);
    }
  }, [geoRequested, requestPermission]);

  const handleStartHike = useCallback(() => {
    if (!position) requestPermission();
    startHike();
  }, [position, requestPermission, startHike]);

  const handleStopConfirm = useCallback(() => {
    stopHike();
    setShowStop(false);
  }, [stopHike]);

  return (
    <main
      id="main-content"
      className="md:hidden flex flex-col"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(52px + env(safe-area-inset-top))',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
        background: '#1C2620',
      }}
    >
      {/* Map area */}
      <div className="relative flex-1 flex flex-col" style={{ minHeight: '0' }}>
        {/* Map placeholder — full screen */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #243028 0%, #1C2620 50%, #1a3020 100%)' }}
          aria-label="Carte interactive"
        >
          {/* Topo grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" aria-hidden="true">
            <defs>
              <pattern id="topo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#5C8A3A" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-grid)" />
          </svg>

          {/* Center marker */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: '72px', height: '72px', background: 'rgba(228, 80, 28, 0.15)', border: '2px solid rgba(228, 80, 28, 0.4)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E4501C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </div>
            {!position && (
              <button
                onClick={requestPermission}
                className="px-5 py-2.5 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(228, 80, 28, 0.2)', color: '#E4501C', border: '1px solid rgba(228, 80, 28, 0.4)' }}
                aria-label="Activer la géolocalisation"
              >
                📍 Activer la localisation
              </button>
            )}
            {position && (
              <p className="text-xs font-mono" style={{ color: '#5C8A3A' }}>
                {position.coords.latitude.toFixed(4)}, {position.coords.longitude.toFixed(4)}
              </p>
            )}
          </div>

          {/* Weather widget */}
          <div
            className="absolute top-3 left-3 right-3 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
            style={{ background: 'rgba(28, 38, 32, 0.85)', backdropFilter: 'blur(8px)' }}
            aria-label="Météo actuelle"
          >
            <span className="text-2xl" aria-hidden="true">⛅</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#E7E3D6' }}>18°C — Partiellement nuageux</p>
              <p className="text-xs" style={{ color: '#9AAD9E' }}>Vent 12 km/h · Aucune alerte active</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AAD9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Active hike overlay */}
        {isActive && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3 rounded-t-2xl"
            style={{ background: 'rgba(28, 38, 32, 0.95)', backdropFilter: 'blur(12px)' }}
            aria-label="Statistiques de randonnée en cours"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-4">
              {/* Stats */}
              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="font-mono text-xl font-bold" style={{ color: '#E7E3D6', fontFamily: 'var(--font-mono)' }}>
                    {stats.distanceKm.toFixed(2)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: '#9AAD9E' }}>km</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-xl font-bold" style={{ color: '#E7E3D6', fontFamily: 'var(--font-mono)' }}>
                    {formatDuration(stats.durationSeconds)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: '#9AAD9E' }}>durée</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-mono text-xl font-bold" style={{ color: '#E7E3D6', fontFamily: 'var(--font-mono)' }}>
                    {formatPace(stats.paceMinPerKm)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: '#9AAD9E' }}>min/km</span>
                </div>
              </div>

              {/* Stop button */}
              <button
                onClick={() => setShowStop(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#E7E3D6' }}
                aria-label="Terminer la randonnée"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action area */}
      {!isActive && (
        <div
          className="px-4 py-4 flex flex-col gap-3"
          style={{ background: '#1C2620' }}
        >
          <button
            onClick={handleStartHike}
            className="w-full py-4 rounded-2xl font-display font-bold text-lg"
            style={{ background: '#E4501C', color: 'white', minHeight: '56px' }}
            aria-label="Démarrer une randonnée"
          >
            🥾 Démarrer une rando
          </button>
          <Link
            href="/carte-interactive"
            className="w-full py-3 rounded-2xl font-medium text-center text-sm"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#E7E3D6' }}
            aria-label="Voir la carte interactive complète"
          >
            Voir la carte complète
          </Link>
        </div>
      )}

      {/* SOS button — always visible during hike */}
      {isActive && (
        <button
          onClick={() => setShowSOS(true)}
          className="fixed z-[100] flex items-center gap-2 px-4 rounded-2xl font-bold text-base"
          style={{
            right: '16px',
            bottom: 'calc(56px + env(safe-area-inset-bottom) + 80px)',
            height: '56px',
            minWidth: '56px',
            background: '#DC2626',
            color: 'white',
            boxShadow: '0 4px 20px rgba(220, 38, 38, 0.6)',
          }}
          aria-label="Déclencher une alerte d'urgence"
        >
          <span className="text-lg" aria-hidden="true">🆘</span>
          <span>SOS</span>
        </button>
      )}

      {/* AI Copilot bubble — during hike */}
      {isActive && (
        <Link
          href="/copilote"
          className="fixed z-[90] flex items-center justify-center rounded-full"
          style={{
            left: '16px',
            bottom: 'calc(56px + env(safe-area-inset-bottom) + 80px)',
            width: '48px',
            height: '48px',
            background: '#3A6EA5',
            boxShadow: '0 4px 16px rgba(58, 110, 165, 0.5)',
          }}
          aria-label="Ouvrir le copilote IA — assistance terrain"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>
      )}

      {/* Modals */}
      {showSOS && (
        <SOSModal
          onClose={() => setShowSOS(false)}
          position={position}
          emergencyContact={emergencyContact}
          onSetContact={setEmergencyContact}
        />
      )}
      {showStop && (
        <StopHikeModal
          onConfirm={handleStopConfirm}
          onCancel={() => setShowStop(false)}
        />
      )}
    </main>
  );
}
