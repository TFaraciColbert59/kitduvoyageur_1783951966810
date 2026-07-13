'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice?: number;
  score: number;
  reason: string;
  reasonType: 'history' | 'profile' | 'community' | 'trending';
  rating: number;
  reviews: number;
  image: string;
  alt: string;
  badge?: string;
}

interface HistoryItem {
  id: string;
  action: string;
  item: string;
  date: string;
  weight: number;
}

const REASON_LABELS: Record<string, {label: string;color: string;icon: string;}> = {
  history: { label: 'Basé sur votre historique', color: 'text-primary bg-primary/10 border-primary/20', icon: 'ClockIcon' },
  profile: { label: 'Correspond à votre profil', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: 'UserIcon' },
  community: { label: 'Plébiscité par la communauté', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: 'UsersIcon' },
  trending: { label: 'Tendance cette semaine', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: 'ArrowTrendingUpIcon' }
};

const RECOMMENDATIONS: Product[] = [
{
  id: 'r1', name: 'Sac Osprey Atmos AG 65', brand: 'Osprey', category: 'Sac à dos',
  price: 289, originalPrice: 340, score: 97,
  reason: 'Vous avez consulté 3 sacs 60-70L ce mois. Ce modèle correspond à votre gabarit (180cm) et votre usage trekking multi-jours.',
  reasonType: 'history', rating: 4.8, reviews: 312,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1850f09c6-176554483.png",
  alt: 'Sac à dos Osprey Atmos 65L vert forêt avec système de suspension anti-gravité',
  badge: 'Meilleur match'
},
{
  id: 'r2', name: 'Tente MSR Hubba Hubba NX2', brand: 'MSR', category: 'Tente',
  price: 449, score: 94,
  reason: 'Votre prochain voyage est au Népal (altitude 4200m). Cette tente 3 saisons ultraléger est idéale pour votre itinéraire.',
  reasonType: 'profile', rating: 4.7, reviews: 189,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ed1ccd2e-1783678938721.png",
  alt: 'Tente MSR Hubba Hubba montée dans un paysage alpin avec vue sur montagne'
},
{
  id: 'r3', name: 'Lampe Petzl Actik Core 450lm', brand: 'Petzl', category: 'Éclairage',
  price: 59, score: 91,
  reason: '847 membres avec un profil similaire au vôtre ont acheté ce modèle. Note communauté : 4.9/5.',
  reasonType: 'community', rating: 4.9, reviews: 847,
  image: "https://images.unsplash.com/photo-1688670565149-d1e7c8ea70a9",
  alt: 'Lampe frontale Petzl rouge avec faisceau lumineux dans obscurité de montagne'
},
{
  id: 'r4', name: 'Veste Arc\'teryx Beta AR', brand: 'Arc\'teryx', category: 'Vêtement',
  price: 599, score: 88,
  reason: 'Tendance +340% cette semaine. Votre destination (Patagonie) nécessite une protection vent/pluie niveau 3.',
  reasonType: 'trending', rating: 4.8, reviews: 234,
  image: "https://images.unsplash.com/photo-1618143928355-3d9afff6ec23",
  alt: 'Veste imperméable Arc\'teryx rouge portée par randonneur dans paysage montagneux venteux'
},
{
  id: 'r5', name: 'Chaussures Salomon X Ultra 4 GTX', brand: 'Salomon', category: 'Chaussures',
  price: 179, originalPrice: 210, score: 85,
  reason: 'Vous avez acheté des chaussures Salomon il y a 18 mois. Durée de vie recommandée : 18-24 mois selon votre kilométrage.',
  reasonType: 'history', rating: 4.6, reviews: 521,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_195136f59-1773090253121.png",
  alt: 'Chaussures de randonnée Salomon bleues sur terrain rocheux de montagne'
},
{
  id: 'r6', name: 'Filtre LifeStraw Peak Series', brand: 'LifeStraw', category: 'Eau',
  price: 89, score: 82,
  reason: 'Votre kit Népal ne contient pas de solution de purification d\'eau. Recommandé pour altitude > 3000m.',
  reasonType: 'profile', rating: 4.7, reviews: 156,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13b527dc4-1783678940758.png",
  alt: 'Filtre à eau LifeStraw bleu utilisé pour boire directement dans un ruisseau de montagne'
}];


const USER_HISTORY: HistoryItem[] = [
{ id: 'h1', action: 'Acheté', item: 'Kit Népal Complet', date: 'Il y a 3 mois', weight: 10 },
{ id: 'h2', action: 'Consulté', item: 'Sacs à dos 60-70L (×3)', date: 'Cette semaine', weight: 8 },
{ id: 'h3', action: 'Wishlist', item: 'Tente 3 saisons ultraléger', date: 'Il y a 2 semaines', weight: 7 },
{ id: 'h4', action: 'Loué', item: 'Crampons 10 pointes', date: 'Il y a 6 mois', weight: 5 },
{ id: 'h5', action: 'Noté ★★★★★', item: 'Chaussures Salomon X Ultra 3', date: 'Il y a 18 mois', weight: 9 }];


const FILTER_CATEGORIES = ['Tout', 'Sac à dos', 'Tente', 'Éclairage', 'Vêtement', 'Chaussures', 'Eau'];

