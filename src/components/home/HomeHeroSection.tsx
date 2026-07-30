'use client';

import React from 'react';
import Link from 'next/link';
import LkvIcon from '@/components/ui/LkvIcon';
import LkvButton from '@/components/ui/LkvButton';

interface HomeHeroSectionProps {
  onMenuOpen?: () => void;
}

export default function HomeHeroSection({ onMenuOpen: _onMenuOpen }: HomeHeroSectionProps) {
  return (
    <div style={{
      position: 'relative', height: '460px',
      padding: '90px 20px 24px', color: '#fff', overflow: 'hidden',
    }}>
      {/* Background gradient — forest-900 base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #1a2f24 0%, #0B1F17 100%)',
      }} />
      {/* Radial overlays for depth */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(168,200,160,0.25) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(45,107,74,0.4) 0%, transparent 50%)',
      }} />
      {/* Mountains SVG at bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '240px',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 240'%3E%3Cpath d='M0 240V160l80-60 120 100 160-120 200 140 120-80 180 120 140-100 200 160v80z' fill='rgba(11,31,23,0.4)'/%3E%3Cpath d='M0 240V180l100-40 150 80 180-100 220 120 140-60 160 80 100-40 150 60v100z' fill='rgba(45,107,74,0.3)'/%3E%3C/svg%3E")`,
        backgroundSize: 'cover', backgroundPosition: 'center bottom',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Eye badge */}
        <div style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '5px 12px',
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '999px',
          fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C6DCBE' }} />
          Édition automne · 2026
        </div>
        {/* Title + CTAs */}
        <div>
          <h1 style={{ fontSize: '46px', fontWeight: 500, letterSpacing: '-0.035em', lineHeight: '0.96', margin: '0 0 12px' }}>
            Ce que vous emportez,<br/><em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#C6DCBE', fontWeight: 400 }}>c&apos;est votre voyage.</em>
          </h1>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(255,255,255,0.75)', margin: '0' }}>
            Six objets testés en Chartreuse. Des refuges choisis à la main.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <Link href="/boutique">
              <LkvButton variant="light" size="md" icon={<LkvIcon name="arrow-right" size={16} color="#0B1F17" />}>
                Composer mon sac
              </LkvButton>
            </Link>
            <Link href="/explorer">
              <LkvButton variant="ghost-light" size="md" icon={<LkvIcon name="arrow-right" size={16} color="#fff" />}>
                Voir les aventures
              </LkvButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
