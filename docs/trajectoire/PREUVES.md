# Trajectoire Vivante — registre de preuves (T0 → T3)

Chantier valide le 2026-09-30. Chaque gate du dossier normatif est associe a un
fichier de preuve **produit par une execution reelle**, pas a une intention.

Toutes les mesures de rendu ont ete faites sur le serveur de **production**
(`next build` + `next start` sur :4028), pas sur le serveur de dev.

## Resultat des gates

| Gate | Exigence | Mesure | Verdict | Preuve |
|------|----------|---------|---------|--------|
| T0 | domaine pur teste | 121 tests / 9 fichiers verts | OK | `preuves/T0-vitest.out` |
| T1 | accessibilite | Lighthouse a11y = **1.0 (100)** | OK | `preuves/T1-lighthouse-a11y.json` |
| T1 | 60 fps au drag mobile | 60 fps moyen et median, pire frame 17 ms, 0 image ratee | OK | `preuves/T1-fps-drag-mobile.out` |
| T1 | clavier | fleches / Home / End / Page Up-Down operants, ARIA en duree lue | OK | `preuves/T1-clavier.out` |
| T1 | debounce narration | 60 `pointermove` → 1 requete, 0 reponse 429 | OK | `preuves/T1-debounce.out` |
| T2 | aucun plan sans source | 8/8 cartes avec sources, 0 « Sans source », 0 erreur provenance | OK | `preuves/T2-T3-rendu.out` |
| T3 | 1 trace « a ton echelle » visible sur 3 zones | journee 1, raid 1, expedition 2 | OK | `preuves/T2-T3-rendu.out` |
| — | migration SQL | 2 migrations ecrites, **non executees** (pas d'environnement Supabase valide) | Partiel | `supabase/migrations/` |

## Details T3

Le gate exige un badge « a ton echelle » **visible a l'ecran**, pas seulement
present dans le domaine. La preuve exige deux mesures **concordantes** : le
compteur de l'en-tete de carte et le nombre de traces portant reellement le
badge. Elles concordent sur les trois zones.

| Zone | Compteur en-tete | Badges reellement rendus | Trace mise en avant |
|------|------------------|--------------------------|---------------------|
| journee | 1 | 1 | Camille M. — Dolomites 8 h |
| raid | 1 | 1 | Youssef B. — Raid Vercors 1,5 j |
| expedition | 2 | 2 | La tribu Andes (Salkantay 6 j), Marco D. (Dolomites 5 j) |

Captures : `t3-traces-journee.png` (carte Traces, zone Journee, badge visible)
et `t3-journee.png` (vue large).

## Deux defauts reels corriges dans les donnees livrees

Les deux ont ete trouves en verifiant T3 **au rendu**, pas dans le domaine.

1. **Zone Journee structurellement vide.** Aucune graine ne tombait dans la bande
   3–12 h. Comme `atYourScale = meme zone ET score >= 0.82`, la Journee ne
   pouvait donc jamais afficher de correspondance : le gate « 3 zones » ne
   tenait qu'en theorie. Ajout de `trc-camille-m` (8 h), qui couvre toute la
   bande (score minimum 0.851 a 3 h).
2. **Graine auto-contradictoire.** `trc-youssef-b` etait etiquete `zone: 'raid'`
   avec `hours: 72` (3 j), alors que la bande raid s'arrete a 48 h : une
   expedition presentee comme un raid. Ramene a `hours: 36` (1,5 j), ce qui est
   coherent avec sa zone.

Un test de donnees livrees accompagne ces corrections :
`tests/features/trajectoire/traces.spec.ts` verifie `DEMO_TRACES` sur les 3
zones du gate, la bande Journee entiere, les 5 zones de l'axe, la coherence
`zone === zoneForHours(hours)`, et que c'est la zone — et non la seule
proximite — qui decoule le badge.

## Reproduire

```powershell
# le serveur de production, puis http://localhost:4028/trajectoire
powershell -ExecutionPolicy Bypass -File scripts/ops/essayer-trajectoire.ps1

# T0 — domaine
npx vitest run tests/features/trajectoire

# T2 + T3 — rendu (serveur demarre, build courant)
node docs/trajectoire/preuves/sonde-t2-t3-rendu.cjs

# T1 — fluidite au drag
node docs/trajectoire/preuves/sonde-t1-fps.cjs
```

## Hors perimetre (defauts preexistants, non corriges volontairement)

- `speed-insights` 404 et un 401 au chargement : nav globale Vercel et appel
  authentifie, sans lien avec la trajectoire.
- Lighthouse `label-content-name-mismatch` sur `a.lkv-nav-tab` : vient de la nav
  globale, pas de la page trajectoire.
- Migrations SQL ecrites mais **jamais executees** : aucun environnement
  Supabase valide dans ce chantier. La persistance n'a pas ete tentee.