export default function RecommandationsPage() {
  const [activeFilter, setActiveFilter] = useState('Tout');
  const [activeReasonFilter, setActiveReasonFilter] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  const toggleSave = (id: string) => {
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      return next;
    });
  };

  const filtered = RECOMMENDATIONS.filter((r) => {
    const catMatch = activeFilter === 'Tout' || r.category === activeFilter;
    const reasonMatch = !activeReasonFilter || r.reasonType === activeReasonFilter;
    return catMatch && reasonMatch;
  });

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden py-14 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 via-dark-bg to-primary/5 pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
              <Icon name="CpuChipIcon" size={12} variant="outline" />
              PHASE 5 — RECOMMANDATIONS ML
            </div>
            <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              L&apos;IA apprend<br />
              <span className="text-green-400">de chaque expédition</span>
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Suggestions personnalisées basées sur votre historique réel, votre profil voyageur et les retours de la communauté.
            </p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar: History + Signals */}
            <aside className="lg:col-span-1 space-y-6">
              {/* ML Score */}
              <div className="bg-card border border-green-500/20 rounded-2xl p-5">
                <h3 className="font-medium text-white mb-1 flex items-center gap-2 text-sm">
                  <Icon name="CpuChipIcon" size={14} variant="outline" className="text-green-400" />
                  Score de personnalisation
                </h3>
                <div className="flex items-end gap-2 mt-3">
                  <span className="font-display font-800 text-4xl text-green-400" style={{ fontFamily: 'var(--font-display)' }}>87</span>
                  <span className="text-white/40 text-sm mb-1">/100</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                  <div className="bg-green-400 h-1.5 rounded-full" style={{ width: '87%' }} />
                </div>
                <p className="text-xs text-white/40 mt-2">Basé sur 23 interactions</p>
              </div>

              {/* Signals */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-medium text-white mb-4 text-sm">Signaux utilisés</h3>
                <div className="space-y-3">
                  {USER_HISTORY.map((h) =>
                  <div key={h.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/70">
                          <span className="text-white/40">{h.action}</span> {h.item}
                        </p>
                        <p className="text-xs text-white/30">{h.date}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason Filters */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-medium text-white mb-4 text-sm">Filtrer par signal</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveReasonFilter(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${!activeReasonFilter ? 'bg-green-500/10 text-green-400' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                    
                    Tous les signaux
                  </button>
                  {Object.entries(REASON_LABELS).map(([key, val]) =>
                  <button
                    key={key}
                    onClick={() => setActiveReasonFilter(activeReasonFilter === key ? null : key)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${activeReasonFilter === key ? `${val.color} border` : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                    
                      <Icon name={val.icon as string} size={12} variant="outline" />
                      {val.label}
                    </button>
                  )}
                </div>
              </div>
            </aside>

            {/* Main: Recommendations */}
            <div className="lg:col-span-3">
              {/* Category Filter */}
              <div className="flex gap-2 flex-wrap mb-6">
                {FILTER_CATEGORIES.map((cat) =>
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeFilter === cat ? 'bg-green-500 text-white' : 'bg-card border border-border text-white/50 hover:text-white'}`}>
                  
                    {cat}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {filtered.map((product) => {
                  const reasonInfo = REASON_LABELS[product.reasonType];
                  return (
                    <div key={product.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-green-500/20 transition-all group">
                      <div className="relative h-44">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.image} alt={product.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {product.badge &&
                        <div className="absolute top-3 left-3 px-2 py-1 bg-green-500 rounded-full text-xs font-bold text-white">
                            {product.badge}
                          </div>
                        }
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                          <Icon name="CpuChipIcon" size={10} variant="outline" className="text-green-400" />
                          <span className="text-xs font-bold text-green-400">{product.score}%</span>
                        </div>
                        <button
                          onClick={() => toggleSave(product.id)}
                          className="absolute bottom-3 right-3 p-2 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-all">
                          
                          <Icon name={savedItems.has(product.id) ? 'HeartIcon' : 'HeartIcon'} size={14} variant={savedItems.has(product.id) ? 'solid' : 'outline'} className={savedItems.has(product.id) ? 'text-red-400' : 'text-white/60'} />
                        </button>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-xs text-white/40 mb-0.5">{product.brand} · {product.category}</p>
                            <h3 className="font-medium text-white text-sm leading-snug">{product.name}</h3>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            {product.originalPrice &&
                            <p className="text-xs text-white/30 line-through">{product.originalPrice}€</p>
                            }
                            <p className="font-display font-700 text-white" style={{ fontFamily: 'var(--font-display)' }}>{product.price}€</p>
                          </div>
                        </div>

                        <div className={`flex items-start gap-1.5 p-2.5 rounded-lg border text-xs mb-3 ${reasonInfo.color}`}>
                          <Icon name={reasonInfo.icon as string} size={11} variant="outline" className="mt-0.5 flex-shrink-0" />
                          <p className="leading-relaxed">{product.reason}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-amber-400">
                            <Icon name="StarIcon" size={11} variant="solid" />
                            <span>{product.rating}</span>
                            <span className="text-white/30">({product.reviews})</span>
                          </div>
                          <button className="px-4 py-1.5 bg-primary rounded-lg text-white text-xs font-medium hover:bg-primary/90 transition-all">
                            Ajouter au kit
                          </button>
                        </div>
                      </div>
                    </div>);

                })}
              </div>

              {filtered.length === 0 &&
              <div className="text-center py-16 text-white/30">
                  <Icon name="MagnifyingGlassIcon" size={32} variant="outline" className="mx-auto mb-3" />
                  <p>Aucune recommandation pour ce filtre</p>
                </div>
              }
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>);

}