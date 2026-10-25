import { redirect } from 'next/navigation';

/** Ancien permalien : redirige vers le post du fil. */
export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/communaute?post=${encodeURIComponent(id)}`);
}
