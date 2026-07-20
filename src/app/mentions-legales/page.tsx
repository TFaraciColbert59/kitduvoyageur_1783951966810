import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Mentions légales | Le Kit du Voyageur',
  description: 'Mentions légales du site Le Kit du Voyageur, conformément à la loi LCEN.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Informations légales
        </p>
        <h1 className="font-display font-800 text-3xl text-foreground mb-8" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Mentions légales
        </h1>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/80">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Éditeur du site</h2>
            <p>
              Le site <strong>lekitduvoyageur.fr</strong> est édité par :<br />
              <strong>Le Kit du Voyageur</strong><br />
              Forme juridique : [À compléter — SARL / SAS / Auto-entrepreneur]<br />
              Capital social : [À compléter]<br />
              Siège social : [Adresse complète à compléter]<br />
              SIRET : [À compléter]<br />
              RCS : [À compléter]<br />
              TVA intracommunautaire : [À compléter]<br />
              Email : contact@lekitduvoyageur.fr<br />
              Téléphone : [À compléter]
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Directeur de la publication</h2>
            <p>[Nom du directeur de publication à compléter]</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Hébergement</h2>
            <p>
              Le site est hébergé par :<br />
              <strong>Netlify, Inc.</strong><br />
              44 Montgomery Street, Suite 300<br />
              San Francisco, California 94104, États-Unis<br />
              <a href="https://www.netlify.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.netlify.com</a>
            </p>
            <p className="mt-2">
              Base de données hébergée par :<br />
              <strong>Supabase, Inc.</strong><br />
              970 Toa Payoh North, #07-04, Singapore 318992<br />
              <a href="https://supabase.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">supabase.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, vidéos, logos, icônes, sons, logiciels) est protégé par le droit d&apos;auteur et appartient à Le Kit du Voyageur ou à ses partenaires. Toute reproduction, représentation, modification, publication ou adaptation, totale ou partielle, est interdite sans autorisation préalable écrite.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Limitation de responsabilité</h2>
            <p>
              Le Kit du Voyageur s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, nous ne pouvons garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition. En conséquence, nous déclinons toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur ce site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Données personnelles</h2>
            <p>
              Pour toute information relative au traitement de vos données personnelles, veuillez consulter notre{' '}
              <Link href="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Droit applicable</h2>
            <p>
              Le présent site est soumis au droit français. En cas de litige, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <p className="text-xs text-muted-foreground border-t border-border pt-6">
            Dernière mise à jour : juillet 2026
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
