'use client';

import React, { useState, useEffect, useRef } from 'react';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  id: string;
  type: 'product' | 'club' | 'country' | 'guide';
  title: string;
  subtitle?: string;
  url: string;
  badge?: string;
  image?: string;
  price?: number;
}

const POPULAR_SEARCHES = [
  { label: 'Tente 2 places trekking', category: 'Matériel', url: '/boutique?category=tentes' },
  { label: 'Club Randonnée Alpes', category: 'Communauté', url: '/clubs' },
  { label: 'Sac de couchage -5°C', category: 'Couchage', url: '/boutique?search=sac' },
  { label: 'Guide Islande & Volcans', category: 'Destination', url: '/pays' },
  { label: 'Configurateur IA de Kit', category: 'Outil IA', url: '/ai-configurator' },
];

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'product' | 'club' | 'guide'>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient()).current;

  // Keyboard shortcut listener (Escape & Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via synthetic event or prop
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();
      const combinedResults: SearchResultItem[] = [];

      try {
        // 1. Search shop products
        const { data: products } = await supabase
          .from('shop_products')
          .select('id, name, category, price, image_url')
          .or(`name.ilike.%${q}%,category.ilike.%${q}%`)
          .limit(5);

        if (products) {
          products.forEach((p: any) => {
            combinedResults.push({
              id: p.id,
              type: 'product',
              title: p.name,
              subtitle: p.category ? `Matériel • ${p.category}` : 'Équipement',
              url: `/boutique`,
              badge: 'Boutique',
              image: p.image_url,
              price: p.price,
            });
          });
        }

        // 2. Search clubs
        const { data: clubs } = await supabase
          .from('clubs')
          .select('id, name, slug, type, cover_url, members_count')
          .or(`name.ilike.%${q}%,description.ilike.%${q}%,type.ilike.%${q}%`)
          .limit(4);

        if (clubs) {
          clubs.forEach((c: any) => {
            combinedResults.push({
              id: c.id,
              type: 'club',
              title: c.name,
              subtitle: `${c.members_count || 0} membres • ${c.type || 'Club'}`,
              url: `/clubs/${c.slug}`,
              badge: 'Club',
              image: c.cover_url,
            });
          });
        }

        // 3. Static destinations & guides match
        const destinations = [
          { name: 'Islande', desc: 'Terres de feu et de glace', url: '/pays', badge: 'Destination' },
          { name: 'Norvège', desc: 'Fjords & Aurores Boréales', url: '/pays', badge: 'Destination' },
          { name: 'Nepal', desc: 'Expéditions Himalaya & Annapurna', url: '/pays', badge: 'Destination' },
          { name: 'Suisse & Alpes', desc: 'Haute Montagne & Earth', url: '/pays', badge: 'Destination' },
          { name: 'GR20 Corse', desc: 'Sentier mythique de randonnée', url: '/explorer', badge: 'Aventure' },
        ];

        destinations.forEach((d, idx) => {
          if (d.name.toLowerCase().includes(q.toLowerCase()) || d.desc.toLowerCase().includes(q.toLowerCase())) {
            combinedResults.push({
              id: `dest-${idx}`,
              type: 'guide',
              title: d.name,
              subtitle: d.desc,
              url: d.url,
              badge: d.badge,
            });
          }
        });
      } catch (err) {
        console.error('Error during global search:', err);
      }

      setResults(combinedResults);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, supabase]);

  if (!isOpen) return null;

  const filteredResults = results.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  const handleSelectResult = (url: string) => {
    onClose();
    router.push(url);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onClose();
      router.push(`/boutique?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md animate-fade-in">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Search Container Card */}
      <div className="relative z-10 w-full max-w-2xl bg-[#1C2620] text-white rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh] animate-slide-up">
        
        {/* Search Header Input */}
        <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 border-b border-white/10 flex items-center gap-3">
          <Icon name="MagnifyingGlassIcon" size={22} className="text-emerald-400 shrink-0 ml-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher du matériel, un club, un paysage, une destination..."
            className="w-full bg-transparent border-none outline-none text-white placeholder-white/40 text-base sm:text-lg font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors shrink-0"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors shrink-0"
          >
            Esc
          </button>
        </form>

        {/* Filter Categories Bar (if results exist) */}
        {query.trim() && (
          <div className="px-5 py-2.5 bg-black/30 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Tous les résultats' },
              { id: 'product', label: 'Équipements' },
              { id: 'club', label: 'Clubs' },
              { id: 'guide', label: 'Destinations' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-emerald-500 text-emerald-950 shadow-md'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Results Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-white/50 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Recherche dans la base de données...</span>
            </div>
          )}

          {!loading && query.trim() && filteredResults.length === 0 && (
            <div className="py-12 text-center text-white/50 space-y-3">
              <Icon name="MagnifyingGlassIcon" size={36} className="mx-auto text-white/20" />
              <p className="text-base font-semibold text-white">Aucun résultat trouvé pour « {query} »</p>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                Essayez des termes plus généraux comme « tente », « randonnée », « sac », ou consultez notre boutique complète.
              </p>
              <button
                onClick={() => handleSelectResult(`/boutique?search=${encodeURIComponent(query.trim())}`)}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-emerald-950 font-extrabold rounded-full text-xs hover:bg-emerald-400 transition-colors"
              >
                Voir dans la boutique →
              </button>
            </div>
          )}

          {!loading && query.trim() && filteredResults.length > 0 && (
            <div className="space-y-2">
              {filteredResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectResult(item.url)}
                  className="group flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-900/30 border border-white/5 hover:border-emerald-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Icon
                          name={item.type === 'product' ? 'ShoppingBagIcon' : item.type === 'club' ? 'UsersIcon' : 'GlobeAltIcon'}
                          size={20}
                          className="text-emerald-400"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm sm:text-base truncate group-hover:text-emerald-300 transition-colors">
                          {item.title}
                        </h4>
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-emerald-300 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-white/50 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {item.price !== undefined && (
                      <span className="font-mono font-bold text-emerald-400 text-sm">{item.price} €</span>
                    )}
                    <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-emerald-500 group-hover:text-emerald-950 flex items-center justify-center text-white/50 transition-all">
                      <Icon name="ArrowRightIcon" size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query.trim() && (
            <div className="space-y-6 py-2">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-400/80 mb-3 flex items-center gap-2">
                  <Icon name="SparklesIcon" size={14} /> Searches Populaires
                </h4>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleSelectResult(item.url)}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-white/80 hover:text-white flex items-center gap-2 transition-all group"
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] text-white/40 group-hover:text-emerald-400 font-mono">• {item.category}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-900/60 border border-emerald-500/20 flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-bold text-white text-sm">Besoin d&apos;un kit personnalisé ?</h5>
                  <p className="text-xs text-white/60 mt-0.5">Laissez notre IA composer votre équipement idéal selon vos critères.</p>
                </div>
                <button
                  onClick={() => handleSelectResult('/ai-configurator')}
                  className="px-4 py-2 bg-emerald-400 text-emerald-950 font-extrabold rounded-xl text-xs whitespace-nowrap hover:bg-emerald-300 transition-colors shadow-lg"
                >
                  Lancer l'IA
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40 px-5">
          <span>Kit du Voyageur • Recherche intelligente</span>
          <span>Appuyez sur <kbd className="bg-white/10 text-white px-1.5 py-0.5 rounded font-mono text-[10px]">ENTRÉE</kbd> pour valider</span>
        </div>
      </div>
    </div>
  );
}
