/**
 * Point d'entrée des analyseurs de parcours R02.
 *
 * Tous les modules sont purs et sans réseau. Les composants peuvent importer
 * un seul analyseur (`analyzeSurfaces`, `analyzeDifficulty`…) ou le barrel.
 */
export {
  ANALYSIS_SPORTS,
  ROUTE_ANALYSIS_VERSION,
  isAnalysisSport,
  isFiniteNumber,
  isFinitePositive,
  type AnalysisGap,
  type AnalysisSport,
  type AnalysisStatus,
  type AnalysisWarning,
  type DataProvenance,
  type ProfileSample,
  type RouteSample,
} from './types';

export {
  analyzeSurfaces,
  surfaceCategory,
  type SurfaceAnalysis,
  type SurfaceAnalysisInput,
  type SurfaceCategory,
  type SurfaceSection,
  type SurfaceSectionInput,
  type SurfaceShare,
} from './surfaces';

export {
  analyzeClimbs,
  type ClimbAnalysis,
  type ClimbAnalysisInput,
  type GradientKind,
  type GradientSection,
} from './climbs';

export {
  analyzeDifficulty,
  type AthleteProfile,
  type DifficultyAnalysis,
  type DifficultyFactor,
  type DifficultyInput,
  type DurationEstimate,
} from './difficulty';

export {
  analyzeRouteAlerts,
  type AlertAnalysis,
  type AlertInput,
  type AlertSectionInput,
  type RouteAlert,
  type RouteAlertKind,
} from './alerts';

export {
  analyzeFireAlerts,
  type FireAnalysis,
  type FireAnalysisInput,
  type FireCoordinate,
  type FireGeometry,
  type FireImpact,
  type FireIncident,
  type FireIncidentKind,
  type FireLayerFeature,
  type FireSource,
} from './fire';

export {
  analyzeRouteWeather,
  conditionFromCode,
  matchWeatherAt,
  type RouteWeatherAnalysis,
  type RouteWeatherInput,
  type RouteWeatherSample,
  type WeatherHourInput,
  type WeatherMatch,
  type WeatherSeries,
} from './weather';

export {
  analyzeSessionWeather,
  type SessionWeatherAnalysis,
  type SessionWeatherInput,
  type SessionWeatherSnapshot,
  type SessionWeatherValue,
} from './sessionWeather';
