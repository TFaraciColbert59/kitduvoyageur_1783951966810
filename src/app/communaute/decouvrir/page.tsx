import { redirect } from 'next/navigation';

/** Ancienne page Découvrir : remplacée par le fil unique. */
export default function CommunityDiscoveryPage() {
  redirect('/communaute');
}
