/**
 * LKDV — Moteur Unifié de Sécurité & Permissions (Phase 3.3)
 * Implémente la fonction miroir exacte de `public.lkv_can` (PostgreSQL RLS).
 * Garantit l'absence de dérive entre les vérifications client/serveur Next.js et la base de données.
 */

export type UnifiedRole = 'owner' | 'organizer' | 'member' | 'guest';
export type MemberStatus = 'active' | 'pending' | 'left' | 'removed';
export type ParticipantStatus = 'invited' | 'confirmed' | 'declined' | 'removed';
export type ResourceType = 'crews' | 'crew_members' | 'trips' | 'trip_participants';
export type ResourceAction = 'select' | 'insert' | 'update' | 'delete';
export type Visibility = 'private' | 'link' | 'unlisted' | 'public';

export interface CrewSecurityContext {
  id: string;
  created_by: string;
  visibility: Visibility;
}

export interface CrewMemberContext {
  crew_id: string;
  user_id: string;
  role: UnifiedRole;
  status: MemberStatus;
}

export interface TripSecurityContext {
  id: string;
  user_id: string;
  crew_id?: string | null;
  visibility: Visibility;
}

export interface TripParticipantContext {
  trip_id: string;
  user_id: string;
  role: UnifiedRole;
  status: ParticipantStatus;
}

export interface LkvSecurityState {
  userId: string | null;
  crew?: CrewSecurityContext | null;
  crewMember?: CrewMemberContext | null;
  trip?: TripSecurityContext | null;
  tripParticipant?: TripParticipantContext | null;
}

/**
 * Miroir TypeScript pur de `public.lkv_can(p_user_id, p_resource, p_resource_id, p_action)`.
 */
export function lkvCan(
  resource: ResourceType,
  action: ResourceAction,
  state: LkvSecurityState
): boolean {
  const { userId, crew, crewMember, trip, tripParticipant } = state;

  // A. Utilisateur Anonyme (userId non renseigné)
  if (!userId) {
    if (action !== 'select') return false;

    if (resource === 'crews') {
      return crew?.visibility === 'public';
    }
    if (resource === 'trips') {
      return trip?.visibility === 'public';
    }
    return false;
  }

  // B. Ressource : CREWS
  if (resource === 'crews') {
    if (!crew) {
      return action === 'insert'; // Tout utilisateur connecté peut créer un équipage
    }

    // Propriétaire / Créateur
    if (crew.created_by === userId) {
      return true;
    }

    if (!crewMember || crewMember.crew_id !== crew.id || crewMember.user_id !== userId) {
      return action === 'select' && (crew.visibility === 'public' || crew.visibility === 'link');
    }

    // Membre inactif (left / removed)
    if (crewMember.status === 'left' || crewMember.status === 'removed') {
      return action === 'select' && crew.visibility === 'public';
    }

    // Membre actif
    if (action === 'select') {
      return crewMember.status === 'active' || crew.visibility === 'public' || crew.visibility === 'link';
    }
    if (action === 'update') {
      return crewMember.status === 'active' && (crewMember.role === 'owner' || crewMember.role === 'organizer');
    }
    if (action === 'delete') {
      return crewMember.status === 'active' && crewMember.role === 'owner';
    }
    return false;
  }

  // C. Ressource : CREW_MEMBERS
  if (resource === 'crew_members') {
    if (!crewMember) {
      return false;
    }

    if (action === 'select') {
      return crewMember.status === 'active';
    }
    if (action === 'insert') {
      return crewMember.status === 'active' && (crewMember.role === 'owner' || crewMember.role === 'organizer');
    }
    if (action === 'update') {
      return crewMember.status === 'active' && crewMember.role === 'owner';
    }
    if (action === 'delete') {
      // Owner/organizer peut expulser, ou tout membre peut quitter son propre équipage
      return crewMember.status === 'active' && (crewMember.role === 'owner' || crewMember.role === 'organizer' || crewMember.user_id === userId);
    }
    return false;
  }

  // D. Ressource : TRIPS
  if (resource === 'trips') {
    if (!trip) {
      return action === 'insert';
    }

    // Propriétaire direct du voyage
    if (trip.user_id === userId) {
      return true;
    }

    // Participant confirmé
    if (tripParticipant && tripParticipant.trip_id === trip.id && tripParticipant.user_id === userId && tripParticipant.status === 'confirmed') {
      if (action === 'select') return true;
      if (action === 'update') return tripParticipant.role === 'owner' || tripParticipant.role === 'organizer';
      if (action === 'delete') return tripParticipant.role === 'owner';
    }

    // Membre de l'équipage hôte
    if (trip.crew_id && crewMember && crewMember.crew_id === trip.crew_id && crewMember.user_id === userId && crewMember.status === 'active') {
      if (action === 'select' && trip.visibility !== 'private') return true;
      if (action === 'update' && (crewMember.role === 'owner' || crewMember.role === 'organizer')) return true;
    }

    // Visibilité publique en lecture
    if (action === 'select' && trip.visibility === 'public') {
      return true;
    }

    return false;
  }

  // E. Ressource : TRIP_PARTICIPANTS
  if (resource === 'trip_participants') {
    if (trip && trip.user_id === userId) {
      return true;
    }

    if (!tripParticipant || tripParticipant.trip_id !== trip?.id || tripParticipant.user_id !== userId) {
      return false;
    }

    if (action === 'select') {
      return tripParticipant.status === 'confirmed';
    }
    if (action === 'insert') {
      return tripParticipant.status === 'confirmed' && (tripParticipant.role === 'owner' || tripParticipant.role === 'organizer');
    }
    if (action === 'update') {
      return tripParticipant.status === 'confirmed' && (tripParticipant.role === 'owner' || tripParticipant.role === 'organizer');
    }
    if (action === 'delete') {
      return tripParticipant.status === 'confirmed' && (tripParticipant.role === 'owner' || tripParticipant.role === 'organizer' || tripParticipant.user_id === userId);
    }
    return false;
  }

  return false;
}
