import { MaterielGrid } from '@/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { DemoLoginButton } from '@/features/materiel/components/DemoLoginButton';

export const dynamic = 'force-dynamic';

export default async function MaterielPage() {
  const data = await getMaterielSummary();
  const isEmpty = data.kits.count === 0 && data.inventaire.count === 0;

  return (
    <div className="h-[calc(100dvh-82px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] md:h-[calc(100dvh-88px)] overflow-hidden flex flex-col justify-center items-center w-full px-2.5 sm:px-4 pt-1 pb-1 md:py-6">
      <div className="w-full max-w-[var(--page-max-w)] mx-auto flex flex-col justify-center h-full">
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