'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { WearGauge, WEAR_GAUGE_CSS } from './WearGauge';
import { formatEuro, formatHistoryLine, formatWeight } from './format';
import { generatedProductImage } from './productImage';

export interface KitItemEntry {
  image?: string | null;
  nom?: string | null;
  name?: string | null;
}

export interface KitEntry {
  id?: string | null;
  realId?: string | null;
  n?: string | null;
  name?: string | null;
  gen?: string | null;
  generation?: number | string | null;
  proven?: number | null;
  field_proven_count?: number | null;
  prop?: number | null;
  w?: number | null;
  total_weight_g?: number | null;
  items?: number | KitItemEntry[] | null;
  desc?: string | null;
  description?: string | null;
  image?: string | null;
  coverImage?: string | null;
  cover_image_url?: string | null;
  outings?: number | null;
  endur?: number | null;
  credit?: number | null;
}

export interface KitCardProps {
  kit: KitEntry;
}

type ActionKind = 'fork' | 'share' | 'sheet' | 'royalties' | 'history' | 'discovery';

interface ActionPanel {
  title: string;
  lines: string[];
  href?: string;
}

interface KitSheetResponse {
  kit?: {
    name?: string | null;
    parent_name?: string | null;
    is_public?: boolean | null;
  } | null;
  journal?: unknown;
  trust?: {
    endurance_score?: number | null;
    propagation_score?: number | null;
    sessions_count?: number | null;
  } | null;
}

interface HistoryEntry {
  action?: string | null;
  created_at?: string | null;
}

interface DiscoveryLineage {
  kit_name?: string | null;
  endurance_score?: number | null;
  sessions_count?: number | null;
}

interface DiscoveryItem {
  kept_count?: number | null;
}

interface RoyaltyShare {
  amount_cents?: number | null;
}

interface RoyaltyLedgerEntry {
  amount_cents?: number | null;
}

function firstString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function kitName(kit: KitEntry): string {
  return firstString(kit.n, kit.name) || 'Kit';
}

/** Génération réelle G1→G3 : `gen` sinon `generation` sinon le nombre d'ancêtres. */
export function kitGeneration(kit: KitEntry): number {
  const fromLabel = typeof kit.gen === 'string' ? kit.gen.match(/G\s*(\d+)/i) : null;
  const explicit = fromLabel ? Number(fromLabel[1]) : firstNumber(kit.generation);
  const ancestors = firstNumber(kit.prop);
  const value = explicit ?? (ancestors !== null ? ancestors + 1 : 1);
  return Math.max(1, Math.min(3, Math.round(value)));
}

/**
 * Image produit du kit, dans l'ordre du contrat : image du kit
 * (`cover_image_url` résolue par le bootstrap), puis première image d'objet,
 * puis visuel généré. Aucune photo inventée.
 */
export function resolveKitImage(kit: KitEntry, size = 96): string {
  const direct = firstString(kit.image, kit.cover_image_url, kit.coverImage);
  if (direct) return direct;
  if (Array.isArray(kit.items)) {
    for (const item of kit.items) {
      const image = firstString(item?.image);
      if (image) return image;
    }
  }
  return generatedProductImage(kitName(kit), size);
}

function kitItemCount(kit: KitEntry): number {
  if (typeof kit.items === 'number' && Number.isFinite(kit.items)) return Math.max(0, kit.items);
  if (Array.isArray(kit.items)) return kit.items.length;
  return 0;
}

function kitIdOf(kit: KitEntry): string {
  return firstString(kit.realId, kit.id);
}

/**
 * Carte kit du drawer Profil : image produit systématique, nom, poids,
 * objets, génération, preuves, jauge d'usure et filiation G1→G2→G3.
 *
 * Les actions réutilisent les routes kit existantes (fork, partage, fiche,
 * référencement, royalties, historique, découverte) : aucune route n'est
 * réinventée, aucune donnée n'est simulée.
 */
