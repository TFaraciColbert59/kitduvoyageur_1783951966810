import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales de Vente | Le Kit du Voyageur',
  description: 'Conditions générales de vente — e-commerce Le Kit du Voyageur. Droit de rétractation 14 jours, garanties légales, paiement Stripe.',
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Conditions de vente
        </p>
        <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Conditions Générales de Vente
        </h1>
        <p className="text-sm text-foreground/50 mb-10">
          Conformément aux articles L221-1 et suivants du Code de la consommation — En vigueur au 1er juillet 2026
        </p>

        <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Objet et champ d&apos;application</h2>
            <p>
              Les présentes Conditions Générales de Vente (ci-après « CGV ») s&apos;appliquent à toutes les ventes de produits conclues sur le site <strong>lekitduvoyageur.fr</strong> entre la société Le Kit du Voyageur (SAS, ci-après « Le Vendeur ») et tout consommateur non professionnel (ci-après « l&apos;Acheteur »), conformément aux articles L221-1 et suivants du Code de la consommation.
            </p>
            <p className="mt-3">
              Les présentes CGV prévalent sur tout autre document, notamment les conditions générales d&apos;achat de l&apos;Acheteur. Le fait de passer commande implique l&apos;adhésion entière et sans réserve de l&apos;Acheteur aux présentes CGV.
            </p>
            <p className="mt-3">
              Pour les ventes entre particuliers via la marketplace, des conditions spécifiques s&apos;appliquent (voir article 10).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Produits et disponibilité</h2>
            <p>
              Les produits proposés à la vente sont décrits avec la plus grande exactitude possible (caractéristiques essentielles, prix, poids, matières, dimensions). Les photographies illustrant les produits sont non contractuelles et peuvent présenter de légères variations de couleur selon les paramètres d&apos;affichage.
            </p>
            <p className="mt-3">
              Les offres de produits sont valables dans la limite des stocks disponibles. En cas d&apos;indisponibilité d&apos;un produit après passation de la commande, l&apos;Acheteur sera informé par email dans les meilleurs délais et pourra choisir entre un remboursement intégral ou un produit de substitution équivalent.
            </p>
            <p className="mt-3">
              Le Kit du Voyageur se réserve le droit de modifier son catalogue de produits à tout moment.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Prix</h2>
            <p>
              Les prix sont indiqués en euros (€), toutes taxes comprises (TTC), hors frais de livraison. Le taux de TVA applicable est celui en vigueur au jour de la commande.
            </p>
            <p className="mt-3">
              Le Kit du Voyageur se réserve le droit de modifier ses prix à tout moment. Le prix applicable est celui affiché sur la fiche produit au moment de la validation de la commande par l&apos;Acheteur.
            </p>
            <p className="mt-3">
              En cas d&apos;erreur de prix manifeste (prix anormalement bas résultant d&apos;une erreur technique), Le Kit du Voyageur se réserve le droit d&apos;annuler la commande et d&apos;en informer l&apos;Acheteur.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Processus de commande</h2>
            <p>La commande se déroule en plusieurs étapes :</p>
            <ol className="list-decimal pl-5 mt-3 space-y-1">
              <li>Sélection des produits et ajout au panier</li>
              <li>Vérification du contenu du panier et des prix</li>
              <li>Identification ou création de compte</li>
              <li>Saisie de l&apos;adresse de livraison</li>
              <li>Choix du mode de livraison</li>
              <li>Récapitulatif de la commande et acceptation des CGV</li>
              <li>Paiement sécurisé</li>
              <li>Confirmation de commande par email</li>
            </ol>
            <p className="mt-3">
              La commande est définitivement validée à réception de la confirmation de paiement. Un email de confirmation récapitulatif est envoyé à l&apos;Acheteur dans les minutes suivant la validation.
            </p>
            <p className="mt-3">
              Le Kit du Voyageur se réserve le droit d&apos;annuler toute commande en cas de : stock insuffisant, erreur de prix manifeste, suspicion de fraude, ou non-paiement.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Paiement</h2>
            <p>Le paiement s&apos;effectue en ligne, au moment de la commande, par les moyens suivants :</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li><strong>Carte bancaire</strong> (Visa, Mastercard, American Express) via Stripe — certifié PCI-DSS niveau 1</li>
              <li><strong>Virement bancaire</strong> (délai de traitement : 2 à 5 jours ouvrés)</li>
            </ul>
            <p className="mt-3">
              <strong>Sécurité des paiements :</strong> Aucune donnée bancaire n&apos;est stockée sur les serveurs de Le Kit du Voyageur. Le traitement des paiements par carte est entièrement délégué à Stripe, Inc. (certifié PCI-DSS niveau 1). Les transactions sont sécurisées par le protocole TLS et le système d&apos;authentification forte 3D Secure (DSP2).
            </p>
            <p className="mt-3">
              En cas de refus de paiement, la commande est automatiquement annulée. L&apos;Acheteur peut contacter notre service client pour régulariser sa situation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Livraison</h2>
            <p>Les produits sont livrés à l&apos;adresse de livraison indiquée lors de la commande, en France métropolitaine et dans les pays de l&apos;Union Européenne.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-foreground/5">
                    <th className="text-left p-3 text-foreground font-semibold rounded-tl-lg">Mode de livraison</th>
                    <th className="text-left p-3 text-foreground font-semibold">Délai estimé</th>
                    <th className="text-left p-3 text-foreground font-semibold rounded-tr-lg">Tarif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-3">Livraison standard (Colissimo)</td>
                    <td className="p-3 text-foreground/60">3 à 5 jours ouvrés</td>
                    <td className="p-3 text-foreground/60">4,90 € (offerte dès 99 €)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Livraison express (Chronopost)</td>
                    <td className="p-3 text-foreground/60">1 à 2 jours ouvrés</td>
                    <td className="p-3 text-foreground/60">9,90 €</td>
                  </tr>
                  <tr>
                    <td className="p-3">Point relais (Mondial Relay)</td>
                    <td className="p-3 text-foreground/60">2 à 4 jours ouvrés</td>
                    <td className="p-3 text-foreground/60">3,90 €</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Les délais de livraison sont indicatifs et courent à compter de la confirmation de l&apos;expédition. En cas de retard de livraison dépassant 30 jours à compter de la date de commande, l&apos;Acheteur peut annuler la commande et obtenir un remboursement intégral, conformément à l&apos;article L216-6 du Code de la consommation.
            </p>
            <p className="mt-3">
              Le risque de perte ou de détérioration des produits est transféré à l&apos;Acheteur au moment de la livraison physique du produit.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Droit de rétractation</h2>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
              <p className="font-semibold text-foreground text-sm mb-1">⏱ 14 jours pour changer d&apos;avis</p>
              <p className="text-foreground/70 text-xs">
                Conformément à l&apos;article L221-18 du Code de la consommation, vous disposez d&apos;un délai de <strong>14 jours calendaires</strong> à compter de la réception du produit pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.
              </p>
            </div>
            <p className="mb-3"><strong className="text-foreground">Comment exercer ce droit :</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Par email à <a href="mailto:retour@lekitduvoyageur.fr" className="text-primary hover:underline">retour@lekitduvoyageur.fr</a> en indiquant votre numéro de commande</li>
              <li>Via le formulaire de rétractation disponible dans votre espace compte</li>
              <li>Par courrier postal à notre siège social (cachet de la poste faisant foi)</li>
            </ul>
            <p className="mt-3">
              <strong className="text-foreground">Retour du produit :</strong> L&apos;Acheteur dispose de 14 jours à compter de la notification de sa rétractation pour retourner le produit. Les frais de retour sont à la charge de l&apos;Acheteur, sauf en cas de produit défectueux ou non conforme.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Remboursement :</strong> Le remboursement intégral (prix du produit + frais de livraison initiaux) est effectué dans les 14 jours suivant la réception du produit retourné ou la preuve d&apos;expédition, par le même moyen de paiement que celui utilisé lors de la commande.
            </p>
            <p className="mt-3">
              <strong className="text-foreground">Exceptions au droit de rétractation</strong> (Art. L221-28 du Code de la consommation) :
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Produits personnalisés ou confectionnés selon les spécifications de l&apos;Acheteur</li>
              <li>Produits descellés après livraison et ne pouvant être renvoyés pour des raisons d&apos;hygiène</li>
              <li>Produits qui se sont détériorés rapidement après la livraison</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Garanties légales</h2>
            <p>
              Tous les produits vendus par Le Kit du Voyageur bénéficient des garanties légales suivantes :
            </p>
            <div className="mt-4 space-y-3">
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground text-xs mb-1">Garantie légale de conformité (Art. L217-4 à L217-14 du Code de la consommation)</p>
                <p className="text-foreground/60 text-xs">
                  Durée : <strong>2 ans</strong> à compter de la délivrance du produit. Pendant les 12 premiers mois, le défaut de conformité est présumé exister au moment de la délivrance. L&apos;Acheteur peut choisir entre la réparation ou le remplacement du produit, sous réserve des conditions de coût prévues par la loi. Si la réparation et le remplacement sont impossibles, l&apos;Acheteur peut obtenir un remboursement.
                </p>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground text-xs mb-1">Garantie contre les vices cachés (Art. 1641 à 1648 du Code civil)</p>
                <p className="text-foreground/60 text-xs">
                  L&apos;Acheteur peut agir dans un délai de <strong>2 ans</strong> à compter de la découverte du vice. Il peut choisir entre la résolution de la vente (remboursement) ou une réduction du prix.
                </p>
              </div>
            </div>
            <p className="mt-3">
              Pour faire valoir une garantie, contactez notre service client : <a href="mailto:sav@lekitduvoyageur.fr" className="text-primary hover:underline">sav@lekitduvoyageur.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Garantie commerciale (optionnelle)</h2>
            <p>
              Certains produits peuvent bénéficier d&apos;une garantie commerciale du fabricant, dont les conditions sont précisées sur la fiche produit. Cette garantie commerciale s&apos;ajoute aux garanties légales et ne les remplace pas.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">10. Ventes entre particuliers — Marketplace occasion</h2>
            <p>
              Pour les ventes réalisées entre particuliers via la marketplace de Le Kit du Voyageur :
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Le Kit du Voyageur agit en qualité d&apos;<strong>intermédiaire de plateforme</strong> et n&apos;est pas partie au contrat de vente</li>
              <li>Le Vendeur particulier est responsable de l&apos;exactitude de la description et de la condition du produit</li>
              <li>Le droit de rétractation de 14 jours s&apos;applique aux ventes entre particuliers dans les mêmes conditions</li>
              <li>La garantie légale de conformité s&apos;applique uniquement aux ventes par des professionnels ; pour les ventes entre particuliers, seule la garantie contre les vices cachés s&apos;applique</li>
              <li>Le paiement est sécurisé via Stripe Connect ; les fonds sont retenus pendant 48 heures après confirmation de réception par l&apos;Acheteur avant reversement au Vendeur</li>
              <li>Le Kit du Voyageur perçoit une commission sur les ventes réalisées via la marketplace (taux affiché lors de la mise en vente)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">11. Service client et réclamations</h2>
            <p>Pour toute question, réclamation ou demande de retour :</p>
            <div className="mt-3 bg-foreground/3 rounded-xl p-4 space-y-1">
              <p><strong className="text-foreground">Email :</strong> <a href="mailto:sav@lekitduvoyageur.fr" className="text-primary hover:underline">sav@lekitduvoyageur.fr</a></p>
              <p><strong className="text-foreground">Retours :</strong> <a href="mailto:retour@lekitduvoyageur.fr" className="text-primary hover:underline">retour@lekitduvoyageur.fr</a></p>
              <p><strong className="text-foreground">Délai de réponse :</strong> sous 48 heures ouvrées</p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">12. Médiation de la consommation</h2>
            <p>
              Conformément aux articles L611-1 et suivants du Code de la consommation, en cas de litige non résolu à l&apos;amiable dans un délai raisonnable, l&apos;Acheteur peut recourir gratuitement à un médiateur de la consommation.
            </p>
            <p className="mt-3">
              Médiateur compétent : [Nom du médiateur — à compléter lors de l&apos;adhésion à un service de médiation]
            </p>
            <p className="mt-3">
              Plateforme européenne de règlement en ligne des litiges (RLL) :{' '}
              <a href="https://ec.europa.eu/consumers/odr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">13. Droit applicable</h2>
            <p>
              Les présentes CGV sont soumises au droit français. Tout litige relatif à leur interprétation ou à leur exécution sera soumis aux tribunaux compétents français, sans préjudice des droits des consommateurs à saisir le tribunal de leur domicile (Art. R631-3 du Code de la consommation).
            </p>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
            <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
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
