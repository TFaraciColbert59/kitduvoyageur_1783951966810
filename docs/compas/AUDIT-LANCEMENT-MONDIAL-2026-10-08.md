# Compas — audit avant un lancement mondial (8 octobre 2026)

> Question de Tony : à combien de pour-cent est la finalisation de `/compas` pour un
> lancement mondial ? Audit fait sur `main` (`8d5aac4`, en production) et sur la base de
> production : quatre audits du code en parallèle (moteur, interface, services
> externes, fiabilité et sécurité), mesures en base, journaux d'erreurs Vercel.

## Verdict

| Cible | Prêt | Ce qui manque surtout |
|---|---|---|
| **Lancement mondial** (tous pays, toutes langues) | **≈ 35 %** | Langue (tout est en français), voyageur supposé français, services gratuits interdits en commercial |
| **Lancement francophone** (Français qui partent dans le monde) | **≈ 50 %** | Services gratuits, sécurité, fuseaux, origine sans GPS, échelle d'un pays |
| Francophone, après passage aux offres payantes (≈ 200 à 400 $/mois) | ≈ 65 % | Qualité de l'itinéraire hors Europe, papiers par nationalité, kit climatique |

Le parcours, l'honnêteté des données (rien d'inventé, chaque repli dit sa cause) et
l'architecture (moteur pur testé, caches partagés, fournisseurs isolés dans un fichier
chacun) sont de niveau lancement. Ce qui manque est surtout **contractuel** (offres
gratuites), **linguistique** (français partout) et **centré sur la France** (papiers,
devise, fuseau, départ).

### Détail par volet

| Volet | Poids | Monde | Francophone |
|---|---|---|---|
| Moteur (itinéraire, budget, papiers, kit, météo) | 30 % | 45 % | 65 % |
| Interface (langue, formats, parcours, accessibilité, légal) | 25 % | 33 % | 75 % |
| Services externes et hébergement | 25 % | 20 % | 20 % (80 % avec offres payantes) |
| Fiabilité et sécurité | 20 % | 45 % | 45 % |
| **Total pondéré** | | **≈ 35 %** | **≈ 50 %** |

### Mesuré en production

- Depuis l'enregistrement de l'issue (7 oct.) : **151 préparations réussies sur 156 (97 %)** ;
  4 échecs sur 5 sont des attentes de la limite de fréquence.
- **Aucun vrai utilisateur encore** : ces préparations viennent de 1 ou 2 comptes de test.
  82 comptes au total, 23 créés en 30 jours, 3 ont utilisé le Compas en 7 jours.
- Erreurs Vercel sur 7 jours : quota IA en panne (855, **corrigé aujourd'hui**), IA
  NVIDIA muette ou trop lente (95), coupures à 60 s (25, plus depuis le 7 oct.),
  refus RouteStack (21, surtout pendant la mise au point).
- Base : 424 Mo sur 500 (offre gratuite Supabase).

## Corrigé pendant l'audit (8 octobre)

| Défaut | Gravité | État |
|---|---|---|
| **Quota IA par personne jamais appliqué** : la fonction SQL plantait (855 fois en 7 jours) et le code laissait tout passer. Le correctif existait dans le dépôt mais n'avait jamais été appliqué en base | Bloquant (coût IA sans plafond) | Appliqué et **prouvé en production** (préparation du Vercors comptée) |
| **Un simple lecteur d'un voyage devenait éditeur** : il lisait le jeton d'un lien d'invitation et l'acceptait (aussi tout visiteur d'un voyage public) | Bloquant (sécurité) | Appliqué en base (`20261008133824`) |
| **Noms sans lettre latine** (« Москва », « 東京 ») : une même clé de cache pour tous, la réponse de l'un servie à l'autre | Important | Corrigé, testé, sur la branche |
| **Mention « © OpenStreetMap » sans position** sur la carte (classe non interpolée) | Important (licence) | Corrigé, sur la branche |

## Bloquants restants

### Services et hébergement (contrat)

1. **Serveurs de démonstration et offres gratuites interdits en commercial** :
   - routage OSRM démo, FOSSGIS, Valhalla, BRouter ;
   - Photon et Nominatim publics (Nominatim : 1 requête/s pour toute l'application,
     la file d'attente actuelle n'existe que par instance) ;
   - Overpass public, appelé **sur 5 instances à la fois** dont deux russes ;
   - IA NVIDIA : la clé gratuite sert au prototypage, pas à des utilisateurs réels.
2. **Vercel** : l'offre Hobby interdit l'usage commercial (paiement Stripe, affiliation).
   L'offre du compte n'est pas lisible par le connecteur : **à vérifier par Tony**.
3. **Supabase gratuit** : 500 Mo (lecture seule au-delà, tout le site tombe), pas de
   sauvegarde automatique, caches sans plafond.

### Sécurité

4. **Écriture publique du cache d'itinéraires** (`POST /api/route/cache`, sans
   connexion) : une distance inventée peut être servie comme « mesurée », et la base
   remplie.
5. **Limite de fréquence non distribuée** (mémoire par instance sans Upstash) et
   contournable en écrivant l'état de préparation du voyage.
6. **Connexion démo partagée ouverte en production** : un compte commun à tous les
   visiteurs, qui peuvent voir et changer les voyages des autres, épuiser les quotas,
   changer son mot de passe ou le supprimer.

### Produit (voyageur supposé français)

7. **Papiers, prises et change** justes pour un Français seulement : un Américain à
   Yosemite reçoit « passeport + ESTA » ; un Brésilien en Italie « carte d'identité ».
8. **Sans GPS, le départ est la France** (vol depuis Paris, même pour un Belge).
9. **Langue** : environ 1 000 textes de l'interface, 188 messages serveur et les
   consignes de l'IA sont en français, en dur. Du français est aussi enregistré en base
   (titres, budget, notes, kit).
10. **Heures de soleil à l'heure de Paris** au-delà de 9 jours de prévision (Pérou :
    7 h d'écart ; le « départ conseillé » en dépend) et « aujourd'hui » à l'heure de
    Paris (« demain » faux à Los Angeles le soir).

## Importants

- Itinéraire à l'échelle d'un pays toujours confié à l'IA (Patagonie, Vietnam, Ouest
  américain) ; bases multiples jamais atteintes en ligne ; densité de villages
  européenne supposée (espaces sauvages pauvres) ; pas d'acclimatation en alpinisme ;
  grands itinéraires (GR20, Annapurna, JMT) hors de portée.
