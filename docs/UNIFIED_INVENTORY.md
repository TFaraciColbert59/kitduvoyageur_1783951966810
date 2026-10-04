# Produits et inventaire unifiés

## Décisions

`shop_products` conserve les fiches catalogue ; `product_ownership` conserve les objets privés. Un objet libre ne nécessite pas de fiche catalogue. L'identifiant UUID de l'objet reste stable lors d'une vente, d'une location et d'un prêt. Le numéro de série est une déclaration privée, jamais une preuve d'authenticité. Son unicité est limitée au propriétaire ; la quantité d'un objet sérialisé est 1.

L'état physique (`condition`) est distinct du statut de disponibilité (`status`) et du mode (`listing_mode`). Les mises à jour sont contrôlées côté serveur et dans PostgreSQL, afin que des requêtes directes à Supabase ne contournent pas ces contrôles. L'historique des statuts est privé.

## Parcours

La gestion est regroupée dans `/hub/inventaire` : création et modification contextualisées, filtres et recherche, détail, départ et retour, suivi d'une vente finalisée. Enregistrer une vente indique un changement d'inventaire : cela ne prélève pas d'argent. Les numéros de série, contacts et localisations personnelles ne sont pas publiés dans le catalogue.

## Services externes et portée du rapport

| Proposition du rapport | État et dépendance |
| --- | --- |
| Référence produit / exemplaire et statuts | Modèle additif dans les tables existantes |
| Inventaire commun vente, location, prêt | Interface et API communes |
| Vérification GS1 / constructeur | Nécessite un contrat/API fournisseur ; un numéro de série ne permet pas une recherche universelle. Aucun résultat de vérification inventé |
| Paiement sécurisé | Stripe Checkout et webhook existent dans le dépôt. Aucun Stripe Connect ni circuit de fonds retenus n'a été trouvé. Le suivi privé de vente ne déclenche pas Stripe |
| Caution | Montant de suivi ; aucune préautorisation bancaire ni assurance implicite |
| Vérification d'identité | Prestataire KYC, politique de conservation et base légale à définir avant collecte de documents |
| Assurance | Contrat assureur et règles de couverture à fournir |
| Avis après transaction | Ne pas qualifier d'avis vérifié sans transaction marketplace attestée |
| Support 24/7 et résolution des litiges | Engagement opérationnel et procédure à établir ; aucune promesse ajoutée à l'interface |
| RGPD / CGU | Documentation de conformité existante dans `docs/compliance`, plusieurs pièces encore marquées brouillon. Validation juridique nécessaire ; aucune certification affirmée |

## Mise en service

La migration est additive et conserve les objets et références des kits. Exécuter d'abord sur une base de staging disposant du schéma actuel ; les anciens historiques de migration incluent des adaptations qui ne doivent pas être rejouées aveuglément en production. Déployer la migration avant le frontend et les API. Vérifier avec deux utilisateurs que chacun ne voit et ne modifie que ses objets et historiques. Les rôles anonymes n'accèdent pas à l'inventaire.

Contrôler ensuite les prêts existants, l'affichage de leurs statuts, le retour d'un prêt, une location, la finalisation d'une vente et l'accès catalogue. Ne pas exécuter une migration destructive de retour arrière après création de nouvelles données : privilégier une correction additive.

## Vérifications

Validation locale du 4 octobre 2026 :

