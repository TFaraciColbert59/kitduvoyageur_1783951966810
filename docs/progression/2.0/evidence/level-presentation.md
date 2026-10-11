# T05 — Présentation des niveaux sans pouvoirs ni promesses financées

Vérification du 10 octobre 2026, 18:49 Europe/Paris, environnement local
`/workspace/kitduvoyageur_1783951966810`, base de travail
`d8aeac7e0873af4084b5749e0db772e34014ed85`. Tranche préparée sans commit ; le commit
d’intégration doit être renseigné par l’orchestrateur dans le suivi du chantier.

## Décision et portée

L’économie § « Niveaux et identité » prévaut sur les anciennes descriptions :
aucun niveau ne certifie une autonomie alpine, un rôle professionnel ou une
permission de modération. Les fonctions essentielles, le GPX, l’entraide et la
création de sortie restent indépendants des XP. Les avantages commerciaux
requièrent leurs propres preuves et leur financement.

Les descriptions et les listes `perks` des dix entrées `LEVEL_TIERS` présentent
désormais seulement un repère personnel et un titre descriptif. Les dix titres
historiques, badges, bornes minimales et maximales sont conservés exactement.
Aucune fonction de calcul, permission, émission, donnée historique ou flag n’a
été modifié. Les commentaires d’invariants distinguent XP, fidélité, parts
économiques et crédit boutique ; le classement à 1 km reste fermé.

Cette sous-tâche indépendante prépare T05 : elle ne prouve ni la sortie de P0,
ni le gel complet du contrat économique, ni une activation de P1.

## Contrôles exécutés

- Avant modification : `npm test -- tests/features/progression/levelPresentation.spec.ts`
  retourne 12 succès et 10 échecs attendus sur les anciennes promesses.
- Après modification : `npm test -- tests/features/progression/levelPresentation.spec.ts tests/features/progression/canonicalDto.spec.ts`
  retourne **37 tests réussis, 2 fichiers réussis**, code de sortie 0.
- Les 22 tests de présentation vérifient les identités historiques, chaque
  frontière inférieure et supérieure, le point précédant chaque nouveau niveau,
  les points négatifs/fractionnaires et le niveau maximal ; chaque palier ne
  promet que les deux éléments descriptifs, sans qualification ni privilège.
- Relecture du diff : modifications limitées aux textes des paliers et aux
  commentaires de types ; fonctions de calcul inchangées.
- `git diff --check` : code de sortie 0.

## Limites

Les tests de texte protègent les promesses présentes dans ces constantes ; ils
ne démontrent pas à eux seuls l’absence de contrôle d’accès par XP ailleurs dans
l’application. Aucun navigateur ou téléphone réel n’a été exécuté pour cette
tranche de texte. Build, types globaux, vérifications SQL, intégration et
déploiement relèvent du jalon de l’orchestrateur et ne sont pas déclarés réussis
ici. L’avertissement existant de chargement Vite CommonJS/ESM reste présent ; il
n’empêche pas l’exécution des tests ciblés.
