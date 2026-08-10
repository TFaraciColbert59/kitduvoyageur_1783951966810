'use client';

import React from 'react';

export type TabType = 'missing' | 'ok' | 'ctx';

interface EquipmentTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  missingCount: number;
  okCount: number;
  ctxCount: number;
}

export const EquipmentTabs: React.FC<EquipmentTabsProps> = ({
  activeTab,
  onChange,
  missingCount,
  okCount,
  ctxCount,
}) => {
  return (
    <div className="tabs">
      <button
        onClick={() => onChange('missing')}
        className={activeTab === 'missing' ? 'on miss' : ''}
      >
        Il te manque <span className="cnt">{missingCount}</span>
      </button>
      <button
        onClick={() => onChange('ok')}
        className={activeTab === 'ok' ? 'on ok' : ''}
      >
        Suffisant <span className="cnt">{okCount}</span>
      </button>
      <button
        onClick={() => onChange('ctx')}
        className={activeTab === 'ctx' ? 'on warn' : ''}
      >
        Selon conditions <span className="cnt">{ctxCount}</span>
      </button>
    </div>
  );
};
