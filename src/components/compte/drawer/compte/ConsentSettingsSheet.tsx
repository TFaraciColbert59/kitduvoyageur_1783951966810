'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  HeartPulse,
  Loader2,
  MapPin,
  Plug,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import {
  CONSENT_USAGE_COPY,
  type ConsentProviderState,
  type ConsentSettingsPayload,
  type ConsentUsageState,
} from '@/features/compte/domain/consentSettings';
import { OverlaySheet } from '../../overlay/OverlaySheet';
import { DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { fetchJson } from './shared';

const QUERY_KEY = ['compte', 'consents'] as const;

const USAGE_ICONS: Record<ConsentUsageState['id'], React.ReactNode> = {
  personal_performance: <Activity size={17} aria-hidden="true" />,
  collective_terrain: <Users size={17} aria-hidden="true" />,
  live_location: <MapPin size={17} aria-hidden="true" />,
  group_location: <Users size={17} aria-hidden="true" />,
  external_readiness: <HeartPulse size={17} aria-hidden="true" />,
};

const PROVIDER_ICONS: Record<ConsentProviderState['kind'], React.ReactNode> = {
  health: <HeartPulse size={16} aria-hidden="true" />,
  gps: <MapPin size={16} aria-hidden="true" />,
  oauth: <Plug size={16} aria-hidden="true" />,
  sensor: <Smartphone size={16} aria-hidden="true" />,
};

interface Status {
  kind: 'success' | 'error' | 'info';
  message: string;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function UsageRow({
  usage,
  pending,
  onToggle,
}: {
  usage: ConsentUsageState;
  pending: boolean;
  onToggle: (usage: ConsentUsageState) => void;
}) {
  const revokedAt = formatDate(usage.revokedAt);
  return (
    <article className={`lkdv-consent-usage${usage.granted ? ' is-on' : ''}${usage.disabled ? ' is-disabled' : ''}`}>
      <span className="lkdv-consent-ico" aria-hidden="true">
        {USAGE_ICONS[usage.id]}
      </span>
      <div className="lkdv-consent-copy">
        <div className="lkdv-consent-line">
          <b>{usage.label}</b>
          {usage.disabled ? <span className="lkdv-consent-chip is-off">Désactivé</span> : null}
          {!usage.disabled && revokedAt ? <span className="lkdv-consent-chip">Retiré le {revokedAt}</span> : null}
        </div>
        <small>{usage.summary}</small>
        <p>{usage.detail}</p>
      </div>
      {usage.disabled ? (
        <span className="lkdv-consent-locked">Indisponible</span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={usage.granted}
          aria-busy={pending || undefined}
          aria-label={`${usage.granted ? 'Révoquer' : 'Accorder'} le consentement : ${usage.label}`}
          className={`lkdv-compte-switch${usage.granted ? ' on' : ''}`}
          disabled={pending}
          onClick={() => onToggle(usage)}
        >
          {pending ? (
            <Loader2 size={13} className="lkdv-consent-spin" aria-hidden="true" />
          ) : (
            <i aria-hidden="true" />
          )}
        </button>
      )}
    </article>
  );
}

function ProviderRow({ provider }: { provider: ConsentProviderState }) {
  const usageLabels = provider.usageIds
    .map((usageId) => CONSENT_USAGE_COPY[usageId].label)
    .join(' · ');
  return (
    <article className="lkdv-consent-provider" data-connection="none">
      <span className="lkdv-consent-provider-ico" aria-hidden="true">
        {PROVIDER_ICONS[provider.kind]}
      </span>
      <div className="lkdv-consent-copy">
        <div className="lkdv-consent-line">
          <b>{provider.label}</b>
          <span className="lkdv-consent-chip is-off">Non connecté</span>
        </div>
        <small>
          {provider.platforms} · {provider.dependency}
        </small>
        <small className="lkdv-consent-usage-map">Usages visés : {usageLabels}</small>
        <p>{provider.reason}</p>
      </div>
      <span className="lkdv-consent-locked">Contrat absent</span>
    </article>
  );
}

/**
 * Sous-drawer « Appareils et services » du Compte.
 *
 * Le parent (`SettingsPane`) reste monté : fermer cette feuille restitue le
 * contexte et la position du drawer Compte. Seuls les usages du contrat
 * existant sont modifiables. Les fournisseurs sont affichés comme dépendances
 * non connectées, sans bouton ni consentement simulé.
 */
export function ConsentSettingsSheet({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchJson<ConsentSettingsPayload>('/api/compte/consents'),
    staleTime: 0,
  });

  const toggle = async (usage: ConsentUsageState) => {
    if (usage.disabled || pending) return;
    const granted = !usage.granted;
    setPending(usage.id);
    setStatus(null);
    try {
      const next = await fetchJson<ConsentSettingsPayload>('/api/compte/consents', {
        method: 'PATCH',
        body: JSON.stringify({ purpose: usage.id, granted }),
      });
      queryClient.setQueryData(QUERY_KEY, next);
      setStatus({
        kind: 'success',
        message: granted
          ? `Consentement accordé : ${usage.label}.`
          : `Consentement révoqué : ${usage.label}. La purge des données dérivées est demandée au traitement serveur.`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error && error.message
            ? `Le consentement n’a pas été enregistré : ${error.message}`
            : 'Le consentement n’a pas été enregistré.',
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <OverlaySheet
      title="Appareils et services"
      subtitle="Consentements par usage, révocation et fournisseurs"
      onClose={onClose}
      nested
      className="lkdv-consent-sheet"
    >
      <style>{CONSENT_SHEET_CSS}</style>

      <div className="lkdv-consent-body">
        <section className="lkdv-consent-hero">
          <span className="lkdv-consent-hero-ico" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div>
            <b>Tu gardes la main</b>
            <p>
              Chaque usage se règle séparément. La révocation est enregistrée immédiatement, puis la purge des
              données dérivées est demandée au traitement serveur. Aucune donnée de santé n’est lue ni transmise.
            </p>
          </div>
        </section>

        {status ? (
          <p className={`lkdv-consent-status is-${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
            {status.message}
          </p>
        ) : null}

        {query.isLoading ? <DrawerSkeleton /> : null}
        {query.isError || !query.data ? (
          <DrawerError onRetry={() => void query.refetch()} />
        ) : null}

        {query.data ? (
          <>
            <section className="lkdv-consent-section" aria-labelledby="lkdv-consent-usages">
              <header className="lkdv-consent-section-head">
                <h3 id="lkdv-consent-usages">Usages</h3>
                <small>Contrat {query.data.policyVersion}</small>
              </header>
              <div className="lkdv-consent-list">
                {query.data.purposes.map((usage) => (
                  <UsageRow
                    key={usage.id}
                    usage={usage}
                    pending={pending === usage.id}
                    onToggle={(item) => void toggle(item)}
                  />
                ))}
              </div>
            </section>

            <section className="lkdv-consent-section" aria-labelledby="lkdv-consent-providers">
              <header className="lkdv-consent-section-head">
                <h3 id="lkdv-consent-providers">Fournisseurs</h3>
                <small>Aucune connexion</small>
              </header>
              <p className="lkdv-consent-note">
                Le contrat actuel ne stocke qu’un consentement par finalité, sans identifiant de fournisseur,
                de compte externe ni de jeton. La granularité par fournisseur reste donc indisponible ; elle ne
                sera exposée qu’avec les connecteurs D01/D02 et leur contrat serveur.
              </p>
              <div className="lkdv-consent-list">
                {query.data.providers.map((provider) => (
                  <ProviderRow key={provider.id} provider={provider} />
                ))}
              </div>
            </section>

            <p className="lkdv-consent-footnote">
              Une révocation coupe les accès futurs et les caches contrôlés, mais ne peut pas effacer une copie
              déjà reçue par un destinataire. Aucun jeton fournisseur n’est stocké dans cette surface.
            </p>
          </>
        ) : null}

      </div>
    </OverlaySheet>
  );
}

const CONSENT_SHEET_CSS = `
.lkdv-consent-sheet .lkdv-overlay-body{padding:10px 14px 16px!important;}
.lkdv-consent-body{display:flex;flex-direction:column;gap:12px;font-family:var(--sf);color:var(--label);}
.lkdv-consent-hero{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:18px;background:rgba(255,255,255,.56);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08);}
.lkdv-consent-hero-ico{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:12px;background:rgba(23,64,44,.08);color:#17402C;}
.lkdv-consent-hero b{display:block;font:650 13px/1.25 var(--sf);}
.lkdv-consent-hero p{margin:3px 0 0;font:400 11px/1.45 var(--sf);color:var(--label2);}
.lkdv-consent-section{display:flex;flex-direction:column;gap:7px;}
.lkdv-consent-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px;}
.lkdv-consent-section-head h3{margin:0;font:700 10.5px var(--sf);letter-spacing:.06em;text-transform:uppercase;color:var(--tint,#17402C);}
.lkdv-consent-section-head small{font:500 10px var(--sf);color:var(--label3);}
.lkdv-consent-list{display:flex;flex-direction:column;gap:6px;}
.lkdv-consent-usage,.lkdv-consent-provider{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:start;gap:9px;padding:11px;border-radius:16px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08);}
.lkdv-consent-usage.is-on{background:rgba(61,122,82,.075);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(61,122,82,.2);}
.lkdv-consent-usage.is-disabled,.lkdv-consent-provider{background:rgba(255,255,255,.36);}
.lkdv-consent-ico,.lkdv-consent-provider-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:rgba(23,64,44,.07);color:#17402C;}
.lkdv-consent-copy{min-width:0;display:flex;flex-direction:column;gap:2px;}
.lkdv-consent-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.lkdv-consent-line b{font:650 12px/1.25 var(--sf);color:var(--label);}
.lkdv-consent-copy small{font:500 10.5px/1.35 var(--sf);color:var(--label2);}
.lkdv-consent-copy .lkdv-consent-usage-map{color:var(--label3);font-size:9.5px;}
.lkdv-consent-copy p{margin:2px 0 0;font:400 10.5px/1.45 var(--sf);color:var(--label3);}
.lkdv-consent-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;background:rgba(61,122,82,.13);color:#2C5E3E;font:600 8.5px var(--sf);white-space:nowrap;}
.lkdv-consent-chip.is-off{background:rgba(185,138,46,.14);color:#7d5c14;}
.lkdv-consent-locked{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;background:rgba(23,43,36,.055);color:var(--label3);font:600 8.5px var(--sf);white-space:nowrap;}
.lkdv-consent-note{margin:0;padding:0 2px;font:400 10.5px/1.45 var(--sf);color:var(--label3);}
.lkdv-consent-footnote{margin:0;padding:8px 10px;border-radius:12px;background:rgba(23,64,44,.05);font:400 10px/1.45 var(--sf);color:var(--label3);}
.lkdv-consent-status{margin:0;padding:7px 10px;border-radius:10px;font:600 10.5px/1.4 var(--sf);}
.lkdv-consent-status.is-success{background:rgba(61,122,82,.1);color:#2C5E3E;}
.lkdv-consent-status.is-error{background:rgba(179,58,44,.1);color:#9C2F22;}
.lkdv-consent-status.is-info{background:rgba(23,64,44,.07);color:#17402C;}
.lkdv-consent-usage .lkdv-compte-switch{position:relative;width:42px!important;height:25px!important;margin-top:3px;}
.lkdv-consent-usage .lkdv-compte-switch::after{content:"";position:absolute;inset:-10px -4px;}
.lkdv-consent-usage .lkdv-compte-switch i{width:21px!important;height:21px!important;}
.lkdv-consent-usage .lkdv-compte-switch[aria-busy="true"]{display:grid!important;place-items:center!important;}
.lkdv-consent-spin{color:#2C5E3E;animation:lkdv-consent-spin .9s linear infinite;}
@keyframes lkdv-consent-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion: reduce){.lkdv-consent-spin{animation:none;}}
`;

export default ConsentSettingsSheet;