export function KitCard({ kit }: KitCardProps) {
  const name = kitName(kit);
  const kitId = kitIdOf(kit);
  const generation = kitGeneration(kit);
  const generationLabel =
    firstString(kit.gen) || (generation === 1 ? 'Kit souche' : `Lignée G${generation}`);
  const weight = firstNumber(kit.w, kit.total_weight_g);
  const proven = Math.max(0, firstNumber(kit.proven, kit.field_proven_count) ?? 0);
  const itemCount = kitItemCount(kit);
  const description = firstString(kit.desc, kit.description);
  const imageSource = resolveKitImage(kit);

  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ActionPanel | null>(null);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  const run = useCallback(
    async (kind: ActionKind, task: () => Promise<void>) => {
      if (busy !== null) return;
      setBusy(kind);
      setError(null);
      setNotice(null);
      try {
        await task();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Action impossible pour le moment.');
      } finally {
        setBusy(null);
      }
    },
    [busy]
  );

  const forkKit = () => {
    if (!kitId) {
      setError('Ce kit n’a pas d’identifiant exploitable.');
      return;
    }
    void run('fork', async () => {
      const response = await fetch('/api/materiel/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId }),
      });
      if (!response.ok) throw new Error('Impossible de récupérer ce kit.');
      setNotice('Kit récupéré dans ton Compas.');
    });
  };

  const shareKit = () => {
    if (!kitId) {
      setError('Ce kit n’a pas d’identifiant exploitable.');
      return;
    }
    void run('share', async () => {
      const response = await fetch('/api/materiel/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId, permission: 'lecture' }),
      });
      if (!response.ok) throw new Error('Impossible de partager ce kit.');
      const data = (await response.json()) as { url?: string };
      if (!data.url) throw new Error('Lien de partage indisponible.');
      const fullUrl =
        typeof window !== 'undefined' ? `${window.location.origin}${data.url}` : data.url;
      const clipboard =
        typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (clipboard?.writeText) {
        try {
          await clipboard.writeText(fullUrl);
        } catch {
          /* Le lien reste affiché même si le presse-papier est refusé. */
        }
      }
      setPanel({ title: 'Lien de partage', lines: [fullUrl], href: data.url });
      setNotice('Lien de partage copié.');
    });
  };

  const openSheet = () => {
    if (!kitId) {
      setError('Ce kit n’a pas d’identifiant exploitable.');
      return;
    }
    void run('sheet', async () => {
      // Référencement d'abord (cookie d'attribution), puis fiche existante.
      await fetch(`/api/kits/${encodeURIComponent(kitId)}/refer`);
      const response = await fetch(`/api/kits/${encodeURIComponent(kitId)}/sheet`);
      if (!response.ok) throw new Error('Fiche du kit indisponible.');
      const data = (await response.json()) as KitSheetResponse;
      const lines: string[] = [];
      const sheetName = firstString(data.kit?.name, name);
      lines.push(sheetName);
      const parentName = firstString(data.kit?.parent_name);
      if (parentName) lines.push(`Adapté de ${parentName}.`);
      const endurance = firstNumber(data.trust?.endurance_score);
      if (endurance !== null) lines.push(`Endurance terrain : ${Math.round(endurance)} %.`);
      const sessions = firstNumber(data.trust?.sessions_count);
      if (sessions !== null) lines.push(`Sorties suivies : ${Math.round(sessions)}.`);
      if (data.kit?.is_public) lines.push('Kit public : visible dans la découverte.');
      if (lines.length === 1) lines.push('Aucun détail complémentaire pour le moment.');
      setPanel({ title: `Fiche du kit ${sheetName}`, lines });
    });
  };

  const openRoyalties = () => {
    void run('royalties', async () => {
      const response = await fetch('/api/kits/my-royalties');
      if (response.status === 404) {
        setNotice('Part créateur bientôt disponible.');
        return;
      }
      if (!response.ok) throw new Error('Part créateur indisponible.');
      const data = (await response.json()) as {
        shares?: RoyaltyShare[];
        ledger?: RoyaltyLedgerEntry[];
      };
      const shares = Array.isArray(data.shares) ? data.shares : [];
      const ledger = Array.isArray(data.ledger) ? data.ledger : [];
      const shareCents = shares.reduce((total, share) => total + Number(share.amount_cents ?? 0), 0);
      const ledgerCents = ledger.reduce((total, entry) => total + Number(entry.amount_cents ?? 0), 0);
      const lines = [
        `${shares.length} part${shares.length > 1 ? 's' : ''} créateur.`,
        `Crédit boutique : ${formatEuro(ledgerCents / 100) ?? '0,00 €'}.`,
      ];
      if (shareCents > 0) lines.push(`Parts cumulées : ${formatEuro(shareCents / 100)}.`);
      setPanel({ title: 'Royalties', lines });
    });
  };

  const openHistory = () => {
    if (!kitId) {
      setError('Ce kit n’a pas d’identifiant exploitable.');
      return;
    }
    void run('history', async () => {
      const response = await fetch(
        `/api/materiel/kits/${encodeURIComponent(kitId)}/history`
      );
      if (!response.ok) throw new Error('Historique indisponible.');
      const data = (await response.json()) as { entries?: HistoryEntry[] };
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const lines = entries
        .map(formatHistoryLine)
        .filter((line): line is string => Boolean(line))
        .slice(0, 5);
      setPanel({
        title: `Historique du kit ${name}`,
        lines: lines.length ? lines : ['Aucune version enregistrée.'],
      });
    });
  };

  const openDiscovery = () => {
    void run('discovery', async () => {
      const response = await fetch('/api/kits/discovery');
      if (!response.ok) throw new Error('Découverte indisponible.');
      const data = (await response.json()) as {
        lineages?: DiscoveryLineage[];
        items?: DiscoveryItem[];
      };
      const lineages = Array.isArray(data.lineages) ? data.lineages : [];
      const items = Array.isArray(data.items) ? data.items : [];
      const lines = [
        ...lineages.slice(0, 3).map((lineage) => {
          const lineageName = firstString(lineage.kit_name) || 'Lignée';
          const endurance = firstNumber(lineage.endurance_score);
          return endurance === null
            ? lineageName
            : `${lineageName} · endurance ${Math.round(endurance)} %`;
        }),
        ...items.slice(0, 2).map((item) => {
          const kept = firstNumber(item.kept_count);
          return `${kept === null ? 'Objet' : `${Math.round(kept)} objets`} conservés sur le terrain.`;
        }),
      ];
      setPanel({
        title: 'Découverte des lignées',
        lines: lines.length ? lines : ['Aucune lignée publiée pour le moment.'],
      });
    });
  };

  const actionDisabled = !kitId || busy !== null;

  return (
    <article className="lkdv-kit-card" data-kit-id={kitId || undefined} data-busy={busy ?? undefined}>
      <div className="lkdv-kit-media">
        <img
          className="lkdv-kit-img"
          src={imageFailed ? generatedProductImage(name) : imageSource}
          alt={name}
          width={76}
          height={76}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
        <span className="lkdv-kit-gen">{generationLabel}</span>
      </div>

      <div className="lkdv-kit-body">
        <h3 className="lkdv-kit-name">{name}</h3>
        <p className="lkdv-kit-meta">
          <span>{formatWeight(weight)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {itemCount} objet{itemCount === 1 ? '' : 's'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {proven} preuve{proven === 1 ? '' : 's'} terrain
          </span>
        </p>
        {description ? <p className="lkdv-kit-desc">{description}</p> : null}

        <WearGauge outings={firstNumber(kit.outings)} kitName={name} />

        <div className="lkdv-kit-lineage" aria-label={`Filiation de ${name} : G1 à G3`}>
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              {step > 1 ? <i aria-hidden="true">→</i> : null}
              <span
                className="lkdv-kit-lineage-step"
                data-current={step === generation ? 'true' : 'false'}
                aria-current={step === generation ? 'step' : undefined}
              >
                G{step}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="lkdv-kit-actions" role="group" aria-label={`Actions du kit ${name}`}>
          <button
            type="button"
            className="lkdv-kit-act"
            data-primary="true"
            aria-label={`Récupérer ${name}`}
            aria-busy={busy === 'fork'}
            disabled={actionDisabled}
            onClick={forkKit}
          >
            Récupérer
          </button>
          <button
            type="button"
            className="lkdv-kit-act"
            aria-label={`Partager ${name}`}
            aria-busy={busy === 'share'}
            disabled={actionDisabled}
            onClick={shareKit}
          >
            Partager
          </button>
          <button
            type="button"
            className="lkdv-kit-act"
            aria-label={`Fiche du kit ${name}`}
            aria-busy={busy === 'sheet'}
            disabled={actionDisabled}
            onClick={openSheet}
          >
            Fiche
          </button>
          <button
            type="button"
            className="lkdv-kit-act"
            aria-label="Royalties — ma part créateur"
            aria-busy={busy === 'royalties'}
            disabled={busy !== null}
            onClick={openRoyalties}
          >
            Royalties
          </button>
          <button
            type="button"
            className="lkdv-kit-act"
            aria-label={`Historique du kit ${name}`}
            aria-busy={busy === 'history'}
            disabled={actionDisabled}
            onClick={openHistory}
          >
            Historique
          </button>
          <button
            type="button"
            className="lkdv-kit-act"
            aria-label="Découvrir les lignées"
            aria-busy={busy === 'discovery'}
            disabled={busy !== null}
            onClick={openDiscovery}
          >
            Découvrir
          </button>
        </div>

        {panel ? (
          <section className="lkdv-kit-panel" role="region" aria-label={panel.title}>
            <h4>{panel.title}</h4>
            {panel.lines.map((line, index) => (
              <p key={`${panel.title}-${index}`}>{line}</p>
            ))}
            {panel.href ? (
              <a className="lkdv-kit-panel-link" href={panel.href}>
                Ouvrir le lien
              </a>
            ) : null}
          </section>
        ) : null}
        {notice ? (
          <p className="lkdv-kit-notice" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="lkdv-kit-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export const KIT_CARD_CSS = `
.lkdv-kit-card{display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;gap:11px!important;align-items:start!important;padding:10px!important;border-radius:20px!important;min-height:96px!important;box-sizing:border-box!important;background:linear-gradient(180deg,rgba(255,255,255,.68),rgba(255,255,255,.42))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.09),0 4px 14px rgba(23,43,36,.07)!important;color:var(--label,#17402C)!important;}
.lkdv-kit-media{display:flex!important;flex-direction:column!important;align-items:center!important;gap:5px!important;min-width:0!important;}
.lkdv-kit-img{width:76px!important;height:76px!important;border-radius:15px!important;object-fit:cover!important;display:block!important;background:rgba(236,244,233,.8)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-kit-gen{max-width:100%!important;font:600 9.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;text-align:center!important;}
.lkdv-kit-body{display:flex!important;flex-direction:column!important;gap:7px!important;min-width:0!important;}
.lkdv-kit-name{margin:0!important;font:700 14px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;letter-spacing:-.01em!important;color:var(--label,#17402C)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
.lkdv-kit-meta{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:4px!important;margin:0!important;font:500 11px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;font-variant-numeric:tabular-nums!important;}
.lkdv-kit-desc{margin:0!important;font:400 11.5px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
.lkdv-kit-lineage{display:flex!important;align-items:center!important;gap:5px!important;font:600 10.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;}
.lkdv-kit-lineage i{font-style:normal!important;color:var(--label2,#56665D)!important;opacity:.7!important;}
.lkdv-kit-lineage-step{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:26px!important;height:20px!important;padding:0 6px!important;border-radius:7px!important;background:rgba(23,43,36,.05)!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-kit-lineage-step[data-current="true"]{background:var(--pg,rgba(150,186,142,.5))!important;color:var(--pg-ink,#17402C)!important;box-shadow:var(--pg-sh,inset 0 1px 0 #fff)!important;}
.lkdv-kit-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;}
.lkdv-kit-act{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;min-width:44px!important;padding:0 6px!important;border:0!important;border-radius:999px!important;background:rgba(255,255,255,.56)!important;color:var(--label,#17402C)!important;font:600 11px/1.1 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.11)!important;cursor:pointer!important;transition:transform .15s ease!important;white-space:nowrap!important;}
.lkdv-kit-act[data-primary="true"]{background:var(--pg,rgba(150,186,142,.5))!important;color:var(--pg-ink,#17402C)!important;box-shadow:var(--pg-sh,inset 0 1px 0 #fff)!important;}
.lkdv-kit-act:active{transform:scale(.97)!important;}
.lkdv-kit-act:focus-visible{outline:none!important;box-shadow:inset 0 0 0 2px #17402C,inset 0 0 0 4px #FFFFFF!important;}
.lkdv-kit-act[disabled]{opacity:.55!important;cursor:default!important;}
.lkdv-kit-panel{display:flex!important;flex-direction:column!important;gap:4px!important;padding:8px 10px!important;border-radius:14px!important;background:rgba(236,244,233,.72)!important;box-shadow:inset 0 0 0 .8px rgba(91,127,85,.28)!important;}
.lkdv-kit-panel h4{margin:0!important;font:700 11.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--tint,#17402C)!important;}
.lkdv-kit-panel p{margin:0!important;font:400 11px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--label2,#56665D)!important;overflow-wrap:anywhere!important;}
.lkdv-kit-panel-link{font:600 11px/1.4 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--tint,#17402C)!important;text-decoration:underline!important;text-underline-offset:2px!important;}
.lkdv-kit-notice{margin:0!important;font:500 11px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--good,#3D7A52)!important;}
.lkdv-kit-error{margin:0!important;font:500 11px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,sans-serif)!important;color:var(--bad,#A8443A)!important;}
@media (prefers-reduced-motion:reduce){.lkdv-kit-act{transition:none!important;}.lkdv-kit-act:active{transform:none!important;}}
${WEAR_GAUGE_CSS}
`;

export default KitCard;
