export const metadata = { title: 'Installation en attente — LKDV Control', robots: { index: false, follow: false } };

export default function InstallationPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="lkv-card" style={{ maxWidth: 620, padding: 32 }}>
        <p className="lkv-label">LKDV Control</p>
        <h1 style={{ fontFamily: 'Manrope, system-ui, sans-serif', fontSize: 28, color: 'var(--lkv-primary)', margin: '8px 0 12px' }}>
          Le socle de données n’est pas encore installé
        </h1>
        <p style={{ color: 'var(--lkv-text-secondary)', marginBottom: 16 }}>
          L’application est en ligne, mais le schéma <code>admin</code> de la base n’a pas été créé. Par sécurité,
          aucune migration n’est appliquée sans sauvegarde préalable.
        </p>
        <ol style={{ paddingLeft: 20, color: 'var(--lkv-text-primary)', lineHeight: 1.8 }}>
          <li>Poser les secrets GitHub <code>SUPABASE_DB_URL</code> et <code>BACKUP_PASSPHRASE</code>.</li>
          <li>Lancer la sauvegarde « Sauvegarde de la base » et vérifier l’artefact chiffré.</li>
          <li>Appliquer les migrations CRM M00 → M15, puis exposer le schéma <code>admin</code> à PostgREST.</li>
          <li>Régénérer les types et redéployer.</li>
        </ol>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--lkv-text-secondary)' }}>
          La procédure complète est dans <code>crm/docs/MISE_EN_PRODUCTION.md</code>. Aucune donnée de membre n’a été lue ni modifiée.
        </p>
        <p style={{ marginTop: 24 }}>
          <a href="/connexion" className="lkv-mono" style={{ color: 'var(--lkv-action)' }}>Aller à la connexion</a>
        </p>
      </section>
    </main>
  );
}
