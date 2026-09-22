'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import CompteBackground from '@/components/compte/CompteBackground';
import { createClient } from '@/lib/supabase/client';
import { Badge, Button, Card, IconButton } from '@/components/ui';

export interface ClubRule {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const OPTION_CARD_CLASS = (selected: boolean) =>
  `flex cursor-pointer items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] transition-colors ${
    selected
      ? 'border-[color:var(--lkv-primary)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
      : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] border backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset'
  }`;

export default function CreateClubView() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    title: '',
    slogan: '',
    description: '',
    coverImage: '',
    logoImage: '',
    location: '',
    category: '',
    level: 'Tous niveaux bienvenus',
    rhythm: '',
    maxMembers: 20,
    zones: [] as string[],
    rules: [] as ClubRule[],
    membershipType: 'validation',
    feeType: 'gratuit',
    feeAmount: 0,
    whatsappUrl: '',
    instagramUrl: '',
    stravaUrl: '',
    websiteUrl: '',
    visibility: 'public',
  });

  const availableZones = ['Chartreuse', 'Vercors', 'Belledonne', 'Écrins', 'Mont-Blanc', 'Aravis', 'Beaufortain', 'Queyras', 'Bauges'];
  const availableLevels = ['Tous niveaux bienvenus', 'Débutant motivé', 'Intermédiaire régulier', 'Sportif & engagé', 'Expert haute montagne'];

  const [activeSection, setActiveSection] = useState<'identite' | 'thematique' | 'regles' | 'adhesion' | 'reseaux'>('identite');
  const SECTIONS = [
    { id: 'identite' as const, label: 'Identité & Visuels', short: '01', desc: 'Nom, logo & couverture' },
    { id: 'thematique' as const, label: 'Thématique & Niveau', short: '02', desc: 'Discipline, massifs & rythme' },
    { id: 'regles' as const, label: 'Charte & Règles', short: '03', desc: `${form.rules.length} règles définies` },
    { id: 'adhesion' as const, label: 'Adhésion & Équipe', short: '04', desc: 'Droits & validation' },
    { id: 'reseaux' as const, label: 'Réseaux & Visibilité', short: '05', desc: 'WhatsApp, Strava & Accès' },
  ];

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', currentUser.id).single();
          setUser({ ...currentUser, profile });
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

  const toggleZone = (zone: string) => {
    setForm(prev => {
      const exists = prev.zones.includes(zone);
      return {
        ...prev,
        zones: exists ? prev.zones.filter(z => z !== zone) : [...prev.zones, zone]
      };
    });
  };

  const removeRule = (id: string) => {
    setForm(prev => ({ ...prev, rules: prev.rules.filter(r => r.id !== id) }));
  };

  const addRule = () => {
    const newRule: ClubRule = {
      id: `r-${Date.now()}`,
      title: 'Nouvelle règle',
      description: 'Précisez l’esprit attendu pour les membres.',
      icon: 'ShieldCheckIcon'
    };
    setForm(prev => ({ ...prev, rules: [...prev.rules, newRule] }));
  };

  const handlePublish = async () => {
    if (!user) {
      setSaveError('Connectez-vous pour fonder un club.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const slugBase = form.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      const slug = slugBase ? `${slugBase}-${Math.random().toString(36).slice(2, 6)}` : `club-${Math.random().toString(36).slice(2, 10)}`;

      const payload = {
        slug,
        name: form.title,
        description: [form.description, form.location ? `📍 ${form.location}` : ''].filter(Boolean).join('\n\n'),
        cover_image: form.coverImage,
        category: form.category,
        privacy: form.visibility === 'public' ? 'open' : 'closed',
        rules: (form.rules || []).map((rule: ClubRule) => `${rule.title} : ${rule.description}`).join('\n'),
        created_by: user.id,
      };

      const { data, error } = await supabase.from('clubs').insert([payload]).select('id, slug').single();
      if (error || !data) {
        throw new Error(error?.message || 'Création du club refusée');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/clubs/${data.slug || data.id}`);
      }, 800);
    } catch (e) {
      console.error(e);
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la création du club.');
    } finally {
      setSaving(false);
    }
  };

  const checklistItems = [
    { label: 'Nom & Slogan', done: form.title.length >= 3 && form.slogan.length > 5 },
    { label: 'Couverture & Logo', done: !!form.coverImage && !!form.logoImage },
    { label: 'Description & Ville', done: form.description.length >= 20 && form.location.length > 2 },
    { label: 'Au moins 3 règles', done: form.rules.length >= 3 },
  ];
  const doneCount = checklistItems.filter(i => i.done).length;

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-transparent font-sans text-[color:var(--lkv-text-primary)]">
      <CompteBackground />
      <Header />

      <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 gap-[var(--space-5)] overflow-hidden px-[var(--space-4)] pb-[var(--space-4)] pt-24 sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
        <aside className="flex h-full max-h-full w-[230px] shrink-0 select-none flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] font-sans text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)]">
          <div className="shrink-0 space-y-[var(--space-2)]">
            <Card variant="compact" className="flex items-center gap-[var(--space-3)] border-[color:var(--glass-border)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-xl" aria-hidden>
                🎪
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-tight text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
                  Création{' '}
                  <span className="font-serif text-[length:var(--lkv-text-caption)] font-normal italic text-[color:var(--lkv-secondary)]">
                    Club
                  </span>
                </h4>
                <p className="mt-[var(--space-1)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  Studio Collectif
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-[var(--space-1)]">
              <Link
                href="/clubs"
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

          <nav className="min-h-0 flex-1 space-y-[var(--space-1)] overflow-y-auto py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Étapes de création du club">
            <p className="mb-[var(--space-1)] px-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
              Étapes de création
            </p>
            {SECTIONS.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <Button
                  key={sec.id}
                  type="button"
                  variant={isActive ? 'primary' : 'secondary'}
                  fullWidth
                  onClick={() => setActiveSection(sec.id)}
                  className="justify-between rounded-[var(--lkv-radius-md)] text-[length:var(--lkv-text-caption)]"
                  aria-pressed={isActive}
                >
                  <span className="truncate text-left">{sec.label}</span>
                  {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-[color:var(--lkv-text-inverted)]/70" aria-hidden />}
                </Button>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)] text-center">
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Le Kit du Voyageur · Studio Club
            </span>
          </div>
        </aside>

        <div className="h-full min-w-0 flex-1 space-y-[var(--space-4)] overflow-y-auto pr-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
            <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
            <Link href="/communaute?tab=clubs" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Clubs</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
            <span className="font-semibold text-[color:var(--lkv-text-primary)]">Créer un club</span>
          </div>

          {activeSection === 'identite' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Identité, Visuels &amp; Ville</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Définissez le nom, l’emblème, la couverture et le camp de base du club.</p>
                </div>
                <Badge className="font-mono font-bold">01 · IDENTITÉ</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <div>
                    <label htmlFor="club-title" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Nom du club *</label>
                    <input
                      id="club-title"
                      type="text"
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder="Ex : Les Cimes Sauvages"
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="club-location" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Ville / Camp de base *</label>
                    <input
                      id="club-location"
                      type="text"
                      value={form.location}
                      onChange={(e) => setField('location', e.target.value)}
                      placeholder="Ex : Grenoble · Isère"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="club-slogan" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Slogan ou promesse en une phrase</label>
                  <input
                    id="club-slogan"
                    type="text"
                    value={form.slogan}
                    onChange={(e) => setField('slogan', e.target.value)}
                    placeholder="Ex : Marcher ensemble en Chartreuse, sans se précipiter."
                    className={FIELD_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="club-description" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Description détaillée &amp; Esprit du club</label>
                  <textarea
                    id="club-description"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Décrivez les objectifs, le profil des membres, la philosophie des sorties..."
                    className={`${FIELD_CLASS} resize-y`}
                  />
                </div>

                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <div>
                    <label htmlFor="club-cover" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Photo de couverture (URL)</label>
                    <input
                      id="club-cover"
                      type="text"
                      value={form.coverImage}
                      onChange={(e) => setField('coverImage', e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="club-logo" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Logo / Avatar du club (URL)</label>
                    <input
                      id="club-logo"
                      type="text"
                      value={form.logoImage}
                      onChange={(e) => setField('logoImage', e.target.value)}
                      placeholder="https://..."
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-[var(--space-2)]">
                <Button
                  type="button"
                  onClick={() => setActiveSection('thematique')}
                >
                  Suivant : Thématique &amp; Niveau →
                </Button>
              </div>
            </Card>
          )}

          {activeSection === 'thematique' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Pratique, Niveau &amp; Massifs</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Précisez le cadre sportif, le rythme et les terrains explorés.</p>
                </div>
                <Badge className="font-mono font-bold">02 · CADRE</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
                  <div>
                    <label htmlFor="club-category" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Discipline principale</label>
                    <select
                      id="club-category"
                      value={form.category}
                      onChange={(e) => setField('category', e.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option>Randonnée &amp; bivouac</option>
                      <option>Alpinisme &amp; haute montagne</option>
                      <option>Trail &amp; course nature</option>
                      <option>Bikepacking &amp; gravel</option>
                      <option>Ski de rando &amp; hivernale</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="club-level" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Niveau requis</label>
                    <select
                      id="club-level"
                      value={form.level}
                      onChange={(e) => setField('level', e.target.value)}
                      className={FIELD_CLASS}
                    >
                      {availableLevels.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="club-rhythm" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Rythme des sorties</label>
                    <input
                      id="club-rhythm"
                      type="text"
                      value={form.rhythm}
                      onChange={(e) => setField('rhythm', e.target.value)}
                      placeholder="Ex : 1 à 2 sorties/mois"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <span className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Massifs de prédilection</span>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    {availableZones.map((z) => {
                      const isSelected = form.zones.includes(z);
                      return (
                        <Button
                          key={z}
                          type="button"
                          variant={isSelected ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => toggleZone(z)}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? '✓ ' : '+ '} {z}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-[var(--space-2)]">
                  <label htmlFor="club-max-members" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Capacité maximale du club</label>
                  <div className="flex items-center gap-[var(--space-3)]">
                    <input
                      id="club-max-members"
                      type="range"
                      min={10}
                      max={200}
                      step={10}
                      value={form.maxMembers}
                      onChange={(e) => setField('maxMembers', parseInt(e.target.value))}
                      className="flex-1 accent-[var(--lkv-primary)]"
                    />
                    <span className="w-24 text-right font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                      {form.maxMembers} membres
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveSection('identite')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveSection('regles')}
                >
                  Suivant : Charte &amp; Règles →
                </Button>
              </div>
            </Card>
          )}

          {activeSection === 'regles' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Charte &amp; Règles du club</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Chaque membre s’y engage à l’adhésion pour garantir l&apos;esprit d&apos;équipe.</p>
                </div>
                <Badge className="font-mono font-bold">03 · CHARTE</Badge>
              </div>

              <div className="space-y-[var(--space-3)]">
                {form.rules.map((rule) => (
                  <Card key={rule.id} variant="compact" className="flex items-center gap-[var(--space-3)]">
                    <span className="text-[length:var(--lkv-text-subheadline)]" aria-hidden>🛡️</span>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={rule.title}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          rules: prev.rules.map(r => r.id === rule.id ? { ...r, title: e.target.value } : r)
                        }))}
                        aria-label="Titre de la règle"
                        className="w-full border-none bg-transparent p-0 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] focus:outline-none focus:ring-0"
                      />
                      <input
                        type="text"
                        value={rule.description}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          rules: prev.rules.map(r => r.id === rule.id ? { ...r, description: e.target.value } : r)
                        }))}
                        aria-label="Description de la règle"
                        className="w-full border-none bg-transparent p-0 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-0"
                      />
                    </div>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRule(rule.id)}
                      aria-label={`Supprimer la règle ${rule.title}`}
                      className="shrink-0"
                    >
                      <Icon name="x" size={14} aria-hidden="true" />
                    </IconButton>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={addRule}
                  icon={<Icon name="plus" size={14} aria-hidden="true" />}
                >
                  Ajouter une règle à la charte
                </Button>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveSection('thematique')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveSection('adhesion')}
                >
                  Suivant : Adhésion &amp; Équipe →
                </Button>
              </div>
            </Card>
          )}

          {activeSection === 'adhesion' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Adhésion &amp; Cotisation</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Paramétrez l’accès des membres et la gestion des sorties.</p>
                </div>
                <Badge className="font-mono font-bold">04 · ADHÉSION</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div>
                  <span className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Modalité d&apos;inscription</span>
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                    {[
                      { id: 'validation', label: '🛡️ Sur validation', desc: 'Le fondateur ou les modérateurs valident chaque demande.' },
                      { id: 'open', label: '⚡ Inscription libre', desc: 'Tout membre de la communauté peut rejoindre directement.' },
                    ].map((m) => (
                      <label
                        key={m.id}
                        className={OPTION_CARD_CLASS(form.membershipType === m.id)}
                      >
                        <input
                          type="radio"
                          name="membership_type"
                          value={m.id}
                          checked={form.membershipType === m.id}
                          onChange={() => setField('membershipType', m.id)}
                          className="mt-[2px] accent-[var(--lkv-primary)]"
                        />
                        <div>
                          <span className="block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{m.label}</span>
                          <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{m.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-[var(--space-2)]">
                  <span className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Cotisation</span>
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                    <label className={OPTION_CARD_CLASS(form.feeType === 'gratuit')}>
                      <input
                        type="radio"
                        name="fee_type"
                        checked={form.feeType === 'gratuit'}
                        onChange={() => setField('feeType', 'gratuit')}
                        className="accent-[var(--lkv-primary)]"
                      />
                      <span className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">🎁 Gratuit (100% bénévole)</span>
                    </label>

                    <label className={OPTION_CARD_CLASS(form.feeType === 'annuel')}>
                      <input
                        type="radio"
                        name="fee_type"
                        checked={form.feeType === 'annuel'}
                        onChange={() => setField('feeType', 'annuel')}
                        className="accent-[var(--lkv-primary)]"
                      />
                      <span className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">💶 Adhésion annuelle club</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-[var(--space-2)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveSection('regles')}
                >
                  ← Précédent
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveSection('reseaux')}
                >
                  Suivant : Réseaux &amp; Visibilité →
                </Button>
              </div>
            </Card>
          )}

          {activeSection === 'reseaux' && (
            <Card className="space-y-[var(--space-5)] p-[var(--space-6)]">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)]">
                <div>
                  <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Réseaux &amp; Visibilité du Club</h2>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Liez vos canaux externes (WhatsApp, Strava, Instagram) et publiez le club.</p>
                </div>
                <Badge className="font-mono font-bold">05 · RÉSEAUX</Badge>
              </div>

              <div className="space-y-[var(--space-4)]">
                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <div>
                    <label htmlFor="club-whatsapp" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Lien Groupe WhatsApp / Discord</label>
                    <input
                      id="club-whatsapp"
                      type="text"
                      value={form.whatsappUrl}
                      onChange={(e) => setField('whatsappUrl', e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="club-instagram" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Compte Instagram / Strava</label>
                    <input
                      id="club-instagram"
                      type="text"
                      value={form.instagramUrl}
                      onChange={(e) => setField('instagramUrl', e.target.value)}
                      placeholder="https://instagram.com/..."
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div className="pt-[var(--space-2)]">
                  <span className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">Visibilité du club</span>
                  <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                    {[
                      { id: 'public', label: '🌍 Public LKDV', desc: 'Visible dans l’annuaire communautaire et sur la carte.' },
                      { id: 'invite', label: '🔗 Privé / Sur invitation', desc: 'Accessible uniquement via lien de parrainage.' },
                    ].map((vis) => (
                      <label
                        key={vis.id}
                        className={OPTION_CARD_CLASS(form.visibility === vis.id)}
                      >
                        <input
                          type="radio"
                          name="club_visibility"
                          value={vis.id}
                          checked={form.visibility === vis.id}
                          onChange={() => setField('visibility', vis.id)}
                          className="mt-[2px] accent-[var(--lkv-primary)]"
                        />
                        <div>
                          <span className="block text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{vis.label}</span>
                          <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{vis.desc}</span>
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
                  onClick={() => setActiveSection('adhesion')}
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
                    {saving ? 'Création...' : saveSuccess ? '✓ Créé !' : 'Fonder le club'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside className="flex h-full w-[300px] shrink-0 flex-col gap-[var(--space-4)] overflow-y-auto pb-[var(--space-8)]">
          <Card className="space-y-[var(--space-3)] p-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Aperçu en direct</h3>
              <Badge className="font-mono font-bold">Live</Badge>
            </div>

            <Card variant="compact" className="flex flex-col overflow-hidden p-0">
              <div className="relative h-28 bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn">
                {form.coverImage && (
                  <img src={form.coverImage} alt="Couverture du club" className="h-full w-full object-cover" />
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Badge className="absolute bottom-2 left-2 border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] font-mono font-bold text-[color:var(--lkv-text-inverted)] backdrop-blur-[var(--blur-md)]">
                  {form.category}
                </Badge>
              </div>
              <div className="space-y-[var(--space-1)] p-[var(--space-3)]">
                <h4 className="font-display text-[length:var(--lkv-text-caption)] font-bold leading-snug text-[color:var(--lkv-text-primary)]">
                  {form.title || 'Nom du club'}
                </h4>
                <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-primary)]">
                  📍 {form.location}
                </span>
                <p className="line-clamp-2 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {form.slogan || form.description}
                </p>
                <div className="flex items-center justify-between border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  <span>{form.level}</span>
                  <span>{form.rules.length} règles</span>
                </div>
              </div>
            </Card>
          </Card>

          <Card className="space-y-[var(--space-2)] p-[var(--space-3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Checklist Club</h3>
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{doneCount}/4</span>
            </div>

            <div className="space-y-[var(--space-1)] text-[length:var(--lkv-text-caption-2)]">
              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-[var(--space-1)] text-[color:var(--lkv-text-primary)]">
                    <span
                      aria-hidden
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[length:var(--lkv-text-caption-2)] ${
                        item.done ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]' : 'bg-[color:var(--lkv-primary)]/10 text-transparent'
                      }`}
                    >
                      {item.done && '✓'}
                    </span>
                    {item.label}
                  </span>
                  <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                    {item.done ? 'OK' : 'À faire'}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-[var(--space-2)] border-t border-[color:var(--lkv-primary)]/10 pt-[var(--space-2)]">
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
                icon={<Icon name="PlusIcon" size={13} aria-hidden="true" />}
              >
                {saving ? 'Création...' : 'Fonder le club'}
              </Button>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
