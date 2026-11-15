'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { StrengthLog } from '../state/types';
import { addStrengthExercise, addStrengthSet, createStrengthLog } from './model';
import { computeMuscleHeatmap } from './muscles';
import { MuscleMapSvg } from './MuscleMapSvg';
import {
  GUIDED_STRENGTH_PROGRAMS,
  type GuidedStrengthProgram,
  type MovementAnimationKey,
} from './guidedPrograms';
import {
  applyParsedStrengthImport,
  deleteStrengthTemplate,
  parseStrengthImportText,
  readStrengthTemplates,
  saveStrengthTemplateFromLog,
  type StrengthWorkoutTemplate,
} from './importer';
import { XpEmpty, XpEyebrow } from '../sheet/blocks';

export type StrengthViewTab = 'carnet' | 'muscles' | 'guide' | 'modeles';

function MovementDiagramSvg({ movementKey }: { movementKey: MovementAnimationKey }) {
  const [phase, setPhase] = useState<0 | 1>(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setPhase((prev) => (prev === 0 ? 1 : 0));
    }, 900);
    return () => window.clearInterval(id);
  }, [movementKey]);

  const torsoY = phase === 1 ? 14 : 0;
  return (
    <svg
      viewBox="0 0 120 90"
      width={120}
      height={90}
      role="img"
      aria-label={`Démonstration du mouvement ${movementKey}`}
      style={{ background: 'rgba(15,23,42,0.04)', borderRadius: 10, padding: 4 }}
    >
      {movementKey === 'plank' ? (
        <g stroke="#17402C" strokeWidth="4" strokeLinecap="round" fill="none">
          <line x1="15" y1="70" x2="105" y2="70" stroke="rgba(15,23,42,0.2)" strokeWidth="2" />
          <line x1="25" y1={52 + (phase === 1 ? 2 : 0)} x2="90" y2={54 + (phase === 1 ? 2 : 0)} />
          <circle cx="96" cy={50 + (phase === 1 ? 2 : 0)} r="6" fill="#17402C" stroke="none" />
          <line x1="78" y1="54" x2="78" y2="69" />
          <line x1="25" y1="52" x2="22" y2="69" />
        </g>
      ) : movementKey === 'pushup' ? (
        <g stroke="#17402C" strokeWidth="4" strokeLinecap="round" fill="none">
          <line x1="15" y1="74" x2="105" y2="74" stroke="rgba(15,23,42,0.2)" strokeWidth="2" />
          <line x1="22" y1="68" x2="86" y2={42 + torsoY} />
          <circle cx="92" cy={36 + torsoY} r="6" fill="#17402C" stroke="none" />
          <line x1="80" y1={45 + torsoY} x2="80" y2="72" />
        </g>
      ) : (
        <g stroke="#17402C" strokeWidth="4" strokeLinecap="round" fill="none">
          <line x1="20" y1="78" x2="100" y2="78" stroke="rgba(15,23,42,0.2)" strokeWidth="2" />
          <circle cx="60" cy={20 + torsoY} r="6" fill="#17402C" stroke="none" />
          <line x1="60" y1={27 + torsoY} x2={movementKey === 'hinge' && phase === 1 ? 74 : 60} y2={48 + torsoY} />
          <line x1="60" y1={48 + torsoY} x2={phase === 1 ? 48 : 54} y2="62" />
          <line x1={phase === 1 ? 48 : 54} y1="62" x2="52" y2="77" />
          <line x1="60" y1={48 + torsoY} x2={phase === 1 ? 72 : 66} y2="62" />
          <line x1={phase === 1 ? 72 : 66} y1="62" x2="68" y2="77" />
        </g>
      )}
    </svg>
  );
}

export function StrengthMusclesSection({ log }: { log: StrengthLog | null }) {
  const heatmap = useMemo(() => computeMuscleHeatmap(log), [log]);

  if (!log || log.exercises.length === 0) {
    return (
      <XpEmpty
        title="Aucun muscle sollicité pour l’instant"
        hint="Ajoute des exercices dans le carnet pour visualiser la carte anatomique (S2.33)."
      />
    );
  }

  return (
    <section data-testid="strength-muscles-section">
      <XpEyebrow>Zones musculaires ciblées (S2.33)</XpEyebrow>
      <MuscleMapSvg heatmap={heatmap} />
      {heatmap.unmappedExercises.length > 0 ? (
        <p style={{ fontSize: 11.5, opacity: 0.72, marginTop: 8 }}>
          Non cartographiés : {heatmap.unmappedExercises.join(', ')}.
        </p>
      ) : null}
    </section>
  );
}

