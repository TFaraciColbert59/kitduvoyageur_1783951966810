import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales de Vente | Le Kit du Voyageur',
  description: 'Conditions générales de vente — e-commerce Le Kit du Voyageur.',
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Conditions de vente
        </p>
        <h1 className="font-display font-800 text-3xl text-foreground mb-8" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Conditions Générales de Vente
        </h1>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/80">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Objet et champ d&apos;application</h2>
            <p>
              Les présentes Conditions Générales de Vente (CGV) s&apos;appliquent à toutes les ventes conclues sur le site <strong>lekitduvoyageur.fr</strong> entre Le Kit du Voyageur et tout consommateur (ci-après &quot;l&apos;Acheteur&quot;), conformément aux articles L221-1 et suivants du Code de la consommation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Produits</h2>
            <p>
              Les produits proposés à la vente sont décrits avec la plus grande exactitude possible. Les photographies sont non contractuelles. Le Kit du Voyageur se réserve le droit de modifier son catalogue à tout moment.
            </p>
            <p>
              Les prix sont indiqués en euros TTC. Le Kit du Voyageur se réserve le droit de modifier ses prix à tout moment, étant entendu que le prix applicable est celui en vigueur au moment de la commande.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Commande</h2>
            <p>
              La commande est validée après confirmation du paiement. Un email de confirmation est envoyé à l&apos;Acheteur. Le Kit du Voyageur se réserve le droit d&apos;annuler toute commande en cas de stock insuffisant, d&apos;erreur de prix manifeste ou de suspicion de fraude.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Paiement</h2>
            <p>
              Le paiement s&apos;effectue en ligne via Stripe (carte bancaire, certifié PCI-DSS) ou par virement bancaire. Le paiement est sécurisé : aucune donnée bancaire n&apos;est stockée sur nos serveurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Livraison</h2>
            <p>
              Les produits sont livrés à l&apos;adresse indiquée lors de la commande. Les délais indicatifs sont :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Livraison standard : 3 à 5 jours ouvrés</li>
              <li>Livraison express : 1 à 2 jours ouvrés</li>
              <li>Point relais : 2 à 4 jours ouvrés</li>
            </ul>
            <p className="mt-2">
              La livraison standard est offerte pour toute commande supérieure à 99 €. En cas de retard de livraison, l&apos;Acheteur peut annuler la commande si le délai dépasse 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Droit de rétractation</h2>
            <p>
              Conformément à l&apos;article L221-18 du Code de la consommation, l&apos;Acheteur dispose d&apos;un délai de <strong>14 jours</strong> à compter de la réception du produit pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.
            </p>
            <p className="mt-2">
              Pour exercer ce droit : <a href="mailto:retour@lekitduvoyageur.fr" className="text-primary hover:underline">retour@lekitduvoyageur.fr</a>
            </p>
            <p className="mt-2">
              Les frais de retour sont à la charge de l&apos;Acheteur, sauf en cas de produit défectueux. Le remboursement est effectué dans les 14 jours suivant la réception du retour.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Garanties légales</h2>
            <p>
              Tous les produits bénéficient de la garantie légale de conformité (articles L217-4 à L217-14 du Code de la consommation) et de la garantie contre les vices cachés (articles 1641 à 1648 du Code civil).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Produits d&apos;occasion</h2>
            <p>
              Les produits d&apos;occasion sont vendus en l&apos;état, avec leur condition clairement indiquée (neuf, bon, usé). Le droit de rétractation s&apos;applique également aux produits d&apos;occasion vendus par Le Kit du Voyageur. Pour les ventes entre particuliers via la marketplace, Le Kit du Voyageur agit en qualité d&apos;intermédiaire.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Médiation</h2>
            <p>
              En cas de litige non résolu à l&apos;amiable, l&apos;Acheteur peut recourir gratuitement à un médiateur de la consommation. Plateforme européenne de règlement en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Droit applicable</h2>
            <p>
              Les présentes CGV sont soumises au droit français. Tout litige sera soumis aux tribunaux compétents français.
            </p>
          </section>

          <div className="flex gap-4 pt-4 border-t border-border">
            <Link href="/cgu" className="text-primary hover:underline text-sm">CGU</Link>
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
