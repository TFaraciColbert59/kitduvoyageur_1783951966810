import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contactez l\'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles. Notre équipe répond sous 48 heures ouvrées.',
  openGraph: {
    title: 'Contact',
    description:
      'Contactez l\'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles. Notre équipe répond sous 48 heures ouvrées.',
  },
  twitter: {
    title: 'Contact',
    description:
      'Contactez l\'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles. Notre équipe répond sous 48 heures ouvrées.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
