'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Backpack,
  Check,
  ChevronRight,
  Compass,
  Share2,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { OnboardingPayload, OnboardingStepId } from '@/features/compte/server/onboarding';

type Stored = {
  dismissedAt?: number;
  completed?: boolean;
  lastStep?: number;
  manualDone?: OnboardingStepId[];
};

const STEP_ICONS: Record<OnboardingStepId, React.ReactNode> = {
  profile: <UserRound size={22} aria-hidden="true" />,
  outing: <Compass size={22} aria-hidden="true" />,
  kit: <Backpack size={22} aria-hidden="true" />,
  cordee: <Users size={22} aria-hidden="true" />,
  share: <Share2 size={22} aria-hidden="true" />,
};

const STEP_CTA: Record<OnboardingStepId, string> = {
  profile: 'Compléter mon profil',
  outing: 'Enregistrer une sortie',
  kit: 'Composer mon kit',
  cordee: 'Voir ma cordée',
  share: 'Partager mon profil',
};

function storageKey(userId: string) {
  return `lkdv_onboarding_${userId}`;
}

function readStored(userId: string): Stored {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function writeStored(userId: string, value: Stored) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
  } catch {
    /* stockage indisponible : le parcours reste utilisable pour la session */
  }
}

/**
 * Parcours de commencement d'un nouveau compte.
 *
 * - ne s'ouvre qu'une fois, pour un compte réellement neuf ;
 * - ne bloque jamais : fermeture, « Plus tard », « Passer » ;
 * - chaque étape validée par les faits serveur, jamais par un simple clic ;
 * - réouverture depuis Paramètres via `lkdv:onboarding-open`.
 */
