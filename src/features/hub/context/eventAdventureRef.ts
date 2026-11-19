import { z } from 'zod';

export const eventAdventureRefSchema = z.object({
  kind: z.enum(['club_event', 'community_event']),
  id: z.string().uuid(),
});

export type EventAdventureRef = z.infer<typeof eventAdventureRefSchema>;
