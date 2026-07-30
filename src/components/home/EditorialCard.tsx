'use client';

import React from 'react';
import Link from 'next/link';

interface EditorialCardProps {
  kind?: string;
  title: string;
  subtitle?: string;
  href?: string;
}

export default function EditorialCard({ kind, title, subtitle, href }: EditorialCardProps) {
  return (
    <Link href={href || '/carnets'} style={{
      display: 'block', margin: '16px 16px 0', borderRadius: '22px', overflow: 'hidden',
      height: '200px', color: '#fff', textDecoration: 'none',
      background: 'linear-gradient(160deg, #3d5548 0%, #1e2f27 100%)',
      position: 'relative',
    }}>
      {/* Topo overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.15,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200'%3E%3Cpath d='M0 200V140l60-30 80 50 100-60 160 80v40z' fill='%23A8C8A0'/%3E%3C/svg%3E")`,
        backgroundSize: 'cover',
      }} />
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, transparent 30%, rgba(11,31,23,0.85) 100%)',
      }} />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#A8C8A0', fontWeight: 500, marginBottom: '4px' }}>
          {kind || 'À la une'}
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
          {title}
        </h3>
        {subtitle && (
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            {subtitle}
          </div>
        )}
      </div>
    </Link>
  );
}
