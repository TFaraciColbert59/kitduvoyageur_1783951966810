import { redirect } from 'next/navigation';

/** Ancien composeur : la création passe par le drawer du Compte. */
export default function CommunityPublishPage() {
  redirect('/communaute');
}
