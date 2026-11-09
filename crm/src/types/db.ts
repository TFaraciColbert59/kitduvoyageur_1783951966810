export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Placeholder remplacé par `supabase gen types` après chaque migration (02_ARCHITECTURE § 2).
export type Database = {
  public: { Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>; Views: Record<string, never>; Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>; Enums: Record<string, never>; CompositeTypes: Record<string, never> };
  admin: { Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>; Views: Record<string, never>; Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>; Enums: Record<string, never>; CompositeTypes: Record<string, never> };
};
