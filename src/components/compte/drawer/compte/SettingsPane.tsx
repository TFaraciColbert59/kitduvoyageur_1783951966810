'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accessibility,
  Bell,
  Bluetooth,
  Crown,
  Eye,
  Globe,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  Play,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Watch,
} from 'lucide-react';
import type { NotificationPrefs, ProfileSettings } from '@/features/compte/server/compte';
import {
  listLocaleChoices,
  readSportUnitsPreferences,
  SPORT_NOTIFICATION_DEFINITIONS,
  writeSportUnitsPreferences,
  type ElevationUnit,
  type PaceUnit,
  type SportUnitsPreferences,
  type TemperatureUnit,
  type WeightUnit,
} from '@/features/compte/domain/accountSettings';
import {
  OUTING_VISIBILITIES,
  outingVisibilityLabel,
  type StoredOutingVisibility,
} from '@/features/compte/domain/outingAudience';
import {
  AccessibleDrawer,
  AccessibilityPreferencesPanel,
  LiveRegion,
} from '@/components/accessibility';
import { ActionPill } from '@/components/ui/ActionPill';
import { OffersSubscriptionDrawer } from '@/components/compte/offers/OffersSubscriptionDrawer';
import { useLocale } from '@/lib/i18n/context';
import { DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { createClient } from '@/lib/supabase/client';
import { ConsentSettingsSheet } from './ConsentSettingsSheet';
import { PrivacyZonesSheet } from './PrivacyZonesSheet';
import { ZoneSettingsSheet } from './ZoneSettingsSheet';
import { fetchJson } from './shared';
import { useFeedPreferences } from '@/features/community/g01/useFeedPreferences';
import { FeedPreferencesDrawer } from '@/components/communaute/g01/FeedPreferencesDrawer';
import { SportProfileSummary } from '@/components/communaute/g01/SportProfileSummary';
import type {
  SportProfilePreferencesPatch,
  SportProfileSummaryVM,
} from '@/features/community/g01/sportProfile';

const PREF_LABELS: Array<{ key: 'social' | 'loans' | 'orders' | 'system'; label: string }> = [
  { key: 'social', label: 'Social' },
  { key: 'loans', label: 'Prêts' },
  { key: 'orders', label: 'Commandes' },
  { key: 'system', label: 'Système' },
];

export function SettingsPane() {
  const queryClient = useQueryClient();
  const { locale, setLocale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [sportUnits, setSportUnits] = useState<SportUnitsPreferences>(() =>
    readSportUnitsPreferences(),
  );

  const [consentOpen, setConsentOpen] = useState(false);
  const [unitsDrawerOpen, setUnitsDrawerOpen] = useState(false);
  const [sportNotifDrawerOpen, setSportNotifDrawerOpen] = useState(false);
  const [a11yDrawerOpen, setA11yDrawerOpen] = useState(false);
  const [offersDrawerOpen, setOffersDrawerOpen] = useState(false);

  const unitsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sportNotifTriggerRef = useRef<HTMLButtonElement | null>(null);
  const a11yTriggerRef = useRef<HTMLButtonElement | null>(null);
  const offersTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [feedPrefsOpen, setFeedPrefsOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [sportZonesOpen, setSportZonesOpen] = useState(false);
  const [defaultOutingVis, setDefaultOutingVis] = useState<StoredOutingVisibility>('private');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('lkdv.default_outing_visibility.v1');
      if (saved && (OUTING_VISIBILITIES as readonly string[]).includes(saved)) {
        setDefaultOutingVis(saved as StoredOutingVisibility);
      }
    } catch {
      /* noop */
    }
  }, []);

  const query = useQuery({
    queryKey: ['compte', 'profile'],
    queryFn: () => fetchJson<ProfileSettings>('/api/compte/compte/profile'),
    staleTime: 20_000,
  });

  useEffect(() => {
    const serverVis = query.data?.defaultOutingVisibility;
    if (serverVis && (OUTING_VISIBILITIES as readonly string[]).includes(serverVis)) {
      setDefaultOutingVis(serverVis);
      try {
        window.localStorage.setItem('lkdv.default_outing_visibility.v1', serverVis);
      } catch {
        /* noop */
      }
    }
  }, [query.data?.defaultOutingVisibility]);

  const feedPrefs = useFeedPreferences(query.data?.id);
  const sportProfileQuery = useQuery({
    queryKey: ['compte', 'sport-profile', query.data?.id ?? 'self'],
    queryFn: () => fetchJson<{ summary: SportProfileSummaryVM }>('/api/compte/sport-profile'),
    enabled: Boolean(query.data?.id),
    staleTime: 20_000,
  });

  const patchSportProfile = async (sportPatch: SportProfilePreferencesPatch) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fetchJson<{ summary: SportProfileSummaryVM }>('/api/compte/sport-profile', {
        method: 'PATCH',
        body: JSON.stringify(sportPatch),
      });
      queryClient.setQueryData(['compte', 'sport-profile', query.data?.id ?? 'self'], updated);
      setMessage('Profil sportif enregistré');
      window.setTimeout(() => setMessage(null), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setSportUnits(readSportUnitsPreferences());
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
  const localeChoices = listLocaleChoices();
  const activeLocaleChoice = localeChoices.find((item) => item.code === locale) ?? localeChoices[0];

  const updateUnits = (next: Partial<SportUnitsPreferences>, announceText?: string) => {
    const saved = writeSportUnitsPreferences(next);
    setSportUnits(saved);
    if (announceText) {
      setMessage(announceText);
    }
  };

  const changeUnitsSystem = (next: 'metric' | 'imperial') => {
    const saved = writeSportUnitsPreferences({
      unitSystem: next,
      paceUnit: next === 'imperial' ? 'min_mi' : 'min_km',
      elevationUnit: next === 'imperial' ? 'ft' : 'm',
      temperatureUnit: next === 'imperial' ? 'f' : 'c',
      weightUnit: next === 'imperial' ? 'lb_oz' : 'kg_g',
      firstDayOfWeek: next === 'imperial' ? 'sunday' : 'monday',
    });
    setSportUnits(saved);
    setMessage(next === 'imperial' ? 'Unités impériales activées.' : 'Unités métriques activées.');
  };

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
      <LiveRegion message={message ?? ''} politeness="polite" />
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            paddingTop: 10,
            marginTop: 10,
            borderTop: '0.5px solid rgba(23,43,36,.08)',
          }}
        >
          <div>
            <b style={{ display: 'block', fontSize: 12.5, color: 'var(--label)' }}>
              Position sur la carte des clubs
            </b>
            <small style={{ fontSize: 11.5, color: 'var(--label2)' }}>
              {profile.shareClubLocation
                ? 'Visible par vos abonnés d’un même club'
                : 'Position masquée sur les cartes de club'}
            </small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(profile.shareClubLocation)}
            aria-label="Partager ma position sur la carte des clubs"
            className={`lkdv-compte-switch ${profile.shareClubLocation ? 'on' : ''}`}
            disabled={busy}
            onClick={() => {
              const nextVal = !profile.shareClubLocation;
              if (nextVal && typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    void patch(
                      {
                        shareClubLocation: true,
                        lastLat: pos.coords.latitude,
                        lastLng: pos.coords.longitude,
                      },
                      'Localisation club activée',
                    );
                  },
                  () => {
                    void patch({ shareClubLocation: true }, 'Localisation club activée');
                  },
                  { timeout: 3500 },
                );
              } else {
                void patch(
                  { shareClubLocation: nextVal },
                  nextVal ? 'Localisation club activée' : 'Localisation club désactivée',
                );
              }
            }}
          >
            <i aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="lkdv-compte-setting-card" aria-label="Appareils, connecteurs et consentements">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <SlidersHorizontal size={17} />
          </span>
          <div>
            <b>Fil &amp; lecture vidéo</b>
            <small>
              {feedPrefs.preferences.show_activity ? 'Activités visibles' : 'Activités masquées'} ·{' '}
              {feedPrefs.preferences.video.autoplay ? 'Lecture auto (muet)' : 'Lecture manuelle'}
            </small>
          </div>
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Préférences du fil"
            text="Configurer"
            icon={<SlidersHorizontal />}
            onClick={() => setFeedPrefsOpen(true)}
          />
        </div>
      </section>

      {sportProfileQuery.data?.summary ? (
        <section className="lkdv-compte-setting-card">
          <SportProfileSummary
            summary={sportProfileQuery.data.summary}
            onPreferencesChange={(sportPatch) => void patchSportProfile(sportPatch)}
          />
        </section>
      ) : null}

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <MapPin size={17} />
          </span>
          <div>
            <b>Zones privées & masquage</b>
            <small>Masquer automatiquement le départ/arrivée autour de chez toi</small>
          </div>
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Gérer les zones privées"
            text="Zones"
            icon={<MapPin />}
            onClick={() => setZonesOpen(true)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10, marginTop: 10, borderTop: '0.5px solid rgba(23,43,36,.08)' }}>
          <span style={{ fontSize: 12, color: 'var(--label2)' }}>
            Visibilité par défaut des nouvelles sorties
          </span>
          <select
            aria-label="Visibilité par défaut des nouvelles sorties"
            disabled={busy}
            value={defaultOutingVis}
            onChange={(e) => {
              const next = e.target.value as StoredOutingVisibility;
              setDefaultOutingVis(next);
              try {
                window.localStorage.setItem('lkdv.default_outing_visibility.v1', next);
              } catch {
                /* noop */
              }
              void patch(
                { defaultOutingVisibility: next },
                `Visibilité par défaut : ${outingVisibilityLabel(next)}`
              );
            }}
            style={{
              height: 30,
              borderRadius: 10,
              border: '0.5px solid rgba(23,43,36,.16)',
              background: 'rgba(255,255,255,.85)',
              padding: '0 8px',
              fontSize: 12,
              color: 'var(--label)',
            }}
          >
            {OUTING_VISIBILITIES.map((vis) => (
              <option key={vis} value={vis}>
                {outingVisibilityLabel(vis)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Link2 size={17} />
          </span>
          <div>
            <b>Appareils, services et agrégats</b>
            <small>GPS, Strava, capteurs BLE/Santé, montres, heatmaps, agrégats et RGPD</small>
          </div>
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Gérer les consentements"
            text="RGPD"
            icon={<ShieldCheck />}
            onClick={() => setConsentOpen(true)}
          />
        </div>
        <div className="lkdv-compte-security-actions lkdv-apill-row is-start">
          <a className="lkdv-compte-pref on" href="/compte/connecteurs">
            <Link2 size={13} aria-hidden="true" /> Connecteurs
          </a>
          <a className="lkdv-compte-pref on" href="/compte/sensors">
            <Bluetooth size={13} aria-hidden="true" /> Capteurs &amp; Santé
          </a>
          <a className="lkdv-compte-pref on" href="/compte/montres">
            <Watch size={13} aria-hidden="true" /> Montres
          </a>
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Bell size={17} />
          </span>
          <div>
            <b>Notifications</b>
            <small>
              {notificationsCount} catégorie{notificationsCount > 1 ? 's' : ''} active{notificationsCount > 1 ? 's' : ''}
              {profile.notificationPrefs.quietHours ? ' · Heures calmes actives' : ''}
            </small>
          </div>
          <button
            ref={sportNotifTriggerRef}
            type="button"
            className="lkdv-compte-pref on"
            onClick={() => setSportNotifDrawerOpen(true)}
          >
            Alertes sportives
          </button>
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
            <Ruler size={17} />
          </span>
          <div>
            <b>Langue et unités sportives</b>
            <small>
              {activeLocaleChoice.label} · {sportUnits.unitSystem === 'metric' ? 'Kilomètres et mètres' : 'Miles et pieds'}
            </small>
          </div>
          <button
            ref={unitsTriggerRef}
            type="button"
            className="lkdv-compte-pref on"
            onClick={() => setUnitsDrawerOpen(true)}
          >
            Personnaliser
          </button>
        </div>
        <div className="lkdv-compte-segment" role="group" aria-label="Unités">
          <button
            type="button"
            className={sportUnits.unitSystem === 'metric' ? 'on' : ''}
            onClick={() => changeUnitsSystem('metric')}
          >
            <Ruler size={13} aria-hidden="true" /> Métrique
          </button>
          <button
            type="button"
            className={sportUnits.unitSystem === 'imperial' ? 'on' : ''}
            onClick={() => changeUnitsSystem('imperial')}
          >
            <Monitor size={13} aria-hidden="true" /> Impérial
          </button>
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Accessibility size={17} />
          </span>
          <div>
            <b>Accessibilité et affichage</b>
            <small>Texte agrandi, contraste renforcé, animations réduites, VoiceOver</small>
          </div>
          <button
            ref={a11yTriggerRef}
            type="button"
            className="lkdv-compte-pref on"
            onClick={() => setA11yDrawerOpen(true)}
          >
            Régler
          </button>
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Crown size={17} />
          </span>
          <div>
            <b>Abonnement, régions et avantages</b>
            <small>Région gratuite, Pack Monde, cartes hors ligne, famille et avantages</small>
          </div>
          <button
            ref={offersTriggerRef}
            type="button"
            className="lkdv-compte-pref on"
            onClick={() => setOffersDrawerOpen(true)}
          >
            Gérer
          </button>
        </div>
      </section>

      <section className="lkdv-compte-setting-card">
        <div className="lkdv-compte-setting-head">
          <span className="lkdv-compte-setting-ico" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <div>
            <b>Zones sportives &amp; seuils</b>
            <small>Cardio (FC), puissance (FTP) et allure</small>
          </div>
          <ActionPill
            className="lkdv-compte-setting-pill"
            label="Configurer les zones sportives"
            text="Configurer"
            icon={<Ruler />}
            onClick={() => setSportZonesOpen(true)}
          />
        </div>
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

      {consentOpen ? <ConsentSettingsSheet onClose={() => setConsentOpen(false)} /> : null}

      <AccessibleDrawer
        open={unitsDrawerOpen}
        onClose={() => setUnitsDrawerOpen(false)}
        title="Langue et unités sportives"
        description="Changer une unité modifie uniquement l’affichage ; vos mesures enregistrées restent intactes."
        restoreFocusTo={unitsTriggerRef.current}
      >
        <div className="lkdv-compte-pane">
          <section className="lkdv-compte-setting-card" aria-label="Langue de l’interface">
            <div className="lkdv-compte-setting-head">
              <Globe size={17} aria-hidden="true" />
              <div>
                <b>Langue de l’application</b>
                <small>
                  Les langues non déployées restent verrouillées pour éviter tout mélange FR/EN.
                </small>
              </div>
            </div>
            <div className="lkdv-compte-prefs">
              {localeChoices.map((choice) => (
                <button
                  key={choice.code}
                  type="button"
                  className={`lkdv-compte-pref ${locale === choice.code ? 'on' : ''}`}
                  disabled={!choice.enabled}
                  aria-pressed={locale === choice.code}
                  title={
                    choice.enabled
                      ? `Passer en ${choice.label}`
                      : `${choice.label} en cours de traduction`
                  }
                  onClick={() => {
                    if (choice.enabled) {
                      setLocale(choice.code);
                      setMessage(`Langue réglée sur ${choice.label}.`);
                    }
                  }}
                >
                  {choice.nativeLabel}
                  {!choice.enabled ? ' (bientôt)' : ''}
                </button>
              ))}
            </div>
          </section>

          <section className="lkdv-compte-setting-card" aria-label="Unités d’effort et de matériel">
            <div className="lkdv-compte-setting-head">
              <Ruler size={17} aria-hidden="true" />
              <div>
                <b>Allure et vitesse</b>
                <small>Course, trail et vélo</small>
              </div>
            </div>
            <div className="lkdv-compte-prefs">
              {(
                [
                  { id: 'min_km', label: 'min/km' },
                  { id: 'min_mi', label: 'min/mi' },
                  { id: 'kmh', label: 'km/h' },
                  { id: 'mph', label: 'mph' },
                ] as Array<{ id: PaceUnit; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`lkdv-compte-pref ${sportUnits.paceUnit === option.id ? 'on' : ''}`}
                  aria-pressed={sportUnits.paceUnit === option.id}
                  onClick={() =>
                    updateUnits({ paceUnit: option.id }, `Allure réglée sur ${option.label}.`)
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <div>
                <b>Altitude &amp; dénivelé</b>
              </div>
            </div>
            <div className="lkdv-compte-prefs">
              {(
                [
                  { id: 'm', label: 'Mètres (m)' },
                  { id: 'ft', label: 'Pieds (ft)' },
                ] as Array<{ id: ElevationUnit; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`lkdv-compte-pref ${sportUnits.elevationUnit === option.id ? 'on' : ''}`}
                  aria-pressed={sportUnits.elevationUnit === option.id}
                  onClick={() =>
                    updateUnits(
                      { elevationUnit: option.id },
                      `Altitude réglée sur ${option.label}.`,
                    )
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <div>
                <b>Température &amp; poids du matériel</b>
              </div>
            </div>
            <div className="lkdv-compte-prefs">
              {(
                [
                  { id: 'c', label: '°C' },
                  { id: 'f', label: '°F' },
                ] as Array<{ id: TemperatureUnit; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`lkdv-compte-pref ${sportUnits.temperatureUnit === option.id ? 'on' : ''}`}
                  aria-pressed={sportUnits.temperatureUnit === option.id}
                  onClick={() =>
                    updateUnits(
                      { temperatureUnit: option.id },
                      `Température réglée sur ${option.label}.`,
                    )
                  }
                >
                  {option.label}
                </button>
              ))}
              {(
                [
                  { id: 'kg_g', label: 'kg / g' },
                  { id: 'lb_oz', label: 'lb / oz' },
                ] as Array<{ id: WeightUnit; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`lkdv-compte-pref ${sportUnits.weightUnit === option.id ? 'on' : ''}`}
                  aria-pressed={sportUnits.weightUnit === option.id}
                  onClick={() =>
                    updateUnits(
                      { weightUnit: option.id },
                      `Poids réglé sur ${option.label}.`,
                    )
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </AccessibleDrawer>

      <AccessibleDrawer
        open={sportNotifDrawerOpen}
        onClose={() => setSportNotifDrawerOpen(false)}
        title="Notifications sportives et heures calmes"
        description="Choisissez les alertes de pratique, matériel et plage silencieuse."
        restoreFocusTo={sportNotifTriggerRef.current}
      >
        <div className="lkdv-compte-pane">
          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <div>
                <b>Heures calmes</b>
                <small>
                  Suspend les alertes non critiques entre{' '}
                  {profile.notificationPrefs.quietHoursStart ?? '22:00'} et{' '}
                  {profile.notificationPrefs.quietHoursEnd ?? '07:00'}
                </small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profile.notificationPrefs.quietHours}
                aria-label="Activer ou couper les heures calmes"
                className={`lkdv-compte-switch ${profile.notificationPrefs.quietHours ? 'on' : ''}`}
                disabled={busy}
                onClick={() =>
                  void patch(
                    {
                      notificationPrefs: {
                        quietHours: !profile.notificationPrefs.quietHours,
                      },
                    },
                    profile.notificationPrefs.quietHours
                      ? 'Heures calmes désactivées'
                      : 'Heures calmes activées',
                  )
                }
              >
                <i aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className="lkdv-offers-list" aria-label="Préférences de notifications sportives">
            {SPORT_NOTIFICATION_DEFINITIONS.map((def) => {
              const checked =
                (profile.notificationPrefs[def.key as keyof NotificationPrefs] as
                  | boolean
                  | undefined) ?? (def.key !== 'activityDigest');
              return (
                <li key={def.key} className="lkdv-compte-setting-card">
                  <div className="lkdv-compte-setting-head">
                    <div>
                      <b>{def.label}</b>
                      <small>{def.description}</small>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      aria-label={def.label}
                      className={`lkdv-compte-switch ${checked ? 'on' : ''}`}
                      disabled={busy}
                      onClick={() =>
                        void patch(
                          { notificationPrefs: { [def.key]: !checked } },
                          `${def.label} ${checked ? 'désactivées' : 'activées'}`,
                        )
                      }
                    >
                      <i aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </AccessibleDrawer>

      <AccessibleDrawer
        open={a11yDrawerOpen}
        onClose={() => setA11yDrawerOpen(false)}
        title="Accessibilité et affichage"
        description="Réglages persistants pour texte agrandi, contraste, focus et lecteur d’écran."
        restoreFocusTo={a11yTriggerRef.current}
      >
        <div className="lkdv-compte-pane">
          <AccessibilityPreferencesPanel titleAs="h3" />
          <div className="lkdv-compte-setting-card">
            <a className="lkdv-compte-pref on" href="/accessibilite">
              Ouvrir la page complète d’accessibilité et audit WCAG
            </a>
          </div>
        </div>
      </AccessibleDrawer>

      <OffersSubscriptionDrawer
        open={offersDrawerOpen}
        onClose={() => setOffersDrawerOpen(false)}
        restoreFocusTo={offersTriggerRef.current}
      />
      <FeedPreferencesDrawer
        open={feedPrefsOpen}
        onOpenChange={setFeedPrefsOpen}
        preferences={feedPrefs.preferences}
        onChange={feedPrefs.update}
        onReset={feedPrefs.reset}
      />
      {zonesOpen ? <PrivacyZonesSheet onClose={() => setZonesOpen(false)} /> : null}
      {sportZonesOpen ? <ZoneSettingsSheet onClose={() => setSportZonesOpen(false)} /> : null}
    </div>
  );
}

export default SettingsPane;
