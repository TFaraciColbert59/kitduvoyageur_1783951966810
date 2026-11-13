'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  Eye,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Play,
  Ruler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { NotificationPrefs, ProfileSettings } from '@/features/compte/server/compte';
import { ActionPill } from '@/components/ui/ActionPill';
import { DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from '@/lib/i18n/context';
import type { UnitSystem } from '@/lib/i18n/region';
import { readUnitSystem, subscribeUnitSystem } from '@/lib/i18n/unitSetting';
import { fetchJson } from './shared';
import { LanguageUnitsSheet, LOCALE_LABELS } from './LanguageUnitsSheet';
import { NotificationPreferencesSheet } from './NotificationPreferencesSheet';

const PREF_LABELS: Array<{ key: keyof NotificationPrefs; label: string }> = [
  { key: 'social', label: 'Social' },
  { key: 'loans', label: 'Prêts' },
  { key: 'orders', label: 'Commandes' },
  { key: 'system', label: 'Système' },
];

export function SettingsPane() {
  const queryClient = useQueryClient();
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [units, setUnits] = useState<UnitSystem | null>(null);
  const [openSheet, setOpenSheet] = useState<'notifications' | 'language' | null>(null);

  const query = useQuery({
    queryKey: ['compte', 'profile'],
    queryFn: () => fetchJson<ProfileSettings>('/api/compte/compte/profile'),
    staleTime: 20_000,
  });

  useEffect(() => {
    const sync = () => setUnits(readUnitSystem());
    sync();
    return subscribeUnitSystem(sync);
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
  const unitsSummary =
    units === null
      ? 'Automatiques selon la région'
      : units === 'metric'
        ? 'Kilomètres, mètres et kilos'
        : 'Miles, pieds et livres';


  const sendPasswordReset = async () => {
    setSecurityBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/connexion`,
      });
      if (error) throw error;
      setMessage('Email de réinitialisation envoyé.');
    } catch {
      setMessage('Impossible d’envoyer l’email pour le moment.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const signOutOthers = async () => {
    if (!confirmSignOut) {
      setConfirmSignOut(true);
      window.setTimeout(() => setConfirmSignOut(false), 3200);
      return;
    }
    setSecurityBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      setMessage('Les autres appareils ont été déconnectés.');
      setConfirmSignOut(false);
    } catch {
      setMessage('Impossible de déconnecter les autres appareils.');
    } finally {
      setSecurityBusy(false);
    }
  };

  return (
    <div className="lkdv-compte-pane">
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
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Gérer les catégories et canaux de notification"
            text="Gérer"
            icon={<ChevronRight />}
            onClick={() => setOpenSheet('notifications')}
            disabled={busy}
          />
        </div>
        <p className="lkdv-compte-note">
          Catégories, puis canaux par type (application, email, push). Les types sans
          producteur réel ne sont pas affichés.
        </p>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Languages size={17} />
          </span>
          <div>
            <b>Langue et unités</b>
            <small>{LOCALE_LABELS[locale]} · {unitsSummary}</small>
          </div>
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Modifier la langue et les unités"
            text="Modifier"
            icon={<Ruler />}
            onClick={() => setOpenSheet('language')}
            disabled={busy}
          />
        </div>
        <p className="lkdv-compte-note">
          Distance, allure, altitude et poids. Les valeurs stockées restent métriques : seul
          l’affichage change.
        </p>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <div>
            <b>Parcours de découverte</b>
            <small>Les bases de LKDV, à ton rythme</small>
          </div>
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Reprendre le parcours"
            icon={<Play />}
            onClick={() => window.dispatchEvent(new Event('lkdv:onboarding-open'))}
          />
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
        <div className="lkdv-compte-security-actions lkdv-apill-row is-start">
          <ActionPill
            label="Changer mon mot de passe"
            text="Mot de passe"
            icon={<KeyRound />}
            onClick={() => void sendPasswordReset()}
            disabled={securityBusy}
          />
          <ActionPill
            tone={confirmSignOut ? 'danger' : 'glass'}
            label={confirmSignOut ? 'Confirmer la déconnexion' : 'Déconnecter mes autres appareils'}
            text={confirmSignOut ? 'Confirmer' : 'Autres appareils'}
            icon={<LogOut />}
            onClick={() => void signOutOthers()}
            disabled={securityBusy}
          />
        </div>
      </section>

      {openSheet === 'notifications' ? (
        <NotificationPreferencesSheet onClose={() => setOpenSheet(null)} />
      ) : null}
      {openSheet === 'language' ? (
        <LanguageUnitsSheet onClose={() => setOpenSheet(null)} />
      ) : null}
    </div>
  );
}

export default SettingsPane;
