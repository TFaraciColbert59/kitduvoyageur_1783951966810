# Inventaire de l'app pour le film — `main` `d52a006`

| | |
|---|---|
| **Commit de référence** | `d52a00641eb4846c99095d07c0c8ccd34e1b37f0`, 23/11/2026 16:14, « feat(clubs): club hierarchy, settings drawer, club inventory & UI polish » |
| **Vérifié le** | 26/11/2026 : `origin/main` n'a pas bougé depuis. |
| **Attention, la production n'est pas `main`** | Le dernier déploiement de production prêt est `3230f88`, vers le 15/11. Les déploiements de `main` sont en erreur depuis le 19/11. **On ne filme jamais le site en ligne** : on filme l'app lancée en local depuis `d52a006`. |

Le script `tools/capture/tournage.cjs verifier` refuse de tourner si l'app servie n'est pas au dernier `main`. Il écrit le SHA dans `assets/shoot/SOURCE.txt`.

---

## 1. Les captures déjà faites sont-elles du dernier `main` ?

Oui. Elles ont été prises sur `d52a006`, comme l'indique `PLAN.md`. J'ai aussi retrouvé dans le code de `main` les textes visibles sur chaque capture :

- « Des aventures *en route*, des récits de retour. » : `CarnetsHubScreen.tsx` ;
- « Partager ma position », « Aucun partage actif » : écran Suivi en direct ;
- « Pack carte hors ligne », « Gérer les étapes dans l'itinéraire » : tiroirs du Hub ;
- « Je prépare ton aventure » : Compas ;
- « Le globe s'ouvre sur toi » : `SheetContent.tsx`, ligne 4554.

**Réutilisables tels quels :** `assets/screens/` (Hub, Explorer, Compas, Carnets, Compte, Suivi en direct, Kit Studio), `assets/screens/tiroirs/` (les 8 tiroirs du Hub), `assets/real/` (découpes), `assets/video/compas-saisie.mp4` (vraie saisie dans le Compas).

**À refaire :**
- `explorer.png` : le globe n'est pas rendu (carte plate grise, sans WebGL).
- `ecrans/dev_carnet-v2.png` : vient de la page de labo `/dev/carnet-v2`. Il faut refilmer la vraie route `/carnets/[id]`, qui affiche le même `CarnetScreenV2`.

**Le « Tour des Écrins » n'est pas une donnée réelle.** C'est le jeu d'essai du labo (`features/carnet/detail/fixtures/ecrinsDetail.ts` : « Ce n'est pas une donnée de production »). Les versions v1 à v5 l'ont pourtant montré comme le carnet de Léa.

Le vrai carnet le plus riche de Léa est **« Tour du Mont-Blanc en autonomie complète »** (`749e9e8c-9540-5a73-8b6c-6ab07264f62f`) :
- 170 km, +10 000 m, 9 nuits ;
- équipage : marie_dupont_3612 et thomas_martin_485f ;
- 26 moments, dont 11 espèces (Pokédex), 2 incidents et 1 dépense.

**Le récit du film devient : « Léa prépare le Vercors ; son plus beau carnet, c'est le Tour du Mont-Blanc. »**

**Nouveau le 26/11** (`assets/shoot/plans/`, tourné sur `d52a006`) : `manifeste.png` et `pro.png`. Ces deux pages s'affichent sans base de données.

---

## 2. Navigation

La barre d'onglets réelle (`FloatingLiquidTabBar`, registre `destinationRegistry.ts`) n'a que des icônes. Le nom de chaque onglet est porté par son `aria-label`.

