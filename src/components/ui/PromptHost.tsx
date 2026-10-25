'use client';

import { useEffect, useState } from 'react';
import { PromptDialog } from './PromptDialog';
import { resolvePrompt, subscribePrompt, type PromptRequest } from './dialogs';

export default function PromptHost() {
  const [request, setRequest] = useState<PromptRequest | null>(null);

  useEffect(() => subscribePrompt(setRequest), []);

  return (
    <PromptDialog
      open={Boolean(request)}
      title={request?.title ?? ''}
      defaultValue={request?.defaultValue}
      placeholder={request?.placeholder}
      confirmLabel={request?.confirmLabel}
      onConfirm={(value) => resolvePrompt(value)}
      onCancel={() => resolvePrompt(null)}
    />
  );
}
