'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  publishTaskTemplate,
  listGroupTaskTemplates,
  type ClubTaskTemplate,
} from '@/features/tribu/actions/taskTemplates';

interface ClubGroupsTabProps {
  club: any;
  groups: any[];
  members: any[];
  user: any;
  isMember: boolean;
  compact?: boolean;
  onCreate: (name: string, memberIds: string[]) => Promise<{ ok: boolean; error?: string }>;
  onOpenGroup: (group: any) => void | Promise<void>;
}

function formatShortDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function ClubGroupsTab({
  club,
  groups,
  members,
  user,
  isMember,
  compact = false,
  onCreate,
  onOpenGroup,
}: ClubGroupsTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ClubTaskTemplate[]>([]);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateItems, setTemplateItems] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    if (!club?.id || !isMember) return;
    let cancelled = false;
    listGroupTaskTemplates(club.id).then((result) => {
      if (cancelled || !result.ok) return;
      setTemplates(result.templates.filter((t) => t.clubId === club.id));
    });
    return () => {
      cancelled = true;
    };
  }, [club?.id, isMember]);

  const handlePublishTemplate = async () => {
    const items = templateItems
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!club?.id || !templateTitle.trim() || items.length === 0) {
      setTemplateError('Renseignez un titre et au moins un élément (une ligne par élément).');
      return;
    }
    setTemplateBusy(true);
    setTemplateError(null);
    const result = await publishTaskTemplate({
      clubId: club.id,
      title: templateTitle.trim(),
      items,
    });
    setTemplateBusy(false);
    if (!result.ok) {
      setTemplateError(result.error);
      return;
    }
    setTemplateTitle('');
    setTemplateItems('');
    const refreshed = await listGroupTaskTemplates(club.id);
    if (refreshed.ok) setTemplates(refreshed.templates.filter((t) => t.clubId === club.id));
  };

  const invitableMembers = useMemo(
    () =>
      (members || []).filter(
        (m: any) => m.user_id && m.user_id !== user?.id && m.status !== 'banned'
      ),
    [members, user?.id]
  );

  const toggleMember = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Donnez un nom au groupe.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await onCreate(trimmed, Array.from(selected));
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Création impossible pour le moment.');
      return;
    }
    setModalOpen(false);
    setName('');
    setSelected(new Set());
  };

  return (
    <section className="space-y-4" data-testid="club-groups-tab">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-lg text-[var(--lkv-text-primary)]">
            Groupes du club
          </h2>
          <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
            Les groupes de voyage nés de {club?.name || 'ce club'} se gèrent dans le Hub.
          </p>
        </div>
        {isMember && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="glass-capsule-btn primary py-2 px-4 text-xs font-bold min-h-[44px]"
            data-testid="club-groups-create-cta"
          >
            <Icon name="PlusIcon" size={14} className="inline mr-1 relative z-10" />
            <span className="relative z-10">Créer un groupe de voyage</span>
          </button>
        )}
      </div>

      {!isMember && (
        <div className="glass rounded-2xl p-6 text-center">
          <span className="text-2xl block mb-1">🔒</span>
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
            Réservé aux membres du club
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)] mt-1">
            Rejoignez le club pour voir ses groupes de voyage et en créer.
          </p>
        </div>
      )}

      {isMember && groups.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <span className="text-2xl block mb-1">🎒</span>
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
            Aucun groupe de voyage pour le moment
          </p>
          <p className="text-xs text-[var(--lkv-text-secondary)] mt-1">
            Lancez le premier groupe du club et invitez vos compagnons.
          </p>
        </div>
      )}

      {groups.length > 0 && (
        <div className={compact ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>
          {groups.map((group: any) => {
            const departure = formatShortDate(group.departure_date);
            const ret = formatShortDate(group.return_date);
            const dates = departure
              ? ret
                ? `${departure} → ${ret}`
                : departure
              : null;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onOpenGroup(group)}
                className="glass rounded-2xl p-4 text-left flex flex-col gap-2 min-h-[44px] transition-all hover:shadow-md"
                data-testid="club-group-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold text-sm text-[var(--lkv-text-primary)] truncate">
                    {group.name}
                  </h3>
                  <span className="glass-pill text-[9px] font-mono font-bold shrink-0">
                    {group.visibility === 'club_only' ? 'Club' : 'Public'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--lkv-text-secondary)] flex-wrap">
                  {group.destination && <span>📍 {group.destination}</span>}
                  {dates && <span className="font-mono">🗓️ {dates}</span>}
                </div>
                <span className="text-xs font-bold text-[var(--lkv-text-primary)] mt-auto">
                  Ouvrir dans le Hub →
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isMember && (
        <div className="glass rounded-2xl p-4 space-y-3" data-testid="club-task-templates">
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--lkv-text-primary)]">
              Check-lists du club
            </h3>
            <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
              Des modèles réutilisables, applicables en un tap dans les groupes du club.
            </p>
          </div>

          {templates.length > 0 && (
            <ul className="space-y-1.5">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-3 text-xs text-[var(--lkv-text-secondary)]"
                >
                  <span className="font-bold text-[var(--lkv-text-primary)] truncate">
                    {template.title}
                  </span>
                  <span className="font-mono text-[10px] shrink-0">
                    {template.items.length} éléments
                  </span>
                </li>
              ))}
            </ul>
          )}

          <input
            type="text"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            maxLength={80}
            placeholder="Titre du modèle (ex. Bivouac été)"
            className="w-full glass-input rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            data-testid="club-template-title"
          />
          <textarea
            value={templateItems}
            onChange={(e) => setTemplateItems(e.target.value)}
            rows={3}
            placeholder={'Un élément par ligne\nRéserver les refuges\nVérifier la météo'}
            className="w-full glass-input rounded-xl px-3 py-2.5 text-sm"
            data-testid="club-template-items"
          />
          <button
            type="button"
            onClick={handlePublishTemplate}
            disabled={templateBusy}
            className="glass-capsule-btn py-2.5 px-4 text-xs font-bold min-h-[44px] disabled:opacity-60"
            data-testid="club-template-publish"
          >
            <span className="relative z-10">
              {templateBusy ? 'Publication…' : 'Publier le modèle'}
            </span>
          </button>
          {templateError && (
            <p role="alert" className="text-xs font-bold text-[var(--lkv-danger)]">
              {templateError}
            </p>
          )}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Créer un groupe de voyage"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => (submitting ? null : setModalOpen(false))}
          />
          <div className="relative w-full max-w-md glass-panel rounded-[var(--lkv-radius-card)] p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[var(--lkv-text-primary)]">
                Nouveau groupe de voyage
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-11 h-11 rounded-full glass-icon-btn flex items-center justify-center"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--lkv-text-secondary)]">
                Nom du groupe
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder={`Ex. Traversée des Écrins — ${club?.name || 'club'}`}
                className="w-full glass-input rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                data-testid="club-group-name-input"
              />
            </label>

            {invitableMembers.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[var(--lkv-text-secondary)]">
                  Inviter des membres ({selected.size})
                </span>
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {invitableMembers.map((member: any) => {
                    const label = member.user?.full_name || 'Membre du club';
                    const checked = selected.has(member.user_id);
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => toggleMember(member.user_id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all min-h-[44px] ${
                          checked
                            ? 'bg-lkv-primary/10 text-lkv-primary border border-lkv-primary'
                            : 'glass-sub-card text-[var(--lkv-text-secondary)] border border-transparent'
                        }`}
                        aria-pressed={checked}
                      >
                        <span className="truncate">{label}</span>
                        <span aria-hidden>{checked ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs font-bold text-[var(--lkv-danger)]" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="glass-capsule-btn primary w-full py-3 text-sm font-bold min-h-[44px] disabled:opacity-60"
              data-testid="club-group-submit"
            >
              <span className="relative z-10">
                {submitting ? 'Création…' : 'Créer et ouvrir dans le Hub'}
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
