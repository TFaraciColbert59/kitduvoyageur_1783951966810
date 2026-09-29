// Recomptage MECANIQUE de CHECKLIST-PREP.md.
//
// Pourquoi ce script existe : le compteur du document etait tape a la main et
// il avait derive. Il annoncait 36 + 1 + 165 = 202 alors que le fichier
// contient 205 cases. Un total qui ne peut pas etre verifie ne prouve rien.
//
// Regle unique, la seule appliquee : faits = cases [x], partiels = [~],
// restants = [ ]. La somme DOIT egaler le nombre de cases du fichier.
//
//   node scripts/verify/checklist-recompte.mjs          -> audit, ecrit rien
//   node scripts/verify/checklist-recompte.mjs --write  -> reecrit l en-tete
//
// Deux garde-fous ont ete ajoutes apres coup, parce que le document a menti
// deux fois sans que personne ne s en apercoive :
//  1. Les caracteres CJK (chinois/japonais/coreen) se sont glisses dans le
//     texte -- ici "decoupage net" avait ete remplace par un mot chinois.
//     Un mot etranger dans une checklist francaise est invisible a la relecture
//     mais obvious des qu on le cherche. Gate bloquant.
//  2. La liste des "dements" etait ecrite en dur dans le script. Quand un
//     troisieme dement est apparu (P0.20), l en-tete du document etait deja
//     corrige a la main mais le script, lui, calculait encore 2. Les deux
//     sources disaient donc des choses differentes. Desormais la liste est
//     derivee du document.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "..", "..", "CHECKLIST-PREP.md");
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const MID = String.fromCharCode(183); // point median

const raw = readFileSync(FILE, "utf8");
const usesCRLF = raw.includes(CR + LF);
const EOL = usesCRLF ? CR + LF : LF;
const lines = raw.split(LF).map((l) => (l.endsWith(CR) ? l.slice(0, -1) : l));

const counts = { x: 0, "~": 0, " ": 0, "!": 0 };
const open = [];
const closed = [];

function mark(line) {
  const t = line.trimStart();
  if (!t.startsWith("- [")) return null;
  if (t.length < 5) return null;
  const c = t.charAt(3);
  if (t.charAt(4) !== "]") return null;
  if (!(c in counts)) return null;
  return c;
}

lines.forEach((l, i) => {
  const m = mark(l);
  if (m === null) return;
  counts[m] += 1;
  const row = "  l." + String(i + 1).padStart(4) + "  " + l.trim().slice(0, 74);
  if (m === " ") open.push(row);
  else closed.push(row);
});

const total = counts.x + counts["~"] + counts[" "] + counts["!"];

