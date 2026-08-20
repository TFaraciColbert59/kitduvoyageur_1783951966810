import Link from 'next/link';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { ForgetWorkspace } from '@/features/materiel/components/forget/ForgetWorkspace';
import { getForgetChecklist } from '@/features/materiel/services/getForgetChecklist';

export const dynamic = 'force-dynamic';

export default async function ForgetPage() {
  const items = await getForgetChecklist();

  return (
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">À ne pas oublier</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <ForgetWorkspace items={items} />
    </main>
  );
}
