'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, Send, Trash2 } from 'lucide-react';
import {
  OUTING_AUDIENCE_CONTRACT_NOTE,
  type StoredOutingVisibility,
} from '@/features/compte/domain/outingAudience';
import { outingVisibilityErrorMessage } from '@/features/compte/client/outingVisibility';
import { DrawerButton, OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { createClient } from '@/lib/supabase/client';
import type { ShareAudience } from '@/features/community/g01/contracts';
import type { ActivityShareMeta } from '@/features/community/g01/activityShare';
import { OutingAudienceOptions } from './OutingAudienceOptions';

export interface OutingAudienceSheetProps {
  open: boolean;
  outingId?: string;
  canEdit?: boolean;
  title: string;
  /** Résumé local affiché avant l'écriture ; il n'est jamais publié. */
  summary?: string;
  current: StoredOutingVisibility;
  onClose: () => void;
  onApply: (next: StoredOutingVisibility) => Promise<void>;
  /** Appelé uniquement après une écriture réussie. */
  onApplied?: () => void;
}

interface ClubChoice {
  id: string;
  name: string;
}

const SHARE_AUDIENCES: Array<{ id: ShareAudience; label: string }> = [
  { id: 'public', label: 'Public' },
  { id: 'abonnies', label: 'Abonnés' },
  { id: 'club', label: 'Club' },
];

/**
 * Sous-drawer « Partager » d'une sortie. Le choix d'audience est explicite et
 * l'écriture n'est confirmée qu'après la réponse du PATCH existant. Les
 * audiences que le serveur ne porte pas restent visibles, désactivées, avec
 * leur raison.
 */
export function OutingAudienceSheet({
  open,
  outingId,
  canEdit = false,
  title,
  summary,
  current,
  onClose,
  onApply,
  onApplied,
}: OutingAudienceSheetProps) {
  const [draft, setDraft] = useState<StoredOutingVisibility>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shareState, setShareState] = useState<{ postId: string; meta: ActivityShareMeta } | null>(null);
  const [shareAudience, setShareAudience] = useState<ShareAudience>('abonnies');
  const [shareClubId, setShareClubId] = useState<string>('');
  const [shareClubs, setShareClubs] = useState<ClubChoice[]>([]);
  const [shareCaption, setShareCaption] = useState<string>('');
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const loadShareState = useCallback(async () => {
    if (!open || !outingId || !canEdit) return;
    try {
      const res = await fetch(`/api/compte/sorties/${encodeURIComponent(outingId)}/share`, {
        headers: { accept: 'application/json' },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          share?: { postId: string; meta: ActivityShareMeta } | null;
        };
        setShareState(json.share ?? null);
      }
    } catch {
      /* ignore */
    }
  }, [open, outingId, canEdit]);

  useEffect(() => {
    if (!open) return;
    setDraft(current);
    setError(null);
    setBusy(false);
    setShareStatus(null);
    void loadShareState();

    if (outingId && canEdit) {
      const supabase = createClient();
      void supabase.auth.getUser().then(async ({ data: auth }) => {
        if (!auth.user) return;
        const { data: rows } = await supabase
          .from('club_members')
          .select('club_id, clubs(id, name)')
          .eq('user_id', auth.user.id)
          .eq('status', 'active')
          .limit(20);
        const choices: ClubChoice[] = [];
        for (const r of (rows ?? []) as Array<{ club_id?: string; clubs?: { id?: string; name?: string } | Array<{ id?: string; name?: string }> | null }>) {
          const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs;
          if (c?.id && c?.name) choices.push({ id: c.id, name: c.name });
        }
        setShareClubs(choices);
        if (choices.length > 0 && !shareClubId) setShareClubId(choices[0].id);
      });
    }
  }, [open, current, outingId, canEdit, loadShareState]);

  const publishFeedShare = async () => {
    if (!outingId || shareBusy) return;
    if (shareAudience === 'club' && !shareClubId) {
      setError('Sélectionne un club actif pour publier dans son fil.');
      return;
    }
    setShareBusy(true);
    setError(null);
    setShareStatus(null);
    try {
      const res = await fetch(`/api/compte/sorties/${encodeURIComponent(outingId)}/share`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          audience: shareAudience,
          clubId: shareAudience === 'club' ? shareClubId : null,
          allowLikes,
          allowComments,
          caption: shareCaption.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        share?: { postId: string; meta: ActivityShareMeta };
        error?: string;
      } | null;
      if (!res.ok || !json?.share) {
        throw new Error(json?.error || 'Publication impossible.');
      }
      setShareState(json.share);
      setShareCaption('');
      setShareStatus('Sortie publiée dans le fil Communauté.');
      onApplied?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Publication impossible.');
    } finally {
      setShareBusy(false);
    }
  };

  const revokeFeedShare = async () => {
    if (!outingId || shareBusy) return;
    setShareBusy(true);
    setError(null);
    setShareStatus(null);
    try {
      const res = await fetch(`/api/compte/sorties/${encodeURIComponent(outingId)}/share`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || 'Révocation impossible.');
      }
      setShareState(null);
      setShareStatus('Publication retirée du fil Communauté.');
      onApplied?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Révocation impossible.');
    } finally {
      setShareBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  const submit = async () => {
    if (busy || draft === current) return;
    setBusy(true);
    setError(null);
    try {
      await onApply(draft);
      onApplied?.();
    } catch (cause) {
      setError(outingVisibilityErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <OverlaySheet
      title="Partager cette sortie"
      subtitle={title}
      onClose={close}
      nested
      footer={
        <div className="flex items-center justify-end gap-2">
          <DrawerButton tone="ghost" onClick={close} disabled={busy}>
            Annuler
          </DrawerButton>
          <DrawerButton
            tone="primary"
            onClick={() => void submit()}
            disabled={busy || draft === current}
            aria-busy={busy ? 'true' : undefined}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </DrawerButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12.5px] leading-snug text-[color:var(--label2)]">
          Choisis l’audience à enregistrer pour cette sortie. Seules les valeurs
          portées par le serveur sont applicables ; l’écriture est confirmée
          avant tout message de succès.
        </p>

        <div className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2">
          <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--label2)]">
            Aperçu local — non publié
          </p>
          <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-[color:var(--label)]">
            {title}
          </p>
          {summary ? (
            <p className="m-0 text-[11.5px] text-[color:var(--label2)]">{summary}</p>
          ) : null}
        </div>

        <OutingAudienceOptions
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setError(null);
          }}
          disabled={busy}
        />

        {error ? (
          <p
            role="alert"
            className="m-0 flex items-start gap-2 rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-danger-bg)] px-3 py-2 text-[12px] leading-snug text-[color:var(--lkv-danger)]"
          >
            <CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <p className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[11.5px] leading-snug text-[color:var(--label2)]">
          {OUTING_AUDIENCE_CONTRACT_NOTE}
        </p>

        <OutingAudienceMatrix />

        {outingId && canEdit ? (
          <section
            aria-label="Publier dans le fil Communauté"
            className="flex flex-col gap-2.5 rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-[12.5px] font-semibold text-[color:var(--label)]">
                Fil Communauté (statistiques sans trace GPS)
              </strong>
              {shareState ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#17402C] px-2 py-0.5 text-[10.5px] font-semibold text-white">
                  <Check size={11} aria-hidden="true" /> Publiée ({shareState.meta.audience})
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Audience dans le fil">
              {SHARE_AUDIENCES.map((aud) => (
                <button
                  key={aud.id}
                  type="button"
                  disabled={shareBusy}
                  aria-pressed={shareAudience === aud.id}
                  onClick={() => setShareAudience(aud.id)}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${
                    shareAudience === aud.id
                      ? 'bg-[#17402C] text-white'
                      : 'bg-white/70 text-[color:var(--label)]'
                  }`}
                >
                  {aud.label}
                </button>
              ))}
            </div>

            {shareAudience === 'club' ? (
              shareClubs.length > 0 ? (
                <select
                  aria-label="Club cible"
                  value={shareClubId}
                  onChange={(e) => setShareClubId(e.target.value)}
                  disabled={shareBusy}
                  className="rounded-[10px] border border-[color:var(--glass-border)] bg-white/80 px-2.5 py-1.5 text-[12px] text-[color:var(--label)]"
                >
                  {shareClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="m-0 text-[11px] text-[color:var(--label2)]">
                  Rejoins un club pour y publier une sortie.
                </p>
              )
            ) : null}

            <input
              type="text"
              value={shareCaption}
              onChange={(e) => setShareCaption(e.target.value)}
              disabled={shareBusy}
              maxLength={300}
              placeholder="Ajouter un mot sur ta sortie (optionnel)"
              aria-label="Légende du partage"
              className="rounded-[10px] border border-[color:var(--glass-border)] bg-white/80 px-2.5 py-1.5 text-[12px] text-[color:var(--label)]"
            />

            <div className="flex flex-wrap gap-3 text-[11.5px] text-[color:var(--label2)]">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={allowLikes}
                  onChange={(e) => setAllowLikes(e.target.checked)}
                  disabled={shareBusy}
                />
                Autoriser les bravo
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  disabled={shareBusy}
                />
                Autoriser les commentaires
              </label>
            </div>

            {shareStatus ? (
              <p className="m-0 text-[11.5px] font-medium text-[#17402C]" role="status">
                {shareStatus}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <DrawerButton
                tone="primary"
                onClick={() => void publishFeedShare()}
                disabled={shareBusy || (shareAudience === 'club' && !shareClubId)}
              >
                <Send size={13} aria-hidden="true" />
                {shareBusy ? 'Publication…' : shareState ? 'Mettre à jour dans le fil' : 'Publier dans le fil'}
              </DrawerButton>
              {shareState ? (
                <DrawerButton
                  tone="ghost"
                  onClick={() => void revokeFeedShare()}
                  disabled={shareBusy}
                >
                  <Trash2 size={13} aria-hidden="true" /> Retirer du fil
                </DrawerButton>
              ) : null}
            </div>
          </section>
        ) : (
          <p className="m-0 text-[11.5px] leading-snug text-[color:var(--label2)]">
            Partage externe indisponible : aucune route publique ni jeton de
            partage de sortie n’existe. Ce panneau ne fabrique pas de lien et ne
            présente pas l’URL du Compte comme un partage de la sortie.
          </p>
        )}
      </div>
    </OverlaySheet>
  );
}

/**
 * Matrice de droits réellement appliquée par le schéma actuel. Elle sert de
 * preuve lisible dans le drawer, pas de promesse sur une audience future.
 */
export function OutingAudienceMatrix() {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] text-[11px] leading-snug text-[color:var(--label2)]">
      <caption className="pb-1 text-left text-[11px] font-semibold text-[color:var(--label2)]">
        Droits appliqués aujourd’hui
      </caption>
      <thead>
        <tr>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            Audience
          </th>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            Lecture
          </th>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            Contrat
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Propriétaire
          </th>
          <td className="px-2 py-1.5">Oui</td>
          <td className="px-2 py-1.5">user_id = auth.uid()</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Mes abonnés
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Pas de policy par abonné</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Public
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Pas de policy directe</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Tiers bloqué
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Pas de lecture via cette audience</td>
        </tr>
        <tr className="border-t border-[color:var(--glass-border)]">
          <th scope="row" className="px-2 py-1.5 text-left font-medium text-[color:var(--label)]">
            Collectif anonymisé
          </th>
          <td className="px-2 py-1.5">Non</td>
          <td className="px-2 py-1.5">Aucune vue par cette valeur</td>
        </tr>
      </tbody>
    </table>
  );
}

export default OutingAudienceSheet;
