# Compas v5 : plan d'implémentation et de tests

**Date :** 22 octobre 2026 · **Branche de travail :** `claude/compas-p1-referentiel`
**Maquette de référence :** `docs/compas/maquette-simplifiee.html` (v5). Lien privé : <https://claude.ai/artifact/9xgMKm3Wgdfj8MApnsgdXk>
**Statut :** proposition. Rien n'est commencé dans le code de production avant le feu vert de Tony (section 9).

Ce document est le dossier de conception exigé par `CLAUDE.md` avant toute modification : écrans, données, schéma, sécurité (RLS), lots et tests. Il sert aussi de feuille de route pour une exécution autonome : chaque lot a un critère de sortie vérifiable et ses tests.

---

## 1. Ce que l'utilisateur voit

Une phrase suffit (« Le Vercors, 3 jours à 4 »). Ensuite, tout se prépare seul et reste modifiable.

| Zone | Contenu | Remplace dans le Compas actuel |
|---|---|---|
| **Barre haute** | Pilule du voyage (nom et avatars), ✦ « Dis-le », ☰ « Plus ». La pilule ouvre « Nous ». | Capsule d'étapes, bouton menu, bouton soleil |
| **Card du voyage** (style Compte) | Photo, 3 chiffres (jours, km, budget par personne), ligne pays · dates · groupe, état « Presque prêt · N points », J-x, bulles (Nous, Budget, Sac, À prévoir, Vérifs, Météo, Hors ligne), grille en photo des jours, des nuits et du trajet, ou « fil » du voyage | Carte de l'étape « Où » et ses lignes, les 5 étapes |
| **Carte vivante** | Tracé par jour, nuits en photo avec leur prix, alternatives autour du jour ouvert, eau, sommets, magasins, parkings ; capsule Plan / Relief / Satellite ; calques ; zoom ; agrandir | Carte actuelle (même moteur MapLibre) |
| **Tiroirs** (dans les bornes de la card, translucides, capsule d'icônes) | Jour, Nous (solo ou avec d'autres), Budget (aperçu, dépenses, qui doit quoi), Sac (ton sac, tes kits, qui porte quoi), À prévoir (réserver, acheter), Vérifs, Météo, Plus | Tiroirs Où, Nous, Résa, Verdict, Kit (22 onglets) |
| **Îlot dynamique** | Préparation en direct, annonces, « Annuler » 4,6 s | Bandeau noir sur le titre |
| **Barre d'onglets de l'app** | Explorer, Compas, Matériel, Hub, Compte | Inchangée, masquée quand un tiroir est ouvert |

Objectifs chiffrés : environ 300 commandes ramenées à environ 140 ; 22 onglets de tiroir ramenés à 10 icônes de capsule ; aucune superposition ; aucun texte de plus d'une ligne hors des tiroirs ; « une phrase → aventure prête » en un geste.

---

## 2. Règles tenues (non négociables)

