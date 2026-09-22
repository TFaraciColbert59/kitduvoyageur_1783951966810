'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, Chip, Switch } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function EditProfileView({ onCloseModal, onSave }: { onCloseModal?: () => void; onSave?: (updatedProfile: any) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  // Erreurs annoncées (référence `contact` : labels + role=alert + 44px).
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form State
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    publicName: '',
    username: '',
    shortBio: '',
    bio: '',
    city: '',
    country: 'France',
    timezone: 'Europe/Paris (UTC+01:00)',
    avatarUrl: '/assets/images/no_image.png',
    heroUrl: '',
    selectedMassifs: [] as string[],
    languages: ['Français'],
    disciplines: ['Randonnée', 'Bivouac'],
    experienceLevel: 'I',
    avgDistance: '',
    avgElevation: '',
    pace: '',
    stravaConnected: false,
    garminConnected: false,
    komootConnected: false,
    wikilocConnected: false,
    directoryVisible: true,
    showLocation: true,
    allowTripRequests: true,
    publicStats: false,
    allowPrivateMessages: true
  });

  const availableMassifs = [
    'Chartreuse', 'Belledonne', 'Vercors', 'Écrins', 'Mont-Blanc', 
    'Aravis', 'Mercantour', 'Pyrénées', 'Corse', 'Cévennes', 'Vosges', 'Jura'
  ];

  const availableDisciplines = [
    { id: 'Randonnée', label: '🏔️ Randonnée' },
    { id: 'Bivouac', label: '🏕️ Bivouac' },
    { id: 'Alpinisme', label: '🚵 Alpinisme' },
    { id: 'Ski de rando', label: '⛷️ Ski de rando' },
    { id: 'Trail', label: '🚣 Trail' },
    { id: 'VTT', label: '🚴 VTT' },
    { id: 'Escalade', label: '🧭 Escalade' },
    { id: 'Haute montagne', label: '❄️ Haute montagne' }
  ];

  // Fetch Saved Profile from localStorage / Supabase on Mount
  useEffect(() => {
    async function loadUserProfile() {
      try {
        // First check localStorage for immediate persistence
        const saved = localStorage.getItem('user_profile_data');
        if (saved) {
          const p = JSON.parse(saved);
          setForm(prev => ({
            ...prev,
            firstName: p.first_name || prev.firstName,
            lastName: p.last_name || prev.lastName,
            publicName: p.full_name || prev.publicName,
            username: p.username || prev.username,
            shortBio: p.short_bio || prev.shortBio,
            bio: p.bio || prev.bio,
            city: p.location || prev.city,
            avatarUrl: p.avatar_url || prev.avatarUrl,
            heroUrl: p.hero_image_url || prev.heroUrl,
            country: p.country || prev.country,
            selectedMassifs: p.selected_massifs || prev.selectedMassifs,
            disciplines: p.disciplines || prev.disciplines
          }));
        }

        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (profileData) {
            const nameParts = (profileData.full_name || '').split(' ');
            setForm(prev => ({
              ...prev,
              firstName: nameParts[0] || prev.firstName,
              lastName: nameParts.slice(1).join(' ') || prev.lastName,
              publicName: profileData.full_name || prev.publicName,
              avatarUrl: profileData.avatar_url || currentUser.user_metadata?.avatar_url || prev.avatarUrl,
              bio: profileData.bio || prev.bio,
              city: profileData.location || prev.city,
            }));
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, []);

  // Update Field Handler
  const setField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleArrayItem = (key: string, item: string) => {
    setForm(prev => {
      const arr = (prev as any)[key] as string[];
      const exists = arr.includes(item);
      return {
        ...prev,
        [key]: exists ? arr.filter(i => i !== item) : [...arr, item]
      };
    });
  };

  // Calculate Profile Completion Rate
  const completionScore = React.useMemo(() => {
    let score = 0;
    if (form.avatarUrl) score += 20;
    if (form.bio) score += 20;
    if (form.selectedMassifs.length >= 3) score += 15;
    if (form.disciplines.length >= 1) score += 15;
    if (form.experienceLevel) score += 15;
    if (form.stravaConnected || form.garminConnected) score += 15;
    return Math.min(100, score);
  }, [form]);

  const validateProfile = () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Indiquez votre prénom.';
    if (!form.lastName.trim()) next.lastName = 'Indiquez votre nom.';
    if (!form.username.trim()) next.username = 'Choisissez un nom d’utilisateur.';
    else if (!/^[a-z0-9_]{3,}$/.test(form.username.trim())) next.username = '3 caractères min : lettres, chiffres, underscore.';
    if (!form.city.trim()) next.city = 'Indiquez votre ville de résidence.';
    return next;
  };

  // Save Handler to LocalStorage & Supabase
  const handleSave = async () => {
    const validation = validateProfile();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const updatedProfileData = {
        first_name: form.firstName,
        last_name: form.lastName.endsWith('.') ? form.lastName : `${form.lastName}.`,
        full_name: fullName,
        username: form.username,
        bio: form.bio,
        short_bio: form.shortBio,
        location: form.city,
        country: form.country,
        avatar_url: form.avatarUrl,
        hero_image_url: form.heroUrl,
        selected_massifs: form.selectedMassifs,
        disciplines: form.disciplines,
        experience_level: form.experienceLevel,
      };

      // 1. Save to LocalStorage for instant persistence
      localStorage.setItem('user_profile_data', JSON.stringify(updatedProfileData));

      // 2. Dispatch global profile_updated event
      window.dispatchEvent(new CustomEvent('profile_updated', { detail: updatedProfileData }));

      // 3. Call onSave callback if passed
      if (onSave) {
        onSave(updatedProfileData);
      }

      // 4. Save to Supabase user_profiles table
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (currentUser) {
        const { error } = await supabase.from('user_profiles').upsert({
          id: currentUser.id,
          full_name: fullName,
          avatar_url: form.avatarUrl,
          bio: form.bio,
          location: form.city,
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) {
          console.warn("Supabase upsert warning:", error);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onCloseModal) {
        setTimeout(onCloseModal, 500);
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--stone-50)]/80 pb-28 font-sans text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-lg)]">
      {/* 1. TOP STICKY NAVBAR — desktop uniquement */}
      <header className="lkv-material-header sticky top-0 z-[var(--z-sticky)] hidden items-center justify-between border-b border-[color:var(--lkv-primary)]/5 px-4 py-3.5 sm:px-8 md:flex">
        <div className="flex items-center gap-4">
          <Link href="/compte" className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] text-[color:var(--btn-content)] shadow-elevation-1 text-xs font-bold !py-1.5 !px-3">
            <Icon name="ArrowLeftIcon" size={14} />
            <span>Mon compte</span>
          </Link>
          <span className="text-[color:var(--lkv-primary)]/10">|</span>
          <span className="text-xs font-mono font-bold text-[color:var(--lkv-primary)] uppercase tracking-wider">Modifier mon profil</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[length:var(--lkv-text-caption-2)] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--lkv-secondary)] animate-pulse mr-1"></span>
            ⚡ Modifications synchronisées
          </span>

          <Link
            href="/compte"
            className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] text-[color:var(--btn-content)] shadow-elevation-1 text-xs font-bold"
          >
            <Icon name="EyeIcon" size={14} />
            <span>Aperçu public</span>
          </Link>

          <Button onClick={handleSave} disabled={saving} loading={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </header>

      {/* 2. HERO TITLE SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest text-[color:var(--lkv-text-muted)] uppercase font-bold mb-2">
          — ÉDITION PROFIL · {form.firstName} {form.lastName}
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl text-[color:var(--lkv-primary)] tracking-tight mb-2">
          Racontez qui vous êtes, <br className="hidden sm:inline" />
          <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">et où vous allez.</span>
        </h1>
        <p className="text-xs sm:text-sm text-[color:var(--lkv-text-muted)] max-w-2xl leading-relaxed">
          Votre profil apparaît sur vos carnets, dans les clubs et à côté de vos aventures. Prenez le temps — les meilleures histoires ont de bons auteurs.
        </p>
      </div>

      {/* Résumé d'erreurs annoncé (référence contact : role=alert + aria-live) */}
      {Object.keys(errors).length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4" role="alert" aria-live="assertive">
          <div className="rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-danger-dark)]/30 bg-[color:var(--lkv-danger-bg)] px-[var(--space-4)] py-3">
            <p className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-danger-dark)]">
              Vérifiez {Object.keys(errors).length} champ{Object.keys(errors).length > 1 ? 's' : ''} avant d’enregistrer.
            </p>
            <ul className="mt-1 list-disc pl-5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-danger-dark)]">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>
                  <a href={`#profil-${key}`} className="underline underline-offset-2">{msg}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 3. MAIN FORM & SIDEBAR GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: FORM SECTIONS (8 COLS) */}
        <div className="lg:col-span-8 space-y-8">
          {/* ─── SECTION 01: IDENTITÉ PUBLIQUE ──────────────────────── */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[color:var(--lkv-primary)]/5">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">Identité publique</h2>
                <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">Nom, avatar, couverture. Ce que la communauté voit en premier.</p>
              </div>
              <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[length:var(--lkv-text-caption-2)] font-mono">
                01 · VISIBILITÉ
              </span>
            </div>

            {/* Cover Photo Header */}
            <div className="relative rounded-2xl overflow-hidden h-44 sm:h-52 bg-[color:var(--btn-tint)] group border border-[color:var(--glass-border)]">
              {form.heroUrl ? (
                <img src={form.heroUrl} alt="Photo de couverture" className="w-full h-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              <div className="absolute top-4 right-4 flex gap-2">
                <label className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] text-[color:var(--btn-content)] shadow-elevation-1 text-xs font-bold cursor-pointer">
                  <Icon name="CameraIcon" size={14} /> Changer
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setField('heroUrl', URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setField('heroUrl', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200')}
                >
                  Réinitialiser
                </Button>
              </div>
            </div>

            {/* Avatar & Subtitle Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 relative z-[var(--z-dropdown)] px-4">
              <div className="flex items-end gap-4">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-[color:var(--glass-border)] shadow-md overflow-hidden bg-[color:var(--glass-bg-medium)] shrink-0">
                  <img src={form.avatarUrl || '/assets/images/no_image.png'} alt={form.publicName || 'Photo de profil'} className="w-full h-full object-cover" />
                  <label className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer">
                    <Icon name="CameraIcon" size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setField('avatarUrl', URL.createObjectURL(e.target.files[0]));
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="mb-2">
                  <h3 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">{form.firstName} {form.lastName}</h3>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] font-mono">Membre depuis mars 2023 · 12 carnets publiés</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--btn-blur)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] text-[color:var(--btn-content)] shadow-elevation-1 text-xs font-bold cursor-pointer">
                  Changer photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setField('avatarUrl', URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Inputs Grid — 3 groupes + sous-titres (6 champs section 01) */}
            <div className="space-y-6 pt-2">
              <fieldset className="border-0 m-0 p-0">
                <legend className="sr-only">État civil</legend>
                <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">État civil</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="profil-firstName" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Prénom *</label>
                    <input
                      id="profil-firstName"
                      type="text"
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={(e) => {
                        setField('firstName', e.target.value);
                        setField('publicName', `${e.target.value} ${form.lastName}`);
                      }}
                      aria-invalid={Boolean(errors.firstName)}
                      aria-describedby={errors.firstName ? 'profil-firstName-erreur' : undefined}
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                    />
                    {errors.firstName && <p id="profil-firstName-erreur" role="alert" aria-live="assertive" className="mt-1.5 text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-danger-dark)]">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="profil-lastName" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Nom *</label>
                    <input
                      id="profil-lastName"
                      type="text"
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={(e) => {
                        setField('lastName', e.target.value);
                        setField('publicName', `${form.firstName} ${e.target.value}`);
                      }}
                      aria-invalid={Boolean(errors.lastName)}
                      aria-describedby={errors.lastName ? 'profil-lastName-erreur' : undefined}
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                    />
                    {errors.lastName && <p id="profil-lastName-erreur" role="alert" aria-live="assertive" className="mt-1.5 text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-danger-dark)]">{errors.lastName}</p>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="border-0 m-0 p-0">
                <legend className="sr-only">Profil public</legend>
                <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Profil public</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="profil-publicName" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Nom d’usage public</label>
                    <input
                      id="profil-publicName"
                      type="text"
                      autoComplete="nickname"
                      value={form.publicName}
                      onChange={(e) => setField('publicName', e.target.value)}
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="profil-username" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block font-bold">Nom d’utilisateur *</label>
                      <span className="text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-secondary)] font-bold" aria-hidden="true">✓ Disponible</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[color:var(--lkv-text-muted)]" aria-hidden="true">@</span>
                      <input
                        id="profil-username"
                        type="text"
                        autoComplete="username"
                        value={form.username}
                        onChange={(e) => setField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        aria-invalid={Boolean(errors.username)}
                        aria-describedby={errors.username ? 'profil-username-erreur' : undefined}
                        className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full pl-8"
                      />
                    </div>
                    {errors.username && <p id="profil-username-erreur" role="alert" aria-live="assertive" className="mt-1.5 text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-danger-dark)]">{errors.username}</p>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="border-0 m-0 p-0">
                <legend className="sr-only">Biographie</legend>
                <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Biographie</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="profil-shortBio" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block font-bold">Bio courte (Signature)</label>
                      <span className="text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-text-muted)]" aria-live="polite">{form.shortBio.length} / 120</span>
                    </div>
                    <input
                      id="profil-shortBio"
                      type="text"
                      maxLength={120}
                      value={form.shortBio}
                      onChange={(e) => setField('shortBio', e.target.value)}
                      placeholder="Randonneuse babillarde & Cannelle. Je marche pour retrouver le silence..."
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full font-serif italic"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="profil-bio" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block font-bold">À propos (Description complète)</label>
                      <span className="text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-text-muted)]" aria-live="polite">{form.bio.length} / 500</span>
                    </div>
                    <textarea
                      id="profil-bio"
                      rows={4}
                      maxLength={500}
                      value={form.bio}
                      onChange={(e) => setField('bio', e.target.value)}
                      placeholder="Racontez vos expéditions, vos massifs favoris et votre approche de la randonnée..."
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full leading-relaxed resize-none font-serif italic"
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          </div>

          {/* ─── SECTION 02: ANCRAGE GÉOGRAPHIQUE ───────────────────── */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[color:var(--lkv-primary)]/5">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">Ancrage géographique</h2>
                <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">Pour proposer les bons refuges, les clubs proches et suggérer votre profil aux voyageurs.</p>
              </div>
              <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[length:var(--lkv-text-caption-2)] font-mono">
                02 · OÙ VOUS ÊTES
              </span>
            </div>

            <fieldset className="border-0 m-0 p-0">
              <legend className="sr-only">Localisation</legend>
              <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Localisation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profil-city" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Ville de résidence *</label>
                  <div className="relative">
                    <Icon name="MapPinIcon" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--lkv-text-muted)]" />
                    <input
                      id="profil-city"
                      type="text"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                      placeholder="Ex: Grenoble, Isère"
                      aria-invalid={Boolean(errors.city)}
                      aria-describedby={errors.city ? 'profil-city-erreur' : undefined}
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full pl-9"
                    />
                  </div>
                  {errors.city && <p id="profil-city-erreur" role="alert" aria-live="assertive" className="mt-1.5 text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-danger-dark)]">{errors.city}</p>}
                </div>

                <div>
                  <label htmlFor="profil-country" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Pays</label>
                  <select
                    id="profil-country"
                    value={form.country}
                    autoComplete="country-name"
                    onChange={(e) => setField('country', e.target.value)}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="France">France</option>
                    <option value="Suisse">Suisse</option>
                    <option value="Belgique">Belgique</option>
                    <option value="Canada">Canada</option>
                    <option value="Italie">Italie</option>
                    <option value="Espagne">Espagne</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Massifs De Prédilection Tags */}
            <fieldset className="border-0 m-0 p-0">
              <legend className="sr-only">Massifs de prédilection</legend>
              <h3 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] mb-2">Massifs de prédilection <span className="font-normal text-[color:var(--lkv-text-muted)]">(sélection multiple)</span></h3>
              <div className="flex flex-wrap gap-2">
                {availableMassifs.map((massif) => {
                  const isSelected = form.selectedMassifs.includes(massif);
                  return (
                    <Chip
                      key={massif}
                      selected={isSelected}
                      onClick={() => toggleArrayItem('selectedMassifs', massif)}
                      className="font-bold"
                    >
                      {isSelected ? `✓ ${massif}` : massif}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>

            {/* Timezone & Languages */}
            <fieldset className="border-0 m-0 p-0">
              <legend className="sr-only">Fuseau horaire et langues</legend>
              <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Fuseau horaire et langues</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="profil-timezone" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Fuseau horaire</label>
                <select
                  id="profil-timezone"
                  value={form.timezone}
                  onChange={(e) => setField('timezone', e.target.value)}
                  className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full text-xs font-semibold"
                >
                  <option value="Europe/Paris (UTC+01:00)">Europe / Paris (UTC+01:00)</option>
                  <option value="Europe/London (UTC+00:00)">Europe / London (UTC+00:00)</option>
                  <option value="America/Montreal (UTC-05:00)">America / Montreal (UTC-05:00)</option>
                </select>
              </div>

              <div>
                <p id="profil-langues-label" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-2 font-bold">Langues parlées</p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="profil-langues-label">
                  {form.languages.map((lang) => (
                    <Chip
                      key={lang}
                      onClick={() => toggleArrayItem('languages', lang)}
                      icon={<span aria-hidden="true">✕</span>}
                      className="font-bold"
                    >
                      ✓ {lang}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            </fieldset>
          </div>

          {/* ─── SECTION 03: PRATIQUE & NIVEAU ──────────────────────── */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[color:var(--lkv-primary)]/5">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">Pratique &amp; niveau</h2>
                <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">Ces informations aident à me mettre en relation avec des personnes d'expérience compatible.</p>
              </div>
              <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[length:var(--lkv-text-caption-2)] font-mono">
                03 · VOS COMPÉTENCES
              </span>
            </div>

            {/* Disciplines Selection Grid */}
            <fieldset className="border-0 m-0 p-0">
              <legend className="sr-only">Disciplines pratiquées</legend>
              <h3 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] mb-3">Disciplines pratiquées</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {availableDisciplines.map((d) => {
                  const isSelected = form.disciplines.includes(d.id);
                  return (
                    <Chip
                      key={d.id}
                      selected={isSelected}
                      onClick={() => toggleArrayItem('disciplines', d.id)}
                      className="w-full font-bold"
                    >
                      {d.label}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>

            {/* Niveau d'expérience selector */}
            <fieldset className="border-0 m-0 p-0">
              <legend className="sr-only">Niveau d’expérience globale</legend>
              <h3 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] mb-3">Niveau d’expérience globale</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'I', label: 'I · Débutant', sub: '1-2 ans' },
                  { id: 'II', label: 'II · Régulier', sub: '3-5 ans' },
                  { id: 'III', label: 'III · Expérimenté', sub: '6-10 ans' },
                  { id: 'IV', label: 'IV · Guide', sub: '>10 ans' },
                ].map((lvl) => {
                  const isActive = form.experienceLevel === lvl.id;
                  return (
                    <Chip
                      key={lvl.id}
                      selected={isActive}
                      onClick={() => setField('experienceLevel', lvl.id)}
                      className="h-auto w-full flex-col px-[var(--space-3)] py-[var(--space-2)]"
                    >
                      <span className="text-[length:var(--lkv-text-caption)] font-bold">{lvl.label}</span>
                      <span className="mt-0.5 font-mono text-[length:var(--lkv-text-caption-2)] opacity-80">{lvl.sub}</span>
                    </Chip>
                  );
                })}
              </div>
            </fieldset>

            {/* Metric Inputs */}
            <fieldset className="border-0 m-0 p-0">
              <legend className="sr-only">Mesures moyennes par sortie</legend>
              <h3 className="mb-3 text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Mesures moyennes par sortie</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label htmlFor="profil-avgDistance" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Distance moy. / sortie</label>
                <input
                  id="profil-avgDistance"
                  type="text"
                  autoComplete="off"
                  value={form.avgDistance}
                  onChange={(e) => setField('avgDistance', e.target.value)}
                  placeholder="18 km"
                  className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label htmlFor="profil-avgElevation" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Dénivelé moy. / sortie</label>
                <input
                  id="profil-avgElevation"
                  type="text"
                  autoComplete="off"
                  value={form.avgElevation}
                  onChange={(e) => setField('avgElevation', e.target.value)}
                  placeholder="1200 m D+"
                  className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label htmlFor="profil-pace" className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest uppercase text-[color:var(--lkv-text-muted)] block mb-1.5 font-bold">Rythme en effort</label>
                <input
                  id="profil-pace"
                  type="text"
                  autoComplete="off"
                  value={form.pace}
                  onChange={(e) => setField('pace', e.target.value)}
                  placeholder="3.5 à 4 km/h"
                  className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full text-xs font-mono font-bold"
                />
              </div>
              </div>
            </fieldset>
          </div>

          {/* ─── SECTION 04: COMPTES LIÉS ───────────────────────────── */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[color:var(--lkv-primary)]/5">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">Comptes liés</h2>
                <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">Importez vos traces depuis les plateformes que vous utilisez déjà.</p>
              </div>
              <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[length:var(--lkv-text-caption-2)] font-mono">
                04 · IMPORT &amp; PARTAGE
              </span>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Strava', handle: '@mchevrier · 124 sorties synchro', connected: form.stravaConnected, key: 'stravaConnected', icon: '🧡' },
                { name: 'Garmin Connect', handle: '@mchevrier_trek · Traces synchro', connected: form.garminConnected, key: 'garminConnected', icon: '🟦' },
                { name: 'Komoot', handle: 'Non connecté', connected: form.komootConnected, key: 'komootConnected', icon: '💚' },
                { name: 'Wikiloc', handle: 'Non connecté', connected: form.wikilocConnected, key: 'wikilocConnected', icon: '🟢' },
              ].map((app) => (
                <div key={app.name} className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{app.icon}</span>
                    <div>
                      <div className="font-bold text-xs text-[color:var(--lkv-primary)]">{app.name}</div>
                      <div className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)] font-mono mt-0.5">{app.handle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {app.connected ? (
                      <>
                        <Badge tone="sage" className="font-mono text-[length:var(--lkv-text-caption-2)]">Connecté</Badge>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setField(app.key, false)}
                        >
                          Déconnecter
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setField(app.key, true)}
                      >
                        Connecter
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── SECTION 05: CONFIDENTIALITÉ ────────────────────────── */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[color:var(--lkv-primary)]/5">
              <div>
                <h2 className="font-display font-bold text-lg sm:text-xl text-[color:var(--lkv-primary)]">Qui peut voir quoi</h2>
                <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">Et avec qui vous partagez vos traces. Vos carnets peuvent être publics, tout en gardant vos sorties privées.</p>
              </div>
              <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[length:var(--lkv-text-caption-2)] font-mono">
                05 · CONFIDENTIALITÉ
              </span>
            </div>

            <div className="space-y-3">
              {[
                { key: 'directoryVisible', title: 'Profil visible dans l\'annuaire', desc: 'Les autres voyageurs pourront vous trouver dans la communauté.' },
                { key: 'showLocation', title: 'Afficher ma localisation', desc: 'Permet de faire apparaître votre ville sur vos fiches d\'aventures.' },
                { key: 'allowTripRequests', title: 'Autoriser les demandes de sortie', desc: 'D\'autres membres peuvent vous inviter à leurs sorties de bivouac.' },
                { key: 'publicStats', title: 'Statistiques publiques', desc: 'Vos km et vos dénivelés cumulés sont visibles sur votre profil.' },
                { key: 'allowPrivateMessages', title: 'Recevoir des messages privés', desc: 'Seuls les membres de vos clubs peuvent vous envoyer un message.' },
              ].map((item) => {
                const val = (form as any)[item.key];
                return (
                  <Card
                    key={item.key}
                    variant="compact"
                    className="flex items-center justify-between gap-[var(--space-4)]"
                  >
                    <div className="min-w-0">
                      <h4 className="text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">{item.title}</h4>
                      <p className="mt-0.5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{item.desc}</p>
                    </div>
                    <Switch
                      checked={Boolean(val)}
                      onCheckedChange={(next) => setField(item.key, next)}
                      aria-label={item.title}
                    />
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR WIDGETS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          {/* WIDGET 1: APERÇU PROFIL PUBLIC (Live Card) */}
          <div className="bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] rounded-[var(--lkv-radius-lg)] p-6 text-[color:var(--lkv-text-primary)] relative overflow-hidden space-y-4 shadow-xl border border-white/10">
            <div className="text-[9px] font-mono tracking-widest text-[color:var(--sage-300)] uppercase font-bold">APERÇU · PROFIL PUBLIC</div>

            <div className="flex items-center gap-4">
              <img src={form.avatarUrl || '/assets/images/no_image.png'} alt={form.publicName || 'Photo de profil'} className="w-14 h-14 rounded-full object-cover border-2 border-[color:var(--glass-border)]" />
              <div>
                <h3 className="font-display font-bold text-lg leading-tight">{form.publicName}</h3>
                <p className="text-[11px] text-white/70 font-mono">@{form.username} · {form.city}</p>
              </div>
            </div>

            <p className="text-xs text-white/90 font-serif italic leading-relaxed bg-white/10 p-3.5 rounded-2xl border border-white/10">
              "{form.shortBio || form.bio}"
            </p>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {form.selectedMassifs.slice(0, 3).map((m) => (
                <span key={m} className="bg-white/15 text-white text-[length:var(--lkv-text-caption-2)] font-mono px-2.5 py-1 rounded-full">
                  {m}
                </span>
              ))}
              <span className="bg-[color:var(--lkv-secondary)] text-white text-[length:var(--lkv-text-caption-2)] font-mono px-2.5 py-1 rounded-full font-bold">
                Niveau {form.experienceLevel}
              </span>
            </div>
          </div>

          {/* WIDGET 2: PROFIL COMPLÉTÉ À X% */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-[color:var(--lkv-primary)]">Profil complété à {completionScore}%</h3>
              <span className="text-xs font-mono font-bold text-[color:var(--lkv-secondary)]">{completionScore}/100</span>
            </div>

            <div className="w-full bg-[color:var(--lkv-primary)]/10 h-2 rounded-full overflow-hidden">
              <div className="bg-[color:var(--lkv-primary)] h-full transition-all duration-500 rounded-full" style={{ width: `${completionScore}%` }} />
            </div>

            <div className="space-y-2 pt-2">
              {[
                { label: 'Photo de profil', done: !!form.avatarUrl },
                { label: 'Bio renseignée', done: !!form.bio },
                { label: '3 massifs favoris', done: form.selectedMassifs.length >= 3 },
                { label: 'Discipline (s)', done: form.disciplines.length >= 1 },
                { label: 'Pratique & statistiques', done: !!form.experienceLevel },
                { label: 'Strava / Garmin connecté', done: form.stravaConnected || form.garminConnected },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className={item.done ? 'text-[color:var(--lkv-primary)] font-semibold' : 'text-[color:var(--lkv-text-muted)]'}>
                    {item.done ? '✓ ' : '⭕ '}{item.label}
                  </span>
                  <span className="text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-text-muted)]">{item.done ? 'Fait' : 'À faire'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WIDGET 3: ASTUCES & CONSEILS */}
          <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] p-6 text-[color:var(--lkv-primary)] space-y-2 !border-[color:var(--lkv-secondary)]/30">
            <div className="text-[length:var(--lkv-text-caption-2)] font-mono tracking-widest text-[color:var(--lkv-secondary)] uppercase font-bold">CONSEIL DE LA COMMUNAUTÉ</div>
            <h4 className="font-display font-bold text-sm">Une bio qui inspire.</h4>
            <p className="text-xs text-[color:var(--lkv-text-muted)] leading-relaxed font-serif italic">
              Faites des liens entre vos massifs de prédilection et vos disciplines favorites. C'est plus facile pour vous contacter et partir ensemble !
            </p>
          </div>
        </div>
      </div>

      {/* 4. FLOATING BOTTOM BAR */}
      <div
        className="fixed bottom-[calc(var(--safe-bottom)+62px+8px)] left-2 right-2 z-[var(--z-fab)] flex items-center justify-between gap-[var(--space-3)] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-4)] py-[var(--space-3)] text-[color:var(--lkv-text-primary)] md:bottom-6 md:left-1/2 md:right-auto md:w-11/12 md:max-w-xl md:-translate-x-1/2 md:px-[var(--space-6)] md:py-[14px]"
      >
        <div className="hidden items-center gap-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-inverted)]/80 md:flex">
          <span aria-hidden="true">⚡</span>
          <span>Brouillon synchronisé</span>
        </div>

        <div className="flex w-full items-center justify-end gap-[var(--space-2)] md:w-auto md:gap-[var(--space-3)]">
          <Button variant="secondary" size="sm" onClick={() => router.push('/compte')} className="whitespace-nowrap">
            Annuler
          </Button>

          <Button
            variant="primary"
            size="sm"
            loading={saving}
            onClick={handleSave}
            className="whitespace-nowrap"
          >
            {saving ? 'Enregistrement…' : saveSuccess ? '✓ Enregistré !' : 'Enregistrer'}
            <span className="hidden md:inline"> les changements</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
