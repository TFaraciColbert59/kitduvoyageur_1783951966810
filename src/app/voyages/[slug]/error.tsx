'use client';

import Icon from '@/components/ui/Icon';
import { GlassCapsuleBtn } from '@/components/ui';

export default function TripSectionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="glass border border-white/60 rounded-[var(--lkv-radius-card)] p-8 text-center space-y-3 max-w-xl mx-auto">
      <div className="glass-sub-card w-12 h-12 rounded-full text-[var(--lkv-danger)] flex items-center justify-center mx-auto border border-white/60 shadow-2xs">
        <Icon name="alert-triangle" size={22} />
      </div>
      <h2 className="text-lg font-bold text-[var(--lkv-text-primary)]">
        Cette section n'a pas pu être chargée
      </h2>
      <p className="text-sm text-[var(--lkv-text-secondary)]">
        Les autres sections du voyage restent accessibles depuis la navigation.
      </p>
      <GlassCapsuleBtn variant="primary" onClick={() => reset()} icon={<Icon name="rotate-ccw" size={16} />}>
        Réessayer
      </GlassCapsuleBtn>
    </div>
  );
}