1. **Rien d'inventé.** Chaque lieu, prix, horaire ou photo vient d'une source réelle, avec sa source et sa date. Sans donnée : « non renseigné ». Sans photo : une illustration sobre, jamais une photo d'un autre lieu présentée comme celle-ci.
2. **Pas de note globale.** « Presque prêt · 2 points » est un compte de faits vérifiables, pas un score.
3. **Aucun paiement sans geste explicite.** « Tout réserver » est un seul geste ; un lien partenaire ne confirme jamais une réservation ; les liens affiliés portent `AffiliateDisclosure` et `rel="sponsored nofollow"`.
4. **RGPD.** Documents d'identité jamais partagés ; aucune coordonnée exposée par un carnet partagé ; contact de sécurité privé (RLS own).
5. **Accessibilité.** Cibles de 44 px, `aria-modal`, focus piégé et `inert` sur le tiroir fermé, îlot en `aria-live`, `prefers-reduced-motion` et `prefers-reduced-transparency` respectés, contraste AA mesuré sur le vrai fond.
6. **Style.** Matière de la page Compte v19 (verre de la barre, card `.cs`, tiroirs aux bornes de la card, capsules d'icônes sans texte). Jetons `--lkv-*` uniquement, aucune couleur littérale nouvelle hors du fichier de jetons, jamais `#E4501C`.
7. **Plateformes.** Vercel pour le web, Capacitor pour le mobile ; rien d'autre.

---

## 3. Architecture front

### 3.1 Bascule progressive

- Nouveau point d'entrée `CompasV5Screen` derrière `NEXT_PUBLIC_COMPAS_V5=on` (et `?v=5` pour les aperçus). L'écran actuel reste en place jusqu'à la bascule (lot 11), puis il est supprimé avec ses tests.
- Même route `/compas`, mêmes données serveur (`getCompasData`), mêmes actions serveur quand elles existent.

### 3.2 Matière partagée avec la page Compte

La page Compte porte aujourd'hui sa matière dans `src/components/compte/CompteLiquidGlassV8.tsx` (CSS en chaîne) et un runtime JS. Pour ne pas la copier :

- Extraire les jetons et recettes v17 à v19 (`--bar-glass-*`, `--bar-thumb-*`, card `.cs`, feuille translucide, groupe `.grp`, îlot) dans `src/design/glass/` : un fichier CSS de jetons et des primitives React.
- Primitives : `GlassBar`, `CardSurface`, `CardSheet` (bornes de la card, poignée, `inert`, focus piégé), `IconCapsule` (lentille, 44 px, icônes seules), `Island` (états idle, live, note et Annuler), `StoryBubble`, `PhotoTile`, `Avatar`, `Chip`, `Switch`, `Stepper`, `GroupedList`.
- La page Compte n'est pas modifiée dans ce chantier. Un test de contrat compare les valeurs calculées des jetons des deux pages, pour empêcher toute dérive.

### 3.3 Composants du Compas v5

| Composant | Rôle | Réutilise |
|---|---|---|
| `CompasTopBar` | Pilule du voyage, Dis-le en ligne, menu | `engine/intent*`, `CompasDisLe` (logique) |
| `TripCard` | En-tête, chiffres, état, bulles, grille ou fil | `getCompasData`, `engine/tripContext` |
| `LiveMap` | MapLibre : marqueurs HTML (photos), alternatives, niveau de détail, segments par jour, caméra (jour ou voyage), styles, calques, agrandir | `HubGlobeMap`, `engine/mapLayers`, `engine/mapStyle` |
| `DayDrawer` | Photo, chiffres, météo, ajustement, nuit et alternatives, jour suivant ou précédent | `engine/passage`, `engine/stays`, `engine/stayProposal` |
| `NousDrawer` | Solo ou avec d'autres ; membres, rôles, allure retenue, invitations, matériel commun, places aux nuits ; en solo, prévenir un proche et numéros de secours | `engine/crew` (`crewPace`), `invitationActions` |
| `BudgetDrawer` | Enveloppe proposée et réglable, prévu par poste, dépenses réelles, qui doit quoi | `engine/costs`, `engine/budgetFx`, `engine/crew` (`settleExpenses`) |
| `SacDrawer` | Poids par catégorie, adaptations expliquées et annulables, objets en photo, état (je l'ai, à acheter, à emprunter), kits existants, qui porte quoi | `engine/kitRules`, `kitApply`, `kitContext`, `shopMatch`, lignées de kits |
| `PrevoirDrawer` | Nuits, trajet et achats choisis d'avance, alternatives en photo, « Tout réserver » | `engine/resaCats`, `affiliates`, `travel`, `rail` |
| `VerifsDrawer` | Toi, le terrain, les conditions : points à régler, sources, actions | `engine/riskBars`, `verdictExplain`, `danger`, `officialAlerts` |
| `MeteoDrawer` | Par jour : ciel, températures, vent, horizon de la prévision | `engine/metno`, `weather` |
| `PrepLive` | Préparation visible : îlot « live », tracé qui se dessine, nuits qui apparaissent | `autofillActions`, `autofillState` |

### 3.4 État et annulation

- Un seul magasin client (`useCompasTrip`, contexte et réducteur) : lecture des données serveur, mutations optimistes, journal d'annulation (une entrée par changement). L'îlot affiche le dernier changement avec « Annuler » ; l'annulation rejoue l'inverse côté serveur.
- Toutes les mutations passent par des actions serveur validées par `zod`.

---

## 4. Données et serveur

### 4.1 Tables existantes réutilisées

| Table | Usage v5 | Colonnes déjà là |
|---|---|---|
| `trips` | Voyage ; `metadata.compas.party` = `solo` ou `group` (nouveau champ JSON, sans migration) | `metadata` |
| `trip_steps` | Jours, nuit retenue | `accommodation_name`, `metadata`, coordonnées, distance, dénivelé |
| `trip_items` | Objets du sac de l'aventure, état, porteur, raison | `ownership`, `purchase_state`, `owner_id`, `packed_by`, `reason`, `is_vital`, `shop_product_id` |
| `trip_expenses` | Budget prévu et réel, remboursements | `payer_id`, `amount`, `category`, `split_type`, `is_planned`, `metadata` |
| `trip_collaborators` | Membres et rôles | `role`, `invited_by` |
| `materiel_kits` | Kit à part entière de l'aventure, ou kit existant adapté | `origin`, `forked_from`, `lineage_root_id`, `ancestors` |

Règle des lignées tenue : partir d'un de ses propres kits crée un kit `origin='manuel'` sans `forked_from` (anti-fraude) ; seul un kit d'un autre voyageur crée une filiation.

### 4.2 Nouvelles migrations (à appliquer par Tony en production)

1. **`trip_choices`** : pour chaque choix de l'aventure (nuit N, trajet, achat d'objet), les options classées venues de sources réelles : `slot`, `rank`, `chosen`, `name`, `kind`, `price_cents`, `currency`, `lat`, `lon`, `photo_url`, `photo_credit`, `source`, `source_url`, `fetched_at`, `partner` (lien affilié ou non). RLS par `can_read_trip` et `can_edit_trip` ; index `(trip_id, slot)`.
2. **`trip_safety_contacts`** : contact privé pour le mode solo (nom, canal, adresse e-mail). RLS `user_id = auth.uid()` en lecture et en écriture ; jamais exposé aux autres membres ni dans un carnet partagé.
3. **`trip_expenses.metadata.settles`** (sans migration) pour les remboursements ; `split_type = 'transfer'`.
4. Tests pgTAP pour chaque nouvelle table : anonyme refusé, lecteur en lecture seule, éditeur en écriture, contact de sécurité invisible des autres membres.

### 4.3 Choix automatiques (moteurs purs, testés)

| Moteur (nouveau, pur) | Entrées | Règle |
|---|---|---|
| `rankStays` | Arrivée du jour, groupe, options réelles | Distance à l'arrivée, places suffisantes pour le groupe, prix, note ; « disponibilité à vérifier » tant qu'un partenaire ne l'a pas confirmée |
| `rankTransport` | Origine, groupe, options | Durée, coût total et par personne |
| `rankPurchases` | Objet, J-x, magasins sur la route, boutique | Prix, délai de livraison au regard de la date de départ, détour |
| `proposeEnvelope` | Prévu | Arrondi à la cinquantaine supérieure ; réglable |
| `distributeSharedGear` | Membres (niveau, allure), objets communs | Poids réparti, au plus léger pour les plus lents |
| `readinessPoints` | Sac, réservations, contact de sécurité, alertes | Liste de faits à régler, chacun avec son action ; jamais de score |
| `adaptKitToRoute` | Météo, dénivelé, nuits | Ajouts et retraits expliqués (pluie → veste, refuge → duvet, bivouac → tente et réchaud) |

### 4.4 Photos (sans rien inventer)

- **Hébergements :** photo fournie par la source (partenaire, refuges.info) avec crédit ; sinon Wikimedia Commons du lieu, avec licence et auteur ; sinon une illustration.
- **Jours :** photo Wikimedia Commons géolocalisée à moins de 2 km du tracé, avec licence ; sinon une illustration.
- **Objets :** photos du catalogue LKDV (Supabase Storage) ; objets hors catalogue : illustration.
- La CSP est élargie aux seuls hôtes d'images retenus (`upload.wikimedia.org`, stockage Supabase, CDN partenaires) ; un test vérifie la liste.

### 4.5 Réservation : ce qui est vrai

Aucun partenaire actuel n'offre de réservation directe par API. « Tout réserver » ouvre donc, dans l'ordre, les pages des partenaires et des sites officiels. L'état reste « à confirmer » jusqu'à ce que l'utilisateur confirme ou qu'un retour partenaire arrive (webhook Travelpayouts déjà en place). Les achats « Boutique LKDV » passent par le panier et Stripe. La décision d'ouvrir une vraie réservation intégrée revient à Tony (section 9).

### 4.6 Sécurité en solo

« Prévenir un proche » envoie la veille, par e-mail, l'itinéraire et l'heure de retour prévue (pas de SMS, payant). L'alerte en l'absence de confirmation de retour demande une tâche planifiée et un canal fiable : elle est prévue en option, derrière un drapeau, après validation de Tony.

---

## 5. Lots, dans l'ordre

Chaque lot : implémentation, tests unitaires et de composant, `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, aperçu Vercel, scénarios E2E du lot, journal dans `docs/compas/phase7/JOURNAL-TESTS.md`, commit et poussée. Un lot n'est fermé que si son critère de sortie est prouvé.

| Lot | Contenu | Critère de sortie |
|---|---|---|
| **0** | Drapeau, extraction de la matière Compte en primitives, page de démonstration `/compas/dev/v5` (dev seulement), test de contrat des jetons | Primitives rendues identiques au Compte (test de contrat vert), axe 0 violation |
| **1** | `CompasV5Screen` : barre haute, card, barre d'onglets, îlot, en lecture | Données réelles d'une aventure affichées ; banc v5 « lecture » vert |
| **2** | `LiveMap` : marqueurs photo, niveau de détail, segments, caméra jour/voyage, styles, calques, agrandir | 60 marqueurs fluides (60 i/s mesurés dans Chrome, profil mobile, processeur ralenti ×4), aucun chevauchement de libellés |
| **3** | Tiroirs en lecture : Jour, Météo, Vérifs, Plus | Chaque tiroir ouvert, fermé, piloté au clavier ; axe 0 violation |
| **4** | Nous : solo ou avec d'autres, invitations, allure, contact de sécurité ; migration `trip_safety_contacts` | Bascule solo/groupe recalcule budget, sac et temps ; pgTAP vert |
| **5** | Budget : enveloppe proposée, postes, dépenses, qui doit quoi, remboursements | Totaux justes au centime sur 20 cas ; moins de virements possibles |
| **6** | Sac : kit créé ou choisi, adaptations, états, qui porte quoi ; kit à part entière dans Mon matériel | Règle anti-auto-fork tenue ; adaptations conformes aux nuits choisies |
| **7** | À prévoir : options classées (`trip_choices`), alternatives en photo, achats, « Tout réserver » | Aucune option sans source ni date ; liens partenaires signalés |
| **8** | Préparation visible : îlot live, carte qui se construit, fin sur « Ton aventure est prête » | Phrase → aventure prête sans autre geste ; temps médian ≤ 30 s |
| **9** | Dis-le dans la barre ; annulation par l'îlot | 115 formulations hors ligne et 100 en ligne lues sans régression |
| **10** | Langues (fr, en, es, de, it), accessibilité, performances, hors ligne, plein soleil, transparence réduite | Clés complètes dans 5 langues ; Lighthouse dans les budgets |
| **11** | Bascule : drapeau allumé en aperçu, banc complet, jeux de 100 phrases, puis production avec l'accord de Tony ; retrait de l'ancien écran | Banc v5 100 % (ou non testable justifié), jeux ≥ 95 % de lieux justes |

---

## 6. Tests pour la production

### 6.1 Tests automatiques

| Niveau | Outil | Contenu | Seuil |
|---|---|---|---|
| Moteurs purs | Vitest | `rankStays`, `rankTransport`, `rankPurchases`, `proposeEnvelope`, `distributeSharedGear`, `readinessPoints`, `adaptKitToRoute`, réducteur et annulation, calcul de caméra | 100 % des branches des nouveaux modules |
| Composants | Vitest et Testing Library | Chaque tiroir, capsule au clavier, îlot `aria-live`, focus piégé, `inert`, bulles et pastilles | Tous les états rendus, aucune erreur console |
| Actions serveur | Vitest | Schémas `zod` (entrées invalides refusées), droits (lecteur ne modifie rien), erreurs réseau | 100 % des actions nouvelles |
| Base | pgTAP | RLS de `trip_choices` et `trip_safety_contacts`, `trip_expenses` (remboursements), documents jamais visibles | 100 % des politiques |
| Parcours | Playwright, banc `tests/e2e-compas-v5/` | Départ et préparation ; Nous solo et groupe ; budget (ajout, remboursement) ; sac (kit, annulation, état) ; À prévoir (alternative, réservation) ; jour (alternative sur la carte) ; carte (style, calques, zoom, agrandir) ; Dis-le ; hors ligne | Registre de couverture régénéré : 100 % des commandes vérifiées ou déclarées non testables avec la raison |
| Visuel | Playwright, captures de référence | Chaque écran et tiroir à 390×844, 430×932, 360×800 et 1440 px, en français et en anglais | Écart ≤ 0,2 % des pixels |
| Accessibilité | axe-core | Chaque état de tiroir, fond réel | 0 violation |
| Performances | Lighthouse CI | `/compas` mobile 4G | LCP < 2,5 s, TBT < 200 ms, JS initial < 250 Ko |
| Résilience | Playwright, réseau simulé | Photon ou Geoapify en panne, 3G lente, hors ligne, aucune photo | Message clair, aucune page blanche |
| Vérité des données | Test dédié | Tout prix, horaire ou lieu affiché porte `data-source` et une date ; aucune valeur codée en dur dans les composants | 0 écart |
| Langues | Vitest | Aucune clé manquante dans les 5 langues ; formats `Intl` | 0 clé manquante |
| Sécurité | Vitest et analyse | CSP (hôtes d'images listés), aucun secret côté client, mention partenaire présente | 0 écart |

### 6.2 En ligne, sur aperçu puis en production

- **Jeux de phrases :** 50 France et Europe, 50 monde, rejoués sur l'aperçu v5 avec la console de test (`npm run compas:console`), contrôlés en base (lieu, pays, durée, nuits, choix). Objectif : 100 % prêtes, au moins 95 % de lieux justes.
- **Charge :** remesure des crédits Geoapify et des appels par préparation (`docs/compas/phase7/CHARGE-SIMULEE.md`) ; objectif : 1 000 préparations par jour dans les quotas gratuits.
- **Fumée après déploiement :** ouverture de `/compas`, une préparation, un tiroir de chaque espace, sur la production, avec le compte d'essai.
- **Surveillance :** rapport quotidien en base (`ops_daily_report`) étendu aux erreurs v5 ; retour arrière immédiat en éteignant le drapeau.

### 6.3 À faire sur appareil (par Tony)

VoiceOver sur iPhone et TalkBack sur Android ; une préparation complète en extérieur (plein soleil) ; installation de l'application Capacitor.

---

## 7. Ce qui n'est pas dans ce chantier

- La réservation intégrée (paiement chez le partenaire depuis le Compas) : dépend d'un contrat partenaire.
- Les SMS de sécurité : payants ; l'e-mail suffit au départ.
- La refonte de la page Compte elle-même : elle sert de référence, elle n'est pas modifiée.

---

## 8. Risques et parades

| Risque | Parade |
|---|---|
| Photos indisponibles ou sous licence incompatible | Illustration sobre, jamais une photo d'un autre lieu ; test de licence et de crédit |
| Trop de marqueurs à petite échelle | Niveau de détail (points utiles et libellés à partir d'un certain zoom), regroupement |
| Prix partenaires qui changent | Date de relevé affichée ; « à vérifier » au-delà de 24 h |
| Quotas gratuits dépassés | Cache des recherches (déjà v4), plafonds, dégradation propre déjà mesurée |
| Écart de style avec le Compte | Primitives partagées et test de contrat des jetons |
| Régression du moteur de lecture | 4 490 tests existants, plus 115 formulations figées, rejoués à chaque lot |

---

## 9. Décisions et accès demandés à Tony

1. **Valider la maquette v5** comme direction (structure carte, card et tiroirs ; 5 étapes remplacées par les espaces).
2. **Réservation :** garder « ouvrir les partenaires et confirmer » (proposé), ou chercher un partenaire avec réservation par API.
3. **Sources de photos :** Wikimedia Commons et refuges.info (proposé), avec crédits affichés.
4. **Contact de sécurité en solo :** e-mail la veille (proposé) ; alerte de non-retour en option plus tard.
5. **Production :** appliquer les migrations du lot 4 et du lot 7 dans le SQL Editor (Claude ne les applique pas en production), et donner le feu vert de bascule au lot 11.

---

## 10. Exécution autonome

- Un lot à la fois, dans l'ordre ; des sous-agents en parallèle seulement sur des fichiers disjoints (par exemple moteurs purs et primitives).
- À chaque lot : tests verts avant commit, aperçu Vercel, banc du lot, journal à jour ; une case de `PLAN-100.md` cochée seulement avec preuve.
- Arrêts prévus : une décision de la section 9, une migration à appliquer en production, ou un échec que trois tentatives de correction n'ont pas levé (documenté, puis lot suivant si indépendant).
