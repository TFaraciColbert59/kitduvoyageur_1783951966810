'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type DefaultValues,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';
import { createSchemas, type CreateKind } from './createSchemas';
import { useCreateDraft, setCreateDraftSubmitting } from './useCreateDraft';
import {
  findStepForField,
  firstErrorField,
  rootFieldName,
} from '../shared/stepErrors';

export interface CreateFormEngineApi {
  /** Valide puis soumet une seule fois (footer de la dernière étape). */
  submit: () => void;
  /** Bascule sur l’étape fautive puis focalise le champ. */
  focusField: (name: string) => void;
  /** Efface le brouillon local (appelé automatiquement après succès). */
  clearDraft: () => void;
  flushDraft: () => void;
  draftRestored: boolean;
  hasDraftContent: boolean;
}

export interface CreateFormEngineProps<T extends FieldValues> {
  kind: CreateKind;
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => Promise<void> | void;
  children: (form: UseFormReturn<T>, api: CreateFormEngineApi) => React.ReactNode;
  /** Remonte l’erreur serveur au parent (toast, footer, etc.). */
  onError?: (message: string, error: unknown) => void;
  /** Remet les valeurs initiales après une soumission réussie. */
  resetOnSuccess?: boolean;
  className?: string;
  /** Clé de brouillon local. Les six formulaires transmettent leur type. */
  draftKey?: string;
  /** Découpage des champs par étape, pour router le focus des erreurs. */
  stepFields?: readonly (readonly string[])[];
  /** Étape courante pilotée par le formulaire. */
  step?: number;
  onStepChange?: (step: number) => void;
  /** Délai de sauvegarde du brouillon (les tests le réduisent). */
  draftDebounceMs?: number;
}

function focusDomField(name: string) {
  if (typeof document === 'undefined') return;
  const root = rootFieldName(name);
  const escaped = root.replace(/["\\]/g, '\\$&');
  const element =
    document.getElementById(root) ??
    document.getElementById(name) ??
    document.querySelector<HTMLElement>(`[name="${escaped}"]`) ??
    document.querySelector<HTMLElement>(`[data-field="${escaped}"]`) ??
    document.querySelector<HTMLElement>(`[id^="${escaped}-"]`);
  element?.focus();
}

/**
 * Moteur unique des six formulaires de création.
 *
 * - React Hook Form + `zodResolver`, mode `onTouched` ;
 * - le schéma est choisi par `kind` (règles conditionnelles incluses) ;
 * - une erreur de soumission est rendue en `role="alert"` sans perdre la
 *   saisie, et remontée via `onError` ;
 * - le brouillon local est restauré au montage, sauvegardé en debounce,
 *   effacé après succès ;
 * - une erreur de validation bascule d’abord sur son étape (les panes
 *   inactives sont `inert`) puis focalise le champ ;
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
  draftKey,
  stepFields,
  step,
  onStepChange,
  draftDebounceMs,
}: CreateFormEngineProps<T>) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<T>({
    resolver: zodResolver(createSchemas[kind] as never) as Resolver<T>,
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const draft = useCreateDraft<T>({
    kind,
    draftKey: draftKey ?? '__no-draft__',
    form,
    enabled: Boolean(draftKey),
    debounceMs: draftDebounceMs,
  });

  const currentStep = step ?? 0;
  const pendingFocus = useRef<string | null>(null);

  const runFocus = useCallback(
    (name: string) => {
      const root = rootFieldName(name);
      try {
        form.setFocus(root as FieldPath<T>, { shouldSelect: false });
      } catch {
        // Champ non enregistré (média contrôlé, etc.) : le repli DOM suffit.
      }
      focusDomField(root);
    },
    [form],
  );

  const focusField = useCallback(
    (name: string) => {
      if (!name) return;
      if (stepFields && onStepChange) {
        const target = findStepForField(stepFields, name);
        if (target >= 0 && target !== currentStep) {
          pendingFocus.current = name;
          onStepChange(target);
          return;
        }
      }
      runFocus(name);
    },
    [currentStep, onStepChange, runFocus, stepFields],
  );

  // Le focus attend le rendu qui a retiré `inert` de la pane cible.
  useEffect(() => {
    const name = pendingFocus.current;
    if (!name) return;
    pendingFocus.current = null;
    const timer = window.setTimeout(() => runFocus(name), 0);
    return () => window.clearTimeout(timer);
  }, [currentStep, runFocus]);

  const handleValid = useCallback(
    async (values: T) => {
      setServerError(null);
      setCreateDraftSubmitting(draftKey, true);
      try {
        await onSubmit(values);
        draft.clear();
        if (resetOnSuccess) form.reset(defaultValues);
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Enregistrement impossible pour le moment.';
        setServerError(message);
        form.setError('root.server' as FieldPath<T>, { type: 'server', message });
        onError?.(message, error);
      } finally {
        setCreateDraftSubmitting(draftKey, false);
      }
    },
    [defaultValues, draft, draftKey, form, onError, onSubmit, resetOnSuccess],
  );

  const submit = form.handleSubmit(handleValid, (errors: FieldErrors<T>) => {
    const first = firstErrorField(errors);
    if (first) focusField(first);
  });

  const api = useMemo<CreateFormEngineApi>(
    () => ({
      submit: () => {
        void submit();
      },
      focusField,
      clearDraft: draft.clear,
      flushDraft: draft.flush,
      draftRestored: draft.restored,
      hasDraftContent: draft.hasContent,
    }),
    [draft.clear, draft.flush, draft.hasContent, draft.restored, focusField, submit],
  );

  return (
    <form
      noValidate
      className={`lkdv-create-engine ${className}`.trim()}
      data-create-kind={kind}
      onSubmit={submit}
    >
      {children(form, api)}
      {serverError ? (
        <p className="lkdv-create-engine-error" role="alert">
          {serverError}
        </p>
      ) : null}
    </form>
  );
}

export default CreateFormEngine;
