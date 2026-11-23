'use client';

import React, { useState } from 'react';
import { Check, Eye, Lock, ShieldCheck } from 'lucide-react';
import type { ClubItemData, ClubToastPayload, ClubVisibility } from '../../ClubDrawerTypes';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminSettingsPaneProps {
  activeClub: ClubItemData;
  caps: UseClubCapabilitiesResult;
  onToggleClubVisibility?: () => void;
  onToast?: (toast: ClubToastPayload) => void;
}

const VISIBILITY_OPTIONS: Array<{
  id: ClubVisibility;
  apiValue: 'open' | 'closed' | 'secret';
  label: string;
  desc: string;
}> = [
  { id: 'public', apiValue: 'open', label: 'Ouvert', desc: 'Visible et adhésion libre' },
  { id: 'prive', apiValue: 'closed', label: 'Sur validation', desc: 'Demande validée par le bureau' },
  { id: 'secret', apiValue: 'secret', label: 'Secret', desc: 'Sur lien d’invitation uniquement' },
];

export function AdminSettingsPane({
  activeClub,
  caps,
  onToggleClubVisibility,
  onToast,
}: AdminSettingsPaneProps) {
  const [name, setName] = useState(activeClub.name);
  const [massif, setMassif] = useState(activeClub.massif || '');
  const [bio, setBio] = useState(activeClub.bio || '');
  const [charter, setCharter] = useState(activeClub.charter || '');
  const [visibility, setVisibility] = useState<ClubVisibility>(activeClub.visibility);
  const [saving, setSaving] = useState(false);

  const canEdit = caps.has('club.edit_settings');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const apiPrivacy =
        VISIBILITY_OPTIONS.find((v) => v.id === visibility)?.apiValue ?? 'closed';
      if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
        const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: bio.trim(),
            zoneLabel: massif.trim() || null,
            rules: charter.trim() || null,
            privacy: apiPrivacy,
          }),
        });
        if (!res.ok) throw new Error('Enregistrement refusé');
      }
      if (visibility !== activeClub.visibility) {
        onToggleClubVisibility?.();
      }
      onToast?.({ title: 'Paramètres enregistrés ✓', subtitle: name.trim() });
    } catch (err) {
      onToast?.({
        title: 'Erreur',
        subtitle: err instanceof Error ? err.message : 'Impossible d’enregistrer.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
          <Eye size={14} aria-hidden="true" />
          <span>Identité & Territoire</span>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label2)' }}>Nom du club</span>
          <input
            type="text"
            className="club-glass-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            minLength={2}
            maxLength={80}
            required
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label2)' }}>Massif / Zone</span>
          <input
            type="text"
            className="club-glass-input"
            value={massif}
            onChange={(e) => setMassif(e.target.value)}
            disabled={!canEdit}
            maxLength={120}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label2)' }}>Présentation</span>
          <textarea
            className="club-glass-input"
            rows={3}
            style={{ height: 'auto', padding: '8px 12px', resize: 'vertical' }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={!canEdit}
            maxLength={1000}
          />
        </label>
      </div>

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
          <Lock size={14} aria-hidden="true" />
          <span>Visibilité & Accès</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {VISIBILITY_OPTIONS.map((opt) => {
            const active = visibility === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!canEdit}
                onClick={() => setVisibility(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: active
                    ? '1px solid rgba(23, 64, 44, 0.28)'
                    : '0.5px solid rgba(23, 43, 36, 0.1)',
                  background: active ? 'rgba(23, 64, 44, 0.09)' : 'rgba(255, 255, 255, 0.55)',
                  cursor: canEdit ? 'pointer' : 'default',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--label)' }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--label2)' }}>{opt.desc}</div>
                </div>
                {active ? <Check size={15} color="#17402c" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
          <ShieldCheck size={14} aria-hidden="true" />
          <span>Charte & Règlement</span>
        </div>
        <textarea
          className="club-glass-input"
          rows={3}
          style={{ height: 'auto', padding: '8px 12px', resize: 'vertical' }}
          value={charter}
          onChange={(e) => setCharter(e.target.value)}
          disabled={!canEdit}
          placeholder="Règles de sécurité, respect en montagne, fonctionnement du club…"
          maxLength={1000}
        />
      </div>

      {canEdit ? (
        <button
          type="submit"
          disabled={saving}
          className="lkdv-carnet-btn-soft"
          style={{
            height: 38,
            justifyContent: 'center',
            background: 'rgba(23, 64, 44, 0.12)',
            color: '#17402c',
            fontWeight: 700,
          }}
        >
          <Check size={15} aria-hidden="true" />
          <span>{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</span>
        </button>
      ) : null}
    </form>
  );
}
