'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Copy, Download, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import {
  deleteCarnetAction,
  updateCarnetSettingsAction,
} from '@/features/carnet/detail/editActions';
import { encodeQr, qrPath } from '@/features/carnet/detail/qr';
import { buildGpx } from '@/features/carnet/detail/gpx';
import {
  NOTIFICATION_FILTERS,
  groupLabel,
  relativeTime,
  useCarnetNotifications,
} from '@/features/carnet/detail/useCarnetNotifications';

const NOTIF_PREFS = [
  ['À chaque moment', 'bavard'],
  ['Résumé du soir', '1 par jour'],
  ['Départ, sommets, arrivée', 'discret'],
] as const;

/** Préférence de notification : propre à l'appareil (aucune table serveur). */
export function useNotifPref(carnetId: string): [number, (next: number) => void] {
  const key = `lkdv:carnet:${carnetId}:notif-pref`;
  const [pref, setPref] = useState(1);
  useEffect(() => {
    try {
      const raw = Number(window.localStorage.getItem(key));
      if (Number.isInteger(raw) && raw >= 0 && raw < NOTIF_PREFS.length) setPref(raw);
    } catch {
      /* stockage refusé : valeur par défaut */
    }
  }, [key]);
  return [
    pref,
    (next) => {
      setPref(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        /* préférence valable pour la session */
      }
    },
  ];
}

export { NOTIF_PREFS };

export interface CarnetAccountDrawerProps {
  detail: CarnetDetail;
  userId: string | null;
  dialogRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
  onIsland?: (message: string, undo?: () => void, subtitle?: string) => void;
  onRequireAuth?: () => void;
  /** Colonnes écrites sur `carnets` : l'écran les reporte sur la fiche. */
  onSettingsSaved: (changes: Record<string, string | boolean>) => void;
  onDeleted: () => void;
}

const TABS = [
  { id: 'notif', label: 'Notifications' },
  { id: 'part', label: 'Partage' },
  { id: 'param', label: 'Paramètres' },
  { id: 'gerer', label: 'Gérer' },
] as const;

function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Tiroir « Carnet » (bouton curseurs de la barre) : Notifications, Partage,
 * Paramètres et, pour l'auteur, Gérer. Chaque onglet n'est monté qu'à sa
 * première ouverture, puis conservé (spec 01 § 4).
 */
export function CarnetAccountDrawer({
  detail,
  userId,
  dialogRef,
  onClose,
  onIsland,
  onRequireAuth,
  onSettingsSaved,
  onDeleted,
}: CarnetAccountDrawerProps) {
  const tabs = useMemo(
    () => (detail.isOwner ? TABS : TABS.filter((tab) => tab.id !== 'gerer')),
    [detail.isOwner]
  );
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    setActive(index);
    setVisited((prev) => new Set(prev).add(index));
  };

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  const shareUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}/carnets/${detail.id}`),
    [detail.id]
  );

  const panes: Record<string, React.ReactNode> = {
    notif: (
      <NotificationsPane carnetId={detail.id} userId={userId} onRequireAuth={onRequireAuth} onIsland={onIsland} />
    ),
    part: <SharePane detail={detail} shareUrl={shareUrl} onClose={onClose} onIsland={onIsland} />,
    param: (
      <SettingsPane
        detail={detail}
        onIsland={onIsland}
        onSettingsSaved={onSettingsSaved}
      />
    ),
    gerer: (
      <ManagePane
        detail={detail}
        onIsland={onIsland}
        onSettingsSaved={onSettingsSaved}
        onDeleted={onDeleted}
      />
    ),
  };

  return (
    <div
      ref={dialogRef}
      className="lkdv-stack-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Paramètres du carnet"
      tabIndex={-1}
    >
      <div className="lkdv-stack-header">
        <button type="button" className="lkdv-stack-back" onClick={onClose}>
          <ChevronLeft size={16} />
          <span>Fermer</span>
        </button>
        <b style={{ fontSize: '13.5px', color: 'var(--tint)' }}>Carnet</b>
      </div>

      <div style={{ padding: '8px 12px 0' }}>
        <div
          className="lkdv-day-capsule"
          role="tablist"
          aria-label="Onglets du tiroir Carnet"
          style={{ width: '100%', justifyContent: 'space-around' }}
        >
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`carnet-account-tab-${tab.id}`}
              type="button"
              role="tab"
              className="lkdv-day-capsule-btn"
              aria-selected={active === idx}
              aria-controls={`carnet-account-pane-${tab.id}`}
              tabIndex={active === idx ? 0 : -1}
              onClick={() => select(idx)}
              onKeyDown={(event) => onTabKey(event, idx)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lkdv-stack-body">
        {tabs.map((tab, idx) =>
          visited.has(idx) ? (
            <div
              key={tab.id}
              id={`carnet-account-pane-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`carnet-account-tab-${tab.id}`}
              hidden={active !== idx}
              style={{ display: active === idx ? 'flex' : 'none', flexDirection: 'column', gap: 8 }}
            >
              {panes[tab.id]}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────

