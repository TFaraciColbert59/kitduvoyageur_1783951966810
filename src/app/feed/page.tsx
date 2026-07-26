'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface GearUsed {
  name: string;
  category: string;
  rating: number;
  linked: boolean;
}

interface JournalEntry {
  id: string;
  author: string;
  authorId: string;
  authorAvatar: string;
  authorTrustScore: number;
  authorLevel: 'débutant' | 'confirmé' | 'expert' | 'ambassadeur';
  title: string;
  destination: string;
  country: string;
  countryCode: string;
  duration: string;
  date: string;
  coverImage: string;
  coverAlt: string;
  excerpt: string;
  gpsTrace: boolean;
  gpsPoints: number;
  weatherReal: string;
  gearUsed: GearUsed[];
  missingGear: string[];
  routeRating: number;
  linkedKit?: string;
  linkedRental?: string;
  reactions: {
    useful: number;
    securityConfirmed: number;
    bagHelped: number;
  };
  userReacted?: 'useful' | 'securityConfirmed' | 'bagHelped' | null;
  comments: number;
  readTime: number;
  verified: boolean;
}

const JOURNALS: JournalEntry[] = [
{
  id: 'j1',
  author: 'Thomas Vernet',
  authorId: 'fake-author-1',
  authorAvatar: 'TV',
  authorTrustScore: 94,
  authorLevel: 'ambassadeur',
  title: 'Circuit des Annapurnas — 18 jours en autonomie complète',
  destination: 'Circuit des Annapurnas',
  country: 'Népal',
  countryCode: 'np',
  duration: '18 jours',
  date: '2026-07-01',
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fc94b322-1777501827822.png",
  coverAlt: 'Randonneur avec sac à dos sur sentier himalayan avec vue sur Annapurna enneigé',
  excerpt: 'Départ de Besisahar le 12 mars, retour à Pokhara le 30. Conditions météo exceptionnelles jusqu\'au col Thorong La (5416m), puis tempête de neige les 3 derniers jours. Matériel testé à l\'extrême — voici ce qui a tenu et ce qui a failli.',
  gpsTrace: true,
  gpsPoints: 2847,
  weatherReal: 'Ensoleillé J1–J14, tempête neige J15–J18, -18°C au col',
  gearUsed: [
  { name: 'Osprey Atmos 65', category: 'Sac à dos', rating: 5, linked: true },
  { name: 'Veste Arc\'teryx Beta AR', category: 'Vêtement', rating: 5, linked: true },
  { name: 'Tente MSR Hubba Hubba NX2', category: 'Tente', rating: 4, linked: false },
  { name: 'Sac de couchage -15°C', category: 'Couchage', rating: 5, linked: true }],

  missingGear: ['Guêtres imperméables', 'Crème solaire indice 100'],
  routeRating: 9.2,
  linkedKit: 'Kit Népal Trek 3 semaines',
  reactions: { useful: 203, securityConfirmed: 87, bagHelped: 156 },
  userReacted: null,
  comments: 34,
  readTime: 12,
  verified: true
},
{
  id: 'j2',
  author: 'Camille Rousseau',
  authorId: 'fake-author-2',
  authorAvatar: 'CR',
  authorTrustScore: 87,
  authorLevel: 'expert',
  title: 'GR20 Corse — 15 jours de bout en bout, variante intégrale',
  destination: 'GR20',
  country: 'France (Corse)',
  countryCode: 'fr',
  duration: '15 jours',
  date: '2026-06-20',
  coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_12782a0e5-1772085588678.png",
  coverAlt: 'Randonneuse sur sentier rocheux corse avec vue panoramique sur mer Méditerranée',
  excerpt: 'Le GR20 en juin : chaleur intense en basse altitude, fraîcheur bienvenue au-dessus de 1800m. J\'ai opté pour la variante alpine sur 6 étapes — plus technique mais spectaculaire. Retour complet sur le matériel, les bivouacs autorisés et les points d\'eau.',
  gpsTrace: true,
  gpsPoints: 1923,
  weatherReal: '28°C en vallée, 12°C en altitude, 2 orages nocturnes',
  gearUsed: [
  { name: 'Sac Deuter Aircontact 55+10', category: 'Sac à dos', rating: 4, linked: true },
  { name: 'Chaussures Salomon X Ultra 4', category: 'Chaussures', rating: 5, linked: true },
  { name: 'Tente Hilleberg Nallo 2', category: 'Tente', rating: 5, linked: false }],

  missingGear: ['Filtre à eau (sources non potables)', 'Gants légers pour les crêtes'],
  routeRating: 8.8,
  linkedKit: 'Kit GR20 Corse 15 jours',
  linkedRental: 'Location bâtons Black Diamond',
  reactions: { useful: 178, securityConfirmed: 64, bagHelped: 142 },
  userReacted: null,
  comments: 28,
  readTime: 9,
  verified: true
},
{
  id: 'j3',
  author: 'Erik Lindström',
  authorId: 'fake-author-3',
  authorAvatar: 'EL',
  authorTrustScore: 79,
  authorLevel: 'expert',
  title: 'Traversée Islande F35 — 7 jours dans les Highlands',
  destination: 'Route F35 — Kjölur',
  country: 'Islande',
  countryCode: 'is',
  duration: '7 jours',
  date: '2026-06-10',
  coverImage: "https://images.unsplash.com/photo-1700757714267-33ea2f51eeca",
  coverAlt: 'Paysage volcanique islandais avec randonneur sur sentier de lave noire et glacier en arrière-plan',
  excerpt: 'La F35 à pied en juillet : faisable mais exigeant. Vent constant 40–60 km/h, passages à gué jusqu\'aux genoux, aucun abri pendant 3 jours. Matériel imperméabilité testé à fond. Ce carnet détaille chaque étape avec les coordonnées GPS des points d\'eau et des bivouacs.',
  gpsTrace: true,
  gpsPoints: 1456,
  weatherReal: 'Vent 40–60 km/h constant, 8°C, pluie 4 jours sur 7',
  gearUsed: [
  { name: 'Veste Haglöfs L.I.M Comp', category: 'Vêtement', rating: 5, linked: false },
  { name: 'Pantalon imperméable', category: 'Vêtement', rating: 3, linked: false },
  { name: 'Sac étanche 20L', category: 'Accessoire', rating: 5, linked: true }],

  missingGear: ['Guêtres hautes (passages à gué)', 'Bâtons plus rigides'],
  routeRating: 8.5,
  reactions: { useful: 134, securityConfirmed: 112, bagHelped: 89 },
  userReacted: null,
  comments: 19,
  readTime: 8,
  verified: true
}];


