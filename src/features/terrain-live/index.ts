export { default as QuickReportSheet } from './components/QuickReportSheet';
export type { QuickReportSheetProps, QuickReportSubmission } from './components/QuickReportSheet';
export { default as TerrainReportCard } from './components/TerrainReportCard';
export type { TerrainReportCardProps } from './components/TerrainReportCard';
export { default as TerrainReportsList } from './components/TerrainReportsList';
export type { TerrainReportsListProps } from './components/TerrainReportsList';
export { default as TerrainLiveLayer } from './components/TerrainLiveLayer';
export type { TerrainLiveLayerProps } from './components/TerrainLiveLayer';
export { useTerrainReports } from './hooks/useTerrainReports';
export type { UseTerrainReportsInput, UseTerrainReportsResult } from './hooks/useTerrainReports';
export { toTerrainGeoJson } from './lib/terrainGeoJson';
export type { TerrainGeoJsonCollection, TerrainGeoJsonFeature } from './lib/terrainGeoJson';
export {
  MVP_TERRAIN_CATEGORIES,
  SEVERITY_COLORS,
  categoryDisplay,
  relativeAgeFr,
} from './lib/terrainDisplay';
export type { TerrainLiveReport } from './lib/terrainDisplay';
