import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { getWeather } from '@/features/materiel/services/getWeather';
import { getKits } from '@/features/materiel/services/getKits';
import { DepartCockpit } from './DepartCockpit';
import { createClient } from '@/lib/supabase/server';
import { DepartRoutePicker } from './DepartRoutePicker';
import { GlassCard } from '@/components/ui/GlassCard';
import { Compass } from 'lucide-react';
import Link from 'next/link';

interface Props {
  id: string;
  route?: string | null;
}

/**
 * DepartDataLoader — Server Component streamé via React Suspense.
 * Résout getDepartDetail + getWeather + getKits en parallèle,
 * puis rend soit le cockpit complet, soit l'onboarding (pas de kit).
 */
export async function DepartDataLoader({ id, route }: Props) {
  const depart = await getDepartDetail(id, route ?? null);

  if (!depart) {
    // Pas de kit : charger la liste des randonnées pour le picker
    const supabase = await createClient();
    const { data: routeRows } = await supabase
      .from('hiking_routes')
      .select('id, name')
      .not('name', 'is', null)
      .order('name')
      .limit(40);
    const routes = ((routeRows ?? []) as { id: number; name: string | null }[]).map((r) => ({
      id: r.id,
      name: r.name ?? 'Randonnée',
    }));

    return (
      <div className="flex-1 min-h-0 w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 pb-4 flex items-center justify-center">
        <GlassCard as="article" tone="sage" className="p-6 max-w-md w-full flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-white/70 border border-white flex items-center justify-center text-[#17402C]">
            <Compass size={22} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display font-bold text-[22px] leading-tight text-[#17402C]">Votre prochain départ</h2>
            <p className="text-sm text-[#5A7064]">
              Choisissez votre randonnée pour lancer sa préparation.
            </p>
          </div>
          <DepartRoutePicker routes={routes} />
          <p className="text-xs text-[#5A7064]">
            Déjà un kit assigné ?{' '}
            <Link href="/materiel" className="text-sage-600 font-medium hover:underline">
              Retour à Mon Matériel
            </Link>
          </p>
        </GlassCard>
      </div>
    );
  }

  // Fetches parallèles — weather + kits ne bloquent pas depart
  const [weather, kits] = await Promise.all([
    getWeather(depart.trail?.lat, depart.trail?.lng, depart.trail?.name),
    getKits(),
  ]);

  return (
    <div className="flex-1 min-h-0 w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 pb-2">
      <DepartCockpit depart={depart} weather={weather} kits={kits.map((k) => ({ id: k.id, name: k.name }))} />
    </div>
  );
}
