'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, Card, EmptyState, ListItem } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
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

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

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
    <section className="space-y-[var(--space-4)]" data-testid="club-groups-tab">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div>
          <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
            Groupes du club
          </h2>
          <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
            Les groupes de voyage nés de {club?.name || 'ce club'} se gèrent dans le Hub.
          </p>
        </div>
        {isMember && (
          <Button
            type="button"
            onClick={() => setModalOpen(true)}
            icon={<Icon name="PlusIcon" size={14} aria-hidden="true" />}
            data-testid="club-groups-create-cta"
          >
            Créer un groupe de voyage
          </Button>
        )}
      </div>

      {!isMember && (
        <Card className="text-center">
          <EmptyState
            icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>🔒</span>}
            title="Réservé aux membres du club"
            description="Rejoignez le club pour voir ses groupes de voyage et en créer."
          />
        </Card>
      )}

      {isMember && groups.length === 0 && (
        <Card className="text-center">
          <EmptyState
            icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>🎒</span>}
            title="Aucun groupe de voyage pour le moment"
            description="Lancez le premier groupe du club et invitez vos compagnons."
          />
        </Card>
      )}

      {groups.length > 0 && (
        <div className={compact ? 'space-y-[var(--space-3)]' : 'grid gap-[var(--space-3)] sm:grid-cols-2'}>
          {groups.map((group: any) => {
            const departure = formatShortDate(group.departure_date);
            const ret = formatShortDate(group.return_date);
            const dates = departure
              ? ret
                ? `${departure} → ${ret}`
                : departure
              : null;
            return (
              <Card
                key={group.id}
                variant="interactive"
                as="article"
                onClick={() => onOpenGroup(group)}
                className="flex flex-col gap-[var(--space-2)] p-[var(--space-4)] text-left"
                data-testid="club-group-card"
              >
                <div className="flex items-start justify-between gap-[var(--space-2)]">
                  <h3 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                    {group.name}
                  </h3>
                  <Badge className="shrink-0 font-mono font-bold">
                    {group.visibility === 'club_only' ? 'Club' : 'Public'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
                  {group.destination && <span>📍 {group.destination}</span>}
                  {dates && <span className="font-mono">🗓️ {dates}</span>}
                </div>
                <span className="mt-auto text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                  Ouvrir dans le Hub →
                </span>
              </Card>
            );
          })}
        </div>
      )}

      {isMember && (
        <Card className="space-y-[var(--space-3)] p-[var(--space-4)]" data-testid="club-task-templates">
          <div>
            <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              Check-lists du club
            </h3>
            <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-secondary)]">
              Des modèles réutilisables, applicables en un tap dans les groupes du club.
            </p>
          </div>

          {templates.length > 0 && (
            <ul className="space-y-[var(--space-1)]">
              {templates.map((template) => (
                <ListItem
                  key={template.id}
                  title={<span className="text-[length:var(--lkv-text-caption-2)] font-bold">{template.title}</span>}
                  metadata={<span className="font-mono text-[length:var(--lkv-text-caption-2)]">{template.items.length} éléments</span>}
                />
              ))}
            </ul>
          )}

          <input
            type="text"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            maxLength={80}
            placeholder="Titre du modèle (ex. Bivouac été)"
            aria-label="Titre du modèle de check-list"
            className={FIELD_CLASS}
            data-testid="club-template-title"
          />
          <textarea
            value={templateItems}
            onChange={(e) => setTemplateItems(e.target.value)}
            rows={3}
            placeholder={'Un élément par ligne\nRéserver les refuges\nVérifier la météo'}
            aria-label="Éléments du modèle de check-list"
            className={`${FIELD_CLASS} resize-y`}
            data-testid="club-template-items"
          />
          <Button
            type="button"
            onClick={handlePublishTemplate}
            disabled={templateBusy}
            loading={templateBusy}
            data-testid="club-template-publish"
          >
            {templateBusy ? 'Publication…' : 'Publier le modèle'}
          </Button>
          {templateError && (
            <p role="alert" className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-danger)]">
              {templateError}
            </p>
          )}
        </Card>
      )}

      <Sheet
        open={modalOpen}
        onOpenChange={(v) => {
          if (!v && !submitting) setModalOpen(false);
        }}
        title="Nouveau groupe de voyage"
      >
        <div className="space-y-[var(--space-4)]">
          <label className="block space-y-[var(--space-1)]">
            <span className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-secondary)]">
              Nom du groupe
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={`Ex. Traversée des Écrins — ${club?.name || 'club'}`}
              className={FIELD_CLASS}
              data-testid="club-group-name-input"
            />
          </label>

          {invitableMembers.length > 0 && (
            <div className="space-y-[var(--space-1)]">
              <span className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-secondary)]">
                Inviter des membres ({selected.size})
              </span>
              <div className="max-h-56 space-y-[var(--space-1)] overflow-y-auto pr-[var(--space-1)]">
                {invitableMembers.map((member: any) => {
                  const label = member.user?.full_name || 'Membre du club';
                  const checked = selected.has(member.user_id);
                  return (
                    <Button
                      key={member.user_id}
                      type="button"
                      variant={checked ? 'primary' : 'secondary'}
                      fullWidth
                      onClick={() => toggleMember(member.user_id)}
                      className="justify-between"
                      aria-pressed={checked}
                    >
                      <span className="truncate">{label}</span>
                      <span aria-hidden>{checked ? '✓' : '+'}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-danger)]" role="alert">
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            loading={submitting}
            fullWidth
            data-testid="club-group-submit"
          >
            {submitting ? 'Création…' : 'Créer et ouvrir dans le Hub'}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
