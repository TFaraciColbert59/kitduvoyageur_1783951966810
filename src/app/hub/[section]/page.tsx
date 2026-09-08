import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getHubAdventureData, buildHubCounts } from '@/features/hub/server/getHubAdventureData';
import { deriveHubProfile } from '@/features/hub/engine/hubProfileEngine';
import {
  hubSectionHref,
  hubSectionRegistry,
} from '@/features/hub/registry/hubSectionRegistry';
import { HubInventaireSection } from '@/features/hub/components/possession/HubInventaireSection';
import { HubKitSection } from '@/features/hub/components/possession/HubKitSection';
import { HubPreparationSection } from '@/features/hub/components/possession/HubPreparationSection';
import { HubDepartSection } from '@/features/hub/components/possession/HubDepartSection';
import { HubDisponibiliteSection } from '@/features/hub/components/possession/HubDisponibiliteSection';
import { HubAlertesSection } from '@/features/hub/components/possession/HubAlertesSection';
import { HubOublisSection } from '@/features/hub/components/possession/HubOublisSection';
import { HubInvitationsSection } from '@/features/hub/components/collectif/HubInvitationsSection';
import { HubVoyagesLiesSection } from '@/features/hub/components/collectif/HubVoyagesLiesSection';

/**
 * H3.4/H4.2 — Section active du hub (URL-driven, registre).
 * Incompatible avec la nature → 404. Sortie → redirect 307 vers la page
 * voyage (composition, zéro re-rendu). Possession → composants canoniques
 * materiel (mêmes services). Collectif → H4.3.
 */
export default async function HubSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ id?: string; route?: string }>;
}) {
  const [{ section }, sp] = await Promise.all([params, searchParams]);
  const def = hubSectionRegistry.find((d) => d.segment === section);
  if (!def) notFound();

  const data = await getHubAdventureData();
  if (!def.natures.includes(data.adventure.nature)) notFound();

  if (data.adventure.nature === 'sortie' && data.trip) {
    redirect(hubSectionHref({ nature: 'sortie', slug: data.trip.slug }, def.id));
  }

  // Retour Tony (H-AUTO-40) : la section groupe renvoie vers l'ancienne page
  // déjà faite (/groupes, resp. /equipages) — composition, pas de re-rendu.
  if (def.id === 'groupe' && data.adventure.nature === 'collectif') {
    redirect(data.adventure.kind === 'equipage' ? '/equipages' : '/groupes');
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
      {def.id === 'inventaire' && <HubInventaireSection />}
      {def.id === 'kit' && <HubKitSection />}
      {def.id === 'preparation' && <HubPreparationSection />}
      {def.id === 'depart' && <HubDepartSection departId={sp.id} route={sp.route} />}
      {def.id === 'disponibilite' && <HubDisponibiliteSection />}
      {def.id === 'alertes' && <HubAlertesSection />}
      {def.id === 'oublis' && <HubOublisSection />}
      {def.id === 'invitations' && <HubInvitationsSection />}
      {def.id === 'voyages-lies' && data.adventure.nature === 'collectif' && (
        <HubVoyagesLiesSection adventure={data.adventure} crews={data.crews} />
      )}
    </div>
  );
}
