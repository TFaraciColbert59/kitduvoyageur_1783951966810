# Préparateur `/compas` — état (source de vérité unique)

> Une seule ligne droite : demande libre → compréhension → lieu → itinéraire → données →
> kit / budget / conseils → résultat final. Rien de P3 tant que P0/P1 ne passent pas P2.
> « Fait » = prouvé de bout en bout sur la preview et contrôlé en base, pas « le code compile ».

**Écran v5 « carte vivante », 23 octobre 2026 (code et tests, poussé sur `claude/compas-p1-referentiel`, rien en base, aucune migration).** `/compas` affiche l'écran v5 par défaut (`?v5=0` rouvre l'ancien le temps de la transition ; laboratoire `/dev/compas-v5` et `/dev/compas-v5-carte`, `next dev` seulement). Contenu : card du voyage (jours et nuits en tuiles ou en fil), barre haute (pilule « Nous » solo ou groupe, « Dis-le », menu), îlot dynamique, carte MapLibre vivante (tracé par jour, nuits en photo, alternatives du jour ouvert, calques, bulle), tiroirs Jour, Nous, Budget, Sac, À prévoir, Vérifications, Météo, Plus ; les réglages du voyage restent portés par les parcours de l'ancien écran (`LegacyHost`). Serveur : `compasV5ExtrasAction` (nuits OSM classées, photos Wikimedia Commons avec auteur et licence, options de trajet), choix de nuit et de trajet annulables. Données : tout vient des données réelles du voyage ; un prix d'hébergement est un repère de barème, dit comme tel ; rien n'est inventé. Preuves : `tsc` propre, `vitest src/features/compas tests/i18n tests/security tests/config` 269 fichiers / 5 400 tests verts, `next build` réussi (lint inclus). **NON prouvé** : appels réels à Commons et Overpass, rendu sur appareil, banc Playwright (ses scénarios visent l'ancien écran : à rejouer avec `?v5=0` ou à réécrire). **Limites connues** : trajet choisi et confirmation de réservation non relus au rechargement (aucun champ serveur) ; « Déjà acheté » écrit `purchase_state = 'added'` que le moteur ne compte pas comme possédé ; pas d'annulation pour « Partir de ce kit » ni pour l'ajout d'une dépense ; antiméridien non géré par la carte.

