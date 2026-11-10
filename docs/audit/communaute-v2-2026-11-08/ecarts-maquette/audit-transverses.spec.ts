import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

import {
  freezeClock,
  installCommunityV2Mock,
  waitForHydration,
} from '../../../../tests/e2e/communaute-v2.fixtures';

/**
 * Audit transversal des tiroirs Communauté v2 (ECARTS-TRANSVERSES § 6 « À vérifier ») :
 *  1. contraste AA des surtitres/libellés sur le fond **réellement rendu** (texte rendu
 *     transparent, fond échantillonné sous chaque libellé, pire pixel du 10ᵉ centile) ;
 *  2. rayon du focus clavier (N12) : le rayon calculé ne change pas au focus ;
 *  3. cibles tactiles : boîte effective (élément ∪ extension `::after`) ≥ 44 px.
 * Sortie : `audit-transverses.json`. Même mode d'emploi que `finition.spec.ts`.
 */

const BASE = process.env.FINITION_BASE ?? 'http://127.0.0.1:4029';
const OUT = join(process.cwd(), 'docs/audit/communaute-v2-2026-11-08/ecarts-maquette');
const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' });

const KINDS: Array<{ type: string; label: string; steps: number; values: Record<string, unknown> }> = [
  { type: 'post', label: 'Publication', steps: 3, values: { content: 'Belle sortie.' } },
  { type: 'story', label: 'Story', steps: 3, values: {} },
  { type: 'carnet', label: 'Carnet', steps: 4, values: { title: 'Tour', destination: 'Alpes', startDate: '2026-12-01', endDate: '2026-12-03', nbJours: 3 } },
  { type: 'sortie', label: 'Sortie', steps: 4, values: { title: 'Lac Blanc', location: 'Chamonix', date: '2027-01-16', startTime: '08:00' } },
  { type: 'kit', label: 'Kit', steps: 3, values: { name: 'Kit', items: [{ id: 'a', name: 'Tente', category: 'Abri', weightG: 1380, quantity: 1, productId: null, ownershipId: null, isChecked: false }] } },
  { type: 'club', label: 'Club', steps: 4, values: { name: 'Cordée', slug: 'cordee', activities: ['Randonnée'] } },
];

interface Finding {
  state: string;
  scheme: string;
  kind: 'contraste' | 'cible' | 'focus';
  detail: Record<string, unknown>;
}
const ONLY = process.env.AUDIT_ONLY ? new RegExp(process.env.AUDIT_ONLY) : null;
const wanted = (state: string) => !ONLY || ONLY.test(state);
const findings: Finding[] = [];
const stats = { etats: 0, libelles: 0, contrasteMin: 99, cibles: 0, ciblesSous44: 0, focus: 0, focusDeformes: 0 };

function luminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function audit(page: Page, state: string, scheme: string) {
  stats.etats += 1;
  // 1. Libellés : couleur + boîte.
  const labels = await page.evaluate(() => {
    const out: Array<{ text: string; color: string; x: number; y: number; w: number; h: number; size: number }> = [];
    // Contenu défilant passé sous le pied ou la mini-capsule : pas encore lisible, il remonte en défilant.
    const covers = ['.lkdv-cv2-footer', '.lkdv-cv2-mini-slot'].map((sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? innerHeight);
    const limit = Math.min(innerHeight, ...covers);
    document.querySelectorAll<HTMLElement>('.lkdv-cv2-sheet .lkdv-cv2-eyebrow, .lkdv-cv2-sheet .lkdv-cv2-field-label').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.bottom > limit || r.left < 0 || r.right > innerWidth || cs.visibility === 'hidden') return;
      if (el.closest('[inert], [aria-hidden="true"]')) return;
      out.push({ text: (el.textContent ?? '').trim().slice(0, 40), color: cs.color, x: r.left, y: r.top, w: r.width, h: r.height, size: parseFloat(cs.fontSize) });
    });
    return out;
  });
  if (labels.length) {
    const style = await page.addStyleTag({
      content: '.lkdv-cv2-sheet *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}.lkdv-cv2-sheet svg{visibility:hidden!important}',
    });
    await page.waitForTimeout(150);
    const png = PNG.sync.read(await page.screenshot({ animations: 'disabled', caret: 'hide' }));
    await style.evaluate((node) => (node as Element).remove());
    for (const label of labels) {
      const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(label.color);
      if (!m) continue;
      const alpha = m[4] == null ? 1 : Number(m[4]);
      const lums: number[] = [];
      // Zone du texte : sans le remplissage de la plaque (les coins arrondis d'une pilule
      // laisseraient passer le fond et fausseraient le 10ᵉ centile).
      const padX = Math.min(8, label.w / 4);
      const x0 = Math.max(0, Math.floor(label.x + padX));
      const y0 = Math.max(0, Math.floor(label.y + 2));
      for (let y = y0; y < Math.min(png.height, Math.ceil(label.y + label.h - 2)); y += 1) {
        for (let x = x0; x < Math.min(png.width, Math.ceil(label.x + label.w - padX)); x += 1) {
          const i = (png.width * y + x) * 4;
          lums.push(luminance(png.data[i], png.data[i + 1], png.data[i + 2]));
        }
      }
      if (!lums.length) continue;
      lums.sort((a, b) => a - b);
      const textRgb = [Number(m[1]), Number(m[2]), Number(m[3])];
      const worst = lums[Math.floor(lums.length * 0.1)];
      const best = lums[Math.floor(lums.length * 0.5)];
      // Texte composé sur le fond (alpha) : approximation par mélange linéaire en luminance.
      const textLum = luminance(textRgb[0], textRgb[1], textRgb[2]) * alpha + worst * (1 - alpha);
      const worstRatio = ratio(textLum, worst);
      const medianRatio = ratio(textLum, best);
      stats.libelles += 1;
      stats.contrasteMin = Math.min(stats.contrasteMin, worstRatio);
      if (worstRatio < 4.5) {
        findings.push({ state, scheme, kind: 'contraste', detail: { texte: label.text, couleur: label.color, lumFond: Number(worst.toFixed(3)), taille: label.size, pireFond: Number(worstRatio.toFixed(2)), mediane: Number(medianRatio.toFixed(2)) } });
      }
    }
  }
  // 3. Cibles tactiles.
  const small = await page.evaluate(() => {
    const sel = 'button, a[href], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=menuitemradio], input[type=checkbox], input[type=radio], select, summary';
    const res: Array<{ cls: string; label: string; w: number; h: number }> = [];
    let total = 0;
    document.querySelectorAll<HTMLElement>(`.lkdv-cv2-sheet ${sel.split(', ').join(', .lkdv-cv2-sheet ')}, .lkdv-cv2-peek ${sel.split(', ').join(', .lkdv-cv2-peek ')}`).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.left < 0 || r.right > innerWidth || getComputedStyle(el).visibility === 'hidden') return;
      if (el.closest('[inert], [aria-hidden="true"]') || (el as HTMLButtonElement).disabled) return;
      // Lien/bouton en ligne dans un paragraphe : exception WCAG 2.5.8.
      if (el.closest('p, small, label') && getComputedStyle(el).display === 'inline') return;
      total += 1;
      let w = r.width;
      let h = r.height;
      const after = getComputedStyle(el, '::after');
      if (after.content !== 'none' && after.position === 'absolute') {
        const aw = parseFloat(after.width);
        const ah = parseFloat(after.height);
        if (aw > 0 && ah > 0) {
          w = Math.max(w, aw);
          h = Math.max(h, ah);
        }
      }
      if (w < 43.5 || h < 43.5) res.push({ cls: (el.className?.toString?.() ?? '').split(' ').slice(0, 3).join(' '), label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30), w: Math.round(w), h: Math.round(h) });
    });
    return { res, total };
  });
  stats.cibles += small.total;
  stats.ciblesSous44 += small.res.length;
  for (const item of small.res) findings.push({ state, scheme, kind: 'cible', detail: item });
}

