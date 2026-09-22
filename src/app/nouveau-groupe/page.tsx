'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Chip, IconButton } from '@/components/ui';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import CompteBackground from '@/components/compte/CompteBackground';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import 'leaflet/dist/leaflet.css';

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const OPTION_CARD_CLASS = (selected: boolean) =>
  `flex cursor-pointer items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] transition-colors ${
    selected
      ? 'border-[color:var(--lkv-primary)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
      : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
  }`;

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

      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | OSM France',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 18,
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

      const { data, error } = await supabase.from('groupes').insert([payload]).select('id').single();

      if (error || !data) {
        toast(error?.message || 'Impossible de créer le groupe pour le moment.', 'error');
        return;
      }

      toast('Expédition créée avec succès ! 🎒', 'success');
      setTimeout(() => {
        router.push(`/groupes/${data.id}`);
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
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[var(--lkv-primary)] relative flex flex-col">
      <CompteBackground />
      <Header />

      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">
        {/* COLONNE GAUCHE (Nav & Stepper) - 230px */}
        <aside className="flex h-full max-h-full w-[230px] shrink-0 select-none flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] font-sans text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)]">
          {/* ── 1. ZONE HAUTE FIXE (Identité & Actions) ── */}
          <div className="shrink-0 space-y-[var(--space-2)]">
            <Card variant="compact" className="flex items-center gap-[var(--space-3)] border-[color:var(--glass-border)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-xl" aria-hidden>
                ⛺
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-tight text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
                  Nouvelle{' '}
                  <span className="font-serif text-[length:var(--lkv-text-caption)] font-normal italic text-[color:var(--lkv-secondary)]">
                    Expédition
                  </span>
                </h4>
                <p className="mt-[var(--space-1)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Studio Groupe
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-[var(--space-1)]">
              <Link
                href="/groupes"
                className="inline-flex items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
              >
                <Icon name="ArrowLeftIcon" size={12} aria-hidden="true" />
                <span>Groupes</span>
              </Link>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                icon={<Icon name="PrinterIcon" size={12} aria-hidden="true" />}
                className="px-[var(--space-2)]"
              >
                Imprimer
              </Button>
            </div>
          </div>

          {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Stepper sans numéros/icônes) ── */}
          <nav className="min-h-0 flex-1 space-y-[var(--space-1)] overflow-y-auto py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Étapes de création du groupe">
            <p className="mb-[var(--space-1)] px-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              Étapes de création
            </p>
            {STEPS.map((st) => {
              const isActive = activeStep === st.id;
              return (
                <Button
                  key={st.id}
                  type="button"
                  variant={isActive ? 'primary' : 'secondary'}
                  fullWidth
                  onClick={() => setActiveStep(st.id)}
                  className="justify-between rounded-[var(--lkv-radius-md)] text-[length:var(--lkv-text-caption)]"
                  aria-pressed={isActive}
                >
                  <span className="truncate text-left">{st.label}</span>
                  {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-[color:var(--lkv-text-inverted)]/70" aria-hidden />}
                </Button>
              );
            })}
          </nav>

          {/* ── 3. ZONE BASSE FIXE (Footer) ── */}
          <div className="shrink-0 border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)] text-center">
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Le Kit du Voyageur · Studio Groupe
            </span>
          </div>
        </aside>

        {/* COLONNE CENTRALE (Formulaire dynamique) */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
            <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
            <Link href="/communaute?tab=groupes" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Groupes</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
            <span className="font-semibold text-[color:var(--lkv-text-primary)]">Créer une expédition</span>
          </div>

          {/* STEP 1: INFOS */}
          {activeStep === 'infos' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Objectif, Esprit &amp; Niveau</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Donnez un titre percutant, décrivez le projet et fixez l’engagement requis.</p>
                </div>
                <Badge className="font-mono font-bold">01 · OBJECTIF</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div>
                  <label htmlFor="group-name" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Nom de l’expédition *</label>
                  <input
                    id="group-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex : Traversée de la Chartreuse en automne"
                    className={FIELD_CLASS}
                  />
                </div>

                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <div>
                    <label htmlFor="group-type" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Type d&apos;aventure</label>
                    <select
                      id="group-type"
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option>Traversée en autonomie</option>
                      <option>Week-end bivouac &amp; sommet</option>
                      <option>Randonnée avec nuits en refuge</option>
                      <option>Stage itinérant &amp; orientation</option>
                      <option>Alpinisme &amp; haute route</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="group-level" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Niveau d&apos;engagement requis</label>
                    <select
                      id="group-level"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option>Tranquille &amp; contemplatif</option>
                      <option>Rythme moyen régulier (4-6h/j)</option>
                      <option>Sportif &amp; engagé (+1000m D+/j)</option>
                      <option>Alpin &amp; passages techniques</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="group-description" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Description du projet &amp; ambiance recherchée</label>
                  <textarea
                    id="group-description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Précisez la philosophie du groupe, les pauses prévues, le portage..."
                    className={`${FIELD_CLASS} leading-relaxed`}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setActiveStep('sentier')}
                >
                  Suivant : Sentier &amp; GPX →
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 2: SENTIER & TRACE */}
          {activeStep === 'sentier' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Sentier &amp; Trace GPX</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Choisissez un itinéraire certifié pour générer le profil 3D en direct.</p>
                </div>
                <Badge className="font-mono font-bold">02 · SENTIER</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2">
                  {DEFAULT_TRAILS.map((tr) => {
                    const isSelected = selectedTrail.id === tr.id;
                    return (
                      <Card
                        key={tr.id}
                        variant="compact"
                        selected={isSelected}
                        onClick={() => {
                          setSelectedTrail(tr);
                          setName(tr.name);
                        }}
                        className="text-left"
                      >
                        <h4 className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{tr.name}</h4>
                        <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                          {tr.region} · {tr.distance_km} km · +{tr.elevation_gain} m D+
                        </p>
                      </Card>
                    );
                  })}
                </div>

                {/* Leaflet Live Trail Preview */}
                <div className="relative h-[220px] overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-primary)]/10 bg-[color:var(--glass-bg-medium)]">
                  <div ref={mapContainerRef} className="h-full w-full" />
                </div>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('infos')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setActiveStep('logistique')}
                >
                  Suivant : Dates &amp; Logistique →
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 3: DATES & LOGISTIQUE */}
          {activeStep === 'logistique' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Calendrier, Hébergement &amp; Budget</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Fixez les dates, la flexibilité météo et les estimations de frais partagés.</p>
                </div>
                <Badge className="font-mono font-bold">03 · LOGISTIQUE</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
                  <div>
                    <label htmlFor="group-start-date" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Date de départ</label>
                    <input
                      id="group-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="group-end-date" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Date de retour</label>
                    <input
                      id="group-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="group-flexibility" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Flexibilité météo</label>
                    <select
                      id="group-flexibility"
                      value={dateFlexibility}
                      onChange={(e) => setDateFlexibility(e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option>Dates fermes</option>
                      <option>± 1 jour selon météo</option>
                      <option>± 2 jours selon météo</option>
                      <option>À convenir avec le groupe</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-[var(--space-3)] pt-[var(--space-1)] sm:grid-cols-2">
                  <div>
                    <label htmlFor="group-lodging" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Type d&apos;hébergement</label>
                    <select
                      id="group-lodging"
                      value={hebergementType}
                      onChange={(e) => setHebergementType(e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option>Bivouac &amp; Refuges</option>
                      <option>100% Bivouac sous tente</option>
                      <option>Refuges gardés demi-pension</option>
                      <option>Cabanes libres &amp; abris</option>
                      <option>Gîte d&apos;étape</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="group-budget" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Budget estimé / pers.</label>
                    <div className="relative">
                      <input
                        id="group-budget"
                        type="number"
                        value={estimatedBudget}
                        onChange={(e) => setEstimatedBudget(parseInt(e.target.value))}
                        className={`${FIELD_CLASS} font-mono font-bold`}
                      />
                      <span className="absolute right-[var(--space-3)] top-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-muted)]">€</span>
                    </div>
                  </div>
                </div>

                <div className="pt-[var(--space-2)]">
                  <div className="mb-[var(--space-1)] flex items-center justify-between">
                    <label htmlFor="group-max-members" className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Capacité maximale du groupe</label>
                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{maxMembers} équipiers max</span>
                  </div>
                  <input
                    id="group-max-members"
                    type="range"
                    min={2}
                    max={15}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                    className="w-full accent-[var(--lkv-primary)]"
                  />
                  <div className="mt-[var(--space-1)] flex justify-between font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    <span>2 pers. (Duo)</span>
                    <span>6 pers. (Équilibre idéal)</span>
                    <span>15 pers. (Max)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('sentier')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setActiveStep('materiel')}
                >
                  Suivant : Équipiers &amp; Sac requis →
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 4: ÉQUIPIERS & MATÉRIEL REQUIS */}
          {activeStep === 'materiel' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Matériel Requis &amp; Sélection</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Listez les équipements indispensables que chaque participant doit posséder.</p>
                </div>
                <Badge className="font-mono font-bold">04 · MATÉRIEL</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <fieldset>
                  <legend className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Mode de recrutement</legend>
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                    {[
                      { id: 'validation', label: '🛡️ Sur validation', desc: 'Les équipiers postulent avec un message sur leur expérience.' },
                      { id: 'open', label: '⚡ Inscription libre', desc: 'Les places sont attribuées aux premiers inscrits.' },
                    ].map((mode) => (
                      <label
                        key={mode.id}
                        className={OPTION_CARD_CLASS(recruitmentMode === mode.id)}
                      >
                        <input
                          type="radio"
                          name="recruitment_mode"
                          value={mode.id}
                          checked={recruitmentMode === mode.id}
                          onChange={() => setRecruitmentMode(mode.id)}
                          className="mt-0.5 accent-[var(--lkv-primary)]"
                        />
                        <span>
                          <span className="block text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{mode.label}</span>
                          <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{mode.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="pt-[var(--space-2)]">
                  <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Checklist matériel exigée des participants</p>
                  <ul className="space-y-[var(--space-2)]">
                    {requiredGear.map((gear) => (
                      <li key={gear.id}>
                        <Card
                          variant="compact"
                          className="flex items-center justify-between text-[length:var(--lkv-text-caption)]"
                        >
                          <span className="flex items-center gap-[var(--space-2)] font-bold text-[color:var(--lkv-text-primary)]">
                            <span className="text-[color:var(--lkv-success)]" aria-hidden>✓</span> {gear.name}
                          </span>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveGear(gear.id)}
                            aria-label={`Retirer ${gear.name}`}
                          >
                            <Icon name="XMarkIcon" size={14} aria-hidden="true" />
                          </IconButton>
                        </Card>
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-[var(--space-2)] pt-[var(--space-2)]">
                    <label htmlFor="group-new-gear" className="sr-only">Nouvel équipement requis</label>
                    <input
                      id="group-new-gear"
                      type="text"
                      value={newGearInput}
                      onChange={(e) => setNewGearInput(e.target.value)}
                      placeholder="Ex : DVA + Pelle + Sonde si hivernale..."
                      className={`${FIELD_CLASS} flex-1`}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleAddGear}
                      className="shrink-0"
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('logistique')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setActiveStep('style')}
                >
                  Suivant : Personnalisation →
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 5: STYLE & PICTOGRAMME */}
          {activeStep === 'style' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Personnalisation visuelle du Cockpit</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Choisissez un emblème et une couleur d’accent pour le cockpit d&apos;expédition.</p>
                </div>
                <Badge className="font-mono font-bold">05 · STYLE</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <fieldset>
                  <legend className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Pictogramme de l’expédition</legend>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    {PICTOGRAMS.map((pic) => (
                      <IconButton
                        key={pic}
                        variant={pictogram === pic ? 'solid' : 'glass'}
                        onClick={() => setPictogram(pic)}
                        aria-label={`Choisir le pictogramme ${pic}`}
                        aria-pressed={pictogram === pic}
                        className="text-[length:var(--lkv-text-title-sm)]"
                      >
                        <span aria-hidden>{pic}</span>
                      </IconButton>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Couleur thématique du Hero</legend>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    {ACCENT_COLORS.map((col) => (
                      <Chip
                        key={col.id}
                        selected={accentColor === col.value}
                        onClick={() => setAccentColor(col.value)}
                        icon={
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-[color:var(--lkv-border)]"
                            style={{ backgroundColor: col.value }}
                            aria-hidden
                          />
                        }
                      >
                        {col.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('materiel')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCreateGroup}
                  disabled={saving || !name.trim()}
                  icon={<Icon name="CheckIcon" size={14} aria-hidden="true" />}
                >
                  {saving ? 'Lancement...' : 'Créer l’expédition'}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* COLONNE DROITE (Live Hero Preview) - 300px */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-8">
          {/* Live Cockpit Hero Mini Preview */}
          <Card className="space-y-[var(--space-3)] p-[var(--space-4)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Aperçu du Cockpit</h3>
              <Badge className="font-mono font-bold">Live</Badge>
            </div>

            <div
              className="relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-md)] p-[var(--space-4)] text-[color:var(--lkv-text-inverted)]"
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, var(--lkv-forest-950) 100%)`
              }}
            >
              <div>
                <div className="mb-[var(--space-3)] flex items-center justify-between">
                  <span className="text-[length:var(--lkv-text-title-lg)]" aria-hidden>{pictogram}</span>
                  <Badge className="border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] font-mono font-bold text-[color:var(--lkv-text-inverted)] backdrop-blur-[var(--blur-md)]">
                    {maxMembers} PLACES
                  </Badge>
                </div>

                <h4 className="font-display text-[length:var(--lkv-text-body)] font-bold leading-snug text-[color:var(--lkv-text-inverted)]">
                  {name || 'Nom de l’expédition'}
                </h4>
                <p className="mt-[var(--space-1)] line-clamp-2 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-inverted)]/80">
                  {description}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-[color:var(--glass-border)] pt-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)]">
                <span>📏 {selectedTrail.distance_km} km</span>
                <span>⛰️ +{selectedTrail.elevation_gain} m</span>
                <span>💶 ~{estimatedBudget}€</span>
              </div>
            </div>
          </Card>

          {/* CTA Final */}
          <Card tone="warn" className="space-y-[var(--space-2)] p-[var(--space-4)] text-[color:var(--lkv-text-primary)]">
            <Badge tone="warn" className="font-mono font-bold">
              🎒 PRÉPARATION D&apos;EXPÉDITION
            </Badge>
            <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              Lancer le cockpit de voyage
            </h3>
            <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
              Vos équipiers recevront la liste de matériel exigé, les dates et la trace GPS officielle.
            </p>
            <div className="pt-[var(--space-1)]">
              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={handleCreateGroup}
                disabled={saving || !name.trim()}
                icon={<Icon name="PlusIcon" size={14} aria-hidden="true" />}
              >
                {saving ? 'Création...' : 'Lancer l’expédition'}
              </Button>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