- 390 tests passent dans 56 fichiers : matériel, schémas, inventaire, lien catalogue et Compas. Commande : `npm test -- --maxWorkers=2 tests/materiel tests/schemas/materiel.spec.ts src/features/materiel/domain/__tests__ src/components/produit/__tests__ src/features/compas/__tests__`.
- Compilation production réussie avec `NODE_OPTIONS=--max-old-space-size=6144 DIST_DIR=.next-inventory-check npm run build`. Les avertissements ESLint existants et les replis de sources distantes pendant la génération restent visibles dans le journal ; aucun échec de compilation.
- Vérification TypeScript réussie avec une limite mémoire Node de 6 Go ; la limite par défaut de 2 Go sature sur ce dépôt.
- Invariants CI anti-dérive réussis.
- Chromium : fixture locale avec composants réels et styles du dépôt, aux dimensions 393×852 et 1440×1000. Filtres, vente avec confirmation, formulaire location, conversion des prix, absence de débordement horizontal et d'erreurs JavaScript vérifiés. Requêtes réseau simulées dans cette fixture ; l'authentification Supabase distante et iOS natif ne sont pas validés par ce contrôle.
- PostgreSQL 17 isolé sans réseau : migration compilée, règles RLS, historique immuable, contraintes de prix/série/mode, départ et retour atomique, transitions concurrentes, suppression de comptes et de références catalogue vérifiés. Fixtures dans `tests/materiel/sql/` ; elles reproduisent les tables historiques utiles, sans rejouer tout l'historique du dépôt.
- Revues indépendantes : trois régressions trouvées puis corrigées (suppression emprunteur, suppression catalogue, disponibilité Compas). Revue finale sans blocage matériel.
- Suite globale exploratoire : 5 643 tests passent, 26 échouent et 26 sont ignorés. Les 26 échecs se reproduisent sur une copie de HEAD avant chantier, dans 11 suites hors périmètre : géographie distante, affiliation, lieux, découverte/Klook, registre IA, narration, contraste, capture N7, P0.24 et carnets de voyage. Les tests du chantier sont tous verts.

La migration `unified_inventory` est appliquée le 4 octobre 2026 au projet Supabase configuré, après vérification de compatibilité du schéma. Les 68 objets existants sont conservés et la table d’historique a sa RLS active. L’application complète est démarrée pour les essais de connexion et de persistance ; le déploiement frontend est distinct de l’activation du schéma.

Pour reproduire les contrôles SQL : créer un conteneur PostgreSQL 17 jetable, appliquer `bootstrap.sql`, puis `supabase/migrations/20261004105314_unified_inventory.sql` et `supabase/migrations/20261004124950_inventory_conflict_http409.sql`, puis `unified-inventory.sql`, `return-compatibility.sql`, `foreign-key-deletion.sql` avec `psql -v ON_ERROR_STOP=1`. Exécuter ensuite `bash tests/materiel/sql/concurrency.sh <conteneur> <base-isolée>`. Ne jamais appliquer le bootstrap de test sur une base applicative.

## Validation en base hébergée et essai

Le 4 octobre 2026, l’application Next.js complète a été testée avec un compte jetable confirmé par l’API Auth, connecté à la base configurée. Création, prix de location (12,50 € → 1250 centimes), départs et retours location/prêt, modification, vente définitive après confirmation et persistance après rechargement sont vérifiés. La fiche catalogue ouvre le formulaire commun avec le produit prérempli. Un second compte ne peut ni lire ni modifier les objets du premier, ni lire son historique ; l’API refuse les requêtes sans session (401).

Le test réel de statut périmé a révélé que PostgREST 14.5 retente une erreur `40001` de sérialisation. Le conflit métier utilise désormais `PT409`, avec réponse HTTP 409 immédiate (2,9 secondes sur le premier contrôle, compilation à froid incluse). La correction est une seconde migration additive, appliquée au même projet, qui préserve le verrouillage, les droits et le contrôle du propriétaire. Les tests de concurrence PostgreSQL 17 et la revue indépendante passent après cette correction.

Version d’essai : https://kitduvoyageur-17839519668-git-0e3471-tonyfaracip-3325s-projects.vercel.app/connexion?next=/hub/inventaire ; branche `codex/unified-inventory`, PR #64. Vercel protège cet aperçu par la connexion au compte Vercel autorisé : cette protection est conservée. Les essais navigateur authentifiés sont réalisés sur Next.js dans l’environnement de travail, avec la base hébergée ; ils ne constituent pas une connexion de l’agent à l’aperçu Vercel protégé.

Pour essayer : se connecter à Vercel si demandé, puis à l’application ; ajouter un objet en mode Location avec un tarif, démarrer la location, enregistrer le retour, puis recharger. Le suivi de vente reste manuel et ne déclenche aucun paiement. Les contrats GS1, KYC et assurance ainsi que Stripe Connect restent des dépendances commerciales non configurées.
