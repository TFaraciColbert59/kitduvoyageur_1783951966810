import { describe, expect, it } from 'vitest';
import { extractControls, nameMatcher } from '../../scripts/compas/lib/inventory-core.mjs';

/**
 * Phase 7 — banc de test du Compas : l'inventaire statique des contrôles.
 * Chaque cas est une petite source TSX écrite pour l'occasion : on vérifie ce
 * qui est reconnu comme contrôle, son nom accessible (clé i18n résolue), son
 * étape et la stabilité de son identifiant.
 */
const DICT: Record<string, string> = {
  'compas.a.close': 'Fermer',
  'compas.a.less': '{label} : moins',
  'compas.a.one': '{count} jour',
  'compas.a.other': '{count} jours',
  'compas.a.search': 'Chercher',
  'compas.a.field': 'Lieu',
  'compas.a.tabA': 'Fiche',
  'compas.a.tabB': 'Historique',
};
const resolve = (key: string) => DICT[key] ?? null;
const classify = (_file: string, component: string) =>
  component === 'Kit' ? { etape: 'kit', ecran: 'kit' } : { etape: 'ou', ecran: component };

type C = {
  id: string;
  kind: string;
  tag: string;
  name: string;
  line: number;
  etape: string;
  component: string;
  classes: string[];
  gesture?: string;
  delegue?: boolean;
  matcher: string;
};
const run = (src: string, opts: Record<string, unknown> = {}): C[] =>
  extractControls(src, { file: 'X.tsx', resolve, classify, ...opts });

describe('inventaire des contrôles — reconnaissance', () => {
  it('trouve bouton, lien, champ, zone de texte, liste et résumé, avec leur ligne', () => {
    const src = `
export function A() {
  return (<div>
    <button type="button" onClick={() => 1}>Ok</button>
    <a href="/x">Lien</a>
    <input type="text" aria-label="Nom" onChange={() => 1} />
    <input type="hidden" value="x" />
    <textarea placeholder="Écris" />
    <select aria-label="Durée"><option>1</option></select>
    <details><summary>Préciser</summary></details>
    <Link href="/y">Aller</Link>
  </div>);
}`;
    const c = run(src);
    expect(c.map((x) => [x.kind, x.name])).toEqual([
      ['bouton', 'Ok'],
      ['lien', 'Lien'],
      ['champ', 'Nom'],
      ['zone de texte', 'Écris'],
      ['liste', 'Durée'],
      ['résumé', 'Préciser'],
      ['lien', 'Aller'],
    ]);
    expect(c[0].line).toBe(4);
    expect(c.every((x) => x.component === 'A' && x.etape === 'ou')).toBe(true);
  });

  it('reconnaît les rôles (switch, tab, slider) et les zones cliquables', () => {
    const src = `
function B() {
  return (<>
    <button role="switch" aria-checked aria-label="Plein soleil" onClick={f} />
    <div role="tab" onClick={f}>Onglet</div>
    <input type="range" aria-label="Verre" onChange={f} />
    <input type="checkbox" aria-label="Fait" onChange={f} />
    <div className="cp-island" onClick={f}>texte</div>
    <span>rien</span>
  </>);
}`;
    const c = run(src);
    expect(c.map((x) => x.kind)).toEqual(['interrupteur', 'onglet', 'curseur', 'case', 'zone cliquable']);
    expect(c[4].classes).toEqual(['cp-island']);
  });

  it('résout les clés i18n (aria-label, enfants, pluriels, variables, conditions)', () => {
    const src = `
function A() {
  return (<>
    <button aria-label={t('compas.a.close')} />
    <button aria-label={t('compas.a.less', { label })} />
    <button>{countText(t, locale, n, 'compas.a.one', 'compas.a.other')}</button>
    <button>{open ? t('compas.a.tabA') : t('compas.a.tabB')}</button>
    <button title="Info"><Icon name="x" /></button>
  </>);
}`;
    const c = run(src);
    expect(c.map((x) => x.name)).toEqual(['Fermer', '… : moins', '… jour', 'Fiche', 'Info']);
    const less = new RegExp(c[1].matcher);
    expect(less.test('Durée : moins')).toBe(true);
    expect(less.test('Durée : plus')).toBe(false);
    const days = new RegExp(c[2].matcher);
    expect(days.test('3 jours')).toBe(true);
    expect(days.test('1 jour')).toBe(true);
    const tabs = new RegExp(c[3].matcher);
    expect(tabs.test('Historique')).toBe(true);
  });

  it('nomme un champ par son <label> (englobant ou htmlFor)', () => {
    const src = `
function A() {
  return (<>
    <label className="cp-field"><span>{t('compas.a.field')}</span><input value={q} onChange={f} /></label>
    <label htmlFor="say">Ta demande</label>
    <textarea id="say" onChange={f} />
  </>);
}`;
    expect(run(src).map((x) => x.name)).toEqual(['Lieu', 'Ta demande']);
  });

  it('détecte les gestes : glisser, appui long, double-touche', () => {
    const src = `
function Kit() {
  const press = useLongPress(a, b);
  const tap = useDoubleTap(c);
  return (<>
    <div className="cp-row" {...press} onPointerDown={f} onPointerMove={g} onPointerUp={h} />
    <div className="cp-line" {...tap} />
    <button className="cp-sheet__grab" aria-label="Agrandir" onPointerDown={f} onPointerMove={g} />
    <DoubleTapRow className="cp-r" onDouble={() => go()} />
  </>);
}`;
    const c = run(src);
    expect(c.map((x) => [x.kind, x.gesture ?? null])).toEqual([
      ['zone cliquable', null],
      ['geste', 'appui long'],
      ['geste', 'glisser'],
      ['geste', 'double-touche'],
      ['bouton', null],
      ['geste', 'glisser'],
      ['geste', 'double-touche'],
    ]);
    expect(c.every((x) => x.etape === 'kit')).toBe(true);
  });

  it('déplie les options littérales de <Segments> et marque son bouton générique comme délégué', () => {
    const src = `
export function Segments({ options, onChange }) {
  return (<div>{options.map((o) => <button key={o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>);
}
function A() {
  return <Segments label="Onglets" value={v} onChange={set} options={[
    { id: 'fiche', label: t('compas.a.tabA') },
    { id: 'historique', label: t('compas.a.tabB') },
  ]} />;
}`;
    const c = run(src);
    expect(c.map((x) => [x.component, x.kind, x.name, x.delegue ?? false])).toEqual([
      ['Segments', 'bouton', '…', true],
      ['A', 'onglet', 'Fiche', false],
      ['A', 'onglet', 'Historique', false],
    ]);
  });

  it('déplie une liste de données connue (expansion) en un contrôle par élément', () => {
    const src = `
function A() {
  return <nav>{COMPAS_STEPS.map((s) => <button key={s.id} className="cp-step" onClick={() => go(s.id)}>{t(LABEL[s.id])}</button>)}</nav>;
}`;
    const c = run(src, {
      expansions: [
        {
          receiver: 'COMPAS_STEPS',
          items: [
            { key: 'ou', name: 'Où', etape: 'ou' },
            { key: 'kit', name: 'Kit', etape: 'kit' },
          ],
        },
      ],
    });
    expect(c.map((x) => [x.name, x.etape])).toEqual([
      ['Où', 'ou'],
      ['Kit', 'kit'],
    ]);
    expect(c[0].id).not.toBe(c[1].id);
  });
});