function NotificationsPane({
  carnetId,
  userId,
  onRequireAuth,
  onIsland,
}: {
  carnetId: string;
  userId: string | null;
  onRequireAuth?: () => void;
  onIsland?: CarnetAccountDrawerProps['onIsland'];
}) {
  const { items, state, markRead } = useCarnetNotifications(carnetId, userId, true);
  const [filter, setFilter] = useState(0);

  if (!userId) {
    return (
      <div className="lkdv-lens-state" role="status">
        <b>Connecte-toi pour voir tes notifications.</b>
        <button type="button" className="lkdv-lens-cta" onClick={onRequireAuth}>
          Se connecter
        </button>
      </div>
    );
  }
  if (state === 'loading' || state === 'idle') {
    return (
      <div className="lkdv-lens-state" role="status" aria-busy="true">
        <b>Chargement…</b>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="lkdv-lens-state" data-tone="error" role="alert">
        <b>Impossible de charger les notifications.</b>
      </div>
    );
  }

  const shown = items.filter((n) => filter === 0 || n.category === filter);
  const unread = items.filter((n) => !n.read).length;
  const groups = (['Aujourd’hui', 'Hier', 'Avant'] as const)
    .map((label) => ({ label, list: shown.filter((n) => groupLabel(n.createdAt) === label) }))
    .filter((g) => g.list.length > 0);

  return (
    <>
      <div className="lkdv-chips" role="group" aria-label="Filtrer les notifications">
        {NOTIFICATION_FILTERS.map((name, i) => (
          <button key={name} type="button" className="lkdv-chip" aria-pressed={filter === i} onClick={() => setFilter(i)}>
            {name}
          </button>
        ))}
      </div>
      {items.length > 0 ? (
        <div className="lkdv-set-row" style={{ padding: '2px 2px 0' }}>
          <div className="t">
            <b>{unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</b>
          </div>
          <button
            type="button"
            className="lkdv-mbtn soft"
            disabled={unread === 0}
            onClick={() =>
              void markRead(items.filter((n) => !n.read).map((n) => n.id)).then((ok) =>
                onIsland?.(ok ? 'Tout est lu' : 'Impossible de marquer comme lu')
              )
            }
          >
            Tout lire
          </button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="lkdv-lens-state" role="status">
          <b>Aucune notification.</b>
          <p>Les j’aime, commentaires et arrivées de voyageurs de ce carnet apparaîtront ici.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="lkdv-lens-state" role="status">
          <b>Aucune notification dans ce filtre.</b>
          <p>Change de filtre pour voir les autres notifications.</p>
        </div>
      ) : (
        groups.map((g) => (
          <React.Fragment key={g.label}>
            <h3 className="lkdv-h5">{g.label}</h3>
            {g.list.map((n) => (
              <button
                key={n.id}
                type="button"
                className="lkdv-sheet-notif"
                onClick={() => void markRead(n.read ? [] : [n.id])}
              >
                <span className={`ud${n.read ? ' read' : ''}`} aria-label={n.read ? undefined : 'Non lue'} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b>
                    {n.title}
                    <small>{relativeTime(n.createdAt)}</small>
                  </b>
                  {n.message ? <p>{n.message}</p> : null}
                </span>
              </button>
            ))}
          </React.Fragment>
        ))
      )}
    </>
  );
}

// ── Partage ───────────────────────────────────────────────────────────────

function SharePane({
  detail,
  shareUrl,
  onClose,
  onIsland,
}: {
  detail: CarnetDetail;
  shareUrl: string;
  onClose: () => void;
  onIsland?: CarnetAccountDrawerProps['onIsland'];
}) {
  const qr = useMemo(() => {
    const matrix = shareUrl ? encodeQr(shareUrl) : null;
    return matrix ? qrPath(matrix, 1) : null;
  }, [shareUrl]);
  const display = shareUrl.replace(/^https?:\/\//, '');
  return (
    <>
      <div className="lkdv-card2">
        <div className="lkdv-row2" style={{ gap: 12 }}>
          <span className="lkdv-qr" role="img" aria-label={`QR code du lien ${display}`}>
            {qr ? (
              <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" aria-hidden="true">
                <path d={qr.d} fill="currentColor" />
              </svg>
            ) : null}
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ font: '650 15px var(--font-sans, sans-serif)' }}>{detail.title}</b>
            <div className="lkdv-mute" style={{ overflowWrap: 'anywhere' }}>
              {display}
            </div>
            {detail.verified ? (
              <div className="lkdv-row2" style={{ marginTop: 6 }}>
                <ShieldCheck size={16} aria-hidden />
                <span className="lkdv-tg p">Trace GPS vérifiée</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="lkdv-row-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="lkdv-mbtn solid"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.share) {
                void navigator.share({ title: detail.title, url: shareUrl }).catch(() => {});
              } else {
                void navigator.clipboard.writeText(shareUrl);
                onIsland?.('Lien du carnet copié');
              }
            }}
          >
            <Share2 size={15} aria-hidden />
            Partager
          </button>
          <button
            type="button"
            className="lkdv-mbtn ghost"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              onIsland?.('Lien du carnet copié');
            }}
          >
            <Copy size={15} aria-hidden />
            Copier
          </button>
          <button type="button" className="lkdv-mbtn ghost" onClick={onClose}>
            Voir le carnet
          </button>
        </div>
      </div>
      <div className="lkdv-kpis">
        <div className="lkdv-kpi">
          <b>{detail.engagement.views.toLocaleString('fr-FR')}</b>
          <span>Vues</span>
        </div>
        <div className="lkdv-kpi">
          <b>{detail.engagement.likes.toLocaleString('fr-FR')}</b>
          <span>J’aime</span>
        </div>
        <div className="lkdv-kpi">
          <b>{detail.isPublic ? 'Public' : 'Privé'}</b>
          <span>Visibilité</span>
        </div>
      </div>
      {!detail.isPublic ? <p className="lkdv-mute">Carnet privé : seuls ses participants le voient.</p> : null}
    </>
  );
}

