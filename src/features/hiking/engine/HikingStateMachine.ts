import { HikingState } from '../types';

export class HikingStateMachine {
  private currentState: HikingState = 'IDLE';
  private listeners: ((state: HikingState, prevState: HikingState) => void)[] = [];

  constructor(initialState: HikingState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): HikingState {
    return this.currentState;
  }

  public subscribe(listener: (state: HikingState, prevState: HikingState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public transitionTo(nextState: HikingState): boolean {
    if (this.currentState === nextState) return false;

    if (!this.isValidTransition(this.currentState, nextState)) {
      console.warn(`[HikingStateMachine] Invalid transition: ${this.currentState} -> ${nextState}`);
      return false;
    }

    const prevState = this.currentState;
    this.currentState = nextState;
    this.notify(nextState, prevState);
    return true;
  }

  private isValidTransition(from: HikingState, to: HikingState): boolean {
    const validTransitions: Record<HikingState, HikingState[]> = {
      IDLE: ['PREPARING', 'READY', 'OFFLINE'],
      PREPARING: ['READY', 'IDLE', 'OFFLINE'],
      READY: ['TRACKING', 'IDLE', 'OFFLINE'],
      TRACKING: ['PAUSED', 'OFF_ROUTE', 'GPS_WEAK', 'LOW_BATTERY', 'WEATHER_ALERT', 'SAFETY_ALERT', 'FINISHING', 'COMPLETED'],
      PAUSED: ['TRACKING', 'FINISHING', 'COMPLETED', 'IDLE'],
      OFF_ROUTE: ['TRACKING', 'PAUSED', 'SAFETY_ALERT', 'FINISHING'],
      GPS_WEAK: ['TRACKING', 'PAUSED', 'OFF_ROUTE', 'FINISHING'],
      OFFLINE: ['READY', 'IDLE', 'PREPARING'],
      LOW_BATTERY: ['TRACKING', 'PAUSED', 'FINISHING'],
      WEATHER_ALERT: ['TRACKING', 'PAUSED', 'SAFETY_ALERT', 'FINISHING'],
      SAFETY_ALERT: ['TRACKING', 'PAUSED', 'FINISHING'],
      FINISHING: ['COMPLETED', 'IDLE'],
      COMPLETED: ['IDLE'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  private notify(state: HikingState, prevState: HikingState): void {
    this.listeners.forEach((l) => l(state, prevState));
  }
}
