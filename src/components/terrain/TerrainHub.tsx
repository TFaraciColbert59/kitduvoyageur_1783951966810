'use client';

import React from 'react';
import Link from 'next/link';
import LkvIcon from '@/components/ui/LkvIcon';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const QUICK_CARDS = [
  {
    label: 'Mon Kit',
    href: '/mon-kit',
    icon: 'bag' as const,
    color: '#2D6B4A',
  },
  {
    label: 'Recherche',
    href: '/explorer',
    icon: 'search' as const,
    color: '#17402C',
  },
  {
    label: 'Carte',
    href: '/carte-interactive',
    icon: 'map-pin' as const,
    color: '#A3C4A3',
  },
  {
    label: 'Guides',
    href: '/guides',
    icon: 'bookmark' as const,
    color: '#6B7A72',
  },
];

export default function TerrainHub() {
  const { isOnline } = useOnlineStatus();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FBFAF6',
        paddingTop: '80px',
        paddingBottom: 'calc(62px + 24px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '0 20px 24px',
          borderBottom: '1px solid rgba(11,31,23,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#0B1F17',
              fontFamily: 'var(--font-display)',
            }}
          >
            Mode Terrain
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: isOnline
                ? 'rgba(45,107,74,0.1)'
                : 'rgba(107,122,114,0.12)',
              fontSize: '11px',
              fontWeight: 600,
              color: isOnline ? '#2D6B4A' : '#6B7A72',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isOnline ? '#2D6B4A' : '#6B7A72',
              }}
            />
            {isOnline ? 'GPS actif' : 'Hors ligne'}
          </div>
        </div>
        <p
          style={{
            fontSize: '14px',
            color: '#6B7A72',
            lineHeight: 1.5,
          }}
        >
          Tous vos outils terrain réunis en un seul endroit
        </p>
      </header>

      {/* Hero Card */}
      <div style={{ padding: '24px 20px' }}>
        <Link
          href="/naviguer"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, #17402C 0%, #2D6B4A 100%)',
            borderRadius: '20px',
            padding: '32px 24px',
            position: 'relative',
            overflow: 'hidden',
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(23,64,44,0.2)',
          }}
        >
          {/* Glow decoration */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(163,196,163,0.3) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LkvIcon name="compass" size={26} color="#fff" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  Naviguer
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  GPS · SOS · Tracking
                </div>
              </div>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.5,
                marginBottom: '16px',
              }}
            >
              Activez le mode rando pour enregistrer votre parcours, appeler
              les secours et partager votre position en temps réel.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
              }}
            >
              Activer le mode
              <LkvIcon name="arrow-right" size={16} color="#fff" />
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Grid */}
      <div style={{ padding: '0 20px 24px' }}>
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#0B1F17',
            marginBottom: '14px',
            fontFamily: 'var(--font-display)',
          }}
        >
          Accès rapide
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
          }}
        >
          {QUICK_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px',
                background: '#FBFAF6',
                border: '1px solid rgba(11,31,23,0.06)',
                borderRadius: '16px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: `${card.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                }}
              >
                <LkvIcon name={card.icon} size={22} color={card.color} />
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0B1F17',
                  textAlign: 'center',
                }}
              >
                {card.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          padding: '20px',
          margin: '0 20px',
          background: '#EDF3ED',
          borderRadius: '16px',
          border: '1px solid rgba(11,31,23,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#0B1F17',
                marginBottom: '4px',
              }}
            >
              Mode terrain persistant
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#6B7A72',
              }}
            >
              À venir — Restez en mode terrain entre les pages
            </div>
          </div>
          <div
            style={{
              width: '48px',
              height: '28px',
              borderRadius: '14px',
              background: 'rgba(11,31,23,0.1)',
              position: 'relative',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '11px',
                background: '#fff',
                position: 'absolute',
                top: '3px',
                left: '3px',
                boxShadow: '0 2px 4px rgba(11,31,23,0.15)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
