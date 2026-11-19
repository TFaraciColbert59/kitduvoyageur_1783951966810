# Refonte du Hub LKDV

Le chantier couvre le voyage depuis sa préparation dans Compas jusqu’au retour. Le brief du
19 novembre et son classeur restent les références pour le périmètre, les dépendances et les
critères de recette. Les statuts ci-dessous décrivent l’état constaté sur la branche.

- Branche locale : `chantier/hub-refonte-2026-11`.
- Base : `991244a2473404445dbfb03441879b92849182e4`, vérifiée sur `origin/main` le 19 novembre 2026.
  GitHub confirme que la branche `main` est protégée.
- Audit initial : `7d7ceabd9aa5a9d6959279b9961582a7466f0cbd`. Les trois commits d’écart portent sur
  l’Explorer de la communauté. `git diff --name-only 7d7ceabd..991244a` ne liste aucune modification
  du Hub, de Compas ou des migrations.
- Production servie sur `koosmoweb.fr` : build READY de `3230f88`, vérifié par
  `vercel inspect koosmoweb.fr --logs`. Le dernier build de `main`, `991244a`, a échoué.
  [Déploiement en échec](https://kitduvoyageur-1783951966810-pgp6vj5d8.vercel.app).
- Next.js 15.5.25 d’après `package-lock.json`. CI Node 22, projet Vercel Node 24.x d’après
  `vercel project inspect kitduvoyageur-1783951966810`.
- Supabase : `lekitduvoyageur2`, Paris (`eu-west-3`), PostgreSQL 17.6, PostGIS 3.3.7. Le compte
  connecté expose ce seul projet, avec la seule branche `main`. Les lectures ont porté sur les
  métadonnées du projet, le catalogue SQL et le registre des migrations.
- Les deux SHA recensent 467 fichiers SQL dans `supabase/migrations`. Le lecteur du registre
  retient les 460 fichiers avec un préfixe de version à 14 chiffres. Sept fichiers Explorer v2
  utilisent un préfixe à huit chiffres. Le rapport conserve ces sept fichiers à part du résultat
  du lecteur.

## P00 · Référence et environnement

| ID | État | Résultat ou condition de validation |
| --- | --- | --- |
| P00-01 | Vérifié | Références Git, Vercel et PostgreSQL établies. Branche isolée créée. Voir les références en tête du dossier. |
| P00-02 | Bloqué | Le seul projet Supabase accessible est la production. Le worktree hérite d’un lien CLI versionné vers ce projet. Les fichiers de lien ont été retirés de la branche. Le build local utilise une URL de boucle locale et un identifiant factice. Le checkout historique demeure intact. Valider la cible et les identités de recette avant le premier scénario connecté. |
| P00-03 | En cours | Les logs Vercel de `991244a` confirment un worker tué par SIGKILL avec événement OOM sur 2 cœurs et 8 Go. Rejeu macOS mesuré ci-dessous. Une mesure sur Linux à capacité équivalente reste nécessaire. |
| P00-04 | En cours | Next utilise la racine du checkout pour les traces et Turbopack. Le Studio est déjà chargé dynamiquement côté client, mais sa donnée est résolue au chargement de la page Hub. Vérifier la marge par trois builds à ressources comparables à Vercel. |
| P00-05 | En cours | Installation verrouillée sur Node 22.23.3 et npm 11.19.1. Tests Hub/Compas rétablis. Typage global encore en échec. |
| P00-06 | En cours | Les variables Supabase sont déclarées conjointement pour Production, Preview et Development dans les métadonnées Vercel. La destination effective de Preview reste à confirmer. Matrice par widget et vérification des fournisseurs à poursuivre en recette. |
| P00-07 | En cours | Le tracer SSR existe déjà (`src/lib/perf/ssrTrace.ts`). Établir la mesure de départ sur les parcours authentifiés en recette. |
| P00-08 | Bloqué | Le dernier passage de la chaîne de sauvegarde est vert avec le dump et la publication d’artefact ignorés. Aucun artefact associé. La rétention configurée est de 7 jours. Vérifier une sauvegarde exploitable, puis mesurer la restauration sur une copie autorisée. |
| P00-09 | Bloqué | Build de recette, environnement isolé, mesures initiales authentifiées et restauration restent ouverts. |

### Rejeu initial

```sh
npm ci --no-audit --no-fund
npm test -- src/features/hub/__tests__ src/features/compas/__tests__ tests/hub tests/adventure-intelligence/hub-mounting.spec.ts --maxWorkers=2
```

Vitest sur `991244a` : 243 fichiers réussis sur 244, 4 781 tests réussis sur 4 786.
Les cinq échecs se trouvent dans `src/features/compas/__tests__/nativeLocalizations.test.ts`.
Les six chaînes de raccourcis ont été ajoutées au fichier Android par défaut, sans équivalent
dans les cinq locales déclarées. L’ancienne assertion limite encore les chaînes visibles au
nom de l’application et au titre de l’activité.

- **Build de référence · FAIL.** Commande Vercel `NODE_OPTIONS=--max-old-space-size=8192 next build --no-lint`
  sur le SHA de départ, Node 24.22.3, macOS arm64, 8 cœurs et 8 Gio. Compilation réussie en 90 s,
  puis échec TypeScript. Durée totale 181,6 s. Pic de somme RSS échantillonnée à 1 Hz de l’arbre
  de processus : 2 085 488 Kio (environ 2 Gio). Cette mesure compte les pages partagées par
  processus et diffère du compteur mémoire du conteneur Vercel. Le manque de mémoire est
  établi par les logs Vercel, tandis que la mesure locale établit un second blocage du build.
- **TypeScript · FAIL.** Le commit `b7260803` avait retiré le banc Compas et la fixture Communauté
  toujours importés. Restauration depuis son parent `10a71a0c`, avec contrôle local de
  `DATABASE_URL` à l’entrée du banc Compas. Le contrat du moteur carte correspond désormais aux
  méthodes réellement utilisées. `npm run type-check` a encore signalé 59 diagnostics,
  dans les contrats Carnet et Communauté (création, Explorer, fil et fixtures).
  [CI de référence](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/44497010870).
- **Vitest ciblé · PASS.** 244 fichiers et 4 786 tests réussis après ajout des libellés de
  raccourcis Android dans les cinq locales et vérification des références de `shortcuts.xml`.
  Les assertions lisent les ressources. Le rendu Android reste à tester sur appareil.
- **Lint des correctifs et découverte Playwright · PASS.** ESLint ciblé vert.
  `playwright test --config=playwright.compas.config.ts --list` découvre les deux tests.
  L’exécution E2E avec PostgREST et PostgreSQL reste à faire.
- **Sauvegarde · preuve incomplète.** Le run s’est terminé sans client PostgreSQL, sans dump
  chiffré et sans artefact. [Exécution GitHub](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/44506340250).

## P01 · Constat de registre

L’API de métadonnées Supabase a retourné 422 versions. Le catalogue montre que le registre ne
contient ni `20261114120000`, ni `20261114120001`, ni de ligne portant le nom de l’un des deux
fichiers en collision. Les objets principaux des deux fichiers sont absents en production
(préférences sportives et leur exposition dans la vue, tables de confidentialité, visibilité
par défaut et politiques nommées de sessions). La contrainte de visibilité accepte déjà
`collective_anonymized`. La preuve porte sur ces objets, pas sur l’équivalence complète du DDL.

La branche attribue `20261114120001` au fichier de confidentialité `p01_privacy_zones_and_visibility`
et conserve l’ordre G01 puis P01. Le diff Git indique un renommage à 100 %. La suite
`tests/ops/migrationsAlignment.spec.ts` et `tests/ops/migrationVersions.spec.ts` passe (5 tests).

`node scripts/db/migrations-alignment.mjs <export CSV du registre>` rapporte 386 versions
alignées, neuf correspondances par nom à une autre version, 65 fichiers sans correspondance
et 27 entrées du registre sans correspondance. Ce résultat classe des versions et des noms.
La comparaison des définitions et le rejeu en recette restent ouverts.

## Ordre d’implémentation

1. **P00–P01 · Socle.** Mesurer le build et les parcours initiaux. Comparer migrations et DDL en
   lecture seule, puis vérifier en recette les accès par acteur et les migrations additives.
2. **P02–P05 · Données et terrain.** Continuer à partager `getHubAdventureData` avec
   `src/features/compas/server/getCompasData.ts`. Valider l’identité canonique de l’aventure,
   la séparation prévu/réel et les révisions de tracé avant de stabiliser le résumé. Vérifier
   fournisseurs, suivi et reprise hors ligne. Évaluer Rust après profilage et parité TypeScript.
3. **P06–P07 · Cockpit.** Intégrer une grille mobile en gardant le menu de l’application et l’accès
   dédié au Kit Studio. Donner le même poids à Météo et Budget. Afficher la carte et les étapes
   avec une indication de jour, puis Carnet, Kit, Paperasse et Groupe. Utiliser un tiroir partagé
   de 90 % du viewport avec retour, restauration du focus et respect de la réduction des animations.
   Brancher les actions sur les contrats existants, avec des états explicites pour donnée vide,
   dépassée, indisponible ou privée.
4. **P08–P09 · Parcours complet.** Tester départ, activité, arrivée et retour, en ligne et hors ligne.
   Couvrir les voyages de 2 h à 30 j, les rôles, la concurrence et les appareils réels. Remplir la
   preuve par ID après chaque vérification. Préparer la livraison réversible après les cinq passes.
