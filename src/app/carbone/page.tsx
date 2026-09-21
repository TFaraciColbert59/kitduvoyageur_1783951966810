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

export default function CarbonePage() {
  const [trip, setTrip] = useState({ origin: 'Paris', destination: 'Katmandou', transport: 'avion-long', passengers: 1, nights: 14, accommodation: 'refuge' as string, activities: ['Randonnée', 'Alpinisme'] as string[] });
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

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <section className="pt-20 bg-dark-bg">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-forest-500/20 flex items-center justify-center"><Icon name="LeafIcon" size={20} className="text-forest-400" variant="outline" /></div><p className="font-mono text-xs text-forest-400 tracking-widest uppercase">BILAN CARBONE VOYAGE</p></div>
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-3">Mesurez et compensez<br />votre empreinte</h1>
              <p className="text-white/60 text-lg max-w-xl">Calculez l&apos;impact CO₂ de votre expédition.</p>
            </div>
          </section>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <div className="glass p-5">
                  <h2 className="font-display font-700 text-base text-foreground mb-4">Paramètres du voyage</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Départ</label><input type="text" value={trip.origin} onChange={e => setTrip({ ...trip, origin: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" /></div>
                      <div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Destination</label><input type="text" value={trip.destination} onChange={e => setTrip({ ...trip, destination: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" /></div>
                    </div>
                    <div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Transport</label>
                      <select value={trip.transport} onChange={e => setTrip({ ...trip, transport: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors">
                        <option value="avion-long">Avion long-courrier</option><option value="avion-court">Avion court-courrier</option><option value="train">Train</option><option value="voiture">Voiture</option><option value="bus">Bus</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Voyageurs</label><input type="number" min={1} max={20} value={trip.passengers} onChange={e => setTrip({ ...trip, passengers: parseInt(e.target.value) || 1 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" /></div>
                      <div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Nuits</label><input type="number" min={1} max={365} value={trip.nights} onChange={e => setTrip({ ...trip, nights: parseInt(e.target.value) || 1 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" /></div></div>
                    <div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Hébergement</label>
                      <select value={trip.accommodation} onChange={e => setTrip({ ...trip, accommodation: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors">
                        <option value="camping">Camping</option><option value="refuge">Refuge</option><option value="airbnb">Airbnb</option><option value="hotel">Hôtel</option>
                      </select>
                    </div>
                    <div><label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Activités</label>
                      <div className="flex flex-wrap gap-[var(--space-2)]">{ACTIVITIES_LIST.map(a => (<Chip key={a} selected={trip.activities.includes(a)} onClick={() => toggleActivity(a)}>{a}</Chip>))}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 space-y-5">
                <div className="glass p-6">
                  <div className="flex items-center justify-between mb-4"><h2 className="font-display font-700 text-xl text-foreground">Bilan carbone estimé</h2><span className={`text-sm px-3 py-1 rounded-full font-medium ${level.className}`}>{level.label}</span></div>
                  <div className="flex items-end gap-3 mb-6"><div className="font-mono text-5xl font-700 text-foreground">{emissions.total}</div><div className="text-muted-foreground mb-2">tonnes CO₂e / personne</div></div>
                </div>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-3)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-primary)]">Bilan carbone</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Calculez l&apos;impact CO₂ de votre voyage.</p>
            <Card variant="standard" className="mb-[var(--space-4)] p-[var(--space-4)]">
              <h2 className="mb-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-primary)]">Paramètres du voyage</h2>
              <div className="flex flex-col gap-[var(--space-3)]">
                <div className="grid grid-cols-2 gap-[var(--space-2)]">
                  <input type="text" value={trip.origin} onChange={e => setTrip({ ...trip, origin: e.target.value })} placeholder="Départ" aria-label="Ville de départ" className="min-h-[var(--lkv-touch-min)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]" />
                  <input type="text" value={trip.destination} onChange={e => setTrip({ ...trip, destination: e.target.value })} placeholder="Destination" aria-label="Destination" className="min-h-[var(--lkv-touch-min)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]" />
                </div>
                <select value={trip.transport} onChange={e => setTrip({ ...trip, transport: e.target.value })} aria-label="Mode de transport" className="min-h-[var(--lkv-touch-min)] rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)]">
                  <option value="avion-long">Avion long-courrier</option><option value="avion-court">Avion court-courrier</option><option value="train">Train</option><option value="voiture">Voiture</option><option value="bus">Bus</option>
                </select>
              </div>
            </Card>
            <Card variant="standard" className="p-[var(--space-4)] text-center">
              <p className="mb-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Bilan carbone estimé</p>
              <p className="font-mono text-[32px] font-bold text-[color:var(--lkv-primary)]">{emissions.total}</p>
              <p className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">tonnes CO₂e / personne</p>
            </Card>
            {selectedProject && (
              <Button fullWidth className="mt-[var(--space-4)]" onClick={() => setOffsetDone(true)}>
                {offsetDone ? 'Compensé !' : `Compenser — ${offsetCost}€`}
              </Button>
            )}
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
