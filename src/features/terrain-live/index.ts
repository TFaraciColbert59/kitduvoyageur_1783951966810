export { default as QuickReportSheet } from './components/QuickReportSheet';
export type { QuickReportSheetProps, QuickReportSubmission } from './components/QuickReportSheet';
export { default as TerrainReportCard } from './components/TerrainReportCard';
export type { TerrainReportCardProps } from './components/TerrainReportCard';
export { default as TerrainReportsList } from './components/TerrainReportsList';
export type { TerrainReportsListProps } from './components/TerrainReportsList';
export { default as TerrainLiveLayer } from './components/TerrainLiveLayer';
export type { TerrainLiveLayerProps } from './components/TerrainLiveLayer';
export { default as TerrainLiveCockpitControl } from './components/TerrainLiveCockpitControl';
export type { TerrainLiveCockpitControlProps } from './components/TerrainLiveCockpitControl';
export { useTerrainReports } from './hooks/useTerrainReports';
export type { UseTerrainReportsInput, UseTerrainReportsResult } from './hooks/useTerrainReports';
export { toTerrainGeoJson } from './lib/terrainGeoJson';
export type { TerrainGeoJsonCollection, TerrainGeoJsonFeature } from './lib/terrainGeoJson';
export {
  TERRAIN_MAP_DEFAULT_RADIUS_M,
  TERRAIN_MAP_MAX_MARKERS,
  TERRAIN_MAP_MAX_RADIUS_M,
  TERRAIN_MAP_MIN_RADIUS_M,
  clampTerrainRadiusM,
  confirmTerrainReportRequest,
  confirmTerrainReportViaApi,
  createTerrainReportRequest,
  createTerrainReportViaApi,
  isTerrainLiveEnabled,
  sanitizeTerrainReports,
  shouldFetchTerrainReports,
  terrainMarkerSpec,
} from './lib/terrainMap';
export type { TerrainMarkerSpec, TerrainReportDraft } from './lib/terrainMap';
export {
  MVP_TERRAIN_CATEGORIES,
  SEVERITY_COLORS,
  categoryDisplay,
  relativeAgeFr,
} from './lib/terrainDisplay';
export type { TerrainLiveReport } from './lib/terrainDisplay';
