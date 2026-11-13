/**
 * Styles partagés des composants d'accessibilité (Lot O02-UI).
 *
 * Aucune couleur littérale : uniquement les jetons `--lkv-*`. Les tailles de
 * texte sont en `em` pour suivre l'échelle typographique choisie par la
 * personne (`--lkdv-text-scale`), et les animations se coupent dès que
 * `data-reduced-motion="true"` ou `prefers-reduced-motion` est actif.
 */

export const ACCESSIBILITY_UI_CSS = `
.lkdv-a11y-root {
  color: var(--lkv-text-primary);
  /* L'échelle est portée par <html> (tailwind.css) : ne pas la multiplier ici. */
  font-size: 1rem;
  line-height: 1.55;
}

.lkdv-a11y-sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.lkdv-a11y-panel {
  background: var(--lkv-surface-paper);
  border: 1px solid var(--lkv-border);
  border-radius: var(--lkv-radius-lg);
  box-shadow: var(--card-shadow);
  padding: clamp(1rem, 3vw, 1.75rem);
}

.lkdv-a11y-panel-head {
  display: grid;
  gap: 0.35em;
  margin-bottom: 1.25em;
}

.lkdv-a11y-kicker {
  margin: 0;
  color: var(--lkv-text-secondary);
  font-size: 0.75em;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.lkdv-a11y-title {
  margin: 0;
  color: var(--lkv-text-primary);
  font-size: 1.55em;
  line-height: 1.15;
}

.lkdv-a11y-lead {
  margin: 0;
  max-width: 62ch;
  color: var(--lkv-text-secondary);
  font-size: 0.98em;
}

.lkdv-a11y-section {
  border: 0;
  border-top: 1px solid var(--lkv-border);
  margin: 0;
  padding: 1.25em 0 0;
  min-width: 0;
}

.lkdv-a11y-section + .lkdv-a11y-section {
  margin-top: 1.25em;
}

.lkdv-a11y-legend {
  float: left;
  width: 100%;
  margin: 0 0 0.45em;
  padding: 0;
  color: var(--lkv-text-primary);
  font-size: 1.02em;
  font-weight: 700;
}

.lkdv-a11y-help {
  clear: both;
  margin: 0 0 0.9em;
  max-width: 64ch;
  color: var(--lkv-text-secondary);
  font-size: 0.9em;
}

.lkdv-a11y-choices {
  display: grid;
  gap: 0.6em;
  clear: both;
}

.lkdv-a11y-choice {
  display: grid;
  grid-template-columns: 1.4em minmax(0, 1fr);
  align-items: start;
  gap: 0.55em;
  min-height: var(--lkv-touch-min, 44px);
  padding: 0.65em 0.8em;
  border: 1px solid var(--lkv-border);
  border-radius: var(--lkv-radius-sm);
  background: var(--lkv-surface);
  cursor: pointer;
}

.lkdv-a11y-choice:hover {
  background: var(--lkv-hover-surface);
}

.lkdv-a11y-choice input {
  width: 1.15em;
  height: 1.15em;
  margin: 0.18em 0 0;
  accent-color: var(--lkv-action);
}

.lkdv-a11y-choice-txt {
  display: grid;
  gap: 0.15em;
}

.lkdv-a11y-choice-label {
  color: var(--lkv-text-primary);
  font-weight: 650;
}

.lkdv-a11y-choice-desc {
  color: var(--lkv-text-secondary);
  font-size: 0.86em;
}

.lkdv-a11y-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 0.6em 0;
}

.lkdv-a11y-switch-txt {
  display: grid;
  gap: 0.1em;
  min-width: 0;
}

.lkdv-a11y-switch-desc {
  color: var(--lkv-text-secondary);
  font-size: 0.86em;
}

.lkdv-a11y-scale-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5em;
  margin-bottom: 0.55em;
}

.lkdv-a11y-scale-value {
  color: var(--lkv-text-primary);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.lkdv-a11y-range {
  display: block;
  width: 100%;
  min-height: var(--lkv-touch-min, 44px);
  margin: 0;
  accent-color: var(--lkv-action);
  cursor: pointer;
}

.lkdv-a11y-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
  margin-top: 0.55em;
}

.lkdv-a11y-preset,
.lkdv-a11y-reset {
  min-height: var(--lkv-touch-min, 44px);
  padding: 0.45em 0.85em;
  border: 1px solid var(--lkv-border);
  border-radius: var(--lkv-radius-full);
  background: var(--lkv-surface);
  color: var(--lkv-text-primary);
  font: inherit;
  font-size: 0.88em;
  font-weight: 650;
  cursor: pointer;
}

.lkdv-a11y-preset[aria-pressed="true"] {
  border-color: var(--lkv-action);
  background: var(--lkv-action-soft);
  color: var(--lkv-text-primary);
}

.lkdv-a11y-reset {
  margin-top: 1.25em;
  border-color: var(--lkv-action);
  color: var(--lkv-action);
}

.lkdv-a11y-preview {
  margin-top: 0.8em;
  padding: 0.9em 1em;
  border: 1px dashed var(--lkv-border);
  border-radius: var(--lkv-radius-sm);
  background: var(--lkv-surface-muted);
  color: var(--lkv-text-primary);
  overflow-wrap: anywhere;
}

.lkdv-a11y-status {
  margin: 0.9em 0 0;
  color: var(--lkv-text-secondary);
  font-size: 0.88em;
}

.lkdv-a11y-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.lkdv-a11y-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.lkdv-a11y-table caption {
  text-align: left;
  padding-bottom: 0.55em;
  color: var(--lkv-text-secondary);
  font-size: 0.88em;
}

.lkdv-a11y-table th,
.lkdv-a11y-table td {
  padding: 0.55em 0.65em;
  border-bottom: 1px solid var(--lkv-border);
  text-align: left;
  vertical-align: top;
}

.lkdv-a11y-table thead th {
  color: var(--lkv-text-secondary);
  font-size: 0.78em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lkdv-a11y-table tbody th {
  font-weight: 650;
}

.lkdv-a11y-table tr[data-level="FAIL"] {
  background: color-mix(in srgb, var(--lkv-danger) 9%, transparent);
}

.lkdv-a11y-badge {
  display: inline-block;
  padding: 0.1em 0.5em;
  border: 1px solid currentColor;
  border-radius: var(--lkv-radius-full);
  font-size: 0.8em;
  font-weight: 700;
  white-space: nowrap;
}

.lkdv-a11y-badge[data-pass="true"] {
  color: var(--lkv-success);
}

.lkdv-a11y-badge[data-pass="false"] {
  color: var(--lkv-danger);
}

.lkdv-a11y-summary {
  margin: 0 0 0.8em;
  color: var(--lkv-text-primary);
  font-weight: 650;
}

.lkdv-a11y-failures {
  margin: 0.8em 0 0;
  padding-left: 1.2em;
  color: var(--lkv-danger);
}

.lkdv-a11y-skip {
  position: fixed;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2147483647;
  transform: translateY(-250%);
  padding: 0.75rem 1rem;
  border-radius: var(--lkv-radius-sm);
  background: var(--lkv-surface-paper);
  color: var(--lkv-text-primary);
  font-weight: 700;
  text-decoration: underline;
  box-shadow: var(--card-shadow-elevated);
  transition: transform var(--motion-control-duration) var(--motion-ease-standard);
}

.lkdv-a11y-skip:focus,
.lkdv-a11y-skip:focus-visible {
  transform: translateY(0);
}

.lkdv-a11y-map {
  position: relative;
  min-height: var(--lkdv-a11y-map-min-height, 12rem);
  border: 1px solid var(--lkv-border);
  border-radius: var(--lkv-radius-md);
  background: var(--lkv-surface-muted);
  outline-offset: 3px;
}

.lkdv-a11y-map:focus-visible {
  outline: 3px solid var(--lkv-action);
}

.lkdv-a11y-map-help {
  margin: 0;
  padding: 0.55em 0.75em;
  border-bottom: 1px solid var(--lkv-border);
  color: var(--lkv-text-secondary);
  font-size: 0.82em;
}

.lkdv-a11y-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 1000);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  background: var(--lkv-overlay-scrim);
  backdrop-filter: blur(6px);
}

.lkdv-a11y-sheet {
  display: flex;
  flex-direction: column;
  width: min(100%, 40rem);
  max-height: min(90dvh, 54rem);
  overflow: hidden;
  border: 1px solid var(--glass-border, var(--lkv-border));
  border-radius: var(--lkv-radius-sheet) var(--lkv-radius-sheet) 0 0;
  background: var(--lkv-surface-paper);
  color: var(--lkv-text-primary);
  box-shadow: var(--glass-shadow-overlay, var(--card-shadow-elevated));
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.lkdv-a11y-sheet[data-side="right"] {
  align-self: stretch;
  margin-left: auto;
  width: min(100%, 28rem);
  max-height: 100dvh;
  border-radius: 0;
}

.lkdv-a11y-sheet[data-side="left"] {
  align-self: stretch;
  margin-right: auto;
  width: min(100%, 28rem);
  max-height: 100dvh;
  border-radius: 0;
}

.lkdv-a11y-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1em;
  padding: 1rem 1.1rem 0.65rem;
}

.lkdv-a11y-sheet-heading {
  display: grid;
  gap: 0.2em;
  min-width: 0;
}

.lkdv-a11y-sheet-title {
  margin: 0;
  font-size: 1.2em;
  line-height: 1.2;
}

.lkdv-a11y-sheet-desc {
  margin: 0;
  color: var(--lkv-text-secondary);
  font-size: 0.9em;
}

.lkdv-a11y-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: var(--lkv-touch-min, 44px);
  min-height: var(--lkv-touch-min, 44px);
  padding: 0;
  border: 1px solid var(--lkv-border);
  border-radius: var(--lkv-radius-full);
  background: var(--lkv-surface);
  color: var(--lkv-text-primary);
  font: inherit;
  font-size: 1.15em;
  cursor: pointer;
}

.lkdv-a11y-sheet-body {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.35rem 1.1rem 1.1rem;
}

.lkdv-a11y-sheet-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.1rem 1rem;
  border-top: 1px solid var(--lkv-border);
}

.lkdv-a11y-screen {
  display: grid;
  gap: 1.5rem;
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  padding: clamp(1rem, 4vw, 2.5rem);
}

.lkdv-a11y-screen-head {
  display: grid;
  gap: 0.4em;
}

.lkdv-a11y-screen-title {
  margin: 0;
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  line-height: 1.1;
}

.lkdv-a11y-kbd-list {
  display: grid;
  gap: 0.55em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lkdv-a11y-kbd-list li {
  display: grid;
  grid-template-columns: minmax(7.5em, auto) minmax(0, 1fr);
  gap: 0.8em;
  padding: 0.55em 0;
  border-bottom: 1px solid var(--lkv-border);
}

.lkdv-a11y-kbd {
  display: inline-block;
  justify-self: start;
  padding: 0.1em 0.45em;
  border: 1px solid var(--lkv-border);
  border-radius: var(--lkv-radius-xs);
  background: var(--lkv-surface-muted);
  color: var(--lkv-text-primary);
  font-family: var(--font-mono);
  font-size: 0.85em;
}

[data-enhanced-focus="true"] .lkdv-a11y-root :focus-visible,
[data-enhanced-focus="true"] .lkdv-a11y-sheet :focus-visible,
[data-enhanced-focus="true"] .lkdv-a11y-map:focus-visible {
  outline-width: 4px;
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .lkdv-a11y-skip,
  .lkdv-a11y-choice,
  .lkdv-a11y-preset,
  .lkdv-a11y-reset {
    transition: none !important;
    animation: none !important;
  }
}

[data-reduced-motion="true"] .lkdv-a11y-skip,
[data-reduced-motion="true"] .lkdv-a11y-choice,
[data-reduced-motion="true"] .lkdv-a11y-preset,
[data-reduced-motion="true"] .lkdv-a11y-reset {
  transition: none !important;
  animation: none !important;
}

@media (forced-colors: active) {
  .lkdv-a11y-panel,
  .lkdv-a11y-choice,
  .lkdv-a11y-preset,
  .lkdv-a11y-reset,
  .lkdv-a11y-sheet,
  .lkdv-a11y-map {
    border: 1px solid CanvasText;
    forced-color-adjust: auto;
  }

  .lkdv-a11y-badge {
    border-color: CanvasText;
  }
}
`;

/** Injecte la feuille de styles locale du module (idempotente à l'usage). */
export function AccessibilityStyles() {
  return <style data-lkdv-accessibility-ui="">{ACCESSIBILITY_UI_CSS}</style>;
}