**Phase 6 « Monde », passe du 20 octobre 2026 (code et tests seulement, rien en base).** Branche de travail `worktree-agent-ab0cfc50300f62680` (basée sur `claude/compas-p1-referentiel`, non poussée). Faits : compteur de l'équipe, dates d'invitation, historique d'un objet et faits d'inventaire calculés dans la langue (FR/EN/ES/DE/IT) ; carte « profil voyageur » traduite avec pays, devises et langues nommés par `Intl` ; titres d'étapes et lignes de budget rangés en base rendus dans la langue à la lecture (`engine/storedText.ts`, base inchangée) ; montants du budget par `Intl` ; semaine du calendrier « Quand » selon la région ou le réglage du compte ; cookie `lkdv_units` pour que le serveur connaisse les unités ; outil de couverture étendu à `src/features/*` (31 dossiers, 6 021 chaînes à extraire, informatif). **Passe suivante, branche `phase6-reste` (basée sur `fbd3ef13`, non poussée, sans migration)** : péages / vignettes (`tolls.ts`) et danger (`danger.ts`) dits en FR/EN/ES/DE/IT ; vignette et notes de trajet rangées relues par clé à la lecture ; l'IA écrit aussi en ES/DE/IT (consignes, garde-fous du verdict, thèmes, mention IA), registre poli. Preuves : `npx tsc --noEmit -p .` propre, `npx vitest run src/features/compas tests/i18n` 229 fichiers / 4 614 tests verts, `traveller_privacy.mjs` vert, `npm run i18n:compas` : `engine/` 851 → 828, `server/` 166. **Restent en phase 6** : relecture ES/DE/IT par des personnes de chaque langue ; ~844 chaînes du moteur (`tolls`, `autofill`, `compasModel`, `travel`…) et 157 du serveur ; notes/`basis`/péage rangés en base (clés à l'écriture = migration, non faite) ; consignes de l'IA en ES/DE/IT (6.2) ; réglage d'unités en base ; dates numériques non branchées ; Xcode pour les `.lproj` ; juriste pour les mentions d'affiliation.

**Fin de journée du 18 octobre 2026 (soir).** Importés depuis le dernier point : `geo_massifs` = **774 lignes** (FR, CH, IT, AT, GeoNames). Les imports Overpass
(`trails`, `areas`, `rivers`, `sites`) n'ont **rien écrit de fiable** : private.coffee renvoie HTTP 500 presque en continu depuis ~06 h UTC (une seule tuile a répondu).
Deux bogues trouvés et corrigés sur `main` (PR #110, #114) : une réponse vide avec remarque n'est plus prise pour « aucun résultat », et le centre d'un objet
est tiré de son emprise quand Overpass ne renvoie que `bb` (cause réelle des tuiles alpines « importées » à 0 ligne). Les 14 tuiles à 0 ligne de `geo_trails_coverage`
sont rendues périmées pour être refaites. Intégré depuis le matin : anglais (6.2), unités impériales (6.3), textes du moteur (6.1), recherche de lieux par langue (6.4),
ES/DE/IT (dictionnaires + compréhension des phrases), textes natifs, mentions d'affiliation par région, workflow mensuel `geo_places` + noms par langue (migration
différée `20261018120000_geo_place_names.sql` À APPLIQUER PAR TONY), `visual-tests` découpé (références à refaire), note d'alignement des migrations.

**Mise à jour du 18 octobre 2026 (branche `claude/compas-p1-referentiel`, fusionnable sans conflit dans `main` au 18 oct., aucune PR ouverte).**
Tout ce qui suit est **dans le code et testé** (236 fichiers Compas, 4 547 tests verts, `tsc` propre ; suite complète du dépôt : 10 790 tests,
seuls 11 échecs, tous dus à l'absence de Chromium pour Playwright et déjà présents avant) mais **NON prouvé en production** : les interrupteurs sont éteints.

- **Base de données (appliqué le 17 oct., relu en base, RLS sans accès public)** : `geo_pois` (**112 400 points, 71 tuiles sur 72 de la zone Alpes, import arrêté le 18 oct. à 04 h 18 UTC** : il manque la tuile lon 16 / lat 47, à l'extrême est, où Overpass répond 500 ; 85 718 points d'eau, 7 725 sources, 6 474 abris, 5 766 campings, 4 579 refuges, 2 138 cabanes ; France non lancée, à décider),
  `geo_trails`, `geo_sites`, `geo_rivers`, `geo_areas`, `geo_massifs` créées **vides**, `geo_places_search` (index de 2,6 Mo, vérifié sur « Villard-de-Lans »,
  « Rome », « Bourg en »). `places_geo` supprimée par Tony : base à 229 Mo sur 250.
- **Référentiels branchés dans le Compas, éteints par défaut** : grands itinéraires (`COMPAS_GEO_TRAILS`, champ `trail` de l'intention), rivières (`COMPAS_GEO_RIVERS`),
  parcs (`COMPAS_GEO_AREAS`), massifs, régions naturelles et presqu'îles GeoNames (`COMPAS_GEO_MASSIFS`), escalade, via ferrata et ski (`COMPAS_GEO_SITES`), lieu saisi
  cherché dans `geo_places` (`COMPAS_GEO_PLACES_SEARCH`), refuges et points d'eau (`COMPAS_GEO_POIS`), alertes officielles NWS et ECCC (`COMPAS_ALERTS_WORLD`, mentions légales faites).
- **Produit** : départ dit visible et effaçable, heure de départ enregistrée (4.3, 5.5) ; train en Turquie et au Caucase, « aucune ligne » à Chypre, Malte et en Islande (4.4 ; prix
  du Caucase non sourcés, dits « estimation ») ; fond OpenFreeMap avec repli ArcGIS (`NEXT_PUBLIC_MAP_STANDARD`, défaut `arcgis`) ; module pur de jour de sommet depuis une base (4.5, non branché
  faute d'altitude de sommet dans le modèle) ; recherche de lieux dans la langue de l'interface ; textes natifs FR/EN/ES/DE/IT (iOS : fichiers non embarqués tant qu'ils ne sont pas ajoutés dans Xcode).
- **Langues (phase 6, lots 1 à 4 + messages serveur)** : interface du Compas et messages des actions serveur en FR/EN (~1 500 clés, test de couverture), consignes de l'IA et formats par
  langue ; l'anglais reste désactivé tant que `NEXT_PUBLIC_I18N_EN_ENABLED` n'est pas à 1. Faits depuis (18 oct.) : phrase anglaise comprise par les règles (corpus de 50 phrases),
  affichage en mi / ft / lb / °F, une partie des textes du moteur (période, contexte, formats, veille, conseils, kit). **Restent** (mesure `npm run i18n:compas` du 18 oct. : 0 chaîne
  dans les composants, 156 dans `server/` dont journaux et consignes IA voulus en français, 770 dans `engine/`) : le reste du moteur (péages, budget, trajets…), textes rangés en base,
  ES/DE/IT (en cours par ailleurs), réglage d'unités côté serveur.
- **Correctifs** : webhook Stripe (une erreur du reversement est propagée, Stripe rejoue) ; **la reprise des parts créateur après remboursement ne reprenait jamais rien** (corrigée en SQL, fichier
  `supabase/migrations_deferred/20261017000000_kit_attribution_reverse_bounded.sql` **non appliqué**) ; CI : actions GitHub en Node 24 sur cette branche (SHA vérifiés, aucun workflow n'a encore tourné avec ;
  **`main` reste en v4** sauf `geo-referentials-import.yml`, relu le 18 oct.) ; `eslint.ignoreDuringBuilds` à `false`, `npx eslint . --quiet` : 0 erreur (relancé le 18 oct.) ;
  test de confidentialité adapté à l'extraction des textes.
- **Plan resynchronisé le 18 oct.** : chaque case ouverte de `PLAN-100.md` relue contre le code, la CI et les commits (65 %, 126/194 ; 63 % le 13 oct.). Cochées avec preuve :
  retrait de `places_geo` (1.1, 3.8), `ignoreDuringBuilds` (9) ; passées en cours (codées, éteintes ou non prouvées) : référentiel d'abord (1.3, 1.4), OpenFreeMap (1.6),
  extraction des textes, `<html lang>`, phrase EN, recherche de lieux par langue, textes natifs (6), actions Node 24 (9).
- **`visual-tests` découpé (18 oct.)** : build une fois puis un job par projet Playwright ; `preparer-live` sauté sur un build (page de dev, 404) ; projet 393 px
  limité à la spec sociale. Mesuré en local : suite entière 46,1 min avant ; projet le plus long 16,8 min après. Durée sur GitHub **estimée** (≈ 21 min), pas mesurée.
  Le workflow reste rouge : 95 échecs de comparaison (références périmées ou absentes pour les deux projets iPhone) ; références à refaire après relecture (Tony).
- **À FAIRE PAR TONY (rien d'autre ne les débloque)** :
  1. SQL Editor : coller `supabase/maintenance/geo_finish_tile_functions.sql` (quatre fonctions `*_finish_tile`, le connecteur de la session ne peut pas les créer : elles contiennent un `delete`).
     Sans lui, les imports `geo_trails`, `geo_sites`, `geo_rivers`, `geo_areas` ne peuvent pas s'écrire.
  2. SQL Editor : `supabase/migrations_deferred/20261017000000_kit_attribution_reverse_bounded.sql` (reprise des parts après remboursement ; contrôle rejouable dans `supabase/replay/`).
  3. Après import et vérification, allumer dans Vercel : `COMPAS_GEO_POIS`, `COMPAS_GEO_TRAILS`, `COMPAS_GEO_RIVERS`, `COMPAS_GEO_AREAS`, `COMPAS_GEO_MASSIFS`, `COMPAS_GEO_SITES`,
     `COMPAS_GEO_PLACES_SEARCH`, `COMPAS_ALERTS_WORLD`, `NEXT_PUBLIC_MAP_STANDARD=openfreemap`, `NEXT_PUBLIC_I18N_EN_ENABLED=1` : un à la fois, avec vérification sur la préparation réelle.
  3 bis. Registre des migrations : exporter `supabase_migrations.schema_migrations` (SQL Editor, lecture seule), lancer `node scripts/db/migrations-alignment.mjs export.csv`,
     puis suivre `docs/compas/MIGRATIONS-ALIGNEMENT.md` (aucun `supabase db push` avant « Aucun écart. »).
  4. Décider de la fusion de la branche dans `main` (puis le workflow CI utilisera les actions Node 24 ; vérifier le premier run).
  5. Les points déjà listés plus bas (purges planifiées, secrets, identité de l'éditeur, `CRON_SECRET`, Meteoalarm, hCaptcha, `public_profiles`, licence IA) restent à votre charge.
- **Constats** : refuges des Alpes : les 4 dernières tuiles (Provence, Lorraine, est) échouent souvent sur Overpass ; `CompasScreen.test.tsx` dépasse parfois 5 s sous charge ; les modules d'actions
  Stripe et le webhook n'ont pas été éprouvés en production (Stripe est éteint).

Mis à jour : 13 octobre 2026. **En production** (`kitduvoyageur-1783951966810-ruddy.vercel.app` ; `koosmoweb.fr` ne résout plus depuis le 13 oct., domaine définitif à choisir) : lot A (PR #76,
sécurité), lot B (PR #77, clés gratuites), lot C (PR #78, `195a47f` : rapport quotidien,
sauvegarde, purges), lot D (PR #79, `153ddfc` : routage Geoapify puis Valhalla, estimation
annoncée, OSRM démo et BRouter retirés), lots E et F (PR #80, `f5b5ac9` : référentiel des
lieux habités ; interrupteur et plafond IA, crédits Geoapify comptés en base, rythme
Photon, position arrondie). Prouvés en production à 23 h 20 : Bauges, 3 jours, prêt en
48 s, 263 lieux sur 374 tirés du référentiel, distances Geoapify avec dénivelé du relief
(19,5 km et 1 302 m D+), crédits du jour comptés en base. Lot G (PR #81, `cdffeee` :
pages d'erreur honnêtes, droits des fonctions refermés en base, préparation comptée en
heavy). Lots H et I (PR #82, `ee7ae6f` : préparation durable, écritures de `metadata`
sans écrasement, relecture économe, fonctions à Paris, User-Agent du site, change Frankfurter
v2, cache IA d'un jour, politique de confidentialité unique et exacte, clés anti-abus en
HMAC, demande de position expliquée). Prouvés en production le 9 oct. à 4 h 15 :
5 préparations sur 5 (médiane 25 s, contre 35 s à Washington pour les Bauges), aucune
attente ni prise laissée en base, compteurs en empreinte, politique et mentions servies. Constat du 9 oct. :
Overpass private.coffee répond souvent 500 (points autour des étapes dégradés) ; le
référentiel des refuges et points d'eau (3.4) retirera cette dépendance. Plan à 0 € et cases
à cocher : `PLAN-100.md`. Branche de travail `claude/optimistic-albattani-i06ge7`.
Lots J et K (PR #83) : cartes Leaflet sur les fonds ArcGIS avec crédit complet, hors ligne
sans tuiles téléchargées ; demande comprise et conseils essentiels **sans IA** (nombres en
lettres, montants et devises, dates relatives, jours fériés, groupe ; altitude, avalanches,
solo, refuges, bivouac, rivière), suggestions de l'IA dites facultatives. Prouvé sur
l'aperçu le 9 oct. avec `AI_MODE=off` : 6/6 préparées en 15 s, aucun appel IA en base.
Lot L (PR #84, `ba5166e`, plan `docs/superpowers/plans/2026-10-09-compas-lot-l.md`, mené par
sous-agents avec revue de chaque tâche et revue finale) : MET Norway par un seul point
(20 req/s, rien avant `Expires`), limites sur la destination et la phrase, erreurs
serveur du Compas en base sans donnée personnelle (`app_errors`) et alertes du rapport
quotidien, cookies de session `Lax`. Migration appliquée ; le rapport du 8 oct. lève
« plus de 10 % de préparations échouées » (4 sur 11). Prouvé en production le 9 oct. à 13 h 45 : cookie de session `SameSite=Lax; Secure`
après « Essayer sans compte », `/compas` ouvert sans redirection, météo MET servie, aucune erreur
serveur en base ; base à 429,4 Mio.

Lot M (plan `docs/superpowers/plans/2026-10-09-compas-lot-m.md`, PLAN-100 4.7) : « aujourd'hui » au fuseau du navigateur, soleil et départ au fuseau de la destination, hiver selon l'hémisphère, saison sèche des tropiques hors table par les normales NASA POWER. Prouvé sur l'aperçu les 9 et 10 oct. (relu en base) : « demain » dit à 23 h 44 UTC donne le 11 oct. pour un voyageur à Paris et le 10 oct. pour un voyageur à Los Angeles ; Chapada Diamantina (Brésil, absent de la table) → « août, mois le plus sec selon les normales 2001-2020 (NASA POWER) » ; Patagonie → « décembre » (été austral). Fusionné dans la PR #86 avec le lot O (garde réseau des tests unitaires ; contournement de limite corrigé : une préparation en phase `rest` sans itinéraire en attente comptait comme reprise).
Lot N (plan `docs/superpowers/plans/2026-10-09-compas-lot-n.md`, PLAN-100 4.3 et 4.4) : « depuis Lyon » compris et rangé sur le voyage, trajet depuis le départ dit puis la position, jamais la France par défaut (sinon non chiffré, dit à l'écran), vol d'aéroport à aéroport (OurAirports, 3 244 aéroports), journée à plus de 3 h de trajet aller signalée ; tests verts, **prouvé sur l'aperçu le 10 octobre (lu en base, 0 erreur serveur)** : « 3 jours dans le Vercors depuis Lyon » range le départ Lyon (45,76 / 4,83, source « dit ») et garde le Vercors pour destination ; « 5 jours en Sardaigne depuis Lyon » chiffre « vol aller-retour depuis Lyon, LYS → CAG (…), environ 790 km » (180 €) ; « rando 3 jours depuis Grenoble » prépare autour de Grenoble avec la note « Lieu non précisé : préparé autour de Grenoble, ton point de départ » ; « à la journée dans le Mercantour depuis Annecy » signale « 4 h 41 de trajet aller pour une seule journée » ; « 5 jours en Sardaigne » sans position ni « depuis » : aucune ligne de vol, aucun défaut France, note « Point de départ inconnu : écris « depuis Lyon »… ». Noms à préposition (relecture Codex) : « rando 3 jours depuis Bourg en Bresse » range le départ « Bourg-en-Bresse » sans destination parasite, « 5 jours depuis Lyon en Corse » garde départ Lyon et destination Corse (la carte tranche, `settleLinkedOrigin`). **En production** (PR #87, `3b96d58`, alias `kitduvoyageur-1783951966810-ruddy.vercel.app`), relu en base le 10 oct. : « 5 jours en Sardaigne depuis Lyon » → départ Lyon, « vol aller-retour depuis Lyon, LYS → CAG (…), environ 790 km » ; « rando 3 jours depuis Bourg en Bresse » → départ « Bourg-en-Bresse », sans destination parasite ; 0 erreur serveur (`app_errors`).
Lot P (plan `docs/superpowers/plans/2026-10-10-compas-lot-p.md`, PLAN-100 4.1 et 4.3) : profil voyageur privé (`user_traveller` : RLS de la personne seule, aucun droit pour anon, essai sans compte refusé) demandé une fois dans le Compas vide (« Passer » toujours visible) et modifiable dans `/compte/voyageur` ; trajet depuis le domicile du profil après le départ dit et avant la position, sans jamais ranger le nom du domicile sur le voyage ; sans nationalité connue, plus aucune règle « voyageur français » (papiers renvoyés au service officiel du pays, ni France Diplomatie, ni formalités chiffrées, consignes de l'IA neutres) ; verrou de vie privée au build ; tests verts. **Migration `20261010100000_user_traveller.sql` à passer par Tony dans l'éditeur SQL** (le 10 oct., `apply_migration` et tout DDL par le connecteur expirent à 60 s alors que les lectures répondent ; table absente en production, le Compas la traite alors comme « tout inconnu » et la page `/compte/voyageur` dit que le profil ne peut pas être lu), puis sonde `scripts/verify/user_traveller_rls_probe.sql` (attendu : « 16 contrôles passés ») et preuve sur l'aperçu.

Lot Q : accessibilité 5.2 (PLAN-100, WCAG 2.2 AA), dans la PR groupée des lots Q à V : focus piégé dans les tiroirs et rendu au déclencheur, `KitRow` sans bouton dans un bouton, qualité des conditions dite en texte et en forme, pastilles d'alerte des étapes annoncées, texte en rem et lignes qui s'agrandissent, « Annuler » 15 s réglable (8 / 15 / 30 s) et erreurs en `role="alert"`, info-bulles doublées en texte, styles `forced-colors`, axe-core sur l'écran et les 26 parcours de tiroir (zéro violation, jsdom). **Reste ouvert** : test réel VoiceOver et TalkBack (appareils réels), contraste de couleur mesuré dans le navigateur (`npm run test:a11y`), et, côté lecteurs d'écran, l'`Icon` du Compas est désormais décorative (`aria-hidden`, sans titre ni clic) : le nom d'un bouton vient de son texte, plus du glyphe.

Lot R : fiabilité 2.2 / 2.6 faits : verdict compté par personne ; clé par adresse = saut ajouté par notre proxy (une seule lecture, test de garde) ; prise de phase rendue sur les sorties anticipées et par « Annuler » ; « Arrêter » relu pendant l'application des réglages. Aucune migration. Limites : sur Vercel la clé par adresse ne se vérifie qu'en production, IPv6 non regroupées par /64.

Lot T : table passeport × destination (travelrequirements.info v1.3.0, CC BY 4.0, 39 601 lignes, 174 Ko, serveur seulement) branchée dans « Papiers » (ligne datée, repli sur les règles) ; « Formalités » chiffrées seulement si visa requis ; ESTA, Vietnam, Rwanda recalés (montant ESTA à reconfirmer sur cbp.gov) ; crédit dans les mentions légales. Reste : prises/change hors France, frais par nationalité, preuve en production.

Lot V : mobile 5.4 / états 5.1 : barre d'état du Compas lisible (thème par route, texte sombre), texte de position iOS honnête et permissions Android minimales verrouillées par test, zones sûres prouvées (chromium 393 × 852 + capture, pas d'iPhone réel), squelette et erreur propres au Compas. Reste : appareil réel (barre, dialogue de permission, VoiceOver, TalkBack) ; `Info.plist` sans `NSCameraUsageDescription` ni `NSPhotoLibraryUsageDescription` : latent (`src/lib/native/camera.ts` n'a aucun appelant aujourd'hui), mais iOS plantera à la première ouverture de la caméra le jour où un écran l'utilise ; à ajouter avec ce premier appelant.

Lot S : kit 4.8 terminé : règles sur les normales NASA POWER (froid, pluie, mousson, chaleur), tropiques (moustiques, eau filtre/pastilles, soleil), altitudes de secours lues sur le relief comme un plancher, sans table de pays ; un conseil de sécurité n'est jamais muet, formulation prudente si l'altitude n'est pas établie.

Lot U : alertes officielles Meteoalarm pour 33 pays d'Europe (service national, heure d'émission, période, texte officiel, lien et avertissement avec chaque alerte), conditions relues le 11 oct. ; attributions Terrain Tiles, GeoNames, Meteoalarm, BCE et « Powered by Geoapify » à l'écran. 4.9 reste partielle : 6 pays à flux vide, zones reconnues par le nom exact, hors Europe non branché. **À faire par Tony** : s'enregistrer comme redistributeur Meteoalarm (meteoalarm@geosphere.at) et demander si le trafic pose problème.

Lot W : budget 4.6 : budget affiché aussi dans la devise du voyageur et du pays (taux, date, source dits ; rien stocké ; ISO 4217 SIX, licence à confirmer) ; carburant UE-27 daté (bulletin UE CC BY 4.0) + estimation à fourchette hors UE ; libellé « indice de prix du pays ». Reste : péages, assurance et repas par région.

Lot X : trajets 4.4 : train par règles (Europe 32 pays, JP, KR, CN, IN, corridors Amtrak/VIA, barème par pays daté 2026-10, tout « estimation ») ; « sans voiture » (phrase, réglage, trajet, bus entre étapes, budget, « transports en commun » seulement si gare lue sinon « non évalué »). Non prouvé en préview/prod.

Lot Y : itinéraire 4.5 : antiméridien (Fidji), espaces sauvages (campings, bivouac calculé entre deux lieux réels, annoncé), paliers d'altitude de couchage à pied (UIAA, prudents), « Mòguru/Mogoro » et « Canal de Beagle » corrigés. Restent ouverts (données ou réseau) : Sardaigne, Kalymnos, lac, TMB, alpinisme sur base, échelle d'un pays sans l'IA.

Relecture indépendante de la PR #90 (Opus, Codex hors quota) : corrigés avant fusion : alertes émises à la même seconde (niveau le plus sévère), outre-mer lu dans le flux France (faux « aucune alerte »), Veille honnête sur le statut et nommant le service, contour illisible = zone non testée ; kit : moustiques d'un tracé qui descend, plafond de conseils de sécurité, altitude « trace » réservée aux vrais tracés ; « Annuler » refuse une préparation vivante ; clé IPv6 = /64 ; **la ligne « Papiers » par nationalité n'est plus rangée sur le voyage** (vie privée). Limites connues : plafond global de l'essai décompté avant le captcha ; dépense « Formalités », ligne « Prises » et conseils de change laissent encore deviner résidence ou nationalité aux collaborateurs ; voyages déjà préparés gardent l'ancienne ligne en base jusqu'à une relance.

Relecture finale (Opus) de la PR #90, corrigée avant fusion : bivouac calculé jamais en dernière étape ni sans pouvoir atteindre le lieu réel, jamais pour une préférence « refuge » (3 nuits de bivouac d'affilée au plus : écart assumé avec la borne « 3 journées de marche »), règle d'acclimatation qui ne compte que les nuits de montée, « sans voiture » qui ne déborde plus sur « auto-stop » ni sur une voiture prise, pas de train vers les îles grecques, dalmates, estoniennes, l'Irlande du Nord, Ceuta et Melilla, le pays du domicile n'est plus nommé dans les bases rangées, une prise ou un `restAt` daté du futur ne bloque plus « Annuler », `readMeteoalarm` transmet son horloge (les tests dépendaient de l'heure). Limites restantes : la planification d'acclimatation compte encore toute nuit > 2 500 m comme montée (une nuit de repos de trop, jamais un faux avertissement) ; conseils IA et ligne « Prises » rangés selon le profil du lanceur ; le prompt de l'IA reçoit « nationalité française » (lot P) ; voyages déjà préparés : rattrapage SQL de données à écrire.

Lot R2 (PR #92, mené par sous-agents en worktrees ; rendu des écrans non mesuré faute de navigateur : à contrôler sur l'aperçu) : itinéraire à l'échelle d'un pays sans les noms de l'IA quand elle est éteinte ou muette (bases multiples choisies dans le référentiel, `engine/countryBases.ts`) et grandes îles à pied ou à vélo sur un massif de 48 km au plus (`engine/islands.ts`) ; vignettes CH, AT, CZ, SK, SI, HU et barèmes au km FR, IT sourcés et datés du 12 oct. 2026 (`engine/tolls.ts`, crédits dans les mentions légales) ; repas en autonomie au niveau de prix de l'alimentation de l'ICP 2021 (Banque mondiale, CC BY 4.0) ; écarts de maquette : heure de passage estimée par étape, trois barres de risque sourcées et datées (sans score), îlot « prochaine décision » (« Appliquer » seulement pour la répartition du matériel commun). À valider en P2 : budget « Repas », lignes « Vignette », routage entre bases sur Geoapify/Valhalla réels ; SI à relire sur dars.si ; péages ES, PT, HR, GR non chiffrés. Preuve en production de la PR #91 (12 oct.) : politique de confidentialité servie avec la phrase sur l'IA ; la route du cron n'est pas testable depuis le poste (protection Vercel du déploiement, `koosmoweb.fr` injoignable) : son refus sans secret est prouvé par les tests, elle devient active quand Tony crée `CRON_SECRET`.

Lot Z1 : vie privée restante du profil voyageur : « Prises », conseils de l'IA (règles et consigne sans profil, nationalité jamais envoyée) et dépense « Formalités » ne dépendent plus du lanceur : seules des lignes neutres sont rangées, chaque lecteur reçoit la sienne à la lecture ; verrou étendu (mutation) ; **SQL de rattrapage des voyages déjà préparés écrit (`supabase/maintenance/lot_z1_vie_privee_rattrapage.sql`), non appliqué : à passer par Tony.** Après relecture de la PR #91 : seules les formalités prévues et intactes sont supprimées (les autres sont neutralisées), l'enveloppe est vidée si besoin, rien du domicile (km, minutes, « à l'étranger ») ne part plus à l'IA ni ne reste dans les textes rangés, et `abroad` n'est plus révélé aux collaborateurs.

Lot Z2 : légal 5.3 : mention IA (démarrage, étapes `aiProposed`, conseils, verdict ; muette si `AI_MODE=off`), divulgation d'affiliation avant les offres d'hébergement, politique de confidentialité relue au code (rien du profil n'est envoyé à l'IA). Identité de l'éditeur : à Tony.

Lot Z3 : infra à 0 € : 1 cron Vercel quotidien (`/api/cron/daily`, 03:00 UTC) enchaîne 13 des 16 routes cron (rotation quotidienne hors vie privée, rien de concurrent après un délai dépassé ; `finalize-kit-attributions` à la main) ; suivi de préparation à intervalle croissant (plus de rafraîchissement fixe toutes les 4 s) ; `maxDuration` ≤ 300 gardé par test. **ACTIF seulement quand Tony crée `CRON_SECRET` dans Vercel (absent le 12 oct. : la route répond 401).** Migration `20261012100000_adventure_events_claim_lease.sql` (bail de 15 min sur la file d'événements RGPD, `consent.revoked` d'abord) à passer par Tony dans l'éditeur SQL.

Lot Z4 : hygiène : CSS sombre du Compas retiré, 3 fichiers formatés, tests d'autorisation réels de `requireEditor` (34 tests ; la RLS est portée à la main, pgTAP reste à faire). Mesure eslint : 45 erreurs, 8 699 avertissements : `ignoreDuringBuilds` inchangé.

PR #92 (lot R2) **fusionnée le 13 oct.** (`2cf3aa31`) après quatre relectures Codex traitées (îles validées contre leur contour, tarif de vignette hors période refusé, heures de passage notées gardées, fuseau par jour, répartition du matériel en une demande tout ou rien) ; deux constats P2 restants (candidats de l'IA hors contour, anciennes ancres sans `osmTag`) traités dans la PR #93.

Vague 1 (PR #93, branche `claude/pr88-parallel-batches-lzhet2`, menée par sous-agents en worktrees, contrôlée et intégrée lot par lot) :
- Lot AA : Nominatim public retiré du trafic (un seul client `nominatimJson`, LocationIQ avec la clé) ; Overpass private.coffee seul, une requête à la fois dans tout le site ; base d'un séjour sans lieu dit = la commune (`positionBase`).
- Lot AB : pgTAP du Compas (154 assertions) ; `database-gates` autonome sur PostgreSQL 17 jetable, **vert sur GitHub le 13 oct.** ; E2E Compas hermétique (`e2e-compas` : Où → Préparer → résultat, vraie RLS, tiers rejoués). Les deux ne sont pas encore requis pour fusionner.
- Lot AC : prises, tension et fréquence de 228 pays (Wikipédia, CC BY-SA) ; « Courant » et « Change » à la lecture selon la résidence du lecteur ; péages ES (SEITT, BOE) ; « par personne » multiplié par le groupe ; « quelques jours » = au moins 2, à préciser.
- Lot AD : membres en lecture, Emprunter · Louer · Acheter, fiche et historique d'un objet, carte (pastilles, encart, fonds ArcGIS), mise en page dès 768 px (captures dans `preuves/`).
- Lot AE : garder son essai en liant un e-mail (interrupteur `NEXT_PUBLIC_KEEP_TRIAL`, éteint) ; plafond IA du site par jour et compteurs illisibles = IA coupée en production ; rapports CSP collectés (`/api/csp-report`, migration appliquée en production le 13 oct.).
- Lot AF : mot de passe oublié réparé (le lien menait à une page qui n'échangeait pas le code) ; onglet « Qui » en lecture, renvoi `/hub/groupe`.
- Lot AG : import des refuges, cabanes, campings et points d'eau prêt (`geo_pois`, Overpass par tuiles, mesure : ≤ 24 Mo pour Alpes et France), **rien en base** tant que `places_geo` n'est pas retiré.
- Base (13 oct.) : 431 Mo ; bail des événements RGPD et collecte CSP appliqués ; `search_path` de `legacy_loyalty_level_for` verrouillé ; conseiller Supabase relu (rien de nouveau). **En attente de Tony** : purges planifiées (`20261008190000`, corrigée) et retrait de `places_geo` (−232 Mo) dans le SQL Editor, le connecteur demandant une confirmation qu'il n'affiche pas.
- **Régression de production corrigée (13 oct., 10 h 21 UTC)** : la migration `20261013180000_anon_grant_hygiene` (chantier communauté) retirait à `anon` `can_read_trip`, `can_edit_trip` et `is_group_member`, appelés par les policies `TO public` des voyages et des groupes ; PostgreSQL refusait alors toute lecture d'un visiteur sans compte (voyage public, groupe public). Constaté en base (`set role anon`) et par les tests pgTAP du Compas après fusion de `main`. Droits rétablis (`20261014080000_anon_rls_predicates_regrant`, appliquée, version du registre alignée) ; relu en base : 1 voyage public, 42 étapes, 22 groupes lisibles, 0 voyage privé. Nouvel invariant pgTAP : aucune policy ouverte à `anon` n'appelle une fonction qu'`anon` ne peut pas exécuter.
- Fusion de `main` (13 oct.) : les correctifs passés en direct sont maintenant des fichiers `*_hotfix.sql` aux versions du registre de production ; doublons retirés (`legacy_loyalty_search_path`, `csp_reports`), `geo_pois` renuméroté `20261014090000` (la version `20261013190000` est prise en production), puis `20261014090500` (`c87b980f`, le 13 oct. : `20261014090000` servait deux fichiers). **18 oct.** : le doublon `legacy_loyalty_search_path` est en fait toujours dans le dépôt (`20261013040000`), voir `MIGRATIONS-ALIGNEMENT.md`. `database-gates` rejoue chaque `*_hotfix.sql` en une transaction et l'annule s'il ne fait que recréer un objet existant (4 cas), toute autre erreur arrête.

Lot Z5 (20 oct., phases 1 et 2 en code à 0 €, branche `worktree-agent-a1ddcae310451f58b`) : alerte gratuite sur le rapport quotidien (`ops-alerts.yml`), conservation des petites tables (`20261020100000_retention_small_tables.sql`, `ai_response_cache` n'avait aucune purge), garde statique des fonctions `SECURITY DEFINER` (235 fonctions, `search_path` partout) et pgTAP d'exécution, assertion pgTAP du WITH CHECK des étapes, CSP applicable par `CSP_MODE=enforce`, sauvegarde sans `geo_places`/`geo_pois`, politique de confidentialité aux durées exactes. Constat : le registre de production (lu, rien écrit) ne contient NI les purges planifiées (`20261008190000`, `20261009100000`) NI `geo_pois` : aucune purge ne tourne aujourd'hui. pgTAP écrits mais non rejoués (aucun PostgreSQL local) : à passer en CI avant d'appliquer.

Lot AM (phase 4, moteur, worktree isolé) : train en Turquie, Géorgie, Arménie, Azerbaïdjan et Moldavie (réseau « est ») ; « aucun train de voyageurs » dit pour Chypre, Malte et l'Islande ; grands itinéraires (« GR20 », « TMB ») suivis sur leur tracé OpenStreetMap (`engine/trailRoute.ts`, `lookupTrailLine`, `trailTrek` : une longueur de tracé par jour, un lieu réel par soir à moins de 3 km, sinon point calculé sur le tracé dit). Tests : `railWorld.test.ts`, `trailRoute.test.ts`, `trailAutofill.test.ts`. **Non prouvé** : la réponse Overpass réelle (bac à sable sans réseau, fixtures conformes à la doc) ; à contrôler sur l'aperçu avec « GR20 en 8 jours ». **Non fait, faute de source libre ou parce que l'interface est en jeu** : assurance par région, péages PT/HR/GR, alertes NWS/ECCC/JMA, dates numériques selon la langue (`intent.ts`), Kalymnos, Lago de los Tres.

**À faire par Tony** (rien d'autre ne bloque) :
0. (Lot Z5) SQL Editor, dans l'ordre après revue : `20261008190000`, `20261009100000`, `20261020100000` ; secret GitHub `SUPABASE_DB_URL` (alerte du matin + sauvegarde) ; `CRON_SECRET` dans Vercel ; écrire à support@private.coffee ; `CSP_MODE=enforce` après lecture de `csp_report_summary(7)` ; rendre `database-gates` et `e2e-compas` requis sur `main`.
1. SQL Editor : `supabase/migrations/20261008190000_base_scheduled_purges.sql` (purges
   planifiées), puis `20261009100000_app_errors_purge.sql`, puis
   `drop table public.places_geo;` (−232 Mo, plus aucun lecteur). **Urgent** : la base
   est à 429,3 Mio le 9 oct., l'alerte du rapport se lève à 430. *(18 oct. : `places_geo`
   retiré par Tony, base à 229 Mo ; l'état des purges planifiées n'est pas relu ici.)*
2. GitHub → Settings → Secrets → Actions : `SUPABASE_DB_URL` (Session pooler) et
   `BACKUP_PASSPHRASE` (sauvegarde chiffrée de la nuit, `SAUVEGARDES.md`).
3. Identité légale réelle pour les mentions légales ; retirer `DEMO_LOGIN_*` de Vercel.
4. Valhalla FOSSGIS : un mot sur GitHub Discussions (identification demandée).
5. Au lancement : protection hCaptcha dans Supabase + `NEXT_PUBLIC_AUTH_CAPTCHA=on` ;
   Authentication → « Leaked password protection » activée.
6. Décision : la vue `public_profiles` montre sans connexion le nom, la ville, la bio et
   les points de chaque compte. Proposition : la réserver aux comptes connectés et n'y
   laisser que le pseudonyme et l'avatar (`PLAN-100.md`, 2.4).

## P0 — Moteur fiable

| # | Sujet | État | Preuve / reste |
|---|---|---|---|
| P0.1 | Préparation en une seule passe (300 s) | **Fait** (preuve preview) | Travail en arrière-plan (`after`), l'écran relit l'issue toutes les 4 s. 8 oct. : « Arrêter » arrête aussi le serveur (retour Codex) ; une préparation n'est plus relancée parce qu'elle a elle-même retenu un lieu naturel (Ardennes), ni écrasée par un lancement en double juste après sa réussite (écran bloqué) |
| P0.2 | Compréhension de la demande et résolution du lieu | Partiel | 50/50 lues correctement hors ligne. En ligne corrigés : plein air → lieu naturel (Chartreuse massif, Loire fleuve, Calanques parc), pays entier (États-Unis Ouest), « nuits dehors » inventées par l'IA ; « GR34 » → région du sentier (GR65, GR70 ajoutés). 8 oct. : **raquettes Vercors en janvier prouvé en ligne** (dates posées, base Gresse-en-Vercors) ; les précisions choisies (durée, groupe, activité) priment sur la phrase et l'IA (retour Codex) ; sur l'eau, la rivière homonyme cherchée avec son article (« Le Tarn ») |
| P0.3 | Itinéraire déterministe | Partiel | Lieux réels (Photon → Overpass + Geoapify), hauteurs pour marche et ski, départ d'une ville dite. **Prouvés en ligne le 8 oct.** : Jura à vélo (5 lieux distincts), Beaufortain (parcours du catalogue), journée Mercantour (départ Saint-Étienne-de-Tinée « au cœur »), Dolomites (base Pecol, village d'altitude, plus Brugnàch), Cévennes (boucle Portes → Concoules → Génolhac), Malaga en un seul nom, **descentes de rivière en canoë** : Dordogne (54 km en 3 jours, Sainte-Mondane → Domme → Allas-les-Mines), Tarn (46 km, Brousse-le-Château → Trébas → Ambialet, après avoir cherché « Le Tarn » sous son article), Ardèche (34 km en 2 jours, Balazuc → Sampzon), un soir au bord de l'eau ; un repli dit sa cause. Irlande : plus de « West Clare Municipal District » (reprouvé à 7 h 04 : Shannon). Reste : Kalymnos (base Vathýs, sans données de falaises), échelle d'un pays (Patagonie : nuits au « Lago de los Tres », « Canal de Beagle »), randonnée dans une grande île (Sardaigne en voiture d'étape en étape, « Mòguru/Mogoro »), vrai tracé des grands itinéraires (TMB) |
| P0.4 | Dates et trajets | Partiel | Route plafonnée selon la durée. **Train prouvé en ligne** (Ardennes, environ 6 h ; Mercantour) ; Sardaigne en avion (plus en train). Départ au nom de la commune (plus « Chantier Hotel de Ville »). Reste : journée à plus de 3 h de trajet non signalée (Mercantour depuis Annecy : train 2 × 3 h 20 pour une journée, gare absente à Saint-Étienne-de-Tinée), choix d'aéroport |
| P0.5 | Budget et conseils | Partiel | **Papiers, change et prises par règles, prouvés en ligne** (Italie, Espagne, Grèce, Belgique : carte d'identité ; Irlande : adaptateur G ; Argentine : passeport). Niveaux de prix pour tous les pays de l'ONU. Conseils de l'IA : accents et **tutoiement par règle** (Bruges vouvoyait encore : impératifs mis au tutoiement, un conseil qui vouvoie est écarté) ; chaque journée dit son moyen (pagaie ≠ randonnée). Reste : les autres conseils restent du texte libre de l'IA |
| P0.6 | Fallbacks propres | Partiel | Geoapify actif (clé sur Vercel) ; la note d'un repli dit ce que chaque carte a répondu ; limite de fréquence affichée comme une attente. Reste : résultat complet garanti |
| P0.7 | IA production : NVIDIA NIM direct (Nemotron 3.5 Lightning) | Fait | Décision de Tony (7 oct., soir) : on reste sur NVIDIA ; le passage OpenRouter est annulé |
| — | Contexte du voyage unique (`buildTripContext`) | **Fait** | `engine/tripContext.ts`, testé |
| — | Fiabilité (prises atomiques, écritures vérifiées, annulation, arrondis) | **Fait** | Testé |
| — | Phrase de départ persistée | **Fait** | — |
| — | Écran « Où » = la demande + préparation visible | **Fait** (à valider en P2) | `CompasStart`, `CompasPrep` |

## P1 — Données

| # | Sujet | État |
|---|---|---|
| P1.1 | Référentiel géographique local : lieux habités, massifs / parcs, lieux importants, randonnées mondiales, refuges | **Lieux habités faits (8 oct., soir)** : `geo_places` (367 747 lieux GeoNames : cities500 pour 246 pays, tous les lieux habités de France, Suisse, Italie, Autriche ; 74 Mo, base à 428 Mo), lue d'abord par `lookupAreaPlaces` et les pages Pays ; Vercors : 357 lieux en 20 ms. `places_geo` n'est plus lu (retrait par Tony). Reste : massifs et parcs, refuges, escalade, rivières, grands itinéraires (`PLAN-100.md`, 3.3 à 3.7) ; noms français pour la recherche |
| P1.2 | Activités, POI, météo | Partiel (MET Norway, NASA POWER, POI Overpass) |

## P2 — Validation

| Jeu | Dernier résultat |
|---|---|
| 10 parcours de zone (7 octobre) | 9 sur lieux réels ; 2 défauts (Rome, Vosges), 3 partiels (Vercors, Jura, canoë) |
| 20 parcours réels | À rejouer après P0 |
| 50 demandes entièrement nouvelles | En ligne (7 oct.) : 47/50 prêtes au premier passage, 15 défauts corrigés à la racine pendant le test, 17 rejouées : toutes préparées (2 bloquées par la limite de fréquence, rejouées) |
| Passage du 7 oct. 19 h 17 – 20 h 30 (preview `ce534c0`, lu en base) | 38 voyages : 36 préparés, 1 en attente de la limite de fréquence, 1 sans dates (raquettes). Défauts relevés → corrigés la nuit, reprouvés le 8 (lignes ci-dessous) |
| Production, 8 oct. 12 h 05 (`972a14d`, lu en base) | Descente de la Dordogne en canoë, 3 jours : prête en 42 s, Lanzac → Sainte-Mondane → Domme → Allas-les-Mines, conseils au tutoiement. Défaut lu en base : parcours de 36,1 km pour 54,1 km d'eau (premier jour non compté) → corrigé (PR #74, en production) |
| Passages du 7 oct. 21 h et du 8 oct. 5 h 39 – 7 h 06 (preview PR #72, lus en base) | 31 voyages, dont 26 au premier passage : 25 préparés ; Ardennes (21 h 11) défait aussitôt puis bloqué par la limite de fréquence, et un écran resté en attente sur un lancement en double (données écrites) → **deux causes corrigées**. **Prouvés** : papiers, train, Jura, Beaufortain, Mercantour, Dolomites, Vercors en janvier, Cévennes, Malaga, Dordogne en canoë, tutoiement (Bruges reprouvé à 6 h 27). Tarn et Ardèche en canoë reprouvés à 6 h 47, « West Clare » à 7 h 04 (Shannon). Ouverts : Kalymnos, Patagonie, Sardaigne, journée lointaine |

## P3 — Après stabilisation (gelé)

Réservations réelles (Travelpayouts, RouteStack, Viator), équipe / social, bouteille à la mer,
hors ligne, affiliation, animations, polish de maquette et desktop. Accessibilité : close pour
l'instant.

## Lancement mondial (audit du 8 octobre)

`AUDIT-LANCEMENT-MONDIAL-2026-10-08.md` : **≈ 35 % prêt pour le monde, ≈ 50 % pour un
lancement francophone** (≈ 65 % après passage aux offres payantes). 97 % des
préparations réussies en production (151/156), mais aucun vrai utilisateur encore.
Corrigé pendant l'audit : quota IA jamais appliqué (appliqué et prouvé en production),
lien d'invitation lisible par un simple lecteur (appliqué en base), noms non latins
partageant une clé de cache, mention OpenStreetMap sans position. Bloquants restants :
services gratuits interdits en commercial, Supabase gratuit, écriture publique du cache
d'itinéraires, limite de fréquence non distribuée, connexion démo ouverte, voyageur
supposé français (papiers, départ, fuseau, langue). Décisions attendues de Tony : cible,
budget, offre Vercel, IA, démo.

## Blocages (8 octobre)

- Réseau ouvert : la preview, Photon et Supabase répondent depuis le conteneur ; Overpass reste instable depuis ici (miroirs en 500/504).
- Vercel : connecteur reconnecté par Tony le 8 oct. (déploiements, journaux et variables lisibles).
- Réservations (P3, gelé) : **RouteStack en direct sur le site de production** (8 oct., 12 h 03, mode `live`) : hôtels à Annecy (Logis Hôtel Annecy Nord, Hotel du Midi…), Lisbonne (Sheraton…) et Paris ; vols Genève → Lisbonne (3 offres dès 128,93 USD, 12 s). **Villes en français en production** (PR #74, `8d5aac4`, reprouvées sur le site le 8 oct. à 12 h 49) : vol Paris → Lisbonne (PAR → LIS, dès 47,07 USD), Genève → Londres (GVA → LON : Gatwick, Luton), Nice → Lyon (NCE → LYS), voiture à Lisbonne (3 offres). Aéroport de la ville d'après la réponse de RouteStack (« All Airports » d'abord, jamais une gare), nom anglais d'OpenStreetMap en secours. Un vol peut prendre jusqu'à 29 s.
- Supabase : le connecteur de la session refuse toute suppression (DROP) ; ces opérations passent par le SQL Editor (Tony).

## Décisions en vigueur

- **Budget 0 € (Tony, 8 octobre, après-midi)** : carte blanche complète, Claude est le
  patron du chantier ; seule règle : **aucune dépense**. Plan et tâches :
  **`PLAN-100.md`** (phases, sous-phases, preuves attendues).
- **Mandat (Tony, 8 octobre)** : carte blanche. Claude mène le chantier seul : migrations, corrections de tests, fusion des PR quand la CI est verte, déploiements Vercel (connecteur reconnecté sur l'équipe `tonyfaracip-3325s-projects`). Chaque étape reste prouvée en ligne et contrôlée en base, et dite dans ce fichier.

- IA production : **NVIDIA NIM direct** (décision de Tony du 7 octobre au soir, remplace le passage à OpenRouter).
- Cartes et routage : comptes gratuits de Tony (Geoapify, LocationIQ, ArcGIS, hCaptcha ; clés dans Vercel). Routage : Geoapify puis Valhalla FOSSGIS ; plus aucun serveur de démonstration (OSRM, BRouter retirés, lot D).
- Référentiel géographique : **offre gratuite Supabase** (décision de Tony du 8 octobre), référentiel compact `geo_places` (~300 Mo au final, `places_geo` retiré), feu vert donné par le mandat. Ordre : index inutiles retirés, puis `geo_places` et import des lieux habités, voir `REFERENTIEL-GEO.md`.
- Réservations : recherche branchée et verrouillée en lecture seule ; phase 8 (20 oct.) : tuiles de la zone hors ligne, installation PWA, garde d'animations, sel d'affiliation par environnement. Reste 🔒/⚖️ : essais sur appareil, Travelpayouts, stores, relecture juridique, bouteille à la mer (voir PLAN-100 phase 8).

Détail : `AUDIT-2026-10-07.md` (architecture), `AUDIT-DONNEES-2026-10-07.md` (sources), `REFERENTIEL-GEO.md` (plan chiffré P1.1).

Lot AG (20 oct., phases 5 et 9, branche `claude/compas-phase5-9`) : verrou de contraste WCAG sur les jetons du thème clair (`contrastTokens.test.ts`) ; avertissements `jsx-a11y` soldés (boutons natifs, avatars décoratifs) ; protocole VoiceOver / TalkBack écrit (`ACCESSIBILITE.md`, 🔒 appareil réel) ; ESLint relevé par règle (0 erreur, 2 742 avertissements), fichiers Prettier listés (2 393, reformatage de masse volontairement non fait), actions GitHub relues (toutes en Node 24 sur la branche), `REFERENTIEL-GEO.md` et `PLAN-100.md` à jour. Reste : identité de l'éditeur (⚖️ Tony), registre des migrations (🔒 Tony), références visuelles à refaire (🔒 Tony), VoiceOver et TalkBack (🔒 appareil), contraste au pixel sur le verre (navigateur).