const REACTION_CONFIG = {
  useful: { label: 'm\'a servi pour préparer', icon: '🎒', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  securityConfirmed: { label: 'info sécurité confirmée', icon: '🛡️', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  bagHelped: { label: 'a aidé mon sac', icon: '⚖️', color: 'text-amber-700 bg-amber-50 border-amber-200' }
};

const trustLevelConfig = {
  débutant: { color: 'text-gray-600 bg-gray-100', icon: '🌱' },
  confirmé: { color: 'text-blue-700 bg-blue-100', icon: '🏔️' },
  expert: { color: 'text-purple-700 bg-purple-100', icon: '⛰️' },
  ambassadeur: { color: 'text-amber-700 bg-amber-100', icon: '🏅' }
};

function TrustRing({ score, size = 40 }: {score: number;size?: number;}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - score / 100 * circ;
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute font-mono-data text-foreground" style={{ fontSize: size * 0.24, fontWeight: 700 }}>{score}</span>
    </div>);

}

function StarRating({ rating }: {rating: number;}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) =>
      <span key={s} className={s <= Math.round(rating) ? 'text-amber-500' : 'text-gray-300'} style={{ fontSize: 11 }}>★</span>
      )}
    </div>);

}

function JournalCard({ journal }: {journal: JournalEntry;}) {
  const [reactions, setReactions] = useState(journal.reactions);
  const [userReacted, setUserReacted] = useState<string | null>(journal.userReacted ?? null);
  const lvl = trustLevelConfig[journal.authorLevel];

  const handleReact = (type: keyof typeof reactions) => {
    if (userReacted === type) {
      setReactions((prev) => ({ ...prev, [type]: prev[type] - 1 }));
      setUserReacted(null);
    } else {
      if (userReacted) {
        setReactions((prev) => ({ ...prev, [userReacted as keyof typeof reactions]: prev[userReacted as keyof typeof reactions] - 1 }));
      }
      setReactions((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      setUserReacted(type);
    }
  };

  return (
    <article className="topo-card overflow-hidden">
      {/* Cover */}
      <div className="relative aspect-[21/9] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={journal.coverImage} alt={journal.coverAlt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {journal.gpsTrace &&
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white border border-white/20">
            <Icon name="MapPinIcon" size={11} />
            <span className="font-mono-data">{journal.gpsPoints.toLocaleString()} pts GPS</span>
          </div>
        }
        {journal.verified &&
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-500/90 rounded-full px-2 py-0.5 text-[10px] text-white font-600">
            <Icon name="CheckBadgeIcon" size={11} />
            Achat vérifié
          </div>
        }
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-white/60 text-xs font-mono-data">{journal.country}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/60 text-xs">{journal.duration}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/60 text-xs">{journal.readTime} min de lecture</span>
          </div>
          <h2 className="font-display font-700 text-white text-lg leading-tight">{journal.title}</h2>
        </div>
      </div>

      <div className="p-5">
        {/* Author */}
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/profil/${journal.authorId}`} className="w-9 h-9 rounded-xl bg-secondary text-white flex items-center justify-center text-sm font-700 flex-shrink-0 hover:opacity-80 transition-opacity">
            {journal.authorAvatar}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/profil/${journal.authorId}`} className="font-600 text-sm text-foreground hover:text-primary transition-colors">{journal.author}</Link>
              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${lvl.color}`}>
                {lvl.icon} {journal.authorLevel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(journal.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <TrustRing score={journal.authorTrustScore} size={40} />
        </div>

        {/* Excerpt */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{journal.excerpt}</p>

        {/* Structured debrief */}
        <div className="bg-background rounded-xl border border-border p-4 mb-4 space-y-3">
          <h3 className="text-xs font-700 text-foreground uppercase tracking-wider mb-3">Retour d&apos;expédition structuré</h3>

          <div className="flex items-start gap-2">
            <Icon name="CloudIcon" size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600">Météo réelle</p>
              <p className="text-xs text-foreground">{journal.weatherReal}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Icon name="StarIcon" size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600">Note du parcours</p>
              <div className="flex items-center gap-2">
                <StarRating rating={journal.routeRating / 2} />
                <span className="font-mono-data text-xs text-foreground">{journal.routeRating}/10</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-2">Matériel utilisé</p>
            <div className="flex flex-wrap gap-1.5">
              {journal.gearUsed.map((g) =>
              <div key={g.name} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${g.linked ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                  {g.linked && <Icon name="LinkIcon" size={9} />}
                  {g.name}
                  <span className="text-amber-500">{'★'.repeat(g.rating)}</span>
                </div>
              )}
            </div>
          </div>

          {journal.missingGear.length > 0 &&
          <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1.5">Ce qui a manqué</p>
              <div className="flex flex-wrap gap-1.5">
                {journal.missingGear.map((m) =>
              <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">{m}</span>
              )}
              </div>
            </div>
          }

          {(journal.linkedKit || journal.linkedRental) &&
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
              {journal.linkedKit &&
            <Link href="/kits" className="flex items-center gap-1 text-[10px] text-secondary font-600 hover:underline">
                  <Icon name="CubeIcon" size={10} />
                  Kit lié : {journal.linkedKit}
                </Link>
            }
              {journal.linkedRental &&
            <Link href="/location" className="flex items-center gap-1 text-[10px] text-info font-600 hover:underline">
                  <Icon name="KeyIcon" size={10} />
                  {journal.linkedRental}
                </Link>
            }
            </div>
          }
        </div>

        {/* Reactions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(REACTION_CONFIG) as Array<keyof typeof REACTION_CONFIG>).map((type) => {
            const cfg = REACTION_CONFIG[type];
            const count = reactions[type as keyof typeof reactions];
            const active = userReacted === type;
            return (
              <button
                key={type}
                onClick={() => handleReact(type as keyof typeof reactions)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-600 border transition-all ${active ? cfg.color + ' ring-1 ring-offset-1 ring-current' : 'bg-background border-border text-muted-foreground hover:border-current'}`}>
                
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
                <span className="font-mono-data font-700">{count}</span>
              </button>);

          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ChatBubbleLeftIcon" size={14} />
            {journal.comments} commentaires
          </button>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Icon name="ShareIcon" size={14} />
              Partager
            </button>
            <button className="btn-primary py-1.5 px-3 text-xs">
              Lire le carnet complet
            </button>
          </div>
        </div>
      </div>
    </article>);

}

