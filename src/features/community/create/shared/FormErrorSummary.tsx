'use client';

import React, { useCallback } from 'react';
import './create-shared.css';

export interface FormErrorItem {
  name: string;
  message: string;
}

export interface FormErrorSummaryProps {
  errors: unknown;
  labels?: Record<string, string>;
  title?: string;
  onFocusField?: (name: string) => void;
  /** Inclut les erreurs `root` (serveur). Désactivé par défaut. */
  includeRoot?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flatten(value: unknown, prefix = '', items: FormErrorItem[] = []): FormErrorItem[] {
  if (!value) return items;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      flatten(entry, prefix ? `${prefix}.${index}` : String(index), items);
    });
    return items;
  }
  if (!isRecord(value)) return items;

  if (typeof value.message === 'string' && value.message.trim()) {
    items.push({ name: prefix || 'form', message: value.message });
    return items;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'type' || key === 'ref' || key === 'types') continue;
    flatten(child, prefix ? `${prefix}.${key}` : key, items);
  }
  return items;
}

function defaultFocus(name: string) {
  if (typeof document === 'undefined') return;
  const byId = document.getElementById(name);
  if (byId && typeof byId.focus === 'function') {
    byId.focus();
    return;
  }
  const escaped = name.replace(/["\\]/g, '\\$&');
  const byName = document.querySelector<HTMLElement>(`[name="${escaped}"]`);
  byName?.focus();
}

/**
 * Résumé d’erreurs cliquable : chaque ligne place le focus sur son champ.
 *
 * `role="alert"` rend le résumé annoncé dès son apparition ; le bouton porte
 * le libellé et le message, donc il reste compréhensible au lecteur d’écran.
 */
export function FormErrorSummary({
  errors,
  labels = {},
  title = 'Corrige ces points avant de continuer.',
  onFocusField,
  includeRoot = false,
}: FormErrorSummaryProps) {
  const items = flatten(errors).filter(
    (item) => includeRoot || !(item.name === 'root' || item.name.startsWith('root.')),
  );
  const unique = items.filter(
    (item, index) => items.findIndex((other) => other.name === item.name && other.message === item.message) === index,
  );

  const focus = useCallback(
    (name: string) => {
      if (onFocusField) {
        onFocusField(name);
        return;
      }
      defaultFocus(name);
    },
    [onFocusField],
  );

  if (unique.length === 0) return null;

  return (
    <div className="lkdv-form-error-summary" role="alert">
      <b>{title}</b>
      <ul>
        {unique.map((item) => {
          const top = item.name.split('.')[0] ?? item.name;
          const label = labels[top] ?? top;
          return (
            <li key={`${item.name}-${item.message}`}>
              <button
                type="button"
                aria-label={`${label} : ${item.message}`}
                onClick={() => focus(item.name)}
              >
                <span className="lkdv-form-error-label">{label}</span>
                <span>{item.message}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default FormErrorSummary;
