import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import CreateClubView from '@/components/clubs/CreateClubView';

export const metadata = {
  title: 'Créer un club | Le Kit du Voyageur',
  description: 'Créez votre club et rassemblez des voyageurs autour d\'une pratique ou d\'un esprit.',
};

export default function CreateClubPage() {
  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <CreateClubView />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <CreateClubView />
        </MobilePageShell>
        
      </div>
    </>
  );
}
