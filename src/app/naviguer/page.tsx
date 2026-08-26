'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useActiveHikeMode } from '@/hooks/useActiveHikeMode';
import { useGeolocation } from '@/hooks/useGeolocation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import CopilotFAB from '@/components/mobile-nav/CopilotFAB';

function SOSModal({ onClose, position, emergencyContact, onSetContact }: {
  onClose: () => void;
  position: GeolocationPosition | null;
  emergencyContact: string | null;
  onSetContact: (c: string) => void;
}) {
  const [step, setStep] = useState<'confirm' | 'contact' | 'sent'>('confirm');
  const [contactInput, setContactInput] = useState(emergencyContact || '');
  const handleSend = () => {
    if (!emergencyContact && !contactInput.trim()) { setStep('contact'); return; }
    if (contactInput.trim()) onSetContact(contactInput.trim());
    setStep('sent');
  };
  const lat = position?.coords.latitude.toFixed(5);
  const lng = position?.coords.longitude.toFixed(5);
  return (
    <div role="dialog" aria-modal="true" aria-label="Alerte d'urgence SOS" className="fixed inset-0 z-[200] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-t-3xl p-6" style={{ background: '#17402C', color: '#E7E3D6', paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
        {step === 'confirm' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center rounded-full" style={{ width: '48px', height: '48px', background: '#DC2626' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M12 17h.01" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
              </div>
              <div><h2 style={{ color: '#E7E3D6' }}>Alerte d'urgence</h2><p style={{ color: '#9AAD9E', fontSize: '13px' }}>Confirmer l'envoi de votre position</p></div>
            </div>
            {lat && lng && <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px', marginBottom: '12px', fontSize: '13px', fontFamily: 'monospace', color: '#9AAD9E' }}>📍 {lat}, {lng}</div>}
            <p style={{ color: '#C5D0C7', fontSize: '13px', marginBottom: '16px' }}>Votre position sera envoyée à votre contact d'urgence{emergencyContact ? ` (${emergencyContact})` : ''}.</p>
            <button onClick={handleSend} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#DC2626', color: 'white', border: 'none', fontSize: '18px', fontWeight: 700, marginBottom: '10px', cursor: 'pointer' }}>🆘 Envoyer l'alerte</button>
            <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', color: '#E7E3D6', border: 'none', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
          </>
        )}
        {step === 'contact' && (
          <>
            <h2 style={{ color: '#E7E3D6', fontWeight: 700 }}>Contact d'urgence</h2>
            <p style={{ color: '#9AAD9E', fontSize: '13px', marginBottom: '12px' }}>Entrez un numéro ou email</p>
            <input type="text" value={contactInput} onChange={(e) => setContactInput(e.target.value)} placeholder="+33 6 00 00 00 00" autoFocus style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#E7E3D6', border: '1px solid rgba(255,255,255,0.15)', marginBottom: '12px', fontSize: '16px' }} />
            <button onClick={() => { if (contactInput.trim()) { onSetContact(contactInput.trim()); setStep('sent'); } }} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#DC2626', color: 'white', border: 'none', fontSize: '18px', fontWeight: 700, marginBottom: '10px', cursor: 'pointer' }}>🆘 Envoyer l'alerte</button>
            <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', color: '#E7E3D6', border: 'none', fontSize: '14px', cursor: 'pointer' }}>Annuler</button>
          </>
        )}
        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 style={{ color: '#E7E3D6', fontWeight: 700, fontSize: '20px', marginBottom: '8px' }}>Alerte envoyée</h2>
            <p style={{ color: '#9AAD9E', fontSize: '13px', marginBottom: '20px' }}>Restez visible et attendez les secours.</p>
            <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', color: '#E7E3D6', border: 'none', fontSize: '14px', cursor: 'pointer' }}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StopHikeModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Terminer la randonnée" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ width: '100%', maxWidth: '500px', borderRadius: '24px 24px 0 0', padding: '24px', background: '#E7E3D6', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <h2 style={{ fontWeight: 700, color: '#17402C', marginBottom: '8px' }}>Terminer la rando ?</h2>
        <p style={{ color: '#5C6B5E', fontSize: '14px', marginBottom: '24px' }}>Votre session sera sauvegardée dans votre historique.</p>
        <button onClick={onConfirm} style={{ width: '100%', padding: '12px', borderRadius: '16px', background: '#17402C', color: '#E7E3D6', border: 'none', fontWeight: 600, marginBottom: '10px', cursor: 'pointer' }}>Terminer la rando</button>
        <button onClick={onCancel} style={{ width: '100%', padding: '12px', borderRadius: '16px', background: 'rgba(23,64,44,0.08)', color: '#17402C', border: 'none', fontWeight: 500, cursor: 'pointer' }}>Continuer la rando</button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatPace(pace: number): string {
  if (!pace || pace > 99) return '--:--';
  const min = Math.floor(pace);
  const sec = Math.round((pace - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function NaviguerPage() {
  const { isActive, stats, startHike, stopHike, emergencyContact, setEmergencyContact } = useActiveHikeMode();
  const { position, requestPermission } = useGeolocation();
  const { user } = useAuth();
  const [showSOS, setShowSOS] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [geoRequested, setGeoRequested] = useState(false);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (!geoRequested) { requestPermission(); setGeoRequested(true); }
  }, [geoRequested, requestPermission]);

  const handleStartHike = useCallback(async () => {
    if (!position) requestPermission();
    startHike();
    if (user) {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('activities').insert({ user_id: user.id, title: 'Randonnée', started_at: new Date().toISOString() }).select('id').single();
        if (data?.id) setCurrentActivityId(data.id);
      } catch { /* ignore */ }
    }
  }, [position, requestPermission, startHike, user]);

  const handleStopConfirm = useCallback(async () => {
    stopHike();
    setShowStop(false);
    if (user && currentActivityId) {
      try {
        const supabase = createClient();
        await supabase.from('activities').update({ ended_at: new Date().toISOString(), distance_km: stats.distanceKm, duration_seconds: stats.durationSeconds }).eq('id', currentActivityId);
      } catch { /* ignore */ }
      setCurrentActivityId(null);
    }
  }, [stopHike, user, currentActivityId, stats]);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block" style={{ minHeight: '100vh', background: '#17402C', padding: '100px' }}>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Vue disponible uniquement sur mobile</p>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <main id="main-content" className="flex flex-col" style={{ minHeight: '100dvh', background: '#17402C' }}>
            <div className="relative flex-1 flex flex-col" style={{ minHeight: '0' }}>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #243028 0%, #17402C 50%, #1a3020 100%)' }}>
                <svg className="absolute inset-0 w-full h-full opacity-10" aria-hidden="true">
                  <defs><pattern id="topo-grid-n" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#5C8A3A" strokeWidth="0.5" /></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#topo-grid-n)" />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center" style={{ height: '100%' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(228, 80, 28, 0.15)', border: '2px solid rgba(228, 80, 28, 0.4)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
                  </div>
                  {!position && (
                    <button onClick={requestPermission} style={{ marginTop: '16px', padding: '10px 20px', borderRadius: '40px', background: 'rgba(228, 80, 28, 0.2)', color: '#17402C', border: '1px solid rgba(228, 80, 28, 0.4)', fontSize: '13px', cursor: 'pointer' }}>📍 Activer la localisation</button>
                  )}
                  {position && <p style={{ marginTop: '12px', fontSize: '11px', fontFamily: 'monospace', color: '#5C8A3A' }}>{position.coords.latitude.toFixed(4)}, {position.coords.longitude.toFixed(4)}</p>}
                </div>
                <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '16px', background: 'rgba(23,64,44, 0.85)', backdropFilter: 'blur(8px)' }}>
                  <span style={{ fontSize: '24px' }}>⛅</span>
                  <div style={{ flex: 1 }}><p style={{ fontSize: '13px', fontWeight: 600, color: '#E7E3D6' }}>18°C — Partiellement nuageux</p><p style={{ fontSize: '11px', color: '#9AAD9E' }}>Vent 12 km/h</p></div>
                </div>
              </div>

              {isActive && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, padding: '12px 16px', borderRadius: '16px 16px 0 0', background: 'rgba(23,64,44, 0.95)', backdropFilter: 'blur(12px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E7E3D6' }}>{stats.distanceKm.toFixed(2)}</span><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9AAD9E', display: 'block' }}>km</span></div>
                      <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E7E3D6' }}>{formatDuration(stats.durationSeconds)}</span><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9AAD9E', display: 'block' }}>durée</span></div>
                      <div style={{ textAlign: 'center' }}><span style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E7E3D6' }}>{formatPace(stats.paceMinPerKm)}</span><span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9AAD9E', display: 'block' }}>min/km</span></div>
                    </div>
                    <button onClick={() => setShowStop(true)} style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#E7E3D6', border: 'none', fontSize: '13px', cursor: 'pointer' }}>Terminer</button>
                  </div>
                </div>
              )}
            </div>

            {!isActive && (
              <div style={{ padding: '16px', background: '#17402C', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={handleStartHike} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#17402C', color: 'white', border: 'none', fontSize: '18px', fontWeight: 700, cursor: 'pointer' }}>🥾 Démarrer une rando</button>
                <Link href="/carte-interactive" style={{ width: '100%', padding: '12px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', color: '#E7E3D6', textAlign: 'center', textDecoration: 'none', fontSize: '13px' }}>Voir la carte complète</Link>
              </div>
            )}
          </main>
        </MobilePageShell>

        {isActive && (
          <>
            <button onClick={() => setShowSOS(true)} style={{ position: 'fixed', zIndex: 100, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '16px', fontWeight: 700, fontSize: '16px', right: '16px', bottom: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom) + 80px)', height: '56px', minWidth: '56px', background: '#DC2626', color: 'white', border: 'none', boxShadow: '0 4px 20px rgba(220, 38, 38, 0.6)', cursor: 'pointer' }}><span>🆘</span><span>SOS</span></button>
            <CopilotFAB />
          </>
        )}

        {showSOS && <SOSModal onClose={() => setShowSOS(false)} position={position} emergencyContact={emergencyContact} onSetContact={setEmergencyContact} />}
        {showStop && <StopHikeModal onConfirm={handleStopConfirm} onCancel={() => setShowStop(false)} />}
        
      </div>
    </>
  );
}
