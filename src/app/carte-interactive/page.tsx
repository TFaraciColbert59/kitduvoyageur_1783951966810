import { redirect } from 'next/navigation';

/**
 * P10-05 : la carte interactive historique est remplacée par l'Explorer v2.
 * La redirection est permanente côté produit (une seule page carte).
 */
export const dynamic = 'force-static';

export default function CarteInteractivePage(): never {
  redirect('/explorer');
}
