'use client';

import React from 'react';
import { PageLayout, type PageLayoutProps } from './PageLayout';

export type DashboardColumns = 1 | 2 | 3;

export interface DashboardPageLayoutProps extends PageLayoutProps {
  columns?: DashboardColumns;
}

const GRID: Record<DashboardColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

/**
 * DashboardPageLayout — tableau de bord : widgets en grille responsive
 * (1 colonne mobile, multi-colonnes tablette/desktop).
 */
export function DashboardPageLayout({
  columns = 2,
  contentClassName,
  children,
  ...props
}: DashboardPageLayoutProps) {
  return (
    <PageLayout
      {...props}
      width={props.width ?? 'content'}
      contentClassName={contentClassName}
    >
      <div className={`grid w-full gap-[var(--space-4)] ${GRID[columns]}`}>{children}</div>
    </PageLayout>
  );
}

export default DashboardPageLayout;
