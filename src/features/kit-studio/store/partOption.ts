// Option d'apparence (pure) : forme, module, coloris, matière, finition, accessoire.
import { PRESETS } from '../domain/catalog';
import type { AccessoryId, ColorwayId, ConfigSet, ModuleId, PartConfig, PartNameId } from '../domain/catalog';
import { toggleModule } from '../domain/attach';
import { modOn } from '../domain/parts';
import { currentKit } from '../domain/state';
import type { KitState } from '../domain/types';

export type OptionCat = 'shape' | 'mod' | 'col' | 'mat' | 'fin' | 'acc';
export type OptionReason = 'points';
export interface OptionResult { readonly state: KitState; readonly ok: boolean; readonly reason?: OptionReason }

const PARTS = ['body', 'lid', 'front', 'sides', 'hip', 'harness'] as const;
const CW_IDS: readonly string[] = ['foret', 'sauge', 'pierre', 'nuit'];

export function setPartOption(s: KitState, part: PartNameId, cat: OptionCat, value: string): OptionResult {
  const k = currentKit(s);
  const c = s.config[k.bag];
  if (cat === 'mod') {
    const m = value as ModuleId;
    const next = toggleModule(s, m, !modOn(s, m));
    return next === s ? { state: s, ok: false, reason: 'points' } : { state: next, ok: true };
  }
  if (cat === 'acc') {
    const a = value as AccessoryId;
    const acc = c.acc.includes(a) ? c.acc.filter((x) => x !== a) : [...c.acc, a];
    return { state: { ...s, config: { ...s.config, [k.bag]: { ...c, acc } } }, ok: true };
  }
  if (cat === 'col' && part === 'all' && CW_IDS.includes(value)) {
    const preset = JSON.parse(JSON.stringify(PRESETS[value as ColorwayId])) as ConfigSet;
    return {
      state: {
        ...s,
        config: { ...s.config, [k.bag]: preset },
        kits: { ...s.kits, [s.kitId]: { ...k, cw: value as ColorwayId } },
      },
      ok: true,
    };
  }
  const targets: readonly (typeof PARTS[number] | 'webbing')[] =
    part === 'all' ? PARTS : part === 'webbing' ? ['webbing'] : [part];
  const next: Record<string, unknown> = { ...c };
  for (const t of targets) next[t] = { ...(c[t] as PartConfig), [cat]: value };
  return { state: { ...s, config: { ...s.config, [k.bag]: next as unknown as ConfigSet } }, ok: true };
}
