# Revue indépendante T05 — contrat serveur v2

10 octobre 2026, Europe/Paris ; lecture locale de `v2Contract.ts`,
`v2RuleRegistry.ts`, `v2Contract.spec.ts` et `t05-contract.md`. Aucun test
relancé, aucune attribution, migration, activation ou édition de code.
Les 86 succès rapportés (44 contrat + 42 annexe) ne sont pas des exécutions
de ce reviewer.

**Verdicts conformité et qualité : correction demandée sur l'interprétation
historique des versions avant de considérer le contrat de publication terminé.**
La tranche reste fermée et non raccordée au moteur legacy : pas de régression
de production actuelle identifiée.

## Constat

**[P2] Valider chaque archive contre sa propre référence immuable.**
`src/features/progression/server/v2RuleRegistry.ts:64` cherche le montant
approuvé dans l'unique `draftRegistry` importé. Les contrôles de montants,
familles, allocations, count caps et family caps à `:65`–`:76` utilisent cette
même référence pour toutes les versions, y compris retired. La sélection à
`:104` valide toutes les archives avant de rechercher la date métier.

Ainsi une évolution autorisée de barème en 2.1 nécessite de modifier la
référence courante ; la règle 2.0 pourtant publiée avec ses valeurs d'origine
est alors rejetée par Zod. Une réalisation reçue tardivement avec date métier
2.0 ne peut plus conserver son interprétation d'origine. Inversement le
contrat courant accepte les noms 2.1/2.2 mais leur impose les montants 2.0.
Cela contredit l'objectif T05 de sélection versionnée et la gouvernance des
anciens gains, malgré une sélection d'intervalle correcte après validation.

Le test de changement de version
`tests/features/progression/v2Contract.spec.ts:79` utilise des montants et
allocations identiques pour 2.0 et 2.1 ; il ne révèle pas ce cas.

Correction attendue : conserver une référence serveur revue et immuable par
version (ou un chemin validé équivalent pour archives), refuser les versions
inconnues et confronter chaque archive à sa référence propre. Ajouter un test
avec deux barèmes réellement différents, un fait reçu tardivement, puis
vérifier que l'ancien montant demeure sélectionné et que toute mutation de
l'une des deux archives est refusée. Ne pas remplacer ce contrôle par la
confiance dans un payload externe ou une simple version déclarée.

## Points conformes

Dates UTC réellement valides et non normalisées silencieusement ; date future
refusée ; intervalles non vides et bornes `[start,end)` ; chevauchement refusé
sans priorité arbitraire ; seuils historiques conservés ; scopes communs et
clés exactes ; compétences entières et somme 100 ; unités distinctes ;
commercial, ligues et 1 km structurellement fermés. Le module est server-only
et ne réalise aucune écriture ni replay historique. L'immutabilité persistée
et les preuves source demeurent explicitement T06–T09, pas acquises ici.

## Relecture du correctif — références par version

**Constat P2 : traité.** Le schéma prend désormais un catalogue de références
revues côté serveur et choisit la référence par `registry.version`. Une
version absente ou dont la référence porte une autre version est refusée.
Les montants, familles, poids et caps de chaque archive sont comparés à leur
référence propre, puis la sélection reste fondée sur la date métier.

Le catalogue réel par défaut contient uniquement 2.0. Le paramètre de
références explicites sert à des références serveur de confiance ; aucun
endpoint recevant des références du client n'est ajouté. Toute publication
future doit conserver la référence 2.0 et ajouter une release revue distincte,
sans écraser ce catalogue historique.

Le nouveau test utilise une fixture 2.0 à 45 XP et une fixture 2.1 à 46 XP,
vérifie le montant ancien pour une arrivée tardive, le montant nouveau à sa
date d'effet, refuse une archive ancienne modifiée et refuse 2.1 sans référence
revue. Les anciennes assertions d'intervalle et de chevauchement reçoivent un
catalogue explicite synthétique. Aucune référence 2.1 réelle ni activation
n'est ajoutée à l'application.

Preuves rapportées par l'orchestrateur, non relancées par le reviewer : test
ajouté rouge (1 échec, 44 succès), puis **87 tests réussis dans deux suites**
après correction. **Verdicts finaux conformité et qualité : acceptables pour
cette tranche T05 fermée.** Aucun nouveau défaut actionnable relevé dans le
correctif ; branchement, provenance/immutabilité SQL et dépendances P0 restent
les conditions documentées du programme.

## Renforcement final des contrats de preuve

Relecture du complément : xp (formules incluses), claim_groups,
proof_requirements et activation_conditions sont désormais comparés à leur
référence de version. Le fingerprint trie récursivement les clés d'objets et
préserve l'ordre des tableaux ; une différence de mise en ordre des clés JSON
ne modifie pas le contrat, une formule ou un scope différent le modifie.
Les contrôles précédents de montants, poids et caps sont conservés. Les deux
tests adversariaux altèrent le palier de durée 40→41 et le scope de claim.
**Revue du complément acceptable, aucun nouveau défaut actionnable.** Les
deux échecs avant correctif et 45 succès sont rapportés par l'orchestrateur ;
ses vérifications finales en cours ne sont pas déclarées réussies ici.
