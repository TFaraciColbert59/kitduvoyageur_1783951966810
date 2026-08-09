import { HikingJournalEvent } from './JournalEventBuilder';
import { JournalService } from './JournalService';

export class JournalStore {
  private events: HikingJournalEvent[] = [];
  private listeners: ((events: HikingJournalEvent[]) => void)[] = [];
  private carnetId: string | null = null;

  constructor(carnetId?: string) {
    this.carnetId = carnetId || null;
  }

  public getEvents(): HikingJournalEvent[] {
    return [...this.events];
  }

  public subscribe(listener: (events: HikingJournalEvent[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public async addEvent(event: HikingJournalEvent): Promise<void> {
    this.events.push(event);
    this.notify();

    if (this.carnetId) {
      try {
        await JournalService.saveEvent(this.carnetId, event);
      } catch (err) {
        console.warn('[JournalStore] Failed to sync event to server:', err);
      }
    }
  }

  public updateEvent(id: string, partial: Partial<HikingJournalEvent>): void {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.events[idx] = { ...this.events[idx], ...partial };
      this.notify();
    }
  }

  public deleteEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    this.notify();
  }

  public clear(): void {
    this.events = [];
    this.notify();
  }

  private notify(): void {
    const sorted = [...this.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    this.listeners.forEach((l) => l(sorted));
  }
}
