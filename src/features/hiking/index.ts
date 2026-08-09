/**
 * LE KIT DU VOYAGEUR — FEATURE HIKING MODULE BARREL EXPORT
 */

export * from './types';
export * from './engine/HikingStateMachine';
export * from './engine/HikeEngine';
export * from './controllers/HikingController';
export * from './hooks/useHikingStore';
export * from './services/WeatherService';
export * from './services/HikeSessionService';
export * from './services/CopilotService';
export * from './services/OfflineService';
export * from './navigation/NavigationEngine';
export * from './navigation/VoiceGuidanceService';

// Components
export { default as TopHUD } from './components/TopHUD';
export { default as ContextualInsight } from './components/ContextualInsight';
export { default as NavigationCard } from './components/NavigationCard';
export { default as HikingControls } from './components/HikingControls';
export { default as CockpitBottomNav } from './components/CockpitBottomNav';
export { default as HikingCockpitPage } from './components/HikingCockpitPage';

