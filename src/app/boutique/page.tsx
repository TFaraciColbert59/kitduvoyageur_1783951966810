import BoutiqueClient from './BoutiqueClient';

export const metadata = {
  title: 'Boutique — Le Kit du Voyageur',
  description: 'Trouvez le meilleur équipement selon votre budget et votre poids maximal. Achat, location, occasion et enchères.',
};

export default function BoutiquePage() {
  return <BoutiqueClient />;
}