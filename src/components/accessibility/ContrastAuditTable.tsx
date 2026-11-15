'use client';

/**
 * Tableau d'audit de contraste WCAG 2.1/2.2 AA/AAA & RGAA (Lot O02-UI).
 *
 * Les paires peuvent référencer les jetons CSS (`var(--lkv-text-primary)`) :
 * la résolution se fait après montage pour rester SSR-safe. Le tableau ne dit
 * jamais le résultat par la couleur seule : chaque ligne porte « Conforme AA »,
 * « Échec AA », etc.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  auditColorPalette,
  type ContrastAuditReport,
  type ContrastPairInput,
  type ContrastPairResult,
  type WcagConformanceLevel,
} from '@/features/accessibility';
import { AccessibilityStyles } from './AccessibilityStyles';

const CSS_VAR_PATTERN = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/;

/** Résout une valeur `var(--jeton)` depuis le document, ou renvoie l'entrée. */
export function resolveCssColor(input: string, root?: HTMLElement | null): string {
  let current = input;
  for (let depth = 0; depth < 5; depth += 1) {
    const match = current.trim().match(CSS_VAR_PATTERN);
    if (!match) return current.trim();
    const fallback = match[2]?.trim();
    if (typeof document === 'undefined') {
      current = fallback ?? 'black';
      continue;
    }
    const element = root ?? document.documentElement;
    const value = getComputedStyle(element).getPropertyValue(match[1]).trim();
    current = value || fallback || 'black';
  }
  return current.trim();
}

export function resolveContrastPair(pair: ContrastPairInput): ContrastPairInput {
  return {
    ...pair,
    foreground: resolveCssColor(pair.foreground),
    background: resolveCssColor(pair.background),
  };
}

function isCssVariablePair(pair: ContrastPairInput): boolean {
  return pair.foreground.includes('var(') || pair.background.includes('var(');
}

const LEVEL_LABEL: Record<WcagConformanceLevel, string> = {
  AAA: 'AAA',
  AA: 'AA',
  AA_LARGE: 'AA grand texte',
  FAIL: 'Échec',
};

function safeAudit(pairs: ContrastPairInput[]): { report: ContrastAuditReport | null; error: string | null } {
  try {
    return { report: auditColorPalette(pairs), error: null };
  } catch (error) {
    return {
      report: null,
      error:
        error instanceof Error
          ? error.message
          : 'Couleur de contraste invalide : vérifiez les jetons fournis.',
    };
  }
}

/**
 * Paires de contrôle LKDV : uniquement des jetons, jamais des hexadécimaux
 * recopiés. L’audit lit donc le thème réellement actif (clair/sombre/couleurs
 * forcées) au moment du rendu.
 */
export const LKDV_CONTRAST_SAMPLES: ReadonlyArray<ContrastPairInput> = [
  {
    id: 'text-primary-paper',
    label: 'Texte principal sur papier',
    foreground: 'var(--lkv-text-primary)',
    background: 'var(--lkv-surface-paper)',
  },
  {
    id: 'text-secondary-paper',
    label: 'Texte secondaire sur papier',
    foreground: 'var(--lkv-text-secondary)',
    background: 'var(--lkv-surface-paper)',
  },
  {
    id: 'text-muted-surface',
    label: 'Texte discret sur surface douce',
    foreground: 'var(--lkv-text-muted)',
    background: 'var(--lkv-surface-muted)',
  },
  {
    id: 'on-action',
    label: 'Texte sur bouton d’action',
    foreground: 'var(--lkv-on-action)',
    background: 'var(--lkv-action)',
  },
  {
    id: 'danger-paper',
    label: 'Erreur sur papier',
    foreground: 'var(--lkv-danger)',
    background: 'var(--lkv-surface-paper)',
  },
  {
    id: 'action-ui',
    label: 'Composant d’interface (3:1)',
    foreground: 'var(--lkv-action)',
    background: 'var(--lkv-surface-paper)',
    isUiComponent: true,
  },
];

export interface ContrastAuditTableProps {
  pairs: ReadonlyArray<ContrastPairInput>;
  title?: string;
  description?: string;
  titleAs?: 'h1' | 'h2' | 'h3';
  className?: string;
  /** Affiche la liste détaillée des paires en échec (défaut : true). */
  showFailures?: boolean;
  /** Texte de remplacement pendant la résolution des jetons CSS. */
  loadingLabel?: string;
}

