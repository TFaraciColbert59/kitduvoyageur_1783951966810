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

describe('D1 — la carte est dans le flux, jamais posee par-dessus', () => {
  const map = rule('.prep-map');

  it('la carte compacte ne sort plus du flux', () => {
    // Mesure navigateur (430x932) : en `position: sticky` + `bottom: 0`, la
    // carte se collait au bas du scrollport et RECOUVRAIT Arrivee, Date,
    // Temps, Participants et le badge de duree. `elementsFromPoint` au centre
    // de `button.prep-cell` et de la ligne Participants renvoyait
    // `div.prep-map__canvas` — donc non seulement illisible, mais incliquable
    // par la carte. La seule construction qui ne peut pas recouvrir ses
    // voisins est le flux normal.
    const d = declarations(map?.body ?? '');
    expect(d.get('position')).toBe('static');
    expect(d.get('bottom')).toBe('auto');
  });

  it('la carte est le DERNIER element du corps scrollable', () => {
    // `order` reste : la carte est la 3e des 9 enfants de `.prep-body`, donc
    // en flux simple elle s'intercalerait entre le bloc de depart et le
    // programme. En fin de colonne elle ferme l'ecran comme un annexe de
    // contexte. Ce que `order` ne doit PLUS faire, c'est se combiner avec un
    // positionnement hors flux.
    const last = lastRule('.prep-body > .prep-map:not(.prep-map--full)');
    expect(last).toBeDefined();
    expect(declarations(last!.body).get('order')).toBe('99');
  });

  it("la regle d'ancrage ne repousse plus la carte vers le bas", () => {
    // `margin-top: auto` absorbeait tout l'espace libre du corps flex, donc la
    // carte se posait au milieu du cadre et flottait 212 px au-dessus du bas
    // (mesure : bottom 548 pour un bas de zone a 760). En flux, l'espace se
    // distribue normalement et la carte garde sa place dans le programme.
    const last = lastRule('.prep-body > .prep-map:not(.prep-map--full)');
    expect(declarations(last!.body).get('margin-top')).toBeUndefined();
  });

  it("l'overlay plein ecran reste hors de la regle d'ancrage", () => {
    // .prep-map--full est rendu A LA PLACE de la carte compacte, donc c'est
    // lui aussi un enfant direct de .prep-body : sans le `:not()`, la regle
    // d'ancrage (plus specifique que `.prep-map--full`) lui volerait sa mise
    // en page et le plein ecran ne couvrirait plus le viewport.
    const last = lastRule('.prep-body > .prep-map:not(.prep-map--full)');
    expect(last?.selector).toBe('.prep-body > .prep-map:not(.prep-map--full)');
  });

  it("l'overlay plein ecran n'est PAS concerne et garde son fixed", () => {
    // .prep-map--full partage la classe .prep-map : sans cette garantie, la
    // carte plein ecran heriterait du flux et ne couvrirait plus le
    // viewport. La regle --full doit rester declaree APRES la regle .prep-map.
    const order = rules().findIndex((r) => r.selector === '.prep-map');
    const fullOrder = rules().findIndex((r) => r.selector === '.prep-map--full');
    expect(fullOrder).toBeGreaterThan(order);
    expect(declarations(rule('.prep-map--full')?.body ?? '').get('position')).toBe('fixed');
  });

  it('la carte garde un fond opaque, jamais translucide', () => {
    // `--lkv-surface` vaut `rgba(16,16,16,0.3)` dans le theme iOS 27 : la
    // carte laissait donc traverser la photo d'arriere-plan et devenait un
    // trou noir au-dessus d'un texte clair. Elle recompose sa teinte sur un
    // fond opaque via `--prep-map-bg`.
    const d = declarations(map?.body ?? '');
    expect(d.get('background-color')).toBe('var(--prep-map-bg)');
  });

  it('la carte se peint au-dessus de ses voisins de flux', () => {
    const d = declarations(map?.body ?? '');
    expect(Number(d.get('z-index'))).toBeGreaterThanOrEqual(2);
  });

  it('la carte a une ombre et un lisere de verre', () => {
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


  it("le fond vient d'un token sombre dedie, pas d'un melange", () => {
    // Mesure : la feuille composait son fond avec
    // `color-mix(--lkv-surface-elevated 86%, --lkv-text-primary)`. Or ces deux
    // variables n'ont PAS la meme polarite dans le preparateur : il force un
    // texte blanc (polarite claire) dans un theme `light` dont la surface
    // elevee est blanche. Melange blanc + blanc = blanc pur, et le texte blanc
    // disparaissait (contraste 1:1, mesure via CDP). Le fond doit venir d'un
    // token SOMBRE dedie (--prep-sheet-bg), pas d'un melange de deux tokens de
    // polarite opposee. Son alpha est regle par D7.
    const bg = declarations(sheet?.body ?? '').get('background-color') ?? '';
    expect(bg).toBe('var(--prep-sheet-bg)');
    const tokens = css;
    expect(tokens).toMatch(/--prep-sheet-bg:\s*#[0-9a-fA-F]{3,8};/);
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

describe('D7 - le verre du tiroir est reel, pas annonce', () => {
  const sheet = rules().find((r) => r.selector.includes(':has(') && r.selector.includes('.lkv-sheet-up'));

  /** Alpha d'un hex 8 caracteres, ou null si le token n'en porte pas. */
  function alphaOf(token: string): number | null {
    const m = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(token.trim());
    return m ? parseInt(m[1], 16) / 255 : null;
  }

  function sheetToken(): string {
    return /--prep-sheet-bg:\s*(#[0-9a-fA-F]{3,8});/.exec(css)?.[1] ?? '';
  }

  it('le fond du tiroir laisse passer la page', () => {
    // Mesure au navigateur, tiroir "Ou tu pars" ouvert sur /prepare : la
    // feuille portait `backdrop-filter: blur(14px) saturate(1.8)` mais
    // `--prep-sheet-bg` valait `#1c202b`, opaque a 100 %. Un flou pose derriere
    // un aplat opaque ne montre rien : le tiroir s'affichait en dalle sombre
    // alors que la demande "liquid glass" portait deja sur lui. Le token
    // reste UN SEUL hex sombre - le melange de deux tokens de polarite
    // opposee reste interdit, cf. D3 - mais il porte enfin un alpha.
    const alpha = alphaOf(sheetToken());
    expect(alpha).not.toBeNull();
    expect(alpha as number).toBeLessThan(1);
  });

  it('le verre reste assez dense pour garder le texte lisible', () => {
    // Le point de non-retour mesure par le passage precedent : sous ~0.55 le
    // titre d'etape traversait la feuille. La plage verrouille les deux
    // contraintes - translucide ET lisible - pour qu'une future retouche ne
    // puisse pas traded l'une contre l'autre.
    const alpha = alphaOf(sheetToken());
    expect(alpha).not.toBeNull();
    expect(alpha as number).toBeGreaterThanOrEqual(0.62);
    expect(alpha as number).toBeLessThanOrEqual(0.86);
  });

  it('le flou ET la saturation restent poses : le verre ne suffit pas au fond', () => {
    const d = declarations(sheet?.body ?? '');
    const filter = d.get('backdrop-filter') ?? d.get('-webkit-backdrop-filter') ?? '';
    expect(filter).toMatch(/blur\(/);
    expect(filter).toMatch(/saturate\(/);
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

describe('D8 — aucun texte du preparateur ne repose sur un aplat clair', () => {
  // Defaut REPRODUIT au navigateur en 393x852 : le message « Aucune activite du
  // catalogue ne repond a cette description » sortait en rgba(255,255,255,.71)
  // sur un fond srgb(.939,.957,.950), soit #F0F4F2. Contraste ≈ 1,2:1 :
  // invisible. Cause : `.prep-note` melangeait --lkv-action a --prep-mix-light,
  // et --prep-mix-light vaut #fff.
  it('D8-01: .prep-note ne melange plus sa couleur a un blanc', () => {
    const found = rule('.prep-note');
    expect(found).toBeDefined();
    const decl = declarations(found!.body);
    expect(decl.get('background-color') ?? '').not.toContain('--prep-mix-light');
  });

  it('D8-02: .prep-note pose son fond sur le meme verre que les autres', () => {
    const found = lastRule('.prep-note');
    expect(found).toBeDefined();
    const decl = declarations(found!.body);
    expect(decl.get('background-color')).toBe('var(--prep-glass-bg)');
  });

  it('D8-03: le texte y reste lisible sur la photo', () => {
    const found = lastRule('.prep-note');
    expect(declarations(found!.body).get('color')).toBe('var(--glass-label)');
  });
});

describe('D10 — l etat inactif et les bords de rail se lisent', () => {
  // Mesure au navigateur en 393x852, sur /prepare?nouvelle=1 : le CTA
  // « Continuer », inactif faute de selection, sortait en
  // `color: rgb(16,16,16)` sur `background: rgba(245,245,247,0.92)` avec
  // `opacity: 0.45` — le bouton clair de l'app, pose tel quel sur le verre
  // sombre du preparateur. Le texte disparaitait dans un aplat grisatre.
  it('D10-01: le CTA inactif garde une encre lisible', () => {
    const found = rule('.prep-footer__primary:disabled');
    expect(found).toBeDefined();
    const decl = declarations(found!.body);
    expect(decl.get('opacity')).toBe('1');
    expect(decl.get('color')).toBe('var(--lkv-text-subtle)');
  });

  it('D10-02: le CTA inactif ne repose pas sur le bouton clair de l app', () => {
    const found = rule('.prep-footer__primary:disabled');
    expect(declarations(found!.body).get('background-color') ?? '').not.toContain('#fff');
    expect(declarations(found!.body).get('background-color') ?? '').toContain('--prep-glass-bg');
  });

  // Mesure sur la meme page : la derniere puce du rail de familles etait coupee
  // net au bord droit, sans gout de fin — « Neige » se lisait « Neig ». La
  // note D5 avait ecarte le masque parce qu'il degrade ombres et anneaux de
  // focus ; on le limite donc a l'arete droite, la ou il n'y a pas d'ombre
  // portee a preserver.
  it('D10-03: le rail de familles se fond au bord droit', () => {
    const found = rule('.prep-cats');
    const mask = declarations(found!.body).get('mask-image') ?? '';
    expect(mask).toContain('linear-gradient');
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
