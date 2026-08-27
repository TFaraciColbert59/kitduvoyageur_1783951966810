import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { loadRouteDetail } from '@/features/hiking/services/RouteService';
import PreparationClient from './PreparationClient';
import { redirect } from 'next/navigation';

import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default async function PreparerRandonneePage({
  searchParams,
}: {
  searchParams: Promise<{ routeId?: string }>;
}) {
  const params = await searchParams;
  const routeId = params?.routeId;
  
  if (!routeId) {
    redirect('/explorer');
  }

  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  let route = null;
  try {
    route = await loadRouteDetail(supabase, routeId);
  } catch (err) {
    console.error('Error loading route detail for preparation:', err);
  }

  if (!route) {
    redirect('/explorer');
  }

  return (
    <MobilePageShell safeTop={false} hasBottomNav={false} videoBackground={false} background="#F5F2EA">
      <div className="min-h-[100dvh] w-full max-w-full overflow-y-auto md:overflow-hidden bg-[#F5F2EA]">
        <PreparationClient route={route} userId={user?.id} />
      </div>
    </MobilePageShell>
  );
}
