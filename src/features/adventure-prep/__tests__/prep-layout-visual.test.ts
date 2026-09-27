import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Ancrage plein ecran du preparateur.
 *
 * Ces tests lisent la feuille de style comme du texte : le repo n'a ni jsdom
 * ni testing-library, et le defaut qu'ils verrouillent est purement CSS
 * (position, defilement, opacite). Le harnais est donc le meme que
 * `prep-body-layout.test.ts` et `prep-contrast.test.ts`.
 *
 * Chaque cas correspond a un defaut REPRODUIT au navigateur en 390x844, sur
 * le serveur de dev (voir work/probe2.mjs et work/probe3.mjs).
 */

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

/** Sentinelle qui ouvre la section des correctifs d'ancrage (D1 -> D6). */
const SECTION = 'CORRECTIFS D';

interface Rule {
  selector: string;
  body: string;
}

function rules(): Rule[] {
  // Les commentaires sont retires AVANT l'analyse : sinon le texte du
  // commentaire precedent se retrouve colle au selecteur de la regle et plus
  // aucune regle n'est adressable par son nom. Les predicats des tests
  // existants enflamment ce piege en passant (ou en echouant) a vide.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }));
}

/** Regle qui declare `needle` dans sa liste de selecteurs (1re occurrence). */
function rule(needle: string): Rule | undefined {
  return rules().find((r) => r.selector.split(',').some((s) => s.trim() === needle));
}

/** Regle qui redéclare `needle` — donc celle qui gagne la cascade. */
function lastRule(needle: string): Rule | undefined {
  const matching = rules().filter((r) => r.selector.split(',').some((s) => s.trim() === needle));
  return matching[matching.length - 1];
}

/** Regle dont le selecteur normalise est exactement `needle`. */
function ruleExact(needle: string): Rule | undefined {
  return rules().find((r) => r.selector === needle);
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of body.split(';')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    out.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return out;
}

/**
 * Corps de la section ecrite pour les correctifs, sentinelle comprise.
 *
 * Les commentaires sont retires : la regle porte sur les DECLARATIONS, pas
 * sur la documentation. Un commentaire qui explique « --lkv-surface vaut
 * rgba(16,16,16,0.3) dans le theme iOS 27 » est une preuve du defaut mesure,
 * pas une couleur en dur imposee au navigateur.
 */
