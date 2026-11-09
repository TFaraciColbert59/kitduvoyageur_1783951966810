# Rapport de parité maquette — LKDV Control

Date : 2026-11-09 · Mode : prévisualisation de design (`CRM_DESIGN_PREVIEW=1`, hors production) · Aucune donnée réelle.

## 1. Méthode

- Harnais de prévisualisation : `src/components/data/fixtures.ts` sert les RPC `admin.*` avec les données de la maquette ; `adminRpc()` bascule en fixtures, jamais en production.
- 25 captures : 8 écrans de la maquette + drawers/formulaires (décision, membre, arrêt, palette ⌘K, tiroir générique, saisie de confirmation) + mobile SOS + 8 écrans secondaires/publics.
- Comparaison : captures 1440×1040 / 390×844, lecture des références `.dc.html` (PNG), mesures DOM (`getBoundingClientRect`, `getComputedStyle`), revues indépendantes `DIFFS_A.md` (écrans 1–4) et `DIFFS_B.md` (écrans 5–8).
- Accessibilité : `@axe-core/playwright`, WCAG 2.0/2.1/2.2 AA sur 15 écrans + SOS mobile → **0 violation** (`axe-design.json`).
- Correction : 3 agents de correction en parallèle (membre ; valider/SOS ; palette/tiroir) + corrections Lead (coque, file, journal, pôle, catalogue, commande, technique, entraînement, polices).

## 2. Résultat par écran

| Écran | Statut | Preuve |
| --- | --- | --- |
| 1 · À traiter | conforme | `01-main-1440x1040.png` |
| 2 · Carte de décision + motif/menu/drawer | conforme | `02…05-moderation*.png` |
| 3 · Fiche membre 360° + PII + drawer | conforme | `06…08-membre*.png` |
| 4 · Valider un remboursement + saisie | conforme (carte Empreinte ajoutée, voir §3) | `09-valider*.png` |
| 5 · Équipe et agents IA + arrêt | conforme | `11-equipe*.png` |
| 6 · Journal d'audit | conforme (export CSV actif) | `13-journal-1440x1040.png` |
| 7 · Barre ⌘K + tiroir | conforme (sections, voile, 720×566, tiroir 520×1040) | `14-commande*.png`, `15-commande-drawer*.png` |
| 8 · SOS mobile | conforme (route nue, 112 à 450 px, 844 px) | `16-sos-mobile-390x844.png` |
| Écrans publics/secondaires | conformes à la grammaire (pas de maquette dédiée) | `17…25-*.png` |

## 3. Écarts justifiés (assumés, documentés)

1. **Recherche d'entités dans la palette** : les sections Membres/Commandes listent des actions du registre, pas des entités (aucune RPC de recherche dans le contrat). Aucune donnée inventée ; le sous-titre métier (« 129,80 € · @claire.vercors ») n'est donc pas affiché.
2. **Carte « Empreinte » sur Valider** : ajoutée volontairement (EX-COM-03 : la validation est liée à l'empreinte exacte) ; la maquette ne la montre pas.
3. **Bandeau « base non joignable »** : visible en préversion (pas de Supabase local) ; absent en production dès que la base répond.
4. **En-tête réduit hors accueil** : les gabarits Moderation/Membre/Agents/Journal montrent seulement mode solo + avatar ; appliqué via `HeaderAccount` (accueil = en-tête complet).
5. **Carte « Votre session »** : uniquement sur l'accueil et compacte dans le rail du cas, comme les gabarits.
6. **Partage famille SOS** (lien signé sans session) : hors périmètre de cette passe ; la route interne est nue et utilisable par l'équipe.
7. **Fixtures** : les vols/données de démonstration viennent de la maquette ; aucun contenu réel n'est lu ni copié.
8. **Cibles 44 px** : appliquées aux boutons, liens d'action et champs ; quelques liens secondaires du pied d'authentification restent en flux inline (mesure `linkAction` à rejouer après build).

## 4. Écarts non justifiés ouverts

Aucun sur les 8 écrans de la maquette. Finitions secondaires : onglets de la fiche membre sur deux lignes à 1440, largeur des champs de filtre du catalogue, section « Récents » de la palette masquée sans historique. Aucun ne bloque la lecture ni l'action ; ils sont listés pour la prochaine passe.

## 5. Vérifications techniques

- `tsc --noEmit`, `next lint --max-warnings=0`, `vitest run` (93/93) : verts au moment de la remise ; build relancé après les corrections.
- Captures sans badge de développement (`devIndicators: false`), console sans erreur.
- Fichiers de design : `etat/preuves/design/` ; checklist : `etat/PARITE_MAQUETTE.md`.


## 6. Clôture

- Commit de référence : `56eea1a` (branche `crm/phase-0-preparation`).
- CI : `LKDV Control — CI` **verte** (types, lint 0 avertissement, 93 tests, build, 19 migrations + 10 suites pgTAP + rollback) ; `Lighthouse` et `iOS` verts ; `database-gates` LKDV vert.
- 25 captures régénérées après corrections ; axe 0 violation sur 15 écrans + SOS mobile.
- Aucun écart non justifié sur les 8 écrans de la maquette ; les 8 points justifiés du § 3 et les finitions du § 4 restent documentés.
