import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales d\'Utilisation | Le Kit du Voyageur',
  description: 'Conditions générales d\'utilisation de la plateforme Le Kit du Voyageur.',
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Conditions d&apos;utilisation
        </p>
        <h1 className="font-display font-800 text-3xl text-foreground mb-8" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Conditions Générales d&apos;Utilisation
        </h1>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/80">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation de la plateforme Le Kit du Voyageur, accessible à l&apos;adresse <strong>lekitduvoyageur.fr</strong>, éditée par Le Kit du Voyageur.
            </p>
            <p>
              En accédant à la plateforme, vous acceptez sans réserve les présentes CGU. Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description des services</h2>
            <p>La plateforme Le Kit du Voyageur propose :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Un configurateur IA de kits de voyage personnalisés</li>
              <li>Une boutique d&apos;équipements outdoor neufs et d&apos;occasion</li>
              <li>Des fiches destinations et guides de voyage</li>
              <li>Un espace communautaire pour les voyageurs</li>
              <li>Un inventaire personnel de matériel</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Création de compte</h2>
            <p>
              L&apos;accès à certaines fonctionnalités nécessite la création d&apos;un compte. Vous vous engagez à fournir des informations exactes et à maintenir la confidentialité de vos identifiants. Vous êtes responsable de toute activité effectuée depuis votre compte.
            </p>
            <p>
              Le Kit du Voyageur se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Utilisation acceptable</h2>
            <p>Il est interdit d&apos;utiliser la plateforme pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Publier des contenus illicites, diffamatoires ou portant atteinte aux droits de tiers</li>
              <li>Tenter d&apos;accéder à des zones non autorisées de la plateforme</li>
              <li>Utiliser des robots ou scripts automatisés sans autorisation</li>
              <li>Usurper l&apos;identité d&apos;un autre utilisateur</li>
              <li>Diffuser des virus ou tout code malveillant</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Contenu utilisateur</h2>
            <p>
              En publiant du contenu sur la plateforme (avis, carnets de voyage, photos), vous accordez à Le Kit du Voyageur une licence non exclusive, mondiale et gratuite pour utiliser, reproduire et afficher ce contenu dans le cadre du service. Vous garantissez détenir les droits nécessaires sur ce contenu.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Propriété intellectuelle</h2>
            <p>
              La plateforme, son contenu éditorial, ses algorithmes IA et son design sont la propriété exclusive de Le Kit du Voyageur. Toute reproduction sans autorisation est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Disponibilité du service</h2>
            <p>
              Le Kit du Voyageur s&apos;efforce d&apos;assurer la disponibilité de la plateforme 24h/24 et 7j/7, mais ne peut garantir une disponibilité sans interruption. Des maintenances peuvent être effectuées avec ou sans préavis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Limitation de responsabilité</h2>
            <p>
              Le Kit du Voyageur ne saurait être tenu responsable des dommages directs ou indirects résultant de l&apos;utilisation de la plateforme, d&apos;une interruption de service ou d&apos;une perte de données.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Modification des CGU</h2>
            <p>
              Le Kit du Voyageur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés par email ou notification sur la plateforme. La poursuite de l&apos;utilisation après modification vaut acceptation des nouvelles conditions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux compétents seront ceux du ressort du siège social de Le Kit du Voyageur.
            </p>
          </section>

          <div className="flex gap-4 pt-4 border-t border-border">
            <Link href="/cgv" className="text-primary hover:underline text-sm">Conditions Générales de Vente</Link>
            <Link href="/politique-confidentialite" className="text-primary hover:underline text-sm">Politique de confidentialité</Link>
            <Link href="/mentions-legales" className="text-primary hover:underline text-sm">Mentions légales</Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Dernière mise à jour : juillet 2026
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
