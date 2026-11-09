import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Outils de la couche 5 (accessibilité) : axe, contraste calculé, focus visible,
 * cibles ≥ 44 px. Aucun de ces contrôles ne remplace les autres : axe ne voit pas
 * le contraste des jetons non appliqués, et ne mesure pas les cibles tactiles.
 */

// Playwright exécute les tests depuis `crm/` (racine de la configuration).
const CRM_ROOT = process.cwd();

export type Screen = {
  slug: string;
  route: string;
  name: string;
  maquette: string | null;
  auth: boolean;
  states: string[];
};

export type ScreensFile = {
  viewports: { id: string; width: number; height: number }[];
  screens: Screen[];
  accessibilite: {
    contrastes: { fond: string; texte: string; min: number }[];
    cibleMinPx: number;
    echecsAxeAutorises: number;
  };
};

export function screensFile(): ScreensFile {
  return JSON.parse(readFileSync(path.resolve(CRM_ROOT, 'tests/support/screens.json'), 'utf8')) as ScreensFile;
}

/** Identifiants de test (`is_demo`) utilisés pour résoudre les routes à paramètre. */
export const DEMO_IDS: Record<string, string> = {
  case_id: 'demo-post-report',
  member_id: 'demo-member',
  order_id: 'demo-order',
  request_id: 'demo-request',
  sos_id: 'demo-sos'
};

export function resolveRoute(route: string): string {
  return route.replace(/\{\{(\w+)\}\}/g, (_, key: string) => DEMO_IDS[key] ?? 'demo');
}

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export type AxeSummary = { id: string; impact: string | null; help: string; nodes: number };

/** Lance axe et rend un résumé lisible ; l'assertion vérifie 0 violation. */
export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
  await settle(page);
  // Un document réel a un titre et une langue : on attend cette condition avant de
  // scanner, sinon axe peut analyser un document transitoire du serveur de développement.
  await page.waitForFunction(() => document.title.trim().length > 0 && document.documentElement.lang.length > 0);

  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    // La barre d'outils de Next.js en développement n'appartient pas au produit :
    // la scanner produirait des violations qui disparaissent en production.
    .exclude('nextjs-portal')
    .analyze();

  const summary: AxeSummary[] = results.violations
    .map((violation) => {
      // Les nœuds d'une autre « frame » (surcouche de développement) portent un
      // sélecteur d'iframe en tête : ils ne concernent pas les écrans du CRM.
      const ownNodes = violation.nodes.filter((node) => {
        const target = node.target as unknown[];
        return String(target[0] ?? '') !== 'iframe';
      });
      return {
        id: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        nodes: ownNodes.length
      };
    })
    .filter((violation) => violation.nodes > 0);

  expect(summary, `${label} : violations axe\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

/** Attend un rendu stable : réseau au repos puis deux images successives. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // La surcouche de développement de Next.js (iframe, erreurs, pile) n'est pas le
  // produit : on la retire du DOM avant de mesurer, sinon axe et les tests de texte
  // lisent du bruit qui n'existe pas en production.
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => node.remove());
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16)) as [number, number, number];
};

const channel = (value: number): number => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function contrastRatio(foreground: string, background: string): number {
  const [r1, g1, b1] = hexToRgb(foreground);
  const [r2, g2, b2] = hexToRgb(background);
  const l1 = 0.2126 * channel(r1) + 0.7152 * channel(g1) + 0.0722 * channel(b1);
  const l2 = 0.2126 * channel(r2) + 0.7152 * channel(g2) + 0.0722 * channel(b2);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

/** Lit les jetons appliqués et vérifie chaque paire de contraste du registre. */
export async function expectTokenContrast(page: Page): Promise<void> {
  const pairs = screensFile().accessibilite.contrastes;
  const values = await page.evaluate((names: string[]) => {
    const style = getComputedStyle(document.documentElement);
    const out: Record<string, string> = {};
    for (const name of names) out[name] = style.getPropertyValue(name).trim();
    return out;
  }, pairs.flatMap((pair) => [pair.fond, pair.texte]));

  const failures: string[] = [];
  for (const pair of pairs) {
    const background = values[pair.fond];
    const foreground = values[pair.texte];
    if (!background || !foreground) {
      failures.push(`${pair.texte} sur ${pair.fond} : jeton absent (${background ? 'fond ok' : 'fond manquant'})`);
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio < pair.min) failures.push(`${pair.texte} sur ${pair.fond} : ${ratio.toFixed(2)} < ${pair.min}`);
  }
  expect(failures, `Contrastes insuffisants :\n${failures.join('\n')}`).toEqual([]);
}

/**
 * Cibles tactiles ≥ 44 px (contrôle 32). Les liens en ligne dans un paragraphe sont
 * exclus, comme la norme WCAG 2.5.8 (exception « inline »).
 */
export async function expectTapTargets(page: Page): Promise<void> {
  const min = screensFile().accessibilite.cibleMinPx;
  const tooSmall = await page.evaluate((minPx: number) => {
    const selector = 'button, [role="button"], [role="tab"], [role="switch"], a[href], input, select, textarea';
    const offenders: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
      if (element.closest('p, li, span, label, small')) continue;
      if (rect.width < minPx || rect.height < minPx) {
        offenders.push(
          `${element.tagName.toLowerCase()}[${element.getAttribute('data-testid') ?? element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30) ?? ''}] ${Math.round(rect.width)}×${Math.round(rect.height)}`
        );
      }
    }
    return offenders.slice(0, 25);
  }, min);
  expect(tooSmall, `Cibles sous ${min} px :\n${tooSmall.join('\n')}`).toEqual([]);
}

/** Texte de l'application seule, sans la surcouche de développement. */
export async function appText(page: Page): Promise<string> {
  await settle(page);
  return page.evaluate(() => document.body.innerText.toLowerCase());
}

/** Chaque élément focusable au clavier montre un focus visible (contrôle 33). */
export async function expectVisibleFocus(page: Page, steps = 12): Promise<void> {
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  const missing: string[] = [];
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      // La barre d'outils de développement de Next.js n'appartient pas au produit.
      if (element.closest('nextjs-portal')) return null;
      const style = getComputedStyle(element);
      const hasOutline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth || '0') > 0;
      const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
      const hasRing = hasOutline || hasShadow;
      const label =
        element.getAttribute('data-testid') ??
        element.getAttribute('aria-label') ??
        element.textContent?.trim().slice(0, 30) ??
        element.tagName.toLowerCase();
      return { label, tag: element.tagName.toLowerCase(), hasRing };
    });
    if (info && !info.hasRing) missing.push(`${info.tag} « ${info.label} »`);
  }
  expect(missing, `Focus invisible sur :\n${missing.join('\n')}`).toEqual([]);
}
