import {
  lkvEventSchema,
  type CreateEventInput,
  type LkvEvent,
  type LkvEventType,
} from './types';
import { createClient } from '@/lib/supabase/client';

export type EventHandler = (event: LkvEvent) => void | Promise<void>;

export interface EventBusOptions {
  persistToDatabase?: boolean;
  supabaseClient?: any;
}

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private persistToDatabase: boolean;
  private supabaseClient: any;

  constructor(options: EventBusOptions = {}) {
    this.persistToDatabase = options.persistToDatabase ?? (typeof window === 'undefined');
    this.supabaseClient = options.supabaseClient || null;
  }

  /**
   * Enregistre un écouteur sur un type d'événement ou sur '*' pour tous.
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Émet un événement sur le bus.
   * Règle de résilience : ne lance JAMAIS d'exception non gérée.
   */
  async emit(input: CreateEventInput): Promise<{
    success: boolean;
    event?: LkvEvent;
    error?: string;
  }> {
    try {
      const parsed = lkvEventSchema.safeParse(input);
      if (!parsed.success) {
        const errMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        console.warn('[EventBus] Validation failed:', errMsg);
        return { success: false, error: errMsg };
      }

      const validData = parsed.data;
      const event: LkvEvent = {
        id: validData.id || crypto.randomUUID(),
        event_type: validData.event_type as LkvEventType,
        actor_id: validData.actor_id,
        entity_type: validData.entity_type,
        entity_id: validData.entity_id,
        metadata: validData.metadata,
        visibility: validData.visibility,
        crew_id: validData.crew_id || null,
        created_at: validData.created_at || new Date().toISOString(),
      };

      // Persistance en base si activée (côté serveur ou mode live)
      if (this.persistToDatabase) {
        try {
          let client = this.supabaseClient;
          if (!client) {
            if (typeof window === 'undefined') {
              try {
                const { createClient: createServerClient } = await import('@/lib/supabase/server');
                client = await createServerClient();
              } catch {
                client = createClient();
              }
            } else {
              client = createClient();
            }
          }
          const { error: dbError } = await client.from('lkv_events').insert({
            id: event.id,
            event_type: event.event_type,
            actor_id: event.actor_id,
            entity_type: event.entity_type,
            entity_id: event.entity_id,
            metadata: event.metadata,
            visibility: event.visibility,
            crew_id: event.crew_id,
            created_at: event.created_at,
          });

          if (dbError) {
            console.warn('[EventBus] Database persist warning:', dbError.message);
          }
        } catch (dbErr) {
          console.warn('[EventBus] Database persist error (non-fatal):', dbErr);
        }
      }

      // Notification des abonnés in-process (type spécifique + wildcard '*')
      const specificListeners = this.listeners.get(event.event_type) || new Set();
      const wildcardListeners = this.listeners.get('*') || new Set();
      const targets = new Set([...specificListeners, ...wildcardListeners]);

      for (const listener of targets) {
        try {
          await Promise.resolve(listener(event));
        } catch (err) {
          console.error(`[EventBus] Error in listener for ${event.event_type}:`, err);
        }
      }

      return { success: true, event };
    } catch (unexpected) {
      console.error('[EventBus] Unexpected emit error:', unexpected);
      return {
        success: false,
        error: unexpected instanceof Error ? unexpected.message : 'Unknown event bus error',
      };
    }
  }
}

// Instance canonique par défaut
export const eventBus = new EventBus();

/**
 * Helper principal pour émettre un événement depuis les server actions et les routes.
 */
export async function emitEvent(input: CreateEventInput) {
  return eventBus.emit(input);
}