- Euro imposé, carburant à 1,80 €/L partout, péages ignorés ; train dans 10 pays.
- Kit fondé sur l'altitude et quelques codes pays : rien pour les tropiques
  (moustiques, eau), le grand froid sans altitude, la mousson.
- Aucun suivi d'erreurs (Sentry ou équivalent) ni alerte ; pas d'écran d'erreur propre
  au Compas.
- Préparation coupée en cours : étapes orphelines possibles ; attente qui recharge la
  page entière toutes les 4 s.
- RGPD : position GPS exacte envoyée aux services de carte et parfois enregistrée ;
  politique de confidentialité obsolète (ne cite ni NVIDIA, ni Vercel, ni Geoapify).
- Mentions : IA non signalée au démarrage ni sur les conseils (AI Act art. 50) ;
  Geoapify (« Powered by Geoapify » exigé) et Esri non crédités ; une mention
  d'affiliation manque dans la recherche d'hébergement.
- Accessibilité : focus non piégé dans les tiroirs, qualité du calendrier codée par la
  seule couleur, tailles de texte en px (WCAG 2.2, à reprendre).
- Bureau et tablette non conçus (gelé en P3).

## Plan proposé

| Phase | Contenu | Effort | Coût mensuel |
|---|---|---|---|
| **1. Socle commercial** | Vercel Pro (si Hobby), Supabase Pro, IA sous licence de production, cartes payantes ou auto-hébergées (Geoapify API ou serveur OSM), fin de la course Overpass, User-Agent et rythme Nominatim global ; écriture du cache d'itinéraires réservée au serveur, limite de fréquence distribuée, démo fermée en production ; suivi d'erreurs ; GPS arrondi et politique de confidentialité | 15 à 25 j | ≈ 200 à 400 $ (1 000 préparations/jour) ; ≈ 800 à 1 500 $ (10 000/jour) |
| **2. Lancement francophone** | Fuseau du voyageur et de la destination ; départ sans GPS (ville dite, domicile ; jamais la France par défaut) ; papiers neutres hors résidents français ; référentiel géographique (P1.1) et bases multiples ; kit climatique ; mentions IA et licences ; écrans d'erreur ; écarts d'accessibilité ; rejouer les jeux P2 en production | 35 à 55 j | — |
| **3. Lancement mondial** | Interface et IA en anglais (puis 5 à 8 j par langue) ; nationalité, devise et unités du voyageur ; papiers par passeport ; train et aéroports hors Europe ; alertes officielles hors France | 70 à 100 j | — |

## Décisions attendues de Tony

1. **Cible du lancement** : francophone d'abord (≈ 50 % aujourd'hui, ≈ 65 % après la
   phase 1) ou mondial d'emblée (≈ 35 %, phase 3 nécessaire) ?
2. **Budget mensuel** pour quitter les offres gratuites (≈ 200 à 400 $ au départ).
3. **Offre Vercel** du compte (Hobby ou Pro) : à vérifier dans le tableau de bord.
4. **IA** : rester sur NVIDIA (licence AI Enterprise) ou le même modèle chez un
   hébergeur payant (≈ 30 $/mois à 1 000 préparations/jour) ?
5. **Connexion démo** en production : la fermer, ou la remplacer par des sessions
   d'essai éphémères ?
6. **Index inutiles** (−70 Mo) : à lancer dans le SQL Editor de Supabase (le
   connecteur de la session bloque toute suppression).
