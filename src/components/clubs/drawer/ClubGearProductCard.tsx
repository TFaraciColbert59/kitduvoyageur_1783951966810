'use client';

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { ClubStaggerCard } from './ClubDrawerMotion';
import type { ClubGearVaultItem } from './ClubDrawerTypes';

export function resolveGearProductImage(name: string, category: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  const hay = `${name} ${category}`.toLowerCase();
  if (hay.includes('tente') || hay.includes('bivouac') || hay.includes('abri')) {
    return '/assets/images/product-tent.jpg';
  }
  if (hay.includes('duvet') || hay.includes('couchage') || hay.includes('matelas')) {
    return '/assets/images/product-sleeping.jpg';
  }
  if (hay.includes('rechaud') || hay.includes('réchaud') || hay.includes('cuisine') || hay.includes('jetboil')) {
    return '/assets/images/gear-stove.jpg';
  }
  if (hay.includes('frontale') || hay.includes('eclairage') || hay.includes('éclairage') || hay.includes('lampe')) {
    return '/assets/images/product-headlamp.jpg';
  }
  if (hay.includes('crampon') || hay.includes('chaussure') || hay.includes('piolet') || hay.includes('baton') || hay.includes('bâton')) {
    return '/assets/images/gear-boots.jpg';
  }
  if (hay.includes('veste') || hay.includes('doudoune') || hay.includes('textile')) {
    return '/assets/images/product-jacket.jpg';
  }
  if (hay.includes('gourde') || hay.includes('hydrat')) {
    return '/assets/images/product-bottle.jpg';
  }
  return '/assets/images/product-backpack.jpg';
}

export interface ClubGearProductCardProps {
  gear: ClubGearVaultItem;
  onClick?: () => void;
  actionSlot?: React.ReactNode;
}

/**
 * Carte Produit / Équipement canonique LKDV (utilisée dans le Coffre, la Fiche Sortie et les Kits).
 * Toujours rendue dans une grille 2 colonnes (`repeat(2, minmax(0, 1fr))`, `gap: 10`).
 */
export function ClubGearProductCard({ gear: g, onClick, actionSlot }: ClubGearProductCardProps) {
  const isClubOwned = g.ownershipScope === 'club';
  const qtyAvail = g.quantityAvailable ?? (g.available ? 1 : 0);
  const qtyTotal = g.quantityTotal ?? 1;
  const depositEur = g.depositCents ? Math.round(g.depositCents / 100) : 0;
  const weightLabel =
    g.weightG >= 1000
      ? `${(g.weightG / 1000).toFixed(1).replace('.', ',')} kg`
      : `${g.weightG} g`;
  const conditionLabel =
    g.conditionStatus === 'new'
      ? 'Neuf'
      : g.conditionStatus === 'worn'
        ? 'Usé'
        : g.conditionStatus === 'repair'
          ? 'À réparer'
          : g.condition || 'Bon état';

  let epiState: 'ok' | 'warn' | 'expired' | null = null;
  if (g.isEpi) {
    if (g.epiExpiresAt) {
      const expMs = Date.parse(g.epiExpiresAt);
      const daysLeft = Number.isFinite(expMs) ? (expMs - Date.now()) / 86_400_000 : 999;
      epiState = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'warn' : 'ok';
    } else {
      epiState = 'ok';
    }
  }

  return (
    <ClubStaggerCard
      className="club-glass-card"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        padding: 8,
        gap: 7,
        borderRadius: 18,
        minWidth: 0,
      }}
      onClick={onClick}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 0.85',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(23, 64, 44, 0.06)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveGearProductImage(g.name, g.category, g.imageUrl)}
          alt={g.name}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        <span
          className={g.reservedByMe || (isClubOwned && qtyAvail > 0) ? 'club-badge-sage' : 'club-badge-soft'}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            fontSize: 9.5,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {g.reservedByMe
            ? 'Demandé ✓'
            : isClubOwned || qtyTotal > 1
              ? `${qtyAvail}/${qtyTotal} dispo`
              : g.available
                ? 'Disponible'
                : 'Prêté'}
        </span>
      </div>

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <b
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: 12.5,
            lineHeight: 1.2,
            color: 'var(--label)',
          }}
        >
          {g.name}
        </b>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--label2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {weightLabel} · {conditionLabel}
        </div>
        {epiState || depositEur > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 1 }}>
            {epiState ? (
              <span
                className="club-badge-soft"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 9.5,
                  color:
                    epiState === 'expired'
                      ? '#b91c1c'
                      : epiState === 'warn'
                        ? '#c2410c'
                        : '#17402c',
                  background:
                    epiState === 'expired'
                      ? 'rgba(185, 28, 28, 0.10)'
                      : epiState === 'warn'
                        ? 'rgba(194, 65, 12, 0.12)'
                        : undefined,
                }}
              >
                {epiState === 'ok' ? (
                  <ShieldCheck size={10} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={10} aria-hidden="true" />
                )}
                EPI
              </span>
            ) : null}
            {depositEur > 0 ? (
              <span className="club-badge-soft" style={{ fontSize: 9.5 }}>
                {depositEur} €
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {actionSlot ? (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
          {actionSlot}
        </div>
      ) : null}
    </ClubStaggerCard>
  );
}
