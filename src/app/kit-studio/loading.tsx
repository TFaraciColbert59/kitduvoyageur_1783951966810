import '@/features/kit-studio/ui/kit-studio.css';
import '@/features/kit-studio/ui/route.css';

/** Squelette : trois cartes carrées dans un tiroir sur le fond de la scène, jamais de spinner plein écran. */
export default function KitStudioLoading() {
  return (
    <div className="ks-root ks-stage" aria-busy="true">
      <section className="ks-dock ks-skel-dock" data-open="true" aria-label="Chargement du Kit Studio">
        <div className="ks-skel-row">
          <span className="ks-skel-card" />
          <span className="ks-skel-card" />
          <span className="ks-skel-card" />
        </div>
      </section>
    </div>
  );
}
