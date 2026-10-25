# Échanges de matériel et support

L’inventaire privé reste la source de vérité. Publier une annonce depuis le Hub crée un instantané public explicitement accepté (description et commune distinctes des notes et de l’adresse privées). Les pages `/occasion` et `/location` présentent exclusivement les annonces persistées et disponibles ; les prêts se choisissent dans le filtre de `/location`.

Une demande suit les étapes demande → acceptation du propriétaire → remise → réception pour une vente, ou retour demandé → retour confirmé pour une location ou un prêt. L’acceptation réserve l’objet unique et annule les autres demandes avec une trace d’audit. Une vente remise marque définitivement l’inventaire du vendeur « vendu ». Les prêts et locations reviennent en stock après confirmation du retour. Les modifications d’un objet publié retirent son instantané et annulent les demandes en attente avec une trace ; une nouvelle publication et une nouvelle demande explicites sont nécessaires. Les transactions engagées bloquent toute mutation parallèle de l’objet.

La messagerie ouvre une conversation réelle. Le suivi logistique est un code saisi par les participants ; aucun transporteur ni garantie de livraison n’est connecté. Les avis concernent l’autre participant et nécessitent une transaction terminée. L’affichage public de l’annonce filtre les avis concernant son propriétaire.

Les signalements et litiges sont persistants. La modération utilise les rôles existants protégés en base et exige une décision documentée. Un participant ne peut arbitrer son propre litige. Le support conserve des tickets privés et les réponses administratives sur `/contact`, sans promettre de délai ou d’envoi de courriel.

La recherche de code-barres valide le checksum GTIN et recherche une référence dans le catalogue local. Elle ne prouve pas l’authenticité d’un produit.

## Limites d’exploitation

Les règlements et cautions restent manuels. Aucun PSP pour les particuliers, séquestre, préautorisation bancaire, KYC, assurance, registre GS1 externe ou équipe de support 24/7 n’est activé. Ces services nécessitent les contrats et accès de leurs prestataires. Ne collecter ni pièce d’identité ni coordonnées bancaires dans les champs libres.

## Vérification

- TypeScript, compilation Next.js avec lint et invariants CI.
- 186 tests ciblés inventaire, marketplace, GTIN et support.
- PostgreSQL 17 réel : permissions, champs privés, transactions, immobilisation d’inventaire, modération, audit, quotas et concurrence entre acceptations.
- Support SQL réel : isolation, confirmation email, réponses administratives, refus des écritures directes, quota horaire.
- Deux comptes de test temporaires dans le navigateur sur Supabase hébergé pour le cycle de prêt, les annonces, avis et tickets ; comptes et objets supprimés après vérification.

Les migrations sont additives. Les 68 objets antérieurs ont été conservés. Les fonctions publiques sont fermées par défaut et les tables privées utilisent RLS.