export default function FeedPage() {
  const [journals, setJournals] = useState(JOURNALS);
  const [filter, setFilter] = useState<'all' | 'verified' | 'ambassadeur'>('all');

  const filtered = journals.filter((j) => {
    if (filter === 'verified') return j.verified;
    if (filter === 'ambassadeur') return j.authorLevel === 'ambassadeur';
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: '#E7E3D6' }}>
      <Header />

      {/* ── Hero ── */}
      <section style={{ background: '#1C2620' }} className="pt-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '128px' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full opacity-[0.05] pointer-events-none" style={{ background: 'radial-gradient(circle, #4A6741 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: '#E4501C' }}>Communauté</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
            <span className="text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Carnets de terrain</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h1 className="font-display mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}>
                Des récits vrais,<br />
                <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.65)' }}>par des voyageurs vrais.</em>
              </h1>
              <p className="text-sm max-w-xl" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                Carnets d&apos;expédition vérifiés, retours terrain avec données GPS, météo réelle et matériel testé. Chaque récit est lié à un achat confirmé.
              </p>
            </div>

            <div className="flex items-center gap-6 flex-shrink-0">
              {[
                { value: journals.filter(j => j.verified).length.toString(), label: 'récits vérifiés' },
                { value: journals.reduce((s, j) => s + j.gpsPoints, 0).toLocaleString(), label: 'points GPS' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-mono font-700 text-2xl" style={{ color: '#E4501C' }}>{s.value}</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {[
            { id: 'all', label: 'Tous les récits' },
            { id: 'verified', label: '✓ Achats vérifiés' },
            { id: 'ambassadeur', label: '🏅 Ambassadeurs' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className="px-4 py-2 rounded-xl text-sm font-600 transition-all"
              style={{
                background: filter === f.id ? '#1C2620' : '#fff',
                color: filter === f.id ? '#fff' : '#5C6B5E',
                border: `1px solid ${filter === f.id ? '#1C2620' : '#E8E4DA'}`,
              }}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Link href="/carnets" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 transition-all" style={{ background: '#E4501C', color: '#fff' }}>
              <Icon name="PlusIcon" size={13} /> Publier un carnet
            </Link>
          </div>
        </div>

        {/* Journal cards */}
        <div className="space-y-6">
          {filtered.map((journal) => (
            <JournalCard key={journal.id} journal={journal} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-[#5C6B5E]">
            <p className="text-4xl mb-3">📖</p>
            <p className="font-display font-700 text-[#1C2620] text-lg mb-1">Aucun récit</p>
            <p className="text-sm">Essayez d&apos;autres filtres</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}