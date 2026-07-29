import React from 'react';
import CarteClient from './CarteClient';

export const metadata = {
  title: 'Carte Interactive - Le Kit du Voyageur',
  description: 'Explorez les tracés de randonnée, les refuges et les points d\'eau sur la carte interactive.',
};

export default function CartePage() {
  return <CarteClient />;
}
