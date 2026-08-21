import { GearCardDepart } from '@/features/materiel/components/cards/GearCardDepart';
import { GearCardForget } from '@/features/materiel/components/cards/GearCardForget';
import { GearCardKits } from '@/features/materiel/components/cards/GearCardKits';
import { GearCardInventaire } from '@/features/materiel/components/cards/GearCardInventaire';
import { GearCardAlertes } from '@/features/materiel/components/cards/GearCardAlertes';
import { GearCardDispo } from '@/features/materiel/components/cards/GearCardDispo';
import { MaterielGrid } from '@/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import SpotlightTracker from '@/components/ui/SpotlightTracker';
import { DemoLoginButton } from '@/features/materiel/components/DemoLoginButton';

export const dynamic = 'force-dynamic';

export default async function MaterielPage() {
  const data = await getMaterielSummary();
  const isEmpty = data.kits.count === 0 && data.inventaire.count === 0;

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8">
      <h1 className="sr-only">Mon Matériel</h1>
      {isEmpty && (
        <div className="flex justify-center mb-6">
          <DemoLoginButton />
        </div>
      )}
      <MaterielGrid>
        <SpotlightTracker className="[grid-area:depart]"><GearCardDepart data={data.depart} className="spotlight h-full" /></SpotlightTracker>
        <SpotlightTracker className="[grid-area:forget]"><GearCardForget data={data.forget} className="spotlight h-full" /></SpotlightTracker>
        <SpotlightTracker className="[grid-area:kits]"><GearCardKits data={data.kits} className="spotlight h-full" /></SpotlightTracker>
        <SpotlightTracker className="[grid-area:inventaire]"><GearCardInventaire data={data.inventaire} className="spotlight h-full" /></SpotlightTracker>
        <SpotlightTracker className="[grid-area:alertes]"><GearCardAlertes data={data.alertes} className="spotlight h-full" /></SpotlightTracker>
        <SpotlightTracker className="[grid-area:dispo]"><GearCardDispo data={data.dispo} className="spotlight h-full" /></SpotlightTracker>
      </MaterielGrid>
    </main>
  );
}
