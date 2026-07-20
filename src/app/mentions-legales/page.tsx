import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Mentions légales | Le Kit du Voyageur',
  description: 'Mentions légales du site lekitduvoyageur.fr, conformément à la loi LCEN n° 2004-575 du 21 juin 2004.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Informations légales
        </p>
        <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Mentions légales
        </h1>
        <p className="text-sm text-foreground/50 mb-10">
          Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN)
        </p>

        <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">

          {/* 1. Éditeur */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Éditeur du site</h2>
            <div className="bg-foreground/3 rounded-xl p-4 space-y-1">
              <p><strong className="text-foreground">Dénomination sociale :</strong> Le Kit du Voyageur</p>
              <p><strong className="text-foreground">Forme juridique :</strong> Société par Actions Simplifiée (SAS)</p>
              <p><strong className="text-foreground">Capital social :</strong> 10 000 €</p>
              <p><strong className="text-foreground">Siège social :</strong> 1 Rue de la Paix, 75001 Paris, France</p>
              <p><strong className="text-foreground">SIRET :</strong> 123 456 789 00010</p>
              <p><strong className="text-foreground">RCS :</strong> Paris B 123 456 789</p>
              <p><strong className="text-foreground">N° TVA intracommunautaire :</strong> FR 12 123456789</p>
              <p><strong className="text-foreground">Email :</strong> <a href="mailto:contact@lekitduvoyageur.fr" className="text-primary hover:underline">contact@lekitduvoyageur.fr</a></p>
              <p><strong className="text-foreground">Téléphone :</strong> +33 (0)1 23 45 67 89</p>
            </div>
            <p className="mt-3 text-xs text-foreground/40 italic">
              ⚠️ Ces informations sont des données d&apos;exemple. Le propriétaire du site doit les remplacer par les informations légales réelles de la société.
            </p>
          </section>

          {/* 2. Directeur de publication */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Directeur de la publication</h2>
            <p>
              Le directeur de la publication est le représentant légal de la société Le Kit du Voyageur.
            </p>
            <p className="mt-2">
              Contact : <a href="mailto:contact@lekitduvoyageur.fr" className="text-primary hover:underline">contact@lekitduvoyageur.fr</a>
            </p>
          </section>

          {/* 3. Hébergement */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Hébergement</h2>
            <p className="mb-3">Le site <strong>lekitduvoyageur.fr</strong> est hébergé par :</p>
            <div className="bg-foreground/3 rounded-xl p-4 space-y-1 mb-4">
              <p><strong className="text-foreground">Netlify, Inc.</strong></p>
              <p>44 Montgomery Street, Suite 300</p>
              <p>San Francisco, California 94104, États-Unis</p>
              <p>Site web : <a href="https://www.netlify.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.netlify.com</a></p>
            </div>
            <p className="mb-3">La base de données est hébergée par :</p>
            <div className="bg-foreground/3 rounded-xl p-4 space-y-1">
              <p><strong className="text-foreground">Supabase, Inc.</strong></p>
              <p>970 Toa Payoh North, #07-04, Singapore 318992</p>
              <p>Région de stockage des données : <strong>Europe (eu-west-1 — Frankfurt)</strong></p>
              <p>Site web : <a href="https://supabase.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">supabase.com</a></p>
            </div>
            <p className="mt-3 text-xs text-foreground/50">
              Des Accords de Traitement des Données (DPA) conformes au RGPD ont été conclus avec chacun de ces prestataires.
            </p>
          </section>

          {/* 4. Propriété intellectuelle */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble des éléments constituant le site <strong>lekitduvoyageur.fr</strong> (textes, graphismes, logiciels, photographies, images, sons, plans, noms, logos, marques, créations et œuvres protégeables diverses) sont la propriété exclusive de Le Kit du Voyageur ou font l&apos;objet d&apos;une autorisation d&apos;utilisation.
            </p>
            <p className="mt-3">
              Ces éléments sont protégés par les lois françaises et internationales relatives à la propriété intellectuelle, notamment le Code de la propriété intellectuelle (articles L111-1 et suivants pour le droit d&apos;auteur, articles L711-1 et suivants pour les marques).
            </p>
            <p className="mt-3">
              Toute reproduction, représentation, modification, publication, adaptation, totale ou partielle, des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l&apos;autorisation écrite préalable de Le Kit du Voyageur.
            </p>
          </section>

          {/* 5. Responsabilité */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Limitation de responsabilité</h2>
            <p>
              Le Kit du Voyageur s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, Le Kit du Voyageur ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition sur ce site.
            </p>
            <p className="mt-3">
              En conséquence, Le Kit du Voyageur décline toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur ce site, ainsi que pour tout dommage résultant d&apos;une intrusion frauduleuse d&apos;un tiers ayant entraîné une modification des informations mises à disposition sur le site.
            </p>
          </section>

          {/* 6. Liens hypertextes */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Liens hypertextes</h2>
            <p>
              Le site peut contenir des liens hypertextes vers d&apos;autres sites internet. Le Kit du Voyageur n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu. La création de liens hypertextes vers le site lekitduvoyageur.fr est soumise à l&apos;accord préalable et écrit de Le Kit du Voyageur.
            </p>
          </section>

          {/* 7. Données personnelles */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Données personnelles et DPO</h2>
            <p>
              Le traitement des données personnelles collectées sur ce site est régi par notre{' '}
              <Link href="/politique-confidentialite" className="text-primary hover:underline">Politique de confidentialité</Link>,
              conformément au Règlement (UE) 2016/679 du 27 avril 2016 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 modifiée (loi Informatique et Libertés).
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Délégué à la Protection des Données (DPO) :</strong><br />
              Pour toute question relative à la protection de vos données personnelles, vous pouvez contacter notre DPO à l&apos;adresse suivante :{' '}
              <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a>
            </p>
            <p className="mt-3">
              Vous pouvez également introduire une réclamation auprès de la Commission Nationale de l&apos;Informatique et des Libertés (CNIL) :{' '}
              <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
            </p>
          </section>

          {/* 8. Cookies */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Cookies</h2>
            <p>
              Le site utilise des cookies. Pour en savoir plus sur les cookies utilisés et gérer vos préférences, consultez notre{' '}
              <Link href="/cookies" className="text-primary hover:underline">Politique de gestion des cookies</Link>.
            </p>
          </section>

          {/* 9. Droit applicable */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Droit applicable et juridiction compétente</h2>
            <p>
              Le présent site et les présentes mentions légales sont soumis au droit français. En cas de litige relatif à l&apos;interprétation ou à l&apos;exécution des présentes, et à défaut de résolution amiable, les tribunaux français seront seuls compétents.
            </p>
          </section>

          {/* 10. Médiation */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">10. Médiation de la consommation</h2>
            <p>
              Conformément aux articles L611-1 et suivants du Code de la consommation, tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige qui l&apos;oppose à un professionnel.
            </p>
            <p className="mt-3">
              Médiateur compétent : <strong>Médiateur du e-commerce de la FEVAD</strong><br />
              60 rue La Boétie — 75008 Paris<br />
              <a href="https://www.mediateurfevad.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.mediateurfevad.fr</a>
            </p>
            <p className="mt-3">
              Plateforme européenne de règlement en ligne des litiges (RLL) :{' '}
              <a href="https://ec.europa.eu/consumers/odr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
            </p>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
            <Link href="/politique-confidentialite" className="text-primary hover:underline text-xs">Politique de confidentialité</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgv" className="text-primary hover:underline text-xs">CGV</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cookies" className="text-primary hover:underline text-xs">Cookies</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/contact" className="text-primary hover:underline text-xs">Contact</Link>
          </div>

          <p className="text-xs text-foreground/40">
            Dernière mise à jour : juillet 2026
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
