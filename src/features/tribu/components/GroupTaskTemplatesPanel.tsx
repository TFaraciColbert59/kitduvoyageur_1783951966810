'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import {
  listGroupTaskTemplates,
  applyTaskTemplate,
  type ClubTaskTemplate,
} from '@/features/tribu/actions/taskTemplates';

interface GroupTaskTemplatesPanelProps {
  groupId: string;
  clubId: string;
  onApplied?: () => void | Promise<void>;
}

/** Modeles de checklist du club d'origine, applicables au groupe. */
export default function GroupTaskTemplatesPanel({
  groupId,
  clubId,
  onApplied,
}: GroupTaskTemplatesPanelProps) {
  const [templates, setTemplates] = useState<ClubTaskTemplate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGroupTaskTemplates(clubId).then((result) => {
      if (cancelled || !result.ok) return;
      setTemplates(result.templates);
    });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const handleApply = async (templateId: string) => {
    setBusyId(templateId);
    setError(null);
    const result = await applyTaskTemplate({ groupId, templateId });
    setBusyId(null);
    if (result.ok) {
      await onApplied?.();
    } else {
      setError(result.error);
    }
  };

  if (templates.length === 0) return null;

  return (
    <Card className="p-[var(--space-4)]" data-testid="group-task-templates">
      <p className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-secondary)]">
        Modèles de checklist du club
      </p>
      <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between gap-[var(--space-3)]"
          >
            <span className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              {template.title}
              <span className="ml-[var(--space-1)] font-mono font-normal opacity-60">
                ({template.items.length})
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleApply(template.id)}
              disabled={busyId === template.id}
              className="shrink-0"
              data-testid="group-task-template-apply"
            >
              {busyId === template.id ? '…' : 'Appliquer'}
            </Button>
          </div>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-danger)]"
        >
          {error}
        </p>
      )}
    </Card>
  );
}
