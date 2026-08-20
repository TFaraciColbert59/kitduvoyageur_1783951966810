import Link from 'next/link';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { GlassCard } from '@/components/ui/GlassCard';
import { ForgetChecklist } from '@/features/materiel/components/forget/ForgetChecklist';

export default function ForgetPage() {
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

      <ForgetChecklist />

      <GlassCard className="p-4 mt-4">
        <button className="w-full glass interactive h-12 rounded-full flex items-center justify-center text-sm font-medium text-white bg-sage-800">
          Valider la préparation
        </button>
      </GlassCard>
    </main>
  );
}
