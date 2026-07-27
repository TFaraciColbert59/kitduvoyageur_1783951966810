import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';

export const metadata = {
  title: 'Mentions légales | Le Kit du Voyageur',
  description: 'Mentions légales du site lekitduvoyageur.fr, conformément à la loi LCEN n° 2004-575 du 21 juin 2004.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="flex items-center gap-2 text-xs font-mono mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Mentions légales</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: '#4A6741' }}>Informations légales</p>
          <h1 className="font-display text-4xl text-white mb-2" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Mentions légales
          </h1>
          <p className="text-sm text-white/50">
            Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN)
          </p>
        </div>
      </section>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#5C6B5E' }}>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>1. Éditeur du site</h2>
            <div className="rounded-xl p-5 space-y-1.5" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
              <p><strong style={{ color: '#1C2620' }}>Dénomination sociale :</strong> Le Kit du Voyageur</p>
              <p><strong style={{ color: '#1C2620' }}>Forme juridique :</strong> Société par Actions Simplifiée (SAS)</p>
              <p><strong style={{ color: '#1C2620' }}>Capital social :</strong> 10 000 €</p>
              <p><strong style={{ color: '#1C2620' }}>Siège social :</strong> 1 Rue de la Paix, 75001 Paris, France</p>
              <p><strong style={{ color: '#1C2620' }}>SIRET :</strong> 123 456 789 00010</p>
              <p><strong style={{ color: '#1C2620' }}>RCS :</strong> Paris B 123 456 789</p>
              <p><strong style={{ color: '#1C2620' }}>N° TVA intracommunautaire :</strong> FR 12 123456789</p>
              <p><strong style={{ color: '#1C2620' }}>Email :</strong> <a href="mailto:contact@lekitduvoyageur.fr" className="hover:underline" style={{ color: '#4A6741' }}>contact@lekitduvoyageur.fr</a></p>
              <p><strong style={{ color: '#1C2620' }}>Téléphone :</strong> +33 (0)1 23 45 67 89</p>
            </div>
            <p className="mt-3 text-xs italic" style={{ color: '#9A9A8E' }}>
              ⚠️ Ces informations sont des données d&apos;exemple. Le propriétaire du site doit les remplacer par les informations légales réelles de la société.
            </p>
          </section>

          {[
            { num: '2', title: 'Directeur de la publication', content: (<><p>Le directeur de la publication est le représentant légal de la société Le Kit du Voyageur.</p><p className="mt-2">Contact : <a href="mailto:contact@lekitduvoyageur.fr" className="hover:underline" style={{ color: '#4A6741' }}>contact@lekitduvoyageur.fr</a></p></>) },
            { num: '3', title: 'Hébergement', content: (<><p className="mb-3">Le site <strong style={{ color: '#1C2620' }}>lekitduvoyageur.fr</strong> est hébergé par :</p><div className="rounded-xl p-4 space-y-1 mb-4" style={{ background: '#fff', border: '1px solid #E8E4DA' }}><p><strong style={{ color: '#1C2620' }}>Netlify, Inc.</strong></p><p>44 Montgomery Street, Suite 300, San Francisco, California 94104, États-Unis</p></div><p className="mb-3">La base de données est hébergée par :</p><div className="rounded-xl p-4 space-y-1" style={{ background: '#fff', border: '1px solid #E8E4DA' }}><p><strong style={{ color: '#1C2620' }}>Supabase, Inc.</strong></p><p>Région de stockage des données : <strong style={{ color: '#1C2620' }}>Europe (eu-west-1 — Frankfurt)</strong></p></div></>) },
            { num: '4', title: 'Propriété intellectuelle', content: (<p>L&apos;ensemble des éléments constituant le site lekitduvoyageur.fr sont la propriété exclusive de Le Kit du Voyageur ou font l&apos;objet d&apos;une autorisation d&apos;utilisation. Toute reproduction sans autorisation écrite préalable est interdite.</p>) },
            { num: '5', title: 'Limitation de responsabilité', content: (<p>Le Kit du Voyageur s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées sur ce site mais ne peut en garantir l&apos;exhaustivité. Le Kit du Voyageur décline toute responsabilité pour toute imprécision ou inexactitude portant sur des informations disponibles sur ce site.</p>) },
            { num: '6', title: 'Liens hypertextes', content: (<p>Le site peut contenir des liens hypertextes vers d&apos;autres sites internet. Le Kit du Voyageur n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.</p>) },
            { num: '7', title: 'Données personnelles et DPO', content: (<><p>Le traitement des données personnelles collectées sur ce site est régi par notre <Link href="/politique-confidentialite" className="hover:underline" style={{ color: '#4A6741' }}>Politique de confidentialité</Link>, conformément au RGPD.</p><p className="mt-3"><strong style={{ color: '#1C2620' }}>Délégué à la Protection des Données (DPO) :</strong><br />Pour toute question relative à la protection de vos données personnelles : <a href="mailto:dpo@lekitduvoyageur.fr" className="hover:underline" style={{ color: '#4A6741' }}>dpo@lekitduvoyageur.fr</a></p></>) },
            { num: '8', title: 'Cookies', content: (<p>Le site utilise des cookies. Pour en savoir plus sur les cookies utilisés et gérer vos préférences, consultez notre <Link href="/cookies" className="hover:underline" style={{ color: '#4A6741' }}>Politique de gestion des cookies</Link>.</p>) },
            { num: '9', title: 'Droit applicable et juridiction compétente', content: (<p>Le présent site et les présentes mentions légales sont soumis au droit français. En cas de litige, les tribunaux français seront seuls compétents.</p>) },
            { num: '10', title: 'Médiation de la consommation', content: (<><p>Médiateur compétent : <strong style={{ color: '#1C2620' }}>Médiateur du e-commerce de la FEVAD</strong><br />60 rue La Boétie — 75008 Paris<br /><a href="https://www.mediateurfevad.fr" className="hover:underline" style={{ color: '#4A6741' }} target="_blank" rel="noopener noreferrer">www.mediateurfevad.fr</a></p><p className="mt-3">Plateforme européenne de règlement en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" className="hover:underline" style={{ color: '#4A6741' }} target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a></p></>) },
          ]?.map((section) => (
            <section key={section?.num}>
              <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>{section?.num}. {section?.title}</h2>
              {section?.content}
            </section>
          ))}

          <div className="flex flex-wrap gap-3 pt-6" style={{ borderTop: '1px solid #E8E4DA' }}>
            {[{ href: '/politique-confidentialite', label: 'Politique de confidentialité' }, { href: '/cgu', label: 'CGU' }, { href: '/cgv', label: 'CGV' }, { href: '/cookies', label: 'Cookies' }, { href: '/contact', label: 'Contact' }]?.map((link, i, arr) => (
              <React.Fragment key={link?.href}>
                <Link href={link?.href} className="text-xs hover:underline" style={{ color: '#4A6741' }}>{link?.label}</Link>
                {i < arr?.length - 1 && <span className="text-xs" style={{ color: '#C8C3B0' }}>·</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#9A9A8E' }}>Dernière mise à jour : juillet 2026</p>
        </div>
      </main>
      <NewFooterSection />
    </div>
  );
}
