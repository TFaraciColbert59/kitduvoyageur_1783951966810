import type { Metadata } from 'next';
import Link from 'next/link';
import { AccessibilitySettingsScreen } from '@/components/accessibility';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Accessibilité et affichage · LKDV',
  description:
    'Réglages de taille de texte, contraste élevé, réduction des animations, repères clavier et lecteur d’écran.',
  robots: { index: false, follow: false },
};

export default function AccessibilitePage() {
  return (
    <main id="main-content" className="min-h-screen w-full px-4 py-6 sm:px-6">
      <Link href="/compte" className="lkdv-compte-pref" aria-label="Retour au compte">
        ← Compte
      </Link>
      <AccessibilitySettingsScreen />
    </main>
  );
}
