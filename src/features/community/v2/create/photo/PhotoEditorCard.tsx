'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import {
  type PhotoEditorCategory,
  type PhotoModifiersV2,
  DEFAULT_PHOTO_MODIFIERS,
  PHOTO_EDITOR_CATEGORIES,
} from './photoEditor';

export interface PhotoEditorCardProps {
  category: PhotoEditorCategory;
  modifiers: PhotoModifiersV2;
  onChangeModifier: <K extends keyof PhotoModifiersV2>(key: K, value: PhotoModifiersV2[K]) => void;
  onResetCategory: (category: PhotoEditorCategory) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Carte inférieure non-défilante contenant jusqu'à 5 contrôles de retouche (F1.5)
 * Ajustements Canvas/CSS directs et temps-réel, sans filtres prédéfinis.
 */
export function PhotoEditorCard({
  category,
  modifiers,
  onChangeModifier,
  onResetCategory,
  onClose,
  className = '',
}: PhotoEditorCardProps) {
  const spec = PHOTO_EDITOR_CATEGORIES.find((c) => c.id === category);
  if (!spec) return null;

  return (
    <motion.div
      className={`lkdv-photo-editor-card ${className}`.trim()}
      role="region"
      aria-label={`Réglages photo : ${spec.label}`}
      data-testid={`photo-editor-card-${category}`}
      initial={{ height: 0, opacity: 0, y: -14 }}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: -14 }}
      transition={{
        height: { duration: 0.72, ease: [0.22, 0.61, 0.36, 1] },
        y: { duration: 0.72, ease: [0.22, 0.61, 0.36, 1] },
        opacity: { duration: 0.48, ease: [0.22, 0.61, 0.36, 1] },
      }}
    >
      <div className="lkdv-photo-editor-card-inner">
        <div className="lkdv-photo-editor-head">
          <span className="lkdv-photo-editor-title">{spec.label}</span>
          <div className="lkdv-photo-editor-head-actions">
            <button
              type="button"
              className="lkdv-photo-editor-head-btn"
              data-testid="editor-reset-btn"
              onClick={() => onResetCategory(category)}
            >
              <RotateCcw size={12} aria-hidden="true" />
              Réinitialiser
            </button>
            <button
              type="button"
              className="lkdv-photo-editor-head-btn is-done"
              data-testid="editor-close-btn"
              onClick={onClose}
            >
              <Check size={12} aria-hidden="true" />
              Terminé
            </button>
          </div>
        </div>
        <div className="lkdv-photo-editor-controls">
        {spec.modifiers.map((mod) => {
          const rawValue = modifiers[mod.key];

          if (mod.key === 'flipX') {
            const isFlipped = Boolean(rawValue);
            return (
              <div key={mod.key} className="lkdv-photo-editor-row">
                <span className="lkdv-photo-editor-label">{mod.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-label={mod.label}
                  aria-checked={isFlipped}
                  data-testid="toggle-flipX"
                  className={`lkdv-photo-editor-switch ${isFlipped ? 'is-active' : ''}`}
                  onClick={() => onChangeModifier('flipX', !isFlipped)}
                >
                  <span className="lkdv-photo-editor-switch-dot" />
                  <span className="lkdv-photo-editor-switch-text">
                    {mod.formatValue(isFlipped)}
                  </span>
                </button>
              </div>
            );
          }

          const numValue = typeof rawValue === 'number' ? rawValue : (mod.defaultValue as number);

          return (
            <div key={mod.key} className="lkdv-photo-editor-row">
              <div className="lkdv-photo-editor-row-head">
                <label
                  htmlFor={`mod-${mod.key}`}
                  className="lkdv-photo-editor-label"
                >
                  {mod.label}
                </label>
                <span
                  className="lkdv-photo-editor-value"
                  data-testid={`val-${mod.key}`}
                >
                  {mod.formatValue(numValue)}
                </span>
              </div>
              <input
                id={`mod-${mod.key}`}
                type="range"
                min={mod.min}
                max={mod.max}
                step={mod.step}
                value={numValue}
                aria-label={mod.label}
                aria-valuemin={mod.min}
                aria-valuemax={mod.max}
                aria-valuenow={numValue}
                data-testid={`slider-${mod.key}`}
                className="lkdv-photo-editor-range"
                onChange={(e) => {
                  onChangeModifier(mod.key, parseFloat(e.target.value));
                }}
              />
            </div>
          );
        })}
        </div>
      </div>
    </motion.div>
  );
}

export default PhotoEditorCard;
