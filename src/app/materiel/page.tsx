import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Backpack,
  CalendarCheck,
  ChevronRight,
  Package,
  Plus,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppShell from '@/components/shell/AppShell';
import { Card, ListItem } from '@/components/ui';
import { CompteBackground } from '@/components/compte/CompteBackground';
import {
  getMaterielSummary,
  type MaterielSummary,
} from '@/features/materiel/services/getMaterielSummary';
import { hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';

export const metadata: Metadata = {
  title: 'Matériel — Le Kit du Voyageur',
  description:
    'Votre surface Matériel : kit actif, éléments à préparer, inventaire, kits, configurateur, prêts et boutique.',
};

// Surface dépendante de la session (cookie Supabase) : jamais prerendue.
export const dynamic = 'force-dynamic';

const HREFS = {
  inventaire: hubSectionHref({ nature: 'possession' }, 'inventaire'),
  kits: hubSectionHref({ nature: 'possession' }, 'kit'),
  disponibilite: hubSectionHref({ nature: 'possession' }, 'disponibilite'),
  alertes: hubSectionHref({ nature: 'possession' }, 'alertes'),
  oublis: hubSectionHref({ nature: 'possession' }, 'oublis'),
} as const;

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="compact" className="px-3 py-2">
      <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
        {label}
      </span>
      <span className="font-mono text-base font-extrabold tabular-nums text-[var(--lkv-text-primary)]">
        {value}
      </span>
    </Card>
  );
}

interface PrepRow {
  label: string;
  detail: string;
  href: string;
}

interface AccessLink {
  label: string;
  hint: string;
  href: string;
  Icon: typeof Package;
}

const ACCESS_LINKS: AccessLink[] = [
  {
    label: 'Inventaire',
    hint: 'Tout votre équipement et son état',
    href: HREFS.inventaire,
    Icon: Package,
  },
  {
    label: 'Kits',
    hint: 'Composez et réutilisez vos kits',
    href: HREFS.kits,
    Icon: Backpack,
  },
  {
    label: 'Configurateur',
    hint: 'Générez un kit adapté à votre sortie',
    href: '/ai-configurator',
    Icon: SlidersHorizontal,
  },
  {
    label: 'Prêts & réparations',
    hint: 'Disponibilité, prêts en cours et retours',
    href: HREFS.disponibilite,
    Icon: CalendarCheck,
  },
  {
    label: 'Boutique',
    hint: 'Compléter votre équipement',
    href: '/boutique',
    Icon: ShoppingBag,
  },
];

/**
 * Surface d'entrée Matériel (`/materiel`) — lecture serveur des agrégats réels
 * (`getMaterielSummary`). Zéro donnée inventée : chaque chiffre n'apparaît que
 * lorsqu'il est réellement renseigné, sinon l'état vide est explicite.
 */
