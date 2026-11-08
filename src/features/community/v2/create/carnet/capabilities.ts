/**
 * Capacités de la base pour la création de carnet.
 *
 * `public.carnet_nights` appartient au chantier carnet-v2 et **n'existe pas en
 * prod au 2026-11-08** (registre de migrations en retard, cf. `BRIEF-TEAM` § 3).
 * L'UI affiche l'étape « Nuits » uniquement si la table existe ; le RPC
 * `create_carnet_v2` ignore les nuits quand elle n'existe pas
 * (`to_regclass('public.carnet_nights') is null`).
 *
 * Quand la migration carnet-v2 sera appliquée en prod (et vérifiée en lecture),
 * passer ce drapeau à `true` — un seul endroit à changer.
 */
export const HAS_CARNET_NIGHTS = false;
