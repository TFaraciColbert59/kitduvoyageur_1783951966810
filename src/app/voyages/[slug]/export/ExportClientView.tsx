'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, MapPin, Calendar, Users, Shield, CheckSquare } from 'lucide-react';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';

interface ExportClientViewProps {
  trip: TripFull;
  stats: TripStats | null;
  budgetSummary: BudgetSummary;
}

export default function ExportClientView({ trip, stats, budgetSummary }: ExportClientViewProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const stepsByDay = (trip.steps || []).reduce((acc, step) => {
    if (!acc[step.day_number]) acc[step.day_number] = [];
    acc[step.day_number].push(step);
    return acc;
  }, {} as Record<number, typeof trip.steps>);

  const sortedDays = Object.keys(stepsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-4 sm:p-8 print:p-0">
      {/* Barre d'action supérieure - masquée à l'impression */}
      <div className="max-w-4xl mx-auto mb-8 print:hidden flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#17402C]/10">
        <Link
          href={`/voyages/${trip.slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#17402C] hover:text-[#5B7F55] transition-colors"
        >
          <ArrowLeft size={16} />
          Retour au cockpit du voyage
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={`/api/voyages/${trip.slug}/gpx`}
            download={`${trip.slug}.gpx`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#17402C]/20 text-[#17402C] text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={15} />
            Télécharger GPX
          </a>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17402C] text-white text-xs font-semibold hover:bg-[#123323] transition-all shadow-md"
          >
            <Printer size={15} />
            Imprimer / Exporter PDF
          </button>
        </div>
      </div>

      {/* Feuille de route imprimable */}
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-6">
        {/* En-tête officiel */}
        <header className="border-b border-gray-200 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#5B7F55] font-semibold mb-1">
                Le Kit du Voyageur · Feuille de Route d'Expédition
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#17402C]">{trip.title}</h1>
              {trip.description && (
                <p className="text-sm text-gray-600 mt-2 max-w-2xl">{trip.description}</p>
              )}
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>Édité le {new Date().toLocaleDateString('fr-FR')}</div>
              <div className="font-mono mt-1 text-[10px]">Réf : {trip.slug}</div>
            </div>
          </div>

          {/* Métriques clés */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#5B7F55]" />
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Destination</div>
                <div className="text-sm font-semibold text-[#17402C]">
                  {trip.destination_name || trip.destination_country_code || 'Non renseigné'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#5B7F55]" />
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Dates</div>
                <div className="text-sm font-semibold text-[#17402C]">
                  {trip.start_date ? new Date(trip.start_date).toLocaleDateString('fr-FR') : 'Date libre'}
                  {trip.end_date ? ` au ${new Date(trip.end_date).toLocaleDateString('fr-FR')}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#5B7F55]" />
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Équipe</div>
                <div className="text-sm font-semibold text-[#17402C]">
                  {trip.collaborators.length} voyageur{trip.collaborators.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#5B7F55]" />
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Activité & Niveau</div>
                <div className="text-sm font-semibold text-[#17402C]">
                  {trip.primary_activity} · {trip.difficulty}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Section 1 : Itinéraire Jour par Jour */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#17402C] border-b pb-2 flex items-center gap-2">
            <span>1. Itinéraire & Programme Quotidien</span>
            {stats && (
              <span className="text-xs font-normal text-[#5B7F55]">
                ({stats.total_days} jours · {stats.total_distance_km} km · +{stats.total_elevation_gain_m}m / -{stats.total_elevation_loss_m}m)
              </span>
            )}
          </h2>

          {sortedDays.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucune étape enregistrée.</p>
          ) : (
            <div className="space-y-4">
              {sortedDays.map(dayNum => {
                const daySteps = stepsByDay[dayNum] || [];
                return (
                  <div key={dayNum} className="border border-gray-200 rounded-xl p-4 page-break-inside-avoid">
                    <div className="font-bold text-sm text-[#17402C] mb-2 flex items-center justify-between">
                      <span>Jour {dayNum}</span>
                      <span className="text-xs text-gray-500 font-normal">
                        {daySteps.length} étape{daySteps.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {daySteps.map((step, idx) => (
                        <div key={step.id} className="text-xs pl-3 border-l-2 border-[#5B7F55]">
                          <div className="font-semibold text-gray-900">
                            {idx + 1}. {step.title}
                          </div>
                          {step.description && (
                            <p className="text-gray-600 mt-0.5">{step.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 mt-1 text-[11px]">
                            {step.distance_km && <span>Distance : {step.distance_km} km</span>}
                            {step.elevation_gain_m && <span>D+ : +{step.elevation_gain_m}m</span>}
                            {step.elevation_loss_m && <span>D- : -{step.elevation_loss_m}m</span>}
                            {step.accommodation_name && (
                              <span className="font-medium text-[#17402C]">
                                Hébergement : {step.accommodation_name}
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

        {/* Section 2 : Matériel & Check-list Sac à dos */}
        <section className="space-y-3 page-break-inside-avoid">
          <h2 className="text-lg font-bold text-[#17402C] border-b pb-2 flex items-center justify-between">
            <span>2. Matériel & Check-list Sac à dos</span>
            <span className="text-xs font-normal text-[#5B7F55]">
              {trip.items.length} article{trip.items.length > 1 ? 's' : ''}
            </span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {trip.items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50"
              >
                <div className="w-3.5 h-3.5 border border-gray-400 rounded-sm flex items-center justify-center">
                  {item.is_packed && <div className="w-2 h-2 bg-[#17402C] rounded-2xs" />}
                </div>
                <div className="truncate">
                  <span className="font-medium text-gray-800">{item.item_name}</span>
                  {item.quantity > 1 && <span className="text-gray-500"> (x{item.quantity})</span>}
                  {item.weight_grams && (
                    <span className="text-gray-400 text-[10px]"> · {item.weight_grams}g</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 : Budget & Équilibre des Comptes */}
        <section className="space-y-3 page-break-inside-avoid">
          <h2 className="text-lg font-bold text-[#17402C] border-b pb-2 flex items-center justify-between">
            <span>3. Synthèse Budgétaire & Règlements</span>
            <span className="text-xs font-semibold text-[#17402C]">
              Total : {budgetSummary.totalSpent} {budgetSummary.currency}
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Balances individuelles */}
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="font-semibold text-gray-700 mb-2">Balances par membre</div>
              <div className="space-y-1.5">
                {budgetSummary.balances.map(b => (
                  <div key={b.userId} className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-700">{b.name}</span>
                    <span className={b.net >= 0 ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
                      {b.net >= 0 ? `+${b.net}` : b.net} {budgetSummary.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Règlements suggérés */}
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="font-semibold text-gray-700 mb-2">Règlements de compte</div>
              {budgetSummary.settlements.length === 0 ? (
                <p className="text-gray-500 italic text-[11px]">Tous les comptes sont équilibrés.</p>
              ) : (
                <div className="space-y-1.5">
                  {budgetSummary.settlements.map((s, idx) => (
                    <div key={idx} className="text-[11px] text-gray-800">
                      <span className="font-medium">{s.fromName}</span> doit verser{' '}
                      <span className="font-bold text-[#17402C]">
                        {s.amount} {budgetSummary.currency}
                      </span>{' '}
                      à <span className="font-medium">{s.toName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 4 : Sécurité & Contacts d'urgence */}
        <footer className="pt-6 border-t border-gray-200 text-xs text-gray-500 flex flex-wrap justify-between gap-4 page-break-inside-avoid">
          <div>
            <div className="font-bold text-gray-700">Sécurité & Numéros d'urgence</div>
            <div>Secours en montagne européen : 112 · SAMU : 15 · Pompiers : 18</div>
          </div>
          <div className="text-right">
            <div>Généré par <strong>Le Kit du Voyageur</strong></div>
            <div>https://lekitduvoyageur.fr</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
