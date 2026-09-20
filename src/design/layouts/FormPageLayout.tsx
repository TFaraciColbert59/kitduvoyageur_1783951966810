'use client';

import React from 'react';
import { PageActions } from '@/components/ui';
import { PageLayout, type PageLayoutProps } from './PageLayout';

export interface FormPageLayoutProps extends Omit<PageLayoutProps, 'actions'> {
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  /** Action de soumission principale (toujours en bas, pleine largeur). */
  submitAction?: React.ReactNode;
  /** Action secondaire (annuler, brouillon) à gauche de la principale. */
  secondaryAction?: React.ReactNode;
  /** Barre d'actions collée en bas (défaut) ou dans le flux. */
  stickyActions?: boolean;
}

/**
 * FormPageLayout — formulaire canonique : contenu + barre d'actions unique.
 * Même emplacement de validation sur tous les formulaires.
 */
export function FormPageLayout({
  onSubmit,
  submitAction,
  secondaryAction,
  stickyActions = true,
  children,
  ...props
}: FormPageLayoutProps) {
  const hasActions = Boolean(submitAction || secondaryAction);
  return (
    <PageLayout {...props}>
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col gap-[var(--space-4)]"
        noValidate={false}
      >
        {children}
        {hasActions && (
          <PageActions
            variant={stickyActions ? 'sticky' : 'inline'}
            align={secondaryAction ? 'between' : 'end'}
            fullWidth
          >
            {secondaryAction}
            {submitAction}
          </PageActions>
        )}
      </form>
    </PageLayout>
  );
}

export default FormPageLayout;
