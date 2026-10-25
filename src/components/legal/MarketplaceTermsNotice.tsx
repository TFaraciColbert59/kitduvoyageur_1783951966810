import Link from 'next/link';
export default function MarketplaceTermsNotice() {
  return (
    <section className="my-6 space-y-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-5 text-sm">
      <h2 className="font-semibold">Échanges entre particuliers : fonctionnement actuel</h2>
      <p>
        Les annonces de vente, location et prêt sont publiées volontairement depuis votre
        inventaire. Le nom, la catégorie, l’état, le prix, la description et la commune saisis pour
        l’annonce sont publics. Gardez adresse précise, numéro de série, coordonnées et documents
        personnels hors de la description.
      </p>
      <p>
        La plateforme enregistre la demande, l’accord, la remise, la réception et le retour. Ces
        confirmations sont des déclarations des participants. Aucun paiement, reversement, fonds
        retenu, caution bancaire, assurance ou contrôle d’identité n’est déclenché par ce suivi
        manuel. Un email confirmé ne prouve pas une identité ; un code-barres ou numéro de série ne
        certifie pas l’authenticité.
      </p>
      <p>
        Vérifiez le matériel et les conditions avec l’autre participant avant toute remise.
        Conservez vos preuves ; ne transmettez pas de pièce d’identité ni de données bancaires dans
        une annonce ou une discussion. Les avis sont réservés aux participants après une transaction
        terminée ; ils ne prouvent pas qu’un paiement a eu lieu.
      </p>
      <p>
        Signalez les annonces illicites depuis leur fiche. Un litige reste enregistré jusqu’à une
        résolution documentée par la modération ; cette procédure ne garantit aucun remboursement.
        Le support peut être contacté par{' '}
        <Link className="underline" href="/contact">
          une demande privée
        </Link>
        . Aucun service 24/7 ni délai garanti n’est annoncé.
      </p>
      <p>
        Les conditions de vente de la boutique concernent les commandes de la boutique et ne
        constituent pas une garantie pour les échanges entre particuliers.
      </p>
    </section>
  );
}
