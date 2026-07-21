'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

const REVIEWS = [
  {
    id: '1',
    stars: 5,
    quote: 'Parti au Népal avec le sac fait par l\'IA. Rien ne manquait. Gain de temps fou.',
    author: 'Thomas R.',
    badge: 'Achat Vérifié',
  },
  {
    id: '2',
    stars: 5,
    quote: 'La tente MSR en location est arrivée impeccable. Concept génial pour ne pas se ruiner avant le départ.',
    author: 'Sophie L.',
    badge: 'Achat Vérifié',
  },
];

export default function VerifiedReviewsSection() {
  return (
    <section
      className="bg-[#1C2620] py-10 px-4 sm:px-6 lg:px-8 border-t border-white/5"
      aria-label="Avis vérifiés clients">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 })?.map((_, i) => (
              <Icon key={i} name="StarIcon" size={13} variant="solid" className="text-[#E4501C]" />
            ))}
          </div>
          <span
            className="text-white/50 text-xs tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-mono)' }}>
            12 847 Kits configurés · Avis vérifiés
          </span>
        </div>

        {/* Review cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {REVIEWS?.map((review) => (
            <div
              key={review?.id}
              className="rounded-xl p-5 flex flex-col gap-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
              {/* Stars */}
              <div className="flex gap-0.5" aria-label={`Note: ${review?.stars}/5`}>
                {Array.from({ length: review?.stars })?.map((_, i) => (
                  <Icon key={i} name="StarIcon" size={12} variant="solid" className="text-[#E4501C]" />
                ))}
              </div>

              {/* Quote */}
              <blockquote
                className="text-white/75 text-sm leading-relaxed italic"
                style={{ fontFamily: 'var(--font-display)' }}>
                &ldquo;{review?.quote}&rdquo;
              </blockquote>

              {/* Author + badge */}
              <div className="flex items-center gap-2 mt-auto">
                <span
                  className="font-semibold text-white/90 text-xs"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  — {review?.author}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(228,80,28,0.12)',
                    color: '#E4501C',
                    border: '1px solid rgba(228,80,28,0.2)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                  <Icon name="CheckBadgeIcon" size={10} variant="solid" />
                  {review?.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
