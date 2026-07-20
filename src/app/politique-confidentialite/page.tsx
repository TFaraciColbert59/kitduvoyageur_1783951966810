import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Politique de confidentialité | Le Kit du Voyageur',
  description: 'Politique de confidentialité et traitement des données personnelles — RGPD Art. 13 et 14. Le Kit du Voyageur.',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <p className="text-xs font-mono text-primary tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          RGPD · Données personnelles
        </p>
        <h1 className="font-display text-3xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Politique de confidentialité
        </h1>
        <p className="text-sm text-foreground/50 mb-10">
          Conformément au Règlement (UE) 2016/679 (RGPD), articles 13 et 14 — Loi Informatique et Libertés n° 78-17 du 6 janvier 1978 modifiée
        </p>

        <div className="space-y-10 text-sm text-foreground/80 leading-relaxed">

          {/* 1. Responsable */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">1. Responsable du traitement</h2>
            <div className="bg-foreground/3 rounded-xl p-4 space-y-1">
              <p><strong className="text-foreground">Le Kit du Voyageur</strong> (SAS)</p>
              <p>Siège social : [Adresse complète — à compléter]</p>
              <p>Email : <a href="mailto:privacy@lekitduvoyageur.fr" className="text-primary hover:underline">privacy@lekitduvoyageur.fr</a></p>
              <p className="mt-2 pt-2 border-t border-border/50">
                <strong className="text-foreground">Délégué à la Protection des Données (DPO) :</strong><br />
                <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a>
              </p>
            </div>
          </section>

          {/* 2. Données collectées */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">2. Données personnelles collectées</h2>
            <p className="mb-3">Nous collectons les catégories de données suivantes, selon votre utilisation de la plateforme :</p>

            <div className="space-y-3">
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground mb-1">Données d&apos;identification et de contact</p>
                <p className="text-foreground/60 text-xs">Nom, prénom, adresse email, mot de passe (haché via bcrypt), adresse postale de livraison, numéro de téléphone (optionnel).</p>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground mb-1">Données de navigation et techniques</p>
                <p className="text-foreground/60 text-xs">Adresse IP (pseudonymisée), type de navigateur, système d&apos;exploitation, pages visitées, durée de visite, URL de provenance, identifiants de session.</p>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground mb-1">Données de transaction</p>
                <p className="text-foreground/60 text-xs">Historique des commandes, montants, produits achetés, statut de livraison. Aucune donnée bancaire n&apos;est stockée sur nos serveurs — le paiement est traité exclusivement par Stripe (certifié PCI-DSS niveau 1).</p>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground mb-1">Données de profil et préférences</p>
                <p className="text-foreground/60 text-xs">Préférences de voyage, type d&apos;activités, inventaire matériel personnel (gear_items), kits configurés, carnets de voyage, avis publiés, score de fidélité.</p>
              </div>
              <div className="bg-foreground/3 rounded-xl p-4">
                <p className="font-medium text-foreground mb-1">Données générées par l&apos;IA</p>
                <p className="text-foreground/60 text-xs">Résultats des sessions de configuration IA (destination, profil, liste d&apos;équipements recommandés), sauvegardés pour améliorer les recommandations futures.</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-foreground/50">
              Nous ne collectons pas de données sensibles au sens de l&apos;article 9 du RGPD (origine raciale, opinions politiques, données de santé, etc.).
            </p>
          </section>

          {/* 3. Finalités et bases légales */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">3. Finalités du traitement et bases légales (Art. 6 RGPD)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-foreground/5">
                    <th className="text-left p-3 text-foreground font-semibold rounded-tl-lg">Finalité</th>
                    <th className="text-left p-3 text-foreground font-semibold">Base légale</th>
                    <th className="text-left p-3 text-foreground font-semibold rounded-tr-lg">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-3">Gestion du compte et authentification</td>
                    <td className="p-3 text-foreground/60">Exécution du contrat (Art. 6.1.b)</td>
                    <td className="p-3 text-foreground/60">Durée du compte + 3 ans</td>
                  </tr>
                  <tr>
                    <td className="p-3">Traitement des commandes et paiements</td>
                    <td className="p-3 text-foreground/60">Exécution du contrat (Art. 6.1.b)</td>
                    <td className="p-3 text-foreground/60">10 ans (obligation comptable)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Personnalisation des recommandations IA</td>
                    <td className="p-3 text-foreground/60">Intérêt légitime (Art. 6.1.f)</td>
                    <td className="p-3 text-foreground/60">Durée du compte</td>
                  </tr>
                  <tr>
                    <td className="p-3">Envoi d&apos;emails transactionnels (confirmation commande, réinitialisation mot de passe)</td>
                    <td className="p-3 text-foreground/60">Exécution du contrat (Art. 6.1.b)</td>
                    <td className="p-3 text-foreground/60">Durée du compte</td>
                  </tr>
                  <tr>
                    <td className="p-3">Communications marketing et newsletter</td>
                    <td className="p-3 text-foreground/60">Consentement (Art. 6.1.a)</td>
                    <td className="p-3 text-foreground/60">Jusqu&apos;au retrait du consentement</td>
                  </tr>
                  <tr>
                    <td className="p-3">Statistiques d&apos;audience (Google Analytics)</td>
                    <td className="p-3 text-foreground/60">Consentement (Art. 6.1.a)</td>
                    <td className="p-3 text-foreground/60">13 mois (cookies)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Prévention de la fraude et sécurité</td>
                    <td className="p-3 text-foreground/60">Intérêt légitime (Art. 6.1.f)</td>
                    <td className="p-3 text-foreground/60">12 mois (logs)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Respect des obligations légales (comptabilité, RGPD)</td>
                    <td className="p-3 text-foreground/60">Obligation légale (Art. 6.1.c)</td>
                    <td className="p-3 text-foreground/60">Selon obligation applicable</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Destinataires */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">4. Destinataires des données</h2>
            <p className="mb-3">Vos données peuvent être transmises aux sous-traitants suivants, dans le strict cadre de la fourniture de leurs services :</p>
            <div className="space-y-2">
              {[
                { name: 'Supabase, Inc.', role: 'Hébergement base de données', location: 'UE (Frankfurt)', dpa: true },
                { name: 'Stripe, Inc.', role: 'Traitement des paiements (PCI-DSS niveau 1)', location: 'UE', dpa: true },
                { name: 'Netlify, Inc.', role: 'Hébergement de l\'application web', location: 'UE', dpa: true },
                { name: 'Google LLC', role: 'Analytics (avec consentement uniquement)', location: 'UE (clause contractuelle type)', dpa: true },
                { name: 'Anthropic / Google Gemini', role: 'Traitement IA des requêtes de configuration', location: 'UE / USA (SCC)', dpa: true },
              ]?.map((item) => (
                <div key={item?.name} className="flex items-start gap-3 bg-foreground/3 rounded-xl p-3">
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-xs">{item?.name}</p>
                    <p className="text-foreground/50 text-xs">{item?.role} — {item?.location}</p>
                  </div>
                  {item?.dpa && (
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full flex-shrink-0">DPA signé</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-medium text-foreground">
              ⚠️ Aucune donnée personnelle n&apos;est vendue à des tiers.
            </p>
          </section>

          {/* 5. Transferts hors UE */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">5. Transferts de données hors Union Européenne</h2>
            <p>
              Certains de nos sous-traitants sont établis aux États-Unis (Google, Anthropic, Stripe). Ces transferts sont encadrés par des garanties appropriées conformément au chapitre V du RGPD :
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li><strong>Clauses Contractuelles Types (CCT)</strong> adoptées par la Commission européenne (décision 2021/914/UE)</li>
              <li><strong>Data Privacy Framework UE-États-Unis</strong> (décision d&apos;adéquation du 10 juillet 2023) pour les entreprises certifiées</li>
              <li>Mesures techniques complémentaires : chiffrement en transit (TLS 1.3) et au repos (AES-256)</li>
            </ul>
            <p className="mt-3">
              Vous pouvez obtenir une copie des garanties mises en place en contactant notre DPO : <a href="mailto:dpo@lekitduvoyageur.fr" className="text-primary hover:underline">dpo@lekitduvoyageur.fr</a>
            </p>
          </section>

          {/* 6. Durée de conservation */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">6. Durées de conservation</h2>
            <div className="space-y-2 text-xs">
              {[
                ['Données de compte (profil, préférences)', 'Durée du compte + 3 ans après suppression'],
                ['Données de commande et factures', '10 ans (obligation comptable — Art. L123-22 Code de commerce)'],
                ['Données de paiement (référence transaction)', '13 mois (délai de contestation carte bancaire)'],
                ['Logs de connexion et sécurité', '12 mois (LCEN Art. 6-II)'],
                ['Cookies analytiques (Google Analytics)', '13 mois maximum (recommandation CNIL)'],
                ['Consentement cookies', '6 mois (renouvellement du consentement)'],
                ['Données de prospection commerciale', '3 ans à compter du dernier contact'],
                ['Carnets de voyage et contenus publiés', 'Durée du compte (supprimés à la clôture du compte)'],
              ]?.map(([type, duration]) => (
                <div key={type} className="flex gap-3 bg-foreground/3 rounded-lg p-3">
                  <div className="flex-1 text-foreground">{type}</div>
                  <div className="text-foreground/50 text-right max-w-[180px]">{duration}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Droits des utilisateurs */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">7. Vos droits (RGPD, articles 15 à 22)</h2>
            <p className="mb-4">Vous disposez des droits suivants concernant vos données personnelles :</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { right: 'Droit d\'accès (Art. 15)', desc: 'Obtenir une copie de toutes vos données personnelles que nous traitons.' },
                { right: 'Droit de rectification (Art. 16)', desc: 'Corriger des données inexactes ou incomplètes vous concernant.' },
                { right: 'Droit à l\'effacement (Art. 17)', desc: 'Demander la suppression de vos données ("droit à l\'oubli"), sous réserve des obligations légales.' },
                { right: 'Droit à la portabilité (Art. 20)', desc: 'Recevoir vos données dans un format structuré, couramment utilisé et lisible par machine.' },
                { right: 'Droit d\'opposition (Art. 21)', desc: 'Vous opposer au traitement de vos données à des fins de prospection commerciale ou fondé sur l\'intérêt légitime.' },
                { right: 'Droit à la limitation (Art. 18)', desc: 'Demander la suspension temporaire du traitement dans certains cas prévus par le RGPD.' },
                { right: 'Retrait du consentement (Art. 7)', desc: 'Retirer votre consentement à tout moment pour les traitements fondés sur celui-ci, sans effet rétroactif.' },
                { right: 'Directives post-mortem', desc: 'Définir des directives relatives au sort de vos données après votre décès (Loi Informatique et Libertés, Art. 85).' },
              ]?.map((item) => (
                <div key={item?.right} className="bg-foreground/3 rounded-xl p-3">
                  <p className="font-medium text-foreground text-xs mb-1">{item?.right}</p>
                  <p className="text-foreground/50 text-xs">{item?.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="font-medium text-foreground text-xs mb-2">Comment exercer vos droits ?</p>
              <p className="text-foreground/70 text-xs">
                Envoyez votre demande par email à{' '}
                <a href="mailto:privacy@lekitduvoyageur.fr" className="text-primary hover:underline">privacy@lekitduvoyageur.fr</a>{' '}
                ou par courrier postal à notre siège social, en joignant une copie d&apos;un justificatif d&apos;identité.
                Nous nous engageons à répondre dans un délai d&apos;un mois (Art. 12 RGPD), prolongeable de deux mois en cas de demande complexe.
              </p>
              <p className="text-foreground/70 text-xs mt-2">
                En cas de réponse insatisfaisante, vous pouvez introduire une réclamation auprès de la{' '}
                <a href="https://www.cnil.fr/fr/plaintes" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a>{' '}
                (3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
              </p>
            </div>
          </section>

          {/* 8. Sécurité */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">8. Sécurité des données (Art. 32 RGPD)</h2>
            <p>
              Nous mettons en œuvre les mesures techniques et organisationnelles appropriées pour garantir un niveau de sécurité adapté au risque :
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Chiffrement des communications en transit (TLS 1.3)</li>
              <li>Chiffrement des données au repos (AES-256 via Supabase)</li>
              <li>Authentification sécurisée via Supabase Auth (JWT, refresh tokens)</li>
              <li>Contrôle d&apos;accès granulaire par rôle (Row Level Security — RLS Supabase)</li>
              <li>Mots de passe hachés (bcrypt, facteur de coût ≥ 10)</li>
              <li>Sauvegardes quotidiennes chiffrées de la base de données</li>
              <li>Aucune donnée bancaire stockée sur nos serveurs (délégation totale à Stripe)</li>
              <li>Accès aux données de production limité aux personnes habilitées</li>
            </ul>
            <p className="mt-3">
              En cas de violation de données personnelles susceptible d&apos;engendrer un risque pour vos droits et libertés, nous nous engageons à vous en notifier dans les meilleurs délais, conformément à l&apos;article 34 du RGPD.
            </p>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">9. Cookies et traceurs</h2>
            <p>
              Nous utilisons des cookies nécessaires au fonctionnement du site (exemptés de consentement selon les lignes directrices CNIL) et des cookies analytiques (Google Analytics) soumis à votre consentement préalable.
            </p>
            <p className="mt-2">
              Pour gérer vos préférences ou retirer votre consentement à tout moment, consultez notre{' '}
              <Link href="/cookies" className="text-primary hover:underline">Politique de gestion des cookies</Link>.
            </p>
          </section>

          {/* 10. Modifications */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-4 pb-2 border-b border-border">10. Modifications de la présente politique</h2>
            <p>
              Nous nous réservons le droit de modifier la présente politique de confidentialité à tout moment, notamment pour nous conformer à toute nouvelle réglementation applicable. En cas de modification substantielle, vous serez informé par email ou par une notification sur la plateforme. La date de dernière mise à jour est indiquée en bas de cette page.
            </p>
          </section>

          {/* Navigation */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
            <Link href="/mentions-legales" className="text-primary hover:underline text-xs">Mentions légales</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgu" className="text-primary hover:underline text-xs">CGU</Link>
            <span className="text-foreground/20 text-xs">·</span>
            <Link href="/cgv" className="text-primary hover:underline text-xs">CGV</Link>
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
