'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import CompteBackground from '@/components/compte/CompteBackground';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import 'leaflet/dist/leaflet.css';

// Color Palette
const ACCENT_COLORS = [
  { id: 'darkgreen', value: '#17402C', label: 'Émeraude Sombre' },
  { id: 'sage', value: '#5C6B5E', label: 'Sauge Alpin' },
  { id: 'ochre', value: '#D97746', label: 'Ocre Volcan' },
  { id: 'yellow', value: '#E5A638', label: 'Or Automnal' },
  { id: 'blue', value: '#3A63B2', label: 'Bleu Glacier' },
];

// Pictograms
const PICTOGRAMS = ['⛺', '🔥', '🏔️', '🌲', '🗺️', '🌄', '🎒', '🧭', '🥾', '🎿', '🛶', '🚲'];

// Default Trails
const DEFAULT_TRAILS = [
  { id: 't-1', name: 'Traversée de la Chartreuse (GR9)', region: 'Chartreuse', distance_km: 27.4, elevation_gain: 1620, start_lat: 45.33, start_lng: 5.82 },
  { id: 't-2', name: 'Tour du Mont-Blanc Intégral', region: 'Mont-Blanc', distance_km: 170, elevation_gain: 10000, start_lat: 45.92, start_lng: 6.87 },
  { id: 't-3', name: 'Hautes Terres du Vercors', region: 'Vercors', distance_km: 48.5, elevation_gain: 2100, start_lat: 44.98, start_lng: 5.53 },
  { id: 't-4', name: 'Tour des Glaciers de la Vanoise', region: 'Vanoise', distance_km: 72.0, elevation_gain: 3800, start_lat: 45.38, start_lng: 6.74 },
  { id: 't-5', name: 'Traversée des Écrins (GR54)', region: 'Écrins', distance_km: 184, elevation_gain: 12800, start_lat: 44.92, start_lng: 6.35 },
];

