import type { Metadata } from 'next';

import { Page, PageContent, PageHeader } from '@/design';

import { TrajectoireBoard } from '@/features/trajectoire/ui';

export const metadata: Metadata = {
  title: 'La Trajectoire Vivante — LKDV',
  description:
    'Une intention, une échelle, une aventure complète. Budget, dangerosité, fenêtre ' +
    'météo, plan, étapes, kit, traces et veille : tout se recalcule sans rien inventer.',
};

/**
 * /trajectoire — La Trajectoire Vivante.
 *
 * La page est un composant serveur : elle ne transporte aucun état. Le seul
 * état mutable (la position sur l'échelle logarithmique) vit dans l'île client
 * TrajectoireBoard, ce qui garde le HTML initial léger et le moteur pur.
 */
export default function TrajectoirePage() {
  return (
    <Page as="main" width="content" padded>
      <PageHeader
        title="La Trajectoire Vivante"
        subtitle="Une intention. Une échelle. Une aventure complète — toujours à jour."
        variant="large"
      />
      <PageContent>
        <TrajectoireBoard />
      </PageContent>
    </Page>
  );
}
