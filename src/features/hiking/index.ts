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
export * from './offline/OfflineManager';
export * from './offline/useOfflineManager';
export * from './navigation/NavigationEngine';
export * from './navigation/VoiceGuidanceService';
export * from './journal/JournalEventBuilder';
export * from './journal/JournalService';
export * from './journal/JournalStore';
export * from './safety/SafetyEngine';
export * from './copilot/CopilotEngine';
export * from './intelligence/TrailIntelligenceEngine';
export * from './intelligence/TrailIntelligenceService';

// Components
export { default as TopHUD } from './components/TopHUD';
export { default as ContextualInsight } from './components/ContextualInsight';
export { default as NavigationCard } from './components/NavigationCard';
export { default as HikingControls } from './components/HikingControls';
export { default as CockpitBottomNav } from './components/CockpitBottomNav';
export { default as OfflineIndicatorBanner } from './components/OfflineIndicatorBanner';
export { default as SafetyCenterModal } from './components/SafetyCenterModal';
export { default as CopilotPanel } from './components/CopilotPanel';
export { default as HikingCockpitPage } from './components/HikingCockpitPage';