async function focusAudit(page: Page, state: string) {
  const targets = await page.evaluate(() => {
    const list: string[] = [];
    document.querySelectorAll<HTMLElement>('.lkdv-cv2-sheet .lkdv-cv2-pill, .lkdv-cv2-sheet .lkdv-cv2-chip, .lkdv-cv2-sheet .lkdv-cv2-capsule button, .lkdv-cv2-sheet .lkdv-lens-float button').forEach((el, index) => {
      if (index < 6) {
        el.setAttribute('data-audit-focus', String(index));
        list.push(String(index));
      }
    });
    return list;
  });
  for (const id of targets) {
    const result = await page.evaluate((key) => {
      const el = document.querySelector<HTMLElement>(`[data-audit-focus="${key}"]`);
      if (!el) return null;
      const before = getComputedStyle(el).borderRadius;
      return { before, el: key };
    }, id);
    if (!result) continue;
    // Focus clavier réel : Tab depuis le début jusqu'à l'élément (au plus 60 pas).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    let after: { radius: string; outline: string; focused: boolean } | null = null;
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press('Tab');
      after = await page.evaluate((key) => {
        const el = document.querySelector<HTMLElement>(`[data-audit-focus="${key}"]`);
        if (!el || document.activeElement !== el) return null as never;
        const cs = getComputedStyle(el);
        return { radius: cs.borderRadius, outline: `${cs.outlineStyle} ${cs.outlineWidth}`, focused: true };
      }, id);
      if (after) break;
    }
    stats.focus += 1;
    // Un élément sans rayon (capsule rectangulaire) qui prend 2 px au focus (règle globale
    // `*:focus-visible` de tailwind.css) n'est pas une pilule déformée : seul un rayon > 0 modifié compte.
    if (after && result.before !== '0px' && after.radius !== result.before) {
      stats.focusDeformes += 1;
      findings.push({ state, scheme: 'light', kind: 'focus', detail: { avant: result.before, auFocus: after.radius, outline: after.outline } });
    }
  }
}

test('audit transversal', async ({ browser }) => {
  test.setTimeout(900_000);
  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', deviceScaleFactor: 1 });
    const open = async (drafts: Record<string, { values: Record<string, unknown>; step: number }>, steps: () => Promise<void>) => {
      const page = await ctx.newPage();
      await installCommunityV2Mock(page, { role: 'member', appOrigin: BASE });
      await page.addInitScript(
        ([consent, d]) => {
          localStorage.setItem('lkdv_cookie_consent', consent as string);
          for (const [kind, draft] of Object.entries(d as Record<string, { values: unknown; step: number }>)) {
            localStorage.setItem(`lkdv.cv2-draft:${kind}:v1`, JSON.stringify({ version: 1, kind, updatedAt: Date.now(), values: draft.values, step: draft.step }));
          }
        },
        [CONSENT, drafts] as const,
      );
      await freezeClock(page);
      await page.goto(`${BASE}/communaute`, { waitUntil: 'domcontentloaded' });
      await page.locator('button[aria-label="Explorer et rechercher"]').first().waitFor({ state: 'visible', timeout: 30_000 });
      await waitForHydration(page, 'button[aria-label="Explorer et rechercher"]');
      void steps;
      return page;
    };
    const tabs = ['Carnets', 'Clubs', 'Sorties'];
    for (const tab of tabs) {
      if (!wanted(`explorer-${tab.toLowerCase()}`)) continue;
      const page = await open({}, async () => undefined);
      await page.getByRole('button', { name: 'Explorer et rechercher', exact: true }).click();
      await page.waitForSelector('[data-testid="communaute-v2-explore"]');
      await page.waitForTimeout(900);
      await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(900);
      await audit(page, `explorer-${tab.toLowerCase()}`, scheme);
      if (scheme === 'light' && tab === 'Carnets') await focusAudit(page, 'explorer-carnets');
      await page.close();
    }
    if (wanted('explorer-recherche')) {
      const page = await open({}, async () => undefined);
      await page.getByRole('button', { name: 'Rechercher dans la communauté', exact: true }).click();
      await page.waitForSelector('[data-testid="communaute-v2-explore"]');
      await page.waitForTimeout(900);
      await audit(page, 'explorer-recherche', scheme);
      await page.close();
    }
    for (const kind of KINDS) {
      for (let step = 0; step < kind.steps; step += 1) {
        if (!wanted(`creation-${kind.type}-etape${step + 1}`)) continue;
        const page = await open(step === 0 ? {} : { [kind.type]: { values: kind.values, step } }, async () => undefined);
        await page.getByRole('button', { name: 'Créer dans l’application', exact: true }).click();
        await page.waitForSelector('[data-testid="communaute-v2-create"]');
        await page.waitForTimeout(900);
        if (kind.label !== 'Publication') {
          await page.getByRole('tablist', { name: 'Type de création' }).getByRole('tab', { name: kind.label }).click();
          await page.waitForTimeout(700);
        }
        await audit(page, `creation-${kind.type}-etape${step + 1}`, scheme);
        if (scheme === 'light' && step === 0 && kind.type === 'post') await focusAudit(page, 'creation-post-etape1');
        await page.close();
      }
    }
    await ctx.close();
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'audit-transverses.json'), JSON.stringify({ stats: { ...stats, contrasteMin: Number(stats.contrasteMin.toFixed(2)) }, findings }, null, 2));
});
