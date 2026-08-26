'use client';

import React, { useEffect, useState } from 'react';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import HikeTimeline from '@/components/carnet/HikeTimeline';
import Link from 'next/link';

interface CarnetMoment {
  id: string;
  citation: string | null;
  heure: string | null;
  lieu: string | null;
  image_url: string | null;
  moment_timestamp: string | null;
  source: 'manuel' | 'auto' | null;
  hike_session_id: string | null;
  jour_numero: number | null;
  created_at: string;
}

interface Carnet {
  id: string;
  title: string | null;
  description: string | null;
  destination: string | null;
  cover_image: string | null;
  visibility: string;
  created_at: string;
}

interface Props {
  carnetId: string;
}

export default function CarnetDetailClient({ carnetId }: Props) {
  const [carnet, setCarnet] = useState<Carnet | null>(null);
  const [moments, setMoments] = useState<CarnetMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/carnets/${carnetId}`);
        if (!res.ok) throw new Error('Carnet introuvable');
        const data = await res.json();
        setCarnet(data.carnet);
        setMoments(data.moments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [carnetId]);

  if (loading) {
    return (
      <MobilePageShell>
        <div className="min-h-screen bg-[#F8F5EE] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#17402C]/20 border-t-[#17402C] rounded-full animate-spin" />
        </div>
      </MobilePageShell>
    );
  }

  if (error || !carnet) {
    return (
      <MobilePageShell>
        <div className="min-h-screen bg-[#F8F5EE] flex flex-col items-center justify-center p-8 text-center">
          <span className="text-5xl mb-4">📓</span>
          <h1 className="text-lg font-bold text-[#17402C] mb-2">Carnet introuvable</h1>
          <p className="text-sm text-[#7A8A7D] mb-6">
            {error || 'Ce carnet n\'existe pas ou n\'est plus accessible.'}
          </p>
          <Link
            href="/carnets"
            className="px-5 py-2.5 bg-[#17402C] text-white text-sm font-semibold rounded-xl"
          >
            Mes carnets
          </Link>
        </div>
      </MobilePageShell>
    );
  }

  return (
    <MobilePageShell>
      <div className="min-h-screen bg-[#F8F5EE]">
        {/* Hero */}
        <div
          className="relative h-52 bg-[#17402C] flex flex-col justify-end p-5"
          style={carnet.cover_image
            ? { backgroundImage: `url(${carnet.cover_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}}
        >
          {carnet.cover_image && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          )}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/carnets"
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
            </div>
            <h1 className="text-white font-bold text-xl leading-tight">
              {carnet.title || 'Mon carnet'}
            </h1>
            {carnet.destination && (
              <p className="text-white/70 text-sm mt-0.5">📍 {carnet.destination}</p>
            )}
          </div>
        </div>

        {/* Corps */}
        <div className="px-4 py-5">
          {/* Description */}
          {carnet.description && (
            <p className="text-sm text-[#5A6A5D] bg-white rounded-2xl p-4 border border-[#E8E4D8] mb-5 leading-relaxed">
              {carnet.description}
            </p>
          )}

          {/* Timeline */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-[#17402C] mb-4">
              📅 Timeline
            </h2>
            <HikeTimeline carnetId={carnetId} moments={moments} />
          </div>

          {/* Action : démarrer une randonnée associée */}
          <div className="mt-6 pt-5 border-t border-[#E8E4D8]">
            <Link
              href={`/randonnee-active`}
              className="w-full block py-3.5 bg-[#17402C] text-white text-sm font-semibold rounded-xl text-center hover:bg-[#2D3F35] transition-colors"
            >
              🥾 Démarrer une randonnée
            </Link>
          </div>
        </div>
      </div>
    </MobilePageShell>
  );
}
