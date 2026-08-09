import { runAllTrackingEngineTests } from './runTrackingTests';

// Execute tests automatically on import
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  runAllTrackingEngineTests();
}
