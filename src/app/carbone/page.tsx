'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TripInput {
  origin: string;
  destination: string;
  transport: 'avion-court' | 'avion-long' | 'train' | 'voiture' | 'bus';
  passengers: number;
  nights: number;
  accommodation: 'hotel' | 'camping' | 'refuge' | 'airbnb';
  activities: string[];
}

interface OffsetProject {
  id: string;
  name: string;
  location: string;
  type: string;
  pricePerTon: number;
  rating: number;
  certified: string;
  description: string;
  icon: string;
}

const TRANSPORT_EMISSIONS: Record<string, number> = {
  'avion-court': 255,
  'avion-long': 195,
  train: 14,
  voiture: 171,
  bus: 89,
};

const ACCOMMODATION_EMISSIONS: Record<string, number> = {
  hotel: 31,
  camping: 4,
  refuge: 8,
  airbnb: 22,
};

const ACTIVITIES_LIST = ['Randonnée', 'Alpinisme', 'Ski', 'Plongée', 'Surf', 'Cyclisme', 'Safari', 'Escalade'];

const OFFSET_PROJECTS: OffsetProject[] = [
  { id: 'p1', name: 'Forêt Amazonie Brésilienne', location: 'Brésil', type: 'Reforestation', pricePerTon: 12, rating: 4.9, certified: 'Gold Standard', description: 'Protection de 50 000 ha de forêt primaire et replantation d\'espèces endémiques.', icon: '🌳' },
  { id: 'p2', name: 'Énergie Solaire Afrique', location: 'Kenya', type: 'Énergie renouvelable', pricePerTon: 8, rating: 4.7, certified: 'VCS', description: 'Installation de panneaux solaires dans 12 villages ruraux, remplaçant les générateurs diesel.', icon: '☀️' },
  { id: 'p3', name: 'Mangroves Indonésie', location: 'Indonésie', type: 'Conservation marine', pricePerTon: 15, rating: 4.8, certified: 'Gold Standard', description: 'Restauration de 8 000 ha de mangroves côtières, habitat critique pour la biodiversité marine.', icon: '🌊' },
  { id: 'p4', name: 'Biogaz Inde Rurale', location: 'Inde', type: 'Biogaz', pricePerTon: 6, rating: 4.5, certified: 'CDM', description: 'Conversion des déchets agricoles en biogaz pour 3 000 foyers, réduisant la déforestation.', icon: '♻️' },
];

const ECO_GEAR = [
  { name: 'Sac Patagonia Black Hole 25L', material: 'Nylon recyclé 100%', saving: '2.1 kg CO₂', badge: 'Recyclé', href: '/catalogue' },
  { name: 'Doudoune Primaloft Bio', material: 'Isolant biosourcé', saving: '1.8 kg CO₂', badge: 'Biosourcé', href: '/catalogue' },
  { name: 'Chaussures Salomon Gore-Tex', material: 'Cuir certifié LWG', saving: '0.9 kg CO₂', badge: 'Certifié', href: '/catalogue' },
  { name: 'Gourde Klean Kanteen 1L', material: 'Acier inox recyclé', saving: '3.4 kg CO₂', badge: 'Zéro plastique', href: '/catalogue' },
];

