import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/*
 * P0.17 — Un jeton CSS non defini ne casse rien. C est le pire genre de defaut.
 *
 * DECOUVERT LE 2026-09-28, en mesurant P0.14 sur 393x852 : la pastille de
 * suggestion mesurait 17px, exactement la taille de la valeur qu elle annote.
 * Le correctif de P0.14 etait ecrit depuis la veille, avec
 * `font-size: var(--lkv-text-caption)`. Il ne s applique pas.
 *
 * Cause : `.badge` fixe `font-size: var(--f-caption)`, et `--f-caption` n est
 * defini NULLE PART dans le depot. Une declaration dont une `var()` ne se
 * resout pas devient "invalide au moment de la valeur calculee" : la propriete
 * herite. `font-size` etant heritee, la pastille retombe sur la taille du
 * texte de sa cellule — 17px. Le navigateur ne signale rien : la cascade est
 * respectee, c est la valeur qui n existe pas. Un test qui lisait la feuille
 * comme du texte, ou qui sought la declaration attendue, aurait passe.
 *
 * Ce test ne verifie donc pas six cas : il verifie la CLASSE de defaut, pour
 * qu un septieme jeton fantome ne puisse plus s installer en silence.
 */

const SRC = join(__dirname, "..", "..", "..");

/** Tous les `.css` du depot source, hors node_modules. */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

/**
 * Les commentaires sont retires AVANT toute lecture. Une feuille de style
 * documente ses jetons en prose : `bottom: var(--cookie-banner-h)` ecrit dans
 * une explication est une mention, pas une declaration. Sans ce retrait, le
 * test signale des fantomes qui n existent pas et apprend a etre ignore.
 */
function sansCommentaires(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const files = cssFiles(SRC);
const sources = files.map((f) => ({
  file: relative(SRC, f).replace(/\\/g, "/"),
  css: sansCommentaires(readFileSync(f, "utf8")),
}));

/** Tout ce que le code DECLARE, tous fichiers confondus. */
const declared = new Set<string>();
for (const { css } of sources) {
  for (const m of css.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) declared.add(m[1]);
}

/**
 * Chaque `var(--x)` SANS valeur de repli. Avec un repli (`var(--x, 11px)`),
 * le navigateur retombe sur le repli : ce n est pas un defaut, c est un
 * choix explicite, et on ne le signale donc pas.
 */
const referenced: { token: string; file: string; line: number }[] = [];
for (const { file, css } of sources) {
  css.split("\n").forEach((text, i) => {
    for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,|\))/g)) {
      if (m[2] === ",") continue;
      referenced.push({ token: m[1], file, line: i + 1 });
    }
  });
}

const orphelins = referenced.filter((r) => !declared.has(r.token));

describe("P0.17 — jetons CSS references sans etre definis", () => {
  it("la feuille du preparateur est bien lue (garde-fou du test lui-meme)", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(sources.some((s) => s.file.endsWith("adventure-prep.css"))).toBe(true);
  });

  it("les commentaires CSS ne sont pas pris pour des declarations", () => {
    // `--cookie-banner-h` n est cite que dans une explication. Si le retrait
    // de commentaires regressait, ce test le verrait avant le suivant.
    expect(referenced.some((r) => r.token === "--cookie-banner-h")).toBe(false);
  });

  it("aucune var() sans repli ne pointe un jeton inexistant", () => {
    // Un seul message, liste complete : un test qui n echouerait que sur le
    // premier cas obligerait a relancer dix fois pour reparer dix fois.
    expect(orphelins.map((o) => `${o.token} -> ${o.file}:${o.line}`).join("\n")).toBe("");
  });



  it("la famille --f-* est entierement retiree, pas aliassee", () => {
    // Ces six noms venaient d un ancien jeu de jetons qui n a jamais existe
    // dans ce depot. On a decide de RECABLER les usages vers la famille reelle
    // plutot que de creer six alias : un alias aurait laisse deux verites, et
    // le prochain qui aurait ajoute une regle aurait pu retoucher l une des
    // deux. La post-condition est donc une disparition complete, des deux
    // cotes : plus un usage, plus une declaration.
    const f = ["--f-body", "--f-body-md", "--f-body-sm", "--f-caption", "--f-caption-sm", "--f-h3"];
    expect("utilises : " + f.filter((x) => referenced.some((r) => r.token === x)).join(", ")).toBe("utilises : ");
    expect("declares : " + f.filter((x) => declared.has(x)).join(", ")).toBe("declares : ");
  });

  it("une police next/font n est jamais utilisee sans filet", () => {
    // next/font injecte une variable sur <html> a l execution : invisible pour
    // une lecture de feuille de style. Deux facon legitime de s en servir.
    //   1. tokens.css la redéclare sous le meme nom — le repli sert au rendu
    //      hors .next. C est le cas de --font-brand, --font-mono, --font-serif.
    //   2. le site la consomme avec une valeur de repli — var(--font-inter,
    //      'Inter'). C est le cas de --font-inter.
    // Ce qui est interdit est le troisieme cas : la variable utilisee SANS
    // repli et SANS declaration. C etait exactement le defaut de --font-serif
    // avant correction, qui rendait .font-serif-lkv invalide dans son
    // integralite : les 8 appelees retombaient sur la police par defaut du
    // navigateur, sans jamais atteindre Instrument Serif.
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    const runtime = [...layout.matchAll(/variable:\s*'(--[A-Za-z0-9_-]+)'/g)].map((m) => m[1]);
    expect(runtime.length, "next/font doit exposer des variables").toBeGreaterThan(0);
    const sansFilet = runtime.filter(
      (v) => !declared.has(v) && referenced.some((r) => r.token === v),
    );
    expect(sansFilet.join(", ")).toBe("");
  });

  it("la pastille de suggestion est plus petite que la valeur qu elle annote", () => {
    // Le defaut P0.14 lui-meme, au niveau du code : une mention qui rend la
    // meme taille que la valeur se lit comme une troisieme valeur.
    const css = sources.find((s) => s.file.endsWith("adventure-prep.css"))!.css;
    const regle = /\.badge\s*\{[^}]*\}/.exec(css);
    expect(regle, "la regle .badge doit exister").toBeTruthy();
    expect(regle![0]).not.toMatch(/var\(\s*--f-/);
  });
});