'use client';

import React from 'react';
import Link from 'next/link';
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

  const handlePrepareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPrepareClick) {
      onPrepareClick();
    } else if (trailId) {
      router.push(`/preparer-randonnee?routeId=${trailId}`);
    }
  };

  const content = (
    <div
      style={{
        background: '#FBFAF6',
        border: '1px solid rgba(11,31,23,0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 2px 8px rgba(11,31,23,0.04)',
        position: 'relative',
      }}
    >
      {/* Trail Image Thumbnail */}
      <div
        style={{
          width: '105px',
          minWidth: '105px',
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
          padding: '10px 8px 10px 12px',
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
              fontSize: '13px',
              fontWeight: 700,
              color: '#0B1F17',
              lineHeight: 1.25,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </h3>
        </div>

        {/* Metrics */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
            color: 'rgba(11,31,23,0.5)',
            marginTop: '6px',
          }}
        >
          <span style={{ fontWeight: 600, color: '#0B1F17' }}>{distance}</span>
          <span>·</span>
          <span>{elevation}</span>
          <span>·</span>
          <span>{duration}</span>
        </div>
      </div>

      {/* Right-Side Liquid Glass Action Button with Long Arrow */}
      <div className="flex items-center justify-center pr-3 pl-1 self-stretch">
        <button
          onClick={handlePrepareClick}
          aria-label={`Ouvrir la randonnée : ${title}`}
          className="w-10 h-10 rounded-2xl bg-white/70 hover:bg-white/90 backdrop-blur-xl border border-white/80 shadow-[0_4px_16px_rgba(23,64,44,0.12)] text-[#17402C] hover:text-[#1E5238] flex items-center justify-center active:scale-90 transition-all duration-200 group/btn"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Long Arrow Icon */}
          <svg
            className="w-5 h-5 transform group-hover/btn:translate-x-0.5 transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="12" x2="20" y2="12" />
            <polyline points="14 6 20 12 14 18" />
          </svg>
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
