'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Switch } from '@/components/ui';
import { A_VERIFIER } from '../engine/trust';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft, CalendarBlock } from '../types';

export interface InvitePermissions {
  viewProgram: boolean;
  proposeChanges: boolean;
  editDirectly: boolean;
  inviteOthers: boolean;
}

const PERMISSION_KEYS = ['viewProgram', 'proposeChanges', 'editDirectly', 'inviteOthers'] as const;
export type InvitePermissionKey = (typeof PERMISSION_KEYS)[number];

export const DEFAULT_INVITE_PERMISSIONS: InvitePermissions = Object.freeze({
  viewProgram: true,
  proposeChanges: true,
  editDirectly: false,
  inviteOthers: true,
});

interface PermissionRowDef { label: string; detail: string; icon: string; }
const PERMISSION_ROWS: Readonly<Record<InvitePermissionKey, PermissionRowDef>> = {
  viewProgram: { label: 'Voir le programme', detail: 'Le parcours jour par jour, les étapes et les horaires.', icon: 'map' },
  proposeChanges: { label: 'Proposer des changements', detail: 'Il te suggère une modification, tu la valides ou non.', icon: 'message-square' },
  editDirectly: { label: 'Modifier directement', detail: 'Il change une étape sans attendre ton accord.', icon: 'edit2' },
  inviteOthers: { label: 'Inviter d’autres', detail: 'Il peut transmettre le lien à d’autres personnes.', icon: 'user-plus' },
};

export const INVITE_PERMISSIONS_STORAGE_KEY = 'lkdv_prep_invite_permissions_v1';

function toBool(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }

export function serializeInvitePermissions(permissions: InvitePermissions): string {
  return JSON.stringify({
    viewProgram: permissions.viewProgram === true,
    proposeChanges: permissions.proposeChanges === true,
    editDirectly: permissions.editDirectly === true,
    inviteOthers: permissions.inviteOthers === true,
  });
}

export function deserializeInvitePermissions(raw: string | null | undefined): InvitePermissions {
  if (typeof raw !== 'string' || raw.length === 0) return { ...DEFAULT_INVITE_PERMISSIONS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_INVITE_PERMISSIONS };
    const record = parsed as Partial<Record<InvitePermissionKey, unknown>>;
    return {
      viewProgram: toBool(record.viewProgram, DEFAULT_INVITE_PERMISSIONS.viewProgram),
      proposeChanges: toBool(record.proposeChanges, DEFAULT_INVITE_PERMISSIONS.proposeChanges),
      editDirectly: toBool(record.editDirectly, DEFAULT_INVITE_PERMISSIONS.editDirectly),
      inviteOthers: toBool(record.inviteOthers, DEFAULT_INVITE_PERMISSIONS.inviteOthers),
    };
  } catch { return { ...DEFAULT_INVITE_PERMISSIONS }; }
}

export function setInvitePermission(permissions: InvitePermissions, key: InvitePermissionKey, value: boolean): InvitePermissions {
  return { ...permissions, [key]: value };
}

export function readInvitePermissions(): InvitePermissions {
  if (typeof window === 'undefined') return { ...DEFAULT_INVITE_PERMISSIONS };
  try { return deserializeInvitePermissions(window.localStorage.getItem(INVITE_PERMISSIONS_STORAGE_KEY)); } 
  catch { return { ...DEFAULT_INVITE_PERMISSIONS }; }
}

export function writeInvitePermissions(permissions: InvitePermissions): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(INVITE_PERMISSIONS_STORAGE_KEY, serializeInvitePermissions(permissions)); } 
  catch {}
}

export function remainingPlaces(draft: AdventurePrepDraft, capacity: number | null): number | null {
  if (capacity === null || !Number.isFinite(capacity) || capacity < 0) return null;
  const planned = Math.max(0, draft.group.adults + draft.group.children);
  return Math.max(0, Math.floor(capacity) - planned);
}

