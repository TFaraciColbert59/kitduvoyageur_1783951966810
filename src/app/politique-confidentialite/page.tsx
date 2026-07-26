import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';

export const metadata = {
  title: 'Politique de confidentialité | Le Kit du Voyageur',
  description: 'Politique de confidentialité et traitement des données personnelles — RGPD Art. 13 et 14. Le Kit du Voyageur.',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden pt-20" style={{ background: '#1C2620' }}>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="flex items-center gap-2 text-xs font-mono mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <a href="/" className="hover:text-white transition-colors">Accueil</a>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Politique de confidentialité</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-3" style={{ color: '#4A6741' }}>RGPD · Données personnelles</p>
          <h1 className="font-display text-4xl text-white mb-2" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Politique de<br />confidentialité
          </h1>
          <p className="text-sm text-white/50">
            Conformément au Règlement (UE) 2016/679 (RGPD), articles 13 et 14 — Loi Informatique et Libertés n° 78-17 du 6 janvier 1978 modifiée
          </p>
        </div>
      </section>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-10 text-sm leading-relaxed" style={{ color: '#5C6B5E' }}>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>1. Responsable du traitement</h2>
            <div className="rounded-xl p-5 space-y-1.5" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
              <p><strong style={{ color: '#1C2620' }}>Le Kit du Voyageur</strong> (SAS)</p>
              <p>Siège social : [Adresse complète — à compléter]</p>
              <p>Email : <a href="mailto:privacy@lekitduvoyageur.fr" className="hover:underline" style={{ color: '#4A6741' }}>privacy@lekitduvoyageur.fr</a></p>
              <div className="pt-2 mt-2" style={{ borderTop: '1px solid #E8E4DA' }}>
                <p><strong style={{ color: '#1C2620' }}>Délégué à la Protection des Données (DPO) :</strong></p>
                <a href="mailto:dpo@lekitduvoyageur.fr" className="hover:underline" style={{ color: '#4A6741' }}>dpo@lekitduvoyageur.fr</a>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>2. Données personnelles collectées</h2>
            <p className="mb-4">Nous collectons les catégories de données suivantes, selon votre utilisation de la plateforme :</p>
            <div className="space-y-3">
              {[
                { title: 'Données d\'identification et de contact', desc: 'Nom, prénom, adresse email, mot de passe (haché via bcrypt), adresse postale de livraison, numéro de téléphone (optionnel).' },
                { title: 'Données de navigation et techniques', desc: 'Adresse IP (pseudonymisée), type de navigateur, système d\'exploitation, pages visitées, durée de visite, URL de provenance, identifiants de session.' },
                { title: 'Données de transaction', desc: 'Historique des commandes, montants, produits achetés, statut de livraison. Aucune donnée bancaire n\'est stockée sur nos serveurs — le paiement est traité exclusivement par Stripe (certifié PCI-DSS niveau 1).' },
                { title: 'Données de profil et préférences', desc: 'Préférences de voyage, type d\'activités, inventaire matériel personnel, kits configurés, carnets de voyage, avis publiés, score de fidélité.' },
                { title: 'Données générées par l\'IA', desc: 'Résultats des sessions de configuration IA (destination, profil, liste d\'équipements recommandés), sauvegardés pour améliorer les recommandations futures.' },
              ]?.map((item) => (
                <div key={item?.title} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                  <p className="font-medium mb-1" style={{ color: '#1C2620' }}>{item?.title}</p>
                  <p className="text-xs" style={{ color: '#7A7A6E' }}>{item?.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>3. Finalités du traitement et bases légales (Art. 6 RGPD)</h2>
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E8E4DA' }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: '#F5F2EC' }}>
                    <th className="text-left p-3 font-semibold" style={{ color: '#1C2620' }}>Finalité</th>
                    <th className="text-left p-3 font-semibold" style={{ color: '#1C2620' }}>Base légale</th>
                    <th className="text-left p-3 font-semibold" style={{ color: '#1C2620' }}>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Gestion du compte et authentification', 'Exécution du contrat (Art. 6.1.b)', 'Durée du compte + 3 ans'],
                    ['Traitement des commandes et paiements', 'Exécution du contrat (Art. 6.1.b)', '10 ans (obligation comptable)'],
                    ['Personnalisation des recommandations IA', 'Intérêt légitime (Art. 6.1.f)', 'Durée du compte'],
                    ['Emails transactionnels', 'Exécution du contrat (Art. 6.1.b)', 'Durée du compte'],
                    ['Communications marketing et newsletter', 'Consentement (Art. 6.1.a)', 'Jusqu\'au retrait du consentement'],
                    ['Statistiques d\'audience (Google Analytics)', 'Consentement (Art. 6.1.a)', '13 mois (cookies)'],
                    ['Prévention de la fraude et sécurité', 'Intérêt légitime (Art. 6.1.f)', '12 mois (logs)'],
                    ['Respect des obligations légales', 'Obligation légale (Art. 6.1.c)', 'Selon obligation applicable'],
                  ]?.map(([finalite, base, duree], i) => (
                    <tr key={i} style={{ borderTop: '1px solid #E8E4DA' }}>
                      <td className="p-3" style={{ color: '#1C2620' }}>{finalite}</td>
                      <td className="p-3" style={{ color: '#5C6B5E' }}>{base}</td>
                      <td className="p-3" style={{ color: '#5C6B5E' }}>{duree}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>4. Destinataires des données</h2>
            <p className="mb-4">Vos données peuvent être transmises aux sous-traitants suivants, dans le strict cadre de la fourniture de leurs services :</p>
            <div className="space-y-2">
              {[
                { name: 'Supabase, Inc.', role: 'Hébergement base de données', location: 'UE (Frankfurt)' },
                { name: 'Stripe, Inc.', role: 'Traitement des paiements (PCI-DSS niveau 1)', location: 'UE' },
                { name: 'Netlify, Inc.', role: 'Hébergement de l\'application web', location: 'UE' },
                { name: 'Google LLC', role: 'Analytics (avec consentement uniquement)', location: 'UE (clause contractuelle type)' },
                { name: 'Anthropic / Google Gemini', role: 'Traitement IA des requêtes de configuration', location: 'UE / USA (SCC)' },
              ]?.map((item) => (
                <div key={item?.name} className="flex items-start gap-3 rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                  <div className="flex-1">
                    <p className="font-medium text-xs" style={{ color: '#1C2620' }}>{item?.name}</p>
                    <p className="text-xs" style={{ color: '#7A7A6E' }}>{item?.role} — {item?.location}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(74,103,65,0.1)', color: '#4A6741' }}>DPA signé</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-medium" style={{ color: '#1C2620' }}>⚠️ Aucune donnée personnelle n&apos;est vendue à des tiers.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>5. Transferts de données hors Union Européenne</h2>
            <p>Certains de nos sous-traitants sont établis aux États-Unis (Google, Anthropic, Stripe). Ces transferts sont encadrés par des Clauses Contractuelles Types (CCT) adoptées par la Commission européenne et le Data Privacy Framework UE-États-Unis.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>6. Durées de conservation</h2>
            <div className="space-y-2">
              {[
                ['Données de compte (profil, préférences)', 'Durée du compte + 3 ans après suppression'],
                ['Données de commande et factures', '10 ans (obligation comptable)'],
                ['Données de paiement (référence transaction)', '13 mois (délai de contestation carte bancaire)'],
                ['Logs de connexion et sécurité', '12 mois (LCEN Art. 6-II)'],
                ['Cookies analytiques (Google Analytics)', '13 mois maximum (recommandation CNIL)'],
                ['Données de prospection commerciale', '3 ans à compter du dernier contact'],
              ]?.map(([type, duration]) => (
                <div key={type} className="flex gap-3 rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                  <div className="flex-1 text-xs" style={{ color: '#1C2620' }}>{type}</div>
                  <div className="text-xs text-right max-w-[180px]" style={{ color: '#7A7A6E' }}>{duration}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>7. Vos droits (RGPD, articles 15 à 22)</h2>
            <p className="mb-4">Vous disposez des droits suivants concernant vos données personnelles :</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {[
                { right: 'Droit d\'accès (Art. 15)', desc: 'Obtenir une copie de toutes vos données personnelles que nous traitons.' },
                { right: 'Droit de rectification (Art. 16)', desc: 'Corriger des données inexactes ou incomplètes vous concernant.' },
                { right: 'Droit à l\'effacement (Art. 17)', desc: 'Demander la suppression de vos données ("droit à l\'oubli").' },
                { right: 'Droit à la portabilité (Art. 20)', desc: 'Recevoir vos données dans un format structuré et lisible par machine.' },
                { right: 'Droit d\'opposition (Art. 21)', desc: 'Vous opposer au traitement de vos données à des fins de prospection.' },
                { right: 'Droit à la limitation (Art. 18)', desc: 'Demander la suspension temporaire du traitement dans certains cas.' },
              ]?.map((item) => (
                <div key={item?.right} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                  <p className="font-medium text-xs mb-1" style={{ color: '#1C2620' }}>{item?.right}</p>
                  <p className="text-xs" style={{ color: '#7A7A6E' }}>{item?.desc}</p>
                </div>
              ))}
            </div>
            <div className="p-5 rounded-xl" style={{ background: 'rgba(74,103,65,0.08)', border: '1px solid rgba(74,103,65,0.2)' }}>
              <p className="font-medium text-xs mb-2" style={{ color: '#1C2620' }}>Comment exercer vos droits ?</p>
              <p className="text-xs" style={{ color: '#5C6B5E' }}>
                Envoyez votre demande par email à{' '}
                <a href="mailto:privacy@lekitduvoyageur.fr" className="hover:underline" style={{ color: '#4A6741' }}>privacy@lekitduvoyageur.fr</a>.
                Nous nous engageons à répondre dans un délai d&apos;un mois (Art. 12 RGPD).
                En cas de réponse insatisfaisante, vous pouvez introduire une réclamation auprès de la{' '}
                <a href="https://www.cnil.fr/fr/plaintes" className="hover:underline" style={{ color: '#4A6741' }} target="_blank" rel="noopener noreferrer">CNIL</a>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-4 pb-2" style={{ color: '#1C2620', borderBottom: '1px solid #E8E4DA' }}>8. Sécurité des données (Art. 32 RGPD)</h2>
            <p>Nous mettons en œuvre les mesures techniques et organisationnelles appropriées : chiffrement TLS 1.3 en transit, AES-256 au repos, authentification sécurisée via Supabase Auth (JWT), contrôle d&apos;accès granulaire par rôle (RLS), mots de passe hachés (bcrypt), sauvegardes quotidiennes chiffrées, aucune donnée bancaire stockée sur nos serveurs.</p>
          </section>

          <div className="flex flex-wrap gap-3 pt-6" style={{ borderTop: '1px solid #E8E4DA' }}>
            {[{ href: '/mentions-legales', label: 'Mentions légales' }, { href: '/cgu', label: 'CGU' }, { href: '/cgv', label: 'CGV' }, { href: '/cookies', label: 'Cookies' }, { href: '/contact', label: 'Contact DPO' }]?.map((link, i, arr) => (
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
