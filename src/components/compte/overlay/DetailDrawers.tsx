'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSavedPosts } from '@/features/community/posts/queries';
import type { SavedPost } from '@/features/community/posts/types';
import { DrawerButton, OverlaySheet } from './OverlaySheet';
import { formatElevation, formatKm } from '@/lib/format/metrics';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface BadgeRow { id: string; name?: string; description?: string; rarity?: string; earned?: boolean; earnedAt?: string; requirement?: string; requirementValue?: number; points?: number }
export interface GearRowData { id: string; realId?: string; name?: string; brand?: string; category?: string; weight_g?: number; price_cents?: number; condition?: string; photo_url?: string | null; is_lent?: boolean; loaned_to?: string | null; outings_count?: number }
export interface BootstrapOverlayData {
  stats?: { outings?: number; km?: number; dplus?: number; massifs?: number; countries?: number; nights?: number };
  badges?: BadgeRow[];
  gearItems?: GearRowData[];
  kits?: Array<{ id: string; name?: string }>;
  followers?: unknown[];
  species?: unknown[];
  trust?: { verified?: boolean; active?: number; onTimeRate?: number | null; rating?: number | null };
  profile?: { trustScore?: number; name?: string; handle?: string; avatarUrl?: string };
}

export function SavedPostsDrawer({ onClose, onOpenPost }: { onClose: () => void; onOpenPost: (id: string) => void }) {
  const [items, setItems] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchSavedPosts().then((rows) => { if (!cancelled) setItems(rows); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return (
    <OverlaySheet title="Enregistrements" subtitle="Tes publications sauvegardées, privées." onClose={onClose}>
      {loading ? <div className="lkdv-overlay-empty"><p>Chargement…</p></div> : items.length === 0 ? (
        <div className="lkdv-overlay-empty"><b>Aucun enregistrement</b><p>Enregistre une publication pour la retrouver ici.</p><DrawerButton onClick={onClose}>Explorer</DrawerButton></div>
      ) : (
        <div className="lkdv-saved-grid">
          {items.map((item) => (
            <button key={item.id} type="button" className="lkdv-saved-card" onClick={() => onOpenPost(item.id)}>
              <span className="lkdv-saved-media">{item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="lkdv-saved-placeholder">LKDV</span>}</span>
              <span className="lkdv-saved-body"><b>{item.title}</b><small>{item.author?.name || 'Voyageur'} · {item.likesCount} j’aime</small></span>
            </button>
          ))}
        </div>
      )}
    </OverlaySheet>
  );
}

export function BadgeDetailSheet({ badge, onClose }: { badge: BadgeRow; onClose: () => void }) {
  const earned = Boolean(badge.earned);
  return (
    <OverlaySheet title="Trophée" subtitle={earned ? 'Obtenu' : 'À débloquer'} onClose={onClose} nested>
      <div className="lkdv-badge-detail">
        <span className={`lkdv-badge-detail-medal ${earned ? 'is-earned' : ''}`}>{earned ? <LKDVIcon name="badge" size={34} /> : <LKDVIcon name="verrou" size={26} />}</span>
        <h3>{badge.name || 'Trophée'}</h3>
        <span className="lkdv-badge-detail-rarity">{badge.rarity || 'Trophée LKDV'}</span>
        {badge.description ? <p>{badge.description}</p> : null}
        <dl>
          <div><dt>Statut</dt><dd>{earned ? 'Obtenu' : 'Verrouillé'}</dd></div>
          {earned && badge.earnedAt ? <div><dt>Date</dt><dd>{new Date(badge.earnedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div> : null}
          {badge.requirement ? <div><dt>Condition</dt><dd>{badge.requirement}{badge.requirementValue ? ` · ${badge.requirementValue}` : ''}</dd></div> : null}
        </dl>
      </div>
    </OverlaySheet>
  );
}

export function GearDetailSheet({ item, onClose }: { item: GearRowData; onClose: () => void }) {
  return (
    <OverlaySheet title="Matériel" subtitle={item.brand || 'Inventaire'} onClose={onClose} nested>
      <div className="lkdv-gear-detail">
        <div className="lkdv-gear-detail-hero">{item.photo_url ? <img src={item.photo_url} alt="" /> : <span>{item.name?.charAt(0).toUpperCase() || 'L'}</span>}</div>
        <h3>{item.name || 'Objet'}</h3>
        <p>{item.category || 'Matériel LKDV'}</p>
        <dl>
          <div><dt>Poids</dt><dd>{item.weight_g ? `${item.weight_g} g` : '—'}</dd></div>
          <div><dt>État</dt><dd>{item.condition || '—'}</dd></div>
          <div><dt>Sorties</dt><dd>{item.outings_count ?? 0}</dd></div>
          <div><dt>Prêt</dt><dd>{item.is_lent ? `À ${item.loaned_to || 'un membre'}` : 'Disponible'}</dd></div>
        </dl>
      </div>
    </OverlaySheet>
  );
}

export function TrustDetailSheet({ data, trustScore, onClose }: { data: BootstrapOverlayData; trustScore?: number; onClose: () => void }) {
  const trust = data.trust;
  const score = trustScore ?? 0;
  return (
    <OverlaySheet title="Indice de confiance" subtitle="Agrégat de tes prêts, sans classement." onClose={onClose} nested>
      <div className="lkdv-trust-detail">
        <div className="lkdv-trust-detail-score"><b>{score}<small>/100</small></b><span>{trust?.verified ? 'Profil vérifié' : 'Profil non vérifié'}</span></div>
        <div className="lkdv-trust-detail-gauge"><i style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>
        <div className="lkdv-trust-detail-grid">
          <div><b>{trust?.active ?? 0}</b><span>Prêts actifs</span></div>
          <div><b>{trust?.onTimeRate == null ? '—' : `${trust.onTimeRate} %`}</b><span>Retours à temps</span></div>
          <div><b>{trust?.rating == null ? '—' : trust.rating.toFixed(1)}</b><span>Note moyenne</span></div>
        </div>
        {trust?.onTimeRate == null ? <p className="lkdv-trust-detail-empty">Aucun retour noté pour le moment.</p> : null}
        <p className="lkdv-trust-detail-note">Chaque prêt est agrégé sans révéler l’historique détaillé des autres membres.</p>
      </div>
    </OverlaySheet>
  );
}

function radar(values: number[]): string {
  const scaled = values.map((value) => Math.log1p(Math.max(0, value)));
  const max = Math.max(1, ...scaled);
  return values.map((value, i) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / values.length;
    const d = 8 + 70 * (scaled[i] / max);
    return `${(80 + Math.cos(angle) * d).toFixed(1)},${(80 + Math.sin(angle) * d).toFixed(1)}`;
  }).join(' ');
}

export function SealDrawer({ data, onClose }: { data: BootstrapOverlayData; onClose: () => void }) {
  const stats = data.stats ?? {};
  const values = [stats.outings ?? 0, stats.km ?? 0, stats.dplus ?? 0, data.gearItems?.length ?? 0, data.kits?.length ?? 0, data.species?.length ?? 0, data.followers?.length ?? 0];
  const labels = ['Sorties', 'Kilomètres', 'Dénivelé', 'Matériel', 'Kits', 'Espèces', 'Tribu'];
  const displays = [String(stats.outings ?? 0), formatKm(stats.km ?? 0), formatElevation(stats.dplus ?? 0), String(data.gearItems?.length ?? 0), String(data.kits?.length ?? 0), String(data.species?.length ?? 0), String(data.followers?.length ?? 0)];
  return (
    <OverlaySheet title="Empreinte" subtitle="100 % dérivé de tes sorties GPS vérifiées" onClose={onClose} className="lkdv-seal-drawer">
      <div className="lkdv-seal">
        <div className="lkdv-seal-radar"><svg viewBox="0 0 160 160">
          {[40, 62, 78].map((r) => <circle key={r} cx="80" cy="80" r={r} fill="none" stroke="rgba(23,64,44,.16)" />)}
          {values.map((_, i) => { const a = -Math.PI / 2 + (Math.PI * 2 * i) / values.length; return <line key={i} x1="80" y1="80" x2={80 + Math.cos(a) * 78} y2={80 + Math.sin(a) * 78} stroke="rgba(23,64,44,.14)" />; })}
          <polygon points={radar(values)} fill="rgba(23,64,44,.16)" stroke="#17402c" strokeWidth="2" /><circle cx="80" cy="80" r="4" fill="#17402c" />
        </svg></div>
        <div className="lkdv-seal-grid">{labels.map((label, i) => <div key={label}><span>{label}</span><b>{displays[i]}</b></div>)}</div>
        <p className="lkdv-seal-note">Chaque branche s’allonge avec tes kilomètres réels. Aucun grade, aucun rang, aucun classement entre membres.</p>
      </div>
    </OverlaySheet>
  );
}

export function ProfilePreviewDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ id: string; full_name?: string; handle?: string; avatar_url?: string; bio?: string; location?: string; trust_score?: number } | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.from('public_profiles').select('id,full_name,handle,avatar_url,bio,location,trust_score').eq('id', userId).maybeSingle();
      if (cancelled) return;
      setProfile(data ?? null);
      if (data && user && user.id !== data.id) {
        const { data: follow } = await supabase.from('user_follows').select('follower_id').eq('follower_id', user.id).eq('following_id', data.id).maybeSingle();
        if (!cancelled) setFollowing(Boolean(follow));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, user]);
  const toggle = async () => {
    if (!user || !profile || user.id === profile.id) return;
    const supabase = createClient();
    if (following) await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', profile.id);
    else await supabase.from('user_follows').insert({ follower_id: user.id, following_id: profile.id });
    setFollowing((v) => !v);
  };
  return (
    <OverlaySheet title="Profil" subtitle={profile?.handle ? `@${profile.handle}` : undefined} onClose={onClose} nested>
      {loading ? <div className="lkdv-overlay-empty"><p>Chargement…</p></div> : !profile ? <div className="lkdv-overlay-empty"><b>Profil privé</b></div> : (
        <div className="lkdv-profile-preview">
          <div className="lkdv-profile-preview-head">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{profile.full_name?.charAt(0) || 'L'}</span>}
            <div><h3>{profile.full_name || profile.handle || 'Voyageur'}</h3><p>@{profile.handle || 'voyageur'}{profile.location ? ` · ${profile.location}` : ''}</p><small><LKDVIcon name="badge" size={13} /> Confiance {profile.trust_score ?? 0}/100</small></div>
          </div>
          {profile.bio ? <p className="lkdv-profile-preview-bio">{profile.bio}</p> : null}
          <div className="lkdv-profile-preview-actions">{user?.id !== profile.id ? <DrawerButton tone={following ? 'secondary' : 'primary'} onClick={() => void toggle()}>{following ? 'Abonné' : 'Suivre'}</DrawerButton> : null}<DrawerButton tone="ghost" onClick={onClose}>Fermer</DrawerButton></div>
        </div>
      )}
    </OverlaySheet>
  );
}

export default SavedPostsDrawer;
