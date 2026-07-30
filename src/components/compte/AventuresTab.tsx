'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { UserProfile, Aventure } from '@/lib/mock/compte-marceline';
import ProchainVoyageCard from '@/components/compte/ProchainVoyageCard';
import { createClient } from '@/lib/supabase/client';

interface AventuresTabProps {
  profile: UserProfile;
}

export default function AventuresTab({ profile }: AventuresTabProps) {
  const [aventures, setAventures] = useState<Aventure[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Toutes');
  const [activeYear, setActiveYear] = useState('Toutes');
  const [activityMetric, setActivityMetric] = useState('Sorties');
  const [visibleCount, setVisibleCount] = useState(5);
  const router = useRouter();
  
  useEffect(() => {
    async function fetchAventures() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setAventures([]);
          return;
        }

        const { data, error } = await supabase
          .from('travel_groups')
          .select('*')
          .eq('owner_id', user.id)
          .order('departure_date', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map((item: any) => ({
          id: item.id,
          title: item.name,
          date_detail: item.departure_date ? `${new Date(item.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Date inconnue',
          duration: item.departure_date && item.return_date 
            ? `${Math.round((new Date(item.return_date).getTime() - new Date(item.departure_date).getTime()) / (1000 * 60 * 60 * 24))} jours`
            : 'N/A',
          companions: [],
          distance: `${item.group_xp || 0} km`,
          elevation: `${item.optimization_score || 0} m D+`,
          status: item.status || 'Planifiée',
          image_url: item.cover_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
        }));

        setAventures(formatted.length > 0 ? formatted : []);
      } catch (err) {
        console.error("Error fetching aventures:", err);
        setAventures([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAventures();
  }, []);

  const filteredAventures = aventures.filter(av => {
    // Basic year filter using the date string (mock data uses strings like '12-14 oct. 2026')
    if (activeYear !== 'Toutes' && !av.date_detail.includes(activeYear)) return false;
    
    if (activeTab === 'Toutes') return true;
    if (activeTab === 'Terminées') return av.status === 'Terminée';
    if (activeTab === 'Planifiées') return av.status === 'Planifiée';
    if (activeTab === 'Brouillons') return av.status === 'Brouillon';
    return true;
  });

  const handleExport = () => {
    try {
      const headers = ['ID', 'Titre', 'Date', 'Durée', 'Distance', 'Dénivelé', 'Statut'];
      const csvContent = [
        headers.join(','),
        ...aventures.map(av => 
          [av.id, `"${av.title.replace(/"/g, '""')}"`, `"${av.date_detail}"`, av.duration, av.distance, av.elevation, av.status].join(',')
        )
      ].join('\\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'mes_aventures.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur lors de l'exportation:", err);
      alert("Une erreur s'est produite lors de l'exportation.");
    }
  };

  return (
    <div className="space-y-12 pb-24">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620]">
            Tous vos <em className="font-serif italic text-[#2D5A3D] font-normal">groupes</em>
          </h2>
          <p className="text-xs text-[#5C6B5E] mt-2 font-serif italic">
            42 sorties enregistrées depuis mars 2023 - 2 584 km cumulés - 148 km de dénivelé positif.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-white border border-[#E8E4D8] rounded-full text-xs font-bold text-[#1C2620] hover:bg-[#F5F2E8] transition-colors flex items-center gap-2 shadow-sm"
          >
            <Icon name="ArrowDownTrayIcon" size={14} />
            Exporter
          </button>
          <Link
            href="/nouveau-groupe"
            className="flex items-center gap-2 bg-[#1C2620] hover:bg-[#2A3830] text-white px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-md hover:shadow-lg"
          >
            <Icon name="PlusIcon" size={14} />
            Nouveau groupe
          </Link>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E4D8]">
          <h3 className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-2">DISTANCE 2026</h3>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620]">786</span>
            <span className="text-sm font-bold text-[#5C6B5E] font-serif italic">km</span>
          </div>
          <p className="text-[10px] text-[#5C6B5E] flex items-center gap-1">
            <Icon name="ArrowTrendingUpIcon" size={10} className="text-[#2D5A3D]" />
            <span className="text-[#2D5A3D] font-bold">+ 15 %</span> vs 2025 - 89 % de l'objectif annuel
          </p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E4D8]">
          <h3 className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-2">DÉNIVELÉ POSITIF</h3>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620]">32,4</span>
            <span className="text-sm font-bold text-[#5C6B5E] font-serif italic">km D+</span>
          </div>
          <p className="text-[10px] text-[#5C6B5E]">
            + 2 400 m ce mois - 12 sommets &gt; 2000m
          </p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E4D8]">
          <h3 className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-2">NUITS EN REFUGE</h3>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620]">28</span>
            <span className="text-sm font-bold text-[#5C6B5E] font-serif italic">nuits</span>
          </div>
          <p className="text-[10px] text-[#5C6B5E]">
            12 refuges différents - 5 nuits en bivouac
          </p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E4D8]">
          <h3 className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-2">CO2 ÉCONOMISÉ</h3>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display font-800 text-3xl sm:text-4xl text-[#1C2620]">142</span>
            <span className="text-sm font-bold text-[#5C6B5E] font-serif italic">kg</span>
          </div>
          <p className="text-[10px] text-[#5C6B5E]">
            <span className="text-[#17402C] font-bold">équivalent</span> 1 vol Paris-Nice
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ACTIVITY CHART */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-[#E8E4D8]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-display font-800 text-xl text-[#1C2620]">
                  Activité <em className="font-serif italic text-[#2D5A3D] font-normal">2026</em>
                </h3>
                <p className="text-xs text-[#5C6B5E] mt-1">
                  42 sorties réparties sur l'année - pic d'activité en septembre & octobre.
                </p>
              </div>
              <div className="flex bg-[#F5F2E8] p-1 rounded-full">
                <button onClick={() => setActivityMetric('Sorties')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activityMetric === 'Sorties' ? 'bg-white text-[#1C2620] shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}>Sorties</button>
                <button onClick={() => setActivityMetric('Distance')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activityMetric === 'Distance' ? 'bg-white text-[#1C2620] shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}>Distance</button>
                <button onClick={() => setActivityMetric('D+')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activityMetric === 'D+' ? 'bg-white text-[#1C2620] shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}>D+</button>
              </div>
            </div>
            
            <div className="h-48 mt-8 relative flex items-end justify-between px-2">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                <div className="border-b border-dashed border-[#E8E4D8] w-full"></div>
                <div className="border-b border-dashed border-[#E8E4D8] w-full"></div>
                <div className="border-b border-dashed border-[#E8E4D8] w-full"></div>
                <div className="border-b border-[#E8E4D8] w-full"></div>
              </div>
              
              {/* Bars */}
              {[
                { label: 'JAN', val: activityMetric === 'Sorties' ? 15 : activityMetric === 'Distance' ? 25 : 10, color: '#C8C3B0' },
                { label: 'FÉV', val: activityMetric === 'Sorties' ? 20 : activityMetric === 'Distance' ? 30 : 15, color: '#C8C3B0' },
                { label: 'MAR', val: activityMetric === 'Sorties' ? 35 : activityMetric === 'Distance' ? 50 : 25, color: '#9BB8A1' },
                { label: 'AVR', val: activityMetric === 'Sorties' ? 45 : activityMetric === 'Distance' ? 65 : 35, color: '#9BB8A1' },
                { label: 'MAI', val: activityMetric === 'Sorties' ? 55 : activityMetric === 'Distance' ? 80 : 45, color: '#2D5A3D' },
                { label: 'JUN', val: activityMetric === 'Sorties' ? 60 : activityMetric === 'Distance' ? 85 : 50, color: '#2D5A3D' },
                { label: 'JUL', val: activityMetric === 'Sorties' ? 55 : activityMetric === 'Distance' ? 75 : 45, color: '#2D5A3D' },
                { label: 'AOÛ', val: activityMetric === 'Sorties' ? 65 : activityMetric === 'Distance' ? 90 : 55, color: '#2D5A3D' },
                { label: 'SEP', val: activityMetric === 'Sorties' ? 80 : activityMetric === 'Distance' ? 100 : 70, color: '#2D5A3D' },
                { label: 'OCT', val: activityMetric === 'Sorties' ? 85 : activityMetric === 'Distance' ? 120 : 80, color: '#17402C' }, // Highlighted
                { label: 'NOV', val: 0, color: '#E8E4D8' },
                { label: 'DÉC', val: 0, color: '#E8E4D8' },
              ].map((month, idx) => {
                // Normalize value to max 100 for height
                const normalizedVal = month.val > 100 ? 100 : month.val;
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 relative z-10 w-full group">
                    <div className="w-full flex justify-center items-end h-40">
                      <div 
                        className="w-4 sm:w-6 rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                        style={{ height: `${normalizedVal}%`, backgroundColor: month.color }}
                      ></div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#5C6B5E]">{month.label}</span>
                    {month.val > 0 && <span className="absolute -top-4 text-[9px] font-bold text-[#2D5A3D] opacity-0 group-hover:opacity-100 transition-opacity">{month.val}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* HISTORIQUE COMPLET */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-[#E8E4D8]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="font-display font-800 text-xl text-[#1C2620]">
                  Historique <em className="font-serif italic text-[#2D5A3D] font-normal">complet</em>
                </h3>
              </div>
              <div className="text-[10px] text-[#5C6B5E] font-mono">
                {aventures.length} résultats · triés par date
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[#F5F2E8] pb-4">
              <span className="text-[10px] font-mono text-[#C8C3B0] mr-2">Année</span>
              <button onClick={() => setActiveYear('Toutes')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activeYear === 'Toutes' ? 'bg-[#1C2620] text-white' : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8]'}`}>Toutes</button>
              <button onClick={() => setActiveYear('2026')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activeYear === '2026' ? 'bg-[#1C2620] text-white' : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8]'}`}>2026</button>
              <button onClick={() => setActiveYear('2025')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activeYear === '2025' ? 'bg-[#1C2620] text-white' : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8]'}`}>2025</button>
              <button onClick={() => setActiveYear('2024')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activeYear === '2024' ? 'bg-[#1C2620] text-white' : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8]'}`}>2024</button>
              <button onClick={() => setActiveYear('2023')} className={`px-3 py-1 rounded-full text-[10px] font-bold ${activeYear === '2023' ? 'bg-[#1C2620] text-white' : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8]'}`}>2023</button>
              
              <div className="w-[1px] h-4 bg-[#E8E4D8] mx-2"></div>
              
              <span className="text-[10px] font-mono text-[#C8C3B0] mr-2">Statut</span>
              {['Toutes', 'Terminées', 'Planifiées', 'Brouillons', 'Massifs (4)'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${activeTab === tab ? 'bg-[#EAF0EB] text-[#2D5A3D] border border-[#2D5A3D]/20' : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8] border border-transparent'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-[#5C6B5E] text-xs">Chargement des groupes...</div>
              ) : filteredAventures.length === 0 ? (
                <div className="text-center py-8 text-[#5C6B5E] text-xs">Aucun groupe trouvé.</div>
              ) : (
                filteredAventures.slice(0, visibleCount).map((av) => (
                  <div key={av.id} onClick={() => router.push(`/groupes/${av.id}`)} className="group flex flex-col sm:flex-row items-center justify-between p-3 rounded-2xl hover:bg-[#F5F2E8] transition-colors border border-transparent hover:border-[#E8E4D8] gap-4 cursor-pointer">
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                      <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden shrink-0 shadow-sm relative">
                        <img src={av.image_url || '/assets/images/no_image.png'} alt={av.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-[#1C2620] truncate">{av.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className="text-[10px] text-[#5C6B5E] font-mono">{av.date_detail}</span>
                          {av.companions && av.companions.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-[#C8C3B0]">·</span>
                              <div className="flex -space-x-1.5">
                                {av.companions.slice(0, 3).map((c, i) => (
                                  <div key={i} className="w-4 h-4 rounded-full bg-[#E8E4D8] border border-white flex items-center justify-center overflow-hidden">
                                    <span className="text-[6px] font-bold text-[#5C6B5E]">{c.charAt(0)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1.5">
                          <span className="text-[8px] font-mono font-bold uppercase tracking-wider bg-[#EAF0EB] text-[#2D5A3D] px-2 py-0.5 rounded-sm">Refuge gardé</span>
                          <span className="text-[8px] font-mono font-bold uppercase tracking-wider bg-[#F5F2E8] text-[#5C6B5E] px-2 py-0.5 rounded-sm">Crêtes</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <div className="font-display font-800 text-sm text-[#1C2620]">{av.distance}</div>
                        <div className="text-[10px] text-[#5C6B5E] font-mono">{av.elevation}</div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          av.status === 'Terminée' ? 'bg-[#EAF0EB] text-[#2D5A3D]' : 
                          av.status === 'En cours' ? 'bg-[#FFF3E0] text-[#17402C]' : 
                          'bg-[#F5F2E8] text-[#5C6B5E]'
                        }`}>
                          {av.status}
                        </span>
                        
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button className="w-8 h-8 rounded-full bg-white border border-[#E8E4D8] flex items-center justify-center text-[#5C6B5E] hover:text-[#1C2620] hover:bg-[#F5F2E8]">
                            <Icon name="ArrowRightIcon" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>
            
            {visibleCount < filteredAventures.length && (
              <div className="mt-6 flex justify-center">
                <button 
                  onClick={() => setVisibleCount(prev => prev + 5)}
                  className="px-5 py-2 rounded-full border border-[#E8E4D8] text-xs font-bold text-[#5C6B5E] hover:bg-[#F5F2E8] transition-colors bg-white"
                >
                  Charger {filteredAventures.length - visibleCount} groupe{filteredAventures.length - visibleCount > 1 ? 's' : ''} plus ancien{filteredAventures.length - visibleCount > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>

          {/* VOS TERRAINS DE JEU */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-[#E8E4D8]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-display font-800 text-xl text-[#1C2620]">
                  Vos terrains <em className="font-serif italic text-[#2D5A3D] font-normal">de jeu</em>
                </h3>
                <p className="text-xs text-[#5C6B5E] mt-1">
                  Une carte de vos groupes — la taille des points reflète le nombre de sorties.
                </p>
              </div>
              <div className="text-[10px] text-[#5C6B5E] font-mono">
                France - 8 massifs explorés
              </div>
            </div>

            <div className="relative w-full h-64 bg-[#C2D6C6] rounded-3xl overflow-hidden border border-[#9BB8A1] shadow-inner">
              {/* Simulated Map SVG graphic lines */}
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 800 300" preserveAspectRatio="none">
                <path d="M0 150 Q 200 50, 400 150 T 800 150" fill="none" stroke="#2D5A3D" strokeWidth="1" />
                <path d="M0 200 Q 300 100, 500 200 T 800 150" fill="none" stroke="#2D5A3D" strokeWidth="1" />
                <path d="M0 100 Q 150 150, 300 100 T 800 200" fill="none" stroke="#2D5A3D" strokeWidth="1" />
              </svg>
              
              {/* Map Points */}
              <div className="absolute top-[30%] left-[45%] flex flex-col items-center">
                <div className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md border border-[#2D5A3D]/20 mb-1 z-10">
                  <span className="text-[10px] font-bold text-[#2D5A3D]">18</span>
                </div>
                <div className="text-[9px] font-bold text-[#1C2620] bg-white/60 px-1.5 rounded backdrop-blur">Chartreuse</div>
              </div>
              
              <div className="absolute top-[60%] left-[48%] flex flex-col items-center">
                <div className="w-6 h-6 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md border border-[#2D5A3D]/20 mb-1 z-10">
                  <span className="text-[9px] font-bold text-[#2D5A3D]">9</span>
                </div>
                <div className="text-[9px] font-bold text-[#1C2620] bg-white/60 px-1.5 rounded backdrop-blur">Belledonne</div>
              </div>

              <div className="absolute top-[20%] left-[60%] flex flex-col items-center">
                <div className="w-5 h-5 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md border border-[#2D5A3D]/20 mb-1 z-10">
                  <span className="text-[8px] font-bold text-[#2D5A3D]">2</span>
                </div>
                <div className="text-[8px] font-bold text-[#1C2620] bg-white/60 px-1.5 rounded backdrop-blur">Aravis</div>
              </div>

              <div className="absolute top-[50%] left-[38%] flex flex-col items-center">
                <div className="w-5 h-5 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md border border-[#2D5A3D]/20 mb-1 z-10">
                  <span className="text-[8px] font-bold text-[#2D5A3D]">8</span>
                </div>
                <div className="text-[8px] font-bold text-[#1C2620] bg-white/60 px-1.5 rounded backdrop-blur">Vercors</div>
              </div>

              <div className="absolute top-[75%] left-[55%] flex flex-col items-center">
                <div className="w-5 h-5 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md border border-[#2D5A3D]/20 mb-1 z-10">
                  <span className="text-[8px] font-bold text-[#2D5A3D]">4</span>
                </div>
                <div className="text-[8px] font-bold text-[#1C2620] bg-white/60 px-1.5 rounded backdrop-blur">Écrins</div>
              </div>

              <div className="absolute top-[85%] left-[65%] flex flex-col items-center">
                <div className="w-4 h-4 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md border border-[#2D5A3D]/20 mb-1 z-10">
                  <span className="text-[7px] font-bold text-[#2D5A3D]">2</span>
                </div>
                <div className="text-[7px] font-bold text-[#1C2620] bg-white/60 px-1.5 rounded backdrop-blur">Queyras</div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <ProchainVoyageCard voyage={{ id: '', title: 'Aucun', title_highlight: 'voyage prévu', days_left: 0, date_range: '', companions: '', refuges_count: 0, preparation_percentage: 0, preparation_detail: '', tasks_left: 0, group_id: '' } as any} compact={true} />
          
          {/* TOP MASSIFS */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E4D8]">
            <h3 className="font-display font-800 text-lg text-[#1C2620] mb-1">
              Top <em className="font-serif italic text-[#2D5A3D] font-normal">massifs</em>
            </h3>
            <p className="text-[10px] text-[#5C6B5E] mb-6">Où vous marchez le plus</p>
            
            <div className="space-y-4">
              {[
                { rank: 'I', name: 'Chartreuse', sorties: 18, dist: 320, pct: 100 },
                { rank: 'II', name: 'Belledonne', sorties: 9, dist: 184, pct: 60 },
                { rank: 'III', name: 'Vercors', sorties: 8, dist: 142, pct: 50 },
                { rank: 'IV', name: 'Écrins', sorties: 4, dist: 84, pct: 30 },
                { rank: 'V', name: 'Aravis', sorties: 2, dist: 48, pct: 15 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 font-serif italic text-lg text-[#C8C3B0] text-center">{item.rank}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-[#1C2620]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2 text-[9px] text-[#5C6B5E] font-mono w-20">
                        <span>{item.sorties} sorties</span>
                        <span>{item.dist} km</span>
                      </div>
                      <div className="flex-1 h-1 bg-[#F5F2E8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#2D5A3D] rounded-full" style={{ width: `${item.pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MEILLEUR MOIS */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E4D8] text-center">
            <h3 className="font-display font-800 text-lg text-[#1C2620] mb-1">
              Meilleur <em className="font-serif italic text-[#2D5A3D] font-normal">mois</em>
            </h3>
            <p className="text-[10px] text-[#5C6B5E] mb-4">Octobre 2026, zone Hestia</p>
            
            <div className="font-display font-800 text-3xl text-[#2D5A3D] mb-2 tracking-tight">
              Octobre
            </div>
            
            <div className="flex justify-center items-center gap-3 text-[10px] font-mono text-[#5C6B5E] uppercase font-bold tracking-widest mb-4">
              <span>9 SORTIES</span>
              <span className="w-1 h-1 bg-[#C8C3B0] rounded-full"></span>
              <span>158 KM</span>
              <span className="w-1 h-1 bg-[#C8C3B0] rounded-full"></span>
              <span>8 400 M D+</span>
            </div>
            
            <div className="bg-[#EAF0EB] rounded-xl p-3">
              <div className="text-xs font-bold text-[#2D5A3D] mb-0.5">Nouveau record personnel</div>
              <div className="text-[9px] text-[#5C6B5E]">Plus grosse activité mensuelle depuis mars 2023</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
