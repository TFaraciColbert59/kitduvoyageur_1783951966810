'use client';

import React from 'react';
import {
  SegmentedControl,
  type SegmentedControlItem,
  type SegmentedControlProps,
} from './SegmentedControl';

export type CapsuleTabItem = SegmentedControlItem;
export type CapsuleTabsProps = SegmentedControlProps;

/**
 * CapsuleTabs — Capsule principale (48 px) ou secondaire (30 px) LKDV Apple Liquid Glass.
 * Délégué vers la primitive canonique SegmentedControl (Lot 2).
 */
export function CapsuleTabs(props: CapsuleTabsProps) {
  return <SegmentedControl {...props} />;
}

export type SubCapsuleTabsProps = Omit<CapsuleTabsProps, 'size'>;

/**
 * SubCapsuleTabs — Capsule secondaire compacte 30 px avec lentille fluide.
 */
export function SubCapsuleTabs(props: SubCapsuleTabsProps) {
  return <SegmentedControl size="sm" {...props} />;
}

export default CapsuleTabs;
export { SegmentedControl };