describe('inventaire des contrôles — contexte', () => {
  it('garde les classes sûres des éléments qui entourent le contrôle, dans son composant', () => {
    const src = `
function A() {
  return (<div className="cp-sheet__h"><span className={\`cp-side \${x}\`}><button className="cp-ibtn">Ok</button></span></div>);
}`;
    const [c] = run(src) as Array<C & { ancestors: string[] }>;
    expect(c.classes).toEqual(['cp-ibtn']);
    expect(c.ancestors.sort()).toEqual(['cp-sheet__h', 'cp-side']);
  });
});

describe('inventaire des contrôles — identifiants stables', () => {
  it("l'identifiant ne dépend pas du numéro de ligne, et départage les homonymes", () => {
    const a = run(`function A() { return <><button>Ok</button><button>Ok</button></>; }`);
    const b = run(`\n\n\nfunction A() {\n return <><button>Ok</button>\n<button>Ok</button></>; }`);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(2);
  });

  it("l'identifiant suit la clé i18n, pas le texte traduit", () => {
    const [c] = run(`function A() { return <button aria-label={t('compas.a.close')} />; }`);
    expect(c.id).toBe('X.tsx::A::button::compas.a.close');
  });

  it("refuse un composant que la classification ne connaît pas", () => {
    expect(() =>
      extractControls(`function Z() { return <button>Ok</button>; }`, {
        file: 'X.tsx',
        resolve,
        classify: () => null,
      })
    ).toThrow(/Z/);
  });
});

describe('nameMatcher', () => {
  it('tolère les espaces et ancre le nom', () => {
    const re = new RegExp(nameMatcher([['Préparer mon', { wild: true }]]));
    expect(re.test('Préparer   mon aventure')).toBe(true);
    expect(re.test('Ne pas Préparer mon aventure')).toBe(false);
  });
});
