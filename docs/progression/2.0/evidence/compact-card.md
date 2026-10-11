# T10 — Résilience de la carte compacte (tranche partielle)

Date : 2026-10-10, contrôle ciblé à 20:46:39 UTC (22:46:39 Europe/Paris).
Environnement : workspace Linux `/workspace/kitduvoyageur_1783951966810`, Vitest 4.1.11 + jsdom ; API et identité simulées, aucun service externe appelé.
Base observée : `d8aeac7e0873af4084b5749e0db772e34014ed85`. Modifications non commitées à intégrer par l’orchestrateur ; aucun déploiement ou flag activé.

## Périmètre et décisions

T10 reste **partielle** : les dépendances P0/T09 ne sont pas encore satisfaites. Cette tranche répare les états du composant existant, sans activer Progression 2.0, modifier les seuils, calculer des gains ni émettre d’écriture économique. L’économie § « Lire ces nombres » conserve le gain unique et les projections ; la carte ne fabrique aucune valeur lorsque le serveur est indisponible.

La carte reste visible pendant le chargement, présente une erreur distincte du zéro et permet un véritable nouvel appel avec « Réessayer ». Le profil serveur valide s’affiche sans attendre la lecture secondaire du classement. Un classement indisponible n’invente pas un rang et ne masque pas le profil.

Le cache mémoire privé antérieur était indexé uniquement par URL, sans propriétaire ni invalidation de session. Il est remplacé par les queries TanStack `['progression-private', userId, 'profile'|'city-rank']`, dans le `ReactQueryProvider` déjà monté par le layout. Aucune nouvelle infrastructure, persistance ni provider n’est ajouté. Le provider existant renouvelle le client à chaque identité, annule les lectures et purge l’ancien cache ; la liste de snapshots natifs exclut ces queries de progression.

Les appels sont mutualisés entre cartes d’un même compte : lectures `no-store`, session chargée avant appel, `profile.userId` vérifié, signal d’annulation TanStack consommé. La clé et la garde du payload empêchent le rendu de l’ancien propriétaire lors d’un changement de compte. Fraîcheur de 30 s, reprise à la reconnexion et au focus ; actualisation périodique uniquement au premier plan pour les attributions serveur différées. Aucune donnée de démonstration ou ajout optimiste de XP.

`invalidateProgressionQueries(client, userId)` invalide uniquement profil et rang du compte courant, sans modifier les soldes. Les helpers de publication de carnet et complétion de checklist lisent maintenant la réponse réelle des routes : `ok === true`, `awarded === true` (exposition actuelle de `AwardProducerResult.success`) et outcome confirmé `awarded`, `awarded_lifetime_only` ou `duplicate`. Un 200, refus, payload malformé, échec réseau/JSON ou `awarded:false` n’émet aucun signal. Le rejeu confirmé déclenche aussi la relecture.

Les six appels actuels des helpers dans cinq fichiers capturent explicitement l’identifiant du compte initiateur **avant** l’écriture asynchrone. Le signal de refresh n’emporte aucun montant, seulement ce compte et l’outcome confirmé. Le provider existant écoute uniquement son propriétaire courant, valide le détail et vérifie l’identité/client actifs même entre rendu et nettoyage d’effet. Déconnexion/changement de compte retirent l’écoute et purgent l’ancien client. Ce signal local sert uniquement à invalider puis relire le serveur ; il n’est jamais une autorité d’attribution. Pour une checklist éditée par un collaborateur, le serveur reste seul maître du bénéficiaire ; le signal rafraîchit uniquement le compte initiateur, jamais un compte distant.

**Limite restante : une attribution confirmée ne garantit pas que son événement a déjà été consommé et projeté.** La relecture peut honnêtement conserver le total précédent ; le refresh au premier plan toutes les 30 s/focus/reconnexion récupère ensuite la projection canonique. Aucun montant n’est ajouté à partir de la réponse d’attribution. Le test provider + helper + query active vérifie ce cas pending : attribution confirmée, vraie relecture du profil, 0 XP conservé si le serveur retourne encore 0. Les producteurs serveur différés sans appel client restent observés par cette fraîcheur périodique, sans nouveau canal Realtime ni privilège. La vue complète n’utilise pas encore ces queries (périmètre distinct), et T09 reste dépendance non satisfaite.

La présentation drawer conserve son composant existant ; la carte ne lance plus de lecture cachée en parallèle dans cette variante. Les données du drawer lui-même ne sont pas auditées dans cette tranche.

## Interaction et accessibilité

Skills appliqués : `.agents/skills/apple-ui-designer/SKILL.md` et `.agents/skills/interaction-design/SKILL.md`. Les règles courantes de tokens dans CLAUDE.md priment sur les palettes historiques des skills.

Hiérarchie conservée : titre court, état lisible et action de reprise, avec tokens `--lkv-*`, cible de reprise ≥ 44 × 44 px et focus visible. Le chargement utilise `aria-busy` et `role=status`, l’erreur `role=alert`. Aucune animation supplémentaire : réduction des animations respectée sans boucle ou mouvement. Ces vérifications de code et de DOM ne prouvent pas la qualité visuelle sur appareil.

## Preuves exécutées

- `npx vitest run tests/features/progression/compactCard.spec.tsx tests/features/progression/clientquery.spec.ts tests/features/progression/awardRequests.spec.tsx tests/storage/critical-query-snapshot.spec.ts tests/features/hub/checklistEngine.spec.ts tests/trips/tripChecklist.spec.ts` : **50 tests réussis, 6 suites**, le 2026-10-10 à 20:46:39 UTC, durée 4,38 s. Les trois suites de la tranche totalisent 38 tests ; les suites existantes de snapshots/checklists complètent les contrôles d’interaction.
- Scénarios réellement montés et asynchrones : chargement initial puis zéro réel ; erreurs HTTP, réseau et payload ; reprise et réponse serveur affichée ; payload d’un autre propriétaire rejeté ; ancien profil tardif et ancienne réponse classement ignorés après changement de compte ; déconnexion ; profil visible avant classement/si classement échoue ; attente de la session ; drawer sans appels cachés ; deux cartes mutualisées et vraie relecture après invalidation.
- Tests du vrai `QueryClient` : déduplication par compte, séparation des caches Alice/Bob, expiration effective après 30 s, invalidation ciblée du propriétaire et de son rang, propriétaire rejeté sans cache succès, purge annulant la requête et empêchant une réponse tardive de repeupler le cache, classement invalide rejeté.
- Tests helper/provider : confirmation réelle et rejeu, refus/payloads invalides, HTTP/réseau/JSON, détail/event malformé ou autre compte, nettoyage de l’écoute, vraie relecture de query active et total projeté encore à zéro, confirmation tardive après logout/switch ignorée par le nouveau client.
- `git diff --check` sur les fichiers de la tranche élargie : réussi après l’implémentation.
- Types/build globaux laissés à l’orchestrateur pour éviter des vérifications simultanées sur un arbre partagé mouvant ; non déclarés réussis par cette preuve.

## Conditions restantes

Revue/integration/commit et contrôle global à effectuer par l’orchestrateur. Passage de la vue complète à ces queries, parcours vertical avec la projection T09, build/invariants au jalon, observation du vrai serveur et vérifications mobile/appareil : **non exécutés dans cette tranche**. Aucun téléphone réel, aucune simulation de financement/population, aucune activation ni migration ne sont concernés.
