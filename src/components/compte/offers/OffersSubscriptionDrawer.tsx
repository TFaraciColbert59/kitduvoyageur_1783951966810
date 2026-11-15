'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Crown,
  Gift,
  Globe,
  Headphones,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Users,
} from 'lucide-react';
import { AccessibleDrawer, LiveRegion } from '@/components/accessibility';
import type { OffersOverviewPayload } from '@/features/offers/server/offersStore';
import type { RightStatus } from '@/features/offers';

export interface OffersSubscriptionDrawerProps {
  open: boolean;
  onClose: () => void;
  restoreFocusTo?: HTMLElement | null;
}

type OffersTab = 'plans' | 'regions' | 'family' | 'perks';

const RIGHT_STATUS_LABELS: Record<RightStatus, string> = {
  active: 'Actif',
  expired: 'Expiré',
  revoked: 'Révoqué',
  unconfigured: 'Non activé',
  ineligible: 'Non inclus',
};

export function OffersSubscriptionDrawer({
  open,
  onClose,
  restoreFocusTo,
}: OffersSubscriptionDrawerProps) {
  const [tab, setTab] = useState<OffersTab>('plans');
  const [data, setData] = useState<OffersOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [familyEmail, setFamilyEmail] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isIos =
        typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
      const res = await fetch(`/api/compte/offers${isIos ? '?platform=ios' : ''}`, {
        credentials: 'same-origin',
      });
      const json = (await res.json().catch(() => null)) as
        | (OffersOverviewPayload & { error?: string })
        | null;
      if (!res.ok || !json) {
        throw new Error(json?.error || 'Impossible de charger les offres.');
      }
      setData(json);
      setAnnouncement(
        `Offres chargées : formule ${json.mapUpdates.planLabel}, droit ${RIGHT_STATUS_LABELS[json.mapUpdates.premiumRight.status]}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les offres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const runAction = async (
    payload: Record<string, unknown>,
    successAnnouncement: string,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/compte/offers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | (OffersOverviewPayload & { error?: string; message?: string })
        | null;
      if (!res.ok || !json) {
        throw new Error(json?.message || json?.error || 'Action impossible.');
      }
      setData(json);
      setAnnouncement(successAnnouncement);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action impossible.';
      setError(msg);
      setAnnouncement(msg);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccessibleDrawer
      open={open}
      onClose={onClose}
      title="Abonnement, régions et avantages"
      description="Droits d’accès géographiques, mises à jour de cartes, formules et avantages."
      restoreFocusTo={restoreFocusTo}
    >
      <LiveRegion message={announcement} politeness="polite" />

      <div className="lkdv-offers-tabs" role="tablist" aria-label="Sections offres et droits">
        {(
          [
            { id: 'plans', label: 'Formules' },
            { id: 'regions', label: 'Régions & Cartes' },
            { id: 'family', label: 'Famille & Étudiant' },
            { id: 'perks', label: 'Avantages & iOS' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`lkdv-compte-pref ${tab === item.id ? 'on' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="lkdv-compte-inline-status" role="alert">
          <ShieldAlert size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {loading && !data ? <p role="status">Chargement de vos droits et régions…</p> : null}

      {data && tab === 'plans' ? (
        <section className="lkdv-offers-panel" aria-label="Formules disponibles">
          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <Crown size={17} aria-hidden="true" />
              <div>
                <b>Formule actuelle : {data.mapUpdates.planLabel}</b>
                <small>
                  État : {RIGHT_STATUS_LABELS[data.mapUpdates.premiumRight.status]} ·{' '}
                  {data.mapUpdates.premiumRight.reason}
                </small>
              </div>
            </div>
            <p className="lkdv-consent-note">
              {data.billingConfigured
                ? 'Paiement Stripe configuré côté serveur.'
                : 'Paiement commercial non activé sur cet environnement : aucun débit ni abonnement factice n’est déclenché.'}
            </p>
          </div>

          <ul className="lkdv-offers-list">
            {data.commercialOffers.map((offer) => (
              <li key={offer.id} className="lkdv-compte-setting-card">
                <div className="lkdv-compte-setting-head">
                  <div>
                    <b>{offer.name}</b>
                    <small>
                      {offer.targetAudience} · {offer.indicativePriceLabel}
                    </small>
                  </div>
                  <span className="lkdv-compte-security-badge">
                    {offer.checkoutConfigured ? 'Disponible' : 'Cadré · non facturé'}
                  </span>
                </div>
                <ul className="lkdv-offers-includes">
                  {offer.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data && tab === 'regions' ? (
        <section className="lkdv-offers-panel" aria-label="Régions et mises à jour de cartes">
          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <Globe size={17} aria-hidden="true" />
              <div>
                <b>Pack Monde : {RIGHT_STATUS_LABELS[data.coverage.worldPackRight.status]}</b>
                <small>
                  Catalogue cartes v{data.mapUpdates.catalogVersion} ·{' '}
                  {data.coverage.freeRegionAllowanceRemaining > 0
                    ? '1 région gratuite disponible'
                    : `Région gratuite attribuée (${data.coverage.freeRegionId})`}
                </small>
              </div>
              <button
                type="button"
                className="lkdv-compte-pref on"
                disabled={busy || !data.mapUpdates.canRefreshUnlockedMaps}
                onClick={() =>
                  void runAction(
                    { action: 'refresh_maps' },
                    `Cartes des régions débloquées actualisées vers v${data.mapUpdates.catalogVersion}.`,
                  )
                }
              >
                <RefreshCw size={13} aria-hidden="true" /> Actualiser les cartes
              </button>
            </div>
            <p className="lkdv-consent-note">{data.mapUpdates.distinctionNote}</p>
          </div>

          <ul className="lkdv-offers-list">
            {data.coverage.regions.map((region) => (
              <li key={region.id} className="lkdv-compte-setting-card">
                <div className="lkdv-compte-setting-head">
                  <Compass size={16} aria-hidden="true" />
                  <div>
                    <b>{region.name}</b>
                    <small>
                      {region.countryCode} · ~{region.estimatedSizeMb} Mo ·{' '}
                      {region.unlocked
                        ? `Débloquée (${region.source === 'free_starter' ? 'région gratuite' : region.source === 'world_pack' ? 'Pack Monde' : 'achat unitaire'})`
                        : `Verrouillée (${RIGHT_STATUS_LABELS[region.right.status]})`}
                    </small>
                  </div>
                  {!region.unlocked && data.coverage.freeRegionAllowanceRemaining > 0 ? (
                    <button
                      type="button"
                      className="lkdv-compte-pref on"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          { action: 'claim_free_region', regionId: region.id },
                          `Région gratuite activée : ${region.name}.`,
                        )
                      }
                    >
                      Choisir (gratuit)
                    </button>
                  ) : (
                    <span className="lkdv-compte-security-badge">
                      {region.unlocked
                        ? `v${region.installedVersion ?? region.latestVersion}`
                        : RIGHT_STATUS_LABELS[region.right.status]}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data && tab === 'family' ? (
        <section className="lkdv-offers-panel" aria-label="Partage familial et statut étudiant">
          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <Users size={17} aria-hidden="true" />
              <div>
                <b>
                  Sièges familiaux ({data.family.seatsUsed}/{data.family.seatsUsed + data.family.seatsAvailable})
                </b>
                <small>
                  {data.family.seatsAvailable} place{data.family.seatsAvailable > 1 ? 's' : ''} restante{data.family.seatsAvailable > 1 ? 's' : ''}
                </small>
              </div>
            </div>
            <form
              className="lkdv-offers-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!familyEmail.trim()) return;
                void runAction(
                  { action: 'invite_family_seat', email: familyEmail.trim() },
                  `Invitation familiale traitée pour ${familyEmail.trim()}.`,
                ).then((ok) => {
                  if (ok) setFamilyEmail('');
                });
              }}
            >
              <label>
                <span className="sr-only">Email du membre à inviter</span>
                <input
                  type="email"
                  value={familyEmail}
                  onChange={(e) => setFamilyEmail(e.target.value)}
                  placeholder="membre@exemple.fr"
                  disabled={busy}
                />
              </label>
              <button type="submit" className="lkdv-compte-pref on" disabled={busy}>
                Inviter
              </button>
            </form>
            <ul className="lkdv-offers-list">
              {data.family.seats.map((seat) => (
                <li key={seat.seatId} className="lkdv-offers-seat-row">
                  <div>
                    <b>{seat.email}</b>
                    <small>
                      {seat.status} · {seat.note}
                    </small>
                  </div>
                  {seat.role !== 'owner' && seat.status !== 'revoked' ? (
                    <button
                      type="button"
                      className="lkdv-compte-pref"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          { action: 'revoke_family_seat', seatId: seat.seatId },
                          `Siège révoqué pour ${seat.email}.`,
                        )
                      }
                    >
                      Révoquer
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <CheckCircle2 size={17} aria-hidden="true" />
              <div>
                <b>Tarif étudiant : {data.student.status}</b>
                <small>{data.student.reason}</small>
              </div>
            </div>
            <form
              className="lkdv-offers-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!studentEmail.trim()) return;
                void runAction(
                  { action: 'submit_student_email', email: studentEmail.trim() },
                  'Vérification académique enregistrée.',
                ).then((ok) => {
                  if (ok) setStudentEmail('');
                });
              }}
            >
              <label>
                <span className="sr-only">Adresse académique étudiante</span>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="prenom.nom@univ-exemple.fr"
                  disabled={busy}
                />
              </label>
              <button type="submit" className="lkdv-compte-pref on" disabled={busy}>
                Vérifier
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {data && tab === 'perks' ? (
        <section className="lkdv-offers-panel" aria-label="Avantages partenaires, support et icônes iOS">
          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <Headphones size={17} aria-hidden="true" />
              <div>
                <b>Support : {data.supportTier.level === 'priority' ? 'Prioritaire' : 'Standard'}</b>
                <small>
                  {data.supportTier.slaLabel} · {data.supportTier.reason}
                </small>
              </div>
            </div>
          </div>

          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <Gift size={17} aria-hidden="true" />
              <div>
                <b>Offres partenaires</b>
                <small>Activées uniquement après validation du droit et du marché</small>
              </div>
            </div>
            <ul className="lkdv-offers-list">
              {data.partnerOffers.map((offer) => (
                <li key={offer.id} className="lkdv-offers-seat-row">
                  <div>
                    <b>{offer.title}</b>
                    <small>
                      {offer.partner} · {RIGHT_STATUS_LABELS[offer.right.status]} — {offer.right.reason}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lkdv-compte-setting-card">
            <div className="lkdv-compte-setting-head">
              <Smartphone size={17} aria-hidden="true" />
              <div>
                <b>Icônes d’app iOS</b>
                <small>{data.iosIcons.reason}</small>
              </div>
            </div>
            <ul className="lkdv-offers-list">
              {data.iosIcons.icons.map((icon) => (
                <li key={icon.id} className="lkdv-offers-seat-row">
                  <span>{icon.label}</span>
                  <span className="lkdv-compte-security-badge">
                    {icon.selectable
                      ? 'Disponible'
                      : icon.unavailableReason === 'native_ios_only'
                        ? 'iOS natif uniquement'
                        : 'Indisponible'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </AccessibleDrawer>
  );
}

export default OffersSubscriptionDrawer;
