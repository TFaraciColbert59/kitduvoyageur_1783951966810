// src/types/kit.ts
export interface Kit {
  id: string;
  name: string;
  itemIds: string[]; // IDs of equipment items belonging to the kit
  created_at: string; // ISO date string
  updated_at?: string;
};
