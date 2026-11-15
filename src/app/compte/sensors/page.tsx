import type { Metadata } from 'next';
import SensorsScreen from '@/components/compte/sensors/SensorsScreen';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Capteurs & Santé',
  description:
    'Appairer un capteur BLE GATT, gérer le consentement Santé P01 et lire la télémétrie qualifiée de vos activités.',
  alternates: {
    canonical: `${siteUrl}/compte/sensors`,
  },
  robots: { index: false, follow: false },
};

export default function CompteSensorsPage() {
  return (
    <main className="min-h-screen w-full">
      <SensorsScreen />
    </main>
  );
}
