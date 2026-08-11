'use client';

import React from 'react';
import { getIconForCategory, Icon } from './PreparationIcons';

interface EquipmentOkItemProps {
  label: string;
  qty: number;
}

export const EquipmentOkItem: React.FC<EquipmentOkItemProps> = ({ label, qty }) => {
  const iconName = getIconForCategory(label);
  
  return (
    <div className="ok-item">
      <div className="ic">
        <Icon name={iconName} />
      </div>
      <div className="txt">
        <div className="n">{label}</div>
        <div className="q">× {qty}</div>
      </div>
      <div className="check">
        <Icon name="check" />
      </div>
    </div>
  );
};
