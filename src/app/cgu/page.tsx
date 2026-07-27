import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';

export const metadata = {
  title: 'Conditions Générales d\'Utilisation | Le Kit du Voyageur',
  description: 'Conditions générales d\'utilisation de la plateforme Le Kit du Voyageur — marketplace, comptes utilisateurs, responsabilité plateforme.',
};

const SECTIONS = [
  { num: '1', title: 'Objet et champ d\'application', content: `Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme Le Kit du Voyageur, accessible à l'adresse lekitduvoyageur.fr, éditée par la société Le Kit du Voyageur (SAS). En accédant à la Plateforme, en créant un compte ou en utilisant l'un quelconque de ses services, l'Utilisateur reconnaît avoir lu, compris et accepté sans réserve les présentes CGU dans leur intégralité.` },
  { num: '2', title: 'Description des services', content: `La Plateforme Le Kit du Voyageur propose notamment : le Configurateur IA (génération de kits personnalisés), la Boutique e-commerce (vente de produits neufs), la Marketplace occasion (mise en relation entre particuliers), l'Inventaire personnel, les Fiches destinations, l'Espace communautaire (carnets, avis, groupes, messagerie) et le Jumeau numérique 3D.` },
  { num: '3', title: 'Création et gestion du compte utilisateur', content: `L'accès à la majorité des fonctionnalités nécessite la création d'un compte. L'Utilisateur s'engage à fournir des informations exactes, maintenir la confidentialité de ses identifiants, ne pas partager son compte avec des tiers, informer immédiatement Le Kit du Voyageur de toute utilisation non autorisée, et être âgé d'au moins 18 ans.` },
  { num: '4', title: 'Utilisation acceptable de la Plateforme', content: `Il est notamment interdit de publier des contenus illicites, usurper l'identité d'un tiers, tenter d'accéder à des zones non autorisées, utiliser des robots ou scrapers sans autorisation, diffuser des virus ou codes malveillants, effectuer des transactions fictives ou frauduleuses, ou contourner les systèmes de paiement.` },
  { num: '5', title: 'Contenu généré par les utilisateurs', content: `En publiant du contenu sur la Plateforme, l'Utilisateur garantit être titulaire des droits nécessaires et accorde à Le Kit du Voyageur une licence non exclusive pour reproduire, afficher et distribuer ce contenu dans le cadre du fonctionnement de la Plateforme. Le Kit du Voyageur se réserve le droit de supprimer tout contenu contraire aux présentes CGU.` },
  { num: '6', title: 'Marketplace — Responsabilité de la plateforme intermédiaire', content: `Le Kit du Voyageur agit en qualité d'intermédiaire de plateforme et n'est pas partie au contrat de vente conclu entre le Vendeur et l'Acheteur. Le Vendeur est seul responsable de l'exactitude des informations publiées dans son annonce et de la conformité du produit à sa description.` },
  { num: '7', title: 'Propriété intellectuelle', content: `La Plateforme, son contenu éditorial, ses algorithmes d'intelligence artificielle, son design, ses logiciels, ses bases de données et ses marques sont la propriété exclusive de Le Kit du Voyageur. Toute reproduction sans autorisation écrite préalable est strictement interdite.` },
  { num: '8', title: 'Intelligence artificielle — Limites et responsabilité', content: `Le configurateur IA génère des recommandations d'équipement à titre indicatif. Ces recommandations ne constituent pas un conseil professionnel en matière de sécurité ou de pratique sportive. L'Utilisateur reconnaît qu'il lui appartient de vérifier l'adéquation de l'équipement recommandé à ses besoins spécifiques.` },
  { num: '9', title: 'Disponibilité du service et force majeure', content: `Le Kit du Voyageur s'efforce d'assurer la disponibilité de la Plateforme 24h/24 et 7j/7, mais ne peut garantir une disponibilité sans interruption. Des maintenances planifiées ou des incidents techniques peuvent entraîner des interruptions temporaires.` },
  { num: '10', title: 'Limitation de responsabilité', content: `Dans les limites autorisées par la loi, la responsabilité de Le Kit du Voyageur ne pourra être engagée qu'en cas de faute prouvée et sera limitée aux dommages directs et prévisibles. Le Kit du Voyageur ne saurait être tenu responsable des dommages indirects, pertes de données ou pertes de profits.` },
  { num: '11', title: 'Modification des CGU', content: `Le Kit du Voyageur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par email ou notification sur la Plateforme, au moins 30 jours avant l'entrée en vigueur des nouvelles conditions.` },
  { num: '12', title: 'Résiliation', content: `L'Utilisateur peut supprimer son compte à tout moment depuis les paramètres de son profil ou en contactant contact@lekitduvoyageur.fr. La suppression du compte entraîne la suppression des données personnelles dans les délais prévus par notre politique de confidentialité.` },
  { num: '13', title: 'Droit applicable et règlement des litiges', content: `Les présentes CGU sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. Plateforme européenne de règlement en ligne des litiges : ec.europa.eu/consumers/odr` },
];

export default function CGUPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="flex items-center gap-2 text-xs font-mono mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>CGU</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: '#4A6741' }}>Conditions d&apos;utilisation</p>
          <h1 className="font-display text-4xl text-white mb-2" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Conditions Générales<br />d&apos;Utilisation
          </h1>
          <p className="text-sm text-white/50">
            En vigueur au 1er juillet 2026 — Applicables à toute utilisation de la plateforme lekitduvoyageur.fr
          </p>
        </div>
      </section>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#5C6B5E' }}>
          {SECTIONS?.map((section) => (
            <section key={section?.num}>
              <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>
                {section?.num}. {section?.title}
              </h2>
              <p>{section?.content}</p>
            </section>
          ))}

          <div className="flex flex-wrap gap-3 pt-6" style={{ borderTop: '1px solid #E8E4DA' }}>
            {[{ href: '/cgv', label: 'Conditions Générales de Vente' }, { href: '/politique-confidentialite', label: 'Politique de confidentialité' }, { href: '/mentions-legales', label: 'Mentions légales' }, { href: '/cookies', label: 'Cookies' }]?.map((link, i, arr) => (
              <React.Fragment key={link?.href}>
                <Link href={link?.href} className="text-xs hover:underline" style={{ color: '#4A6741' }}>{link?.label}</Link>
                {i < arr?.length - 1 && <span className="text-xs" style={{ color: '#C8C3B0' }}>·</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#9A9A8E' }}>Dernière mise à jour : juillet 2026 — Version 1.0</p>
        </div>
      </main>
      <NewFooterSection />
    </div>
  );
}
