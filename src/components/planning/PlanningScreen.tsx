'use client';

import React, { useMemo } from 'react';
import { CloudSun, Share2, Route } from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import { Badge, Page, PageContent, PageHeader } from '@/components/ui';
import { PlanningWorkspace } from './PlanningWorkspace';
import { buildDemoPlanningData } from './sampleData';

/**
 * Écran /planification. Le composant de travail est réutilisable : cet écran
 * ne fait que fournir un jeu de tracés d'exemple et le bulletin météo
 * explicitement non configuré.
 */
export function PlanningScreen() {
  const data = useMemo(() => buildDemoPlanningData(), []);

  return (
    <AppShell>
      <Page width="content">
        <PageHeader
          title="Planification multi-jours"
          subtitle="Découper, ajuster, vérifier la météo et partager chaque étape."
          backHref="/explorer"
          backLabel="Explorer"
        />

        <PageContent spacing="lg" className="pt-[var(--space-3)]">
          <section
            aria-labelledby="planning-intro-title"
            className="g1 border border-[color:var(--glass-rim)] p-[var(--space-4)]"
          >
            <div className="flex flex-wrap items-center gap-[var(--space-2)]">
              <Badge tone="info">K1.13</Badge>
              <Badge tone="sage">K2.29–K2.32</Badge>
              <Badge tone="warn">Tracés d’exemple</Badge>
            </div>
            <h2
              id="planning-intro-title"
              className="mt-[var(--space-2)] text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]"
            >
              Une seule pile d’étapes, un fuseau explicite
            </h2>
            <p className="mt-[var(--space-1)] max-w-3xl text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-normal)] text-[color:var(--lkv-text-secondary)]">
              Recherchez un plan par pays, durée ou thème, corrigez les critères compris, puis
              ajustez les bornes ou ancrez un refuge. La météo n’affiche que ce que le fournisseur
              réel expose ; le partage applique le consentement et la politique P01.
            </p>
            <div className="mt-[var(--space-3)] grid gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)] sm:grid-cols-3">
              <p className="flex items-center gap-[var(--space-2)]">
                <Route aria-hidden="true" size={16} /> Étapes et révisions indépendantes
              </p>
              <p className="flex items-center gap-[var(--space-2)]">
                <CloudSun aria-hidden="true" size={16} /> Météo explicite, fenêtres calculées
              </p>
              <p className="flex items-center gap-[var(--space-2)]">
                <Share2 aria-hidden="true" size={16} /> Partage P01 fail-closed
              </p>
            </div>
          </section>

          <PlanningWorkspace
            initialPlans={data.plans}
            viewer={data.viewer}
            nowIso={data.nowIso}
            route={data.route}
            weatherFeed={data.weatherFeed}
            lodgings={data.lodgings}
          />
        </PageContent>
      </Page>
    </AppShell>
  );
}

export default PlanningScreen;