export function participantsLabel(draft: AdventurePrepDraft): string {
  const total = Math.max(0, draft.group.adults + draft.group.children);
  return `${total} personne${total > 1 ? 's' : ''}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function parseIsoDay(value: string | null): Date | null {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCoverDates(calendar: CalendarBlock): string {
  const start = parseIsoDay(calendar.startDate);
  if (!start) return A_VERIFIER;
  const end = parseIsoDay(calendar.returnDate);
  if (end && end.getTime() !== start.getTime()) return `${DATE_FORMAT.format(start)} → ${DATE_FORMAT.format(end)}`;
  const days = calendar.durationDays;
  if (typeof days === 'number' && days > 1) return `${DATE_FORMAT.format(start)} · ${days} jours`;
  return DATE_FORMAT.format(start);
}

export type InviteBlockCode = 'lien_en_attente' | 'lien_indisponible' | 'message_vide';
export interface InviteBlock { code: InviteBlockCode; severity: 'attente' | 'alerte'; text: string; }

const BLOCK_TEXTS: Readonly<Record<InviteBlockCode, string>> = {
  lien_en_attente: 'Préparation du lien sécurisé… L’invitation s’active dès que le lien est prêt.',
  lien_indisponible: 'Le lien d’invitation n’a pas pu être signé : la clé d’invitation du serveur est absente. Aucun lien ne partira d’ici. Réessaie plus tard ou préviens l’assistance.',
  message_vide: 'Écris un mot à tes invités avant d’envoyer : ce message accompagne le programme, c’est lui qui explique pourquoi tu les appelles.',
};

export function inviteBlock(input: { url: string | null; message: string; linkPending: boolean; }): InviteBlock | null {
  if (input.linkPending) return { code: 'lien_en_attente', severity: 'attente', text: BLOCK_TEXTS.lien_en_attente };
  if (input.url === null) return { code: 'lien_indisponible', severity: 'alerte', text: BLOCK_TEXTS.lien_indisponible };
  if (input.message.trim().length === 0) return { code: 'message_vide', severity: 'alerte', text: BLOCK_TEXTS.message_vide };
  return null;
}

export type InviteChannel = 'partage' | 'presse-papiers' | 'aucun';
export interface InviteSharePayload { title: string; text: string; url: string; }
export interface InviteDeliveryResult { channel: InviteChannel; message: string; }
export interface InviteDeliveryDeps { share?: (payload: InviteSharePayload) => Promise<void>; copy?: (text: string) => Promise<void>; }

export async function deliverInvite(payload: InviteSharePayload, deps: InviteDeliveryDeps, expiresInHours: number): Promise<InviteDeliveryResult> {
  if (typeof deps.share === 'function') {
    try {
      await deps.share(payload);
      return { channel: 'partage', message: `Invitation transmise par le partage du système. Le lien reste valable ${expiresInHours} h.` };
    } catch { return { channel: 'aucun', message: 'Partage annulé ou impossible : le lien n’a pas été transmis. Réessaie, ou copie le lien à la main.' }; }
  }
  if (typeof deps.copy === 'function') {
    try {
      await deps.copy(payload.url);
      return { channel: 'presse-papiers', message: `Lien copié dans le presse-papiers, valable ${expiresInHours} h. Colle-le où tu veux.` };
    } catch { return { channel: 'aucun', message: 'Copie impossible sur cet appareil : le lien reste affiché plus bas pour être transmis à la main.' }; }
  }
  return { channel: 'aucun', message: 'Ce navigateur ne sait ni partager ni copier : le lien reste affiché pour être transmis à la main.' };
}

export function browserDeliveryDeps(): InviteDeliveryDeps {
  if (typeof navigator === 'undefined') return {};
  const share = navigator.share;
  const writeText = navigator.clipboard?.writeText;
  return {
    share: typeof share === 'function' ? (payload) => share.call(navigator, payload) : undefined,
    copy: typeof writeText === 'function' ? (text) => writeText.call(navigator.clipboard, text) : undefined,
  };
}

export interface InviteUrlRequest { adventureId: string; permissions: InvitePermissions; expiresInHours: number; }
export type InviteUrlBuilder = (request: InviteUrlRequest) => Promise<string | null>;

export interface PrepInviteScreenProps {
  buildInviteUrl: InviteUrlBuilder | null;
  coverImageUrl?: string | null;
  capacity?: number | null;
  expiresInHours?: number;
  onBack?: () => void;
}

const MESSAGE_MAX = 280;
const DEFAULT_EXPIRY_HOURS = 72;

function PermissionRow({ permissionKey, checked, disabled, onToggle }: { permissionKey: InvitePermissionKey; checked: boolean; disabled: boolean; onToggle: (value: boolean) => void; }) {
  const row = PERMISSION_ROWS[permissionKey];
  return (
    <div className="prep-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--lkv-border)' }}>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--lkv-text-primary)' }}>{row.label}</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--lkv-text-secondary)' }}>{row.detail}</div>
      </div>
      <Switch id={`prep-invite-droit-${permissionKey}`} checked={checked} disabled={disabled} onCheckedChange={onToggle} aria-label={row.label} />
    </div>
  );
}

export function PrepInviteScreen({
  buildInviteUrl,
  coverImageUrl = null,
  capacity = null,
  expiresInHours = DEFAULT_EXPIRY_HOURS,
  onBack,
}: PrepInviteScreenProps) {
  const draft = useAdventurePrepStore((state) => state.draft);
  const adventureId = useAdventurePrepStore((state) => state.adventureId);

  const [stored, setStored] = useState<InvitePermissions>(DEFAULT_INVITE_PERMISSIONS);
  const [message, setMessage] = useState('');
  
  const hasBuilder = typeof buildInviteUrl === 'function';
  const [url, setUrl] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(hasBuilder);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  
  const places = useMemo(() => remainingPlaces(draft, capacity), [draft, capacity]);
  const full = places === 0;

  const permissions = useMemo(() => (full ? setInvitePermission(stored, 'inviteOthers', false) : stored), [stored, full]);

  const permissionsRef = useRef(permissions);
  useEffect(() => { permissionsRef.current = permissions; }, [permissions]);

  const loadPermissions = useCallback(() => { setStored(readInvitePermissions()); }, []);
  useEffect(loadPermissions, [loadPermissions]);

  useEffect(() => { writeInvitePermissions(permissions); }, [permissions]);

  useEffect(() => {
    let active = true;
    if (typeof buildInviteUrl !== 'function') {
      setUrl(null);
      setLinkPending(false);
      return () => { active = false; };
    }
    setLinkPending(true);
    buildInviteUrl({ adventureId: typeof adventureId === 'string' ? adventureId : '', permissions: permissionsRef.current, expiresInHours })
      .then((resolved) => {
        if (!active) return;
        setUrl(typeof resolved === 'string' && resolved.length > 0 ? resolved : null);
        setLinkPending(false);
      })
      .catch(() => {
        if (!active) return;
        setUrl(null);
        setLinkPending(false);
      });
    return () => { active = false; };
  }, [buildInviteUrl, adventureId, expiresInHours]);

  const title = draft.coverName ?? 'Ton aventure';
  const dates = formatCoverDates(draft.calendar);
  const participants = participantsLabel(draft);
  const block = inviteBlock({ url, message, linkPending });

  const handleSend = useCallback(async () => {
    if (block !== null || url === null || busy) return;
    setBusy(true);
    setStatus(null);
    const result = await deliverInvite(
      { title, text: `${message.trim()}\n${title} · ${dates} · ${participants}`, url },
      browserDeliveryDeps(),
      expiresInHours,
    );
    setStatus(result.message);
    setBusy(false);
  }, [block, url, busy, message, title, dates, participants, expiresInHours]);

  const granted = PERMISSION_KEYS.filter((key) => permissions[key]);
  const noRights = granted.length === 0;

  return (
    <div className="prep-screen">
      <div className="prep-body">
        <div className="prep-actionrow" style={{ justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
          {onBack ? (
            <Button variant="ghost" size="md" onClick={onBack} icon={<Icon name="x" size={18} aria-hidden="true" />}>
              Fermer
            </Button>
          ) : null}
        </div>

        <h1 className="prep-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Inviter</h1>

        <div style={{ display: 'flex', gap: 12, padding: 12, backgroundColor: 'var(--surface)', border: '1px solid var(--lkv-border)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--prep-shadow-sm)', marginBottom: 20 }}>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'var(--lkv-success-bg)', color: 'var(--lkv-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image-off" size={24} aria-hidden="true" />
              <span className="prep-visually-hidden">Aucune image de couverture</span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>{title}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
              {dates} · {participants}
            </div>
            {draft.group.knownMembers.length > 0 && (
              <div style={{ fontSize: '0.875rem', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
                {draft.group.knownMembers.length} {draft.group.knownMembers.length > 1 ? 'personnes déjà dans le groupe' : 'personne déjà dans le groupe'}
              </div>
            )}
            {!coverImageUrl && (
              <div style={{ fontSize: '0.875rem', color: 'var(--lkv-text-subtle)', marginTop: 2 }}>
                Aucune image appliquée : l’invitation part sans photo tant que tu n’en choisis pas.
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
           <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--lkv-text-primary)', marginBottom: 6 }}>Budget estimatif</div>
           <div style={{ padding: 12, backgroundColor: 'var(--surface)', border: '1px solid var(--lkv-border)', borderRadius: 12 }}>
             {draft.preferences.budgetPerPerson ? `≈ ${draft.preferences.budgetPerPerson} € / pers.` : 'Non défini'}
           </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--lkv-text-primary)', margin: '0 0 6px 0' }}>Message</h2>
          <textarea
            style={{ width: '100%', minHeight: 84, padding: '12px 14px', borderRadius: 12, backgroundColor: 'var(--surface)', border: '1px solid var(--lkv-border)', fontSize: '1rem', color: 'var(--lkv-text-primary)', resize: 'vertical' }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. On part samedi matin, viens avec un coupe-vent."
            maxLength={MESSAGE_MAX}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--lkv-text-primary)', margin: '0 0 6px 0' }}>Ce que les invités peuvent faire</h2>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--lkv-border)', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {PERMISSION_KEYS.map((key) => (
              <PermissionRow
                key={key}
                permissionKey={key}
                checked={permissions[key]}
                disabled={key === 'inviteOthers' && full}
                onToggle={(value) => setStored((current) => setInvitePermission(current, key, value))}
              />
            ))}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.875rem', color: 'var(--lkv-text-subtle)' }}>
            Une invitation ne donne pas accès à ta localisation. Ce que tu vois ici est le maximum possible, jamais une permission automatique.
          </p>
          {full ? (
            <p className="prep-note" data-tone="warn" style={{ marginTop: 8 }}>
              Le groupe est complet : plus personne place, l’invité ne peut pas inviter quelqu’un d’autre.
            </p>
          ) : null}
        </div>

        {block ? (
          <p
            id="prep-invite-block"
            className="prep-note"
            data-tone={block.severity === 'alerte' ? 'warn' : undefined}
            role={block.severity === 'alerte' ? 'alert' : 'status'}
          >
            {block.text}
          </p>
        ) : null}
        {status ? (
          <p className="prep-note" role="status">
            {status}
          </p>
        ) : null}
      </div>

      <div className="prep-footer">
        <Button
          variant="primary"
          size="lg"
          className="prep-footer__primary"
          loading={busy}
          disabled={block !== null}
          onClick={handleSend}
          aria-describedby={block ? 'prep-invite-block' : undefined}
          icon={<Icon name="send" size={18} aria-hidden="true" />}
          style={{ width: '100%' }}
        >
          Envoyer l’invitation
        </Button>
      </div>
    </div>
  );
}
