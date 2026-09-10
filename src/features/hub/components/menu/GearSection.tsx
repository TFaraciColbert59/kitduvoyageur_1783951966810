import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { TripKitSelector } from './TripKitSelector';
import { TripKitView } from '@/features/trips/components/TripKitView';
import { getKits } from '@/features/materiel/services/getKits';
import { getAlerts } from '@/features/materiel/services/getAlerts';
import { getLoans } from '@/features/materiel/services/getLoans';
import { getInventory } from '@/features/materiel/services/getInventory';
import { resolveGearImage } from '@/features/materiel/services/gearImageResolver';
import { GearMobileExperience } from '../mobile/gear/GearMobileExperience';
import { GearCarouselBlock } from '../mobile/gear/GearCarouselBlock';
import {
  buildGearCards,
  buildGearInfoCards,
  buildMemberResources,
  buildMissingRows,
  isSoloTrip,
} from '../../mobile/gearEngine';
import { hubSectionHref } from '../../registry/hubSectionRegistry';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { ShopProductReference, TripKitAnalysis } from '@/features/trips/types/kit.types';
import type { TripItemImage } from '../../server/getTripItemImages';

/**
 * H4.3 — Onglet « Équipement » d'une sortie : cockpit kit sélectionné
 * (persisté via trips.kit_id) + bandeau infos importantes + sac du voyage
 * (TripKitView inchangé). Aucun doublon de widget materiel : composition.
 * V7 — expérience mobile : carrousel photo, infos sac, ressources par membre
 * (packed_by) et panneau « ce qui manque » (purchase_state en BDD).
 */
