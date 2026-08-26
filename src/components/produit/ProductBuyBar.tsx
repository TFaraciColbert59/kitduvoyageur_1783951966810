'use client';

import React, { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ProductBuyBarProps {
  price: number;
  isOwned?: boolean;
  onAddToCart?: (qty: number) => void;
}

export default function ProductBuyBar({
  price,
  isOwned = false,
  onAddToCart,
}: ProductBuyBarProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { haptic } = useHapticFeedback();

  const handleAdd = () => {
    haptic('success');
    if (onAddToCart) {
      onAddToCart(qty);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        borderRadius: '22px',
        border: '1px solid rgba(23,64,44,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 30,
        margin: '0 10px 10px',
      }}
    >
      {/* Qty selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px',
          background: '#F1EDE6',
          borderRadius: '999px',
        }}
      >
        <button
          type="button"
          aria-label="Diminuer la quantité"
          onClick={() => {
            haptic('selection');
            setQty(Math.max(1, qty - 1));
          }}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '999px',
            background: '#FBFAF6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#17402C',
          }}
        >
          −
        </button>
        <span
          style={{
            minWidth: '18px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: '#17402C',
          }}
        >
          {qty}
        </span>
        <button
          type="button"
          aria-label="Augmenter la quantité"
          onClick={() => {
            haptic('selection');
            setQty(qty + 1);
          }}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '999px',
            background: '#FBFAF6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#17402C',
          }}
        >
          +
        </button>
      </div>

      {/* Add to cart button */}
      <button
        type="button"
        onClick={handleAdd}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        className={`glass-capsule-btn primary ${added ? '!bg-[#5B7F55] !text-white' : ''}`}
        style={{
          flex: 1,
          padding: '13px 18px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          transform: isPressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span>{added ? 'Ajouté ✓' : 'Ajouter au panier'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.9 }}>
          {(price * qty).toFixed(0)} €
        </span>
      </button>
    </div>
  );
}
