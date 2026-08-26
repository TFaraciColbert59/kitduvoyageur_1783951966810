// src/components/compte/ParametresCompteCard.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { UserProfile } from '@/lib/mock/compte-marceline';

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
  const [firstName, setFirstName] = useState(profile.first_name || 'Marceline');
  const [lastName, setLastName] = useState((profile.last_name || 'Chevrier').replace('.', ''));
  const [username, setUsername] = useState('@marceline.chv');
  const [pronouns, setPronouns] = useState('Elle / her');
  const [bio, setBio] = useState(
    profile.bio ||
      'Passionnée de bivouac estival et randonnée alpine en solo. Matériel léger, autonomie 3-5 jours. Basée à Grenoble.'
  );
  const [location, setLocation] = useState(profile.location || 'Grenoble, Isère');
  const [primaryActivity, setPrimaryActivity] = useState('Randonnée & Bivouac (GR, alpages)');
  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
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
  const [email, setEmail] = useState('marceline.chevrier@example.com');
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

  // 1. Load saved settings on initial client render from localStorage
  useEffect(() => {
    try {
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
      alert('La taille du fichier ne doit pas dépasser 5 Mo.');
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

  const handleDisconnectAllOthers = () => {
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
    <div className="space-y-8 font-sans text-[#17402C]">
      {/* Hidden File Input for Real Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />

      {/* 1. Header Block */}
      <div className="glass rounded-[1.25rem] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#17402C] font-display tracking-tight">
            Réglages <span className="font-serif italic font-normal text-[#365233]">du compte.</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#5A7064] mt-1 max-w-2xl leading-relaxed">
            Gérez vos informations personnelles, vos préférences de notification, votre sécurité et vos caractéristiques d'aventure.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isDirty && (
            <span className="glass-pill pill-warn animate-pulse text-[11px] font-bold">
              Modifications ({dirtyCount})
            </span>
          )}
          <button
            onClick={handleExportData}
            className="glass-capsule-btn text-xs font-bold"
          >
            <Icon name="ArrowDownTrayIcon" size={14} />
            <span>Exporter mes données</span>
          </button>
        </div>
      </div>

      {/* 2. Main Layout (Left Navigation + Right Cards Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-4 glass rounded-[1.25rem] p-4 space-y-3 lg:sticky lg:top-24">
          {/* User mini badge top */}
          <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[#17402C]/20 shrink-0">
              <Image src={avatarUrl} alt={firstName} fill className="object-cover" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[#17402C] text-xs block truncate">
                {firstName} {lastName}
              </span>
              <span className="text-[11px] text-[#5A7064] font-mono truncate block">{username}</span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as typeof activeSection)}
                  className={`w-full p-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-[#17402C] text-white shadow-md'
                      : item.danger
                      ? 'text-[#A8443A] hover:bg-[#A8443A]/10'
                      : 'text-[#17402C] hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-[#A6C1A0]' : 'text-[#5A7064]'}>
                      <Icon name={item.icon as any} size={16} />
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'glass-pill pill-warn'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-[#17402C]/5 text-center">
            <button
              onClick={handleExportData}
              className="text-xs font-mono font-bold text-[#5B7F55] hover:underline"
            >
              Export des données (.JSON)
            </button>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* SECTION 1: PROFIL & IDENTITÉ */}
          {(activeSection === 'profil' || activeSection === 'danger') && (
            <div className="glass rounded-[1.25rem] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#17402C]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#17402C] font-display">
                    Profil <span className="font-serif italic font-normal text-[#365233]">&amp; identité</span>
                  </h3>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Informations visibles sur votre profil et dans le réseau des voyageurs.
                  </p>
                </div>
                <span className="glass-pill text-[10px] font-mono">
                  Mis à jour le 5 oct. 2026
                </span>
              </div>

              {/* Photo Upload Block */}
              <div className="flex items-center gap-5 p-4 rounded-2xl glass-sub-card">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#17402C]/20 shrink-0">
                  <Image src={avatarUrl} alt={firstName} fill className="object-cover" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePhotoUploadClick}
                      className="glass-capsule-btn primary text-xs font-bold"
                    >
                      Changer la photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');
                        markDirty();
                      }}
                      className="text-xs font-semibold text-[#A8443A] hover:underline"
                    >
                      Réinitialiser
                    </button>
                  </div>
                  <p className="text-[11px] text-[#5A7064] font-mono">JPG, PNG, WEBP ou GIF. Taille max 5 Mo.</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Prénom *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Nom *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Nom d'utilisateur public *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-[#5A7064] font-bold font-mono">@</span>
                    <input
                      type="text"
                      value={username.replace('@', '')}
                      onChange={(e) => {
                        setUsername(`@${e.target.value}`);
                        markDirty();
                      }}
                      className="glass-input w-full pl-8"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Pronoms</label>
                  <select
                    value={pronouns}
                    onChange={(e) => {
                      setPronouns(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  >
                    <option value="Elle / her">Elle / her</option>
                    <option value="Il / him">Il / him</option>
                    <option value="Iel / they">Iel / they</option>
                    <option value="Non précisé">Non précisé</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Bio / Présentation</label>
                  <textarea
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      markDirty();
                    }}
                    rows={3}
                    className="glass-input w-full resize-none font-serif italic"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Ville / Localisation</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Pratiques principales</label>
                  <select
                    value={primaryActivity}
                    onChange={(e) => {
                      setPrimaryActivity(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
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
            <div className="glass rounded-[1.25rem] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#17402C]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#17402C] font-display">
                    Notifications <span className="font-serif italic font-normal text-[#365233]">&amp; rappels</span>
                  </h3>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Choisissez où et quand être notifié (Application, Email, SMS).
                  </p>
                </div>
                <span className="glass-pill text-[10px] font-mono">
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
                    <div
                      key={item.key}
                      className="p-4 rounded-2xl glass-sub-card flex items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#17402C] text-xs sm:text-sm truncate">
                            {item.label}
                          </span>
                          <span className="text-[9px] font-mono font-bold bg-[#17402C]/10 text-[#17402C] px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[#5A7064] truncate">{item.desc}</p>
                      </div>

                      {/* Switch */}
                      <button
                        onClick={() => {
                          setNotifs((prev) => ({ ...prev, [item.key]: !isChecked }));
                          markDirty();
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isChecked ? 'bg-[#17402C]' : 'bg-[#17402C]/15'
                        }`}
                        role="switch"
                        aria-checked={isChecked}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: CONFIDENTIALITÉ & VISIBILITÉ */}
          {(activeSection === 'confidentialite' || activeSection === 'danger') && (
            <div className="glass rounded-[1.25rem] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#17402C]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#17402C] font-display">
                    Confidentialité <span className="font-serif italic font-normal text-[#365233]">&amp; visibilité</span>
                  </h3>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Contrôlez la visibilité de votre profil, de vos sorties et de votre matériel.
                  </p>
                </div>
                <span className="glass-pill text-[10px] font-mono">
                  3 modes d'accès
                </span>
              </div>

              {/* Radio options */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-2">Visibilité du profil</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'membres', 'prive'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setProfileVisibility(mode);
                          markDirty();
                        }}
                        className={`p-3 rounded-2xl border text-center font-bold capitalize transition-all ${
                          profileVisibility === mode
                            ? 'bg-[#17402C] text-white border-[#17402C] shadow-md'
                            : 'glass-sub-card text-[#5A7064] hover:text-[#17402C]'
                        }`}
                      >
                        {mode === 'public' ? '🌐 Public' : mode === 'membres' ? '👥 Membres' : '🔒 Privé'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-2">Visibilité de vos sorties &amp; rando</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'membres', 'prive'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setTripsVisibility(mode);
                          markDirty();
                        }}
                        className={`p-3 rounded-2xl border text-center font-bold capitalize transition-all ${
                          tripsVisibility === mode
                            ? 'bg-[#17402C] text-white border-[#17402C] shadow-md'
                            : 'glass-sub-card text-[#5A7064] hover:text-[#17402C]'
                        }`}
                      >
                        {mode === 'public' ? '🌐 Public' : mode === 'membres' ? '👥 Membres' : '🔒 Privé'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-2">Visibilité de votre inventaire</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'membres', 'prive'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setGearVisibility(mode);
                          markDirty();
                        }}
                        className={`p-3 rounded-2xl border text-center font-bold capitalize transition-all ${
                          gearVisibility === mode
                            ? 'bg-[#17402C] text-white border-[#17402C] shadow-md'
                            : 'glass-sub-card text-[#5A7064] hover:text-[#17402C]'
                        }`}
                      >
                        {mode === 'public' ? '🌐 Public' : mode === 'membres' ? '👥 Membres' : '🔒 Privé'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Switches */}
              <div className="pt-2 space-y-3">
                <div className="p-4 rounded-2xl glass-sub-card flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-[#17402C] text-xs sm:text-sm block">
                      Autoriser l'indexation par les moteurs de recherche
                    </span>
                    <p className="text-xs text-[#5A7064]">Permet à Google de référencer votre profil public.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSearchIndexing(!searchIndexing);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      searchIndexing ? 'bg-[#17402C]' : 'bg-[#17402C]/15'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        searchIndexing ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 rounded-2xl glass-sub-card flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-[#17402C] text-xs sm:text-sm block">
                      Partage de votre position géographique approximative
                    </span>
                    <p className="text-xs text-[#5A7064]">Montre uniquement votre département/ville sur la carte.</p>
                  </div>
                  <button
                    onClick={() => {
                      setShareLocation(!shareLocation);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      shareLocation ? 'bg-[#17402C]' : 'bg-[#17402C]/15'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        shareLocation ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: LANGUE & RÉGION */}
          {(activeSection === 'langue' || activeSection === 'danger') && (
            <div className="glass rounded-[1.25rem] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#17402C]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#17402C] font-display">
                    Langue <span className="font-serif italic font-normal text-[#365233]">&amp; région</span>
                  </h3>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Paramétrez la langue d'affichage, les unités et la devise.
                  </p>
                </div>
                <span className="glass-pill text-[10px] font-mono">
                  6 langues disponibles
                </span>
              </div>

              {/* Languages Grid */}
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-3">Langue de l'interface</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { code: 'FR', name: 'Français', sub: 'France, Suisse' },
                    { code: 'EN', name: 'English', sub: 'US & UK' },
                    { code: 'DE', name: 'Deutsch', sub: 'Deutschland' },
                    { code: 'IT', name: 'Italiano', sub: 'Italia' },
                    { code: 'ES', name: 'Español', sub: 'España' },
                    { code: 'CA', name: 'Català', sub: 'Catalunya' },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.code as typeof language);
                        markDirty();
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        language === lang.code
                          ? 'bg-[#17402C] border-[#17402C] text-white shadow-md'
                          : 'glass-sub-card text-[#5A7064] hover:text-[#17402C]'
                      }`}
                    >
                      <span className="font-bold text-sm block">{lang.code} • {lang.name}</span>
                      <span className={`text-[11px] block mt-0.5 ${language === lang.code ? 'text-[#A6C1A0]' : 'text-[#5A7064]'}`}>{lang.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Units & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm pt-2">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Système de mesure</label>
                  <select
                    value={unitSystem}
                    onChange={(e) => {
                      setUnitSystem(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  >
                    <option value="metric">Métrique (m, km, kg, g)</option>
                    <option value="imperial">Impérial (ft, mi, lbs, oz)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Devise</label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  >
                    <option value="EUR">Euro (€ EUR)</option>
                    <option value="USD">US Dollar ($ USD)</option>
                    <option value="CHF">Franc Suisse (CHF)</option>
                    <option value="GBP">British Pound (£ GBP)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Fuseau horaire</label>
                  <select
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  >
                    <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                    <option value="Europe/London">Europe/London (UTC+0)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Premier jour de la semaine</label>
                  <select
                    value={firstDayOfWeek}
                    onChange={(e) => {
                      setFirstDayOfWeek(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  >
                    <option value="monday">Lundi</option>
                    <option value="sunday">Dimanche</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: SÉCURITÉ & SESSIONS */}
          {(activeSection === 'securite' || activeSection === 'danger') && (
            <div className="glass rounded-[1.25rem] p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#17402C]/5 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#17402C] font-display">
                    Sécurité <span className="font-serif italic font-normal text-[#365233]">&amp; sessions</span>
                  </h3>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Protégez votre compte, modifiez votre mot de passe et gérez vos connexions actives.
                  </p>
                </div>
                <span className="glass-pill pill-info text-[10px] font-mono">
                  Double facteur recommandé
                </span>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Adresse e-mail du compte</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      markDirty();
                    }}
                    className="glass-input w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="glass-input w-full"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#5A7064] font-bold mb-1.5">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="glass-input w-full"
                    />
                  </div>
                </div>

                {passwordError && (
                  <p className="text-xs font-bold text-[#A8443A] bg-[#A8443A]/10 p-3 rounded-xl border border-[#A8443A]/20">
                    ⚠️ {passwordError}
                  </p>
                )}

                {passwordSuccess && (
                  <p className="text-xs font-bold text-[#5B7F55] bg-[#5B7F55]/10 p-3 rounded-xl border border-[#5B7F55]/20">
                    ✓ {passwordSuccess}
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="glass-capsule-btn primary text-xs font-bold"
                  >
                    Changer le mot de passe
                  </button>
                </div>
              </form>

              {/* 2FA & Passkey Switches */}
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl glass-sub-card flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17402C] text-xs sm:text-sm">
                        Authentification à deux facteurs (2FA)
                      </span>
                      <span className="glass-pill pill-info text-[9px]">
                        RECOMMANDÉ
                      </span>
                    </div>
                    <p className="text-xs text-[#5A7064]">Ajoute une couche de sécurité supplémentaire lors de la connexion.</p>
                  </div>
                  <button
                    onClick={() => {
                      setTwoFactorAuth(!twoFactorAuth);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      twoFactorAuth ? 'bg-[#17402C]' : 'bg-[#17402C]/15'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        twoFactorAuth ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 rounded-2xl glass-sub-card flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-[#17402C] text-xs sm:text-sm block">
                      Clés de sécurité / Passkeys (WebAuthn)
                    </span>
                    <p className="text-xs text-[#5A7064]">Se connecter avec TouchID, FaceID ou votre clé USB YubiKey.</p>
                  </div>
                  <button
                    onClick={() => {
                      setPasskeysEnabled(!passkeysEnabled);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      passkeysEnabled ? 'bg-[#17402C]' : 'bg-[#17402C]/15'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        passkeysEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Active Sessions List */}
              <div className="pt-4 border-t border-[#17402C]/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[#17402C] text-xs sm:text-sm">Sessions actives</h4>
                  {activeSessions.length > 1 && (
                    <button
                      onClick={handleDisconnectAllOthers}
                      className="text-xs font-semibold text-[#A8443A] hover:underline"
                    >
                      Se déconnecter de tous les autres appareils
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {activeSessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-2xl glass-sub-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#17402C]/10 flex items-center justify-center text-[#17402C]">
                          💻
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#17402C]">{sess.device}</span>
                            {sess.isCurrent && (
                              <span className="glass-pill text-[9px]">
                                CET APPAREIL
                              </span>
                            )}
                          </div>
                          <p className="text-[#5A7064] text-[11px] font-mono">
                            {sess.location} • {sess.lastActive}
                          </p>
                        </div>
                      </div>

                      {!sess.isCurrent && (
                        <button
                          onClick={() => handleDisconnectSession(sess.id)}
                          className="px-3 py-1.5 text-xs font-bold text-[#A8443A] bg-[#A8443A]/10 hover:bg-[#A8443A]/20 rounded-xl transition-colors"
                        >
                          Déconnecter
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: ZONE DE DANGER */}
          <div className="glass rounded-[1.25rem] p-6 lg:p-8 space-y-6 !border-[#A8443A]/30">
            <div>
              <h3 className="text-xl font-bold text-[#A8443A] font-display">
                Zone <span className="font-serif italic font-normal">de danger</span>
              </h3>
              <p className="text-xs text-[#5A7064] mt-0.5">
                Actions irréversibles ou impactant l'accès à votre compte.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl glass-sub-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-[#17402C] text-xs sm:text-sm">Mettre le compte en pause</h4>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Désactive temporairement votre profil sans tout supprimer. Vos données restent conservées.
                  </p>
                </div>
                <button
                  onClick={() => setPauseModalOpen(true)}
                  className="glass-capsule-btn text-xs font-bold whitespace-nowrap"
                >
                  Mettre en pause
                </button>
              </div>

              <div className="p-4 rounded-2xl glass-sub-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 !border-[#A8443A]/30">
                <div>
                  <h4 className="font-bold text-[#A8443A] text-xs sm:text-sm">Supprimer définitivement le compte</h4>
                  <p className="text-xs text-[#5A7064] mt-0.5">
                    Action définitive : effacement immédiat et irréversible de tous vos kits, aventures et données.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="glass-capsule-btn danger text-xs font-bold whitespace-nowrap"
                >
                  Supprimer le compte
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sticky Bottom Save Bar */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[250] bg-[#17402C] text-white px-6 py-4 rounded-full border border-white/20 flex items-center gap-6 animate-slide-up max-w-xl w-[92%] justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#C89A3B] animate-ping" />
            <span className="text-xs font-bold font-mono">
              {dirtyCount} modification(s) non enregistrée(s)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsDirty(false);
                setDirtyCount(0);
              }}
              className="text-xs font-semibold text-white/70 hover:underline"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="glass-capsule-btn primary text-xs font-bold !bg-white !text-[#17402C]"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer tout'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Pause Account Modal */}
      {pauseModalOpen && (
        <div className="glass-modal-overlay">
          <div className="glass-modal max-w-md w-full p-7 space-y-4">
            <h3 className="font-bold text-[#17402C] text-xl font-display">Mettre le compte en pause ?</h3>
            <p className="text-xs text-[#5A7064] leading-relaxed">
              Votre profil sera masqué et vous ne recevrez plus de notifications. Vous pourrez le réactiver à tout moment en vous reconnectant.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPauseModalOpen(false)}
                className="glass-capsule-btn text-xs font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setPauseModalOpen(false);
                  if (onSave) onSave('Compte mis en pause.');
                }}
                className="glass-capsule-btn primary text-xs font-bold"
              >
                Confirmer la pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Account Modal */}
      {deleteModalOpen && (
        <div className="glass-modal-overlay">
          <div className="glass-modal max-w-md w-full p-7 space-y-4">
            <h3 className="font-bold text-[#A8443A] text-xl font-display">Suppression définitive</h3>
            <p className="text-xs text-[#5A7064] leading-relaxed">
              Cette action est <strong className="text-[#A8443A]">irréversible</strong>. Pour confirmer la suppression, tapez <strong>SUPPRIMER</strong> ci-dessous :
            </p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="SUPPRIMER"
              className="glass-input w-full font-mono font-bold text-xs uppercase"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmationText('');
                }}
                className="glass-capsule-btn text-xs font-bold"
              >
                Annuler
              </button>
              <button
                disabled={deleteConfirmationText !== 'SUPPRIMER'}
                onClick={() => {
                  setDeleteModalOpen(false);
                  if (onSave) onSave('Compte supprimé.');
                }}
                className="glass-capsule-btn danger text-xs font-bold disabled:opacity-40"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
