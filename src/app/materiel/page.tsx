import { MaterielGrid } from '@/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { DemoLoginButton } from '@/features/materiel/components/DemoLoginButton';

export const dynamic = 'force-dynamic';

export default async function MaterielPage() {
  const data = await getMaterielSummary();
  const isEmpty = data.kits.count === 0 && data.inventaire.count === 0;

  return (
    <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-center items-center px-1 sm:px-4 py-0 md:py-6">
      <div className="w-full max-w-[var(--page-max-w)] mx-auto flex flex-col justify-center h-full min-h-0 flex-1">
        <h1 className="sr-only">Mon Matériel</h1>
        {isEmpty && (
          <div className="flex justify-center mb-2 shrink-0">
            <DemoLoginButton />
          </div>
        )}
        <MaterielGrid data={data} />
      </div>
    </div>
  );
}