export function StrengthGuidedSection({
  log,
  onApplyLog,
}: {
  log: StrengthLog | null;
  onApplyLog: (next: StrengthLog, statusMsg: string) => void;
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    GUIDED_STRENGTH_PROGRAMS[0]!.id
  );
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [restRemainingS, setRestRemainingS] = useState<number>(0);
  const [resting, setResting] = useState<boolean>(false);

  const program: GuidedStrengthProgram =
    GUIDED_STRENGTH_PROGRAMS.find((p) => p.id === selectedProgramId) ??
    GUIDED_STRENGTH_PROGRAMS[0]!;
  const step = program.steps[Math.min(stepIdx, program.steps.length - 1)]!;

  useEffect(() => {
    setStepIdx(0);
    setRestRemainingS(0);
    setResting(false);
  }, [program.id]);

  useEffect(() => {
    if (!resting) return;
    const id = window.setInterval(() => {
      setRestRemainingS((prev) => {
        if (prev <= 1) {
          setResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [resting]);

  const handleLoadIntoLog = () => {
    let next = log ?? createStrengthLog();
    for (const item of program.steps) {
      const added = addStrengthExercise(next, item.name);
      if (!added) continue;
      next = added.log;
      for (let i = 0; i < item.sets; i += 1) {
        const res = addStrengthSet(next, added.exercise.id, {
          reps: item.defaultReps,
          load: item.suggestedLoadKg,
          unit: 'kg',
        });
        if (res) next = res.log;
      }
    }
    onApplyLog(next, `Séance « ${program.title} » ajoutée au carnet.`);
  };

  return (
    <section data-testid="strength-guided-section" style={{ display: 'grid', gap: 10 }}>
      <XpEyebrow>Programmes & séances guidées (S2.34)</XpEyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {GUIDED_STRENGTH_PROGRAMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === program.id ? 'xp-primary' : 'xp-chip'}
            aria-pressed={item.id === program.id}
            onClick={() => setSelectedProgramId(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12.5, opacity: 0.85 }}>
        <strong>{program.goalLabel}</strong> · {program.level} · ~{program.estimatedMin} min
        <p style={{ margin: '4px 0 0' }}>{program.summary}</p>
      </div>

      <div
        style={{
          border: '1px solid rgba(15,23,42,0.12)',
          borderRadius: 12,
          padding: 12,
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <small style={{ opacity: 0.7 }}>
              Exercice {stepIdx + 1}/{program.steps.length}
            </small>
            <h4 style={{ margin: '2px 0' }}>{step.name}</h4>
            <div style={{ fontSize: 12.5 }}>
              {step.sets} × {step.repsLabel} · Repos {step.restS} s
            </div>
          </div>
          <MovementDiagramSvg movementKey={step.movementKey} />
        </div>

        <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{step.coachingCue}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="xp-secondary"
            onClick={() => {
              if (resting) {
                setResting(false);
              } else {
                setRestRemainingS(restRemainingS > 0 ? restRemainingS : step.restS);
                setResting(true);
              }
            }}
          >
            {resting
              ? `Pause repos · ${restRemainingS} s`
              : restRemainingS > 0
                ? `Reprendre repos (${restRemainingS} s)`
                : `Minuteur repos (${step.restS} s)`}
          </button>
          <button
            type="button"
            className="xp-chip"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          >
            Précédent
          </button>
          <button
            type="button"
            className="xp-chip"
            disabled={stepIdx >= program.steps.length - 1}
            onClick={() => setStepIdx((i) => Math.min(program.steps.length - 1, i + 1))}
          >
            Suivant
          </button>
        </div>
      </div>

      <button type="button" className="xp-primary" onClick={handleLoadIntoLog}>
        Charger cette séance dans le carnet
      </button>
    </section>
  );
}

export function StrengthTemplatesImportSection({
  log,
  onApplyLog,
}: {
  log: StrengthLog | null;
  onApplyLog: (next: StrengthLog, statusMsg: string) => void;
}) {
  const [templates, setTemplates] = useState<StrengthWorkoutTemplate[]>(() =>
    readStrengthTemplates()
  );
  const [templateName, setTemplateName] = useState('');
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const parsedPreview = useMemo(
    () => parseStrengthImportText(importText),
    [importText]
  );

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!log || !templateName.trim()) return;
    const saved = saveStrengthTemplateFromLog(templateName, log);
    if (saved) {
      setTemplates(readStrengthTemplates());
      setTemplateName('');
      setImportFeedback(`Modèle « ${saved.name} » enregistré gratuitement.`);
    }
  };

  const handleLoadTemplate = (tpl: StrengthWorkoutTemplate) => {
    const next = applyParsedStrengthImport(log, {
      exercises: tpl.exercises,
      unparsedLines: [],
      format: 'json',
    });
    onApplyLog(next, `Modèle « ${tpl.name} » appliqué au carnet.`);
  };

  const handleApplyImport = () => {
    if (parsedPreview.exercises.length === 0) {
      setImportFeedback('Aucune série exploitable détectée.');
      return;
    }
    const next = applyParsedStrengthImport(log, parsedPreview);
    setImportText('');
    onApplyLog(
      next,
      `${parsedPreview.exercises.length} exercice(s) importé(s) (${parsedPreview.format.toUpperCase()}).`
    );
  };

  return (
    <section data-testid="strength-import-templates-section" style={{ display: 'grid', gap: 12 }}>
      <XpEyebrow>Modèles personnalisés gratuits (S2.35)</XpEyebrow>
      <form onSubmit={handleSaveTemplate} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Nom du modèle (ex. Haut du corps)"
          aria-label="Nom du modèle personnalisé"
          style={{ flex: '1 1 180px' }}
        />
        <button
          type="submit"
          className="xp-secondary"
          disabled={!log || log.exercises.length === 0 || !templateName.trim()}
        >
          Enregistrer le carnet comme modèle
        </button>
      </form>

      {templates.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                border: '1px solid rgba(15,23,42,0.1)',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 12.5 }}>
                <strong>{tpl.name}</strong> · {tpl.exercises.length} ex.
              </span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="xp-chip"
                  onClick={() => handleLoadTemplate(tpl)}
                >
                  Charger
                </button>
                <button
                  type="button"
                  className="xp-chip"
                  aria-label={`Supprimer le modèle ${tpl.name}`}
                  onClick={() => setTemplates(deleteStrengthTemplate(tpl.id))}
                >
                  Supprimer
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, opacity: 0.72, margin: 0 }}>
          Aucun modèle enregistré : crée un carnet puis sauvegarde-le gratuitement sans limite.
        </p>
      )}

      <XpEyebrow>Import intelligent notes / CSV / JSON (S2.35)</XpEyebrow>
      <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
        <span>Colle tes notes, texte OCR ou CSV (ex. « Squat 4x8 @ 80kg »)</span>
        <textarea
          rows={4}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={'Squat 4x8 @ 80kg\nDéveloppé couché 3x10 @ 60kg\nPompes 3x15'}
        />
      </label>

      {parsedPreview.exercises.length > 0 ? (
        <div
          data-testid="strength-import-preview"
          style={{
            fontSize: 12,
            padding: 8,
            borderRadius: 8,
            background: 'rgba(23,64,44,0.06)',
          }}
        >
          Aperçu ({parsedPreview.format.toUpperCase()}) :{' '}
          {parsedPreview.exercises
            .map((e) => `${e.name} (${e.sets.length} séries)`)
            .join(', ')}
        </div>
      ) : null}

      <button
        type="button"
        className="xp-primary"
        onClick={handleApplyImport}
        disabled={parsedPreview.exercises.length === 0}
      >
        Importer dans le carnet
      </button>

      {importFeedback ? (
        <p role="status" style={{ fontSize: 12, margin: 0 }}>
          {importFeedback}
        </p>
      ) : null}
    </section>
  );
}
