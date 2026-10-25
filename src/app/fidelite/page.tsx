import { permanentRedirect } from 'next/navigation';

/**
 * /fidelite → /recompenses (chantier Récompenses, 25 oct. 2026).
 *
 * L'ancienne page annonçait des paliers (5 à 20 % de réduction, livraison
 * gratuite) et des gains (avis, parrainage, photo, anniversaire) sans
 * producteur ni financement, et échangeait sans contrôle de stock. Les points
 * fidélité acquis sont intacts : ils s'affichent et se dépensent dans
 * Récompenses, avec objectif, catalogue financé et historique.
 */
export default function FidelitePage() {
  permanentRedirect('/recompenses');
}
