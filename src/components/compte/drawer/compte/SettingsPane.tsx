'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  Eye,
  Lock,
  Monitor,
  Moon,
  Ruler,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import type { NotificationPrefs, ProfileSettings } from '@/features/compte/server/compte';
import { DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { fetchJson } from './shared';

const PREF_LABELS: Array<{ key: keyof NotificationPrefs; label: string }> = [
  { key: 'social', label: 'Social' },
  { key: 'loans', label: 'Prêts' },
  { key: 'orders', label: 'Commandes' },
  { key: 'system', label: 'Système' },
];

export function SettingsPane() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  const query = useQuery({
    queryKey: ['compte', 'profile'],
    queryFn: () => fetchJson<ProfileSettings>('/api/compte/compte/profile'),
    staleTime: 20_000,
  });

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    try {
      setUnits(localStorage.getItem('lkdv_units') === 'imperial' ? 'imperial' : 'metric');
    } catch {
      setUnits('metric');
    }
  }, []);

  const patch = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fetchJson<ProfileSettings>('/api/compte/compte/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      queryClient.setQueryData(['compte', 'profile'], updated);
      setMessage(success);
      window.setTimeout(() => setMessage(null), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) return <DrawerSkeleton />;
  if (query.isError || !query.data) return <DrawerError onRetry={() => void query.refetch()} />;

  const profile = query.data;
  const notificationsCount = PREF_LABELS.filter((item) => profile.notificationPrefs[item.key]).length;

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem('lkdv_theme', next ? 'dark' : 'light');
    } catch {
      /* stockage indisponible : le thème reste appliqué pour la session */
    }
    const root = document.documentElement;
    root.classList.toggle('dark', next);
    root.setAttribute('data-theme', next ? 'dark' : 'light');
    root.style.colorScheme = next ? 'dark' : 'light';
  };

  const changeUnits = (next: 'metric' | 'imperial') => {
    setUnits(next);
    try {
      localStorage.setItem('lkdv_units', next);
    } catch {
      /* ignore */
    }
  };

  const openFullSettings = () => {
    const runtime = window as unknown as { __lkdvCompteAct?: (action: string) => void };
    runtime.__lkdvCompteAct?.('openSettings');
  };

  return (
    <div className="lkdv-compte-pane">
      <div className="lkdv-compte-settings-head">
        <div>
          <b>Réglages rapides</b>
          <span>Ce que tu changes ici est enregistré immédiatement.</span>
        </div>
        <button type="button" className="lkdv-compte-link" onClick={openFullSettings}>
          Tous les réglages <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>

      {message ? <p className="lkdv-compte-inline-status" role="status">{message}</p> : null}

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Eye size={17} />
          </span>
          <div>
            <b>Confidentialité</b>
            <small>{profile.visibility === 'public' ? 'Profil public' : 'Profil privé, sur invitation'}</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.visibility === 'public'}
            aria-label={profile.visibility === 'public' ? 'Passer le profil en privé' : 'Passer le profil en public'}
            className={`lkdv-compte-switch ${profile.visibility === 'public' ? 'on' : ''}`}
            disabled={busy}
            onClick={() =>
              void patch(
                { visibility: profile.visibility === 'public' ? 'prive' : 'public' },
                'Visibilité mise à jour'
              )
            }
          >
            <i aria-hidden="true" />
          </button>
        </div>
        <p>
          {profile.visibility === 'public'
            ? 'Ton profil, tes sorties publiques et ta cordée sont visibles par tous.'
            : 'Seules les personnes que tu acceptes voient ton profil et tes sorties.'}
        </p>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Bell size={17} />
          </span>
          <div>
            <b>Notifications</b>
            <small>{notificationsCount} catégorie{notificationsCount > 1 ? 's' : ''} active{notificationsCount > 1 ? 's' : ''}</small>
          </div>
        </div>
        <div className="lkdv-compte-prefs">
          {PREF_LABELS.map((item) => {
            const checked = profile.notificationPrefs[item.key];
            return (
              <button
                key={item.key}
                type="button"
                className={`lkdv-compte-pref ${checked ? 'on' : ''}`}
                aria-pressed={checked}
                disabled={busy}
                onClick={() =>
                  void patch(
                    { notificationPrefs: { [item.key]: !checked } },
                    `Notifications ${item.label.toLowerCase()} ${checked ? 'désactivées' : 'activées'}`
                  )
                }
              >
                <i aria-hidden="true" /> {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            {dark ? <Moon size={17} /> : <Sun size={17} />}
          </span>
          <div>
            <b>Apparence & unités</b>
            <small>{dark ? 'Thème sombre' : 'Thème clair'} · {units === 'metric' ? 'km / m' : 'mi / ft'}</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label="Thème sombre"
            className={`lkdv-compte-switch ${dark ? 'on' : ''}`}
            onClick={toggleTheme}
          >
            <i aria-hidden="true" />
          </button>
        </div>
        <div className="lkdv-compte-segment" role="group" aria-label="Unités">
          <button type="button" className={units === 'metric' ? 'on' : ''} onClick={() => changeUnits('metric')}>
            <Ruler size={13} aria-hidden="true" /> Métrique
          </button>
          <button type="button" className={units === 'imperial' ? 'on' : ''} onClick={() => changeUnits('imperial')}>
            <Monitor size={13} aria-hidden="true" /> Impérial
          </button>
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Lock size={17} />
          </span>
          <div>
            <b>Sécurité</b>
            <small>{profile.twoFaEnabled ? 'Double authentification active' : 'Double authentification inactive'}</small>
          </div>
          <span className={`lkdv-compte-security-badge ${profile.twoFaEnabled ? 'on' : ''}`}>
            <ShieldCheck size={13} aria-hidden="true" /> {profile.twoFaEnabled ? 'Protégé' : 'À activer'}
          </span>
        </div>
        <p>Mot de passe, appareils connectés et double authentification se gèrent dans les réglages complets.</p>
        <button type="button" className="lkdv-compte-btn ghost" onClick={openFullSettings}>
          <ShieldCheck size={14} aria-hidden="true" /> Gérer la sécurité
        </button>
      </section>
    </div>
  );
}

export default SettingsPane;
