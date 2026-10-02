import { redirect } from 'next/navigation';

/**
 * Le Compas est le seul préparateur : toute création d'aventure passe par
 * lui. L'assistant guidé en cinq étapes et la génération IA qui vivaient ici
 * (et /voyages/nouveau, /voyage-ia qui y menaient) ouvrent le Compas vide.
 */
export default function HubNouveauPage() {
  redirect('/compas?nouvelle=1');
}
