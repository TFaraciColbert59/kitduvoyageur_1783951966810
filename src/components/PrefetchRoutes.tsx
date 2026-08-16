import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrefetchRoutes() {
  const router = useRouter();
  useEffect(() => {
    const routes = ['/', '/explorer', '/mon-materiel', '/communaute', '/compte'];
    routes.forEach((r) => router.prefetch(r));
  }, [router]);
  return null;
}