export function ContrastAuditTable({
  pairs,
  title = 'Contraste des couleurs',
  description = 'Contrôle WCAG 2.2 AA/AAA et RGAA (critères 3.2 et 3.3) sur les jetons réellement rendus. Les composants d’interface utilisent le seuil 3:1 de WCAG 1.4.11.',
  titleAs = 'h2',
  className,
  showFailures = true,
  loadingLabel = 'Calcul des contrastes…',
}: ContrastAuditTableProps) {
  const titleId = useId();
  const pairsKey = JSON.stringify(pairs);
  const hasVariables = pairs.some(isCssVariablePair);
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;
  const [resolvedPairs, setResolvedPairs] = useState<ContrastPairInput[] | null>(
    hasVariables ? null : [...pairs],
  );

  useEffect(() => {
    if (!hasVariables) {
      setResolvedPairs([...pairsRef.current]);
      return;
    }
    setResolvedPairs(pairsRef.current.map(resolveContrastPair));
  }, [hasVariables, pairsKey]);

  const auditState = useMemo(
    () => (resolvedPairs ? safeAudit(resolvedPairs) : { report: null, error: null }),
    [resolvedPairs],
  );
  const Heading = titleAs;
  const report = auditState.report;

  return (
    <section
      className={['lkdv-a11y-root', 'lkdv-a11y-panel', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      data-lkdv-contrast-audit=""
    >
      <AccessibilityStyles />
      <header className="lkdv-a11y-panel-head">
        <p className="lkdv-a11y-kicker">WCAG · RGAA</p>
        <Heading id={titleId} className="lkdv-a11y-title">
          {title}
        </Heading>
        <p className="lkdv-a11y-lead">{description}</p>
      </header>

      {auditState.error ? (
        <p role="alert" className="lkdv-a11y-failures">
          {auditState.error}
        </p>
      ) : null}

      {!report && !auditState.error ? (
        <p role="status" className="lkdv-a11y-summary">
          {loadingLabel}
        </p>
      ) : null}

      {report ? (
        <>
          <p
            className="lkdv-a11y-summary"
            role={report.compliantAA ? 'status' : 'alert'}
            data-testid="contrast-summary"
          >
            {report.passedAA} / {report.total} paires conformes AA · {report.passedAAA} /{' '}
            {report.total} conformes AAA
            {report.compliantAA ? ' · Aucun échec AA' : ` · ${report.failedAA.length} échec(s) AA`}
          </p>

          <div className="lkdv-a11y-table-wrap">
            <table className="lkdv-a11y-table">
              <caption>
                Résultats de contraste : {report.passedAA} conformes AA sur {report.total}.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Élément</th>
                  <th scope="col">Texte</th>
                  <th scope="col">Fond</th>
                  <th scope="col">Ratio</th>
                  <th scope="col">Niveau</th>
                  <th scope="col">AA</th>
                  <th scope="col">AAA</th>
                </tr>
              </thead>
              <tbody>
                {report.results.map((result: ContrastPairResult) => {
                  const evaluation = result.evaluation;
                  return (
                    <tr key={result.id} data-level={evaluation.level}>
                      <th scope="row">{result.label ?? result.id}</th>
                      <td>
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: '0.9em',
                            height: '0.9em',
                            marginRight: '0.4em',
                            border: '1px solid var(--lkv-border)',
                            borderRadius: '2px',
                            background: result.foreground,
                            verticalAlign: '-0.1em',
                          }}
                        />
                        <span>{result.foreground}</span>
                      </td>
                      <td>
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: '0.9em',
                            height: '0.9em',
                            marginRight: '0.4em',
                            border: '1px solid var(--lkv-border)',
                            borderRadius: '2px',
                            background: result.background,
                            verticalAlign: '-0.1em',
                          }}
                        />
                        <span>{result.background}</span>
                      </td>
                      <td>{evaluation.formattedRatio}</td>
                      <td>{LEVEL_LABEL[evaluation.level]}</td>
                      <td>
                        <span className="lkdv-a11y-badge" data-pass={evaluation.passesAA ? 'true' : 'false'}>
                          {evaluation.passesAA ? 'Conforme AA' : 'Échec AA'}
                        </span>
                      </td>
                      <td>
                        <span className="lkdv-a11y-badge" data-pass={evaluation.passesAAA ? 'true' : 'false'}>
                          {evaluation.passesAAA ? 'Conforme AAA' : 'Non AAA'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showFailures && report.failedAA.length > 0 ? (
            <ul className="lkdv-a11y-failures" aria-label="Paires en échec AA">
              {report.failedAA.map((failed) => (
                <li key={failed.id}>
                  {failed.label ?? failed.id} : {failed.evaluation.formattedRatio} (minimum 4,5:1,
                  ou 3:1 pour un grand texte / composant).
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default ContrastAuditTable;
