'use client';

import React from 'react';
import MobileProfilePage from '@/components/mobile-nav/MobileProfilePage';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  trust_score: number;
  loyalty_points: number;
  loyalty_level: string;
  bio: string;
  location: string;
  xp: number;
  level: number;
  created_at: string;
}

interface Carnet {
  id: string;
  title: string;
  destination: string;
  cover_image: string;
  cover_image_alt: string;
  start_date: string | null;
  created_at: string;
}

interface GearItem {
  id: string;
  name: string;
  category: string;
  weight_g: number;
  brand: string;
  condition: string;
}

type ProfileTab = 'aventures' | 'photos' | 'recommandations';

const HERO_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80';

const PHOTO_JOURNAL = [
  { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', alt: 'Randonneur au sommet des montagnes au coucher du soleil' },
  { src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', alt: 'Vue aérienne de forêt de pins dans la brume matinale' },
  { src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', alt: 'Bivouac sous un ciel étoilé en montagne' },
  { src: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', alt: 'Lac de montagne aux eaux turquoise entouré de sommets' },
  { src: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80', alt: 'Tente de camping installée sur un plateau rocheux' },
];

const MOCK_KIT = [
  { id: '1', name: 'Sac 45 L', detail: 'Vert forêt · 3 ans d\'usage', weight: '1,4 kg', src: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&q=80', alt: 'Sac à dos de randonnée vert 45 litres' },
  { id: '2', name: 'Duvet 3 saisons', detail: '-10 °C', weight: '920 g', src: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=80&q=80', alt: 'Duvet de camping trois saisons compressé' },
  { id: '3', name: 'Veste 3 couches', detail: 'Forêt · 2 ans', weight: '480 g', src: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=80&q=80', alt: 'Veste imperméable trois couches verte' },
  { id: '4', name: 'Gourde titane', detail: '1 L · rouge', weight: '188 g', src: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=80&q=80', alt: 'Gourde en titane rouge de 1 litre' },
];

const MOCK_BADGES = [
  { id: '1', name: 'Sommet 3000', icon: '⛰️', unlocked: true, desc: 'Or · 2 ans' },
  { id: '2', name: '10 bivouacs', icon: '🏕️', unlocked: true, desc: 'Argent · 2 ans' },
  { id: '3', name: 'Écolo', icon: '🌿', unlocked: true, desc: 'Commun · 2 ans' },
  { id: '4', name: 'Guide', icon: '🧭', unlocked: true, desc: 'Or · Kit' },
  { id: '5', name: 'Boussole', icon: '🔵', unlocked: true, desc: 'Commun · Orienteur' },
  { id: '6', name: '6 h/jour', icon: '⏱️', unlocked: true, desc: 'Argent · Marcheur' },
  { id: '7', name: 'Verrouillé', icon: '🔒', unlocked: false, desc: '—' },
  { id: '8', name: 'Verrouillé', icon: '🔒', unlocked: false, desc: '—' },
  { id: '9', name: 'Verrouillé', icon: '🔒', unlocked: false, desc: '—' },
];

const MOCK_ADVENTURES = [
  { id: '1', title: 'Cabane du Grand Vaneau', destination: '3 nuits · Chartreuse · 27,4 km', cover_image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', cover_image_alt: 'Cabane en bois dans une forêt de pins brumeuse', start_date: '2026-08-14', created_at: '' },
  { id: '2', title: 'Bivouac étoilé · Vercors', destination: '2 nuits · Plateau haut · 18,6 km', cover_image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', cover_image_alt: 'Tente sous un ciel étoilé dans le Vercors', start_date: '2026-08-02', created_at: '' },
  { id: '3', title: 'Traversée des Écrins', destination: '6 jours · Alpes · 62 km', cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', cover_image_alt: 'Traversée des massifs des Écrins en été', start_date: '2026-07-01', created_at: '' },
  { id: '4', title: 'Kayak · Serre-Ponçon', destination: '1 jour · Hautes-Alpes · 14 km', cover_image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80', cover_image_alt: 'Kayak sur le lac de Serre-Ponçon', start_date: '2026-06-15', created_at: '' },
];

function WorldMapDots() {
  const dots = [
    { x: 48, y: 38, visited: true, label: 'France' },
    { x: 52, y: 32, visited: true, label: 'Norvège' },
    { x: 55, y: 42, visited: true, label: 'Italie' },
    { x: 60, y: 50, visited: true, label: 'Maroc' },
    { x: 72, y: 38, visited: true, label: 'Népal' },
    { x: 80, y: 42, visited: true, label: 'Japon' },
    { x: 25, y: 45, visited: false, label: 'Canada' },
    { x: 30, y: 60, visited: false, label: 'Pérou' },
    { x: 58, y: 55, visited: true, label: 'Tanzanie' },
    { x: 85, y: 70, visited: false, label: 'N.-Zélande' },
  ];
  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '100px' }}>
          <p style={{ textAlign: 'center', color: 'rgba(28,38,32,0.5)' }}>Vue disponible uniquement sur mobile</p>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100dvh', background: 'var(--background)' }}>
            <MobileProfilePage />
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