function fixSection(withComments = false): string {
  const at = css.indexOf(SECTION);
  if (at === -1) return '';
  const section = css.slice(at);
  return withComments ? section : section.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

describe('D1 — la carte reste ancree en bas pendant le defilement', () => {
  const map = rule('.prep-map');

  it('la carte compacte est en position sticky, ancree en bas', () => {
    // Reproduit : .prep-map est un enfant de .prep-body (overflow-y auto).
    // sticky + bottom empeche la carte de sortir PAR LE BAS ; a lui seul il ne
    // suffit pas (voir le test du `order` juste apres).
    const d = declarations(map?.body ?? '');
    expect(d.get('position')).toBe('sticky');
    expect(d.get('bottom')).toBe('0');
  });

  it('la carte est le DERNIER element flexible du corps scrollable', () => {
    // Mesure : sticky + bottom ne garantit qu'une chose - l'element ne sort pas
    // par le bas du scrollport. A l'etape 2 la carte est la 3e des 9 enfants de
    // .prep-body : le contenu du programme (rail des jours, sections) se trouve
    // SOUS elle, donc le defilement la faisait sortir par le HAUT (mesure :
    // bottom 427 au repos, 79 apres defilement). La seule correction CSS
    // possible sans toucher aux .tsx : `order` la renvoie en fin de flux, la ou
    // sticky-bottom la colle reellement au bas de l'ecran et la libere quand
    // l'on atteint la fin du programme.
    const last = lastRule('.prep-body > .prep-map:not(.prep-map--full)');
    expect(last).toBeDefined();
    expect(declarations(last!.body).get('order')).toBe('99');
    // `order` ne regit que le cas debordant. Programme plus court que la zone
    // visible => l'espace libre se distribuait sous la carte et elle flottait
    // 212 px au-dessus du bas (mesure : bottom 548 pour un bas de zone a 760).
    // Une marge haute `auto` absorbe cet espace et la repose en bas ; des que le
    // contenu deborde elle vaut 0, donc `sticky` n'est pas gene.
    expect(declarations(last!.body).get('margin-top')).toBe('auto');
  });

  it("l'overlay plein ecran reste hors de la regle d'ancrage", () => {
    // .prep-map--full est rendu A LA PLACE de la carte compacte, donc c'est
    // lui aussi un enfant direct de .prep-body : sans le `:not()`, la regle
    // d'ancrage (plus specifique que `.prep-map--full`) lui volerait son
    // `position: fixed` et le plein ecran ne couvrirait plus le viewport.
    const last = lastRule('.prep-body > .prep-map:not(.prep-map--full)');
    expect(last?.selector).toBe('.prep-body > .prep-map:not(.prep-map--full)');
  });

  it("l'overlay plein ecran n'est PAS concerne et garde son fixed", () => {
    // .prep-map--full partage la classe .prep-map : sans cette garantie, la
    // carte plein ecran heriterait du sticky et ne couvrirait plus le
    // viewport. La regle --full doit rester declaree APRES la regle .prep-map.
    const order = rules().findIndex((r) => r.selector === '.prep-map');
    const fullOrder = rules().findIndex((r) => r.selector === '.prep-map--full');
    expect(fullOrder).toBeGreaterThan(order);
    expect(declarations(rule('.prep-map--full')?.body ?? '').get('position')).toBe('fixed');
  });

  it('la carte posee se peint au-dessus du contenu qu’elle recouvre', () => {
    const d = declarations(map?.body ?? '');
    expect(Number(d.get('z-index'))).toBeGreaterThanOrEqual(2);
  });

  it('la carte posee a une ombre et un lisere de verre', () => {
    const d = declarations(map?.body ?? '');
    expect(d.get('box-shadow') ?? '').not.toBe('');
    expect(d.get('border') ?? d.get('border-top') ?? '').not.toBe('');
  });

  it('le lisere de la carte se resout : aucune ombre invalide', () => {
    // Mesure navigateur : boxShadow calcule = "none" alors que la declaration
    // existe. Cause : --prep-hairline-ink derivait de --glass-rim, dont la
    // valeur active dans le theme iOS 27 est une OMBRE (`0 0 0 0.5px ...`) et
    // non une couleur ; le color-mix devenait invalide, donc la totalite du
    // box-shadow tombait a `none` au moment du calcul. Le filet doit partir
    // d'un token toujours colorimetrique et s'inverser seul entre les themes.
    // Le PREMIER `:root` du fichier est cite dans un commentaire : on
    // retire les commentaires comme le fait `rules()` avant de le chercher.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const root = (bare.match(/:root\s*\{[\s\S]*?\}/) ?? [''])[0];
    const ink = declarations(root).get('--prep-hairline-ink') ?? '';
    expect(ink).toMatch(/color-mix\(/);
    expect(ink).toContain('var(--lkv-text-primary)');
    expect(ink).not.toContain('--glass-rim');
  });
});

describe('D2 — la page du preparateur ne defile plus', () => {
  it('le conteneur de contenu du shell perd son padding-bottom de 24 px', () => {
    // Mesure : documentElement.scrollHeight 868 pour innerHeight 844. L'excedent
    // venait du padding-bottom inline (var(--space-6)) pose par AppShell sur son
    // div de contenu. Un style inline bat une feuille de style : !important est
    // obligatoire ici, et la regle doit rester scopee au shell du preparateur.
    const target = rule('.app-shell--preparer > div');
    expect(target).toBeDefined();
    const d = declarations(target!.body);
    expect(d.get('padding-bottom') ?? '').toMatch(/^0(\s*!important)?$/);
    expect(target!.body).toMatch(/!important/);
  });

  it('le shell du preparateur verrouille sa hauteur et son debordement', () => {
    const d = declarations(rule('.app-shell--preparer')?.body ?? '');
    expect(d.get('overflow')).toBe('hidden');
    expect(d.get('max-height')).toBe('100dvh');
  });

  it('la correction reste scopee au preparateur', () => {
    // Aucune regle ne doit toucher `.app-shell` nu : les autres pages
    // (/hub, /compte, ...) gardent leur reserve de bas de page.
    const leaked = rules().filter((r) =>
      r.selector.split(',').some((s) => s.trim() === '.app-shell' || s.trim() === '.app-shell > div'),
    );
    expect(leaked).toEqual([]);
  });
});

describe('D3 — la surface des feuilles est opaque', () => {
  const sheet = rules().find((r) => r.selector.includes(':has(') && r.selector.includes('.lkv-sheet-up'));

  it('la feuille est scopingee par la presence du preparateur dans la page', () => {
    // Mesure : Radix portalise la feuille dans <body>, donc `.adventure-prep
    // .lkv-sheet-up` ne matchait jamais. Seul `:has()` permet un scope CSS
    // sans toucher au composant Sheet partage.
    expect(sheet).toBeDefined();
    expect(sheet!.selector).toMatch(/^body:has\(\.app-shell--preparer\)\s+\.lkv-sheet-up$/);
  });

  it("le fond est OPAQUE : il melange un token toujours opaque", () => {
    // Mesure : `color-mix(... var(--lkv-surface) 97%, transparent)` rendait un
    // alpha de 0.29 - le theme iOS 27 redefinit --lkv-surface en
    // `rgba(16,16,16,0.3)`, donc 97 % de 30 % reste translucide et le titre de
    // l'etape traversait toujours la feuille. Il faut melanger avec un token
    // OPAQUE pour que le resultat le soit : --lkv-text-primary est une couleur
    // pleine dans les deux themes, --lkv-surface-elevated aussi.
    const bg = declarations(sheet?.body ?? '').get('background-color') ?? '';
    expect(bg).toMatch(/color-mix\(/);
    expect(bg).toMatch(/var\(--lkv-text-primary\)|var\(--lkv-surface-elevated\)/);
  });

  it('le verre est conserve : flou et saturation restent poses', () => {
    const d = declarations(sheet?.body ?? '');
    const filter = d.get('backdrop-filter') ?? d.get('-webkit-backdrop-filter') ?? '';
    expect(filter).toMatch(/blur\(/);
  });

  it('le contenu interne de la feuille reste defilable', () => {
    // La feuille garde sa zone interne scrollable : la correction ne doit pas
    // poser overflow sur la surface, sinon une longue liste devient
    // inatteignable.
    const d = declarations(sheet?.body ?? '');
    expect(d.get('overflow') ?? '').not.toBe('hidden');
  });
});

describe('D4 — le curseur flottant de bureau reste hors perimetre', () => {
  it('aucune regle ne cible le curseur flottant', () => {
    // Mesure : le curseur est monte par src/app/layout.tsx, donc HORS de la
    // sous-arborescence `.app-shell--preparer`. Le masquer depuis cette feuille
    // imposerait un selecteur global qui casse les autres pages : on ne le
    // fait pas. Ce test verrouille ce refus de hack fragile.
    const hacks = rules().filter((r) => /CustomCursor|z-emergency|pointer-events-none\s+fixed/.test(r.selector));
    expect(hacks).toEqual([]);
  });
});

describe('D5 — les rangees de puces ne touchent plus le bord', () => {
  it('la rangee des categories et celle des jours ont un gout de bord', () => {
    const rail = ruleExact('.prep-cats, .prep-days');
    expect(rail).toBeDefined();
    const d = declarations(rail!.body);
    const pad = d.get('padding-inline') ?? d.get('padding-inline-end') ?? '';
    expect(pad).toBeTruthy();
    expect(pad).not.toMatch(/^0(px)?$/);
  });

  it('le rail defilant reserve aussi sa marge au scroll-programmatique', () => {
    const rail = ruleExact('.prep-cats, .prep-days');
    const d = declarations(rail!.body);
    expect(d.get('scroll-padding-inline') ?? d.get('scroll-padding-inline-end') ?? '').toBeTruthy();
  });
});

describe('D6 — perimetre et commandes ne se percutent plus', () => {
  it('la pastille de perimetre est bornee en largeur', () => {
    // Mesure : « Ensemble » est une ancre en haut a gauche, les commandes en
    // haut a droite. Sans borne, un libelle long (Jour 3 · 24 km) chevauche
    // « Ma position / Reduire » sur 390 px.
    const scope = lastRule('.prep-map__scope');
    const width = declarations(scope?.body ?? '').get('max-width') ?? '';
    expect(width).toBeTruthy();
  });

  it('la pastille tronque au lieu de deborder', () => {
    const pill = rule('.prep-map__scope .prep-map__glass');
    const d = declarations(pill?.body ?? '');
    expect(d.get('overflow')).toBe('hidden');
    expect(d.get('white-space')).toBe('nowrap');
  });
});

describe('les correctifs d’ancrage respectent la regle des couleurs', () => {
  it('aucune couleur en dur dans la section ecrite', () => {
    // Le fichier historique contient des rgb()/hex (tokens et surfaces
    // d avant-work). La regle porte sur MES regles : pas de #rrggbb, pas de
    // rgb(), pas de hsl() — uniquement des tokens.
    const section = fixSection();
    expect(section).not.toBe('');
    const withoutTokens = section.replace(/:root\s*\{[^}]*\}/, '');
    expect(withoutTokens).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(withoutTokens).not.toMatch(/\brgba?\(/);
    expect(withoutTokens).not.toMatch(/\bhsla?\(/);
  });

  it('la section est signalee par sa sentinelle', () => {
    expect(fixSection(true)).toContain(SECTION);
  });

  it("la sentinelle nouvre la section, elle n’est pas redit ailleurs", () => {
    // Si la sentinelle etait citee dans une regle plus haut, `indexOf` decalerait
    // le debut de la section et tous les controles ci-dessus analyseraient
    // plusieurs centaines de lignes d'historique : ils passeraient au vert sans
    // jamais regarder les bons selecteurs. La section doit s'ouvrir une fois.
    expect(css.split(SECTION).length - 1).toBe(1);
  });
});