'use client';

import React, { useState } from 'react';
import {
  Check,
  Compass,
  Layers,
  MapPin,
  Mountain,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useClubDialog } from './useClubDialog';
import type { ClubRuntimeOverlaysProps } from './ClubDrawerTypes';

/**
 * D38..D43 — Overlays runtime unifiés Carnet V2 Light-Mode Liquid Glass
 * (`seal`, `display` #popv, `map_layers` #mopts, `peek` #ctx, `story` #story,
 * `post_modal`, `quick_circle`, `create_group`).
 */
export function ClubRuntimeOverlays({
  overlay,
  onClose,
  activeClub,
  members,
  outings,
  onToggleJoinClub,
  onOpenClubDrawer,
  onFlyToCoords,
  onToast,
}: ClubRuntimeOverlaysProps) {
  const dialogRef = useClubDialog(Boolean(overlay), onClose);
  const [outdoorHighContrast, setOutdoorHighContrast] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'topo3d' | 'ign' | 'sat' | 'pentes'>('topo3d');
  const [groupTitle, setGroupTitle] = useState(`Cordée ${activeClub.name}`);
  const [storyIdx, setStoryIdx] = useState(0);

  if (!overlay) return null;

  const titles: Record<string, string> = {
    seal: `Sceau & Pass Terrain · ${activeClub.name}`,
    display: 'Affichage Mode Extérieur & Verre',
    map_layers: 'Calques Carte 3D & Relief',
    peek: `Aperçu Rapide & Actions · ${activeClub.name}`,
    story: `Stories Terrain · ${activeClub.name}`,
    post_modal: `Publication · ${activeClub.name}`,
    quick_circle: 'Navigation Rapide Cordée',
    create_group: `Nouveau Groupe de Voyage · ${activeClub.name}`,
  };

  return (
    <div
      className="lkdv-peek club-runtime-overlay-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid={`club-runtime-overlay-${overlay.kind}`}
    >
      <div
        ref={dialogRef}
        className="lkdv-peek-box"
        role="dialog"
        aria-modal="true"
        aria-label={titles[overlay.kind] || `Superposition ${overlay.kind} — ${activeClub.name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lkdv-peek-menu" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px' }}>
            <div>
              <span className="club-sec-eyebrow">{activeClub.massif} · {activeClub.category}</span>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#172b24' }}>
                {titles[overlay.kind] || activeClub.name}
              </div>
            </div>
            <button
              type="button"
              className="reseau-btn active club-icon-pill"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {overlay.kind === 'seal' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="li nt club-glass-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <QrCode size={36} color="#17402C" aria-hidden="true" />
                <div>
                  <div className="ttl"><b>Pass Certifié · {activeClub.name}</b></div>
                  <div className="s2">
                    {activeClub.membersCount} membres · {activeClub.outingsCount} sorties · +{activeClub.totalDplus.toLocaleString('fr-FR')} m D+
                  </div>
                </div>
              </div>
              <div className="club-form-pills">
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={() => {
                    onToggleJoinClub(activeClub.id);
                    onToast({
                      title: activeClub.joined ? 'Statut membre mis à jour' : 'Adhésion confirmée ✓',
                      subtitle: activeClub.name,
                    });
                    onClose();
                  }}
                >
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>{activeClub.joined ? 'Membre actif ✓' : 'Rejoindre le club'}</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(1, 1);
                    onClose();
                  }}
                >
                  Ouvrir Encadrants & Sécurité
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'display' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="li nt club-glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="ttl"><b>Lisibilité Plein Soleil (Glacier / Crête)</b></div>
                  <div className="s2">Contraste renforcé AA+ sur fond ivoire Carnet V2</div>
                </div>
                <button
                  type="button"
                  className={`reseau-btn ${outdoorHighContrast ? 'primary' : 'active'}`}
                  onClick={() => {
                    const next = !outdoorHighContrast;
                    setOutdoorHighContrast(next);
                    if (typeof document !== 'undefined') {
                      const phoneEl = document.getElementById('phone');
                      if (phoneEl) {
                        phoneEl.classList.toggle('outdoor', next);
                        phoneEl.setAttribute('data-outdoor', next ? 'true' : 'false');
                      }
                    }
                    onToast({
                      title: next ? 'Mode Plein Soleil activé' : 'Mode Liquid Glass standard',
                      subtitle: activeClub.name,
                    });
                  }}
                >
                  <Sun size={14} aria-hidden="true" />
                  <span>{outdoorHighContrast ? 'Actif ✓' : 'Activer'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'map_layers' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="club-form-pills">
                {(
                  [
                    { id: 'topo3d', label: 'Topo 3D Alpin' },
                    { id: 'ign', label: 'Courbes IGN 25k' },
                    { id: 'sat', label: 'Satellite HD' },
                    { id: 'pentes', label: 'Pentes > 30°' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`reseau-btn ${activeLayer === l.id ? 'primary' : 'active'}`}
                    onClick={() => {
                      setActiveLayer(l.id);
                      onFlyToCoords(activeClub.lat, activeClub.lng, `${activeClub.name} · ${l.label}`);
                      onToast({
                        title: `Calque ${l.label} activé`,
                        subtitle: activeClub.massif,
                      });
                    }}
                  >
                    <Layers size={13} aria-hidden="true" />
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {overlay.kind === 'peek' || overlay.kind === 'quick_circle' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="club-form-pills">
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={() => {
                    onOpenClubDrawer(2, 0);
                    onClose();
                  }}
                >
                  <Mountain size={14} aria-hidden="true" />
                  <span>Sorties ({outings.length})</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(1, 0);
                    onClose();
                  }}
                >
                  <Users size={14} aria-hidden="true" />
                  <span>Cordée ({members.length})</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(3, 0);
                    onClose();
                  }}
                >
                  <span>Coffre</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(4, 0);
                    onClose();
                  }}
                >
                  <span>Salons</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onOpenClubDrawer(5, 0);
                    onClose();
                  }}
                >
                  <span>Statistiques</span>
                </button>
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => {
                    onFlyToCoords(activeClub.lat, activeClub.lng, activeClub.name);
                    onClose();
                  }}
                >
                  <MapPin size={14} aria-hidden="true" />
                  <span>Centrer Carte 3D</span>
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'story' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}>
              <div className="li nt club-glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <span className="club-badge-sage">
                  Moment Terrain {storyIdx + 1} / {Math.max(1, outings.length)}
                </span>
                <div className="ttl">
                  <b>{outings[storyIdx]?.title || activeClub.nextOutingTitle}</b>
                </div>
                <div className="s2">
                  📍 {outings[storyIdx]?.massif || activeClub.massif} · Guidé par {outings[storyIdx]?.leaderName || activeClub.name}
                </div>
              </div>
              <div className="club-form-pills">
                <button
                  type="button"
                  className="reseau-btn active"
                  onClick={() => setStoryIdx((i) => (i + 1) % Math.max(1, outings.length))}
                >
                  Story suivante →
                </button>
                <button
                  type="button"
                  className="reseau-btn primary"
                  onClick={() => {
                    onOpenClubDrawer(2, 0, { outingId: outings[storyIdx]?.id });
                    onClose();
                  }}
                >
                  Voir la fiche sortie
                </button>
              </div>
            </div>
          ) : null}

          {overlay.kind === 'create_group' || overlay.kind === 'post_modal' ? (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px 6px' }}
              onSubmit={(e) => {
                e.preventDefault();
                onToast({
                  title: 'Groupe de voyage créé ✓',
                  subtitle: groupTitle.trim() || activeClub.name,
                });
                onClose();
              }}
            >
              <input
                type="text"
                className="club-glass-input"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                aria-label="Nom du groupe de voyage"
              />
              <button type="submit" className="reseau-btn primary">
                <Check size={14} aria-hidden="true" />
                <span>Valider & Inviter la cordée</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ClubRuntimeOverlays;
