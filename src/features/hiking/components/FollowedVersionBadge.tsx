'use client';

import { followedVersionLabel, type ActivityHandoff } from '@/features/route-collab/depart/activityHandoff';

/**
 * 9.8 : « Version vN suivie ». La passation laissée par l'itinéraire (« Démarrer l'activité ») dit quelle version
 * publiée la sortie suit et combien d'objets du sac sont emportés ; elle est jointe à l'enregistrement de la sortie.
 * Rien n'est affiché sans passation.
 */
export default function FollowedVersionBadge({ handoff }: { handoff: ActivityHandoff | null }) {
  const label = followedVersionLabel(handoff);
  if (!label) return null;
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-[color:var(--glass-bg-medium)] saturate-[var(--glass-sat)] backdrop-blur-[var(--glass-blur-sm)] border border-[color:var(--lkv-forest-200)]/40 font-mono text-[10px] tracking-[0.1em] uppercase text-[color:var(--lkv-text-primary)] select-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      role="status"
      data-testid="followed-version-badge"
    >
      {label}
    </div>
  );
}
