'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';
import {
  countFieldErrors,
  errorCounterLabel,
  firstFieldError,
  focusFieldByName,
  parseServerError,
} from './errors';
import type { CreateNavV2 } from './nav';
import { createKindConfig, createStepsFor, stepIndexOfField } from './steps';
import { useDraftV2 } from './useDraftV2';
import type { CreateKindV2 } from './createSchemasV2';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/**
 * Moteur unique des six formulaires V2 (react-hook-form + zod).
 *
 * - **une seule validation par étape** (`Suivant` valide l'étape courante) ;
 * - chaque erreur est rendue **une seule fois**, sous son champ
 *   (`aria-describedby`) ; un compteur en tête (« 2 champs à corriger ») amène
 *   le focus au premier champ fautif sans répéter les messages ;
 * - l'erreur serveur est remontée une seule fois près du bouton (via `nav`) ;
 * - brouillon par type, bandeau « Brouillon restauré · Effacer » ;
 * - les flèches du clavier restent inertes dans un champ (elles ne changent ni
 *   d'étape ni de type de création) et Entrée ne soumet pas.
 */

export interface CreateFormEngineApiV2<T extends FieldValues> {
  form: UseFormReturn<T>;
  /** Étape courante (0-based). */
  step: number;
  setStep: (step: number) => void;
  /** Nombre de champs fautifs (compteur de tête). */
  errorCount: number;
  /** Efface le brouillon et remet le formulaire à neuf. */
  clearDraft: () => void;
  /** Nombre de médias en cours d'envoi (progression du pied). */
  uploadingCount: number;
}

export interface CreateFormEngineV2Props<T extends FieldValues> {
  kind: CreateKindV2;
  schema: z.ZodType<T>;
  defaultValues: DefaultValues<T>;
  /** Le type est-il celui affiché ? (le changement remet l'étape à 1). */
  active: boolean;
  /** Formulaire inactif (invité) : les champs restent lisibles, l'envoi est fermé. */
  disabled?: boolean;
  onSubmit: (values: T) => Promise<void>;
  /** Remonte le nav à la coque (pied, mini-capsule, erreur serveur). */
  onNavChange: (nav: CreateNavV2) => void;
  /** Libellé de progression des médias, si l'onglet en a. */
  busyLabel?: string | null;
  /** Nombre de médias non prêts (désactive l'envoi). */
  uploadingCount?: number;
  children: (api: CreateFormEngineApiV2<T>) => React.ReactNode;
}

