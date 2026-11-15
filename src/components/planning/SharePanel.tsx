'use client';

import React, { useState } from 'react';
import { Link2, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import {
  createPlanShare,
  evaluateShareAccessP01,
  revokePlanShare,
  type MultiDayPlan,
  type PlanShareRecord,
  type ShareAccessDecision,
  type ShareAudience,
  type ViewerContextP01,
} from '@/features/planning';
import {
  AUDIENCE_LABELS,
  endOfDayIso,
  formatDateTime,
  isoDatePlusDays,
  shareReasonLabel,
} from './format';

const FIELD_CLASS =
  'h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const PUBLIC_VISITOR: ViewerContextP01 = {
  viewerId: 'visitor-public',
  friendIds: [],
  tribuIds: [],
  blockedUserIds: [],
};

function makeShareId(planId: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `share-${planId}-${suffix}`;
}

export interface SharePanelProps {
  plan: MultiDayPlan;
  actorId: string;
  nowIso: string;
  initialRecord?: PlanShareRecord | null;
  onPlanChange?: (plan: MultiDayPlan) => void;
  onRecordChange?: (record: PlanShareRecord | null) => void;
  defaultExpiryDays?: number;
}

/**
 * Partage P01 : consentement explicite, propriétaire vérifié, expiration,
 * révocation et décision fail-closed pour un visiteur public.
 */
