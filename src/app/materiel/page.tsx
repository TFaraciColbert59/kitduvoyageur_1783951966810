import { GearCardDepart } from '@/features/materiel/components/cards/GearCardDepart';
import { GearCardForget } from '@/features/materiel/components/cards/GearCardForget';
import { GearCardKits } from '@/features/materiel/components/cards/GearCardKits';
import { GearCardInventaire } from '@/features/materiel/components/cards/GearCardInventaire';
import { GearCardAlertes } from '@/features/materiel/components/cards/GearCardAlertes';
import { GearCardDispo } from '@/features/materiel/components/cards/GearCardDispo';
import { MaterielGrid } from '@/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';

export const dynamic = 'force-dynamic';

export default async function MaterielPage() {
  const data = await getMaterielSummary();

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8">
      <h1 className="sr-only">Mon Matériel</h1>
      <MaterielGrid>
        <GearCardDepart data={data.depart} className="[grid-area:depart]" />
        <GearCardForget data={data.forget} className="[grid-area:forget]" />
        <GearCardKits data={data.kits} className="[grid-area:kits]" />
        <GearCardInventaire data={data.inventaire} className="[grid-area:inventaire]" />
        <GearCardAlertes data={data.alertes} className="[grid-area:alertes]" />
        <GearCardDispo data={data.dispo} className="[grid-area:dispo]" />
      </MaterielGrid>
    </main>
  );
}
