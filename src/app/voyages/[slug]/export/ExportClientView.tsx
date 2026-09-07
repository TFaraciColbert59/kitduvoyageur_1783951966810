'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, MapPin, Calendar, Users, Shield, FileText } from 'lucide-react';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';
import { formatCivilDateRange } from '@/lib/dates/tripDates';
import { GlassSubCard, GlassCapsuleBtn } from '@/components/ui';
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

  const stepsByDay = (trip.steps || []).reduce((acc, step) => {
    if (!acc[step.day_number]) acc[step.day_number] = [];
    acc[step.day_number].push(step);
    return acc;
  }, {} as Record<number, typeof trip.steps>);

  const sortedDays = Object.keys(stepsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const renderPrintContent = () => (
    <div className="bg-white rounded-[var(--lkv-radius-card)] p-6 sm:p-8 shadow-sm border border-white/60 print:p-0 print:border-none print:shadow-none print:rounded-none max-w-4xl mx-auto space-y-8 print:space-y-6">
      {/* En-tete officiel */}
      <header className="border-b border-white/60 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs uppercase tracking-widest text-lkv-secondary font-semibold mb-1">
              Le Kit du Voyageur &middot; Feuille de Route d'Expedition
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-lkv-primary">{trip.title}</h1>
            {trip.description && (
              <p className="text-sm text-[var(--lkv-text-secondary)] mt-2 max-w-2xl">{trip.description}</p>
            )}
          </div>
          <div className="text-right text-xs text-[var(--lkv-text-muted)]">
            <div>Edite le {new Date().toLocaleDateString('fr-FR')}</div>
            <div className="font-mono mt-1 text-[10px]">Ref : {trip.slug}</div>
          </div>
        </div>

        {/* Metriques cles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-white/40">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-lkv-secondary" />
            <div>
              <div className="text-[10px] text-[var(--lkv-text-muted)] uppercase">Destination</div>
              <div className="text-sm font-semibold text-lkv-primary">
                {trip.destination_name || trip.destination_country_code || 'Non renseigne'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-lkv-secondary" />
            <div>
              <div className="text-[10px] text-[var(--lkv-text-muted)] uppercase">Dates</div>
              <div className="text-sm font-semibold text-lkv-primary">
                {formatCivilDateRange(trip.start_date, trip.end_date, undefined, 'fr-FR') || 'Date libre'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users size={16} className="text-lkv-secondary" />
            <div>
              <div className="text-[10px] text-[var(--lkv-text-muted)] uppercase">Equipe</div>
              <div className="text-sm font-semibold text-lkv-primary">
                {trip.collaborators.length} voyageur{trip.collaborators.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Shield size={16} className="text-lkv-secondary" />
            <div>
              <div className="text-[10px] text-[var(--lkv-text-muted)] uppercase">Activite & Niveau</div>
              <div className="text-sm font-semibold text-lkv-primary">
                {trip.primary_activity} &middot; {trip.difficulty}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Section 1 : Itineraire Jour par Jour */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-lkv-primary border-b pb-2 flex items-center gap-2">
          <span>1. Itineraire & Programme Quotidien</span>
          {stats && (
            <span className="text-xs font-normal text-lkv-secondary">
              ({stats.total_days} jours &middot; {stats.total_distance_km} km &middot; +{stats.total_elevation_gain_m}m / -{stats.total_elevation_loss_m}m)
            </span>
          )}
        </h2>

        {sortedDays.length === 0 ? (
          <p className="text-sm text-[var(--lkv-text-muted)] italic">Aucune etape enregistree.</p>
        ) : (
          <div className="space-y-4">
            {sortedDays.map(dayNum => {
              const daySteps = stepsByDay[dayNum] || [];
              return (
                <div key={dayNum} className="border border-white/60 rounded-xl p-4 page-break-inside-avoid">
                  <div className="font-bold text-sm text-lkv-primary mb-2 flex items-center justify-between">
                    <span>Jour {dayNum}</span>
                    <span className="text-xs text-[var(--lkv-text-muted)] font-normal">
                      {daySteps.length} etape{daySteps.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {daySteps.map((step, idx) => (
                      <div key={step.id} className="text-xs pl-3 border-l-2 border-lkv-secondary">
                        <div className="font-semibold text-[var(--lkv-text-primary)]">
                          {idx + 1}. {step.title}
                        </div>
                        {step.description && (
                          <p className="text-[var(--lkv-text-secondary)] mt-0.5">{step.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--lkv-text-muted)] mt-1 text-[11px]">
                          {step.distance_km && <span>Distance : {step.distance_km} km</span>}
                          {step.elevation_gain_m && <span>D+ : +{step.elevation_gain_m}m</span>}
                          {step.elevation_loss_m && <span>D- : -{step.elevation_loss_m}m</span>}
                          {step.accommodation_name && (
                            <span className="font-medium text-lkv-primary">
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
      <section className="space-y-3 page-break-inside-avoid">
        <h2 className="text-lg font-bold text-lkv-primary border-b pb-2 flex items-center justify-between">
          <span>2. Materiel & Check-list Sac a dos</span>
          <span className="text-xs font-normal text-lkv-secondary">
            {trip.items.length} article{trip.items.length > 1 ? 's' : ''}
          </span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {trip.items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg border border-white/40 bg-white/40"
            >
              <div className="w-3.5 h-3.5 border border-white rounded-sm flex items-center justify-center">
                {item.is_packed && <div className="w-2 h-2 bg-lkv-primary rounded-2xs" />}
              </div>
              <div className="truncate">
                <span className="font-medium text-[var(--lkv-text-primary)]">{item.item_name}</span>
                {item.quantity > 1 && <span className="text-[var(--lkv-text-muted)]"> (x{item.quantity})</span>}
                {item.weight_grams && (
                  <span className="text-[var(--lkv-text-muted)] text-[10px]"> &middot; {item.weight_grams}g</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 : Budget & Equilibre des Comptes */}
      <section className="space-y-3 page-break-inside-avoid">
        <h2 className="text-lg font-bold text-lkv-primary border-b pb-2 flex items-center justify-between">
          <span>3. Synthese Budgetaire & Reglements</span>
          <span className="text-xs font-semibold text-lkv-primary">
            Total : {budgetSummary.totalSpent} {budgetSummary.currency}
          </span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="border border-white/60 rounded-xl p-3">
            <div className="font-semibold text-[var(--lkv-text-secondary)] mb-2">Balances par membre</div>
            <div className="space-y-1.5">
              {budgetSummary.balances.map(b => (
                <div key={b.userId} className="flex justify-between items-center text-[11px]">
                  <span className="text-[var(--lkv-text-secondary)]">{b.name}</span>
                  <span className={b.net >= 0 ? 'text-[var(--lkv-success)] font-medium' : 'text-[var(--lkv-danger)] font-medium'}>
                    {b.net >= 0 ? `+${b.net}` : b.net} {budgetSummary.currency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/60 rounded-xl p-3">
            <div className="font-semibold text-[var(--lkv-text-secondary)] mb-2">Reglements de compte</div>
            {budgetSummary.settlements.length === 0 ? (
              <p className="text-[var(--lkv-text-muted)] italic text-[11px]">Tous les comptes sont equilibres.</p>
            ) : (
              <div className="space-y-1.5">
                {budgetSummary.settlements.map((s, idx) => (
                  <div key={idx} className="text-[11px] text-[var(--lkv-text-primary)]">
                    <span className="font-medium">{s.fromName}</span> doit verser{' '}
                    <span className="font-bold text-lkv-primary">
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

      {/* Section 4 : Securite & Contacts d'urgence */}
      <footer className="pt-6 border-t border-white/60 text-xs text-[var(--lkv-text-muted)] flex flex-wrap justify-between gap-4 page-break-inside-avoid">
        <div>
          <div className="font-bold text-[var(--lkv-text-secondary)]">Securite & Numeros d'urgence</div>
          <div>Secours en montagne europeen : 112 &middot; SAMU : 15 &middot; Pompiers : 18</div>
        </div>
        <div className="text-right">
          <div>Genere par <strong>Le Kit du Voyageur</strong></div>
          <div>https://lekitduvoyageur.fr</div>
        </div>
      </footer>
    </div>
  );

  const renderSidebarLeft = () => (
    <div className="h-full max-h-full w-full flex flex-col gap-3 glass rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-y-auto no-scrollbar border border-white/40 shadow-sm select-none print:hidden">
      <div className="shrink-0 space-y-2.5">
        <nav aria-label="Retour" className="text-xs">
          <Link
            href={tripSectionHref(trip.slug, 'overview')}
            className="inline-flex items-center gap-1.5 font-medium hover:underline text-[var(--lkv-text-primary)]"
          >
            <ArrowLeft size={13} />
            <span>Retour au cockpit</span>
          </Link>
        </nav>
        <GlassSubCard className="p-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[var(--lkv-text-secondary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)]">
                Export &amp; PDF
              </p>
              <h4 className="font-display font-bold text-xs text-[var(--lkv-text-primary)] truncate mt-0.5">
                {trip.title}
              </h4>
            </div>
          </div>
        </GlassSubCard>
      </div>

      <div className="space-y-1.5">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] px-2 mb-1">
          Actions
        </p>
        <a
          href={`/api/voyages/${trip.slug}/gpx`}
          download={`${trip.slug}.gpx`}
          className="glass-capsule-btn w-full justify-start flex items-center gap-1.5"
        >
          <Download size={13} />
          <span>Telecharger GPX</span>
        </a>
        <GlassCapsuleBtn
          variant="primary"
          size="sm"
          onClick={handlePrint}
          icon={<Printer size={13} />}
          className="w-full justify-start"
        >
          Imprimer / PDF
        </GlassCapsuleBtn>
      </div>

      <div className="mt-auto pt-2 border-t border-[var(--lkv-border-subtle)]">
        <span className="text-[8.5px] font-mono text-[var(--lkv-text-secondary)] tracking-wider uppercase">
          LKDV Feuille de Route
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Barre d'actions (le shell desktop/mobile est fourni par le layout) */}
      <div className="glass border border-white/60 rounded-[var(--lkv-radius-card)] p-3 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={tripSectionHref(trip.slug, 'overview')}
          className="text-xs font-medium text-[var(--lkv-text-primary)] flex items-center gap-1"
        >
          <ArrowLeft size={13} />
          <span>Cockpit</span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/voyages/${trip.slug}/gpx`}
            download={`${trip.slug}.gpx`}
            className="glass-capsule-btn flex items-center gap-1.5"
          >
            <Download size={12} />
            <span>GPX</span>
          </a>
          <GlassCapsuleBtn variant="primary" size="xs" onClick={handlePrint} icon={<Printer size={12} />}>
            PDF
          </GlassCapsuleBtn>
        </div>
      </div>
      <div className="max-w-4xl w-full mx-auto">{renderPrintContent()}</div>
    </>
  );
}