export function SharePanel({
  plan,
  actorId,
  nowIso,
  initialRecord = null,
  onPlanChange,
  onRecordChange,
  defaultExpiryDays = 7,
}: SharePanelProps) {
  const [audience, setAudience] = useState<ShareAudience>(
    plan.publicShareConsented ? 'public' : 'friends',
  );
  const [expiresDate, setExpiresDate] = useState(() => isoDatePlusDays(nowIso, defaultExpiryDays));
  const [includeExactCoords, setIncludeExactCoords] = useState(false);
  const [allowedTribes, setAllowedTribes] = useState('');
  const [record, setRecord] = useState<PlanShareRecord | null>(initialRecord);
  const [error, setError] = useState<string | null>(null);
  const [accessDecision, setAccessDecision] = useState<ShareAccessDecision | null>(null);

  const applyRecord = (next: PlanShareRecord | null) => {
    setRecord(next);
    onRecordChange?.(next);
  };

  const updateConsent = (checked: boolean) => {
    onPlanChange?.({ ...plan, publicShareConsented: checked, updatedAtIso: nowIso });
    if (!checked && audience === 'public') setAudience('friends');
  };

  const create = () => {
    setError(null);
    setAccessDecision(null);
    const result = createPlanShare(plan, actorId, {
      shareId: makeShareId(plan.id),
      audience,
      timezone: plan.timezone,
      createdAtIso: nowIso,
      expiresAtIso: expiresDate ? endOfDayIso(expiresDate) : null,
      allowedTribeIds:
        audience === 'tribu'
          ? allowedTribes
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      includeExactStartEndCoords: includeExactCoords,
    });

    if (!result.ok) {
      switch (result.reason) {
        case 'forbidden_not_owner':
          setError('Seul le propriétaire du plan peut créer un partage.');
          break;
        case 'consent_missing_p01':
          setError('Le partage public exige le consentement explicite du propriétaire.');
          break;
        case 'invalid_expiration':
          setError('La date d’expiration doit être postérieure à la création du partage.');
          break;
      }
      return;
    }
    applyRecord(result.record);
  };

  const revoke = () => {
    if (!record) return;
    setError(null);
    const result = revokePlanShare(record, actorId, nowIso);
    if (!result.ok) {
      setError('Seul le propriétaire du plan peut révoquer ce partage.');
      return;
    }
    applyRecord(result.record);
  };

  const checkPublicAccess = () => {
    if (!record) return;
    setAccessDecision(evaluateShareAccessP01(plan, record, PUBLIC_VISITOR, nowIso));
  };

  return (
    <section aria-labelledby="planning-share-title" className="space-y-[var(--space-3)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)]">
          <Link2 aria-hidden="true" size={20} className="text-[color:var(--lkv-info)]" />
          <h3
            id="planning-share-title"
            className="text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            Partage P01
          </h3>
        </div>
        <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
          Le partage est fail-closed : sans consentement, sans propriétaire ou après révocation,
          l’accès est refusé.
        </p>
      </div>

      <label className="flex items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
        <input
          type="checkbox"
          className="mt-[2px] h-4 w-4 accent-[color:var(--lkv-action)]"
          checked={plan.publicShareConsented}
          onChange={(event) => updateConsent(event.target.checked)}
          disabled={!onPlanChange}
        />
        <span>
          <span className="block font-semibold text-[color:var(--lkv-text-primary)]">
            Consentement au partage public
          </span>
          {plan.publicShareConsented
            ? 'Le propriétaire a consenti à un partage public. Il peut le retirer à tout moment.'
            : 'Sans ce consentement, seules les audiences amis ou tribu sont disponibles.'}
        </span>
      </label>

      <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Audience</span>
          <select
            className={FIELD_CLASS}
            value={audience}
            onChange={(event) => setAudience(event.target.value as ShareAudience)}
          >
            <option value="friends">Amis</option>
            <option value="tribu">Tribu</option>
            <option value="public" disabled={!plan.publicShareConsented}>
              Public {plan.publicShareConsented ? '' : '(consentement requis)'}
            </option>
          </select>
        </label>

        <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)]">
          <span>Expiration (facultative)</span>
          <input
            type="date"
            className={FIELD_CLASS}
            value={expiresDate}
            onChange={(event) => setExpiresDate(event.target.value)}
          />
        </label>

        {audience === 'tribu' && (
          <label className="space-y-[var(--space-1)] text-[length:var(--lkv-text-footnote)] font-medium text-[color:var(--lkv-text-secondary)] sm:col-span-2">
            <span>Identifiants de tribu autorisés (séparés par des virgules)</span>
            <input
              type="text"
              className={FIELD_CLASS}
              value={allowedTribes}
              onChange={(event) => setAllowedTribes(event.target.value)}
              placeholder="tribu-alpes, tribu-pyrenees"
            />
          </label>
        )}

        <label className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)] sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[color:var(--lkv-action)]"
            checked={includeExactCoords}
            onChange={(event) => setIncludeExactCoords(event.target.checked)}
          />
          Inclure les coordonnées exactes de départ et d’arrivée
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--space-2)]">
        <Button variant="primary" size="sm" onClick={create}>
          Créer le partage
        </Button>
        {record && record.revokedAtIso === null && (
          <Button variant="destructive" size="sm" onClick={revoke}>
            Révoquer
          </Button>
        )}
        {record && (
          <Button variant="ghost" size="sm" onClick={checkPublicAccess}>
            Vérifier l’accès public
          </Button>
        )}
      </div>

      {record && (
        <div className="rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border-subtle)] bg-[color:var(--lkv-surface-paper)] p-[var(--space-3)]">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
            <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">
              Partage {record.shareId}
            </p>
            <div className="flex flex-wrap gap-[var(--space-1)]">
              <Badge tone={record.revokedAtIso ? 'danger' : 'sage'}>
                {record.revokedAtIso ? 'Révoqué' : AUDIENCE_LABELS[record.audience]}
              </Badge>
              <Badge tone="stone">{record.timezone}</Badge>
            </div>
          </div>
          <dl className="mt-[var(--space-2)] grid grid-cols-2 gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] sm:grid-cols-4">
            <div>
              <dt className="text-[color:var(--lkv-text-muted)]">Créé</dt>
              <dd className="text-[color:var(--lkv-text-primary)]">
                {formatDateTime(record.createdAtIso, record.timezone)}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--lkv-text-muted)]">Expire</dt>
              <dd className="text-[color:var(--lkv-text-primary)]">
                {record.expiresAtIso
                  ? formatDateTime(record.expiresAtIso, record.timezone)
                  : 'Sans expiration'}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--lkv-text-muted)]">Coordonnées exactes</dt>
              <dd className="text-[color:var(--lkv-text-primary)]">
                {record.includeExactStartEndCoords ? 'Oui' : 'Non'}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--lkv-text-muted)]">Tribus</dt>
              <dd className="text-[color:var(--lkv-text-primary)]">
                {record.allowedTribeIds.length > 0 ? record.allowedTribeIds.join(', ') : '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {accessDecision && (
        <div
          role="status"
          className={`flex items-start gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border p-[var(--space-3)] ${
            accessDecision.allowed
              ? 'border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)]'
              : 'border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)]'
          }`}
        >
          {accessDecision.allowed ? (
            <ShieldCheck aria-hidden="true" size={18} className="mt-[2px] shrink-0" />
          ) : (
            <ShieldX aria-hidden="true" size={18} className="mt-[2px] shrink-0" />
          )}
          <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-primary)]">
            {accessDecision.allowed
              ? `Visiteur public autorisé (${AUDIENCE_LABELS[accessDecision.audience]}) ; coordonnées exactes : ${
                  accessDecision.includeExactStartEndCoords ? 'oui' : 'non'
                }.`
              : `Visiteur public refusé : ${shareReasonLabel(accessDecision.reason)}.`}
          </p>
        </div>
      )}
    </section>
  );
}

export default SharePanel;