export default function CarbonePage() {
  const [trip, setTrip] = useState<TripInput>({
    origin: 'Paris',
    destination: 'Katmandou',
    transport: 'avion-long',
    passengers: 1,
    nights: 14,
    accommodation: 'refuge',
    activities: ['Randonnée', 'Alpinisme'],
  });
  const [selectedOffset, setSelectedOffset] = useState<string | null>(null);
  const [offsetQty, _setOffsetQty] = useState(1);
  const [offsetDone, setOffsetDone] = useState(false);

  const emissions = useMemo(() => {
    const transportKm = trip.transport.includes('avion') ? 8000 : 1200;
    const transportEmission = (TRANSPORT_EMISSIONS[trip.transport] * transportKm * 2) / 1000;
    const accomEmission = (ACCOMMODATION_EMISSIONS[trip.accommodation] * trip.nights) / 1000;
    const activitiesEmission = trip.activities.length * 0.05;
    const total = (transportEmission + accomEmission + activitiesEmission) / trip.passengers;
    return {
      transport: Math.round(transportEmission * 10) / 10,
      accommodation: Math.round(accomEmission * 10) / 10,
      activities: Math.round(activitiesEmission * 10) / 10,
      total: Math.round(total * 10) / 10,
    };
  }, [trip]);

  const chartData = [
    { name: 'Transport', value: emissions.transport, color: '#E4501C' },
    { name: 'Hébergement', value: emissions.accommodation, color: '#33463C' },
    { name: 'Activités', value: emissions.activities, color: '#3E6B7A' },
  ];

  const toggleActivity = (a: string) => {
    setTrip(prev => ({
      ...prev,
      activities: prev.activities.includes(a)
        ? prev.activities.filter(x => x !== a)
        : [...prev.activities, a],
    }));
  };

  const getCarbonLevel = (tons: number) => {
    if (tons < 0.5) return { label: 'Faible', color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (tons < 1.5) return { label: 'Modéré', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (tons < 3) return { label: 'Élevé', color: 'text-orange-600', bg: 'bg-orange-100' };
    return { label: 'Très élevé', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const level = getCarbonLevel(emissions.total);
  const selectedProject = OFFSET_PROJECTS.find(p => p.id === selectedOffset);
  const offsetCost = selectedProject ? Math.ceil(emissions.total * offsetQty) * selectedProject.pricePerTon : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-20 bg-dark-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Icon name="LeafIcon" size={20} className="text-emerald-400" variant="outline" />
            </div>
            <p className="font-mono text-xs text-emerald-400 tracking-widest uppercase" style={{ fontFamily: 'var(--font-mono)' }}>BILAN CARBONE VOYAGE</p>
          </div>
          <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            Mesurez et compensez<br />votre empreinte
          </h1>
          <p className="text-white/60 text-lg max-w-xl">Calculez l&apos;impact CO₂ de votre expédition et compensez avec des projets certifiés Gold Standard.</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calculator form */}
          <div className="lg:col-span-1 space-y-4">
            <div className="topo-card p-5">
              <h2 className="font-display font-700 text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Paramètres du voyage</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Départ</label>
                    <input type="text" value={trip.origin} onChange={e => setTrip({ ...trip, origin: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Destination</label>
                    <input type="text" value={trip.destination} onChange={e => setTrip({ ...trip, destination: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Transport principal</label>
                  <select value={trip.transport} onChange={e => setTrip({ ...trip, transport: e.target.value as TripInput['transport'] })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="avion-long">✈️ Avion long-courrier</option>
                    <option value="avion-court">✈️ Avion court-courrier</option>
                    <option value="train">🚂 Train</option>
                    <option value="voiture">🚗 Voiture</option>
                    <option value="bus">🚌 Bus</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Voyageurs</label>
                    <input type="number" min={1} max={20} value={trip.passengers} onChange={e => setTrip({ ...trip, passengers: parseInt(e.target.value) || 1 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Nuits</label>
                    <input type="number" min={1} max={365} value={trip.nights} onChange={e => setTrip({ ...trip, nights: parseInt(e.target.value) || 1 })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Hébergement</label>
                  <select value={trip.accommodation} onChange={e => setTrip({ ...trip, accommodation: e.target.value as TripInput['accommodation'] })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="camping">⛺ Camping</option>
                    <option value="refuge">🏔️ Refuge</option>
                    <option value="airbnb">🏠 Airbnb</option>
                    <option value="hotel">🏨 Hôtel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Activités</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ACTIVITIES_LIST.map(a => (
                      <button
                        key={a}
                        onClick={() => toggleActivity(a)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          trip.activities.includes(a)
                            ? 'bg-primary text-white border-primary' :'border-border text-muted-foreground hover:border-primary hover:text-primary'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-5">
            {/* Main result */}
            <div className="topo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Bilan carbone estimé</h2>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${level.color} ${level.bg}`}>{level.label}</span>
              </div>

              <div className="flex items-end gap-3 mb-6">
                <div className="font-mono text-5xl font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{emissions.total}</div>
                <div className="text-muted-foreground mb-2">tonnes CO₂e / personne</div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {chartData.map(d => (
                  <div key={d.name} className="p-3 bg-background rounded-xl border border-border text-center">
                    <div className="font-mono text-lg font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{d.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{d.name}</div>
                    <div className="text-[10px] text-muted-foreground">tonnes CO₂e</div>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}t`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip formatter={(v: number) => [`${v} t CO₂e`, '']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 p-3 bg-background rounded-xl border border-border">
                <p className="text-xs text-muted-foreground">
                  💡 Équivalent à <strong className="text-foreground">{Math.round(emissions.total * 4500)} km</strong> en voiture essence, ou <strong className="text-foreground">{Math.round(emissions.total * 12)} mois</strong> de chauffage moyen français.
                </p>
              </div>
            </div>

            {/* Offset projects */}
            <div className="topo-card p-5">
              <h3 className="font-display font-700 text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Compenser mon empreinte</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {OFFSET_PROJECTS.map(project => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedOffset(selectedOffset === project.id ? null : project.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      selectedOffset === project.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{project.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-700 text-sm text-foreground mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>{project.name}</div>
                        <div className="text-xs text-muted-foreground">{project.location} · {project.type}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="font-mono text-xs font-700 text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{project.pricePerTon}€/t</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{project.certified}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedProject && (
                <div className="p-4 bg-background rounded-xl border border-primary/30">
                  <p className="text-sm text-muted-foreground mb-3">{selectedProject.description}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Compensation totale</div>
                      <div className="font-mono text-xl font-700 text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{offsetCost}€</div>
                      <div className="text-xs text-muted-foreground">{emissions.total} t × {selectedProject.pricePerTon}€/t</div>
                    </div>
                    <button
                      onClick={() => setOffsetDone(true)}
                      className="btn-primary"
                    >
                      {offsetDone ? (
                        <><Icon name="CheckIcon" size={14} variant="outline" /> Compensé !</>
                      ) : (
                        <><Icon name="LeafIcon" size={14} variant="outline" /> Compenser maintenant</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Eco gear */}
            <div className="topo-card p-5">
              <h3 className="font-display font-700 text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                <Icon name="LeafIcon" size={16} className="text-emerald-500 inline mr-2" variant="outline" />
                Matériel éco-responsable recommandé
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ECO_GEAR.map(gear => (
                  <a key={gear.name} href={gear.href} className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border hover:border-emerald-400 transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Icon name="LeafIcon" size={14} className="text-emerald-600" variant="outline" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground group-hover:text-emerald-700 transition-colors truncate">{gear.name}</div>
                      <div className="text-xs text-muted-foreground">{gear.material}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium flex-shrink-0">{gear.badge}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
