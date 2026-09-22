'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Card, Chip } from '@/components/ui';

const TRANSPORT_EMISSIONS: Record<string, number> = { 'avion-court': 255, 'avion-long': 195, train: 14, voiture: 171, bus: 89 };
const ACCOMMODATION_EMISSIONS: Record<string, number> = { hotel: 31, camping: 4, refuge: 8, airbnb: 22 };
const ACTIVITIES_LIST = ['Randonnée', 'Alpinisme', 'Ski', 'Plongée', 'Surf', 'Cyclisme', 'Safari', 'Escalade'];
const OFFSET_PROJECTS = [
  { id: 'p1', name: 'Forêt Amazonie Brésilienne', location: 'Brésil', type: 'Reforestation', pricePerTon: 12, rating: 4.9, certified: 'Gold Standard', description: 'Protection de 50 000 ha de forêt primaire.', icon: '🌳' },
  { id: 'p2', name: 'Énergie Solaire Afrique', location: 'Kenya', type: 'Énergie renouvelable', pricePerTon: 8, rating: 4.7, certified: 'VCS', description: 'Installation de panneaux solaires.', icon: '☀️' },
  { id: 'p3', name: 'Mangroves Indonésie', location: 'Indonésie', type: 'Conservation marine', pricePerTon: 15, rating: 4.8, certified: 'Gold Standard', description: 'Restauration de 8 000 ha de mangroves.', icon: '🌊' },
  { id: 'p4', name: 'Biogaz Inde Rurale', location: 'Inde', type: 'Biogaz', pricePerTon: 6, rating: 4.5, certified: 'CDM', description: 'Conversion des déchets en biogaz.', icon: '♻️' },
];
const ECO_GEAR = [
  { name: 'Sac Patagonia Black Hole 25L', material: 'Nylon recyclé 100%', saving: '2.1 kg CO₂', badge: 'Recyclé', href: '/boutique' },
  { name: 'Doudoune Primaloft Bio', material: 'Isolant biosourcé', saving: '1.8 kg CO₂', badge: 'Biosourcé', href: '/boutique' },
  { name: 'Gourde Klean Kanteen 1L', material: 'Acier inox recyclé', saving: '3.4 kg CO₂', badge: 'Zéro plastique', href: '/boutique' },
];

// Charte unique P3 (UNE charte desk/mobile) — référence `contact` : labels visibles + 44px + tokens `--lkv-*` + verre `.lkv-glass`.
const FIELD_CLASS =
  'min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LABEL_CLASS =
  'mb-1.5 block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.04em] text-[color:var(--lkv-text-secondary)]';

type TripState = { origin: string; destination: string; transport: string; passengers: number; nights: number; accommodation: string; activities: string[] };

function ParamsBasics({ trip, setTrip, idPrefix }: { trip: TripState; setTrip: (t: TripState) => void; idPrefix: string }) {
  return (
    <fieldset className="border-0 m-0 p-0">
      <legend className="sr-only">Trajet</legend>
      <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Trajet</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-origin`} className={LABEL_CLASS}>Départ *</label>
          <input id={`${idPrefix}-origin`} type="text" autoComplete="off" value={trip.origin} onChange={(e) => setTrip({ ...trip, origin: e.target.value })} placeholder="Paris" className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-destination`} className={LABEL_CLASS}>Destination *</label>
          <input id={`${idPrefix}-destination`} type="text" autoComplete="off" value={trip.destination} onChange={(e) => setTrip({ ...trip, destination: e.target.value })} placeholder="Katmandou" className={FIELD_CLASS} />
        </div>
      </div>
    </fieldset>
  );
}

