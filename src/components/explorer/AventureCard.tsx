'use client';

import React from 'react';

import { useRouter } from 'next/navigation';
import { GestureCard } from '@/components/animations/GestureCard';
import { toast } from 'react-hot-toast';
import { getTrailImage } from './types';

interface AventureCardProps {
  trailId?: string;
  difficulty: string;
  location: string;
  title: string;
  distance: string | number;
  elevation: string | number;
  duration: string;
  imageUrl?: string;
  href?: string;
  onClick?: () => void;
  onPrepareClick?: () => void;
  onStartClick?: () => void;
}

export default function AventureCard({
  trailId,
  difficulty,
  location,
  title,
  distance,
  elevation,
  duration,
  imageUrl,
  href = '#',
  onClick,
  onPrepareClick,
  onStartClick,
}: AventureCardProps) {
  const router = useRouter();
  const img = imageUrl || (trailId ? getTrailImage(trailId) : 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80');

  const content = (
    <div
      style={{
        background: '#FBFAF6',
        border: '1px solid rgba(11,31,23,0.08)',
        borderRadius: '18px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 2px 8px rgba(11,31,23,0.04)',
      }}
    >
      <div style={{ display: 'flex', minHeight: '100px' }}>
        {/* Trail Image Thumbnail */}
        <div
          style={{
            width: '115px',
            flexShrink: 0,
            position: 'relative',
            background: '#EDF3ED',
            overflow: 'hidden',
          }}
        >
          <img
            src={img}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {difficulty && (
            <span
              style={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                padding: '2px 7px',
                background: 'rgba(255,255,255,0.92)',
                borderRadius: '999px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#17402C',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              }}
            >
              {difficulty}
            </span>
          )}
        </div>

        {/* Trail Details */}
        <div
          style={{
            flex: 1,
            padding: '12px 12px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minWidth: 0,
          }}
        >
          <div>
            {location && (
              <div
                style={{
                  fontSize: '9.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#6B7A72',
                  fontWeight: 600,
                  marginBottom: '2px',
                }}
              >
                {location}
              </div>
            )}
            <h3
              style={{
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#0B1F17',
                margin: 0,
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </h3>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#6B7A72',
              fontFamily: 'var(--font-mono), monospace',
              marginTop: '6px',
            }}
          >
            <span>{distance}</span>
            <span>·</span>
            <span>{elevation}</span>
            <span>·</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      {/* Action button bar */}
      <div
        style={{
          padding: '8px 12px 10px',
          borderTop: '1px solid rgba(11,31,23,0.05)',
          background: 'rgba(255,255,255,0.6)',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onPrepareClick) onPrepareClick();
            else if (trailId) router.push(`/preparer-randonnee?routeId=${trailId}`);
          }}
          style={{
            width: '100%',
            padding: '9px 12px',
            background: '#17402C',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(23,64,44,0.2)',
          }}
        >
          <span>🎒</span>
          <span>Préparer ma randonnée</span>
        </button>
      </div>
    </div>
  );

  const handleTap = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(href);
    }
  };

  return (
    <GestureCard
      onSwipeLeft={() => toast.success('Partagé avec succès !')}
      onSwipeRight={() => toast.success('Sauvegardé dans vos favoris')}
      onTap={handleTap}
    >
      {content}
    </GestureCard>
  );
}
