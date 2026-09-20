import React from 'react';
import { cn } from '@/lib/utils';

export type PageWidth = 'full' | 'content' | 'narrow';

export interface PageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Largeur maximale du contenu (centre automatiquement sur desktop). */
  width?: PageWidth;
  /** Marge d'écran canonique (--lkv-screen-margin). */
  padded?: boolean;
  as?: 'div' | 'main' | 'section';
}

/* Conteneur de page canonique — neutre, sans shell ni design final.
 * S'utilise à l'intérieur d'AppShell / MobilePageShell ou seul. */
const WIDTH: Record<PageWidth, string> = {
  full: 'w-full',
  content: 'mx-auto w-full max-w-5xl',
  narrow: 'mx-auto w-full max-w-3xl',
};

export function Page({
  width = 'content',
  padded = true,
  as: Component = 'div',
  className,
  children,
  ...props
}: PageProps) {
  return (
    <Component
      {...props}
      className={cn('relative w-full', WIDTH[width], padded && 'px-[var(--lkv-screen-margin)]', className)}
    >
      {children}
    </Component>
  );
}

export default Page;
