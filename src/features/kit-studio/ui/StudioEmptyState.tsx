import Link from 'next/link';

/**
 * État vide explicite : le compte est connecté mais ne possède encore aucun kit.
 * Aucune donnée de démonstration n'est affichée. Le CTA mène à la seule UI de création de
 * kit existante aujourd'hui (`/hub?studio=1`, API `POST /api/kit-studio/configuration`) ;
 * en P3, ce lien pointera vers le studio survivant.
 */
export function StudioEmptyState({ unauthenticated }: { unauthenticated?: boolean } = {}) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 24px) 24px 24px',
        background: 'var(--lkv-surface-canvas, var(--lkv-stone-50, rgb(248 246 235)))',
        color: 'var(--lkv-forest-900, rgb(23 64 44))',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 16, textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--lkv-stone-500, rgb(86 102 93))',
          }}
        >
          Kit Studio
        </p>
        <h1
          style={{
            margin: 0,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1.2,
          }}
        >
          {unauthenticated ? 'Aucun kit pour le moment' : 'Pas encore de kit'}
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          {unauthenticated
            ? 'Ton studio 3D s’ouvre dès que ton compte contient un kit. Crée ton premier kit ou connecte-toi pour le composer.'
            : 'Ton studio 3D s’ouvre dès que ton compte contient un kit. Crée-le, puis reviens ici pour le composer.'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/hub?studio=1"
            style={{
              justifySelf: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 999,
              background: 'var(--lkv-forest-900, rgb(23 64 44))',
              color: 'var(--lkv-stone-50, rgb(248 246 235))',
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Créer mon premier kit
          </Link>
          {unauthenticated ? (
            <Link
              href="/connexion?next=/kit-studio"
              style={{
                justifySelf: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                padding: '0 20px',
                borderRadius: 999,
                background: 'rgba(23, 64, 44, 0.08)',
                color: 'var(--lkv-forest-900, rgb(23 64 44))',
                border: '0.5px solid rgba(23, 43, 36, 0.15)',
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Se connecter
            </Link>
          ) : null}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--lkv-stone-500, rgb(86 102 93))' }}>
          Aucune donnée de démonstration n’est affichée sur cette page.
        </p>
      </div>
    </main>
  );
}