// --- Garde 1 : caracteres CJK parasites -------------------------------------
// Un ideogramme dans un document francais est toujours un bug d edition
// (copier-coller depuis un modele, ou generation de tokens), jamais du contenu.
const CJK = /[\u1100-\u11FF\u2E80-\u303F\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;
const cjkHits = [];
lines.forEach((l, i) => {
  if (CJK.test(l)) cjkHits.push({ ligne: i + 1, texte: l.trim().slice(0, 90) });
});

// --- Garde 2 : derive des "dements" ------------------------------------------
// Un item se repete sur plusieurs lignes : la case "- [~] **P0.20** ..." puis
// des lignes indentees qui racontent pourquoi. Chercher "dementi" sur la seule
// ligne de case ne trouve donc rien. On recolte le bloc entier de chaque item.
const dments = [];
let bloc = null;
const flush = () => {
  if (!bloc) return;
  if (/d[ée]menti|d[ée]mentie/i.test(bloc.texte)) dments.push(bloc.id);
  bloc = null;
};
lines.forEach((l) => {
  const t = l.trim();
  if (t.startsWith("- [")) {
    flush();
    const m = t.match(/\*\*([A-Z]*[0-9]+(?:\.[0-9]+)*[A-Z]*)\*\*/);
    if (!m) return;
    bloc = { id: m[1], texte: t };
    return;
  }
  if (bloc && t !== "") bloc.texte += " " + t;
  else if (t === "") flush();
});
flush();
const dmentsUniques = [...new Set(dments)];

// Doublons exacts dans le tableau du journal
const seen = new Map();
const dups = [];
lines.forEach((l, i) => {
  const t = l.trim();
  if (!t.startsWith("| ") || !t.endsWith("|")) return;
  const norm = t.split(" ").join("").split("-").join("").split("|").join("");
  if (norm === "") return;
  if (seen.has(t)) dups.push({ ligne: i + 1, origin: seen.get(t), texte: t });
  else seen.set(t, i + 1);
});

const coherent = total === counts.x + counts["~"] + counts[" "] + counts["!"];
// L en-tete autoritaire est la ligne « Progression » (source de verite). Le
// script matchait le premier recit historique contenant « faits » : le verdict
// « NON coherent » ne dependait donc plus de l etat reel du document.
const pIdx = lines.findIndex((l) => l.startsWith("**Progression"));
const hIdx = pIdx >= 0 ? pIdx : lines.findIndex((l) => l.includes("Comptage honnete"));
const announced = hIdx >= 0 ? lines[hIdx] : "";

// On ne compare plus la ligne entiere : l en-tete contient un recit qu aucune
// regeneration automatique ne peut refaire. On ne compare que les chiffres
// qu il annonce, et --write ne remplace que ceux-la, en gardant le texte.
const nums = (s) => {
  // Le pourcentage porte lui-meme des chiffres : on le neutralise d abord,
  // sinon le nombre du pourcentage est lu comme le total d items.
  const sansPct = s.replace(/\([\s\d.,]*%\s*\)/g, " ");
  const m = sansPct.match(/(\d+)\s*\/[^\d]*?(\d+)\s+items[\s\S]*?(\d+)\s+partiels[\s\S]*?(\d+)\s+[àa]\s+faire/);
  if (m) return [Number(m[1]), Number(m[3]), Number(m[4])];
  const m2 = s.match(/(\d+)\s+faits[\s\S]*?(\d+)\s+partiels[\s\S]*?(\d+)\s+restants/);
  return m2 ? [Number(m2[1]), Number(m2[2]), Number(m2[3])] : null;
};
const attendu = [counts.x, counts["~"], counts[" "]];
const annonce = nums(announced);
const coherentCompte = annonce !== null && annonce[0] === attendu[0] && annonce[1] === attendu[1] && annonce[2] === attendu[2];

console.log("fichier            : " + FILE);
console.log("EOL                : " + (usesCRLF ? "CRLF" : "LF"));
console.log("faits    [x]       : " + counts.x);
console.log("partiels [~]       : " + counts["~"]);
console.log("restants [ ]       : " + counts[" "]);
console.log("bloques  [!]       : " + counts["!"]);
console.log("TOTAL cases        : " + total);
console.log("coherence somme    : " + (coherent ? "OK" : "INCOHERENTE"));
console.log("");
console.log("dements derives    : " + (dmentsUniques.length ? dmentsUniques.join(", ") : "(aucun)"));
console.log("CJK parasites      : " + cjkHits.length + (cjkHits.length ? "  <-- BLOQUANT" : "  (aucun)"));
cjkHits.forEach((c) => console.log("  l." + c.ligne + "  " + c.texte));
console.log("compte annonce     : " + (annonce ? annonce.join(" / ") : "(ligne de comptage introuvable)"));
console.log("compte reel        : " + attendu.join(" / "));
console.log("coherent           : " + (coherentCompte ? "oui" : "NON, a corriger"));
if (dups.length) {
  console.log("");
  console.log("doublons exacts du journal (" + dups.length + ") :");
  dups.forEach((d) => console.log("  l." + d.ligne + " doublon de la l." + d.origin + "  " + d.texte.slice(0, 70)));
}
console.log("");
console.log("fermes (" + closed.length + ") :");
closed.forEach((c) => console.log(c));
console.log("");
console.log("ouverts (" + open.length + ") :");
open.forEach((o) => console.log(o));

if (process.argv.includes("--write")) {
  if (hIdx < 0) { console.log(""); console.log("ECHEC : ligne de comptage introuvable"); process.exit(1); }
  if (coherentCompte) { console.log(""); console.log("deja a jour, rien ecrit."); process.exit(0); }
  // On ne touche qu aux trois nombres, jamais au recit qui les accompagne.
  if (pIdx >= 0) {
    const pct = ((counts.x / total) * 100).toFixed(1).replace(".", ",");
    lines[hIdx] = lines[hIdx]
      .replace(/(\d+)\s*\/(\d+)\s+items/, counts.x + " / " + total + " items")
      .replace(/\([\d.,]+\s*%\)/, "(" + pct + " %)")
      .replace(/(\d+)\s+partiels/, counts["~"] + " partiels")
      .replace(/(\d+)\s+[àa]\s+faire/, counts[" "] + " à faire")
      .replace(/(\d+)\s+bloqués/, counts["!"] + " bloqués");
  } else {
    lines[hIdx] = lines[hIdx]
      .replace(/(\d+)\s+faits/, counts.x + " faits")
      .replace(/(\d+)\s+partiels/, counts["~"] + " partiels")
      .replace(/(\d+)\s+restants/, counts[" "] + " restants");
  }
  writeFileSync(FILE, lines.join(EOL), "utf8");
  console.log("");
  console.log("l." + (hIdx + 1) + " reecrite.");
}

// Le CJK est bloquant meme sans --write : un document de preuve qui contient
// un mot chinois n est plus une piece de preuve. On sort en erreur.
if (cjkHits.length) {
  console.log("");
  console.log("ECHEC : " + cjkHits.length + " ligne(s) contiennent des caracteres CJK parasites.");
  process.exit(1);
}
