'use client';

import React from 'react';

import Icon from './Icon';
import type { IconProps } from './Icon';

export type { IconProps };

/**
 * Legacy adapter — kept for backwards compatibility with the ~124 files that
 * import `AppIcon`. Delegates to the canonical `Icon` primitive using the PNG
 * mask pack (with Heroicons fallback).
 */
export default function AppIcon(props: IconProps) {
  return <Icon {...props} source="pack" />;
}
