import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import Icon from '@/components/ui/Icon';
import { CompasScreen } from '@/features/compas/components/CompasScreen';
import { getCompasData } from '@/features/compas/server/getCompasData';
import '@/features/compas/compas.css';

/**
 * Compas — le préparateur ultime (maquette v8 validée), branché sur les
 * données réelles de l'aventure active du hub.
 *
 * Route dédiée tant que le Compas est en validation ; `/prepare` reste
 * inchangée et le remplacera une fois validé. Le rendu dépend de la session
 * (aventure active, inventaire) : jamais prérendu.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compas — Kit du Voyageur',
  description:
    'Où, quand, avec qui, quoi réserver et quoi emporter : tout le voyage au même endroit, sans score ni donnée inventée.',
};

export default async function CompasPage() {
  const data = await getCompasData();

  return (
    // Fond peint par `.cp-bg` (paysage éclairci de la maquette) : la toile
    // globale assombrie n'est pas rendue sur cette route.
    <AppShell hasBottomNav videoBackground={false}>
      {data ? (
        <CompasScreen data={data} />
      ) : (
        <div className="compas compas--empty">
          <div className="cp-bg" aria-hidden="true" />
          <section className="cp-empty cp-glass">
            <h1>Aucune aventure active</h1>
            <p className="cp-note">
              Le Compas rassemble ton parcours, ton équipe, tes réservations et ton matériel. Commence par préparer une
              activité : il se remplira tout seul.
            </p>
            <Link className="cp-btn cp-btn--pg" href="/prepare?nouvelle=1">
              <Icon name="compass" size={16} />
              Préparer une activité
            </Link>
          </section>
        </div>
      )}
    </AppShell>
  );
}
