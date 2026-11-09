'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

/** Ferme la session et renvoie vers la connexion. */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      tone="soft"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await supabaseBrowser().auth.signOut();
        } catch {
          /* session déjà fermée : sans effet */
        }
        router.push('/connexion');
        router.refresh();
      }}
    >
      {busy ? 'Déconnexion…' : 'Se déconnecter'}
    </Button>
  );
}
