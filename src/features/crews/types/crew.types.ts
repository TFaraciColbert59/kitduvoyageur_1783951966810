export type CrewRole = 'owner' | 'organizer' | 'member' | 'guest';
export type CrewMemberStatus = 'active' | 'pending' | 'left' | 'removed';
export type CrewVisibility = 'private' | 'link' | 'public';

export interface Crew {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme: string;
  cover_url: string | null;
  visibility: CrewVisibility;
  invite_code: string | null;
  max_members: number;
  level: number;
  xp: number;
  created_by: string;
  legacy_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrewMember {
  crew_id: string;
  user_id: string;
  role: CrewRole;
  status: CrewMemberStatus;
  joined_at: string;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CrewSummary extends Crew {
  member_count: number;
  my_role?: CrewRole | null;
  owner_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  active_trips_count?: number;
  next_trip?: {
    id: string;
    title: string;
    slug: string;
    start_date: string | null;
  } | null;
}

export interface CrewWithDetails extends Crew {
  members: CrewMember[];
  trips: Array<{
    id: string;
    title: string;
    slug: string;
    destination_name: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
  }>;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canInvite: boolean;
    canManageMembers: boolean;
  };
}
