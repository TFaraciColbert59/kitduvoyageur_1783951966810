# Revue indépendante T10 — query privée et invalidation confirmée

10 octobre 2026, Europe/Paris. Lecture locale de la carte compacte, de
`client/progressionQuery.ts`, du diff ReactQueryProvider, du helper
progression-award-requests, des six appels dans cinq composants et de leurs
trois suites. Lecture complémentaire du snapshot critique, des routes de
confirmation et du rapport compact-card. Aucun test relancé, code modifié,
commit, appel distant ou activation. La mise en page T11 en cours est exclue
de cette revue.

**Verdicts conformité et qualité : acceptables pour cette tranche T10 partielle.
Aucun défaut de code actionnable relevé dans le périmètre.** Les 50 tests
réussis dans six suites sont rapportés par l'agent auteur ; ils ne sont pas
réexécutés par ce reviewer. Cette revue ne valide pas T09, le parcours
vertical SQL, les appareils ni la migration de la vue complète.

## Isolation et fraîcheur

Les clés profil/rang portent l'utilisateur. La query profil vérifie également
userId du payload, utilise no-store et consomme le signal d'annulation de
TanStack. La carte attend l'authentification, masque immédiatement un payload
d'un autre propriétaire et conserve chargement, erreur, retry et zéro réel
distincts. Le rang secondaire ne bloque pas le profil et ses erreurs ne
fabriquent aucun rang. Deux cartes du même compte partagent la query ; une
autre identité utilise une autre clé et un nouveau client provider.

Le provider existant renouvelle déjà le client par identité, annule et purge
l'ancien cache. Le diff ajoute uniquement le pont de confirmation et sa garde
d'identité/client actif, sans remplacer les effets de restauration/persistance.
La garde couvre aussi la fenêtre entre nouveau rendu et nettoyage de l'ancien
listener. Les tests vérifient switch/logout et réponse de confirmation tardive
sans invalidation du nouveau client.

Le TTL est de 30 secondes ; refetch au focus/reconnect et polling de profil
au premier plan relisent la projection, sans bonus ni écriture optimiste. Le
rang suit sa propre fraîcheur et l'invalidation du même préfixe. Le polling
configuré n'est pas présenté comme une preuve de scheduler serveur ou de
projection déjà finalisée.

## Confirmation et état pending

Le helper lit réellement la réponse et exige `ok===true`, `awarded===true`
et un outcome confirmé. HTTP 200 seul, refus, erreur JSON/réseau ou payload
malformé ne déclenchent pas l'invalidation. Les outcomes sont cohérents avec
la réponse actuelle des producteurs exposée par les routes. Le signal ne
contient aucun montant et ne crée aucun droit ; il rafraîchit uniquement les
queries du propriétaire courant.

Les six appels capturent ownerId avant leur écriture asynchrone. Une réponse
ancienne conserve cette identité initiatrice ; le nouveau provider l'ignore
si elle ne correspond pas à son compte. Pour une checklist collaborative,
ce signal n'est pas une affirmation d'identité du bénéficiaire économique :
le serveur conserve cette décision, et aucune progression d'un autre compte
n'est mise en cache à partir du signal.

Le test helper→provider→query active confirme une vraie relecture après
attribution en conservant 0 XP quand la projection renvoie encore 0. La carte
ne célèbre ni ne calcule de gain depuis cette réponse. La query périodique
récupère ultérieurement les producteurs sans acknowledgement navigateur.

## Snapshot critique et frontières de tests

La liste de persistance reste limitée à hub-adventures, carnets et
country-practical-guide : progression-private n'est pas persisté. Hydratation,
attente native bornée, sérialisation des écritures et suppression de snapshot
de l'ancien propriétaire demeurent identiques dans le diff du provider.
Les tests de snapshot existants sont inclus dans les 50 succès rapportés ;
les tests du nouveau pont simulent cette frontière et ne valent pas un test
de stockage natif sur appareil.

Lecture complémentaire des modifications de tests de routes et services
présentes au moment de la revue : configuration des rate-limiters isolée à
leurs lecteurs/backends, compteurs mémoire réels conservés, reset des
compteurs entre scénarios, mocks explicites des producteurs/services externes,
valeurs d'environnement de découverte explicites et `maybeSingle` ajouté au
mock de query. Aucune assertion métier supprimée ni garde réseau désactivée
dans les diffs lus. countries_geo exige maintenant un opt-in E2E et une URL
locale : une suite ignorée demeure une limite, jamais une réussite E2E.
Cette lecture ne remplace pas la suite globale en cours chez l'orchestrateur.

## Conditions restantes

T10 reste partielle dans son rapport : vue complète non encore mutualisée,
T09 et parcours source→intention→transaction→projection indisponibles dans
cette tranche, intégration/types/build jalon et vérification mobile réelle à
compléter. Les limites sont explicites et ne constituent pas une régression
attribuée aux changements relus.

Relecture du petit correctif de typage du test helper : le scénario JSON
invalide utilise désormais une véritable Response 200 contenant un texte
non JSON. Il exerce réellement le rejet de response.json(), conserve
l'assertion sans notification et retire seulement le cast structurel erroné.
Aucune réduction de couverture ou modification runtime dans ce correctif.
