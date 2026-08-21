import { MaterielGrid } from '@/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
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
      <MaterielGrid data={data} />
    </main>
  );
}