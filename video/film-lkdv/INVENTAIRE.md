# Inventaire des fonctionnalités LKDV (pour le film)

Relevé le 16/11/2026 dans le code (`src/app`, `src/features`, traductions `src/lib/i18n/translations/*.fr.ts`) et les captures de `docs/` et `audit/`. Les libellés entre guillemets sont ceux de l'interface. **Statut** : ✅ actif · 🚩 derrière un drapeau ou une clé partenaire · 📷 capture réelle disponible · ❌ pas de capture (à faire avec un compte de démo qui marche).

## 1. Accueil, marque — `/`, `/manifeste`
- « Là où la carte se termine. » ; « Composer mon sac », « Voir les aventures » ; base de départ mise en avant (« Cabane du Grand Vaneau », 248 €). ✅ 📷 capture prod (session de ce jour).
- Manifeste : « Un sac. Une carte. Le reste vient de vous. » (« Tenu, pas promis », « Léger et sans réseau », « Partagé, pas possédé »). ✅ 📷.

## 2. Explorer — `/explorer` (redirections `/carte-interactive`, `/lieux`)
- Globe, monde, pays, régions, départements ; recherche ; « Bienvenue dans Explorer » (« Autoriser ma position »). ✅ 📷 `docs/explorer-v2/preuves/screens/*`, `docs/atlas/captures/*`.
- Fiches de lieux : sommets (« Pointe des Vioz »), refuges (« Refuge du Lac Blanc », altitude, places), points d'eau (« Eau potable », signalements), belvédères, bivouacs, dangers. ✅ 📷.
- « Calques » (itinéraires, points d'eau, refuges, bivouacs, zone hors ligne). ✅ 📷.
- « Hors ligne » : zone téléchargeable, « Télécharger cette zone » (tuiles estimées, zoom 10 → 15). ✅ 📷.
- « Itinéraire » : trace, profil altimétrique, points d'eau sur la trace. ✅ 📷.
- « Démarrer » : Course, Randonnée, Vélo, Kayak, Trail, Ski de rando, Escalade, Balade en famille → suivi en direct (chrono, distance, D+, pause, drapeau, stop) ; « SOS » (« Maintiens le bouton rouge 1,5 s pour armer l'alerte ») ; « Bilan ». ✅ 📷.
- « Créer un départ » (départ libre, `features/free-departure`). ✅ 📷.

## 3. Compas — `/compas` (le préparateur ; `/prepare`, `/hub/nouveau`, `/voyages/nouveau`… y renvoient)
- Étapes : « Où », « Nous », « Résa », « Verdict », « Kit ». ✅ 📷 `docs/compas/preuves/*` (jeu de démo).
- **Où** — « Où veux-tu aller ? » ; phrase libre ; « Voici ce que j'ai compris » (Activité, Lieu, Départ, Durée, Quand, Groupe, Nuits, Envies, Déplacements, Budget) ; 20 activités (Randonnée, Trek, Bivouac, Trail, Vélo, Bikepacking, Escalade, Alpinisme, Ski, Kayak, Road trip, Van, City trip…) ; « Préparer mon aventure » → préparation visible (`CompasPrep`) ; parcours sur des lieux réels (carte, étapes D → 1 → 2 → A, « D+ 2 750 m · 44 km ») ; éditeur de parcours. ✅ 📷.
- **Nous** — « Équipe » (rythme du groupe : « Le groupe marche au rythme de Noé »), « Qui » (invitations, rôles), « Budget » (« Qui doit quoi »), « Bouteille » (annonce). ✅ 📷 (Équipe).
- **Résa** — « Nuits », « Réservations » (« Total des réservations », conversion de devise), « Offres » (« Partenaires affiliés : le classement n'est jamais influencé par la commission »). 🚩 recherche en direct hôtels, vols, voitures : active seulement avec les clés partenaires. ❌ capture.
- **Verdict** — « Prêt à partir » / « Vigilance » / « Bloqué » / « À compléter » ; axes « Physique », « Technique », « Conjoncturel » ; « Signaux vérifiables · sans score » ; onglets « États », « Risques », « Météo » (MET Norway, NASA POWER), « Veille », « Sources » ; alertes officielles (Meteoalarm, NWS, ECCC 🚩 `COMPAS_ALERTS_WORLD`). ❌ capture.
- **Kit** — « Pas encore prêt · 14 % », « 1 / 5 emballés · 1 vital à trouver », charge par personne ; onglets « Conseils », « Mes kits », « Inventaire », « Trouver », « Emballer », « Sac », « Eau ». ✅ 📷.
- IA (Nemotron) signalée : « Ce qu'elle propose est signalé comme tel, et le Compas le vérifie ». Langues EN/ES/DE/IT 🚩 (`NEXT_PUBLIC_I18N_*`).

## 4. Kit Studio — `/kit-studio`
- Sac 3D réel (10 corps : LKDV ONE 15 à 80 L, Daypack 22, Trekker 55, Ultralight 40, Expedition 75, Duffel 60), coloris « Forêt », « Sauge », « Pierre », « Nuit » ; modules M01–M20 (« Poche multifonction », « Porte-piolets », « Poche pharmacie »…) ; objets du kit ; poids « 10,3 kg » ; « Commander · 5 pièces · 471 € » ; vue éclatée. ✅ 📷 `docs/kit-studio/captures/walkthrough-*.png` ; maillages `public/assets/bags|modules/*.glb`.

## 5. Matériel, kits et lignées — hub « possession » (`/hub/*`)
- « Inventaire », « Kits », « Préparation », « Départ », « Disponibilité » (prêts), « Alertes » (entretien, péremption), « À ne pas oublier ». ✅ ❌ capture.
- Lignées de kits : forker un kit, « kit souche », « éprouvé », « gardé par X voyageurs sur 10 », preuve terrain (« essentiel », « utile », « jamais servi », « défaillant », « manquait »), « part créateur » (crédit boutique). ✅ ❌ capture.
- Panier et paiement : `/panier`, `/checkout` (Stripe). ✅ ❌ capture.

## 6. Voyage (hub « sortie ») — `/hub/[section]`
- « Aperçu », « Itinéraire », « Équipement », « Groupe », « Budget », « Documents » (papiers jamais visibles des tiers), « Checklist », « Sécurité », « Journal », « Export » (carnet A4, GPX), « Invitations », « Voyages liés ». ✅ ❌ capture.

## 7. Terrain et sécurité
- Suivi en direct partagé : `/compte/suivi-en-direct`, page publique `/live/[token]` (« Position partagée temporairement par un voyageur »). ✅ ❌ capture.
- Montres et capteurs : « Montres & Live Sync », « Capteurs & Santé », « Connecteurs partenaires » (Garmin, Strava, Suunto, Polar, Wahoo, Apple Health). 🚩 selon les clés. ❌ capture.
- Aperçu protégé d'une trace : `/apercu/[token]` (« révocable par son auteur »). ✅.

## 8. Carnets de bord — `/carnets`, `/carnets/[id]`
- Hub : « Carnets de bord », « Des aventures en route, des récits de retour », filtres « En route », « Suivis », « Monde », « Les miens » ; « Créer un carnet ». ✅ 📷 `docs/audit/carnets-hub-2026-11-11/*`.
- Fiche : jours, trace, « Chiffres » (distance, dénivelé, durée), « Équipage » (participants, réactions, suivre), « Fil de bord » (moments, médias, nature, rencontres), « Route » (étapes, altitude, météo et ciel, nuit), « Sac » (kit, poids, verdicts). Visiteur constate, participant modifie. ✅ 📷 `docs/audit/carnet-drawers-2026-11-11/prod3/*`.

## 9. Communauté — `/communaute`, `/clubs/[id]`, `/sorties/[id]`, `/messagerie`
- Fil, publication (« Photo », « Billet », « Question », « Événement »), stories, reels (`/communaute/reels`). ✅ 📷 `docs/audit/communaute-v2-2026-11-08/**`.
- Explorer la communauté : carnets, « Clubs » (« Vercors Alpin », « Membre », « Demander à rejoindre »), « Sorties » (agenda, « Traversée du Vercors », « S'inscrire », « Liste d'attente »), recherche. ✅ 📷.
- Messagerie, invitations, notifications. ✅ ❌ capture.

## 10. Compte et identité — `/compte`, `/profil`
- Profil, activités, commandes, badges ; « Empreinte » terrain (sceau `FieldSeal`, privé par défaut, granularité région) ; orientation privée. ✅ 📷 `docs/audit/carnet-drawers-2026-11-11/prod3/03-compte*.png`.

## 11. Pro et développeurs — `/pro`, `/developpeurs`
- Offres pour guides et accompagnateurs, agences d'aventure, boutiques outdoor ; console API (clients scopés, quotas, webhooks signés, hors navigation publique). ✅ ❌ capture.

## 12. Plateformes
- Web (Vercel), app iOS et Android (Capacitor), mode hors ligne (service worker, cartes téléchargées), thème clair Liquid Glass. ✅.

## Moments les plus forts à filmer
1. La phrase tapée → « Voici ce que j'ai compris » → la carte se remplit.
2. Le vol satellite jusqu'au parcours, tracé qui se dessine.
3. Le verdict qui passe de « À compléter » à « Prêt à partir ».
4. Le sac 3D qui change de coloris et reçoit ses modules.
5. La lignée de kit : « gardé par 7 voyageurs sur 10 ».
6. Le bouton « Démarrer » → chrono en direct → « SOS ».
7. La zone hors ligne qui se télécharge.
8. Le carnet qui se raconte jour après jour.
9. Le club, la sortie, « S'inscrire ».
10. Toutes les surfaces qui se rangent dans un seul badge.