function ParamsDetails({ trip, setTrip, idPrefix, toggleActivity }: { trip: TripState; setTrip: (t: TripState) => void; idPrefix: string; toggleActivity: (a: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-transport`} className={LABEL_CLASS}>Transport *</label>
        <select id={`${idPrefix}-transport`} value={trip.transport} onChange={(e) => setTrip({ ...trip, transport: e.target.value })} className={FIELD_CLASS}>
          <option value="avion-long">Avion long-courrier</option><option value="avion-court">Avion court-courrier</option><option value="train">Train</option><option value="voiture">Voiture</option><option value="bus">Bus</option>
        </select>
      </div>
      <fieldset className="border-0 m-0 p-0">
        <legend className="sr-only">Durée et groupe</legend>
        <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Durée et groupe</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-passengers`} className={LABEL_CLASS}>Voyageurs</label>
            <input id={`${idPrefix}-passengers`} type="number" min={1} max={20} value={trip.passengers} onChange={(e) => setTrip({ ...trip, passengers: parseInt(e.target.value) || 1 })} className={`${FIELD_CLASS} font-mono`} inputMode="numeric" />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-nights`} className={LABEL_CLASS}>Nuits</label>
            <input id={`${idPrefix}-nights`} type="number" min={1} max={365} value={trip.nights} onChange={(e) => setTrip({ ...trip, nights: parseInt(e.target.value) || 1 })} className={`${FIELD_CLASS} font-mono`} inputMode="numeric" />
          </div>
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${idPrefix}-accommodation`} className={LABEL_CLASS}>Hébergement</label>
        <select id={`${idPrefix}-accommodation`} value={trip.accommodation} onChange={(e) => setTrip({ ...trip, accommodation: e.target.value })} className={FIELD_CLASS}>
          <option value="camping">Camping</option><option value="refuge">Refuge</option><option value="airbnb">Airbnb</option><option value="hotel">Hôtel</option>
        </select>
      </div>
      <fieldset className="border-0 m-0 p-0">
        <legend className="sr-only">Activités</legend>
        <h3 className="mb-2 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Activités</h3>
        <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Activités du voyage">
          {ACTIVITIES_LIST.map((a) => (
            <Chip key={a} selected={trip.activities.includes(a)} onClick={() => toggleActivity(a)}>{a}</Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function CarbonePage() {
  const [trip, setTrip] = useState<TripState>({ origin: 'Paris', destination: 'Katmandou', transport: 'avion-long', passengers: 1, nights: 14, accommodation: 'refuge', activities: ['Randonnée', 'Alpinisme'] });
  const [selectedOffset, setSelectedOffset] = useState<string | null>(null);
  const [offsetQty] = useState(1);
  const [offsetDone, setOffsetDone] = useState(false);

  const emissions = useMemo(() => {
    const transportKm = trip.transport.includes('avion') ? 8000 : 1200;
    const transportEmission = (TRANSPORT_EMISSIONS[trip.transport] * transportKm * 2) / 1000;
    const accomEmission = (ACCOMMODATION_EMISSIONS[trip.accommodation] * trip.nights) / 1000;
    const activitiesEmission = trip.activities.length * 0.05;
    const total = (transportEmission + accomEmission + activitiesEmission) / trip.passengers;
    return { transport: Math.round(transportEmission * 10) / 10, accommodation: Math.round(accomEmission * 10) / 10, activities: Math.round(activitiesEmission * 10) / 10, total: Math.round(total * 10) / 10 };
  }, [trip]);

  const chartData = [
    { name: 'Transport', value: emissions.transport, color: '#17402C' },
    { name: 'Hébergement', value: emissions.accommodation, color: '#33463C' },
    { name: 'Activités', value: emissions.activities, color: '#3E6B7A' },
  ];

  const toggleActivity = (a: string) => { setTrip(prev => ({ ...prev, activities: prev.activities.includes(a) ? prev.activities.filter(x => x !== a) : [...prev.activities, a] })); };
  const getCarbonLevel = (tons: number) => {
    if (tons < 0.5) return { label: 'Faible', className: 'bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-success)]' };
    if (tons < 1.5) return { label: 'Modéré', className: 'bg-[color:var(--lkv-warning-bg)] text-[color:var(--lkv-warning-dark)]' };
    if (tons < 3) return { label: 'Élevé', className: 'bg-[color:var(--lkv-warning-bg)] text-[color:var(--lkv-warning-dark)]' };
    return { label: 'Très élevé', className: 'bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger-dark)]' };
  };
  const level = getCarbonLevel(emissions.total);
  const selectedProject = OFFSET_PROJECTS.find(p => p.id === selectedOffset);
  const offsetCost = selectedProject ? Math.ceil(emissions.total * offsetQty) * selectedProject.pricePerTon : 0;

  const setTripState = (t: TripState) => setTrip(t);

  return (
    <>
      {/* DESKTOP — même charte tokens que mobile (verre neutre .lkv-glass, champs contact) */}
      <div className="hidden md:block">
        <div className="min-h-screen text-[color:var(--lkv-text-primary)]">
          <Header />
          <section className="bg-[color:var(--lkv-primary)] pt-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[color:var(--lkv-surface-paper)]/15 border border-[color:var(--glass-border)] flex items-center justify-center">
                  <Icon name="LeafIcon" size={20} className="text-[color:var(--lkv-text-inverted)]" variant="outline" />
                </div>
                <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-inverted)]/80 tracking-widest uppercase">Bilan carbone voyage</p>
              </div>
              <h1 className="font-display font-bold text-4xl md:text-5xl text-[color:var(--lkv-text-inverted)] tracking-tight mb-3">Mesurez et compensez<br />votre empreinte</h1>
              <p className="text-[color:var(--lkv-text-inverted)]/70 text-lg max-w-xl">Calculez l&apos;impact CO₂ de votre expédition.</p>
            </div>
          </section>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <Card variant="standard" className="p-5">
                  <h2 className="font-display font-bold text-base text-[color:var(--lkv-text-primary)] mb-4">Paramètres du voyage</h2>
                  <div className="space-y-5">
                    <ParamsBasics trip={trip} setTrip={setTripState} idPrefix="carbone-desktop" />
                    <ParamsDetails trip={trip} setTrip={setTripState} idPrefix="carbone-desktop" toggleActivity={toggleActivity} />
                  </div>
                </Card>
              </div>
              <div className="lg:col-span-2 space-y-5">
                <Card variant="standard" className="p-6">
                  <div className="flex items-center justify-between mb-4"><h2 className="font-display font-bold text-xl text-[color:var(--lkv-text-primary)]">Bilan carbone estimé</h2><span className={`text-[length:var(--lkv-text-caption)] px-3 py-1 rounded-full font-medium ${level.className}`}>{level.label}</span></div>
                  <div className="flex items-end gap-3 mb-6"><div className="font-mono text-5xl font-bold text-[color:var(--lkv-text-primary)]">{emissions.total}</div><div className="text-[color:var(--lkv-text-secondary)] mb-2">tonnes CO₂e / personne</div></div>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]" aria-live="polite">Transport {emissions.transport} t · Hébergement {emissions.accommodation} t · Activités {emissions.activities} t</p>
                </Card>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>

      {/* MOBILE — même charte, mêmes champs, mêmes tokens */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <p className="mb-1 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--lkv-text-secondary)]">Bilan carbone voyage</p>
            <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-primary)]">Bilan carbone</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Calculez l&apos;impact CO₂ de votre voyage.</p>
            <Card variant="standard" className="mb-[var(--space-4)] p-[var(--space-4)]">
              <h2 className="mb-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-primary)]">Paramètres du voyage</h2>
              <div className="flex flex-col gap-[var(--space-4)]">
                <ParamsBasics trip={trip} setTrip={setTripState} idPrefix="carbone-mobile" />
                <ParamsDetails trip={trip} setTrip={setTripState} idPrefix="carbone-mobile" toggleActivity={toggleActivity} />
              </div>
            </Card>
            <Card variant="standard" className="p-[var(--space-4)] text-center">
              <p className="mb-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Bilan carbone estimé</p>
              <p className="font-mono text-[32px] font-bold text-[color:var(--lkv-primary)]" aria-live="polite">{emissions.total}</p>
              <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">tonnes CO₂e / personne</p>
            </Card>
            {selectedProject && (
              <Button fullWidth className="mt-[var(--space-4)] min-h-[var(--lkv-touch-min)]" onClick={() => setOffsetDone(true)}>
                {offsetDone ? 'Compensé !' : `Compenser — ${offsetCost}€`}
              </Button>
            )}
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
