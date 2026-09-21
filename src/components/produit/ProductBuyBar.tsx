'use client';

import React, { useState } from 'react';
import { Button, Card, IconButton } from '@/components/ui';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ProductBuyBarProps {
  price: number;
  isOwned?: boolean;
  onAddToCart?: (qty: number) => void;
}

export default function ProductBuyBar({ price, onAddToCart }: ProductBuyBarProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
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
    <Card
      variant="featured"
      className="sticky bottom-0 z-[var(--z-sticky)] mx-[var(--space-2)] mb-[var(--space-2)] flex items-center gap-[var(--space-2)] p-[var(--space-2)]"
    >
      <div className="flex items-center gap-[var(--space-1)] rounded-full bg-[color:var(--lkv-surface-muted)] p-[var(--space-1)]">
        <IconButton
          variant="ghost"
          aria-label="Diminuer la quantité"
          onClick={() => {
            haptic('selection');
            setQty(Math.max(1, qty - 1));
          }}
        >
          <Icon name="MinusIcon" size={14} />
        </IconButton>
        <span
          aria-live="polite"
          className="min-w-[18px] text-center font-mono text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]"
        >
          {qty}
        </span>
        <IconButton
          variant="ghost"
          aria-label="Augmenter la quantité"
          onClick={() => {
            haptic('selection');
            setQty(qty + 1);
          }}
        >
          <Icon name="PlusIcon" size={14} />
        </IconButton>
      </div>

      <Button
        variant="primary"
        size="md"
        className="flex-1 justify-between"
        onClick={handleAdd}
      >
        <span>{added ? 'Ajouté' : 'Ajouter au panier'}</span>
        <span className="font-mono font-bold">{(price * qty).toFixed(0)} €</span>
      </Button>
    </Card>
  );
}
