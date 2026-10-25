import { redirect } from 'next/navigation';

/** Ancienne page Reels : remplacée par le fil unique. */
export default function CommunityReelsPage() {
  redirect('/communaute');
}
