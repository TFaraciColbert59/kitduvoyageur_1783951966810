import { EmptyState } from '@/components/ui';
import { PageLayout } from '@/design';
import { createClient } from '@/lib/supabase/server';
import { requireAdminOrRedirect } from '@/features/admin/queries';
import { AdminNav } from '../_components/AdminNav';
import { MfaManager, type TotpFactor } from '../_components/MfaManager';

/** GET /admin/securite — second facteur TOTP (inscription, élévation AAL2, révocation). */
export default async function AdminSecurityPage() {
  await requireAdminOrRedirect();

  let factors: TotpFactor[] = [];
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      unavailable = true;
    } else {
      factors = ((data.totp ?? []) as TotpFactor[]).filter((f) => f.status === 'verified');
    }
  } catch {
    unavailable = true;
  }

  return (
    <PageLayout title="Sécurité" subtitle="Double authentification (TOTP)">
      <AdminNav />
      {unavailable ? (
        <EmptyState
          title="MFA illisible"
          description="Impossible de lister les facteurs. Réessayez après reconnexion."
        />
      ) : (
        <MfaManager initialFactors={factors} />
      )}
    </PageLayout>
  );
}
