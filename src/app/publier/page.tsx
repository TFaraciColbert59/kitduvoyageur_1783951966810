import { redirect } from 'next/navigation';

/** Ancien composeur de publication : remplacé par le drawer de création. */
export default function PublierPage() {
  redirect('/communaute');
}
