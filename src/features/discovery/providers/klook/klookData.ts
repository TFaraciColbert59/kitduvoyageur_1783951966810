// src/features/discovery/providers/klook/klookData.ts
// Liens Klook officiels par pays.
//
// ⚠️ VIDES PAR DÉFAUT : aucun lien n'est inventé. Tant que ce fichier est vide
// et que `KLOOK_AFFILIATE_URL` n'est pas défini, le bloc pointe vers la racine
// officielle Klook (`https://www.klook.com/`) SANS tracking d'affiliation.
//
// Pour activer l'affiliation : coller ici des liens générés depuis le tableau
// de bord Travelpayouts (ex. `https://klook.tp.st/XXXXXXXX`), ou définir
// `KLOOK_AFFILIATE_URL` (serveur) pour un lien global. Ne jamais scraper Klook.
import type { KlookLinkConfig } from './klookTypes';

export const KLOOK_LINKS: Record<string, KlookLinkConfig> = {
  // ISO: { url: 'https://klook.tp.st/XXXXXXXX' },
  // Exemples à renseigner après génération Travelpayouts (ne pas inventer) :
  // FR: { url: 'https://klook.tp.st/XXXXXXXX', title: 'Activités à Paris' },
};
