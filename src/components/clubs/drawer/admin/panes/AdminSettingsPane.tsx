'use client';

import React, { useState } from 'react';
import { Check, Eye, Lock, ShieldCheck } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ClubItemData, ClubToastPayload, ClubVisibility } from '../../ClubDrawerTypes';
import { AdminAccordionCard, AdminStatusPill } from '../AdminPrimitives';
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
  const activeVisibilityMeta =
    VISIBILITY_OPTIONS.find((v) => v.id === visibility) ?? VISIBILITY_OPTIONS[0];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const apiPrivacy = activeVisibilityMeta.apiValue;
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
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
          <Eye size={14} aria-hidden="true" />
          <span>Identité & Territoire</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>Nom du club</span>
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

          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>Massif / Zone</span>
            <input
              type="text"
              className="club-glass-input"
              value={massif}
              onChange={(e) => setMassif(e.target.value)}
              disabled={!canEdit}
              maxLength={120}
            />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>Présentation</span>
          <textarea
            className="club-glass-input"
            rows={2}
            style={{ height: 'auto', padding: '7px 10px', resize: 'vertical' }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={!canEdit}
            maxLength={1000}
          />
        </label>
      </div>

      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
            <Lock size={14} aria-hidden="true" />
            <span>Visibilité & Accès</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--label2)' }}>{activeVisibilityMeta.desc}</span>
        </div>

        <SegmentedControl
          size="sm"
          showLabels
          ariaLabel="Visibilité du club"
          value={visibility}
          onChange={(id) => {
            if (canEdit) setVisibility(id as ClubVisibility);
          }}
          items={VISIBILITY_OPTIONS.map((opt) => ({
            id: opt.id,
            label: opt.label,
          }))}
        />
      </div>

      <AdminAccordionCard
        title="Charte & Règlement"
        icon={<ShieldCheck size={14} aria-hidden="true" />}
        badge={
          <AdminStatusPill tone={charter.trim() ? 'sage' : 'neutral'}>
            {charter.trim() ? 'Renseignée' : 'Vide'}
          </AdminStatusPill>
        }
        defaultOpen={false}
      >
        <textarea
          className="club-glass-input"
          rows={3}
          style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
          value={charter}
          onChange={(e) => setCharter(e.target.value)}
          disabled={!canEdit}
          placeholder="Règles de sécurité, respect en montagne, fonctionnement du club…"
          maxLength={1000}
          aria-label="Charte et règlement du club"
        />
      </AdminAccordionCard>

      {canEdit ? (
        <button
          type="submit"
          disabled={saving}
          className="lkdv-carnet-btn-soft"
          style={{
            height: 38,
            justifyContent: 'center',
            background: 'var(--club-soft-bg, #d3ebd9)',
            color: 'var(--tint, #17402c)',
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
