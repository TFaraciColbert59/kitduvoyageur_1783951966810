export default function MarketplacePrivacyNotice() {
  return (
    <section className="my-6 space-y-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-5 text-sm">
      <h2 className="font-semibold">Données de l’inventaire, des échanges et du support</h2>
      <p>
        Les objets, numéros de série, localisations privées et historiques de statut de votre
        inventaire sont réservés à votre compte. Une publication crée une annonce publique distincte
        avec le nom de l’objet, la catégorie, l’état, les montants et les champs publics que vous
        saisissez. Le numéro de série et la localisation privée ne sont pas repris automatiquement.
        N’insérez aucune information personnelle dans une description publique.
      </p>
      <p>
        Les demandes, périodes convenues, références de transport déclarées et confirmations de
        remise ou retour servent au suivi de l’accord entre ses participants. Ils sont accessibles à
        ceux-ci et aux personnes autorisées à traiter un litige. Les avis publiés sont visibles avec
        l’annonce ; les signalements sont accessibles à leur auteur et à la modération. Les tickets
        et réponses de support sont privés, accessibles à leur auteur et à l’administration.
      </p>
      <p>
        Ce parcours manuel ne collecte ni données bancaires ni document d’identité et ne réalise pas
        de vérification KYC. Supabase héberge les enregistrements ; Vercel héberge cette version de
        l’application. L’accès aux objets et accords est contrôlé au niveau de la base et des API.
      </p>
      <p>
        Vous pouvez retirer une annonce et demander l’accès, la rectification ou l’effacement de vos
        données via le support. Les confirmations d’un accord, avis et signalements ne peuvent pas
        être réécrits directement par un participant. Les obligations de conservation et les
        demandes concernant les autres participants doivent être examinées par le responsable du
        traitement ; aucune certification de conformité juridique n’est déduite de ces contrôles
        techniques.
      </p>
    </section>
  );
}
