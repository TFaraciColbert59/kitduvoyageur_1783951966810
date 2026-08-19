import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Conditions Générales d\'Utilisation | Le Kit du Voyageur',
  description: 'Conditions générales d\'utilisation de la plateforme Le Kit du Voyageur — marketplace, comptes utilisateurs, responsabilité plateforme.',
};

function CGUSections() {
  return (
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
          <li><strong>Configurateur IA</strong> : génération de kits de voyage personnalisés par intelligence artificielle</li>
          <li><strong>Boutique e-commerce</strong> : vente de produits d&apos;équipement outdoor neufs</li>
          <li><strong>Marketplace occasion</strong> : mise en relation entre particuliers pour la vente et l&apos;achat d&apos;équipements d&apos;occasion</li>
          <li><strong>Inventaire personnel</strong> : gestion de l&apos;équipement possédé</li>
          <li><strong>Fiches destinations</strong> : informations pratiques sur les pays et itinéraires</li>
          <li><strong>Espace communautaire</strong> : carnets de voyage, avis, groupes, messagerie</li>
        </ul>
        <p className="mt-3">
          Le Kit du Voyageur se réserve le droit de modifier, suspendre ou interrompre tout ou partie des services à tout moment.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Création et gestion du compte utilisateur</h2>
        <p>
          L&apos;accès à la majorité des fonctionnalités de la Plateforme nécessite la création d&apos;un compte utilisateur. L&apos;Utilisateur s&apos;engage à fournir des informations exactes, maintenir la confidentialité de ses identifiants, ne pas partager son compte et informer immédiatement Le Kit du Voyageur de toute utilisation non autorisée.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Utilisation acceptable de la Plateforme</h2>
        <p>Il est notamment interdit de publier des contenus illicites, usurper une identité, utiliser des robots ou scrapers, diffuser des codes malveillants, effectuer des transactions frauduleuses ou collecter des données personnelles sans consentement.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Contenu généré par les utilisateurs</h2>
        <p>En publiant du contenu, l&apos;Utilisateur garantit être titulaire des droits nécessaires et accorde à Le Kit du Voyageur une licence non exclusive pour reproduire et afficher ce contenu. Le Kit du Voyageur agit en qualité d&apos;hébergeur (LCEN, DSA). Pour signaler un contenu illicite : <a href="mailto:signalement@lekitduvoyageur.fr" className="text-primary hover:underline">signalement@lekitduvoyageur.fr</a>.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Marketplace — Responsabilité de la plateforme intermédiaire</h2>
        <p>Le Kit du Voyageur agit en qualité d&apos;intermédiaire de plateforme (DSA) et n&apos;est pas partie au contrat de vente entre Vendeur et Acheteur.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Propriété intellectuelle</h2>
        <p>La Plateforme et son contenu sont la propriété exclusive de Le Kit du Voyageur ou font l&apos;objet de licences. Toute reproduction non autorisée est interdite.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Intelligence artificielle — Limites et responsabilité</h2>
        <p>Les recommandations du configurateur IA sont fournies à titre indicatif seulement. L&apos;Utilisateur est seul responsable de l&apos;adéquation de l&apos;équipement recommandé à ses besoins.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Disponibilité du service et force majeure</h2>
        <p>Le Kit du Voyageur s&apos;efforce d&apos;assurer la disponibilité du service mais ne peut garantir une disponibilité sans interruption.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">10. Limitation de responsabilité</h2>
        <p>La responsabilité de Le Kit du Voyageur est limitée aux dommages directs et prévisibles, sauf en cas de faute lourde ou dolosive.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">11. Modification des CGU</h2>
        <p>Le Kit du Voyageur peut modifier les CGU à tout moment. Les utilisateurs seront informés 30 jours avant l&apos;entrée en vigueur.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">12. Résiliation</h2>
        <p>L&apos;Utilisateur peut supprimer son compte depuis les paramètres de son profil ou en contactant <a href="mailto:contact@lekitduvoyageur.fr" className="text-primary hover:underline">contact@lekitduvoyageur.fr</a>.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">13. Droit applicable et règlement des litiges</h2>
        <p>Les CGU sont soumises au droit français. En cas de litige, les parties s&apos;engagent à rechercher une solution amiable avant tout recours judiciaire.</p>
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
  );
}

function MobileCGUSections() {
  const sectionStyle: React.CSSProperties = { marginBottom: '24px' };
  const h2Style: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#1C2620', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(11,31,23,0.06)' };
  const pStyle: React.CSSProperties = { fontSize: '13px', color: 'rgba(28,38,32,0.8)', lineHeight: '1.6' };
  const linkStyle: React.CSSProperties = { color: '#17402C', textDecoration: 'underline' };

  return (
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Conditions d&apos;utilisation
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
        Conditions Générales d&apos;Utilisation
      </h1>
      <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.5)', marginBottom: '24px' }}>
        En vigueur au 1er juillet 2026
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>1. Objet et champ d&apos;application</h2>
        <p style={pStyle}>Les présentes CGU régissent l&apos;accès et l&apos;utilisation de la plateforme Le Kit du Voyageur. En utilisant la Plateforme, l&apos;Utilisateur accepte sans réserve les présentes CGU.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>2. Description des services</h2>
        <p style={pStyle}>La Plateforme propose : configurateur IA, boutique e-commerce, marketplace occasion, inventaire personnel, fiches destinations, espace communautaire.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>3. Création et gestion du compte</h2>
        <p style={pStyle}>L&apos;accès à la majorité des fonctionnalités nécessite un compte. L&apos;Utilisateur est seul responsable de son compte et de son utilisation.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>4. Utilisation acceptable</h2>
        <p style={pStyle}>Il est interdit de publier des contenus illicites, usurper une identité, utiliser des robots ou effectuer des transactions frauduleuses.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>5. Contenu généré par les utilisateurs</h2>
        <p style={pStyle}>En publiant du contenu, l&apos;Utilisateur accorde une licence à Le Kit du Voyageur. Pour signaler un contenu illicite : <a href="mailto:signalement@lekitduvoyageur.fr" style={linkStyle}>signalement@lekitduvoyageur.fr</a>.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>6. Propriété intellectuelle</h2>
        <p style={pStyle}>La Plateforme et son contenu sont la propriété exclusive de Le Kit du Voyageur.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>7. Droit applicable</h2>
        <p style={pStyle}>Les CGU sont soumises au droit français.</p>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '16px', borderTop: '1px solid rgba(11,31,23,0.06)', marginTop: '24px' }}>
        <Link href="/cgv" style={linkStyle}>CGV</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/politique-confidentialite" style={linkStyle}>Confidentialité</Link>
        <span style={{ color: 'rgba(28,38,32,0.2)', fontSize: '12px' }}>·</span>
        <Link href="/mentions-legales" style={linkStyle}>Mentions légales</Link>
      </div>
    </div>
  );
}

export default function CGUPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: "Conditions G\u00e9n\u00e9rales d'Utilisation — Le Kit du Voyageur",
    description: "Conditions g\u00e9n\u00e9rales d'utilisation de la plateforme Le Kit du Voyageur.",
    url: `${siteUrl}/cgu`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: "Conditions G\u00e9n\u00e9rales d'Utilisation", item: `${siteUrl}/cgu` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />
      {/* DESKTOP */}
      <div className="hidden md:block">
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
            <CGUSections />
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <MobileCGUSections />
        </MobilePageShell>
        
      </div>
    </>
  );
}
