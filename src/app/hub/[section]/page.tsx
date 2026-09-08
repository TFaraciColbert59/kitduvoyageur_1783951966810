import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getHubAdventureData, buildHubCounts } from '@/features/hub/server/getHubAdventureData';
import { deriveHubProfile } from '@/features/hub/engine/hubProfileEngine';
import {
  hubSectionHref,
  hubSectionRegistry,
} from '@/features/hub/registry/hubSectionRegistry';

/**
 * H3.4 — Section active du hub (URL-driven, registre).
 * Incompatible avec la nature → 404. Sortie → redirect 307 vers la page
 * voyage (composition, zéro re-rendu). Possession/collectif → vue pilotée
 * registre (compteur + traçabilité), enrichie en H4.
 */
export default async function HubSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const def = hubSectionRegistry.find((d) => d.segment === section);
  if (!def) notFound();

  const data = await getHubAdventureData();
  if (!def.natures.includes(data.adventure.nature)) notFound();

  if (data.adventure.nature === 'sortie' && data.trip) {
    redirect(hubSectionHref({ nature: 'sortie', slug: data.trip.slug }, def.id));
  }

  const profile = deriveHubProfile(data.input, new Date());
  const counts = buildHubCounts(data);
  const count = def.counter(counts);
  const Icon = def.icon;

  return (
    <div className="space-y-4">
      <Link
        href="/hub"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Aperçu
      </Link>
      <header className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[var(--lkv-primary)] text-white flex items-center justify-center shrink-0">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)]">
            {def.label}
          </h1>
          {count !== null && (
            <p className="text-sm text-[var(--lkv-text-secondary)]">
              {count} élément(s)
            </p>
          )}
        </div>
      </header>
      <p className="text-xs text-[var(--lkv-text-secondary)]">
        {profile.reason[def.id]}
      </p>
      <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
        <p className="text-sm text-[var(--lkv-text-primary)]">
          {data.adventure.nature === 'possession'
            ? 'Le détail de cette section arrive en H4 — les 7 routes /materiel restent accessibles en attendant.'
            : 'Le détail de cette section arrive en H4 — la page /groupes reste accessible en attendant.'}
        </p>
      </div>
    </div>
  );
}
