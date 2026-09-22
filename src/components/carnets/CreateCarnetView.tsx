'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import CompteBackground from '@/components/compte/CompteBackground';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import { CarnetKitItem, CarnetMoment } from '@/types/carnet';
import { Badge, Button, Card, Chip, IconButton } from '@/components/ui';

export interface ChapterItem {
  id: string;
  num: string;
  title: string;
  lieu_depart?: string;
  lieu_arrivee?: string;
  distance_km?: number;
  denivele_m?: number;
  meteo?: string;
  hebergement_nom?: string;
  hebergement_type?: string;
  content: string;
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS = 'mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]';

const OPTION_CARD_CLASS = (selected: boolean) =>
  `flex cursor-pointer items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] transition-colors ${
    selected
      ? 'border-[color:var(--lkv-primary)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
      : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
  }`;

export default function CreateCarnetView({ onCloseModal }: { onCloseModal?: () => void } = {}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [activeStep, setActiveStep] = useState<'general' | 'etapes' | 'moments' | 'sac' | 'tags'>('general');

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    destination: '',
    chapeau: '',
    coverImage: '',
    startDate: '',
    endDate: '',
    voyageurs: 1,
    difficulty: '',
    weather: '',
    avgTemp: '',
    routeRating: 0,
    distance_km: 0,
    elevation_m: 0,

    chapters: [
      {
        id: 'ch-1',
        num: 'I',
        title: '',
        lieu_depart: '',
        lieu_arrivee: '',
        distance_km: 0,
        denivele_m: 0,
        meteo: '',
        hebergement_nom: '',
        hebergement_type: '',
        content: ''
      }
    ] as ChapterItem[],

    moments: [] as CarnetMoment[],

    kitIntro: '',
    kitItems: [] as CarnetKitItem[],

    selectedThemes: [] as string[],
    customTags: [] as string[],
    visibility: 'private' as 'public' | 'private',
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  const availableThemes = ['Bivouac', 'Chartreuse', 'Solo', 'Refuge gardé', 'Automne', 'Été', 'Alpinisme', 'Traversée', 'Van Life', 'Haute Montagne'];

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Error loading user:", err);
      }
    }
    loadUser();
  }, []);

  const setField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleTheme = (theme: string) => {
    setForm(prev => {
      const exists = prev.selectedThemes.includes(theme);
      return {
        ...prev,
        selectedThemes: exists ? prev.selectedThemes.filter(t => t !== theme) : [...prev.selectedThemes, theme]
      };
    });
  };

  const addChapter = () => {
    const nextNum = form.chapters.length + 1;
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][nextNum - 1] || `${nextNum}`;
    const newCh: ChapterItem = {
      id: `ch-${Date.now()}`,
      num: roman,
      title: '',
      lieu_depart: '',
      lieu_arrivee: '',
      distance_km: 0,
      denivele_m: 0,
      meteo: '',
      hebergement_nom: '',
      hebergement_type: '',
      content: ''
    };
    setForm(prev => ({ ...prev, chapters: [...prev.chapters, newCh] }));
  };

  const removeChapter = (id: string) => {
    if (form.chapters.length <= 1) return;
    setForm(prev => ({ ...prev, chapters: prev.chapters.filter(c => c.id !== id) }));
  };

  const addMoment = () => {
    const newMoment: CarnetMoment = {
      id: `m-${Date.now()}`,
      label: '',
      citation: '',
      author: user?.user_metadata?.full_name?.split(' ')[0] || '',
      location: ''
    };
    setForm(prev => ({ ...prev, moments: [...prev.moments, newMoment] }));
  };

  const removeMoment = (id: string) => {
    setForm(prev => ({ ...prev, moments: prev.moments.filter(m => m.id !== id) }));
  };

  const addKitItem = () => {
    const newItem: CarnetKitItem = {
      id: `k-${Date.now()}`,
      name: '',
      detail: '',
      weight: '',
      color: 'var(--lkv-primary)'
    };
    setForm(prev => ({ ...prev, kitItems: [...prev.kitItems, newItem] }));
  };

  const removeKitItem = (id: string) => {
    setForm(prev => ({ ...prev, kitItems: prev.kitItems.filter(k => k.id !== id) }));
  };

  const handlePublish = async () => {
    if (!user) {
      setSaveError('Connectez-vous pour créer un carnet.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const payload = {
        title: form.title.trim(),
        destination: form.destination.trim(),
        description: form.chapeau.trim(),
        cover_image: form.coverImage.trim(),
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        weather: form.weather.trim(),
        route_rating: form.routeRating || 0,
        distance_km: form.distance_km || 0,
        elevation_m: form.elevation_m || 0,
        visibility: form.visibility,
        tags: [...form.selectedThemes, ...form.customTags],
        author_id: user.id,
      };

      const { data, error } = await supabase.from('carnets').insert([payload]).select('id').single();
      if (error || !data) {
        throw new Error(error?.message || 'Insertion du carnet refusée');
      }

      const carnetId = data.id;
      const authorName = user.user_metadata?.full_name || 'Voyageur';

      const chapterMoments = form.chapters
        .map((c, i) => ({
          carnet_id: carnetId,
          jour_numero: i + 1,
          citation: c.content.trim() || c.title.trim(),
          auteur_nom: authorName,
          auteur_id: user.id,
          lieu: c.lieu_arrivee?.trim() || null,
        }))
        .filter((m) => m.citation.length > 0);

      const momentRows = [
        ...chapterMoments,
        ...form.moments
          .filter((m) => m.citation.trim().length > 0)
          .map((m, i) => ({
            carnet_id: carnetId,
            jour_numero: i + 1,
            citation: m.citation.trim(),
            auteur_nom: m.author.trim() || authorName,
            auteur_id: user.id,
            lieu: m.location.trim() || null,
            image_url: m.imageUrl || null,
          })),
      ];

      if (momentRows.length > 0) {
        const { error: momentsError } = await supabase.from('carnet_moments').insert(momentRows);
        if (momentsError) {
          console.warn('[CreateCarnetView] carnet_moments non enregistrés:', momentsError.message);
        }
      }

      const kitRows = form.kitItems
        .filter((k) => k.name.trim().length > 0)
        .map((k, i) => ({
          carnet_id: carnetId,
          nom: k.name.trim(),
          detail: k.detail.trim(),
          poids_g: Math.max(0, Math.round(parseFloat(k.weight) || 0)),
          couleur_tag: k.color || null,
          sort_order: i,
        }));

      if (kitRows.length > 0) {
        const { error: kitError } = await supabase.from('carnet_kit_items').insert(kitRows);
        if (kitError) {
          console.warn('[CreateCarnetView] carnet_kit_items non enregistrés:', kitError.message);
        }
      }

      // P2 — publication explicite (visibilité ≠ privée) : le serveur revérifie
      // la visibilité réelle, le rattachement et le contenu avant d'attribuer.
      if (form.visibility !== 'private') {
        requestCarnetPublicationAward(carnetId);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/carnets/${carnetId}`);
      }, 800);
    } catch (e) {
      console.error(e);
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la création du carnet.');
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { id: 'general' as const, label: 'Général & Métriques', short: '01', desc: 'Titre, dates & stats' },
    { id: 'etapes' as const, label: 'Étapes & Récit', short: '02', desc: `${form.chapters.length} étapes rédigées` },
    { id: 'moments' as const, label: 'Moments & Photos', short: '03', desc: `${form.moments.length} anecdotes` },
    { id: 'sac' as const, label: 'Dans le sac', short: '04', desc: `${form.kitItems.length} indispensables` },
    { id: 'tags' as const, label: 'Thèmes & Publication', short: '05', desc: 'Mots-clés & Visibilité' },
  ];

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-transparent font-sans text-[color:var(--lkv-text-primary)]">
      <CompteBackground />
      <Header />

      <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 gap-[var(--space-5)] overflow-hidden px-[var(--space-4)] pb-[var(--space-4)] pt-24 sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
        <aside className="flex h-full max-h-full w-[230px] shrink-0 select-none flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] font-sans text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)]">
          <div className="shrink-0 space-y-[var(--space-2)]">
            <Card variant="compact" className="flex items-center gap-[var(--space-3)] border-[color:var(--glass-border)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-xl" aria-hidden>
                ✍️
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-tight text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
                  Création{' '}
                  <span className="font-serif text-[length:var(--lkv-text-caption)] font-normal italic text-[color:var(--lkv-secondary)]">
                    Carnet
                  </span>
                </h4>
                <p className="mt-[var(--space-1)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Studio Récit
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-[var(--space-1)]">
              <Link
                href="/carnets"
                className="inline-flex items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
              >
                <Icon name="ArrowLeftIcon" size={12} aria-hidden="true" />
                <span>Retour</span>
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

          <nav className="min-h-0 flex-1 space-y-[var(--space-1)] overflow-y-auto py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Étapes de création">
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

          <div className="shrink-0 border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)] text-center">
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Le Kit du Voyageur · Studio Carnet
            </span>
          </div>
        </aside>

        <div className="h-full min-w-0 flex-1 space-y-[var(--space-4)] overflow-y-auto pr-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
            <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
            <Link href="/carnets" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Carnets</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
            <span className="font-semibold text-[color:var(--lkv-text-primary)]">Publier un carnet de voyage</span>
          </div>

          {activeStep === 'general' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Informations Générales &amp; Métriques</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Posez les bases de votre expédition : destination, dates, météo et statistiques.</p>
                </div>
                <Badge className="font-mono font-bold">01 · INFOS</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div>
                  <label htmlFor="carnet-title" className={LABEL_CLASS}>Titre du carnet *</label>
                  <input
                    id="carnet-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="Ex : Traversée des crêtes en Chartreuse"
                    className={`${FIELD_CLASS} font-bold`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <div>
                    <label htmlFor="carnet-destination" className={LABEL_CLASS}>Massif / Destination *</label>
                    <input
                      id="carnet-destination"
                      type="text"
                      value={form.destination}
                      onChange={(e) => setField('destination', e.target.value)}
                      placeholder="Ex : Chartreuse · Alpes"
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="carnet-cover" className={LABEL_CLASS}>Photo de couverture (URL)</label>
                    <input
                      id="carnet-cover"
                      type="text"
                      value={form.coverImage}
                      onChange={(e) => setField('coverImage', e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="carnet-chapeau" className={LABEL_CLASS}>Chapeau d’accroche / Citation de départ</label>
                  <textarea
                    id="carnet-chapeau"
                    rows={2}
                    value={form.chapeau}
                    onChange={(e) => setField('chapeau', e.target.value)}
                    placeholder="Une phrase pour résumer l’ambiance et l’esprit..."
                    className={`${FIELD_CLASS} resize-y font-serif italic`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-[var(--space-3)] pt-[var(--space-2)] sm:grid-cols-4">
                  <div>
                    <label htmlFor="carnet-distance" className={LABEL_CLASS}>Distance totale</label>
                    <div className="relative">
                      <input
                        id="carnet-distance"
                        type="number"
                        step="0.1"
                        value={form.distance_km}
                        onChange={(e) => setField('distance_km', parseFloat(e.target.value))}
                        className={`${FIELD_CLASS} font-mono font-bold`}
                      />
                      <span className="absolute right-[var(--space-3)] top-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">km</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="carnet-elevation" className={LABEL_CLASS}>Dénivelé +</label>
                    <div className="relative">
                      <input
                        id="carnet-elevation"
                        type="number"
                        value={form.elevation_m}
                        onChange={(e) => setField('elevation_m', parseInt(e.target.value))}
                        className={`${FIELD_CLASS} font-mono font-bold`}
                      />
                      <span className="absolute right-[var(--space-3)] top-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">m</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="carnet-voyageurs" className={LABEL_CLASS}>Voyageurs</label>
                    <input
                      id="carnet-voyageurs"
                      type="number"
                      min={1}
                      value={form.voyageurs}
                      onChange={(e) => setField('voyageurs', parseInt(e.target.value))}
                      className={`${FIELD_CLASS} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label htmlFor="carnet-rating" className={LABEL_CLASS}>Note globale</label>
                    <div className="relative">
                      <input
                        id="carnet-rating"
                        type="number"
                        min={1}
                        max={10}
                        value={form.routeRating}
                        onChange={(e) => setField('routeRating', parseInt(e.target.value))}
                        className={`${FIELD_CLASS} font-mono font-bold`}
                      />
                      <span className="absolute right-[var(--space-3)] top-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--sand-600)]">/10</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <div>
                    <span className={LABEL_CLASS}>Période du voyage</span>
                    <div className="flex gap-[var(--space-2)]">
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setField('startDate', e.target.value)}
                        aria-label="Date de début"
                        className={FIELD_CLASS}
                      />
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setField('endDate', e.target.value)}
                        aria-label="Date de fin"
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="carnet-weather" className={LABEL_CLASS}>Météo &amp; Température</label>
                    <input
                      id="carnet-weather"
                      type="text"
                      value={form.weather}
                      onChange={(e) => setField('weather', e.target.value)}
                      placeholder="Ex : Grand soleil en journée, 4°C la nuit"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-[var(--space-2)]">
                <Button
                  type="button"
                  onClick={() => setActiveStep('etapes')}
                >
                  Suivant : Étapes &amp; Récit →
                </Button>
              </div>
            </Card>
          )}

          {activeStep === 'etapes' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Étapes &amp; Récit de marche</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Détaillez le déroulé jour par jour avec les anecdotes, le bivouac et les refuges.</p>
                </div>
                <Badge className="font-mono font-bold">02 · ÉTAPES</Badge>
              </div>

              <div className="space-y-[var(--space-5)]">
                {form.chapters.map((ch, idx) => (
                  <Card key={ch.id} variant="compact" className="space-y-[var(--space-3)] p-[var(--space-4)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                          {ch.num}
                        </span>
                        <input
                          type="text"
                          value={ch.title}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].title = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder={`Titre du Jour ${idx + 1}`}
                          aria-label={`Titre du jour ${idx + 1}`}
                          className="border-none bg-transparent p-0 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-0"
                        />
                      </div>

                      {form.chapters.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChapter(ch.id)}
                          className="text-[color:var(--lkv-danger)]"
                        >
                          Supprimer l&apos;étape
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] sm:grid-cols-4">
                      <div>
                        <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Départ</label>
                        <input
                          type="text"
                          value={ch.lieu_depart || ''}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].lieu_depart = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder="Lieu de départ"
                          aria-label="Lieu de départ"
                          className={`${FIELD_CLASS} py-[var(--space-1)]`}
                        />
                      </div>
                      <div>
                        <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Arrivée</label>
                        <input
                          type="text"
                          value={ch.lieu_arrivee || ''}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].lieu_arrivee = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder="Lieu d'arrivée"
                          aria-label="Lieu d'arrivée"
                          className={`${FIELD_CLASS} py-[var(--space-1)]`}
                        />
                      </div>
                      <div>
                        <span className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Distance &amp; D+</span>
                        <div className="flex gap-[var(--space-1)]">
                          <input
                            type="number"
                            value={ch.distance_km || 10}
                            onChange={(e) => {
                              const updated = [...form.chapters];
                              updated[idx].distance_km = parseFloat(e.target.value);
                              setField('chapters', updated);
                            }}
                            aria-label="Distance en kilomètres"
                            className={`${FIELD_CLASS} w-1/2 py-[var(--space-1)] font-mono`}
                          />
                          <input
                            type="number"
                            value={ch.denivele_m || 500}
                            onChange={(e) => {
                              const updated = [...form.chapters];
                              updated[idx].denivele_m = parseInt(e.target.value);
                              setField('chapters', updated);
                            }}
                            aria-label="Dénivelé en mètres"
                            className={`${FIELD_CLASS} w-1/2 py-[var(--space-1)] font-mono`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Hébergement</label>
                        <input
                          type="text"
                          value={ch.hebergement_nom || ''}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].hebergement_nom = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder="Nom du refuge/bivouac"
                          aria-label="Nom de l'hébergement"
                          className={`${FIELD_CLASS} py-[var(--space-1)]`}
                        />
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={ch.content}
                        onChange={(e) => {
                          const updated = [...form.chapters];
                          updated[idx].content = e.target.value;
                          setField('chapters', updated);
                        }}
                        placeholder="Récit de l’étape : sensations, rencontres, météo..."
                        aria-label="Récit de l'étape"
                        className={`${FIELD_CLASS} resize-y leading-relaxed`}
                      />
                    </div>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={addChapter}
                  icon={<Icon name="PlusIcon" size={14} aria-hidden="true" />}
                  className="border-dashed"
                >
                  Ajouter une journée de marche
                </Button>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('general')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveStep('moments')}
                >
                  Suivant : Moments &amp; Photos →
                </Button>
              </div>
            </Card>
          )}

          {activeStep === 'moments' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Moments &amp; Photos Phares</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Archivage des citations, des panoramas et des anecdotes marquantes.</p>
                </div>
                <Badge className="font-mono font-bold">03 · SOUVENIRS</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                {form.moments.map((m, idx) => (
                  <Card key={m.id} variant="compact" className="space-y-[var(--space-3)] p-[var(--space-4)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Moment #{idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMoment(m.id)}
                        className="text-[color:var(--lkv-danger)]"
                      >
                        Retirer
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] sm:grid-cols-3">
                      <div>
                        <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Horodatage / Label</label>
                        <input
                          type="text"
                          value={m.label}
                          onChange={(e) => {
                            const updated = [...form.moments];
                            updated[idx].label = e.target.value;
                            setField('moments', updated);
                          }}
                          placeholder="Ex : JOUR 1 · 18H30"
                          aria-label="Horodatage du moment"
                          className={`${FIELD_CLASS} py-[var(--space-1)]`}
                        />
                      </div>
                      <div>
                        <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Lieu précis</label>
                        <input
                          type="text"
                          value={m.location}
                          onChange={(e) => {
                            const updated = [...form.moments];
                            updated[idx].location = e.target.value;
                            setField('moments', updated);
                          }}
                          placeholder="Ex : Charmant Som"
                          aria-label="Lieu du moment"
                          className={`${FIELD_CLASS} py-[var(--space-1)]`}
                        />
                      </div>
                      <div>
                        <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Auteur</label>
                        <input
                          type="text"
                          value={m.author}
                          onChange={(e) => {
                            const updated = [...form.moments];
                            updated[idx].author = e.target.value;
                            setField('moments', updated);
                          }}
                          placeholder="Ex : Marceline"
                          aria-label="Auteur du moment"
                          className={`${FIELD_CLASS} py-[var(--space-1)]`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-[var(--space-1)] block font-bold text-[color:var(--lkv-text-muted)]">Citation / Anecdote</label>
                      <input
                        type="text"
                        value={m.citation}
                        onChange={(e) => {
                          const updated = [...form.moments];
                          updated[idx].citation = e.target.value;
                          setField('moments', updated);
                        }}
                        placeholder="« Phrase mémorable prononcée ou pensée... »"
                        aria-label="Citation du moment"
                        className={`${FIELD_CLASS} font-serif italic`}
                      />
                    </div>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={addMoment}
                  icon={<Icon name="PlusIcon" size={14} aria-hidden="true" />}
                  className="border-dashed"
                >
                  Ajouter un souvenir / photo
                </Button>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('etapes')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveStep('sac')}
                >
                  Suivant : Dans le sac →
                </Button>
              </div>
            </Card>
          )}

          {activeStep === 'sac' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Ce que vous aviez dans le sac</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Partagez le matériel testé pour aider la communauté à préparer leur sac.</p>
                </div>
                <Badge className="font-mono font-bold">04 · MATÉRIEL</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div>
                  <label htmlFor="carnet-kit-intro" className={LABEL_CLASS}>Commentaire global sur le portage</label>
                  <input
                    id="carnet-kit-intro"
                    type="text"
                    value={form.kitIntro}
                    onChange={(e) => setField('kitIntro', e.target.value)}
                    placeholder="Ex : Sac 45L configuré pour 3 jours d'autonomie complète."
                    className={FIELD_CLASS}
                  />
                </div>

                <div className="space-y-[var(--space-2)]">
                  {form.kitItems.map((item, idx) => (
                    <Card key={item.id} variant="compact" className="flex items-center gap-[var(--space-2)] p-[var(--space-3)]">
                      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color || 'var(--lkv-primary)' }} />
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...form.kitItems];
                          updated[idx].name = e.target.value;
                          setField('kitItems', updated);
                        }}
                        placeholder="Nom de l'équipement"
                        aria-label="Nom de l'équipement"
                        className="flex-1 border-none bg-transparent p-0 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-0"
                      />
                      <input
                        type="text"
                        value={item.detail}
                        onChange={(e) => {
                          const updated = [...form.kitItems];
                          updated[idx].detail = e.target.value;
                          setField('kitItems', updated);
                        }}
                        placeholder="Détail / Marque"
                        aria-label="Détail de l'équipement"
                        className="w-1/3 border-none bg-transparent p-0 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-0"
                      />
                      <input
                        type="text"
                        value={item.weight}
                        onChange={(e) => {
                          const updated = [...form.kitItems];
                          updated[idx].weight = e.target.value;
                          setField('kitItems', updated);
                        }}
                        placeholder="Poids"
                        aria-label="Poids de l'équipement"
                        className={`${FIELD_CLASS} w-16 py-[2px] text-center font-mono font-bold`}
                      />
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKitItem(item.id)}
                        aria-label={`Retirer ${item.name || "l'équipement"}`}
                      >
                        <Icon name="XMarkIcon" size={14} aria-hidden="true" />
                      </IconButton>
                    </Card>
                  ))}

                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={addKitItem}
                    icon={<Icon name="PlusIcon" size={14} aria-hidden="true" />}
                    className="border-dashed"
                  >
                    Ajouter un équipement
                  </Button>
                </div>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('moments')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveStep('tags')}
                >
                  Suivant : Thématiques →
                </Button>
              </div>
            </Card>
          )}

          {activeStep === 'tags' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Thématiques &amp; Visibilité</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Choisissez les étiquettes de référencement et les droits d&apos;accès.</p>
                </div>
                <Badge className="font-mono font-bold">05 · PUBLICATION</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div>
                  <span className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Thématiques de l’expédition</span>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    {availableThemes.map((th) => {
                      const isSelected = form.selectedThemes.includes(th);
                      return (
                        <Chip
                          key={th}
                          selected={isSelected}
                          onClick={() => toggleTheme(th)}
                        >
                          {isSelected ? '✓ ' : '+ '} {th}
                        </Chip>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-[var(--space-2)]">
                  <span className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Visibilité du carnet</span>
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                    {[
                      { id: 'public', label: '🌍 Public', desc: 'Visible par toute la communauté LKDV et indexé dans le hub.' },
                      { id: 'private', label: '🔒 Privé', desc: 'Accessible uniquement par vous et vos proches via lien secret.' },
                    ].map((vis) => (
                      <label
                        key={vis.id}
                        className={OPTION_CARD_CLASS(form.visibility === vis.id)}
                      >
                        <input
                          type="radio"
                          name="carnet_visibility"
                          value={vis.id}
                          checked={form.visibility === vis.id}
                          onChange={() => setField('visibility', vis.id)}
                          className="mt-[2px] accent-[var(--lkv-primary)]"
                        />
                        <div>
                          <span className="block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{vis.label}</span>
                          <span className="block text-[length:var(--lkv-text-caption-2)] leading-tight text-[color:var(--lkv-text-muted)]">{vis.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-[var(--space-3)] pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveStep('sac')}
                >
                  ← Précédent
                </Button>
                <div className="flex items-center gap-[var(--space-3)]">
                  {saveError && (
                    <p role="alert" className="text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-danger)]">
                      {saveError}
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving || !form.title.trim()}
                    loading={saving}
                    icon={<Icon name="CheckIcon" size={14} aria-hidden="true" />}
                  >
                    {saving ? 'Publication...' : saveSuccess ? '✓ Publié !' : 'Publier le carnet'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside className="flex h-full w-[300px] shrink-0 flex-col gap-[var(--space-4)] overflow-y-auto pb-[var(--space-8)]">
          <Card className="space-y-[var(--space-3)] p-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Aperçu du carnet</h3>
              <Badge className="font-mono font-bold">Live</Badge>
            </div>

            <Card variant="compact" className="flex flex-col overflow-hidden p-0">
              <div className="relative h-28 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn">
                {form.coverImage && (
                  <img src={form.coverImage} alt="Couverture du carnet" className="h-full w-full object-cover" />
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Badge className="absolute bottom-[var(--space-2)] left-[var(--space-2)] border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] border saturate-[var(--btn-saturate)] lkv-rim-btn font-mono font-bold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--btn-blur)]">
                  {form.destination}
                </Badge>
              </div>
              <div className="space-y-[var(--space-1)] p-[var(--space-3)]">
                <h4 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                  {form.title || 'Titre du carnet'}
                </h4>
                <p className="line-clamp-2 font-serif text-[length:var(--lkv-text-caption-2)] italic text-[color:var(--lkv-text-muted)]">
                  {form.chapeau}
                </p>
                <div className="flex items-center justify-between border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  <span>📏 {form.distance_km} km</span>
                  <span>⛰️ +{form.elevation_m} m</span>
                  <span>★ {form.routeRating}/10</span>
                </div>
              </div>
            </Card>
          </Card>

          <Card tone="warn" className="space-y-[var(--space-2)] p-[var(--space-3)]">
            <Badge tone="warn" className="font-mono font-bold">
              🌟 CERTIFICATION LKDV
            </Badge>
            <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              Prêt à inspirer la communauté ?
            </h3>
            <p className="text-[length:var(--lkv-text-caption-2)] leading-relaxed text-[color:var(--lkv-text-muted)]">
              Votre carnet est privé par défaut. Vous pourrez le partager explicitement avec la communauté plus tard.
            </p>
            <div className="space-y-[var(--space-2)] pt-[var(--space-1)]">
              {saveError && (
                <p role="alert" className="text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-danger)]">
                  {saveError}
                </p>
              )}
              <Button
                type="button"
                onClick={handlePublish}
                disabled={saving || !form.title.trim()}
                loading={saving}
                fullWidth
                icon={<Icon name="CheckIcon" size={14} aria-hidden="true" />}
              >
                {saving ? 'Publication...' : saveSuccess ? '✓ Publié !' : 'Publier le carnet'}
              </Button>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