| Onglet | Route | `aria-label` |
|---|---|---|
| Hub | `/hub` | « Hub : aventure active, préparation et voyages » (maintien : changer d'aventure) |
| Explorer | `/explorer` | « Explorer les sentiers et destinations » |
| Communauté | `/communaute` | « Communauté, clubs, événements » (double-clic : Freedom) |
| Messages | `/messagerie` | « Messages : conversations et demandes » |
| Compte | `/compte` | « Mon compte voyageur et ma progression » |

---

## 3. Les 46 routes de `main`

**Légende :**
- Base : la page a besoin de Supabase (compte de démo) pour afficher quelque chose.
- ✅ : matériel réel prêt, vérifié.
- ◐ : matériel partiel.
- ❌ : à tourner.
- — : hors film.

### Dans le film

| Route | Ce que c'est (la phrase du film) | Base | Matériel |
|---|---|---|---|
| `/hub` | Le tableau de bord du voyage en cours. Huit tuiles : Météo, Budget, Carte, Étapes, Carnet, Kits, Paperasse, Groupe. Chacune ouvre son tiroir. | oui | ✅ écran et 8 tiroirs ; ❌ geste « ouvrir une tuile » |
| `/hub/[section]` | Les 19 sections du voyage (voir § 4). | oui | ❌ |
| `/explorer` | La carte du monde, du globe au sentier : recherche, couches, fonds de carte, lancement d'une activité, SOS. | oui (tuiles et repères) | ◐ capture sans globe ; ❌ tout le reste |
| `/compas` | Le préparateur : une phrase (« Où veux-tu aller ? ») devient un voyage, avec nuits, trajet, kit et budget. | oui | ✅ écran, bandeau « Je prépare… », saisie réelle ; ❌ tiroirs Vérifs et À prévoir |
| `/communaute` | Le fil des voyageurs : stories, publications, notifications, recherche, bouton Créer. | oui | ❌ (attention aux contenus de test, voir § 6) |
| `/communaute/reels` | Les vidéos plein écran des voyageurs. | oui | ❌ |
| `/communaute/post/[id]` | Une publication et ses réactions. | oui | ❌ (facultatif) |
| `/carnets` | Les carnets de bord : onglets En route, Suivis, Monde, Les miens. | oui | ✅ écran ; ❌ changement d'onglets |
| `/carnets/[id]` | Un carnet de bord (Tour des Écrins) : fil de bord et tiroirs. | oui | ◐ (labo) ; ❌ vraie route et tiroirs |
| `/clubs/[id]` | Un club (Cordée des Alpes) : sorties programmées, membres et cordée, salons, statistiques, coffre matériel, réglages. | oui | ❌ |
| `/sorties/[id]` | Une sortie de club : date, météo, participants. | oui | ❌ |
| `/messagerie` | Les conversations : groupes, demandes, nouvelle discussion. | oui | ❌ (pseudo personnel à flouter) |
| `/compte` | Le profil du voyageur : trace globale, sorties par massif, carte d'empreinte. | oui | ✅ écran ; ❌ tiroir « Personnaliser la carte d'empreinte » |
| `/compte/suivi-en-direct` | Partager sa position le temps d'une sortie, avec un lien qui se révoque. Onglets Partage, Contacts, Montre. | oui | ✅ onglet Partage ; ❌ Contacts et Montre |
| `/compte/montres` | Les montres connectées. | oui | ❌ |
| `/compte/sensors` | Les capteurs. | oui | ❌ |
| `/compte/activites` | L'historique des activités. | oui | ❌ |
| `/kit-studio` | Le sac en 3D, réel (`.glb` publiés uniquement), avec son poids et son contenu. | oui | ✅ image fixe ; ❌ rotation du sac |
| `/live/[token]` | La page qu'ouvre un proche quand on partage sa position. | non : les liens vivent en mémoire du serveur (`InMemoryLiveTrackingStore`) | ❌ : à filmer en local, voir § 6 |
| `/manifeste` | Le ton de la marque : « Un sac. Une carte. Le reste vient de vous. » | non | ✅ (26/11) |
| `/pro` | L'espace Pro B2B (offres guides et agences). | non | ✅ (26/11), en bonus |
| `/profil`, `/profil/[id]` | Le profil public d'un voyageur. | oui | ❌ (facultatif) |

### Hors film

| Route | Raison |
|---|---|
| `/`, `/carte-interactive`, `/hub/nouveau` | Accueil web ; redirections. |
| `/connexion`, `/connexion/nouveau-mot-de-passe`, `/inscription` | Authentification. |
| `/panier`, `/checkout` | Boutique, Stripe hors périmètre. |
| `/admin`, `/admin/produits`, `/admin/progression`, `/developpeurs`, `/recette-hub`, `/dev/carnet-v2` | Outils internes. |
| `/apercu/[token]` | Aperçu partagé, non nécessaire. |
| `/accessibilite`, `/cgu`, `/cgv`, `/cookies`, `/mentions-legales`, `/politique-confidentialite`, `/contact` | Pages légales et de contact. |

---

## 4. Sections du Hub

Source : `src/features/hub/registry/hubSectionRegistry.ts`, route `/hub/<segment>`.

| Nature | Sections |
|---|---|
| Possession (matériel) | Inventaire `inventaire` · Kits `kit` · Préparation `preparation` (redirige vers `/compas?etape=kit`) · Départ `depart` · Disponibilité `disponibilite` · Alertes `alertes` · À ne pas oublier `oublis` |
| Sortie (voyage) | Aperçu (racine) · Itinéraire `itineraire` · Équipement `kit-voyage` · Groupe `groupe` · Budget `budget` · Documents `documents` · Checklist `checklist` · Sécurité `securite` · Journal `journal` · Export `export` |
| Collectif | Groupe `groupe` · Invitations `invitations` · Voyages liés `voyages` |

---

## 5. Tiroirs connus

Relevés dans le code ; la découverte du script complétera cette liste au tournage.

### Explorer (`features/explorer-v2/sheet/SheetContent.tsx`)

**Le tiroir principal suit le niveau de zoom :**
- niveau 0 : « Le monde · Le globe s'ouvre sur toi » ;
- niveau 2 : mini-sélecteur Été / Hiver ;
- niveau 3 : mini-sélecteur Vue 2D / Relief 3D.

Bouton « Démarrer une activité ».

**Commandes :**
- « Ouvrir le menu Explorer » ;
- « Calques de la carte » ;
- « Style du fond de carte » : Relief, Plan, Satellite ;
- « Rechercher un lieu ou un parcours » ;
- « Ma position », « Boussole ».

**SOS :** « SOS : maintenir 1,5 seconde ». On le montre ; on ne le déclenche jamais.

**Couches & fonds (les vrais intitulés) :**
- **Fonds nationaux officiels.**
- **Éléments visibles :**
  - marqueurs de distance ; itinéraires et sentiers ;
  - points d'eau ; refuges, abris et bivouacs ; sommets et belvédères ;
  - accès et départs ; dangers signalés (« névés, éboulements, crues ») ;
  - services, location, réparation et VAE ;
  - itinéraires pédestres et cyclables ; mes lieux enregistrés ; highlights ;
  - feux actifs et alertes ;
  - **neige et avalanche**, marquée « Indisponible » dans l'app ;
  - feux et zones brûlées.
- **Couches terrain :** relief 3D, ombres portées, pente de l'itinéraire, surface du sol, hors-route.
- Zone hors ligne.

**Couches « bientôt » dans le film**, jamais montrées comme disponibles :
- couloirs aériens, qualité de l'air, ciel étoilé : absents du code ;
- avalanches : « Indisponible » dans l'app ;
- crues en couche : aujourd'hui, seulement un type de danger signalé ;
- feux de forêt : la couche existe, mais elle dépend d'une source d'incidents. On l'écrit « bientôt » tant qu'elle n'affiche pas de vraies données au tournage.

### Les autres pages

| Page | Tiroirs et onglets |
|---|---|
| **Compas** | Boutons Solo, Budget, Sac, À prévoir, Vérifs. Le tiroir Vérifs annonce « signaux vérifiables, chacun avec sa source ». Il y a aussi À réserver et « Presque prêt » (J-191). |
| **Hub** | Les tuiles Météo (MET Norway, frise horaire), Budget (rythme, projection, marge), Carte (pack hors ligne), Étapes (« Démarrer le voyage »), Carnet (moments, notes, récit), Kits (checklist), Paperasse (Documents, À réserver, Urgences) et Groupe (Membres, Positions & Sécurité). |
| **Carnet** (`CarnetDrawerV2`) | Sac, Chiffres, Équipage, Pokédex. Également : « Carte du parcours », « Profil d'altitude du parcours », « Présentation du carnet » et « Reprendre dans le Compas ». Le fil de bord compte sept types de cartes : Rencontre, Pokédex, Refuge et bivouac, Performance, Kit, Incident, Dépense. |
| **Communauté** | « Créer » ouvre `CreateDrawer`, puis « Carnet » ouvre le tiroir de création de carnet. On l'ouvre sans jamais valider. |
| **Club** | « Espaces du club », « Membres et cordée du club », « Sorties programmées, agenda et météo ». Ces intitulés sont relevés par le tournage du 24/11 ; ils sont à confirmer par la découverte. |
| **Suivi en direct** | Onglets Partage, Contacts et Montre. |

---

## 6. Ce qu'on ne fait pas (règles de tournage)

- **Aucune écriture.**
  - Le script bloque au niveau réseau les écritures Supabase, les RPC d'écriture et les API internes. Il bloque aussi les actions serveur dès que la page est chargée.
  - La découverte ne clique jamais « Préparer », « Publier », « Envoyer », « Partager », « Démarrer » ni « SOS », ni aucun nom de la liste `INTERDIT`.
- **`/live/[token]`** : le lien de suivi n'est pas écrit en base. Il vit dans la mémoire du serveur Next (`features/compte/live-tracking/server/runtime.ts`, `InMemoryLiveTrackingStore`). On peut donc le créer en local, avec une position simulée dans le Vercors, et ouvrir la page du proche dans un second onglet, sans rien écrire.
- **Données de démo ajoutées le 26/11**, avec l'accord de Tony (« rajoute du contenu même faux… sans rien casser ») :
  - messages récents dans sept conversations de démo ;
  - douze stories prolongées ;
  - trois publications ;
  - les quatre publications de test de Léa reculées d'un an ;
  - le club de test renommé « Les Hauts-Plateaux du Vercors ».

  Rien n'est supprimé. Le détail est dans `tools/donnees/film-seed.sql`, et `tools/donnees/film-annuler.sql` défait tout.
- **Messagerie :** les deux conversations liées au compte personnel de Tony (`tony_tony_faf6`, `faracitonyp_7f2e`) passent en 8ᵉ et 10ᵉ position, sous le premier écran. Si elles apparaissent quand même, on les floute ou on recadre.
- **Carnets de test de Léa** (« Au lac de tourcoing », « jezkbfze », « Test Carnet », « Val joly », « Le lac leman ») : on n'y touche pas. On cadre les onglets autrement ; « Le lac leman » est en tête de « En route ».
