export type * from './types';
export {
  canPublishPhoto,
  canViewAudience,
  isValidPoint,
  projectCollection,
  projectHighlight,
  viewerRelation,
  type ProjectCollectionOptions,
} from './privacy';

export {
  HIGHLIGHT_LIMITS,
  addPhoto,
  addTip,
  createHighlight,
  removeContribution,
  setHighlightAudience,
  setHighlightPrivacy,
  setHighlightStatus,
  toggleVote,
  type AddPhotoInput,
  type ContributionAuthor,
  type CreateHighlightInput,
} from './engine/highlights';
export {
  COLLECTION_LIMITS,
  addCollectionItem,
  collectionContains,
  createCollection,
  moveCollectionItem,
  removeCollectionItem,
  reorderCollection,
  saveHighlightToPlaces,
  sortCollectionItems,
  updateCollection,
  type AddCollectionItemInput,
  type CreateCollectionInput,
  type UpdateCollectionInput,
} from './engine/collections';
export {
  activeShareLinks,
  createShareLink,
  resolveShareLink,
  revokeAllShareLinks,
  revokeShareLink,
  sharePath,
  type ShareResolution,
} from './engine/sharing';
export { searchCollections, type SearchCollectionsOptions } from './engine/search';
export { recommendInspiration } from './engine/recommendations';
export {
  buildEditorialGuide,
  publicEditorialCollections,
  searchParkRoutes,
  type GuideSource,
} from './engine/guides';
export {
  indexTrailPhotos,
  routeCommunityMedia,
  type IndexTrailPhotosOptions,
  type RouteMediaOptions,
} from './engine/trailView';
export {
  coarseArea,
  normalizeRouteTag,
  synthesizeRouteCommunity,
  type SynthesizeOptions,
} from './engine/communityRoute';
export { resolveStreetView } from './engine/streetView';
export {
  bearingDeg,
  bboxCenter,
  directionFromHeading,
  haversineM,
  pointInBbox,
  polylineLengthM,
  projectOnPolyline,
  type PolylineProjection,
} from './engine/geometry';
export { defaultRuntime, fixedRuntime, type Runtime } from './engine/runtime';
export { fail, ok, plainText } from './engine/result';

export {
  InMemoryHighlightsStore,
  type HighlightsSeed,
  type HighlightsStore,
} from './services/store';
export { HighlightsService } from './services/highlightsService';
export { CollectionsService } from './services/collectionsService';
export { InspirationService, type InspirationSource } from './services/inspirationService';
export { TrailMediaService } from './services/mediaService';