export async function GearSection({
  trip,
  analysis,
  itemImages = [],
  availableProducts = [],
}: {
  trip: TripFull;
  analysis: TripKitAnalysis;
  itemImages?: TripItemImage[];
  availableProducts?: ShopProductReference[];
}) {
  const [allKits, alerts, loans, inventory] = await Promise.all([
    getKits(),
    getAlerts(),
    getLoans(),
    getInventory(),
  ]);

  // Utilisateur connecté : uniquement les vrais kits (les ids showcase ne
  // sont pas des UUID — jamais de vitrine pour un kit de sortie).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const realKits = allKits.filter((k) => !k.is_trashed && UUID_RE.test(k.id));

  // Ordre de repli : trip.kit_id → favori → plus récemment mis à jour
  // (getKits trie déjà par updated_at desc).
  const selectedKit =
    (trip.kit_id ? realKits.find((k) => k.id === trip.kit_id) : undefined) ??
    realKits.find((k) => k.is_favorite) ??
    realKits[0] ??
    null;

  const activeAlerts = alerts.length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
  const kitAtelierHref = hubSectionHref({ nature: 'possession' }, 'kit');
  const loansActive = loans.filter((l) => l.status === 'en_cours').length;
  const loansLate = loans.filter((l) => l.status === 'en_retard').length;
  const toReplace = inventory.filter((i) => i.condition === 'a_remplacer').length;
  const enCommande = selectedKit
    ? selectedKit.items.filter((i) => !i.product_ownership_id).length
    : 0;
  const completionPct = selectedKit?.item_count
    ? Math.round((selectedKit.checked_count / selectedKit.item_count) * 100)
    : 0;

  const gearCards = buildGearCards(trip, itemImages).map((card) => ({
    ...card,
    imageUrl: card.imageUrl ?? resolveGearImage(card.name, card.category),
  }));
  const gearInfoCards = buildGearInfoCards(analysis);
  const memberResources = buildMemberResources(trip);
  const missingRows = buildMissingRows(analysis, trip.items ?? [], itemImages, availableProducts);
  const solo = isSoloTrip(trip);

  return (
    <div className="space-y-4">
      <div className="hidden lg:block space-y-4">
      <GearCarouselBlock tripSlug={trip.slug} cards={gearCards} />
      <GlassCard className="rounded-2xl border border-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <Eyebrow>Kit sélectionné</Eyebrow>
          <TripKitSelector
            tripId={trip.id}
            kits={realKits.map((k) => ({ id: k.id, name: k.name }))}
            currentId={selectedKit?.id ?? null}
          />
        </div>

        {selectedKit ? (
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-xl text-[var(--lkv-text-primary)]">
                {selectedKit.name}
              </h2>
              {selectedKit.season && (
                <Badge tone="sage">{selectedKit.season}</Badge>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--lkv-text-secondary)]">
                <span>
                  {selectedKit.checked_count}/{selectedKit.item_count} articles prêts
                </span>
                <span className="tabular-nums">{completionPct}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Complétion du kit"
                aria-valuenow={completionPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1.5 h-2 w-full rounded-full bg-white/50 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-[var(--lkv-primary)] transition-[width] duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="glass-sub-card rounded-xl px-2 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">Poids</dt>
                <dd className="text-sm font-bold text-[var(--lkv-text-primary)]">
                  {formatWeight(selectedKit.total_weight_g)}
                </dd>
              </div>
              <div className="glass-sub-card rounded-xl px-2 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">Articles</dt>
                <dd className="text-sm font-bold text-[var(--lkv-text-primary)]">{selectedKit.item_count}</dd>
              </div>
              <div className="glass-sub-card rounded-xl px-2 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">En commande</dt>
                <dd className="text-sm font-bold text-[var(--lkv-text-primary)]">{enCommande}</dd>
              </div>
            </dl>

            <Link
              href={kitAtelierHref}
              className="inline-flex min-h-[44px] items-center px-3 -mx-1 text-xs font-semibold text-[var(--lkv-primary)] hover:bg-white/40 rounded-xl transition-colors"
            >
              Ouvrir l&apos;atelier kits
            </Link>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-[var(--lkv-text-muted)]">
              Aucun kit matériel lié à cette sortie. Composez-en un dans l&apos;atelier.
            </p>
            <Link
              href={kitAtelierHref}
              className="inline-flex min-h-[44px] items-center px-3 -mx-1 text-xs font-semibold text-[var(--lkv-primary)] hover:bg-white/40 rounded-xl transition-colors"
            >
              Créer un kit dans l&apos;atelier
            </Link>
          </div>
        )}
      </GlassCard>

      <section aria-label="Infos importantes" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Verre simple (pas de GlassCard) : la hauteur suit le contenu, les
            eyebrows ne sont plus rognés par overflow-hidden sous grid stretch. */}
        <article
          className={`glass rounded-2xl border border-white p-3 flex flex-col gap-1 items-start ${
            criticalAlerts > 0 ? 'tone-danger' : ''
          }`}
        >
          <Eyebrow>Alertes</Eyebrow>
          <p className="font-display font-semibold text-2xl tabular-nums text-[var(--lkv-text-primary)]">
            {activeAlerts}
          </p>
          {criticalAlerts > 0 && <Badge tone="danger">{criticalAlerts} critiques</Badge>}
        </article>

        <article
          className={`glass rounded-2xl border border-white p-3 flex flex-col gap-1 items-start ${
            loansLate > 0 ? 'tone-warn' : ''
          }`}
        >
          <Eyebrow>Prêts</Eyebrow>
          <p className="font-display font-semibold text-2xl tabular-nums text-[var(--lkv-text-primary)]">
            {loansActive}
          </p>
          {loansLate > 0 && <Badge tone="warn">{loansLate} en retard</Badge>}
        </article>

        <article
          className={`glass rounded-2xl border border-white p-3 flex flex-col gap-1 items-start ${
            toReplace > 0 ? 'tone-warn' : ''
          }`}
        >
          <Eyebrow>À remplacer</Eyebrow>
          <p className="font-display font-semibold text-2xl tabular-nums text-[var(--lkv-text-primary)]">
            {toReplace}
          </p>
          {toReplace > 0 && <Badge tone="warn">objets usés</Badge>}
        </article>

        <article className="glass rounded-2xl border border-white p-3 flex flex-col gap-1 items-start">
          <Eyebrow>Poids du sac</Eyebrow>
          <p className="font-display font-semibold text-2xl tabular-nums text-[var(--lkv-text-primary)]">
            {formatWeight(analysis.totalWeightGrams)}
          </p>
          <p className="text-xs text-[var(--lkv-text-muted)]">
            {analysis.packedItemsCount}/{analysis.totalItemsCount} emballés
          </p>
        </article>
      </section>
      </div>

      <div className="lg:hidden">
        <GearMobileExperience
          tripId={trip.id}
          tripSlug={trip.slug}
          cards={gearCards}
          infoCards={gearInfoCards}
          members={memberResources}
          missing={missingRows}
          isSolo={solo}
        />
      </div>

      <section aria-label="Sac du voyage" id="gear-full-list" className="scroll-mt-4">
        <TripKitView
          trip={trip}
          analysis={analysis}
          showBackLink={false}
          availableProducts={availableProducts}
          itemImages={itemImages}
          inventoryItems={inventory}
        />
      </section>
    </div>
  );
}

function formatWeight(g: number): string {
  if (!g || g <= 0) return '0 g';
  return g >= 1000
    ? `${(g / 1000).toFixed(1).replace('.', ',')} kg`
    : `${Math.round(g)} g`;
}

export default GearSection;
