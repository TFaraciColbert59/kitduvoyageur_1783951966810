import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { hubSectionHref, type HubAdventureRef } from '../registry/hubSectionRegistry';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import type { HubWidgetId } from '../engine/hubProfileEngine';

export interface HubWidgetData {
  items: number;
  loans: number;
  alerts: number;
  members: number;
  pendingInvites: number;
  groupLabel: string | null;
  linkedTripSlug: string | null;
}

/**
 * H4.3 — Widgets réels du hub (nombres + liens registre, zéro placeholder).
 * Possession/collectif : cartes compactes. Sortie : TripSidebarRight composé
 * (voir HubSidebarRight) — ici uniquement les 7 ids propres au hub.
 */
export function HubWidgetBody({
  id,
  adventure,
  data,
}: {
  id: HubWidgetId;
  adventure: HubAdventureRef;
  data: HubWidgetData;
}) {
  switch (id) {
    case 'stock-apercu':
      return (
        <WidgetCard
          label="Stock"
          value={`${data.items} objet(s)`}
          href={hubSectionHref(adventure, 'inventaire')}
          linkLabel="Inventaire"
        />
      );
    case 'alertes-materiel':
      return (
        <WidgetCard
          label="Alertes matériel"
          value={data.alerts === 0 ? 'RAS — équipement sain' : `${data.alerts} alerte(s)`}
          href={hubSectionHref(adventure, 'alertes')}
          linkLabel="Alertes"
        />
      );
    case 'dispo-apercu':
      return (
        <WidgetCard
          label="Prêts en cours"
          value={data.loans === 0 ? 'Aucun prêt' : `${data.loans} prêt(s)`}
          href={hubSectionHref(adventure, 'disponibilite')}
          linkLabel="Disponibilité"
        />
      );
    case 'prochain-depart':
      return (
        <WidgetCard
          label="Départ"
          value="Préparer le départ"
          href={hubSectionHref(adventure, 'depart')}
          linkLabel="Départ"
        />
      );
    case 'invitations-apercu':
      return (
        <WidgetCard
          label="Invitations"
          value={data.pendingInvites === 0 ? 'Aucune en attente' : `${data.pendingInvites} en attente`}
          href={hubSectionHref(adventure, 'invitations')}
          linkLabel="Invitations"
        />
      );
    case 'presence-groupe':
      return (
        <WidgetCard
          label={data.groupLabel ?? 'Groupe'}
          value={`${data.members} membre(s)`}
          href={hubSectionHref(adventure, 'groupe')}
          linkLabel="Groupe"
        />
      );
    case 'entrer-voyage':
      if (!data.linkedTripSlug) return null;
      return (
        <Link
          href={tripSwitchHref(data.linkedTripSlug)}
          className="glass-capsule-btn primary inline-flex items-center justify-center gap-2 min-h-[44px] px-4 w-full"
        >
          <span>Entrer dans le voyage</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      );
    default:
      return null;
  }
}

function WidgetCard({
  label,
  value,
  href,
  linkLabel,
}: {
  label: string;
  value: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="glass p-4 rounded-[var(--lkv-radius-card)]">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--lkv-text-primary)] mt-1">{value}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] min-h-[44px]"
      >
        <span>{linkLabel}</span>
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default HubWidgetBody;
