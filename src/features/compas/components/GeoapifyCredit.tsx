/**
 * « Powered by Geoapify », à côté des résultats que le service fournit : les
 * distances par la route qu'il a mesurées (Parcours). Jamais près des points
 * « Sur place », qui viennent d'Overpass et d'OpenStreetMap. Condition lue le
 * 2026-10-10 et relue le 2026-10-11 sur https://www.geoapify.com/pricing
 * (FAQ « Can I use the Free plan in commercial projects? ») : « include a
 * follow-link such as Powered by Geoapify near the map or information provided
 * by the service » ; et sur https://www.geoapify.com/terms-and-conditions :
 * « Geoapify attribution is mandatory when using Free subscription plan », avec
 * l'attribution OpenStreetMap toujours. Un lien « suivi » : pas de `nofollow`.
 */
export default function GeoapifyCredit() {
  return (
    <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
      Powered by Geoapify
    </a>
  );
}
