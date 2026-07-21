import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales d\'Utilisation | Le Kit du Voyageur',
  description: 'Conditions générales d\'utilisation de la plateforme Le Kit du Voyageur — marketplace, comptes utilisateurs, responsabilité plateforme.',
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Conditions d&apos;utilisation
        </p>
        <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="text-sm text-foreground/50 mb-10">
          En vigueur au 1er juillet 2026 — Applicables à toute utilisation de la plateforme lekitduvoyageur.fr
        </p>

        <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Objet et champ d&apos;application</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (ci-après « CGU ») régissent l&apos;accès et l&apos;utilisation de la plateforme <strong>Le Kit du Voyageur</strong>, accessible à l&apos;adresse <strong>lekitduvoyageur.fr</strong> (ci-après « la Plateforme »), éditée par la société Le Kit du Voyageur (SAS).
            </p>
            <p className="mt-3">
              En accédant à la Plateforme, en créant un compte ou en utilisant l&apos;un quelconque de ses services, l&apos;Utilisateur reconnaît avoir lu, compris et accepté sans réserve les présentes CGU dans leur intégralité. Si l&apos;Utilisateur n&apos;accepte pas ces conditions, il doit s&apos;abstenir d&apos;utiliser la Plateforme.
            </p>
            <p className="mt-3">
              Les présentes CGU s&apos;appliquent à tous les utilisateurs, qu&apos;ils soient simples visiteurs, utilisateurs inscrits, vendeurs sur la marketplace ou abonnés à un service premium.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Description des services</h2>
            <p>La Plateforme Le Kit du Voyageur propose notamment les services suivants :</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li><strong>Configurateur IA</strong> : génération de kits de voyage personnalisés par intelligence artificielle, en tenant compte du profil de l&apos;utilisateur, de la destination et de l&apos;inventaire existant</li>
              <li><strong>Boutique e-commerce</strong> : vente de produits d&apos;équipement outdoor neufs par Le Kit du Voyageur</li>
              <li><strong>Marketplace occasion</strong> : mise en relation entre particuliers pour la vente et l&apos;achat d&apos;équipements d&apos;occasion (Le Kit du Voyageur agit en qualité d&apos;intermédiaire de plateforme)</li>
              <li><strong>Inventaire personnel</strong> : gestion de l&apos;équipement possédé par l&apos;utilisateur</li>
              <li><strong>Fiches destinations</strong> : informations pratiques sur les pays et itinéraires</li>
              <li><strong>Espace communautaire</strong> : carnets de voyage, avis, groupes, messagerie</li>
              <li><strong>Jumeau numérique 3D</strong> : visualisation interactive de l&apos;équipement</li>
            </ul>
            <p className="mt-3">
              Le Kit du Voyageur se réserve le droit de modifier, suspendre ou interrompre tout ou partie des services à tout moment, avec ou sans préavis.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Création et gestion du compte utilisateur</h2>
            <p>
              L&apos;accès à la majorité des fonctionnalités de la Plateforme nécessite la création d&apos;un compte utilisateur. L&apos;Utilisateur s&apos;engage à :
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Fournir des informations exactes, complètes et à jour lors de l&apos;inscription</li>
              <li>Maintenir la confidentialité de ses identifiants de connexion</li>
              <li>Ne pas partager son compte avec des tiers</li>
              <li>Informer immédiatement Le Kit du Voyageur de toute utilisation non autorisée de son compte</li>
              <li>Être âgé d&apos;au moins 18 ans ou disposer de l&apos;autorisation parentale requise</li>
            </ul>
            <p className="mt-3">
              L&apos;Utilisateur est seul responsable de toute activité effectuée depuis son compte. Le Kit du Voyageur ne saurait être tenu responsable des dommages résultant de l&apos;utilisation non autorisée du compte d&apos;un utilisateur.
            </p>
            <p className="mt-3">
              Le Kit du Voyageur se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU, de comportement frauduleux ou de mise en danger de la sécurité de la Plateforme, sans préjudice de tout recours judiciaire.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Utilisation acceptable de la Plateforme</h2>
            <p>L&apos;Utilisateur s&apos;engage à utiliser la Plateforme conformément aux lois et règlements en vigueur et aux présentes CGU. Il est notamment interdit de :</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Publier des contenus illicites, diffamatoires, injurieux, obscènes, menaçants ou portant atteinte aux droits de tiers</li>
              <li>Usurper l&apos;identité d&apos;un autre utilisateur ou d&apos;un tiers</li>
              <li>Tenter d&apos;accéder à des zones non autorisées de la Plateforme ou à des données d&apos;autres utilisateurs</li>
              <li>Utiliser des robots, scripts, scrapers ou tout autre outil automatisé sans autorisation écrite préalable</li>
              <li>Diffuser des virus, chevaux de Troie, ransomwares ou tout autre code malveillant</li>
              <li>Effectuer des transactions fictives ou frauduleuses sur la marketplace</li>
              <li>Publier des annonces pour des produits contrefaits, dangereux ou dont la vente est réglementée</li>
              <li>Contourner les systèmes de paiement de la Plateforme pour effectuer des transactions hors plateforme</li>
              <li>Collecter les données personnelles d&apos;autres utilisateurs sans leur consentement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Contenu généré par les utilisateurs</h2>
            <p>
              En publiant du contenu sur la Plateforme (avis, carnets de voyage, photos, descriptions d&apos;annonces, messages), l&apos;Utilisateur :
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Garantit être titulaire des droits nécessaires sur ce contenu ou disposer des autorisations requises</li>
              <li>Accorde à Le Kit du Voyageur une licence non exclusive, mondiale, gratuite et sous-licenciable pour reproduire, afficher, adapter et distribuer ce contenu dans le cadre du fonctionnement et de la promotion de la Plateforme</li>
              <li>Reste seul responsable du contenu publié et de ses conséquences</li>
            </ul>
            <p className="mt-3">
              Le Kit du Voyageur se réserve le droit de supprimer tout contenu contraire aux présentes CGU ou aux lois applicables, sans préavis ni indemnité.
            </p>
            <p className="mt-3">
              Conformément à la loi n° 2004-575 du 21 juin 2004 (LCEN) et au Règlement (UE) 2022/2065 sur les services numériques (DSA), Le Kit du Voyageur agit en qualité d&apos;hébergeur pour les contenus générés par les utilisateurs. Sa responsabilité ne peut être engagée à raison de ces contenus que si, ayant été informé de leur caractère illicite, elle n&apos;a pas agi promptement pour les retirer.
            </p>
            <p className="mt-3">
              Pour signaler un contenu illicite : <a href="mailto:signalement@lekitduvoyageur.fr" className="text-primary hover:underline">signalement@lekitduvoyageur.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Marketplace — Responsabilité de la plateforme intermédiaire</h2>
            <p>
              La marketplace de Le Kit du Voyageur permet à des particuliers (ci-après « Vendeurs ») de proposer à la vente des équipements d&apos;occasion à d&apos;autres utilisateurs (ci-après « Acheteurs »). Dans ce cadre :
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Le Kit du Voyageur agit en qualité d&apos;<strong>intermédiaire de plateforme</strong> au sens du Règlement (UE) 2022/2065 (DSA) et n&apos;est pas partie au contrat de vente conclu entre le Vendeur et l&apos;Acheteur</li>
              <li>Le Vendeur est seul responsable de l&apos;exactitude des informations publiées dans son annonce, de la conformité du produit à sa description et du respect de ses obligations légales (garanties, droit de rétractation pour les vendeurs professionnels)</li>
              <li>Le Kit du Voyageur facilite le paiement sécurisé via Stripe Connect et peut retenir les fonds pendant une période de protection de 48 heures après confirmation de réception par l&apos;Acheteur</li>
              <li>Le Kit du Voyageur se réserve le droit de suspendre ou supprimer toute annonce ne respectant pas les présentes CGU</li>
            </ul>
            <p className="mt-3">
              Le Kit du Voyageur ne garantit pas la qualité, la sécurité ou la légalité des produits mis en vente par des tiers sur la marketplace.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Propriété intellectuelle</h2>
            <p>
              La Plateforme, son contenu éditorial (textes, images, vidéos, infographies), ses algorithmes d&apos;intelligence artificielle, son design, ses logiciels, ses bases de données et ses marques sont la propriété exclusive de Le Kit du Voyageur ou font l&apos;objet de licences accordées à Le Kit du Voyageur.
            </p>
            <p className="mt-3">
              Ces éléments sont protégés par le Code de la propriété intellectuelle (droit d&apos;auteur, droit des marques, droit des bases de données). Toute reproduction, représentation, modification, publication ou adaptation, totale ou partielle, sans autorisation écrite préalable de Le Kit du Voyageur, est strictement interdite et constituerait une contrefaçon sanctionnée par les articles L335-2 et suivants du Code de la propriété intellectuelle.
            </p>
            <p className="mt-3">
              Les marques, logos et signes distinctifs figurant sur la Plateforme sont des marques déposées de Le Kit du Voyageur. Toute utilisation sans autorisation est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Intelligence artificielle — Limites et responsabilité</h2>
            <p>
              Le configurateur IA de Le Kit du Voyageur génère des recommandations d&apos;équipement à titre indicatif. Ces recommandations sont basées sur les informations fournies par l&apos;Utilisateur et ne constituent pas un conseil professionnel en matière de sécurité ou de pratique sportive.
            </p>
            <p className="mt-3">
              L&apos;Utilisateur reconnaît que :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Les recommandations IA peuvent contenir des erreurs ou omissions</li>
              <li>Il lui appartient de vérifier l&apos;adéquation de l&apos;équipement recommandé à ses besoins spécifiques et aux conditions de son voyage</li>
              <li>Le Kit du Voyageur ne saurait être tenu responsable des dommages résultant d&apos;une utilisation inadaptée de l&apos;équipement recommandé</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Disponibilité du service et force majeure</h2>
            <p>
              Le Kit du Voyageur s&apos;efforce d&apos;assurer la disponibilité de la Plateforme 24h/24 et 7j/7, mais ne peut garantir une disponibilité sans interruption. Des maintenances planifiées ou des incidents techniques peuvent entraîner des interruptions temporaires.
            </p>
            <p className="mt-3">
              Le Kit du Voyageur ne saurait être tenu responsable des interruptions de service résultant d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code civil (catastrophe naturelle, cyberattaque, défaillance d&apos;un prestataire d&apos;hébergement, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">10. Limitation de responsabilité</h2>
            <p>
              Dans les limites autorisées par la loi, la responsabilité de Le Kit du Voyageur ne pourra être engagée qu&apos;en cas de faute prouvée et sera limitée aux dommages directs et prévisibles. Le Kit du Voyageur ne saurait être tenu responsable des dommages indirects, pertes de données, pertes de profits ou préjudices immatériels.
            </p>
            <p className="mt-3">
              Ces limitations ne s&apos;appliquent pas en cas de dommages corporels, de faute lourde ou dolosive, ni dans les cas où la loi interdit expressément de telles limitations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">11. Modification des CGU</h2>
            <p>
              Le Kit du Voyageur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par email ou par une notification sur la Plateforme, au moins 30 jours avant l&apos;entrée en vigueur des nouvelles conditions.
            </p>
            <p className="mt-3">
              La poursuite de l&apos;utilisation de la Plateforme après l&apos;entrée en vigueur des nouvelles CGU vaut acceptation de celles-ci. En cas de refus, l&apos;Utilisateur peut supprimer son compte.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">12. Résiliation</h2>
            <p>
              L&apos;Utilisateur peut supprimer son compte à tout moment depuis les paramètres de son profil ou en contactant <a href="mailto:contact@lekitduvoyageur.fr" className="text-primary hover:underline">contact@lekitduvoyageur.fr</a>. La suppression du compte entraîne la suppression des données personnelles dans les délais prévus par notre politique de confidentialité, à l&apos;exception des données dont la conservation est imposée par la loi.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">13. Droit applicable et règlement des litiges</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige relatif à leur interprétation ou à leur exécution, les parties s&apos;engagent à rechercher une solution amiable avant tout recours judiciaire.
            </p>
            <p className="mt-3">
              À défaut de résolution amiable, les tribunaux compétents seront ceux du ressort du siège social de Le Kit du Voyageur, sauf disposition légale contraire applicable aux consommateurs (notamment l&apos;article R631-3 du Code de la consommation permettant au consommateur de saisir le tribunal de son domicile).
            </p>
            <p className="mt-3">
              Conformément aux articles L611-1 et suivants du Code de la consommation, tout consommateur peut recourir gratuitement à un médiateur de la consommation. Plateforme européenne de règlement en ligne des litiges :{' '}
              <a href="https://ec.europa.eu/consumers/odr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
            </p>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
            <Link href="/cgv" className="text-primary hover:underline text-xs">Conditions Générales de Vente</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/politique-confidentialite" className="text-primary hover:underline text-xs">Politique de confidentialité</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/mentions-legales" className="text-primary hover:underline text-xs">Mentions légales</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cookies" className="text-primary hover:underline text-xs">Cookies</Link>
          </div>

          <p className="text-xs text-foreground/40">
            Dernière mise à jour : juillet 2026 — Version 1.0
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
