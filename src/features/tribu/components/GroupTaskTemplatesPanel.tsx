'use client';

import React, { useEffect, useState } from 'react';
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
    <div className="glass rounded-2xl p-4" data-testid="group-task-templates">
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
        Modèles de checklist du club
      </p>
      <div className="space-y-2 mt-3">
        {templates.map((template) => (
          <div key={template.id} className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-[var(--lkv-text-primary)] truncate">
              {template.title}
              <span className="ml-1 opacity-60 font-mono font-normal">
                ({template.items.length})
              </span>
            </span>
            <button
              type="button"
              onClick={() => handleApply(template.id)}
              disabled={busyId === template.id}
              className="glass-capsule-btn text-[10px] font-bold px-3 min-h-[36px] disabled:opacity-60 shrink-0"
              data-testid="group-task-template-apply"
            >
              <span className="relative z-10">
                {busyId === template.id ? '…' : 'Appliquer'}
              </span>
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[10px] font-bold text-[var(--lkv-danger)] mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
