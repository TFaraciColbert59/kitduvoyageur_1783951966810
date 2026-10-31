import React from 'react';
import type { Metadata } from 'next';
import CartoPreview from './CartoPreview';

export const metadata: Metadata = {
  title: 'Aperçu cartographique · LKDV',
  robots: { index: false, follow: false },
};

export default function CartoPreviewPage() {
  return <CartoPreview />;
}
