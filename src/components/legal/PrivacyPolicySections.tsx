import React from 'react';
import Link from 'next/link';

/**
 * Politique de confidentialité : une seule version (plan 2.10), rendue par la
 * vue mobile et la vue ordinateur de `/politique-confidentialite`. Avant, les
 * deux vues disaient des choses différentes (prestataires, transferts).
 *
 * Chaque prestataire nommé ici est appelé par le code ; chaque durée est celle
 * d'une purge ou d'une expiration réelle. Changer un service ou une durée,
 * c'est changer ce fichier.
 */

export const PRIVACY_UPDATED_AT = '9 octobre 2026';

export interface PrivacySection {
  title: string;
  body: React.ReactNode;
}

interface Processor {
  name: string;
  role: string;
  where: string;
}

/** Prestataires et services qui reçoivent des données, et lesquelles. */
const PROCESSORS: Processor[] = [
  { name: 'Supabase', role: 'base de données et comptes', where: 'Union européenne (Paris)' },
  { name: 'Vercel', role: 'hébergement du site (fonctions à Paris)', where: 'États-Unis (société)' },
  {
    name: 'NVIDIA, et OpenRouter en secours',
    role: 'IA : le texte de votre demande et les faits du voyage (lieux, dates, groupe), jamais votre nom ni votre e-mail',
    where: 'États-Unis',
  },
  { name: 'Google (Gemini)', role: 'IA : la photo de matériel que vous envoyez à l’analyse, si vous utilisez cette fonction', where: 'États-Unis' },
  {
    name: 'Photon (komoot), LocationIQ, Geoapify, Valhalla (FOSSGIS), Overpass (private.coffee)',
    role: 'recherche de lieux, itinéraires et points d’intérêt : les noms de lieux cherchés et des coordonnées (votre position, arrondie à environ 1 km)',
    where: 'Allemagne, Autriche, États-Unis selon le service',
  },
  { name: 'Esri (ArcGIS)', role: 'fonds de carte : la zone affichée et votre adresse IP', where: 'États-Unis' },
  {
    name: 'MET Norway, NASA POWER, Terrain Tiles (Amazon Web Services)',
    role: 'météo, tendances et relief : les coordonnées des lieux du voyage',
    where: 'Norvège, États-Unis',
  },
  {
    name: 'RouteStack, Viator (Tripadvisor)',
    role: 'recherche d’offres de réservation : destination, dates et nombre de voyageurs, quand vous lancez une recherche',
    where: 'selon le partenaire',
  },
  { name: 'hCaptcha', role: 'protection contre les robots à l’inscription et à l’essai, lorsqu’elle est activée', where: 'États-Unis' },
  { name: 'Google Analytics', role: 'mesure d’audience, seulement avec votre consentement', where: 'États-Unis' },
];

/** Les sections de la politique, avec les classes de lien de la vue qui les rend. */
export function privacySections(linkClass: string): PrivacySection[] {
  return [
    {
      title: '1. Responsable du traitement',
      body: (
        <p>
          Le Kit du Voyageur (SAS). Contact :{' '}
          <a href="mailto:privacy@lekitduvoyageur.fr" className={linkClass}>
            privacy@lekitduvoyageur.fr
          </a>
          . Délégué à la protection des données :{' '}
          <a href="mailto:dpo@lekitduvoyageur.fr" className={linkClass}>
            dpo@lekitduvoyageur.fr
          </a>
          .
        </p>
      ),
    },
    {
      title: '2. Données traitées',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte : adresse e-mail, nom ou pseudonyme, préférences de voyage. Le mot de passe est géré par Supabase et ne nous est jamais lisible.</li>
          <li>Essai sans compte : un identifiant technique de session, sans e-mail.</li>
          <li>Voyages : destination, dates, étapes, groupe, budget, matériel et notes, saisis par vous ou préparés par le Compas.</li>
          <li>
            Position de l’appareil : seulement si vous l’autorisez, pour le trajet d’approche ; arrondie à environ 1 km
            avant tout envoi à un service tiers.
          </li>
          <li>
            Données techniques : adresse IP et journaux de l’hébergeur. Les compteurs qui limitent les abus ne gardent
            qu’une empreinte (HMAC), jamais l’adresse ni l’identifiant en clair.
          </li>
          <li>Aucune donnée bancaire (aucun paiement n’est activé) ; aucune donnée sensible au sens de l’article 9 du RGPD.</li>
        </ul>
      ),
    },
    {
      title: '3. Finalités et bases légales',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Préparer et garder vos voyages, gérer votre compte : exécution du service que vous demandez.</li>
          <li>Sécurité (limite de fréquence, protection contre les robots) : intérêt légitime.</li>
          <li>Mesure d’audience et communications commerciales : votre consentement, retirable à tout moment.</li>
          <li>Obligations légales (comptabilité, réquisitions).</li>
        </ul>
      ),
    },
    {
      title: '4. Destinataires',
      body: (
        <>
          <ul className="list-disc space-y-1 pl-5">
            {PROCESSORS.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong> — {p.role} ({p.where}).
              </li>
            ))}
          </ul>
          <p className="mt-2">Aucune donnée n’est vendue. Aucun prestataire de paiement n’est activé aujourd’hui.</p>
        </>
      ),
    },
    {
      title: '5. Transferts hors de l’Union européenne',
      body: (
        <p>
          Les prestataires établis aux États-Unis reçoivent des données dans les limites décrites ci-dessus. Ces
          transferts reposent sur les garanties de chaque prestataire : Data Privacy Framework UE–États-Unis ou clauses
          contractuelles types de la Commission européenne.
        </p>
      ),
    },
    {
      title: '6. Durées de conservation',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte et ses voyages : tant que le compte existe, puis 3 ans après sa dernière utilisation.</li>
          <li>Essai sans compte : effacé avec ses voyages après 7 jours sans utilisation.</li>
          <li>
            Caches de lieux, d’itinéraires et de réponses de l’IA, sans nom ni e-mail : ils expirent au bout d’une heure à
            30 jours (un an pour les récits de sentiers, communs à tous).
          </li>
          <li>Statistiques de fonctionnement (préparations réussies ou non, sans donnée personnelle) : 90 jours.</li>
          <li>Commandes : 10 ans (obligation comptable), le jour où le paiement sera activé.</li>
          <li>Cookies de mesure d’audience : 13 mois au plus ; choix sur les cookies : 6 mois.</li>
        </ul>
      ),
    },
    {
      title: '7. Vos droits',
      body: (
        <p>
          Accès, rectification, effacement, portabilité, opposition, limitation, retrait du consentement. Contact :{' '}
          <a href="mailto:privacy@lekitduvoyageur.fr" className={linkClass}>
            privacy@lekitduvoyageur.fr
          </a>
          . Réclamation auprès de la{' '}
          <a href="https://www.cnil.fr" className={linkClass} target="_blank" rel="noopener noreferrer">
            CNIL
          </a>
          .
        </p>
      ),
    },
    {
      title: '8. Sécurité',
      body: (
        <p>
          Les données privées ne sont lisibles qu’après authentification, et chaque table est protégée par des règles
          d’accès par personne (Supabase). Ne partagez pas vos identifiants.
        </p>
      ),
    },
    {
      title: '9. Cookies',
      body: (
        <p>
          Voir la{' '}
          <Link href="/cookies" className={linkClass}>
            politique de gestion des cookies
          </Link>
          .
        </p>
      ),
    },
  ];
}
