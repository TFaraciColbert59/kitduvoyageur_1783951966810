'use client';

import React, { useState } from 'react';

interface ProductBuyBarProps {
  price: number;
  onAddToCart: (qty: number) => void;
}

export default function ProductBuyBar({ price, onAddToCart }: ProductBuyBarProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAddToCart(qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        borderRadius: '22px',
        border: '1px solid rgba(11,31,23,0.06)',
        boxShadow: '0 12px 30px rgba(11,31,23,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 3,
        margin: '0 12px 12px',
      }}
    >
      {/* Qty selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px',
          background: '#F4F1EA',
          borderRadius: '999px',
        }}
      >
        <button
          onClick={() => setQty(Math.max(1, qty - 1))}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '999px',
            background: '#FBFAF6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#0B1F17',
            fontFamily: 'inherit',
          }}
        >
          −
        </button>
        <span
          style={{
            minWidth: '20px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'ui-monospace, monospace',
            color: '#0B1F17',
          }}
        >
          {qty}
        </span>
        <button
          onClick={() => setQty(qty + 1)}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '999px',
            background: '#FBFAF6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#0B1F17',
            fontFamily: 'inherit',
          }}
        >
          +
        </button>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        style={{
          flex: 1,
          background: added ? '#2D6B4A' : '#17402C',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 200ms ease',
        }}
      >
        <span>{added ? 'Ajouté ✓' : 'Ajouter au panier'}</span>
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            opacity: 0.85,
          }}
        >
          {price.toFixed(0)} €
        </span>
      </button>
    </div>
  );
}