export function FirstRunJourney({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<OnboardingPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<Stored>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    setStored(readStored(userId));
  }, [userId]);

  useEffect(() => {
    let active = true;
    void fetch('/api/compte/onboarding', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: OnboardingPayload | null) => {
        if (active && payload) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  const manualDone = useMemo(() => new Set(stored.manualDone ?? []), [stored.manualDone]);
  const steps = useMemo(
    () =>
      (data?.steps ?? []).map((step) => ({
        ...step,
        done: step.done || manualDone.has(step.id),
      })),
    [data?.steps, manualDone]
  );
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = steps.length > 0 && doneCount === steps.length;

  // Ouvre une seule fois, dès que les faits réels sont disponibles, si le
  // compte est neuf et que l'utilisateur n'a pas déjà fermé/complété le
  // parcours. Pas de minuterie annulable : l'ouverture est déterministe.
  useEffect(() => {
    if (!data || !steps.length || autoOpenedRef.current) return;
    if (!data.isNew || stored.dismissedAt || stored.completed) return;
    autoOpenedRef.current = true;
    const firstUndone = steps.findIndex((step) => !step.done);
    setIndex(firstUndone >= 0 ? firstUndone : 0);
    setOpen(true);
  }, [data, steps, stored.completed, stored.dismissedAt]);

  const openJourney = useCallback(() => {
    if (!steps.length) return;
    const firstUndone = steps.findIndex((step) => !step.done);
    setIndex(firstUndone >= 0 ? firstUndone : 0);
    setOpen(true);
  }, [steps]);

  useEffect(() => {
    const handler = () => openJourney();
    window.addEventListener('lkdv:onboarding-open', handler);
    return () => window.removeEventListener('lkdv:onboarding-open', handler);
  }, [openJourney]);

  const close = useCallback(
    (dismiss = true) => {
      setOpen(false);
      if (dismiss) {
        const next: Stored = { ...stored, dismissedAt: Date.now() };
        setStored(next);
        writeStored(userId, next);
      }
    },
    [stored, userId]
  );

  const completeJourney = useCallback(() => {
    const next: Stored = { ...stored, completed: true, dismissedAt: Date.now() };
    setStored(next);
    writeStored(userId, next);
    setOpen(false);
  }, [stored, userId]);

  const activate = useCallback(
    async (step: OnboardingPayload['steps'][number], stepIndex: number) => {
      if (busy) return;
      setBusy(true);
      const nextStored: Stored = {
        ...stored,
        lastStep: Math.min(stepIndex + 1, steps.length - 1),
        manualDone: [...new Set([...(stored.manualDone ?? []), step.id])],
        dismissedAt: Date.now(),
      };
      setStored(nextStored);
      writeStored(userId, nextStored);
      setOpen(false);
      window.setTimeout(() => {
        const runtime = window as unknown as { __lkdvCompteAct?: (action: string, value?: unknown) => void };
        if (step.id === 'profile') runtime.__lkdvCompteAct?.('openAccountDrawer', 3);
        else if (step.id === 'cordee') runtime.__lkdvCompteAct?.('openFollowers');
        else if (step.id === 'share') runtime.__lkdvCompteAct?.('openAccountDrawer', 4);
        else if (step.id === 'outing') router.push('/compas');
        else if (step.id === 'kit') router.push('/materiel');
      }, 220);
      window.setTimeout(() => setBusy(false), 600);
    },
    [busy, router, steps.length, stored, userId]
  );

  if (!open || !steps.length) return null;

  const current = steps[Math.min(index, steps.length - 1)];
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="lkdv-onboarding-layer" data-open="true">
      <section
        className="lkdv-onboarding-sheet"
        role="dialog"
        aria-modal="false"
        aria-labelledby="lkdv-onboarding-title"
      >
        <style dangerouslySetInnerHTML={{ __html: ONBOARDING_CSS }} />
        <div className="lkdv-onboarding-grab" aria-hidden="true" />

        <header className="lkdv-onboarding-head">
          <div>
            <span className="lkdv-onboarding-eyebrow">
              <Sparkles size={13} aria-hidden="true" /> Parcours de départ
            </span>
            <b>
              {doneCount}/{steps.length}
            </b>
          </div>
          <button type="button" className="lkdv-onboarding-close" onClick={() => close(true)} aria-label="Fermer le parcours">
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="lkdv-onboarding-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>

        {allDone ? (
          <div className="lkdv-onboarding-body done">
            <span className="lkdv-onboarding-icon">
              <Check size={24} aria-hidden="true" />
            </span>
            <h2 id="lkdv-onboarding-title">Ton camp de base est prêt</h2>
            <p>Tu as posé les premiers repères. Le reste du chemin t’appartient : explore à ton rythme.</p>
            <button type="button" className="lkdv-onboarding-primary" onClick={completeJourney}>
              Terminer le parcours
            </button>
          </div>
        ) : (
          <div className="lkdv-onboarding-body">
            <span className="lkdv-onboarding-icon">{STEP_ICONS[current.id]}</span>
            <span className="lkdv-onboarding-step">Étape {index + 1} sur {steps.length}</span>
            <h2 id="lkdv-onboarding-title">{current.title}</h2>
            <p>{current.hint}</p>

            <div className="lkdv-onboarding-actions">
              <button
                type="button"
                className="lkdv-onboarding-primary"
                onClick={() => void activate(current, index)}
                disabled={busy}
              >
                {STEP_CTA[current.id]}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="lkdv-onboarding-secondary" onClick={() => close(true)}>
                Plus tard
              </button>
            </div>

            <button type="button" className="lkdv-onboarding-skip" onClick={completeJourney}>
              Passer le parcours
            </button>
          </div>
        )}

        <ul className="lkdv-onboarding-dots" aria-label={`Progression : ${doneCount} étape(s) sur ${steps.length}`}>
          {steps.map((step, stepIndex) => (
            <li
              key={step.id}
              className={step.done ? 'done' : stepIndex === index ? 'current' : ''}
              aria-current={stepIndex === index ? 'step' : undefined}
            >
              <span aria-hidden="true">{step.done ? <Check size={10} /> : stepIndex + 1}</span>
              {step.title}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export const ONBOARDING_CSS = `
body:has(.lkdv-onboarding-layer) [aria-label="Gestion des cookies"]{display:none!important;}
.lkdv-onboarding-layer{position:fixed!important;inset:0!important;z-index:220!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;pointer-events:none!important;padding:0 10px calc(10px + env(safe-area-inset-bottom,0px))!important;}
.lkdv-onboarding-sheet{pointer-events:auto!important;width:min(420px,100%)!important;max-height:78dvh!important;overflow:auto!important;display:flex!important;flex-direction:column!important;gap:10px!important;padding:8px 16px 14px!important;border-radius:28px!important;background:linear-gradient(180deg,rgba(252,253,250,.96),rgba(246,250,243,.94))!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12),0 -10px 40px rgba(23,43,36,.18)!important;-webkit-backdrop-filter:blur(30px) saturate(150%)!important;backdrop-filter:blur(30px) saturate(150%)!important;animation:lkdvOnboardingIn .42s cubic-bezier(.22,.8,.25,1) both!important;color:#172B24!important;box-sizing:border-box!important;}
@keyframes lkdvOnboardingIn{from{opacity:0;transform:translateY(26px) scale(.99)}to{opacity:1;transform:none}}
.lkdv-onboarding-grab{width:36px!important;height:4px!important;border-radius:2px!important;background:rgba(23,43,36,.16)!important;align-self:center!important;flex:none!important;}
.lkdv-onboarding-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;}
.lkdv-onboarding-head>div{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;}
.lkdv-onboarding-eyebrow{display:inline-flex!important;align-items:center!important;gap:5px!important;font:600 11px var(--sf)!important;color:#3D7A52!important;}
.lkdv-onboarding-head b{font:600 11px var(--sf)!important;color:#56665D!important;}
.lkdv-onboarding-close{width:32px!important;height:32px!important;border:0!important;border-radius:50%!important;background:rgba(23,43,36,.06)!important;color:var(--label2)!important;display:grid!important;place-items:center!important;cursor:pointer!important;flex:none!important;}
.lkdv-onboarding-progress{height:4px!important;border-radius:99px!important;background:rgba(23,43,36,.08)!important;overflow:hidden!important;}
.lkdv-onboarding-progress i{display:block!important;height:100%!important;border-radius:99px!important;background:linear-gradient(90deg,#5B8F6A,#17402C)!important;transition:width .4s cubic-bezier(.22,.8,.25,1)!important;}
.lkdv-onboarding-body{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:6px!important;padding:2px 0 0!important;}
.lkdv-onboarding-body.done{align-items:center!important;text-align:center!important;padding:12px 4px!important;}
.lkdv-onboarding-icon{width:46px!important;height:46px!important;border-radius:15px!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,rgba(255,255,255,.95),rgba(221,235,216,.9))!important;color:#17402C!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08),0 6px 18px rgba(23,43,36,.08)!important;margin-bottom:2px!important;}
.lkdv-onboarding-step{font:600 10px var(--sf)!important;text-transform:uppercase!important;letter-spacing:.06em!important;color:#6A786F!important;}
.lkdv-onboarding-body h2{margin:0!important;font:650 18px/1.2 var(--sf)!important;letter-spacing:-.02em!important;color:#172B24!important;}
.lkdv-onboarding-body p{margin:0!important;font:400 12.5px/1.45 var(--sf)!important;color:#56665D!important;max-width:320px!important;}
.lkdv-onboarding-actions{display:flex!important;align-items:center!important;gap:6px!important;width:100%!important;margin-top:5px!important;}
.lkdv-onboarding-primary{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;height:38px!important;padding:0 14px!important;border:0!important;border-radius:999px!important;background:#17402C!important;color:#fff!important;font:600 12.5px var(--sf)!important;cursor:pointer!important;box-shadow:0 4px 14px rgba(23,64,44,.22)!important;}
.lkdv-onboarding-primary:disabled{opacity:.5!important;}
.lkdv-onboarding-secondary{height:38px!important;padding:0 12px!important;border:0!important;border-radius:999px!important;background:rgba(23,43,36,.08)!important;color:#33443B!important;font:600 12px var(--sf)!important;cursor:pointer!important;}
.lkdv-onboarding-skip{align-self:flex-start!important;margin-top:3px!important;border:0!important;background:none!important;padding:4px 0!important;font:500 11px var(--sf)!important;color:#6A786F!important;text-decoration:underline!important;text-underline-offset:2px!important;cursor:pointer!important;}
.lkdv-onboarding-dots{list-style:none!important;margin:6px 0 0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:3px!important;border-top:.5px solid rgba(23,43,36,.07)!important;padding-top:8px!important;}
.lkdv-onboarding-dots li{display:flex!important;align-items:center!important;gap:7px!important;font:500 10.5px var(--sf)!important;color:#6A786F!important;}
.lkdv-onboarding-dots li>span{width:17px!important;height:17px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:rgba(23,43,36,.06)!important;font:600 9px var(--sf)!important;flex:none!important;}
.lkdv-onboarding-dots li.done{color:#2C5E3E!important;}
.lkdv-onboarding-dots li.done>span{background:rgba(61,122,82,.16)!important;color:#2C5E3E!important;}
.lkdv-onboarding-dots li.current{color:#172B24!important;font-weight:600!important;}
.lkdv-onboarding-dots li.current>span{background:#17402C!important;color:#fff!important;}
@media (prefers-reduced-motion:reduce){.lkdv-onboarding-sheet{animation:none!important;}.lkdv-onboarding-progress i{transition:none!important;}}
`;

export default FirstRunJourney;
