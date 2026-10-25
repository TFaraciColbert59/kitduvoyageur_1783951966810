'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveAdventure } from '@/features/hub/context/ActiveAdventureContext';
import { HUB_POSSESSION_HREFS } from '@/features/hub/registry/hubSectionRegistry';

/** La fiche catalogue ouvre le même inventaire, quel que soit le voyage actif. */
export default function InventoryEntryButton({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { setActiveAdventure } = useActiveAdventure();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openInventory() {
    if (pending) return;
    if (!user) {
      const source = productSlug ? `/produit/${encodeURIComponent(productSlug)}` : '/boutique';
      router.push(`/connexion?next=${encodeURIComponent(source)}`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (!(await setActiveAdventure({ nature: 'possession' })))
        throw new Error('Impossible d’ouvrir votre inventaire. Réessayez.');
      router.push(`${HUB_POSSESSION_HREFS.inventaire}?product_id=${encodeURIComponent(productId)}`);
    } catch {
      setError('Impossible d’ouvrir votre inventaire. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        fullWidth
        loading={pending}
        disabled={pending}
        onClick={openInventory}
      >
        Gérer dans mon inventaire
      </Button>
      {error && (
        <p role="alert" className="text-sm text-[color:var(--lkv-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