// ── Paramètres ────────────────────────────────────────────────────────────

function SettingsPane({
  detail,
  onIsland,
  onSettingsSaved,
}: {
  detail: CarnetDetail;
  onIsland?: CarnetAccountDrawerProps['onIsland'];
  onSettingsSaved: CarnetAccountDrawerProps['onSettingsSaved'];
}) {
  const [pref, setPref] = useNotifPref(detail.id);
  const [busy, setBusy] = useState(false);

  const save = async (changes: { visibility?: 'public' | 'private'; liveSharing?: boolean }, done: string) => {
    if (busy) return;
    setBusy(true);
    const result = await updateCarnetSettingsAction({ carnetId: detail.id, ...changes });
    setBusy(false);
    if (!result.ok) {
      onIsland?.(result.error);
      return;
    }
    onSettingsSaved(result.changes);
    onIsland?.(done);
  };

  return (
    <>
      {detail.isOwner ? (
        <>
          <div className="lkdv-card2">
            <div className="lkdv-set-row">
              <div className="t">
                <b>Confidentialité</b>
                <small>{detail.isPublic ? 'Carnet public' : 'Carnet privé, sur invitation'}</small>
              </div>
              <button
                type="button"
                role="switch"
                className="lkdv-sw"
                aria-checked={detail.isPublic}
                aria-label={`Passer le carnet en ${detail.isPublic ? 'privé' : 'public'}`}
                disabled={busy}
                onClick={() =>
                  void save(
                    { visibility: detail.isPublic ? 'private' : 'public' },
                    detail.isPublic ? 'Carnet privé' : 'Carnet public'
                  )
                }
              />
            </div>
          </div>
          <div className="lkdv-card2">
            <div className="lkdv-set-row">
              <div className="t">
                <b>Position en direct</b>
                <small>
                  {detail.liveSharing
                    ? 'Visible sur la carte pendant la marche (zone floue et différée pour les visiteurs)'
                    : 'Position masquée'}
                </small>
              </div>
              <button
                type="button"
                role="switch"
                className="lkdv-sw"
                aria-checked={Boolean(detail.liveSharing)}
                aria-label="Partager ma position en direct"
                disabled={busy}
                onClick={() =>
                  void save(
                    { liveSharing: !detail.liveSharing },
                    detail.liveSharing ? 'Position masquée' : 'Position partagée'
                  )
                }
              />
            </div>
          </div>
        </>
      ) : null}
      <div className="lkdv-card2">
        <b style={{ font: '600 13.5px var(--font-sans, sans-serif)' }}>Notifications</b>
        <small className="lkdv-mute">{NOTIF_PREFS[pref][0]}</small>
        <div className="lkdv-chips" role="group" aria-label="Fréquence des notifications">
          {NOTIF_PREFS.map(([label], i) => (
            <button key={label} type="button" className="lkdv-chip" aria-pressed={pref === i} onClick={() => setPref(i)}>
              {label}
            </button>
          ))}
        </div>
        <small className="lkdv-mute">Préférence gardée sur cet appareil.</small>
      </div>
      <div className="lkdv-card2">
        <div className="lkdv-set-row">
          <div className="t">
            <b>Unités</b>
            <small>Kilomètres et mètres</small>
          </div>
        </div>
        <div className="lkdv-segc" role="group" aria-label="Unités">
          <button type="button" aria-pressed="true">
            Métrique
          </button>
          <button type="button" aria-pressed="false" disabled title="Bientôt disponible">
            Impérial · bientôt
          </button>
        </div>
      </div>
    </>
  );
}

