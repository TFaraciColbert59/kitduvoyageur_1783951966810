import type { Metadata } from 'next';
import { AccessibilitySettingsScreen } from '@/components/accessibility';

export const metadata: Metadata = {
  title: 'Accessibilité',
  description:
    'Réglez le contraste, la taille du texte, les animations et le clavier. Le Kit du Voyageur applique les seuils WCAG 2.2 AA/AAA et RGAA.',
  alternates: { canonical: '/accessibilite' },
  robots: { index: true, follow: true },
};

export default function AccessibilitePage() {
  return <AccessibilitySettingsScreen />;
}