function MaterielSurface({ summary }: { summary: MaterielSummary }) {
  const hasInventory = summary.inventaire.count > 0;
  const activeKit = summary.kits.topKits[0] ?? null;
  const hasActiveKit = summary.kits.count > 0 && activeKit !== null;
  const hasKitItems = summary.forget.totalItems > 0;

  const prepRows: PrepRow[] = [];
  if (summary.alertes.criticalCount > 0) {
    prepRows.push({
      label: plural(summary.alertes.criticalCount, 'alerte critique', 'alertes critiques'),
      detail: 'Équipement à vérifier avant de partir.',
      href: HREFS.alertes,
    });
  }
  if (summary.alertes.warningCount > 0) {
    prepRows.push({
      label: plural(summary.alertes.warningCount, 'vigilance', 'vigilances'),
      detail: 'Points à contrôler sans urgence.',
      href: HREFS.alertes,
    });
  }
  if (summary.forget.forgetRemaining > 0) {
    prepRows.push({
      label: plural(summary.forget.forgetRemaining, 'élément restant à cocher', 'éléments restants à cocher'),
      detail: 'Finalisez la checklist du kit actif.',
      href: HREFS.oublis,
    });
  }
  if (summary.dispo.unavailableCount > 0) {
    prepRows.push({
      label: plural(summary.dispo.unavailableCount, 'prêt en cours', 'prêts en cours'),
      detail: summary.dispo.nextReturnLabel ?? 'Suivez les retours de prêt.',
      href: HREFS.disponibilite,
    });
  }

  return (
    <div className="w-full space-y-5 font-sans text-[var(--lkv-text-primary)]">
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)]">
          Mon matériel
        </p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--lkv-text-primary)] sm:text-3xl">
          Matériel
        </h1>
        <p className="text-sm text-[var(--lkv-text-secondary)]">
          Kit actif, éléments à préparer et accès rapides.
        </p>
      </header>

      {/* ── Ajout d'équipement : action immédiatement visible ── */}
      <Link
        href={HREFS.inventaire}
        className="group flex min-h-[44px] items-center gap-3 rounded-3xl border border-[var(--lkv-forest-900)]/15 bg-[var(--lkv-forest-900)] p-4 text-sage-300 shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] active:scale-[0.99] motion-reduce:transition-none"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
          <Plus size={19} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">
            {hasInventory ? 'Ajouter un équipement' : 'Ajouter mon premier équipement'}
          </span>
          <span className="block text-xs text-white/70">
            {hasInventory
              ? 'Complétez votre inventaire en quelques secondes.'
              : 'Votre inventaire est vide — commencez par un objet.'}
          </span>
        </span>
        <ArrowRight size={17} className="shrink-0 text-white/80" aria-hidden="true" />
      </Link>

      {/* ── Kit actif ── */}
      <section
        aria-labelledby="materiel-kit-actif"
        className="glass rounded-3xl border border-white/70 p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="materiel-kit-actif"
            className="font-display text-base font-bold text-[var(--lkv-text-primary)]"
          >
            Kit actif
          </h2>
          <Link
            href={HREFS.kits}
            className="rounded-lg text-xs font-bold text-[var(--lkv-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
          >
            Tous les kits →
          </Link>
        </div>

        {hasActiveKit ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--lkv-text-primary)]">
                {activeKit.name}
              </p>
              <p className="text-xs text-[var(--lkv-text-secondary)]">
                {hasKitItems
                  ? `${summary.forget.checkedItems}/${summary.forget.totalItems} éléments cochés`
                  : 'Aucun élément dans ce kit'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatChip label="Poids" value={`${activeKit.weightKg.toFixed(1)} kg`} />
              {hasKitItems && (
                <StatChip label="Prêt" value={`${activeKit.completionPct} %`} />
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-white/80 bg-white/60 p-4 text-center">
            <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
              Aucun kit actif
            </p>
            <p className="mt-1 text-xs text-[var(--lkv-text-secondary)]">
              {hasInventory
                ? `Composez un kit depuis vos ${plural(summary.inventaire.count, 'équipement')}.`
                : 'Ajoutez d’abord un équipement, puis composez votre premier kit.'}
            </p>
            <Link
              href={hasInventory ? HREFS.kits : HREFS.inventaire}
              className="glass-capsule-btn primary mt-3 inline-flex !text-white !bg-[var(--lkv-primary)] hover:opacity-95 shadow-sm font-semibold text-xs px-4 py-2"
            >
              {hasInventory ? 'Créer un kit' : 'Ajouter mon premier équipement'}
            </Link>
          </div>
        )}
      </section>

      {/* ── Éléments à préparer ── */}
      <section
        aria-labelledby="materiel-a-preparer"
        className="glass rounded-3xl border border-white/70 p-4 shadow-sm sm:p-5"
      >
        <h2
          id="materiel-a-preparer"
          className="font-display text-base font-bold text-[var(--lkv-text-primary)]"
        >
          À préparer
        </h2>

        {prepRows.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {prepRows.map((row) => (
              <li key={row.label}>
                <Link
                  href={row.href}
                  className="block rounded-[var(--lkv-radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
                >
                  <ListItem
                    as="div"
                    leading={
                      <Shield
                        size={16}
                        className="shrink-0 text-[var(--lkv-warning-dark)]"
                        aria-hidden="true"
                      />
                    }
                    title={row.label}
                    subtitle={row.detail}
                    chevron
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--lkv-text-secondary)]">
            <Sparkles size={15} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />
            {hasInventory
              ? 'Rien à préparer pour l’instant : aucune alerte, checklist ou prêt en attente.'
              : 'Rien à préparer pour l’instant. Ajoutez un équipement pour activer le suivi.'}
          </p>
        )}

        {/* Chiffres réels uniquement : jamais d'état « bon » sur un inventaire vide. */}
        {hasInventory && (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatChip label="Équipements" value={String(summary.inventaire.count)} />
            <StatChip label="En bon état" value={`${summary.inventaire.goodConditionPct} %`} />
            <StatChip label="Fiabilité" value={`${summary.alertes.reliabilityScore} %`} />
          </div>
        )}
      </section>

      {/* ── Accès ── */}
      <nav aria-label="Accès matériel" className="space-y-3">
        <h2 className="font-display text-base font-bold text-[var(--lkv-text-primary)]">
          Accès
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACCESS_LINKS.map(({ label, hint, href, Icon }) => (
            <Link
              key={label}
              href={href}
              className="glass interactive flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/70 p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[var(--lkv-primary)]">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[var(--lkv-text-primary)]">
                  {label}
                </span>
                <span className="block text-xs text-[var(--lkv-text-secondary)]">{hint}</span>
              </span>
              <ChevronRight
                size={15}
                className="shrink-0 text-[var(--lkv-text-muted)]"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default async function MaterielPage() {
  const summary = await getMaterielSummary();

  return (
    <>
      {/* DESKTOP LAYOUT (>= 768px) */}
      <div className="relative hidden min-h-screen font-sans md:block">
        <CompteBackground />
        <Header />
        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-16 pt-24">
          <MaterielSurface summary={summary} />
        </div>
        <Footer />
      </div>

      {/* MOBILE LAYOUT (< 768px, iPhone 16 Pro priority) */}
      <div className="block md:hidden">
        <AppShell>
          <div className="relative px-3.5 pb-24 pt-4 font-sans">
            <MaterielSurface summary={summary} />
          </div>
        </AppShell>
      </div>
    </>
  );
}
