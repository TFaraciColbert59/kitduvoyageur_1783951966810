import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { fetchUserCrews, fetchPublicCrews } from '@/lib/queries-crews';
import { EquipagesClient } from './EquipagesClient';

// Page serveur dépendante de Supabase et de l'auth : jamais pré-rendue
// statiquement au build (sinon, sans env, le build échoue).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Équipages de Voyage — LKDV',
  description: 'Gérez vos équipages et collectifs de randonnée, organisez vos expéditions partagées.',
};

export default async function EquipagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [userCrews, publicCrews] = await Promise.all([
    user ? fetchUserCrews(user.id) : Promise.resolve([]),
    fetchPublicCrews({ currentUserId: user?.id }),
  ]);

  return (
    <EquipagesClient
      userCrews={userCrews}
      publicCrews={publicCrews}
      currentUserId={user?.id}
    />
  );
}