// ── Gérer (auteur) ────────────────────────────────────────────────────────

function ManagePane({
  detail,
  onIsland,
  onSettingsSaved,
  onDeleted,
}: {
  detail: CarnetDetail;
  onIsland?: CarnetAccountDrawerProps['onIsland'];
  onSettingsSaved: CarnetAccountDrawerProps['onSettingsSaved'];
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(detail.isPublic ? 'public' : 'private');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const result = await updateCarnetSettingsAction({ carnetId: detail.id, title, description, visibility });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onSettingsSaved(result.changes);
    onIsland?.('Carnet enregistré');
  };

  const remove = async () => {
    setBusy(true);
    const result = await deleteCarnetAction({ carnetId: detail.id });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onIsland?.('Carnet supprimé');
    onDeleted();
  };

  const gpx = useMemo(() => buildGpx(detail.title, detail.trace), [detail.title, detail.trace]);

  return (
    <>
      <div className="lkdv-card2">
        <label className="lkdv-field">
          <span>Titre du carnet</span>
          <input type="text" value={title} maxLength={120} aria-label="Titre du carnet" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="lkdv-field">
          <span>Description · {description.length}/160</span>
          <textarea value={description} maxLength={160} aria-label="Description" onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="lkdv-field">
          <span>Visibilité</span>
          <select value={visibility} aria-label="Visibilité" onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}>
            <option value="public">Public</option>
            <option value="private">Privé</option>
          </select>
        </label>
        <div className="lkdv-row-actions">
          <button type="button" className="lkdv-mbtn p" disabled={busy || !title.trim()} onClick={() => void save()}>
            Enregistrer
          </button>
          <button
            type="button"
            className="lkdv-mbtn ghost"
            disabled={busy}
            onClick={() => {
              setTitle(detail.title);
              setDescription(detail.description ?? '');
              setVisibility(detail.isPublic ? 'public' : 'private');
              setMessage(null);
            }}
          >
            Annuler
          </button>
        </div>
        <div role="alert" className="lkdv-carnet-create-msg" data-ok="false">
          {message ?? ''}
        </div>
      </div>
      <div className="lkdv-card2">
        <b style={{ font: '600 13.5px var(--font-sans, sans-serif)' }}>Exporter</b>
        <div className="lkdv-row-actions">
          <button
            type="button"
            className="lkdv-mbtn ghost"
            disabled={!gpx}
            title={gpx ? undefined : 'Aucune trace GPS à exporter'}
            onClick={() => {
              if (!gpx) return;
              download(`carnet-${detail.id}.gpx`, 'application/gpx+xml', gpx);
              onIsland?.('Trace GPX téléchargée');
            }}
          >
            <Download size={15} aria-hidden />
            GPX
          </button>
          <button
            type="button"
            className="lkdv-mbtn ghost"
            onClick={() => {
              download(`carnet-${detail.id}.json`, 'application/json', JSON.stringify(detail, null, 2));
              onIsland?.('Carnet exporté en JSON');
            }}
          >
            <Download size={15} aria-hidden />
            JSON
          </button>
        </div>
      </div>
      <div className="lkdv-card2">
        {confirmDelete ? (
          <>
            <span className="lkdv-mute">Supprimer le carnet et tous ses moments ? Cette action est définitive.</span>
            <div className="lkdv-row-actions">
              <button type="button" className="lkdv-mbtn ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>
                Annuler
              </button>
              <button type="button" className="lkdv-mbtn danger" data-testid="delete-carnet-confirm" disabled={busy} onClick={() => void remove()}>
                Supprimer définitivement
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="lkdv-mbtn danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} aria-hidden />
            Supprimer le carnet
          </button>
        )}
      </div>
    </>
  );
}
