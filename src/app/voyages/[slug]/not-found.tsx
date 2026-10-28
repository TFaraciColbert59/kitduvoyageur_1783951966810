import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { EmptyState } from '@/components/ui';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export default function TripNotFound() {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          icon={<LKDVIcon name="boussole" size={40} className="text-[color:var(--lkv-secondary-ink)]" />}
          title="Voyage introuvable"
          description="Ce voyage n’existe pas, a été supprimé ou est privé. Si vous avez reçu un lien de partage, vérifiez qu’il est correct ou connectez-vous avec le compte invité."
          actionLabel="Retourner aux voyages"
          actionHref="/voyages"
        />
      </div>
    </AppShell>
  );
}
