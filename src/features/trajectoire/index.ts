/**
 * La Trajectoire Vivante - configurateur ultime LKDV.
 *
 * Fusion validee le 30/09/2026 (dossier CHANTIER_TRAJECTOIRE_VIVANTE) :
 * - V1 Plan vivant   -> orchestrateur, plans versions (trajectoire_plans)
 * - V2 Curseur       -> interface unique d'echelle 1 h -> 30 j (ScaleRuler)
 * - V4 Marche traces -> carburant social, l'IA n'invente jamais (provenance)
 * - V5 Autopilot     -> veille continue meteo / prix / creneaux (trajectoire_veille)
 *
 * Convention design : DESIGN_SYSTEM.md. Le curseur est la SEULE primitive
 * neuve autorisee (ScaleRuler), promu en src/design/ apres validation.
 */

export * from './domain';
