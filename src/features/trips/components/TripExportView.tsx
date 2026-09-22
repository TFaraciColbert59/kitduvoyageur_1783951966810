'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import Link from 'next/link';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';
import { formatCivilDateRange } from '@/lib/dates/tripDates';
import { Button, Card } from '@/components/ui';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import { printActiveView } from '@/lib/native/print';

interface ExportClientViewProps {
  trip: TripFull;
  stats: TripStats | null;
  budgetSummary: BudgetSummary;
}

export default function ExportClientView({ trip, stats, budgetSummary }: ExportClientViewProps) {
  // Y3.5 : export via l'action dédiée (règle Y-D80 n°12) — pas de window.print en dur ici.
  const handlePrint = printActiveView;

  const stepsByDay = (trip.steps || []).reduce(
    (acc, step) => {
      if (!acc[step.day_number]) acc[step.day_number] = [];
      acc[step.day_number].push(step);
      return acc;
    },
    {} as Record<number, typeof trip.steps>
  );

  const sortedDays = Object.keys(stepsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const renderPrintContent = () => (
    <Card className="mx-auto max-w-4xl space-y-8 p-[var(--space-6)] print:space-y-6 print:rounded-none print:border-none print:p-0 print:shadow-none sm:p-[var(--space-8)]">
      {/* En-tete officiel */}
      <header className="border-b border-[color:var(--lkv-border)] pb-[var(--space-6)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 text-[length:var(--lkv-text-footnote)] font-semibold uppercase tracking-widest text-[color:var(--lkv-text-secondary)]">
              Le Kit du Voyageur &middot; Feuille de Route d'Expedition
            </div>
            <h2 className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
              {trip.title}
            </h2>
            {trip.description && (
              <p className="mt-[var(--space-2)] max-w-2xl text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                {trip.description}
              </p>
            )}
          </div>
          <div className="text-right text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
            <div>Edite le {new Date().toLocaleDateString('fr-FR')}</div>
            <div className="mt-1 font-mono text-[10px]">Ref : {trip.slug}</div>
          </div>
        </div>

        {/* Metriques cles */}
        <div className="mt-[var(--space-6)] grid grid-cols-2 gap-[var(--space-4)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-4)] sm:grid-cols-4">
          <div className="flex items-center gap-[var(--space-2)]">
            <Icon name="map-pin" size={16} className="text-[color:var(--lkv-secondary)]" />
            <div>
              <div className="text-[10px] uppercase text-[color:var(--lkv-text-muted)]">Destination</div>
              <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                {trip.destination_name || trip.destination_country_code || 'Non renseigne'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[var(--space-2)]">
            <Icon name="calendar" size={16} className="text-[color:var(--lkv-secondary)]" />
            <div>
              <div className="text-[10px] uppercase text-[color:var(--lkv-text-muted)]">Dates</div>
              <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                {formatCivilDateRange(trip.start_date, trip.end_date, undefined, 'fr-FR') ||
                  'Date libre'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[var(--space-2)]">
            <Icon name="users" size={16} className="text-[color:var(--lkv-secondary)]" />
            <div>
              <div className="text-[10px] uppercase text-[color:var(--lkv-text-muted)]">Equipe</div>
              <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                {trip.collaborators.length} voyageur{trip.collaborators.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[var(--space-2)]">
            <Icon name="shield" size={16} className="text-[color:var(--lkv-secondary)]" />
            <div>
              <div className="text-[10px] uppercase text-[color:var(--lkv-text-muted)]">
                Activite & Niveau
              </div>
              <div className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
                {trip.primary_activity} &middot; {trip.difficulty}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Section 1 : Itineraire Jour par Jour */}
      <section className="space-y-[var(--space-4)]">
        <h2 className="flex items-center gap-[var(--space-2)] border-b pb-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
          <span>1. Itineraire & Programme Quotidien</span>
          {stats && (
            <span className="text-[length:var(--lkv-text-footnote)] font-normal text-[color:var(--lkv-text-secondary)]">
              ({stats.total_days} jours &middot; {stats.total_distance_km} km &middot; +
              {stats.total_elevation_gain_m}m / -{stats.total_elevation_loss_m}m)
            </span>
          )}
        </h2>

        {sortedDays.length === 0 ? (
          <p className="text-[length:var(--lkv-text-footnote)] italic text-[color:var(--lkv-text-muted)]">
            Aucune etape enregistree.
          </p>
        ) : (
          <div className="space-y-[var(--space-4)]">
            {sortedDays.map((dayNum) => {
              const daySteps = stepsByDay[dayNum] || [];
              return (
                <div
                  key={dayNum}
                  className="page-break-inside-avoid rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] p-[var(--space-4)]"
                >
                  <div className="mb-[var(--space-2)] flex items-center justify-between text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                    <span>Jour {dayNum}</span>
                    <span className="text-[length:var(--lkv-text-footnote)] font-normal text-[color:var(--lkv-text-muted)]">
                      {daySteps.length} etape{daySteps.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-[var(--space-3)]">
                    {daySteps.map((step, idx) => (
                      <div
                        key={step.id}
                        className="border-l-2 border-[color:var(--lkv-secondary)] pl-[var(--space-3)] text-[length:var(--lkv-text-footnote)]"
                      >
                        <div className="font-semibold text-[color:var(--lkv-text-primary)]">
                          {idx + 1}. {step.title}
                        </div>
                        {step.description && (
                          <p className="mt-0.5 text-[color:var(--lkv-text-secondary)]">
                            {step.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-x-[var(--space-4)] gap-y-1 text-[11px] text-[color:var(--lkv-text-muted)]">
                          {step.distance_km && <span>Distance : {step.distance_km} km</span>}
                          {step.elevation_gain_m && <span>D+ : +{step.elevation_gain_m}m</span>}
                          {step.elevation_loss_m && <span>D- : -{step.elevation_loss_m}m</span>}
                          {step.accommodation_name && (
                            <span className="font-medium text-[color:var(--lkv-text-primary)]">
                              Hebergement : {step.accommodation_name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2 : Materiel & Check-list Sac a dos */}
      <section className="page-break-inside-avoid space-y-[var(--space-3)]">
        <h2 className="flex items-center justify-between border-b pb-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
          <span>2. Materiel & Check-list Sac a dos</span>
          <span className="text-[length:var(--lkv-text-footnote)] font-normal text-[color:var(--lkv-text-secondary)]">
            {trip.items.length} article{trip.items.length > 1 ? 's' : ''}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] sm:grid-cols-3">
          {trip.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-2)]"
            >
              <div className="flex h-3.5 w-3.5 items-center justify-center rounded-xs border border-[color:var(--lkv-border)]">
                {item.is_packed && <div className="h-2 w-2 bg-[color:var(--lkv-primary)]" />}
              </div>
              <div className="truncate">
                <span className="font-medium text-[color:var(--lkv-text-primary)]">
                  {item.item_name}
                </span>
                {item.quantity > 1 && (
                  <span className="text-[color:var(--lkv-text-muted)]"> (x{item.quantity})</span>
                )}
                {item.weight_grams && (
                  <span className="text-[10px] text-[color:var(--lkv-text-muted)]">
                    {' '}
                    &middot; {item.weight_grams}g
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 : Budget & Equilibre des Comptes */}
      {trip.permissions.canManageBudget && (
        <section className="page-break-inside-avoid space-y-[var(--space-3)]">
          <h2 className="flex items-center justify-between border-b pb-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
            <span>3. Synthese Budgetaire & Reglements</span>
            <span className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
              Total : {budgetSummary.totalSpent} {budgetSummary.currency}
            </span>
          </h2>

          <div className="grid grid-cols-1 gap-[var(--space-4)] text-[length:var(--lkv-text-footnote)] sm:grid-cols-2">
            <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] p-[var(--space-3)]">
              <div className="mb-[var(--space-2)] font-semibold text-[color:var(--lkv-text-secondary)]">
                Balances par membre
              </div>
              <div className="space-y-[var(--space-1)]">
                {budgetSummary.balances.map((b) => (
                  <div key={b.userId} className="flex items-center justify-between text-[11px]">
                    <span className="text-[color:var(--lkv-text-secondary)]">{b.name}</span>
                    <span
                      className={
                        b.net >= 0
                          ? 'font-medium text-[color:var(--lkv-success)]'
                          : 'font-medium text-[color:var(--lkv-danger)]'
                      }
                    >
                      {b.net >= 0 ? `+${b.net}` : b.net} {budgetSummary.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] p-[var(--space-3)]">
              <div className="mb-[var(--space-2)] font-semibold text-[color:var(--lkv-text-secondary)]">
                Reglements de compte
              </div>
              {budgetSummary.settlements.length === 0 ? (
                <p className="text-[11px] italic text-[color:var(--lkv-text-muted)]">
                  Tous les comptes sont equilibres.
                </p>
              ) : (
                <div className="space-y-[var(--space-1)]">
                  {budgetSummary.settlements.map((s, idx) => (
                    <div key={idx} className="text-[11px] text-[color:var(--lkv-text-primary)]">
                      <span className="font-medium">{s.fromName}</span> doit verser{' '}
                      <span className="font-bold text-[color:var(--lkv-text-primary)]">
                        {s.amount} {budgetSummary.currency}
                      </span>{' '}
                      a <span className="font-medium">{s.toName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 4 : Securite & Contacts d'urgence */}
      <footer className="page-break-inside-avoid flex flex-wrap justify-between gap-[var(--space-4)] border-t border-[color:var(--lkv-border)] pt-[var(--space-6)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
        <div>
          <div className="font-bold text-[color:var(--lkv-text-secondary)]">
            Securite & Numeros d'urgence
          </div>
          <div>Secours en montagne europeen : 112 &middot; SAMU : 15 &middot; Pompiers : 18</div>
        </div>
        <div className="text-right">
          <div>
            Genere par <strong>Le Kit du Voyageur</strong>
          </div>
          <div>https://lekitduvoyageur.fr</div>
        </div>
      </footer>
    </Card>
  );

  return (
    <>
      {/* Barre d'actions (le shell desktop/mobile est fourni par le layout) */}
      <Card className="flex items-center justify-between gap-[var(--space-3)] p-[var(--space-3)] print:hidden">
        <Link
          href={tripSectionHref(trip.slug, 'overview')}
          className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-primary)]"
        >
          <Icon name="arrow-left" size={13} />
          <span>Cockpit</span>
        </Link>
        <div className="flex items-center gap-[var(--space-2)]">
          <a
            href={`/api/voyages/${trip.slug}/gpx`}
            download={`${trip.slug}.gpx`}
            className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
          >
            <Icon name="download" size={12} />
            <span>GPX</span>
          </a>
          <Button size="sm" onClick={handlePrint} icon={<Icon name="printer" size={12} />}>
            PDF
          </Button>
        </div>
      </Card>
      <div className="mx-auto w-full max-w-4xl">{renderPrintContent()}</div>
    </>
  );
}
