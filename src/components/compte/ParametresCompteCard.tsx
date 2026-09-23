'use client';
import { lkvAlert, lkvConfirm } from '@/components/ui/dialogs';
// src/components/compte/ParametresCompteCard.tsx

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Chip, ListItem, Modal, Switch } from '@/components/ui';
import { UserProfile } from '@/lib/mock/compte-marceline';
import SignatureVisibilityControl from '@/components/identity/SignatureVisibilityControl';
import OrientationCard from '@/components/identity/OrientationCard';

interface ParametresCompteCardProps {
  profile: UserProfile;
  onSave?: (msg: string) => void;
}

export default function ParametresCompteCard({ profile, onSave }: ParametresCompteCardProps) {
  // Hidden file input ref for photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation Section State
  const [activeSection, setActiveSection] = useState<
    'profil' | 'notifications' | 'confidentialite' | 'langue' | 'securite' | 'danger'
  >('profil');

  // Form State – Profil & Identité
  const [firstName, setFirstName] = useState(profile.first_name || '');
  const [lastName, setLastName] = useState((profile.last_name || '').replace('.', ''));
  const [username, setUsername] = useState((profile as any).username ? `@${String((profile as any).username).replace(/^@/, '')}` : '');
  const [pronouns, setPronouns] = useState('');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [primaryActivity, setPrimaryActivity] = useState('Randonnée & Bivouac');
  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatar_url || '/assets/images/no_image.png'
  );

  // Form State – Notifications
  const [notifs, setNotifs] = useState({
    group_messages: true,
    trip_departures: true,
    gear_reminders: true,
    maintenance_alerts: true,
    shop_news: true,
    newsletter: false,
    partner_offers: false,
  });

  // Form State – Confidentialité
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'membres' | 'prive'>('public');
  const [tripsVisibility, setTripsVisibility] = useState<'public' | 'membres' | 'prive'>('membres');
  const [gearVisibility, setGearVisibility] = useState<'public' | 'membres' | 'prive'>('prive');
  const [searchIndexing, setSearchIndexing] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);

  // Form State – Langue & Région
  const [language, setLanguage] = useState<'FR' | 'EN' | 'DE' | 'IT' | 'ES' | 'CA'>('FR');
  const [unitSystem, setUnitSystem] = useState('metric');
  const [currency, setCurrency] = useState('EUR');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('monday');

  // Form State – Sécurité
  const [email, setEmail] = useState((profile as any).email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [passkeysEnabled, setPasskeysEnabled] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Active Sessions State
  const [activeSessions, setActiveSessions] = useState([
    {
      id: 'sess-1',
      device: 'MacBook Pro 16" (macOS)',
      location: 'Grenoble, France',
      lastActive: 'Session actuelle',
      isCurrent: true,
    },
    {
      id: 'sess-2',
      device: 'iPhone 15 Pro (iOS)',
      location: 'Grenoble, France',
      lastActive: 'Il y a 2 heures',
      isCurrent: false,
    },
    {
      id: 'sess-3',
      device: 'iPad Air 5 (iPadOS)',
      location: 'Lyon, France',
      lastActive: 'Il y a 3 jours',
      isCurrent: false,
    },
  ]);

  // Dirty state tracker & modals
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [glassIntensity, setGlassIntensity] = useState(0.5);

  // 1. Load saved settings on initial client render from localStorage
  useEffect(() => {
    try {
      const storedIntensity = localStorage.getItem('lkdv_glass_intensity');
      if (storedIntensity !== null) {
        const parsed = parseFloat(storedIntensity);
        if (!isNaN(parsed)) setGlassIntensity(parsed);
      }
      const savedSettings = localStorage.getItem('user_account_settings_v1');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.lastName) setLastName(parsed.lastName);
        if (parsed.username) setUsername(parsed.username);
        if (parsed.pronouns) setPronouns(parsed.pronouns);
        if (parsed.bio) setBio(parsed.bio);
        if (parsed.location) setLocation(parsed.location);
        if (parsed.primaryActivity) setPrimaryActivity(parsed.primaryActivity);
        if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
        if (parsed.notifs) setNotifs(parsed.notifs);
        if (parsed.profileVisibility) setProfileVisibility(parsed.profileVisibility);
        if (parsed.tripsVisibility) setTripsVisibility(parsed.tripsVisibility);
        if (parsed.gearVisibility) setGearVisibility(parsed.gearVisibility);
        if (parsed.searchIndexing !== undefined) setSearchIndexing(parsed.searchIndexing);
        if (parsed.shareLocation !== undefined) setShareLocation(parsed.shareLocation);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
        if (parsed.currency) setCurrency(parsed.currency);
        if (parsed.timezone) setTimezone(parsed.timezone);
        if (parsed.firstDayOfWeek) setFirstDayOfWeek(parsed.firstDayOfWeek);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.twoFactorAuth !== undefined) setTwoFactorAuth(parsed.twoFactorAuth);
        if (parsed.passkeysEnabled !== undefined) setPasskeysEnabled(parsed.passkeysEnabled);
      }
    } catch {
      // fallback
    }
  }, []);

  const markDirty = () => {
    setIsDirty(true);
    setDirtyCount((prev) => prev + 1);
  };

  // Handle Photo Upload
  const handlePhotoUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      lkvAlert('La taille du fichier ne doit pas dépasser 5 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
        markDirty();
        if (onSave) onSave('Nouvelle photo de profil sélectionnée !');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Password Update
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword) {
      setPasswordError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPasswordSuccess('Mot de passe modifié avec succès !');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    if (onSave) onSave('Mot de passe mis à jour !');
  };

  // Save All Settings to localStorage
  const handleSaveAll = () => {
    setSaving(true);
    const settingsObj = {
      firstName,
      lastName,
      username,
      pronouns,
      bio,
      location,
      primaryActivity,
      avatarUrl,
      notifs,
      profileVisibility,
      tripsVisibility,
      gearVisibility,
      searchIndexing,
      shareLocation,
      language,
      unitSystem,
      currency,
      timezone,
      firstDayOfWeek,
      email,
      twoFactorAuth,
      passkeysEnabled,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem('user_account_settings_v1', JSON.stringify(settingsObj));
    } catch {
      // quota or SSR ignore
    }

    setTimeout(() => {
      setSaving(false);
      setIsDirty(false);
      setDirtyCount(0);
      if (onSave) onSave('Tous vos réglages ont été enregistrés et sauvegardés en base !');
    }, 600);
  };

  const handleGlassIntensityChange = (val: number) => {
    setGlassIntensity(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lkdv_glass_intensity', String(val));
      document.documentElement.style.setProperty('--glass-intensity', String(val));
    }
    if (onSave) onSave(`Intensité Liquid Glass réglée sur ${Math.round(val * 100)}%`);
  };

  const handleExportData = () => {
    const fullData = {
      profile: {
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        location,
        bio,
        avatar_url: avatarUrl,
      },
      preferences: {
        notifications: notifs,
        privacy: { profileVisibility, tripsVisibility, gearVisibility, searchIndexing, shareLocation },
        locale: { language, unitSystem, currency, timezone, firstDayOfWeek },
        security: { twoFactorAuth, passkeysEnabled, activeSessions },
      },
      exportedAt: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kitduvoyageur_reglages_${firstName.toLowerCase()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    if (onSave) onSave('Export complet de vos réglages et données téléchargé !');
  };

  const handleDisconnectSession = (id: string) => {
    setActiveSessions((prev) => prev.filter((s) => s.id !== id));
    if (onSave) onSave('Session déconnectée.');
  };

  const handleDisconnectAllOthers = async () => {
    if (!(await lkvConfirm({ message: 'Se déconnecter de tous les autres appareils ?', variant: 'destructive', confirmLabel: 'Déconnecter' }))) return;
    setActiveSessions((prev) => prev.filter((s) => s.isCurrent));
    if (onSave) onSave('Toutes les autres sessions ont été fermées.');
  };

  const navItems = [
    { id: 'profil', label: 'Profil & identité', icon: 'UserIcon' },
    { id: 'notifications', label: 'Notifications & rappels', icon: 'BellIcon', badge: '2' },
    { id: 'confidentialite', label: 'Confidentialité & visibilité', icon: 'EyeIcon' },
    { id: 'langue', label: 'Langue & région', icon: 'GlobeIcon' },
    { id: 'securite', label: 'Sécurité & sessions', icon: 'LockIcon' },
    { id: 'danger', label: 'Zone de danger', icon: 'ExclamationTriangleIcon', danger: true },
  ];

  return (
    <div className="space-y-8 font-sans text-[color:var(--lkv-primary)]">
      {/* Hidden File Input for Real Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />

      {/* 1. Header Block */}
      <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[color:var(--lkv-primary)] font-display tracking-tight">
            Réglages <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">du compte.</span>
          </h2>
          <p className="text-xs sm:text-sm text-[color:var(--lkv-text-muted)] mt-1 max-w-2xl leading-relaxed">
            Gérez vos informations personnelles, vos préférences de notification, votre sécurité et vos caractéristiques d'aventure.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isDirty && (
            <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] pill-warn animate-pulse text-[11px] font-bold">
              Modifications ({dirtyCount})
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportData}
            icon={<Icon name="ArrowDownTrayIcon" size={14} aria-hidden="true" />}
          >
            Exporter mes données
          </Button>
        </div>
      </div>

      {/* 2. Main Layout (Left Navigation + Right Cards Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-4 bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-4 space-y-3 lg:sticky lg:top-24">
          {/* User mini badge top */}
          <div className="p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[color:var(--lkv-primary)]/20 shrink-0">
              <Image src={avatarUrl || '/assets/images/no_image.png'} alt={firstName} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[color:var(--lkv-primary)] text-xs block truncate">
                {firstName} {lastName}
              </span>
              <span className="text-[11px] text-[color:var(--lkv-text-muted)] font-mono truncate block">{username}</span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <Button
                  key={item.id}
                  variant={item.danger ? 'destructive' : isActive ? 'primary' : 'secondary'}
                  fullWidth
                  onClick={() => setActiveSection(item.id as typeof activeSection)}
                  className="justify-between px-[var(--space-4)] text-[length:var(--lkv-text-footnote)]"
                >
                  <span className="flex items-center gap-[var(--space-3)]">
                    <Icon name={item.icon as any} size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge && <Badge tone="warn" className="text-[10px]">{item.badge}</Badge>}
                </Button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-[color:var(--lkv-primary)]/5 text-center">
            <Button variant="ghost" size="sm" onClick={handleExportData} className="font-mono text-[length:var(--lkv-text-caption)]">
              Export des données (.JSON)
            </Button>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* SECTION 1: PROFIL & IDENTITÉ */}
          {(activeSection === 'profil' || activeSection === 'danger') && (
            <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[color:var(--lkv-primary)] font-display">
                    Profil <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">&amp; identité</span>
                  </h3>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Informations visibles sur votre profil et dans le réseau des voyageurs.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[10px] font-mono">
                  Mis à jour le 5 oct. 2026
                </span>
              </div>

              {/* Ta pratique (orientation) — modifiable depuis /compte (ADR-010, Lot B) */}
              <OrientationCard mode="edit" />

              {/* Photo Upload Block */}
              <div className="flex items-center gap-5 p-4 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)]">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[color:var(--lkv-primary)]/20 shrink-0">
                  <Image src={avatarUrl || '/assets/images/no_image.png'} alt={firstName} fill className="object-cover" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handlePhotoUploadClick}
                    >
                      Changer la photo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setAvatarUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');
                        markDirty();
                      }}
                    >
                      Réinitialiser
                    </Button>
                  </div>
                  <p className="text-[11px] text-[color:var(--lkv-text-muted)] font-mono">JPG, PNG, WEBP ou GIF. Taille max 5 Mo.</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Prénom *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Nom *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Nom d'utilisateur public *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-[color:var(--lkv-text-muted)] font-bold font-mono">@</span>
                    <input
                      type="text"
                      value={username.replace('@', '')}
                      onChange={(e) => {
                        setUsername(`@${e.target.value}`);
                        markDirty();
                      }}
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full pl-8"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Pronoms</label>
                  <select
                    value={pronouns}
                    onChange={(e) => {
                      setPronouns(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="Elle / her">Elle / her</option>
                    <option value="Il / him">Il / him</option>
                    <option value="Iel / they">Iel / they</option>
                    <option value="Non précisé">Non précisé</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Bio / Présentation</label>
                  <textarea
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      markDirty();
                    }}
                    rows={3}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full resize-none font-serif italic"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Ville / Localisation</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Pratiques principales</label>
                  <select
                    value={primaryActivity}
                    onChange={(e) => {
                      setPrimaryActivity(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="Randonnée & Bivouac (GR, alpages)">Randonnée & Bivouac (GR, alpages)</option>
                    <option value="Alpinisme & Hivernal">Alpinisme & Hivernal</option>
                    <option value="Trail Running & Ultra-trail">Trail Running & Ultra-trail</option>
                    <option value="Bikepacking & Cyclotourisme">Bikepacking & Cyclotourisme</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: NOTIFICATIONS & RAPPELS */}
          {(activeSection === 'notifications' || activeSection === 'danger') && (
            <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[color:var(--lkv-primary)] font-display">
                    Notifications <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">&amp; rappels</span>
                  </h3>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Choisissez où et quand être notifié (Application, Email, SMS).
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[10px] font-mono">
                  10 types configurés
                </span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'group_messages',
                    label: 'Nouveaux messages de vos groupes',
                    badge: 'GROUPE',
                    desc: 'Envoyé quand un membre poste un message dans un de vos clubs.',
                  },
                  {
                    key: 'trip_departures',
                    label: 'Inscriptions & départs imminents',
                    badge: 'SORTIES',
                    desc: 'Rappels 24h avant le départ d’une rando ou d’une sortie.',
                  },
                  {
                    key: 'gear_reminders',
                    label: 'Rappels pour préparer votre matériel',
                    badge: 'RAPPELS',
                    desc: 'Recevez la checklist de votre kit avant un bivouac prévu.',
                  },
                  {
                    key: 'maintenance_alerts',
                    label: 'Rappels d’entretien & de révision',
                    badge: 'MATÉRIEL',
                    desc: 'Alertes d’usure sur les chaussures, filtres ou réchauds.',
                  },
                  {
                    key: 'shop_news',
                    label: 'Nouveaux articles dans la boutique',
                    badge: 'BOUTIQUE',
                    desc: 'Promotions et sorties de produits outdoor certifiés.',
                  },
                  {
                    key: 'newsletter',
                    label: 'Newsletter & récits d’aventures',
                    badge: 'COMMUNAUTÉ',
                    desc: 'Le récapitulatif mensuel des plus beaux itinéraires.',
                  },
                  {
                    key: 'partner_offers',
                    label: 'Offres & réductions partenaires',
                    badge: 'OFFRES',
                    desc: 'Réductions exclusives chez nos magasins partenaires.',
                  },
                ].map((item) => {
                  const isChecked = notifs[item.key as keyof typeof notifs];
                  return (
                    <ListItem
                      key={item.key}
                      title={
                        <span className="flex items-center gap-[var(--space-2)]">
                          <span className="truncate">{item.label}</span>
                          <Badge tone="sage" className="text-[9px]">
                            {item.badge}
                          </Badge>
                        </span>
                      }
                      subtitle={item.desc}
                      trailing={
                        <Switch
                          checked={isChecked}
                          onCheckedChange={(next) => {
                            setNotifs((prev) => ({ ...prev, [item.key]: next }));
                            markDirty();
                          }}
                          aria-label={item.label}
                        />
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: CONFIDENTIALITÉ & VISIBILITÉ */}
          {(activeSection === 'confidentialite' || activeSection === 'danger') && (
            <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[color:var(--lkv-primary)] font-display">
                    Confidentialité <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">&amp; visibilité</span>
                  </h3>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Contrôlez la visibilité de votre profil, de vos sorties et de votre matériel.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[10px] font-mono">
                  3 modes d'accès
                </span>
              </div>

              {/* Empreinte terrain — consentement (ADR-010, Lot C.2) */}
              <SignatureVisibilityControl />

              {/* Radio options */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-2">Visibilité du profil</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'membres', 'prive'] as const).map((mode) => (
                      <Chip
                        key={mode}
                        selected={profileVisibility === mode}
                        onClick={() => {
                          setProfileVisibility(mode);
                          markDirty();
                        }}
                        className="w-full capitalize"
                      >
                        {mode === 'public' ? '🌐 Public' : mode === 'membres' ? '👥 Membres' : '🔒 Privé'}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-2">Visibilité de vos sorties &amp; rando</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'membres', 'prive'] as const).map((mode) => (
                      <Chip
                        key={mode}
                        selected={tripsVisibility === mode}
                        onClick={() => {
                          setTripsVisibility(mode);
                          markDirty();
                        }}
                        className="w-full capitalize"
                      >
                        {mode === 'public' ? '🌐 Public' : mode === 'membres' ? '👥 Membres' : '🔒 Privé'}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-2">Visibilité de votre inventaire</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'membres', 'prive'] as const).map((mode) => (
                      <Chip
                        key={mode}
                        selected={gearVisibility === mode}
                        onClick={() => {
                          setGearVisibility(mode);
                          markDirty();
                        }}
                        className="w-full capitalize"
                      >
                        {mode === 'public' ? '🌐 Public' : mode === 'membres' ? '👥 Membres' : '🔒 Privé'}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              {/* Switches */}
              <div className="pt-2 space-y-3">
                <ListItem
                  title="Autoriser l'indexation par les moteurs de recherche"
                  subtitle="Permet à Google de référencer votre profil public."
                  trailing={
                    <Switch
                      checked={searchIndexing}
                      onCheckedChange={(next) => {
                        setSearchIndexing(next);
                        markDirty();
                      }}
                      aria-label="Autoriser l'indexation par les moteurs de recherche"
                    />
                  }
                />

                <ListItem
                  title="Partage de votre position géographique approximative"
                  subtitle="Montre uniquement votre département/ville sur la carte."
                  trailing={
                    <Switch
                      checked={shareLocation}
                      onCheckedChange={(next) => {
                        setShareLocation(next);
                        markDirty();
                      }}
                      aria-label="Partage de votre position géographique approximative"
                    />
                  }
                />
              </div>
            </div>
          )}

          {/* SECTION 4: LANGUE & RÉGION */}
          {(activeSection === 'langue' || activeSection === 'danger') && (
            <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[color:var(--lkv-primary)] font-display">
                    Langue <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">&amp; région</span>
                  </h3>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Paramétrez la langue d'affichage, les unités et la devise.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[10px] font-mono">
                  6 langues disponibles
                </span>
              </div>

              {/* Languages Grid */}
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-3">Langue de l'interface</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { code: 'FR', name: 'Français', sub: 'France, Suisse' },
                    { code: 'EN', name: 'English', sub: 'US & UK' },
                    { code: 'DE', name: 'Deutsch', sub: 'Deutschland' },
                    { code: 'IT', name: 'Italiano', sub: 'Italia' },
                    { code: 'ES', name: 'Español', sub: 'España' },
                    { code: 'CA', name: 'Català', sub: 'Catalunya' },
                  ].map((lang) => (
                    <Chip
                      key={lang.code}
                      selected={language === lang.code}
                      onClick={() => {
                        setLanguage(lang.code as typeof language);
                        markDirty();
                      }}
                      className="h-auto w-full flex-col items-start px-[var(--space-4)] py-[var(--space-3)]"
                    >
                      <span className="block text-[length:var(--lkv-text-body-sm)] font-bold">{lang.code} • {lang.name}</span>
                      <span className="mt-[2px] block text-[length:var(--lkv-text-caption)] opacity-80">{lang.sub}</span>
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Units & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm pt-2">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Système de mesure</label>
                  <select
                    value={unitSystem}
                    onChange={(e) => {
                      setUnitSystem(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="metric">Métrique (m, km, kg, g)</option>
                    <option value="imperial">Impérial (ft, mi, lbs, oz)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Devise</label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="EUR">Euro (€ EUR)</option>
                    <option value="USD">US Dollar ($ USD)</option>
                    <option value="CHF">Franc Suisse (CHF)</option>
                    <option value="GBP">British Pound (£ GBP)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Fuseau horaire</label>
                  <select
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                    <option value="Europe/London">Europe/London (UTC+0)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Premier jour de la semaine</label>
                  <select
                    value={firstDayOfWeek}
                    onChange={(e) => {
                      setFirstDayOfWeek(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  >
                    <option value="monday">Lundi</option>
                    <option value="sunday">Dimanche</option>
                  </select>
                </div>

                {/* Intensité Liquid Glass iOS 27 */}
                <div className="pt-4 border-t border-[color:var(--glass-rim)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--glass-label)] font-bold">
                        Intensité Liquid Glass
                      </label>
                      <p className="text-xs text-[color:var(--glass-label-secondary)] mt-0.5">
                        Densité optique, réfraction et clarté de l'interface en verre.
                      </p>
                    </div>
                    <Badge tone="stone" className="font-mono text-[10px]">
                      {Math.round(glassIntensity * 100)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Subtil (20%)', value: 0.2 },
                      { label: 'Équilibré (50%)', value: 0.5 },
                      { label: 'Profond (85%)', value: 0.85 },
                    ].map((level) => (
                      <Chip
                        key={level.value}
                        selected={Math.abs(glassIntensity - level.value) < 0.15}
                        onClick={() => handleGlassIntensityChange(level.value)}
                        className="w-full text-center"
                      >
                        {level.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: SÉCURITÉ & SESSIONS */}
          {(activeSection === 'securite' || activeSection === 'danger') && (
            <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[color:var(--lkv-primary)]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[color:var(--lkv-primary)] font-display">
                    Sécurité <span className="font-serif italic font-normal text-[color:var(--lkv-forest-600)]">&amp; sessions</span>
                  </h3>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Protégez votre compte, modifiez votre mot de passe et gérez vos connexions actives.
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] pill-info text-[10px] font-mono">
                  Double facteur recommandé
                </span>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Adresse e-mail du compte</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      markDirty();
                    }}
                    className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[color:var(--lkv-text-muted)] font-bold mb-1.5">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] text-[16px] text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)] disabled:cursor-not-allowed disabled:bg-[color:var(--lkv-disabled-bg)] disabled:text-[color:var(--lkv-disabled-text)] sm:text-[length:var(--lkv-text-body-sm)] w-full"
                    />
                  </div>
                </div>

                {passwordError && (
                  <p className="text-xs font-bold text-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger)]/10 p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)]/20">
                    ⚠️ {passwordError}
                  </p>
                )}

                {passwordSuccess && (
                  <p className="text-xs font-bold text-[color:var(--lkv-secondary)] bg-[color:var(--lkv-secondary)]/10 p-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-secondary)]/20">
                    ✓ {passwordSuccess}
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <Button type="submit">Changer le mot de passe</Button>
                </div>
              </form>

              {/* 2FA & Passkey Switches */}
              <div className="space-y-3 pt-2">
                <ListItem
                  title={
                    <span className="flex items-center gap-[var(--space-2)]">
                      <span className="truncate">Authentification à deux facteurs (2FA)</span>
                      <Badge tone="info" className="text-[9px]">
                        RECOMMANDÉ
                      </Badge>
                    </span>
                  }
                  subtitle="Ajoute une couche de sécurité supplémentaire lors de la connexion."
                  trailing={
                    <Switch
                      checked={twoFactorAuth}
                      onCheckedChange={(next) => {
                        setTwoFactorAuth(next);
                        markDirty();
                      }}
                      aria-label="Authentification à deux facteurs (2FA)"
                    />
                  }
                />

                <ListItem
                  title="Clés de sécurité / Passkeys (WebAuthn)"
                  subtitle="Se connecter avec TouchID, FaceID ou votre clé USB YubiKey."
                  trailing={
                    <Switch
                      checked={passkeysEnabled}
                      onCheckedChange={(next) => {
                        setPasskeysEnabled(next);
                        markDirty();
                      }}
                      aria-label="Clés de sécurité / Passkeys (WebAuthn)"
                    />
                  }
                />
              </div>

              {/* Active Sessions List */}
              <div className="pt-4 border-t border-[color:var(--lkv-primary)]/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[color:var(--lkv-primary)] text-xs sm:text-sm">Sessions actives</h4>
                  {activeSessions.length > 1 && (
                    <Button variant="destructive" size="sm" onClick={handleDisconnectAllOthers}>
                      Se déconnecter de tous les autres appareils
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {activeSessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn flex items-center justify-center text-[color:var(--lkv-primary)]">
                          💻
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[color:var(--lkv-primary)]">{sess.device}</span>
                            {sess.isCurrent && (
                              <span className="inline-flex items-center justify-center gap-[6px] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-3)] py-[2px] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-primary)] text-[9px]">
                                CET APPAREIL
                              </span>
                            )}
                          </div>
                          <p className="text-[color:var(--lkv-text-muted)] text-[11px] font-mono">
                            {sess.location} • {sess.lastActive}
                          </p>
                        </div>
                      </div>

                      {!sess.isCurrent && (
                        <Button variant="destructive" size="sm" onClick={() => handleDisconnectSession(sess.id)}>
                          Déconnecter
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: ZONE DE DANGER */}
          <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-md)] p-6 lg:p-8 space-y-6 !border-[color:var(--lkv-danger)]/30">
            <div>
              <h3 className="text-xl font-bold text-[color:var(--lkv-danger)] font-display">
                Zone <span className="font-serif italic font-normal">de danger</span>
              </h3>
              <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                Actions irréversibles ou impactant l'accès à votre compte.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-[color:var(--lkv-primary)] text-xs sm:text-sm">Mettre le compte en pause</h4>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Désactive temporairement votre profil sans tout supprimer. Vos données restent conservées.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setPauseModalOpen(true)}>
                  Mettre en pause
                </Button>
              </div>

              <div className="p-4 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] backdrop-blur-[var(--blur-md)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 !border-[color:var(--lkv-danger)]/30">
                <div>
                  <h4 className="font-bold text-[color:var(--lkv-danger)] text-xs sm:text-sm">Supprimer définitivement le compte</h4>
                  <p className="text-xs text-[color:var(--lkv-text-muted)] mt-0.5">
                    Action définitive : effacement immédiat et irréversible de tous vos kits, aventures et données.
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setDeleteModalOpen(true)}>
                  Supprimer le compte
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sticky Bottom Save Bar */}
      {isDirty && (
        <div className="fixed bottom-[calc(var(--nav-offset)+var(--space-4))] left-1/2 -translate-x-1/2 z-[var(--z-toast)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] px-6 py-4 rounded-full border border-white/20 flex items-center gap-6 animate-slide-up max-w-xl w-[92%] justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[color:var(--lkv-warning)] animate-ping" />
            <span className="text-xs font-bold font-mono">
              {dirtyCount} modification(s) non enregistrée(s)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsDirty(false);
                setDirtyCount(0);
              }}
            >
              Annuler
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSaveAll}>
              {saving ? 'Enregistrement…' : 'Enregistrer tout'}
            </Button>
          </div>
        </div>
      )}

      {/* 4. Pause Account Modal */}
      <Modal
        open={pauseModalOpen}
        onOpenChange={setPauseModalOpen}
        title="Mettre le compte en pause ?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPauseModalOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                setPauseModalOpen(false);
                if (onSave) onSave('Compte mis en pause.');
              }}
            >
              Confirmer la pause
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-normal)] text-[color:var(--lkv-text-muted)]">
          Votre profil sera masqué et vous ne recevrez plus de notifications. Vous pourrez le réactiver à tout moment en vous reconnectant.
        </p>
      </Modal>

      {/* 5. Delete Account Modal */}
      <Modal
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setDeleteConfirmationText('');
        }}
        title="Suppression définitive"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmationText('');
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmationText !== 'SUPPRIMER'}
              onClick={() => {
                setDeleteModalOpen(false);
                if (onSave) onSave('Compte supprimé.');
              }}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-normal)] text-[color:var(--lkv-text-muted)]">
          Cette action est <strong className="text-[color:var(--lkv-danger)]">irréversible</strong>. Pour confirmer la suppression, tapez <strong>SUPPRIMER</strong> ci-dessous :
        </p>
        <input
          type="text"
          value={deleteConfirmationText}
          onChange={(e) => setDeleteConfirmationText(e.target.value)}
          placeholder="SUPPRIMER"
          aria-label="Confirmation de suppression"
          className="mt-[var(--space-3)] min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[10px] font-mono text-[length:var(--lkv-text-body-sm)] font-bold uppercase text-[color:var(--lkv-text-primary)] outline-none transition-colors duration-[var(--motion-control-duration)] placeholder:text-[color:var(--lkv-text-muted)] focus:border-[color:var(--lkv-action)] focus:ring-[3px] focus:ring-[color:var(--lkv-focus-ring)]"
        />
      </Modal>
    </div>
  );
}
