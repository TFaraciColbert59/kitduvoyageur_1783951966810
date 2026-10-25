'use client';

import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';
import { createSchemas, type CreateKind } from './createSchemas';

export interface CreateFormEngineProps<T extends FieldValues> {
  kind: CreateKind;
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => Promise<void> | void;
  children: (form: UseFormReturn<T>) => React.ReactNode;
  /** Remonte l’erreur serveur au parent (toast, footer, etc.). */
  onError?: (message: string, error: unknown) => void;
  /** Remet les valeurs initiales après une soumission réussie. */
  resetOnSuccess?: boolean;
  className?: string;
}

/**
 * Moteur unique des six formulaires de création.
 *
 * - React Hook Form + `zodResolver`, mode `onTouched` ;
 * - le schéma est choisi par `kind` (règles conditionnelles incluses) ;
 * - une erreur de soumission est rendue en `role="alert"` sans perdre la
 *   saisie, et remontée via `onError` ;
 * - le rendu est un render prop : chaque formulaire garde sa mise en page et
 *   son footer.
 */
export function CreateFormEngine<T extends FieldValues>({
  kind,
  defaultValues,
  onSubmit,
  children,
  onError,
  resetOnSuccess = false,
  className = '',
}: CreateFormEngineProps<T>) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<T>({
    resolver: zodResolver(createSchemas[kind] as z.ZodType<T>) as unknown as Resolver<T>,
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit(values);
      if (resetOnSuccess) form.reset(defaultValues);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Enregistrement impossible pour le moment.';
      setServerError(message);
      form.setError('root.server' as FieldPath<T>, { type: 'server', message });
      onError?.(message, error);
    }
  });

  return (
    <form
      noValidate
      className={`lkdv-create-engine ${className}`.trim()}
      data-create-kind={kind}
      onSubmit={submit}
    >
      {children(form)}
      {serverError ? (
        <p className="lkdv-create-engine-error" role="alert">
          {serverError}
        </p>
      ) : null}
    </form>
  );
}

export default CreateFormEngine;
