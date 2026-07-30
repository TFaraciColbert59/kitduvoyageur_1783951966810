import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communauté Voyageurs & Aventuriers',
  description:
    'Rejoignez la communauté des voyageurs et aventuriers : publications, carnets de voyage, clubs, fils d\'actualité et échanges entre passionnés d\'outdoor.',
  openGraph: {
    title: 'Communauté Voyageurs & Aventuriers',
    description:
      'Rejoignez la communauté des voyageurs et aventuriers : publications, carnets de voyage, clubs, fils d\'actualité et échanges entre passionnés d\'outdoor.',
  },
  twitter: {
    title: 'Communauté Voyageurs & Aventuriers',
    description:
      'Rejoignez la communauté des voyageurs et aventuriers : publications, carnets de voyage, clubs, fils d\'actualité et échanges entre passionnés d\'outdoor.',
  },
};

export default function CommunauteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