export default function NouveauGroupePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<'infos' | 'sentier' | 'logistique' | 'materiel' | 'style'>('infos');

  // Form State
  const [name, setName] = useState('Traversée de la Chartreuse');
  const [description, setDescription] = useState('3 jours d’autonomie sur les crêtes et bivouacs avec nuit en refuge.');
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0].value);
  const [pictogram, setPictogram] = useState(PICTOGRAMS[0]);
  const [selectedTrail, setSelectedTrail] = useState(DEFAULT_TRAILS[0]);
  const [level, setLevel] = useState('Rythme moyen régulier');
  const [groupType, setGroupType] = useState('Traversée en autonomie');

  // Logistique & Dates
  const [startDate, setStartDate] = useState('2026-10-12');
  const [endDate, setEndDate] = useState('2026-10-14');
  const [dateFlexibility, setDateFlexibility] = useState('Dates fermes');
  const [hebergementType, setHebergementType] = useState('Bivouac & Refuges');
  const [estimatedBudget, setEstimatedBudget] = useState(120);
  const [maxMembers, setMaxMembers] = useState(6);
  const [recruitmentMode, setRecruitmentMode] = useState('validation'); // 'validation' | 'open'

  // Required Equipment
  const [requiredGear, setRequiredGear] = useState([
    { id: 'g1', name: 'Duvet confort 0°C', checked: true },
    { id: 'g2', name: 'Tente 3 saisons ou tarp', checked: true },
    { id: 'g3', name: 'Chaussures de tige haute', checked: true },
    { id: 'g4', name: 'Lampe frontale + piles', checked: true },
    { id: 'g5', name: 'Veste imperméable Hardshell', checked: true },
  ]);
  const [newGearInput, setNewGearInput] = useState('');

  // Leaflet map container ref for selected trail
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;
    const container = mapContainerRef.current;

    if (leafletMap.current) {
      try { leafletMap.current.remove(); } catch {}
      leafletMap.current = null;
    }
    try { delete (container as any)._leaflet_id; } catch {}

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const lat = selectedTrail.start_lat || 45.33;
      const lng = selectedTrail.start_lng || 5.82;

      const map = L.map(container, {
        center: [lat, lng],
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
      });

      leafletMap.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        keepBuffer: 6,
      }).addTo(map);

      const r = (selectedTrail.distance_km / 111) * 0.35;
      const routeCoords: [number, number][] = [
        [lat, lng],
        [lat + r * 0.35, lng + r * 0.25],
        [lat + r * 0.7, lng + r * 0.65],
        [lat + r * 0.85, lng + r * 0.3],
        [lat + r * 1.1, lng + r * 0.8],
        [lat + r * 0.75, lng + r * 1.15],
        [lat + r * 0.25, lng + r * 0.85],
        [lat, lng],
      ];

      L.polyline(routeCoords, { color: '#FFFFFF', weight: 6, opacity: 0.9 }).addTo(map);
      const polyline = L.polyline(routeCoords, { color: accentColor, weight: 4 }).addTo(map);
      try { map.fitBounds(polyline.getBounds(), { padding: [25, 25] }); } catch {}

      L.circleMarker(routeCoords[0], { radius: 6, color: '#FFFFFF', fillColor: '#17402C', fillOpacity: 1, weight: 2 }).addTo(map);

      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 150);
    });

    return () => {
      if (leafletMap.current) {
        try { leafletMap.current.remove(); } catch {}
        leafletMap.current = null;
      }
    };
  }, [selectedTrail, accentColor, activeStep]);

  const handleAddGear = () => {
    if (!newGearInput.trim()) return;
    setRequiredGear(prev => [...prev, { id: `g-${Date.now()}`, name: newGearInput.trim(), checked: true }]);
    setNewGearInput('');
  };

  const handleRemoveGear = (id: string) => {
    setRequiredGear(prev => prev.filter(g => g.id !== id));
  };

  const handleCreateGroup = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name,
        description,
        massif: selectedTrail.region,
        distance_km: selectedTrail.distance_km,
        elevation_gain: selectedTrail.elevation_gain,
        start_date: startDate,
        end_date: endDate,
        max_members: maxMembers,
        creator_id: user?.id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('groupes').insert([payload]).select().single();
      const groupId = data?.id || `grp-${Date.now()}`;

      if (error) {
        const local = JSON.parse(localStorage.getItem('user_created_groups') || '[]');
        localStorage.setItem('user_created_groups', JSON.stringify([{ id: groupId, ...payload, requiredGear, level, hebergementType, estimatedBudget }, ...local]));
      }

      toast('Expédition créée avec succès ! 🎒', 'success');
      setTimeout(() => {
        router.push(`/groupes/${groupId}`);
      }, 800);
    } catch (err) {
      console.error(err);
      router.push('/communaute?tab=groupes');
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { id: 'infos' as const, label: 'Objectif & Niveau', short: '01', desc: 'Titre, esprit & rythme' },
    { id: 'sentier' as const, label: 'Sentier & GPX', short: '02', desc: 'Trace, massif & D+' },
    { id: 'logistique' as const, label: 'Dates & Logistique', short: '03', desc: 'Calendrier, budget & hébergement' },
    { id: 'materiel' as const, label: 'Équipiers & Sac exigé', short: '04', desc: `${requiredGear.length} équipements requis` },
    { id: 'style' as const, label: 'Personnalisation', short: '05', desc: 'Couleur & Pictogramme' },
  ];

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
      <CompteBackground />
      <Header />

      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">
        {/* COLONNE GAUCHE (Nav & Stepper) - 230px */}
        <aside className="w-[230px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3">
          <CommunityHubNav layoutVariant="vertical" activeTab="groupes" />

          <nav className="w-full glass p-1.5 rounded-2xl flex flex-col gap-1">
            <div className="px-2 py-0.5 flex items-center justify-between border-b border-[#17402C]/10 mb-0.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5C6B5E]">Expédition</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {STEPS.map((st) => {
              const isActive = activeStep === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveStep(st.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold select-none transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-white/95 to-white/75 text-[#17402C] font-bold border border-white/80'
                      : 'text-[#5C6B5E] hover:bg-white/40 hover:text-[#17402C]'
                  }`}
                >
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-[#17402C] text-white' : 'bg-black/5 text-[#5C6B5E]'}`}>
                    {st.short}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate font-bold">{st.label}</div>
                    <div className="text-[9px] text-[#5C6B5E]/80 truncate">{st.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* COLONNE CENTRALE (Formulaire dynamique) */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
            <Link href="/communaute" className="hover:text-[#17402C] transition-colors">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
            <Link href="/communaute?tab=groupes" className="hover:text-[#17402C] transition-colors">Groupes</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
            <span className="text-[#17402C] font-semibold">Créer une expédition</span>
          </div>

          {/* STEP 1: INFOS */}
          {activeStep === 'infos' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Objectif, Esprit &amp; Niveau</h2>
                  <p className="text-xs text-[#5C6B5E]">Donnez un titre percutant, décrivez le projet et fixez l’engagement requis.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">01 · OBJECTIF</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Nom de l’expédition *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Traversée de la Chartreuse en automne"
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/20 font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Type d'aventure</label>
                    <select
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    >
                      <option>Traversée en autonomie</option>
                      <option>Week-end bivouac &amp; sommet</option>
                      <option>Randonnée avec nuits en refuge</option>
                      <option>Stage itinérant &amp; orientation</option>
                      <option>Alpinisme &amp; haute route</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Niveau d'engagement requis</label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    >
                      <option>Tranquille &amp; contemplatif</option>
                      <option>Rythme moyen régulier (4-6h/j)</option>
                      <option>Sportif &amp; engagé (+1000m D+/j)</option>
                      <option>Alpin &amp; passages techniques</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Description du projet &amp; ambiance recherchée</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Précisez la philosophie du groupe, les pauses prévues, le portage..."
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl p-3 text-xs text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/20 leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('sentier')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Sentier &amp; GPX →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SENTIER & TRACE */}
          {activeStep === 'sentier' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Sentier &amp; Trace GPX</h2>
                  <p className="text-xs text-[#5C6B5E]">Choisissez un itinéraire certifié pour générer le profil 3D en direct.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">02 · SENTIER</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEFAULT_TRAILS.map((tr) => {
                    const isSelected = selectedTrail.id === tr.id;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => {
                          setSelectedTrail(tr);
                          setName(tr.name);
                        }}
                        className={`text-left p-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-[#17402C] text-white shadow-sm border border-white/20'
                            : 'bg-white/80 text-[#17402C] border border-[#17402C]/10 hover:bg-white'
                        }`}
                      >
                        <h4 className="font-bold text-xs truncate">{tr.name}</h4>
                        <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-[#5C6B5E]'}`}>
                          {tr.region} · {tr.distance_km} km · +{tr.elevation_gain} m D+
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Leaflet Live Trail Preview */}
                <div className="rounded-xl overflow-hidden border border-[#17402C]/10 relative h-[220px] bg-[#E7E3D6]">
                  <div ref={mapContainerRef} className="w-full h-full" />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('infos')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('logistique')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Dates &amp; Logistique →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DATES & LOGISTIQUE */}
          {activeStep === 'logistique' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Calendrier, Hébergement &amp; Budget</h2>
                  <p className="text-xs text-[#5C6B5E]">Fixez les dates, la flexibilité météo et les estimations de frais partagés.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">03 · LOGISTIQUE</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Date de départ</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Date de retour</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Flexibilité météo</label>
                    <select
                      value={dateFlexibility}
                      onChange={(e) => setDateFlexibility(e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    >
                      <option>Dates fermes</option>
                      <option>± 1 jour selon météo</option>
                      <option>± 2 jours selon météo</option>
                      <option>À convenir avec le groupe</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Type d'hébergement</label>
                    <select
                      value={hebergementType}
                      onChange={(e) => setHebergementType(e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    >
                      <option>Bivouac &amp; Refuges</option>
                      <option>100% Bivouac sous tente</option>
                      <option>Refuges gardés demi-pension</option>
                      <option>Cabanes libres &amp; abris</option>
                      <option>Gîte d'étape</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Budget estimé / pers.</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={estimatedBudget}
                        onChange={(e) => setEstimatedBudget(parseInt(e.target.value))}
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#17402C]"
                      />
                      <span className="absolute right-3 top-2 text-xs text-[#5C6B5E] font-bold">€</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#17402C]">Capacité maximale du groupe</label>
                    <span className="font-bold text-xs text-[#17402C] font-mono">{maxMembers} équipiers max</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={15}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                    className="w-full accent-[#17402C]"
                  />
                  <div className="flex justify-between text-[10px] text-[#5C6B5E] font-mono mt-1">
                    <span>2 pers. (Duo)</span>
                    <span>6 pers. (Équilibre idéal)</span>
                    <span>15 pers. (Max)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('sentier')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('materiel')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Équipiers &amp; Sac requis →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ÉQUIPIERS & MATÉRIEL REQUIS */}
          {activeStep === 'materiel' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Matériel Requis &amp; Sélection</h2>
                  <p className="text-xs text-[#5C6B5E]">Listez les équipements indispensables que chaque participant doit posséder.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">04 · MATÉRIEL</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Mode de recrutement</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'validation', label: '🛡️ Sur validation', desc: 'Les équipiers postulent avec un message sur leur expérience.' },
                      { id: 'open', label: '⚡ Inscription libre', desc: 'Les places sont attribuées aux premiers inscrits.' },
                    ].map((mode) => (
                      <label
                        key={mode.id}
                        className={`p-3.5 rounded-xl cursor-pointer flex items-start gap-2.5 transition-all ${
                          recruitmentMode === mode.id
                            ? 'bg-white border-2 border-[#17402C] shadow-xs'
                            : 'bg-white/60 border border-[#17402C]/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="recruitment_mode"
                          value={mode.id}
                          checked={recruitmentMode === mode.id}
                          onChange={() => setRecruitmentMode(mode.id)}
                          className="mt-0.5 text-[#17402C]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#17402C] block">{mode.label}</span>
                          <span className="text-[10.5px] text-[#5C6B5E] block">{mode.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Checklist matériel exigée des participants</label>
                  <div className="space-y-2">
                    {requiredGear.map((gear) => (
                      <div key={gear.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/90 border border-[#17402C]/10 text-xs">
                        <span className="font-bold text-[#17402C] flex items-center gap-2">
                          <span className="text-emerald-700">✓</span> {gear.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGear(gear.id)}
                          className="text-[#5C6B5E] hover:text-red-600 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newGearInput}
                        onChange={(e) => setNewGearInput(e.target.value)}
                        placeholder="Ex : DVA + Pelle + Sonde si hivernale..."
                        className="flex-1 bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                      />
                      <button
                        type="button"
                        onClick={handleAddGear}
                        className="px-4 py-2 bg-[#17402C] text-white rounded-xl text-xs font-bold hover:bg-[#1E5238] transition-colors shrink-0"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('logistique')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('style')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Personnalisation →
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: STYLE & PICTOGRAMME */}
          {activeStep === 'style' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Personnalisation visuelle du Cockpit</h2>
                  <p className="text-xs text-[#5C6B5E]">Choisissez un emblème et une couleur d’accent pour le cockpit d'expédition.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">05 · STYLE</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Pictogramme de l’expédition</label>
                  <div className="flex flex-wrap gap-2">
                    {PICTOGRAMS.map((pic) => (
                      <button
                        key={pic}
                        type="button"
                        onClick={() => setPictogram(pic)}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                          pictogram === pic
                            ? 'bg-[#17402C] text-white shadow-sm scale-110'
                            : 'bg-white/80 hover:bg-white border border-[#17402C]/10'
                        }`}
                      >
                        {pic}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Couleur thématique du Hero</label>
                  <div className="flex flex-wrap gap-2.5">
                    {ACCENT_COLORS.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setAccentColor(col.value)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          accentColor === col.value
                            ? 'bg-[#17402C] text-white shadow-sm'
                            : 'bg-white/80 text-[#5C6B5E] border border-[#17402C]/10'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: col.value }} />
                        <span>{col.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('materiel')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={saving || !name.trim()}
                  className="glass-capsule-btn primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
                >
                  <Icon name="CheckIcon" size={14} className="relative z-10" />
                  <span className="relative z-10">{saving ? 'Lancement...' : 'Créer l’expédition'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLONNE DROITE (Live Hero Preview) - 300px */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-8">
          {/* Live Cockpit Hero Mini Preview */}
          <div className="glass p-3.5 space-y-3 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs text-[#17402C]">Aperçu du Cockpit</h3>
              <span className="glass-pill text-[9px] font-mono font-bold">Live</span>
            </div>

            <div
              className="rounded-2xl p-4 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[220px]"
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, #112D1F 100%)`
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{pictogram}</span>
                  <span className="px-2 py-0.5 bg-white/15 backdrop-blur-md rounded-full text-[9px] font-mono font-bold text-white">
                    {maxMembers} PLACES
                  </span>
                </div>

                <h4 className="font-display font-bold text-base leading-snug text-white">
                  {name || 'Nom de l’expédition'}
                </h4>
                <p className="text-[10px] text-white/80 line-clamp-2 mt-1">
                  {description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/20 flex items-center justify-between text-[10px] font-mono">
                <span>📏 {selectedTrail.distance_km} km</span>
                <span>⛰️ +{selectedTrail.elevation_gain} m</span>
                <span>💶 ~{estimatedBudget}€</span>
              </div>
            </div>
          </div>

          {/* CTA Final */}
          <div className="glass tone-sand p-3.5 space-y-2 rounded-2xl text-[#17402C]">
            <span className="glass-pill text-[9px] font-mono font-bold text-[#8C6418]">
              🎒 PRÉPARATION D'EXPÉDITION
            </span>
            <h3 className="font-display font-bold text-xs text-[#17402C]">
              Lancer le cockpit de voyage
            </h3>
            <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
              Vos équipiers recevront la liste de matériel exigé, les dates et la trace GPS officielle.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={saving || !name.trim()}
                className="w-full glass-capsule-btn primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Icon name="PlusIcon" size={14} className="relative z-10" />
                <span className="relative z-10">{saving ? 'Création...' : 'Lancer l’expédition'}</span>
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
