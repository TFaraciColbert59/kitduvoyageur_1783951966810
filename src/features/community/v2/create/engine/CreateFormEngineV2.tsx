'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { mediaUploadState, type CreateKindV2 } from './createSchemasV2';
import { ConfirmDialogV2 } from '../ConfirmDialogV2';
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
  /** Cette étape est-elle la page affichée ? (allège les aperçus lourds) */
  active: boolean;
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
  /**
   * Hôtes des pages d'étapes fournies par la coque (`mini.pages`) : le moteur
   * **porte** le contenu de chaque étape dans sa page, une seule instance de
   * formulaire. Sans cette prop, le formulaire rend ses étapes en ligne.
   */
  stepHosts?: (HTMLElement | null)[] | null;
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
  stepHosts = null,
  children,
}: CreateFormEngineV2Props<T>) {
  const portalMode = Boolean(stepHosts);
  const config = createKindConfig(kind);
  const steps = createStepsFor(kind);
  const { haptic } = useHapticFeedback();
  const [step, setStepState] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  /** FID-034 : « Effacer » passe par la confirmation de la maquette. */
  const [confirmClear, setConfirmClear] = useState(false);
  const [, setHostTick] = useState(0);
  const busyRef = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  /** Étape lue dans le brouillon : appliquée une fois, au montage (N1). */
  const restoredStepRef = useRef<number | null>(null);
  const wasActiveRef = useRef(active);

  const form = useForm<T>({
    resolver: zodResolver(schema as never),
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const draftStep = useCallback((index: number) => {
    restoredStepRef.current = index;
  }, []);
  const draft = useDraftV2<T>({ kind, form, step, onRestoreStep: draftStep });

  // Les hôtes de portail sont posés par la coque au commit parent : on force un
  // rendu après le montage pour que les portails trouvent leur cible.
  useEffect(() => {
    if (!portalMode) return;
    setHostTick((tick) => tick + 1);
  }, [portalMode]);
  // Progression des médias : le pied est occupé tant qu'un média n'est pas prêt.
  const uploadState = mediaUploadState(form.watch());

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

  /**
   * FID-060 — rebond de la capsule d'étape en erreur (maquette `bounce()`,
   * HTML L2000-2001 : `pane().dataset.bounce` pendant 440 ms). La capsule est
   * portée par la coque : on marque la feuille le temps de l'animation, et le
   * CSS de `create-v2.css` cible l'onglet actif de la mini-capsule. Neutralisé
   * en `prefers-reduced-motion` (bloc CSS dédié).
   */
  const bounceStep = useCallback(() => {
    if (typeof document === 'undefined') return;
    const sheet = document.querySelector('.lkdv-cv2-sheet');
    if (!sheet) return;
    sheet.classList.remove('lkdv-cv2c-step-error');
    // Force le redémarrage de l'animation si deux échecs s'enchaînent.
    void (sheet as HTMLElement).offsetWidth;
    sheet.classList.add('lkdv-cv2c-step-error');
    window.setTimeout(() => sheet.classList.remove('lkdv-cv2c-step-error'), 440);
  }, []);

  // Revenir sur un type remet ses étapes à zéro (les brouillons restent). Au
  // montage, c'est l'étape restaurée du brouillon qui s'applique (N1).
  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = active;
    if (!active) return;
    const restored = restoredStepRef.current;
    restoredStepRef.current = null;
    setServerError(null);
    setAttempted(false);
    if (restored != null && wasActive) {
      setStepState(Math.max(0, Math.min(steps.length - 1, restored)));
      return;
    }
    setStepState(0);
  }, [active, steps.length]);

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
      window.setTimeout(() => focusFieldByName(root), 60);
    },
    [kind, step],
  );

  // Le focus attend le rendu de l'étape cible.
  useEffect(() => {
    const name = pendingFocus.current;
    if (!name) return;
    pendingFocus.current = null;
    const timer = window.setTimeout(() => focusFieldByName(name), 60);
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
        bounceStep();
        focusField(first);
      }
      return false;
    },
    [bounceStep, focusField, form, haptic, schema, steps],
  );

  const validateCurrentStep = useCallback(() => validateStepAt(step), [step, validateStepAt]);

  const submitAll = useCallback(() => {
    void form.handleSubmit(
      async (values) => {
        if (busyRef.current) return;
        if (uploadState.pending > 0) {
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
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
          const info = offline
            ? {
                message:
                  'Hors ligne : ta saisie est conservée. Réessaie à la reconnexion.',
                field: null,
                code: 'offline',
              }
            : parseServerError(error);
          setAttempted(true);
          setServerError(info.message);
          bounceStep();
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
  }, [bounceStep, defaultValues, draft, focusField, form, haptic, onSubmit, uploadState.pending]);

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
      busyLabel: busy
        ? 'Envoi…'
        : uploadState.pending > 0
          ? `Envoi des médias… ${uploadState.percent} %`
          : null,
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
      uploadState.pending,
      uploadState.percent,
    ],
  );

  useEffect(() => {
    onNavChange(nav);
  }, [nav, onNavChange]);

  // En mode portail, les champs vivent hors de l'élément `<form>` : les flèches
  // et Entrée sont neutralisées en phase de capture, avant le LensPager.
  useEffect(() => {
    if (!portalMode || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const editable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (!editable) return;
      if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
        event.stopPropagation();
        return;
      }
      if (event.key === 'Enter' && target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [portalMode]);

  const api: CreateFormEngineApiV2<T> = {
    form,
    step,
    setStep,
    errorCount,
    clearDraft,
    uploadingCount: uploadState.pending,
    active: true,
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
      data-testid="cv2-error-summary"
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

  const keyboardGuard = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const editable =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);
    // Les flèches restent dans le champ : ni changement d'étape, ni LensPager.
    if (editable && (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End')) {
      event.stopPropagation();
      return;
    }
    // Entrée dans un champ ne publie pas : seule l'action finale le fait.
    if (editable && event.key === 'Enter' && target?.tagName !== 'TEXTAREA') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const clearDialog = (
    <ConfirmDialogV2
      open={confirmClear}
      title="Effacer le brouillon ?"
      text="Les champs saisis seront perdus."
      cancelLabel="Annuler"
      confirmLabel="Effacer"
      danger
      testId="cv2c-clear-confirm"
      onCancel={() => setConfirmClear(false)}
      onConfirm={() => {
        setConfirmClear(false);
        clearDraft();
      }}
    />
  );

  const header = (
    <>
      {draft.restored ? (
        <div className="lkdv-cv2-draft lkdv-cv2c-draft" data-testid="cv2-draft-banner">
          <span>Brouillon restauré</span>
          {/* Maquette L2711 : « Effacer » passe par `lkvConfirm('Effacer le
              brouillon ?')`, Annuler conserve, Échap ferme sans effacer. */}
          <button type="button" onClick={() => setConfirmClear(true)}>
            Effacer
          </button>
        </div>
      ) : null}
      {summary}
    </>
  );

  // Mode portail : un seul formulaire, une page par étape (glisser = étapes).
  if (portalMode) {
    return (
      <div className="lkdv-cv2c-form" data-testid={`cv2-form-${kind}`} data-kind={kind} data-step={step}>
        <span className="lkdv-cv2c-sr-only" aria-live="polite">
          {draft.restored ? 'Brouillon restauré. ' : ''}
          {errorCount > 0 ? errorCounterLabel(errorCount) : ''}
        </span>
        {clearDialog}
        {steps.map((stepDefinition, index) => {
          const host = stepHosts?.[index];
          if (!host) return null;
          return createPortal(
            <FormProvider {...form} key={`${kind}-${stepDefinition.id}`}>
              <div onKeyDown={keyboardGuard}>
                <fieldset
                  className="lkdv-cv2c-pane"
                  data-step={stepDefinition.id}
                  disabled={disabled || busy}
                >
                  {index === step ? header : null}
                  {children({ ...api, step: index, active: index === step })}
                </fieldset>
              </div>
            </FormProvider>,
            host,
            `cv2c-step-${kind}-${index}`,
          );
        })}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="lkdv-cv2c-form"
      data-testid={`cv2-form-${kind}`}
      data-kind={kind}
      data-step={step}
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={keyboardGuard}
    >
      {header}
      {clearDialog}
      <FormProvider {...form}>
        <fieldset className="lkdv-cv2c-pane" disabled={disabled || busy}>
          {children(api)}
        </fieldset>
      </FormProvider>
    </form>
  );
}

export default CreateFormEngineV2;
