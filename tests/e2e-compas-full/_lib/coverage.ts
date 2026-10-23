import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { RUN_DIR } from './env';

/**
 * Enregistrement de la couverture RÉELLE, worker par worker
 * (`<passage>/coverage/w<n>.jsonl`), réuni en fin de passage dans
 * `<passage>/coverage-runtime.json` (global-teardown.ts) puis croisé avec
 * l'inventaire par `scripts/compas/coverage-report.mjs`.
 */
export type RuntimeRecord = {
  chain: Array<{ tag: string; role: string | null; type: string | null; classes: string[]; name: string }>;
  ancestorClasses: string[];
  etape: string;
  ecran: string;
  path: string;
  gesture?: string;
  disabled?: boolean;
  action: string;
  verified: boolean;
  scenario: string;
  /** Identifiant d'inventaire donné par le scénario (prime sur la reconnaissance). */
  control?: string;
  /** Ce que l'assertion a vérifié, en mots. */
  effet?: string;
  at: string;
};

export function recordFile(workerIndex: number) {
  return path.join(RUN_DIR, 'coverage', `w${workerIndex}.jsonl`);
}

export function makeRecorder(workerIndex: number) {
  const file = recordFile(workerIndex);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return (r: Omit<RuntimeRecord, 'at'>) =>
    fs.appendFileSync(file, JSON.stringify({ ...r, at: new Date().toISOString() }) + '\n');
}

type Describe = Omit<RuntimeRecord, 'action' | 'verified' | 'scenario' | 'at' | 'control' | 'effet'>;
type Opts = { control?: string };
type Verify = () => Promise<unknown>;

/**
 * `cover.*` : la SEULE façon de créditer un contrôle. Chaque aide décrit le
 * contrôle, l'active, puis exécute `verify` (des `expect` sur l'EFFET attendu :
 * tiroir ouvert, valeur écrite, texte affiché…). Si l'assertion échoue, rien
 * n'est crédité et l'erreur remonte : le scénario échoue.
 */
export class Cover {
  constructor(
    private readonly page: Page,
    private readonly scenario: string,
    private readonly write: (r: Omit<RuntimeRecord, 'at'>) => void
  ) {}

  private async describe(target: Locator, gesture?: string): Promise<Describe> {
    await target.waitFor({ state: 'visible' });
    return (await target.evaluate(
      (el, g) => (window as unknown as { __cpDescribe: (e: Element, g?: string) => unknown }).__cpDescribe(el, g),
      gesture
    )) as Describe;
  }

  private async run(target: Locator, action: string, effet: string, act: () => Promise<unknown>, verify: Verify, opts: Opts = {}, gesture?: string) {
    if (!effet.trim()) throw new Error('[banc] cover : l’effet vérifié doit être décrit en mots.');
    const d = await this.describe(target, gesture);
    await act();
    await verify();
    this.write({ ...d, action, verified: true, scenario: this.scenario, effet, ...(opts.control ? { control: opts.control } : {}) });
  }

  click(target: Locator, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'clic', effet, () => target.click(), verify, opts);
  }
  fill(target: Locator, value: string, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'saisie', effet, () => target.fill(value), verify, opts);
  }
  /** Saisie touche par touche (champs qui réagissent à la frappe). */
  type(target: Locator, value: string, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'saisie', effet, async () => {
      await target.fill('');
      await target.pressSequentially(value, { delay: 15 });
    }, verify, opts);
  }
  select(target: Locator, value: string, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'changement', effet, () => target.selectOption(value), verify, opts);
  }
  check(target: Locator, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'changement', effet, () => target.click(), verify, opts);
  }
  press(target: Locator, key: string, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, `touche ${key}`, effet, () => target.press(key), verify, opts);
  }
  /** Curseur (input range) : la valeur est posée comme le ferait un glissement, avec l'événement React. */
  setRange(target: Locator, value: number, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'changement', effet, () => target.fill(String(value)), verify, opts);
  }
  /** Glisser depuis le centre du contrôle (dx, dy en px CSS), au pointeur, par petits pas. */
  drag(target: Locator, delta: { dx?: number; dy?: number }, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'glisser', effet, async () => {
      const box = await target.boundingBox();
      if (!box) throw new Error('[banc] glisser : contrôle sans boîte (masqué ?)');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await this.page.mouse.move(x, y);
      await this.page.mouse.down();
      await this.page.mouse.move(x + (delta.dx ?? 0), y + (delta.dy ?? 0), { steps: 12 });
      await this.page.mouse.up();
    }, verify, opts, 'glisser');
  }
  longPress(target: Locator, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'appui long', effet, async () => {
      const box = await target.boundingBox();
      if (!box) throw new Error('[banc] appui long : contrôle sans boîte');
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.page.waitForTimeout(700);
      await this.page.mouse.up();
    }, verify, opts, 'appui long');
  }
  doubleTap(target: Locator, effet: string, verify: Verify, opts?: Opts) {
    return this.run(target, 'double-touche', effet, () => target.dblclick(), verify, opts, 'double-touche');
  }
}
