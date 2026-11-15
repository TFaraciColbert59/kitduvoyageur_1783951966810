import React from 'react';

import type { ConnectorTone } from '@/lib/connectors/types';

export function ConnectorAvailabilityBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: ConnectorTone;
  className?: string;
}) {
  return (
    <span className={['cn-badge', className].filter(Boolean).join(' ')} data-tone={tone}>
      {label}
    </span>
  );
}

export default ConnectorAvailabilityBadge;
