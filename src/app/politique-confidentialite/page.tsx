import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Politique de confidentialité | Le Kit du Voyageur',
  description: 'Politique de confidentialité et traitement des données personnelles — RGPD.',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          RGPD · Données personnelles
        </p>
        <h1 className="font-display font-800 text-3xl text-foreground mb-8" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Politique de confidentialité
        </h1>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/80">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles collectées sur ce site est :<br />
              <strong>Le Kit du Voyageur</strong><br />
              [Adresse complète à compléter]<br />
              Email : privacy@lekitduvoyageur.fr
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Données d&apos;identification</strong> : nom, prénom, adresse email, mot de passe (chiffré)</li>
              <li><strong>Données de contact</strong> : adresse postale, numéro de téléphone (lors d&apos;une commande)</li>
              <li><strong>Données de navigation</strong> : adresse IP, cookies, pages visitées, durée de visite</li>
              <li><strong>Données de transaction</strong> : historique des commandes, montants, produits achetés</li>
              <li><strong>Données de profil</strong> : préférences de voyage, inventaire matériel, kits configurés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Finalités du traitement</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gérer votre compte et authentification (base légale : exécution du contrat)</li>
              <li>Traiter vos commandes et paiements (base légale : exécution du contrat)</li>
              <li>Personnaliser les recommandations IA (base légale : intérêt légitime)</li>
              <li>Envoyer des communications transactionnelles (base légale : exécution du contrat)</li>
              <li>Envoyer des communications marketing avec votre consentement (base légale : consentement)</li>
              <li>Améliorer nos services via des statistiques anonymisées (base légale : intérêt légitime)</li>
              <li>Respecter nos obligations légales (base légale : obligation légale)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Durée de conservation</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Données de compte : jusqu&apos;à suppression du compte + 3 ans</li>
              <li>Données de commande : 10 ans (obligation comptable)</li>
              <li>Cookies analytiques : 13 mois maximum</li>
              <li>Logs de connexion : 12 mois</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Destinataires des données</h2>
            <p>Vos données peuvent être transmises à :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase</strong> (hébergement base de données) — DPA signé</li>
              <li><strong>Stripe</strong> (paiement sécurisé) — certifié PCI-DSS niveau 1 — DPA signé</li>
              <li><strong>Netlify</strong> (hébergement) — DPA signé</li>
              <li><strong>Google Analytics</strong> (statistiques, avec votre consentement uniquement)</li>
            </ul>
            <p className="mt-2">Aucune donnée n&apos;est vendue à des tiers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Vos droits (RGPD)</h2>
            <p>Conformément au RGPD (articles 15 à 22), vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données</li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
              <li><strong>Droit à l&apos;effacement</strong> : supprimer vos données (&quot;droit à l&apos;oubli&quot;)</li>
              <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
              <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement à des fins de marketing</li>
              <li><strong>Droit à la limitation</strong> : limiter le traitement dans certains cas</li>
            </ul>
            <p className="mt-2">
              Pour exercer ces droits : <a href="mailto:privacy@lekitduvoyageur.fr" className="text-primary hover:underline">privacy@lekitduvoyageur.fr</a><br />
              Vous pouvez également introduire une réclamation auprès de la <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookies</h2>
            <p>
              Nous utilisons des cookies pour le fonctionnement du site (cookies nécessaires, exemptés de consentement) et des cookies analytiques (Google Analytics, soumis à votre consentement). Vous pouvez gérer vos préférences via la bannière de consentement ou dans les paramètres de votre navigateur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement SSL/TLS, authentification sécurisée via Supabase Auth, contrôle d&apos;accès par rôle (RLS), sauvegardes quotidiennes.
            </p>
          </section>

          <div className="flex gap-4 pt-4 border-t border-border">
            <Link href="/cgu" className="text-primary hover:underline text-sm">Conditions Générales d&apos;Utilisation</Link>
            <Link href="/cgv" className="text-primary hover:underline text-sm">Conditions Générales de Vente</Link>
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
