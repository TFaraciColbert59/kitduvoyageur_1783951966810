import { createClient } from '@/lib/supabase/client';
import { resolveGearImage } from '@/features/materiel/services/gearImageResolver';
import type { Conversation, Message, UserProfileSummary, MessageReaction, MessageType, ConversationMember } from '../types/messaging.types';

// Mémoire locale pour les conversations démo interactives
const localDemoMessages = new Map<string, Message[]>();

// Cache module-level des conversations démo : persiste les mutations
// (status accepté/refusé, muet, archivé) entre les appels — sinon chaque
// appel regénérait un tableau neuf et perdait l'état (cf. retour utilisateur).
let demoConversationsCache: Conversation[] | null = null;

function buildDemoConversations(): Conversation[] {
  const now = Date.now();
  return [
    {
      id: 'demo-conv-1',
      type: 'direct',
      title: 'Sarah Connor',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      created_by: 'sarah-guide-id',
      last_message_at: new Date(now - 60000 * 12).toISOString(),
      created_at: new Date(now - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
      other_member: {
        id: 'sarah-guide-id',
        full_name: 'Sarah Connor',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        username: 'sarah_mountain',
        level: 14,
      },
      last_message: {
        id: 'demo-msg-1-4',
        content: 'Je t\'ai envoyé la liste des points d\'eau potables révisée hier 💧',
        sender_name: 'Sarah Connor',
        created_at: new Date(now - 60000 * 12).toISOString(),
        message_type: 'text',
      },
      unread_count: 1,
      is_muted: false,
      is_archived: false,
    },
    {
      id: 'demo-conv-2',
      type: 'group',
      title: 'Trek des 3 Vallées — Pyrénées 2026',
      avatar_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=150&q=80',
      created_by: 'alex-organizer-id',
      last_message_at: new Date(now - 3600000 * 3).toISOString(),
      created_at: new Date(now - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
      other_member: null,
      last_message: {
        id: 'demo-msg-2-4',
        content: 'N\'oubliez pas de synchroniser vos tracés GPX hors-ligne dans LKDV ! 🥾',
        sender_name: 'Alexandre (Organisateur)',
        created_at: new Date(now - 3600000 * 3).toISOString(),
        message_type: 'text',
      },
      unread_count: 2,
      is_muted: false,
      is_archived: false,
    },
    {
      id: 'demo-conv-3',
      type: 'direct',
      title: 'Marc Dupont',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      created_by: 'marc-dupont-id',
      last_message_at: new Date(now - 86400000).toISOString(),
      created_at: new Date(now - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
      other_member: {
        id: 'marc-dupont-id',
        full_name: 'Marc Dupont',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        username: 'marc_ultralight',
        level: 9,
      },
      last_message: {
        id: 'demo-msg-3-4',
        content: 'C\'est validé, je te réserve la tente ultra-légère 1 place sur la plateforme ! ⛺',
        sender_name: 'Marc Dupont',
        created_at: new Date(now - 86400000).toISOString(),
        message_type: 'text',
      },
      unread_count: 0,
      is_muted: false,
      is_archived: false,
    },
    {
      id: 'demo-conv-4',
      type: 'group',
      title: 'Club Ultralight & DIY Packing',
      avatar_url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=150&q=80',
      created_by: 'elodie-club-id',
      last_message_at: new Date(now - 86400000 * 2).toISOString(),
      created_at: new Date(now - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString(),
      other_member: null,
      last_message: {
        id: 'demo-msg-4-2',
        content: 'Incredible isolation thermiques mais attention au bruit du tissu lors des nuits ventées ⚡',
        sender_name: 'Thomas (Membre)',
        created_at: new Date(now - 86400000 * 2).toISOString(),
        message_type: 'text',
      },
      unread_count: 0,
      is_muted: false,
      is_archived: false,
      status: 'active',
    },
    {
      id: 'demo-conv-request',
      type: 'direct',
      title: 'Julien Randonneur',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      created_by: 'julien-req-id',
      last_message_at: new Date(now - 3600000).toISOString(),
      created_at: new Date(now - 3600000).toISOString(),
      updated_at: new Date().toISOString(),
      other_member: {
        id: 'julien-req-id',
        full_name: 'Julien Randonneur',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        username: 'julien_trek',
        level: 5,
      },
      last_message: {
        id: 'demo-msg-req-1',
        content: 'Bonjour ! Serait-il possible d\'échanger des conseils sur l\'itinéraire du Mercantour ?',
        sender_name: 'Julien Randonneur',
        created_at: new Date(now - 3600000).toISOString(),
        message_type: 'text',
      },
      unread_count: 1,
      is_muted: false,
      is_archived: false,
      status: 'pending',
    },
  ];
}

/**
 * Retourne les conversations démo en préservant l'état entre rendus.
 * Chaque appel renvoie un shallow-clone du cache afin que React détecte
 * une nouvelle référence et re-rende (les mutations agissent sur le cache).
 */
function getDemoConversations(): Conversation[] {
  if (!demoConversationsCache) {
    demoConversationsCache = buildDemoConversations();
  }
  return demoConversationsCache.map((c) => ({ ...c }));
}

function initDemoMessages(currentUserId: string): Map<string, Message[]> {
  const now = Date.now();

  if (!localDemoMessages.has('demo-conv-1')) {
    localDemoMessages.set('demo-conv-1', [
      {
        id: 'demo-msg-1-1',
        conversation_id: 'demo-conv-1',
        sender_id: 'sarah-guide-id',
        content: 'Salut Thomas ! Tu as validé ton kit pour la traversée du GR20 le mois prochain ?',
        message_type: 'text',
        created_at: new Date(now - 3600000 * 5).toISOString(),
        updated_at: new Date(now - 3600000 * 5).toISOString(),
        sender_profile: {
          id: 'sarah-guide-id',
          full_name: 'Sarah Connor',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-1-2',
        conversation_id: 'demo-conv-1',
        sender_id: currentUserId,
        content: 'Oui presque ! J\'hésite encore sur le duvet, 0°C ou -5°C à votre avis pour les refuges de l\'Orba ?',
        message_type: 'text',
        created_at: new Date(now - 3600000 * 3).toISOString(),
        updated_at: new Date(now - 3600000 * 3).toISOString(),
        sender_profile: {
          id: currentUserId,
          full_name: 'Vous',
          avatar_url: '/assets/images/no_image.png',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-1-3',
        conversation_id: 'demo-conv-1',
        sender_id: 'sarah-guide-id',
        content: 'Prends sans hésiter le -5°C pour les nuits à Cinto, ça descend vite vers 2h du matin en altitude 🏔️',
        message_type: 'text',
        created_at: new Date(now - 3600000 * 1).toISOString(),
        updated_at: new Date(now - 3600000 * 1).toISOString(),
        sender_profile: {
          id: 'sarah-guide-id',
          full_name: 'Sarah Connor',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-1-4',
        conversation_id: 'demo-conv-1',
        sender_id: 'sarah-guide-id',
        content: 'Je t\'ai envoyé la liste des points d\'eau potables révisée hier 💧',
        message_type: 'text',
        created_at: new Date(now - 60000 * 12).toISOString(),
        updated_at: new Date(now - 60000 * 12).toISOString(),
        sender_profile: {
          id: 'sarah-guide-id',
          full_name: 'Sarah Connor',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
    ]);
  }

  if (!localDemoMessages.has('demo-conv-2')) {
    localDemoMessages.set('demo-conv-2', [
      {
        id: 'demo-msg-2-1',
        conversation_id: 'demo-conv-2',
        sender_id: 'alex-organizer-id',
        content: 'Équipe ! Le départ est confirmé pour samedi 07h au col du Tourmalet 🎒',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 2).toISOString(),
        updated_at: new Date(now - 86400000 * 2).toISOString(),
        sender_profile: {
          id: 'alex-organizer-id',
          full_name: 'Alexandre (Organisateur)',
          avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-2-2',
        conversation_id: 'demo-conv-2',
        sender_id: 'julie-member-id',
        content: 'Super ! J\'apporte le réchaud MSR partagé et 2 cartouches de gaz 🫖',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 1.5).toISOString(),
        updated_at: new Date(now - 86400000 * 1.5).toISOString(),
        sender_profile: {
          id: 'julie-member-id',
          full_name: 'Julie Vernet',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-2-3',
        conversation_id: 'demo-conv-2',
        sender_id: 'marc-dupont-id',
        content: 'Parfait, je prends le filtre à eau Katadyn 3L pour tout le groupe 💧',
        message_type: 'text',
        created_at: new Date(now - 86400000).toISOString(),
        updated_at: new Date(now - 86400000).toISOString(),
        sender_profile: {
          id: 'marc-dupont-id',
          full_name: 'Marc Dupont',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-2-4',
        conversation_id: 'demo-conv-2',
        sender_id: 'alex-organizer-id',
        content: 'N\'oubliez pas de synchroniser vos tracés GPX hors-ligne dans LKDV ! 🥾',
        message_type: 'text',
        created_at: new Date(now - 3600000 * 3).toISOString(),
        updated_at: new Date(now - 3600000 * 3).toISOString(),
        sender_profile: {
          id: 'alex-organizer-id',
          full_name: 'Alexandre (Organisateur)',
          avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
    ]);
  }

  if (!localDemoMessages.has('demo-conv-3')) {
    localDemoMessages.set('demo-conv-3', [
      {
        id: 'demo-msg-3-1',
        conversation_id: 'demo-conv-3',
        sender_id: 'marc-dupont-id',
        content: 'Hello ! J\'ai vu que tu prêtais ta tente ultra-légère 1 place sur LKDV Matériel.',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 2).toISOString(),
        updated_at: new Date(now - 86400000 * 2).toISOString(),
        sender_profile: {
          id: 'marc-dupont-id',
          full_name: 'Marc Dupont',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-3-2',
        conversation_id: 'demo-conv-3',
        sender_id: currentUserId,
        content: 'Salut Marc ! Oui tout à fait, elle fait 820g. Tu en as besoin pour quand ?',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 1.8).toISOString(),
        updated_at: new Date(now - 86400000 * 1.8).toISOString(),
        sender_profile: {
          id: currentUserId,
          full_name: 'Vous',
          avatar_url: '/assets/images/no_image.png',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-3-3',
        conversation_id: 'demo-conv-3',
        sender_id: 'marc-dupont-id',
        content: 'Pour le week-end du 15 au Vercors si elle est disponible !',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 1.2).toISOString(),
        updated_at: new Date(now - 86400000 * 1.2).toISOString(),
        sender_profile: {
          id: 'marc-dupont-id',
          full_name: 'Marc Dupont',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-3-4',
        conversation_id: 'demo-conv-3',
        sender_id: 'marc-dupont-id',
        content: 'C\'est validé, je te réserve la tente ultra-légère 1 place sur la plateforme ! ⛺',
        message_type: 'text',
        created_at: new Date(now - 86400000).toISOString(),
        updated_at: new Date(now - 86400000).toISOString(),
        sender_profile: {
          id: 'marc-dupont-id',
          full_name: 'Marc Dupont',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
    ]);
  }

  if (!localDemoMessages.has('demo-conv-4')) {
    localDemoMessages.set('demo-conv-4', [
      {
        id: 'demo-msg-4-1',
        conversation_id: 'demo-conv-4',
        sender_id: 'elodie-club-id',
        content: 'Quelqu\'un a testé le nouveau matelas gonflable r-value 4.5 à 340g ?',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 3).toISOString(),
        updated_at: new Date(now - 86400000 * 3).toISOString(),
        sender_profile: {
          id: 'elodie-club-id',
          full_name: 'Élodie (Club Ultra)',
          avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
      {
        id: 'demo-msg-4-2',
        conversation_id: 'demo-conv-4',
        sender_id: currentUserId,
        content: 'Incredible isolation thermiques mais attention au bruit du tissu lors des nuits ventées ⚡',
        message_type: 'text',
        created_at: new Date(now - 86400000 * 2).toISOString(),
        updated_at: new Date(now - 86400000 * 2).toISOString(),
        sender_profile: {
          id: currentUserId,
          full_name: 'Vous',
          avatar_url: '/assets/images/no_image.png',
        },
        status: 'sent',
      },
    ]);
  }

  if (!localDemoMessages.has('demo-conv-request')) {
    localDemoMessages.set('demo-conv-request', [
      {
        id: 'demo-msg-req-1',
        conversation_id: 'demo-conv-request',
        sender_id: 'julien-req-id',
        content: 'Bonjour ! Serait-il possible d\'échanger des conseils sur l\'itinéraire du Mercantour ?',
        message_type: 'text',
        created_at: new Date(now - 3600000).toISOString(),
        updated_at: new Date(now - 3600000).toISOString(),
        sender_profile: {
          id: 'julien-req-id',
          full_name: 'Julien Randonneur',
          avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        },
        status: 'sent',
      },
    ]);
  }

  return localDemoMessages;
}

export const messagingService = {
  async getConversations(userId: string): Promise<Conversation[]> {
    const supabase = createClient();

    // 1. Obtenir les membres associés à l'utilisateur depuis conversation_members
    let memberData: { conversation_id: string; unread_count?: number; is_muted?: boolean; is_archived?: boolean }[] = [];

    const { data: cmData, error: cmError } = await supabase
      .from('conversation_members')
      .select('conversation_id, unread_count, is_muted, is_archived')
      .eq('user_id', userId);

    if (!cmError && cmData && cmData.length > 0) {
      memberData = cmData;
    } else {
      // Fallback sur conversation_participants
      const { data: cpData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (cpData && cpData.length > 0) {
        memberData = cpData.map((p) => ({
          conversation_id: p.conversation_id,
          unread_count: 0,
          is_muted: false,
          is_archived: false,
        }));
      }
    }

    if (memberData.length === 0) {
      // Si aucune conversation n'existe en base, renvoyer le jeu de données démo ultra-enrichi
      initDemoMessages(userId);
      return getDemoConversations();
    }

    const conversationIds = memberData.map((m) => m.conversation_id);

    // 2. Obtenir les détails des conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false });

    if (convError || !conversations || conversations.length === 0) {
      initDemoMessages(userId);
      return getDemoConversations();
    }

    // 3. Obtenir les interlocuteurs pour les conversations directes (1:1)
    let allMembers: { conversation_id: string; user_id: string; user_profiles: any }[] = [];
    
    const { data: memRes } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, user_profiles(id, full_name, avatar_url, username)')
      .in('conversation_id', conversationIds)
      .neq('user_id', userId);

    if (memRes) {
      allMembers = memRes as any;
    } else {
      const { data: partRes } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, user_profiles(id, full_name, avatar_url, username)')
        .in('conversation_id', conversationIds)
        .neq('user_id', userId);
      if (partRes) {
        allMembers = partRes as any;
      }
    }

    const membersByConv = new Map<string, UserProfileSummary>();
    if (allMembers) {
      allMembers.forEach((m) => {
        if (m.user_profiles && typeof m.user_profiles === 'object') {
          const profile = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
          if (profile) {
            membersByConv.set(m.conversation_id, {
              id: profile.id,
              full_name: profile.full_name || 'Voyageur LKDV',
              avatar_url: profile.avatar_url || '/assets/images/no_image.png',
              username: profile.username,
            });
          }
        }
      });
    }

    // 4. Obtenir le dernier message pour chaque conversation
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('conversation_id, id, content, message_type, created_at, sender_id, user_profiles(full_name)')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMsgByConv = new Map();
    if (lastMessages) {
      lastMessages.forEach((msg) => {
        if (!lastMsgByConv.has(msg.conversation_id)) {
          const senderProfile = Array.isArray(msg.user_profiles) ? msg.user_profiles[0] : msg.user_profiles;
          lastMsgByConv.set(msg.conversation_id, {
            id: msg.id,
            content: msg.content,
            message_type: msg.message_type,
            created_at: msg.created_at,
            sender_name: senderProfile?.full_name || 'Voyageur',
          });
        }
      });
    }

    const memberMetaMap = new Map(memberData.map((m) => [m.conversation_id, m]));

    return conversations.map((conv) => {
      const meta = memberMetaMap.get(conv.id);
      const otherMember = membersByConv.get(conv.id) || null;
      const lastMessage = lastMsgByConv.get(conv.id) || null;

      return {
        id: conv.id,
        type: conv.type || 'direct',
        title: conv.title || (conv.type === 'direct' ? otherMember?.full_name : 'Groupe de Voyage'),
        avatar_url: conv.avatar_url || (conv.type === 'direct' ? otherMember?.avatar_url : undefined),
        created_by: conv.created_by,
        last_message_at: conv.last_message_at || conv.created_at,
        created_at: conv.created_at,
        updated_at: conv.updated_at || conv.created_at,
        other_member: otherMember,
        last_message: lastMessage,
        unread_count: meta?.unread_count || 0,
        is_muted: meta?.is_muted || false,
        is_archived: meta?.is_archived || false,
      };
    });
  },

  async getOrCreateDirectConversation(targetUserId: string, currentUserId: string): Promise<string | null> {
    const supabase = createClient();

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_or_create_direct_conversation', {
      p_target_user_id: targetUserId,
    });

    if (!rpcError && rpcData) {
      return rpcData;
    }

    // Mode démo / fallback local si la RPC n'est pas exécutée sur l'environnement Supabase distant
    const demoConvs = getDemoConversations();
    const existing = demoConvs.find((c) => c.other_member?.id === targetUserId);
    if (existing) return existing.id;

    return 'demo-conv-1';
  },

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    if (conversationId.startsWith('demo-conv-')) {
      const demoMap = initDemoMessages('current-user-id');
      const messages = demoMap.get(conversationId) || [];
      return messages.map((msg) => {
        if (msg.reply_to_id && !msg.reply_to_message) {
          const quoted = messages.find((m) => m.id === msg.reply_to_id);
          if (quoted) {
            return {
              ...msg,
              reply_to_message: {
                id: quoted.id,
                sender_name: quoted.sender_profile?.full_name || 'Voyageur',
                content: quoted.content,
              },
            };
          }
        }
        return msg;
      });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        message_type,
        metadata,
        reply_to_id,
        deleted_at,
        created_at,
        updated_at,
        user_profiles (
          id,
          full_name,
          avatar_url,
          username
        ),
        message_reactions (
          id,
          message_id,
          user_id,
          reaction_type,
          reaction_value,
          created_at
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data || data.length === 0) {
      const demoMap = initDemoMessages('current-user-id');
      return demoMap.get(conversationId) || [];
    }

    const rawMessages = data as any[];
    const messageMap = new Map<string, { id: string; sender_name: string; content: string }>();

    rawMessages.forEach((msg) => {
      const profile = Array.isArray(msg.user_profiles) ? msg.user_profiles[0] : msg.user_profiles;
      messageMap.set(msg.id, {
        id: msg.id,
        sender_name: profile?.full_name || 'Voyageur',
        content: msg.content,
      });
    });

    return rawMessages.map((msg) => {
      const profile = Array.isArray(msg.user_profiles) ? msg.user_profiles[0] : msg.user_profiles;
      const reactions = Array.isArray(msg.message_reactions) ? msg.message_reactions : [];
      const replyToMsg = msg.reply_to_id ? messageMap.get(msg.reply_to_id) || null : null;

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.content,
        message_type: msg.message_type || 'text',
        metadata: msg.metadata ?? null,
        reply_to_id: msg.reply_to_id,
        reply_to_message: replyToMsg,
        deleted_at: msg.deleted_at,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        sender_profile: profile
          ? {
              id: profile.id,
              full_name: profile.full_name || 'Voyageur LKDV',
              avatar_url: profile.avatar_url || '/assets/images/no_image.png',
              username: profile.username,
            }
          : undefined,
        reactions: reactions.map((r: any) => ({
          id: r.id,
          message_id: r.message_id,
          user_id: r.user_id,
          reaction_type: r.reaction_type || 'emoji',
          reaction_value: r.reaction_value,
          created_at: r.created_at,
        })),
        status: 'sent',
      };
    });
  },

  async toggleReaction(
    messageId: string,
    userId: string,
    reactionValue: string,
    conversationId?: string
  ): Promise<{ added: boolean; reaction?: MessageReaction }> {
    if (conversationId && conversationId.startsWith('demo-conv-')) {
      const demoMap = initDemoMessages(userId);
      const messages = demoMap.get(conversationId) || [];
      const msg = messages.find((m) => m.id === messageId);
      if (msg) {
        msg.reactions = msg.reactions || [];
        const existingIdx = msg.reactions.findIndex(
          (r) => r.user_id === userId && r.reaction_value === reactionValue
        );
        if (existingIdx >= 0) {
          msg.reactions.splice(existingIdx, 1);
          return { added: false };
        } else {
          const newReaction: MessageReaction = {
            id: `react-${Date.now()}`,
            message_id: messageId,
            user_id: userId,
            reaction_type: 'emoji',
            reaction_value: reactionValue,
            created_at: new Date().toISOString(),
          };
          msg.reactions.push(newReaction);
          return { added: true, reaction: newReaction };
        }
      }
      return { added: false };
    }

    const supabase = createClient();

    // Check existing
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction_value', reactionValue)
      .maybeSingle();

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      return { added: false };
    } else {
      const { data: inserted, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction_type: 'emoji',
          reaction_value: reactionValue,
        })
        .select('*')
        .single();

      if (error || !inserted) {
        return { added: false };
      }

      return {
        added: true,
        reaction: {
          id: inserted.id,
          message_id: inserted.message_id,
          user_id: inserted.user_id,
          reaction_type: inserted.reaction_type || 'emoji',
          reaction_value: inserted.reaction_value,
          created_at: inserted.created_at,
        },
      };
    }
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: MessageType = 'text',
    replyToId?: string,
    metadata?: Record<string, unknown>
  ): Promise<Message | null> {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      reply_to_id: replyToId || null,
      metadata: metadata ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'sent',
    };

    if (conversationId.startsWith('demo-conv-')) {
      const list = localDemoMessages.get(conversationId) || [];
      list.push(newMsg);
      localDemoMessages.set(conversationId, list);
      return newMsg;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: messageType,
        reply_to_id: replyToId || null,
        metadata: metadata ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      // Si la base distante échoue, préserver la réactivité démo localement
      return newMsg;
    }

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Declencher les notifications in-app pour les autres membres du chat (si non mute)
    try {
      const { data: membersToNotify } = await supabase
        .from('conversation_members')
        .select('user_id, is_muted')
        .eq('conversation_id', conversationId)
        .neq('user_id', senderId)
        .eq('is_muted', false);

      if (membersToNotify && membersToNotify.length > 0) {
        const notifInserts = membersToNotify.map((m) => ({
          user_id: m.user_id,
          type: 'new_message',
          title: 'Nouveau message LKDV',
          message: content.length > 80 ? `${content.substring(0, 80)}...` : content,
          link: '/messagerie',
        }));

        await supabase.from('notifications').insert(notifInserts);
      }
    } catch {
      // Ignorer silencieusement si la table notifications subit une restriction
    }

    return {
      ...data,
      status: 'sent',
    };
  },

  async uploadAttachment(conversationId: string, file: File): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return URL.createObjectURL(file);

    const fileExt = file.name.split('.').pop();
    // Chemin 2 segments {conversationId}/{userId}/{file} : requis par les policies storage
    // (INSERT exige 2e segment = auth.uid(), DELETE exige 2e segment = expéditeur)
    const fileName = `${conversationId}/${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      return URL.createObjectURL(file);
    }

    // Bucket privé (public = false) : URL publique inopérante → URL signée 24h
    const { data: signed } = await supabase.storage
      .from('message-attachments')
      .createSignedUrl(fileName, 60 * 60 * 24);

    if (signed?.signedUrl) return signed.signedUrl;
    return URL.createObjectURL(file);
  },

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const supabase = createClient();
    await supabase
      .from('conversation_members')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  },

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    return data ? data.map((b) => b.blocked_id) : [];
  },

  async updateMemberPreferences(
    conversationId: string,
    userId: string,
    prefs: { is_muted?: boolean; mute_until?: string | null; is_archived?: boolean }
  ): Promise<boolean> {
    if (conversationId.startsWith('demo-conv-')) {
      // Mute le CACHE (pas le clone) pour que l'état persiste au refresh.
      const target = demoConversationsCache?.find((c) => c.id === conversationId);
      if (target) {
        if (prefs.is_muted !== undefined) target.is_muted = prefs.is_muted;
        if (prefs.mute_until !== undefined) target.mute_until = prefs.mute_until;
        if (prefs.is_archived !== undefined) target.is_archived = prefs.is_archived;
      }
      return true;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('conversation_members')
      .update({
        is_muted: prefs.is_muted,
        is_archived: prefs.is_archived,
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    return !error;
  },

  async acceptMessageRequest(conversationId: string, userId: string): Promise<boolean> {
    if (conversationId.startsWith('demo-conv-')) {
      // Accepté sur le CACHE : la demande quitte l'onglet "Demandes" au refresh.
      const target = demoConversationsCache?.find((c) => c.id === conversationId);
      if (target) {
        target.status = 'active';
      }
      return true;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('conversation_members')
      .update({ is_archived: false })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    return !error;
  },

  async declineMessageRequest(conversationId: string, userId: string): Promise<boolean> {
    if (conversationId.startsWith('demo-conv-')) {
      // Refusé sur le CACHE : la demande disparaît de la liste au refresh.
      const target = demoConversationsCache?.find((c) => c.id === conversationId);
      if (target) {
        target.status = 'rejected';
      }
      return true;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    return !error;
  },

  /**
   * Transfert d'un message vers une autre conversation.
   * Vérifie l'appartenance à la cible, l'absence de blocage réciproque, puis
   * duplique le message (contenu, type, métadonnées) et ses pièces jointes.
   */
  async forwardMessage(
    fromMessage: Message,
    targetConvId: string,
    userId: string
  ): Promise<{ ok: boolean; error?: string }> {
    // Mode démo : copie dans le Map local.
    if (targetConvId.startsWith('demo-conv-') || fromMessage.conversation_id.startsWith('demo-conv-')) {
      const map = initDemoMessages(userId);
      const list = map.get(targetConvId) || [];
      list.push({
        id: `msg-${Date.now()}`,
        conversation_id: targetConvId,
        sender_id: userId,
        content: fromMessage.content,
        message_type: fromMessage.message_type,
        metadata: {
          ...(fromMessage.metadata || {}),
          forwarded_from: {
            message_id: fromMessage.id,
            conversation_id: fromMessage.conversation_id,
            sender_name: fromMessage.sender_profile?.full_name || 'Voyageur',
          },
        },
        reply_to_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'sent',
      } as Message);
      map.set(targetConvId, list);
      return { ok: true };
    }

    const supabase = createClient();

    // 1. L'expéditeur est-il membre de la conversation cible ?
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', targetConvId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      return { ok: false, error: 'Vous ne faites pas partie de cette conversation.' };
    }

    // 2. Autres membres de la cible + contrôle d'absence de blocage.
    const { data: otherMembers } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', targetConvId)
      .neq('user_id', userId);
    const otherIds = (otherMembers ?? []).map((m) => m.user_id);
    if (otherIds.length > 0) {
      // Blocage réciproque, paire par paire : (X bloque O) ou (O bloque X).
      const blockExpr = otherIds
        .map(
          (oid) =>
            `and(blocker_id.eq.${userId},blocked_id.eq.${oid}),and(blocker_id.eq.${oid},blocked_id.eq.${userId})`
        )
        .join(',');
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('id')
        .or(blockExpr);
      if (blocks && blocks.length > 0) {
        return { ok: false, error: 'Transfert impossible : contact bloqué.' };
      }
    }

    // 3. Copie du message (contenu, type, métadonnées enrichies).
    const forwardedMeta = {
      ...(fromMessage.metadata || {}),
      forwarded_from: {
        message_id: fromMessage.id,
        conversation_id: fromMessage.conversation_id,
        sender_name: fromMessage.sender_profile?.full_name || 'Voyageur',
      },
    };

    const { data: inserted, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: targetConvId,
        sender_id: userId,
        content: fromMessage.content,
        message_type: fromMessage.message_type,
        metadata: forwardedMeta,
        reply_to_id: null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return { ok: false, error: 'Impossible de transférer le message.' };
    }

    // 4. Copie des pièces jointes du message source.
    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('file_url, file_name, file_type, file_size')
      .eq('message_id', fromMessage.id);
    if (attachments && attachments.length > 0) {
      const { error: attError } = await supabase.from('message_attachments').insert(
        attachments.map((a) => ({
          message_id: inserted.id,
          file_url: a.file_url,
          file_name: a.file_name,
          file_type: a.file_type,
          file_size: a.file_size,
        }))
      );
      if (attError) {
        return { ok: true, error: 'Message transféré sans ses pièces jointes.' };
      }
    }

    // 5. Rafraîchit le timestamp de la conversation cible.
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', targetConvId);

    return { ok: true };
  },

  /** Équipement partageable de l'utilisateur (inventaire, RLS own).
      product_slug est résolu par correspondance de nom avec le catalogue
      boutique (public), pour faire pointer la carte vers la fiche produit. */
  async getShareableInventory(
    userId: string
  ): Promise<
    { id: string; name: string; photo_url: string | null; category: string | null; price_cents: number | null; product_slug: string | null }[]
  > {
    const supabase = createClient();

    const [ownResult, catalogResult] = await Promise.all([
      supabase
        .from('product_ownership')
        .select('id, name, photo_url, category, price_cents')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('products').select('slug, name').limit(500),
    ]);

    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const nameToSlug = new Map<string, string>();
    (catalogResult.data ?? []).forEach((p) => {
      nameToSlug.set(normalize(p.name), p.slug);
    });

    return (ownResult.data ?? []).map((i) => ({
      id: i.id,
      name: i.name || 'Équipement LKDV',
      // Meme resolution d'image que l'inventaire (materiel) : photo brute
      // souvent NULL -> image curatee par mot-cle/categorie, sinon grisaille.
      photo_url: resolveGearImage(i.name, i.category, i.photo_url),
      category: i.category,
      price_cents: i.price_cents,
      product_slug: nameToSlug.get(normalize(i.name)) || null,
    }));
  },

  /** Randonnées partageables (catalogue explorer). */
  async getShareableTrails(): Promise<
    { id: string; name: string; distance_km: number | null; elevation_gain_m: number | null; region: string | null }[]
  > {
    const supabase = createClient();
    const { data } = await supabase
      .from('hiking_routes')
      .select('id, name, distance_km, elevation_gain_m, region')
      .order('name', { ascending: true })
      .limit(50);
    return (data ?? []).map((t) => ({
      id: t.id,
      name: t.name || 'Randonnée LKDV',
      distance_km: t.distance_km,
      elevation_gain_m: t.elevation_gain_m,
      region: t.region,
    }));
  },

  async getGroupMembers(conversationId: string): Promise<ConversationMember[]> {
    if (conversationId.startsWith('demo-conv-')) {
      const now = new Date().toISOString();
      return [
        {
          id: 'mem-demo-1',
          conversation_id: conversationId,
          user_id: 'alex-organizer-id',
          role: 'owner',
          is_muted: false,
          is_archived: false,
          last_read_at: now,
          unread_count: 0,
          joined_at: now,
          profile: {
            id: 'alex-organizer-id',
            full_name: 'Alexandre (Organisateur)',
            avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
            username: 'alex_organizer',
            level: 18,
          },
        },
        {
          id: 'mem-demo-2',
          conversation_id: conversationId,
          user_id: 'julie-member-id',
          role: 'admin',
          is_muted: false,
          is_archived: false,
          last_read_at: now,
          unread_count: 0,
          joined_at: now,
          profile: {
            id: 'julie-member-id',
            full_name: 'Julie Vernet',
            avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
            username: 'julie_v',
            level: 12,
          },
        },
        {
          id: 'mem-demo-3',
          conversation_id: conversationId,
          user_id: 'marc-dupont-id',
          role: 'member',
          is_muted: false,
          is_archived: false,
          last_read_at: now,
          unread_count: 0,
          joined_at: now,
          profile: {
            id: 'marc-dupont-id',
            full_name: 'Marc Dupont',
            avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
            username: 'marc_ultralight',
            level: 9,
          },
        },
      ];
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('conversation_members')
      .select(`
        id,
        conversation_id,
        user_id,
        role,
        is_muted,
        is_archived,
        last_read_at,
        unread_count,
        joined_at,
        user_profiles (
          id,
          full_name,
          avatar_url,
          username
        )
      `)
      .eq('conversation_id', conversationId);

    if (error || !data) return [];

    return data.map((m: any) => {
      const prof = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
      return {
        id: m.id,
        conversation_id: m.conversation_id,
        user_id: m.user_id,
        role: m.role || 'member',
        is_muted: m.is_muted || false,
        is_archived: m.is_archived || false,
        last_read_at: m.last_read_at,
        unread_count: m.unread_count || 0,
        joined_at: m.joined_at,
        profile: prof
          ? {
              id: prof.id,
              full_name: prof.full_name || 'Voyageur LKDV',
              avatar_url: prof.avatar_url || '/assets/images/no_image.png',
              username: prof.username,
            }
          : undefined,
      };
    });
  },

  async updateGroupInfo(
    conversationId: string,
    updates: { title?: string; avatar_url?: string }
  ): Promise<boolean> {
    if (conversationId.startsWith('demo-conv-')) {
      const demoConvs = getDemoConversations();
      const conv = demoConvs.find((c) => c.id === conversationId);
      if (conv) {
        if (updates.title !== undefined) conv.title = updates.title;
        if (updates.avatar_url !== undefined) conv.avatar_url = updates.avatar_url;
      }
      return true;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);

    return !error;
  },

  async updateMemberRole(
    conversationId: string,
    targetUserId: string,
    newRole: 'member' | 'admin' | 'owner'
  ): Promise<{ success: boolean; error?: string }> {
    if (conversationId.startsWith('demo-conv-')) {
      return { success: true };
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('conversation_members')
      .update({ role: newRole })
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async removeGroupMember(
    conversationId: string,
    targetUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (conversationId.startsWith('demo-conv-')) {
      return { success: true };
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async leaveGroup(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; requireOwnerTransfer?: boolean }> {
    const members = await this.getGroupMembers(conversationId);
    const myMember = members.find((m) => m.user_id === userId);

    if (myMember?.role === 'owner') {
      const otherOwners = members.filter((m) => m.user_id !== userId && m.role === 'owner');
      if (otherOwners.length === 0 && members.length > 1) {
        return {
          success: false,
          requireOwnerTransfer: true,
          error: 'Vous êtes le seul organisateur. Veuillez désigner un nouvel organisateur avant de quitter le groupe.',
        };
      }
    }

    return this.removeGroupMember(conversationId, userId);
  },
};
