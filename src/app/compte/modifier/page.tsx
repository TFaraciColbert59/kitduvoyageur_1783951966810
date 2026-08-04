'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import EditProfileView from '@/components/compte/EditProfileView';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function EditProfilePage() {
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2E8]">
          <Header />
          <div className="pt-16"><EditProfileView /></div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        {/* Mobile top bar with back button */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: '#0B1F17',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/compte"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'white',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 4px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Retour
          </Link>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
            Modifier mon profil
          </span>
          <div style={{ width: '60px' }} />
        </div>
        <div style={{ paddingTop: '48px' }}>
          <EditProfileView />
        </div>
      </div>
    </>
  );
}