export function CreateFormEngineV2<T extends FieldValues>({
  kind,
  schema,
  defaultValues,
  active,
  disabled = false,
  onSubmit,
  onNavChange,
  busyLabel = null,
  uploadingCount = 0,
  children,
}: CreateFormEngineV2Props<T>) {
  const config = createKindConfig(kind);
  const steps = createStepsFor(kind);
  const { haptic } = useHapticFeedback();
  const [step, setStepState] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const busyRef = useRef(false);
  const pendingFocus = useRef<string | null>(null);

  const form = useForm<T>({
    resolver: zodResolver(schema as never),
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const draft = useDraftV2<T>({ kind, form });

  const clearDraft = useCallback(() => {
    draft.clear();
    form.reset(defaultValues as never, { keepDefaultValues: false });
    setStepState(0);
    setServerError(null);
    setAttempted(false);
  }, [draft, defaultValues, form]);

  const setStep = useCallback((next: number) => {
    setStepState(Math.max(0, Math.min(steps.length - 1, next)));
    setServerError(null);
  }, [steps.length]);

  // Revenir sur un type remet ses étapes à zéro (les brouillons restent).
  useEffect(() => {
    if (!active) return;
    setStepState(0);
    setServerError(null);
    setAttempted(false);
  }, [active]);

  const focusField = useCallback(
    (field: string) => {
      const target = stepIndexOfField(kind, field);
      const root = field.split('.')[0] ?? field;
      if (target !== step) {
        pendingFocus.current = root;
        setStepState(target);
        return;
      }
      // Léger différé : la coque pose son focus initial dans la même frame.
      window.setTimeout(() => focusFieldByName(root), 40);
    },
    [kind, step],
  );

  // Le focus attend le rendu de l'étape cible.
  useEffect(() => {
    const name = pendingFocus.current;
    if (!name) return;
    pendingFocus.current = null;
    const timer = window.setTimeout(() => focusFieldByName(name), 30);
    return () => window.clearTimeout(timer);
  }, [step]);

  const errorCount = attempted ? countFieldErrors(form.formState.errors) : 0;

  /**
   * Valide **une seule étape** : le schéma est parsé une fois, puis seuls les
   * champs de l'étape sont reportés (une erreur par champ, sous son champ).
   * Les champs des autres étapes ne bloquent pas et n'affichent rien.
   */
  const validateStepAt = useCallback(
    async (index: number): Promise<boolean> => {
      const fields = steps[index]?.fields ?? [];
      setAttempted(true);
      if (fields.length === 0) return true;
      const roots = new Set(fields.map((field) => field.split('.')[0] ?? field));
      for (const field of fields) form.clearErrors(field as FieldPath<T>);
      const parsed = schema.safeParse(form.getValues());
      if (parsed.success) return true;
      const issues = parsed.error.issues.filter((issue) => roots.has(String(issue.path[0] ?? '')));
      if (issues.length === 0) return true;
      const seen = new Set<string>();
      for (const issue of issues) {
        const root = String(issue.path[0] ?? '');
        if (!root || seen.has(root)) continue;
        seen.add(root);
        form.setError(root as FieldPath<T>, { type: 'manual', message: issue.message });
      }
      const first = issues[0]?.path[0] ? String(issues[0].path[0]) : null;
      if (first) {
        haptic('light');
        focusField(first);
      }
      return false;
    },
    [focusField, form, haptic, schema, steps],
  );

  const validateCurrentStep = useCallback(() => validateStepAt(step), [step, validateStepAt]);

  const submitAll = useCallback(() => {
    void form.handleSubmit(
      async (values) => {
        if (busyRef.current) return;
        const pending = uploadingCount > 0;
        if (pending) {
          // Les médias ne sont pas prêts : rien ne part, le message est unique.
          setServerError('Attends la fin de l’envoi des médias.');
          return;
        }
        busyRef.current = true;
        setBusy(true);
        setServerError(null);
        try {
          await onSubmit(values);
          haptic('success');
          draft.clear();
          form.reset(defaultValues as never, { keepDefaultValues: false });
          setStepState(0);
          setAttempted(false);
        } catch (error) {
          const info = parseServerError(error);
          setAttempted(true);
          setServerError(info.message);
          if (info.field) {
            const root = info.field.split('.')[0] ?? info.field;
            focusField(root);
          }
          haptic('medium');
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      },
      (errors) => {
        setAttempted(true);
        const first = firstFieldError(errors);
        if (first) {
          haptic('light');
          focusField(first.root);
        }
      },
    )();
  }, [defaultValues, draft, focusField, form, haptic, onSubmit, uploadingCount]);

  const goNext = useCallback(() => {
    if (busyRef.current) return;
    void (async () => {
      const ok = await validateCurrentStep();
      if (!ok) return;
      if (step < steps.length - 1) {
        haptic('light');
        setStepState(step + 1);
      } else {
        submitAll();
      }
    })();
  }, [haptic, step, steps.length, submitAll, validateCurrentStep]);

  const goBack = useCallback(() => {
    if (busyRef.current) return;
    if (step <= 0) return;
    haptic('light');
    setStepState(step - 1);
    setServerError(null);
  }, [haptic, step]);

  const goToStep = useCallback(
    (target: number) => {
      if (busyRef.current) return;
      const bounded = Math.max(0, Math.min(steps.length - 1, target));
      if (bounded === step) return;
      if (bounded < step) {
        haptic('light');
        setStepState(bounded);
        setServerError(null);
        return;
      }
      void (async () => {
        // Une étape en avant exige la validation de l'étape courante.
        const ok = await validateStepAt(step);
        if (!ok) return;
        haptic('light');
        setStepState(bounded);
      })();
    },
    [haptic, step, steps.length, validateStepAt],
  );

  const nav = useMemo<CreateNavV2>(
    () => ({
      kind,
      stepIndex: step,
      stepCount: steps.length,
      stepLabels: steps.map((entry) => entry.label),
      canBack: step > 0,
      busy,
      busyLabel: busy ? 'Envoi…' : busyLabel,
      finalLabel: config.finalLabel,
      serverError,
      hasContent: draft.hasContent,
      goBack,
      goNext,
      goToStep,
      flushDraft: draft.flush,
    }),
    [
      busy,
      busyLabel,
      config.finalLabel,
      draft.flush,
      draft.hasContent,
      goBack,
      goNext,
      goToStep,
      kind,
      serverError,
      step,
      steps,
    ],
  );

  useEffect(() => {
    onNavChange(nav);
  }, [nav, onNavChange]);

  const api: CreateFormEngineApiV2<T> = {
    form,
    step,
    setStep,
    errorCount,
    clearDraft,
    uploadingCount,
  };

  const summary = errorCount > 0 ? (
    <button
      type="button"
      className="lkdv-cv2-error-summary lkdv-cv2c-error-summary"
      onClick={() => {
        const first = firstFieldError(form.formState.errors);
        if (first) focusField(first.path);
      }}
      aria-label={`${errorCounterLabel(errorCount)}. Aller au premier champ à corriger.`}
      data-testid="cv2c-error-summary"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
        <path
          d="M12 4l9 16H3zM12 10v4M12 17v.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {errorCounterLabel(errorCount)}
    </button>
  ) : null;

  return (
    <form
      noValidate
      className="lkdv-cv2c-form"
      data-kind={kind}
      data-step={step}
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement | null;
        const editable =
          !!target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);
        // Les flèches restent dans le champ : ni changement d'étape/type, ni LensPager.
        if (editable && (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End')) {
          event.stopPropagation();
          return;
        }
        // Entrée dans un champ ne publie pas : seule l'action finale le fait.
        if (editable && event.key === 'Enter' && target?.tagName !== 'TEXTAREA') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {draft.restored ? (
        <div className="lkdv-cv2-draft lkdv-cv2c-draft" data-testid="cv2c-draft-banner">
          <span>Brouillon restauré</span>
          <button type="button" onClick={clearDraft}>
            Effacer
          </button>
        </div>
      ) : null}
      {summary}
      <FormProvider {...form}>
        <fieldset className="lkdv-cv2c-pane" disabled={disabled || busy}>
          {children(api)}
        </fieldset>
      </FormProvider>
    </form>
  );
}

export default CreateFormEngineV2;
