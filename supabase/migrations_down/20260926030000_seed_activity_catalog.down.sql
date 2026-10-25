-- ============================================================================
-- Rollback du seed catalogue — supprime uniquement les entrées de ce seed.
-- ============================================================================

BEGIN;

DELETE FROM public.activity_catalog_metrics
WHERE activity_id IN (
  SELECT id
  FROM public.activity_catalog
  WHERE is_seed = true
    AND slug IN (
      'footing-45', 'footing-90', 'course-5k', 'trail-10k', 'trail-ultra-65k',
      'rando-matin', 'rando-journee', 'rando-refuge', 'rando-famille',
      'trekking-2j', 'rando-camping', 'bivouac-1n', 'bivouac-2n', 'bivouac-3j',
      'trek-4j', 'traverse-5j', 'roadtrip-europe', 'roadtrip-amerique-sud',
      'roadtrip-islandes', 'roadtrip-national', 'roadtrip-desert',
      'city-break-48h', 'city-break-72h', 'visite-culturelle', 'musee-journee',
      'gastronomie-tour', 'canoe-journee', 'sailing-week', 'plongee-autonome',
      'surf-session', 'river-camping', 'ski-randonnee', 'snowboard-sejour',
      'raquettes-journee', 'velo-route', 'gravel-bivouac', 'bikepacking-3j',
      'wingfoil-initiation', 'tandem-parapente', 'kayak-sea', 'scooter-ile',
      'van-life-3j', 'moto-roadtrip'
    )
);

DELETE FROM public.activity_catalog
WHERE is_seed = true
  AND slug IN (
    'footing-45', 'footing-90', 'course-5k', 'trail-10k', 'trail-ultra-65k',
    'rando-matin', 'rando-journee', 'rando-refuge', 'rando-famille',
    'trekking-2j', 'rando-camping', 'bivouac-1n', 'bivouac-2n', 'bivouac-3j',
    'trek-4j', 'traverse-5j', 'roadtrip-europe', 'roadtrip-amerique-sud',
    'roadtrip-islandes', 'roadtrip-national', 'roadtrip-desert',
    'city-break-48h', 'city-break-72h', 'visite-culturelle', 'musee-journee',
    'gastronomie-tour', 'canoe-journee', 'sailing-week', 'plongee-autonome',
    'surf-session', 'river-camping', 'ski-randonnee', 'snowboard-sejour',
    'raquettes-journee', 'velo-route', 'gravel-bivouac', 'bikepacking-3j',
    'wingfoil-initiation', 'tandem-parapente', 'kayak-sea', 'scooter-ile',
    'van-life-3j', 'moto-roadtrip'
  );

COMMIT;
