#!/usr/bin/env node
/**
 * Monde LKDV — seed idempotent.
 *
 *   node scripts/seed/world/run.mjs --dry-run
 *   node scripts/seed/world/run.mjs --apply
 *   node scripts/seed/world/run.mjs --only=carnets --apply
 *   node scripts/seed/world/run.mjs --verify
 *   node scripts/seed/world/run.mjs --refresh
 *   node scripts/seed/world/run.mjs --cleanup
 */
import { config, describeEnv } from './lib/env.mjs';
import { createClock } from './lib/time.mjs';
import { ensureAuthUser, upsertRows, insertRows, selectAll, updateRows, deleteIds } from './lib/client.mjs';
import { assertTables } from './lib/schema.mjs';
import { loadManifest, saveManifest, register, registerUser, writeCredentials } from './lib/manifest.mjs';
import { ALL_PEOPLE, RESIDENTS, DEMO_PERSONA, validateCasting } from './data/personas/index.mjs';
import { entityId as entityIdSafe } from './lib/ids.mjs';
import { buildIdentity, passwordFor } from './build/identity.mjs';
import { buildSocial } from './build/social.mjs';
import { buildOutings } from './build/outings.mjs';
import { buildCarnets } from './build/carnets.mjs';
import { buildTrips } from './build/trips.mjs';
import { buildCommunity } from './build/community.mjs';
import { buildMessaging } from './build/messaging.mjs';
import { buildProfileExtras } from './build/profile-extras.mjs';
import { loadReference } from './build/reference.mjs';
import { uploadImage, signedUrl, uploadPdf, itineraryPdf } from './lib/media.mjs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1].split(',') : null;
const has = (name) => flags.has(`--${name}`);
const MODE = has('apply') ? 'apply' : has('verify') ? 'verify' : has('cleanup') ? 'cleanup' : has('refresh') ? 'refresh' : 'dry-run';
const PHASES = new Set(only ?? ['identity', 'carnets', 'social', 'outings', 'trips', 'community', 'messaging', 'extras']);

function banner() {
  console.log(`\n=== Monde LKDV — ${MODE.toUpperCase()} ===`);
  console.log(JSON.stringify(describeEnv(), null, 2));
  console.log(`Projet : ${config.url}`);
  console.log(`Phases : ${[...PHASES].join(', ')}\n`);
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const COLUMNS = {
  user_profiles: ['id', 'email', 'full_name', 'avatar_url', 'cover_url', 'bio', 'location', 'website', 'phone', 'trust_score', 'loyalty_points', 'loyalty_level', 'xp', 'level', 'role', 'notification_prefs', 'two_fa_enabled', 'is_suspended_groups', 'suspended_from_groups_at', 'age_confirmed_at', 'signature_visibility', 'is_demo', 'handle', 'profile_visibility', 'links', 'created_at', 'updated_at'],
  notification_preferences: ['user_id', 'notification_type', 'in_app_enabled', 'email_enabled', 'push_enabled', 'quiet_hours_start', 'quiet_hours_end', 'time_zone', 'created_at', 'updated_at'],
  user_traveller: ['user_id', 'nationality', 'residence_country', 'currency', 'language', 'time_zone', 'home_name', 'home_lat', 'home_lon', 'home_country', 'updated_at'],
  user_orientation: ['user_id', 'terrain', 'autonomy', 'priority', 'experience', 'source', 'updated_at'],
  user_addresses: ['id', 'user_id', 'label', 'full_name', 'street', 'city', 'is_default', 'created_at', 'updated_at'],
  user_documents: ['id', 'user_id', 'name', 'type', 'destination', 'expiry', 'file_name', 'created_at'],
  user_presence: ['user_id', 'last_seen_at'],
  user_follows: ['id', 'follower_id', 'following_id', 'created_at'],
  follow_requests: ['id', 'requester_id', 'target_id', 'status', 'created_at', 'responded_at'],
  user_blocks: ['id', 'blocker_id', 'blocked_id', 'created_at'],
  profile_views: ['profile_id', 'viewer_id', 'viewed_at'],
  story_close_friends: ['owner_id', 'friend_id', 'created_at'],
  carnets: ['id', 'author_id', 'title', 'destination', 'description', 'cover_image', 'cover_image_alt', 'start_date', 'end_date', 'weather', 'route_rating', 'visibility', 'tags', 'likes_count', 'comments_count', 'views_count', 'favorites_count', 'verified', 'created_at', 'updated_at', 'map_points', 'is_collaborative', 'distance_km', 'denivele_m', 'nb_nuits', 'nb_voyageurs', 'lieu_depart', 'lieu_arrivee', 'country_iso'],
  carnet_media: ['id', 'carnet_id', 'url', 'type', 'caption', 'position', 'created_at'],
  carnet_moments: ['id', 'carnet_id', 'jour_numero', 'heure', 'citation', 'auteur_nom', 'auteur_id', 'lieu', 'image_url', 'created_at', 'moment_timestamp', 'source'],
  carnet_likes: ['id', 'carnet_id', 'user_id', 'reaction', 'created_at'],
  carnet_favorites: ['id', 'carnet_id', 'user_id', 'created_at'],
  carnet_views: ['carnet_id', 'user_id', 'created_at'],
  carnet_comments: ['id', 'carnet_id', 'author_id', 'content', 'created_at'],
  carnet_kit_items: ['id', 'carnet_id', 'nom', 'poids_g', 'couleur_tag', 'sort_order'],
  community_posts: ['id', 'author_id', 'content', 'title', 'image_url', 'image_alt', 'media_urls', 'post_type', 'likes_count', 'comments_count', 'shares_count', 'is_trending', 'audience', 'club_id', 'created_at', 'updated_at'],
  post_comments: ['id', 'post_id', 'author_id', 'content', 'parent_id', 'created_at'],
  post_likes: ['id', 'post_id', 'user_id', 'created_at'],
  post_saves: ['id', 'post_id', 'user_id', 'created_at'],
  post_shares: ['id', 'post_id', 'user_id', 'created_at'],
  post_comment_likes: ['id', 'comment_id', 'user_id', 'created_at'],
  post_stories: ['id', 'author_id', 'image_url', 'caption', 'visibility', 'club_id', 'expires_at', 'created_at', 'media_type', 'status', 'moderation_state', 'reply_policy', 'allow_reshare', 'duration_ms', 'archived_at'],
  story_views: ['story_id', 'viewer_id', 'first_viewed_at', 'last_viewed_at'],
  story_likes: ['story_id', 'user_id', 'created_at'],
  story_highlights: ['id', 'owner_id', 'title', 'cover_story_id', 'position', 'created_at'],
  story_highlight_items: ['highlight_id', 'story_id', 'position', 'added_at'],
  hike_sessions: ['id', 'user_id', 'route_id', 'carnet_id', 'title', 'started_at', 'ended_at', 'distance_km', 'duration_seconds', 'elevation_gain_m', 'max_altitude_m', 'positions_geojson', 'positions_timed', 'poi_events', 'narratives', 'weather', 'notes', 'visibility', 'processing_status', 'processor_version', 'processed_at', 'track_quality', 'created_at', 'updated_at'],
  activities: ['id', 'user_id', 'hiking_route_id', 'title', 'started_at', 'ended_at', 'distance_km', 'duration_seconds', 'created_at'],
  hike_session_photos: ['id', 'session_id', 'user_id', 'storage_path', 'caption', 'position', 'created_at'],
  hike_session_participants: ['session_id', 'user_id', 'role', 'created_at'],
  hike_session_kudos: ['session_id', 'user_id', 'created_at'],
  hike_session_comments: ['id', 'session_id', 'user_id', 'body', 'parent_id', 'created_at'],
  hike_session_gear: ['id', 'session_id', 'item_name', 'weight_g', 'kit_id', 'created_at'],
  trips: ['id', 'slug', 'title', 'description', 'destination_country_code', 'destination_name', 'start_date', 'end_date', 'status', 'visibility', 'difficulty', 'primary_activity', 'estimated_budget', 'budget_currency', 'cover_image_url', 'user_id', 'group_id', 'crew_id', 'kit_id', 'party_size', 'metadata', 'created_at', 'updated_at'],
  trip_steps: ['id', 'trip_id', 'day_number', 'order_index', 'title', 'description', 'location_name', 'latitude', 'longitude', 'accommodation_name', 'transport_mode', 'distance_km', 'elevation_gain_m', 'elevation_loss_m', 'start_time', 'source', 'metadata', 'created_at', 'updated_at'],
  trip_items: ['id', 'trip_id', 'item_name', 'category', 'quantity', 'weight_grams', 'is_packed', 'status', 'packed_by', 'source', 'shop_product_id', 'priority', 'is_vital', 'is_worn', 'is_consumable', 'notes', 'purchase_state', 'day_number', 'ownership', 'created_at', 'updated_at'],
  trip_expenses: ['id', 'trip_id', 'payer_id', 'title', 'amount', 'currency', 'category', 'expense_date', 'split_type', 'is_planned', 'metadata', 'created_at', 'updated_at'],
  trip_notes: ['id', 'trip_id', 'author_id', 'title', 'content', 'day_number', 'is_pinned', 'created_at', 'updated_at'],
  trip_pois: ['id', 'trip_id', 'step_id', 'name', 'category', 'latitude', 'longitude', 'notes', 'visited', 'osm_id', 'source', 'metadata', 'created_at', 'updated_at'],
  trip_safety_checkpoints: ['id', 'trip_id', 'label', 'scheduled_at', 'checked_at', 'contact_phone', 'contact_name', 'status', 'notes', 'created_at', 'updated_at'],
  trip_collaborators: ['id', 'trip_id', 'user_id', 'role', 'joined_at', 'invited_by', 'created_at', 'updated_at'],
  trip_participants: ['trip_id', 'user_id', 'role', 'status', 'joined_at'],
  trip_invitations: ['id', 'trip_id', 'invitee_id', 'invited_by', 'role', 'status', 'source', 'token', 'expires_at', 'responded_at', 'created_at'],
  trip_documents: ['id', 'trip_id', 'user_id', 'title', 'category', 'file_url', 'file_name', 'file_size_bytes', 'mime_type', 'expires_at', 'notes', 'created_at', 'updated_at'],
  clubs: ['id', 'slug', 'name', 'type', 'emoji', 'description', 'cover_color', 'cover_image', 'category', 'privacy', 'members_count', 'active_this_month', 'is_verified', 'created_by', 'country_iso', 'created_at', 'updated_at'],
  club_members: ['id', 'club_id', 'user_id', 'role', 'status', 'joined_at'],
  club_topics: ['id', 'club_id', 'author_id', 'title', 'content', 'is_pinned', 'is_announcement', 'is_approved', 'likes_count', 'replies_count', 'reports_count', 'mentions', 'client_request_id', 'created_at', 'updated_at'],
  club_topic_replies: ['id', 'topic_id', 'author_id', 'content', 'is_approved', 'likes_count', 'parent_id', 'created_at'],
  club_topic_likes: ['topic_id', 'user_id', 'created_at'],
  club_events: ['id', 'club_id', 'organizer_id', 'title', 'description', 'event_date', 'location', 'max_participants', 'participants_count', 'created_at'],
  club_event_participants: ['event_id', 'user_id', 'joined_at'],
  events: ['id', 'title', 'type', 'emoji', 'organizer_id', 'event_date', 'duration', 'location', 'country', 'max_participants', 'current_participants', 'description', 'cover_image', 'cover_alt', 'shared_kitty', 'kitty_goal', 'min_trust_to_organize', 'status', 'created_at'],
  event_participants: ['event_id', 'user_id', 'created_at'],
  conversations: ['id', 'type', 'name', 'title', 'avatar', 'avatar_url', 'members_count', 'created_by', 'direct_pair_key', 'last_message_at', 'created_at', 'updated_at'],
  conversation_members: ['id', 'conversation_id', 'user_id', 'role', 'status', 'unread_count', 'is_muted', 'is_archived', 'last_read_at', 'joined_at', 'created_at', 'updated_at'],
  messages: ['id', 'conversation_id', 'sender_id', 'content', 'type', 'message_type', 'metadata', 'reply_to_id', 'deleted_at', 'created_at', 'updated_at'],
  message_reactions: ['id', 'message_id', 'user_id', 'reaction_type', 'reaction_value', 'created_at'],
  user_progression: ['user_id', 'lifetime_points', 'season_points', 'level', 'level_title', 'skill_explorer_points', 'skill_preparer_points', 'skill_partager_points', 'skill_entraider_points', 'city_name', 'department_code', 'region_name', 'country_code', 'postal_code', 'lat_approx', 'lng_approx', 'territory_lock_until', 'current_challenge_id', 'challenge_progress', 'challenge_replaced_at', 'current_season_id', 'created_at', 'updated_at'],
  user_season_progress: ['user_id', 'season_id', 'season_points', 'skill_explorer_points', 'skill_preparer_points', 'skill_partager_points', 'skill_entraider_points', 'updated_at'],
  user_territory: ['user_id', 'country_code', 'city_code', 'region_code', 'city_name', 'source', 'updated_at'],
  user_territory_private: ['user_id', 'lat', 'lng', 'accuracy_m', 'consent_at', 'locked_until', 'updated_at'],
  user_badges: ['id', 'user_id', 'badge_id', 'earned_at'],
  user_challenges: ['id', 'user_id', 'challenge_id', 'progress', 'completed', 'completed_at', 'created_at'],
  materiel_kits: ['id', 'user_id', 'name', 'description', 'season', 'total_weight_g', 'is_public', 'is_favorite', 'is_trashed', 'cover_image_url', 'tags', 'origin', 'created_at', 'updated_at'],
  materiel_kit_items: ['id', 'kit_id', 'user_id', 'name', 'category', 'weight_g', 'quantity', 'is_checked', 'ownership', 'priority', 'created_at', 'updated_at'],
  product_ownership: ['id', 'user_id', 'name', 'brand', 'category', 'weight_g', 'price_cents', 'purchase_date', 'condition', 'photo_url', 'barcode', 'is_lent', 'maintenance_due_at', 'expiry_date', 'tags', 'quantity', 'product_id', 'serial_number', 'description', 'location', 'listing_mode', 'status', 'rental_price_cents', 'deposit_cents', 'created_at', 'updated_at'],
  orders: ['id', 'user_id', 'order_number', 'status', 'payment_method', 'shipping_address', 'items', 'subtotal_eur', 'shipping_eur', 'total_eur', 'loyalty_points_earned', 'notes', 'payment_state', 'paid_merchandise_cents', 'refunded_merchandise_cents', 'tracking_url', 'carrier', 'estimated_delivery', 'stripe_session_id', 'created_at', 'updated_at'],
  loyalty_history: ['id', 'user_id', 'action', 'points', 'type', 'source_id', 'created_at'],
  loyalty_rewards: ['id', 'title', 'description', 'points_cost', 'category', 'value', 'available', 'image', 'alt', 'expires_at', 'created_at'],
  loyalty_redemptions: ['id', 'user_id', 'reward_id', 'points_spent', 'status', 'created_at'],
};

async function applyIdentity(people, clock, manifest) {
  console.log('\n[Identité] Auth users…');
  const credentials = {};
  for (const person of people) {
    const password = person.isDemo ? config.demoPassword : passwordFor(person);
    const { user, created } = await ensureAuthUser({
      email: person.email,
      password,
      fullName: `${person.first} ${person.last}`,
      avatarUrl: person.avatar,
      resetPassword: person.isDemo,
    });
    person.id = user.id;
    registerUser(manifest, person.key, { ...user, created });
    credentials[person.key] = { email: person.email, password, isDemo: person.isDemo, userId: user.id };
    process.stdout.write(created ? '.' : '·');
  }
  console.log(`\n  ${people.length} comptes prêts.`);
  writeCredentials(config.seedBatch, credentials);

  const identity = buildIdentity({ people, clock });
  const steps = [
    ['user_profiles', identity.profiles, 'id'],
    ['notification_preferences', identity.notificationPreferences, 'user_id,notification_type'],
    ['user_traveller', identity.travellers, 'user_id'],
    ['user_orientation', identity.orientations, 'user_id'],
    ['user_addresses', identity.addresses, 'id'],
    ['user_documents', identity.documents, 'id'],
    ['user_presence', identity.presence, 'user_id'],
    ['user_follows', identity.follows, 'id'],
    ['follow_requests', identity.followRequests, 'id'],
    ['user_blocks', identity.blocks, 'id'],
    ['story_close_friends', identity.closeFriends, 'owner_id,friend_id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict });
    register(manifest, table, rows.map((r) => r.id ?? r.user_id ?? `${r.owner_id}:${r.friend_id}`));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  const existingViews = await selectAll('profile_views', 'profile_id,viewer_id', (q) => q.limit(1000));
  const seen = new Set(existingViews.map((r) => `${r.profile_id}:${r.viewer_id}`));
  const freshViews = identity.profileViews.filter((r) => !seen.has(`${r.profile_id}:${r.viewer_id}`));
  if (freshViews.length) await upsertRows('profile_views', freshViews, { batchSize: 200 });
  register(manifest, 'profile_views', freshViews.map((r) => `${r.profile_id}:${r.viewer_id}`));
  console.log(`  ✓ profile_views: ${freshViews.length}`);
  saveManifest(manifest);
  console.log(`  Compte démo : ${config.demoEmail} / ${config.demoPassword}`);
  return identity;
}

async function applyCarnets(people, identity, clock, manifest) {
  const refs = await loadReference();
  const data = buildCarnets({ people, identity, clock, refs });
  console.log(`\n[Carnets] ${data.stats.carnets} carnets, ${data.stats.media} médias.`);
  const steps = [
    ['carnets', data.carnets, 'id'],
    ['carnet_media', data.media, 'id'],
    ['carnet_moments', data.moments, 'id'],
    ['carnet_likes', data.likes, 'id'],
    ['carnet_favorites', data.favorites, 'id'],
    ['carnet_comments', data.comments, 'id'],
    ['carnet_kit_items', data.kitItems, 'id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    await upsertRows(table, rows, { onConflict });
    register(manifest, table, rows.map((r) => r.id));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  // Vues : pas de contrainte unique en base. On insère uniquement les
  // combinaisons (carnet, lecteur) encore absentes.
  const carnetIds = [...new Set(data.carnets.map((c) => c.id))];
  const existingViews = await selectAll('carnet_views', 'carnet_id,user_id', (q) => q.in('carnet_id', carnetIds));
  const seen = new Set(existingViews.map((r) => `${r.carnet_id}:${r.user_id}`));
  const freshViews = data.views.filter((r) => !seen.has(`${r.carnet_id}:${r.user_id}`));
  if (freshViews.length) await insertRows('carnet_views', freshViews, { batchSize: 200 });
  register(manifest, 'carnet_views', freshViews.map((r) => `${r.carnet_id}:${r.user_id}`));
  console.log(`  ✓ carnet_views: ${freshViews.length}`);
  saveManifest(manifest);
  return data;
}

async function applySocial(people, identity, clock, manifest) {
  const refs = await loadReference();
  const data = buildSocial({ people, identity, clock, refs });
  console.log(`\n[Social] ${data.stats.posts} posts, ${data.stats.likes} likes, ${data.stats.comments} commentaires, ${data.stats.stories} stories.`);
  const steps = [
    ['community_posts', data.posts, 'id'],
    ['post_comments', data.comments, 'id'],
    ['post_likes', data.postLikes, 'id'],
    ['post_saves', data.postSaves, 'id'],
    ['post_shares', data.postShares, 'id'],
    ['post_comment_likes', data.commentLikes, 'id'],
    ['post_stories', data.stories, 'id'],
    ['story_views', data.storyViews, 'story_id,viewer_id'],
    ['story_likes', data.storyLikes, 'story_id,user_id'],
    ['story_highlights', data.highlights, 'id'],
    ['story_highlight_items', data.highlightItems, 'highlight_id,story_id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict, batchSize: 150 });
    register(manifest, table, rows.map((r) => r.id ?? `${r.story_id}:${r.viewer_id ?? r.user_id}`));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  // shares_count n'a pas de trigger : on le recale depuis les lignes réelles.
  const shareCounts = new Map();
  for (const s of data.postShares) shareCounts.set(s.post_id, (shareCounts.get(s.post_id) ?? 0) + 1);
  for (const [postId, count] of shareCounts) {
    await updateRows('community_posts', { shares_count: count }, (q) => q.eq('id', postId));
  }
  saveManifest(manifest);
  return data;
}

async function applyOutings(people, identity, clock, manifest) {
  const refs = await loadReference();
  const data = buildOutings({ people, identity, clock, refs });
  console.log(`\n[Sorties] ${data.stats.sessions} sorties, ${data.stats.photos} photos.`);
  const steps = [
    ['hike_sessions', data.sessions, 'id'],
    ['activities', data.activities, 'id'],
    ['hike_session_participants', data.participants, 'session_id,user_id'],
    ['hike_session_kudos', data.kudos, 'session_id,user_id'],
    ['hike_session_comments', data.comments, 'id'],
    ['hike_session_gear', data.gear, 'id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict, batchSize: 150 });
    register(manifest, table, rows.map((r) => r.id ?? `${r.session_id}:${r.user_id}`));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }

  // Upload des photos dans le bucket privé outing-media, puis insertion.
  // On priorise la démo et les profils les plus visités : une photo sans objet
  // Storage produirait une URL signée cassée, donc on n'insère que celles
  // réellement uploadées.
  const priority = new Set(people.filter((p) => p.isDemo || p.level >= 30).map((p) => p.id));
  const candidates = data.photos.filter((photo) => priority.has(photo.user_id));
  const keptPhotos = [];
  for (const photo of candidates) {
    if (config.skipMedia) {
      keptPhotos.push(photo);
      continue;
    }
    try {
      await uploadImage({ bucket: 'outing-media', storagePath: photo.storage_path, url: photo.source_url });
      keptPhotos.push(photo);
      if (keptPhotos.length % 20 === 0) process.stdout.write('.');
    } catch (err) {
      console.warn(`  ⚠ photo ${photo.storage_path}: ${err.message}`);
    }
  }
  console.log(`\n  ${keptPhotos.length} photos prêtes dans outing-media.`);
  const photoRows = keptPhotos.map(({ source_url, ...row }) => row);
  await upsertRows('hike_session_photos', photoRows, { onConflict: 'id', batchSize: 150 });
  register(manifest, 'hike_session_photos', photoRows.map((r) => r.id));
  console.log(`  ✓ hike_session_photos: ${photoRows.length}`);
  saveManifest(manifest);
  return data;
}


async function applyTrips(people, identity, clock, manifest) {
  const refs = await loadReference();
  const data = buildTrips({ people, identity, clock, refs });
  console.log(`\n[Voyages] ${data.stats.trips} voyages, ${data.stats.steps} étapes.`);
  const steps = [
    ['trips', data.trips, 'id'],
    ['trip_steps', data.steps, 'id'],
    ['trip_items', data.items, 'id'],
    ['trip_expenses', data.expenses, 'id'],
    ['trip_notes', data.notes, 'id'],
    ['trip_pois', data.pois, 'id'],
    ['trip_safety_checkpoints', data.checkpoints, 'id'],
    ['trip_collaborators', data.collaborators, 'id'],
    ['trip_participants', data.participants, 'trip_id,user_id'],
    ['trip_invitations', data.invitations, 'id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict, batchSize: 120 });
    register(manifest, table, rows.map((r) => r.id ?? `${r.trip_id}:${r.user_id}`));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }

  // Documents PDF réels pour les voyages de la démo (URL signée longue durée).
  for (const plan of data.docPlans) {
    try {
      const file = `trips/${plan.key.replace(':', '-')}.pdf`;
      const buffer = itineraryPdf({
        title: plan.title,
        destination: plan.destination,
        days: plan.days,
        notes: data.steps.filter((s) => s.trip_id === plan.id).slice(0, 6).map((s) => `${s.title} (${s.location_name})`),
      });
      await uploadPdf({ bucket: 'user-documents', storagePath: file, buffer });
      const url = await signedUrl('user-documents', file, 31_536_000);
      const doc = {
        id: entityIdForDoc(plan.key),
        trip_id: plan.id,
        user_id: plan.userId,
        title: `Dossier — ${plan.title}`,
        category: 'other',
        file_url: url,
        file_name: `${plan.title}.pdf`,
        file_size_bytes: buffer.length,
        mime_type: 'application/pdf',
        expires_at: clock.daysFromNow(365).toISOString(),
        notes: 'Document de démonstration généré par le seed.',
        created_at: clock.daysAgo(10).toISOString(),
        updated_at: clock.daysAgo(10).toISOString(),
      };
      await upsertRows('trip_documents', [doc], { onConflict: 'id' });
      register(manifest, 'trip_documents', [doc.id]);
      console.log(`  ✓ trip_documents: 1`);
    } catch (err) {
      console.warn(`  ⚠ document ${plan.key}: ${err.message}`);
    }
  }

  // Coche une partie de la checklist auto-générée par le trigger.
  const tripIds = data.trips.map((t) => t.id);
  const checklist = await selectAll('trip_checklist_items', 'id,trip_id,position', (q) => q.in('trip_id', tripIds));
  const toCheck = checklist.filter((row) => row.position <= 4).map((row) => row.id);
  if (toCheck.length) {
    const doneAt = clock.hoursAgo(30).toISOString();
    await updateRows('trip_checklist_items', { done: true, done_at: doneAt }, (q) => q.in('id', toCheck.slice(0, 500)));
    console.log(`  ✓ checklist cochée: ${Math.min(500, toCheck.length)}`);
  }
  saveManifest(manifest);
  return data;
}

function entityIdForDoc(key) {
  return entityIdSafe(`trip-doc:${key}`);
}


async function applyCommunity(people, identity, clock, manifest) {
  const refs = await loadReference();
  const data = buildCommunity({ people, identity, clock, refs });
  console.log(`\n[Clubs & événements] ${data.stats.clubs} clubs, ${data.stats.events} événements.`);
  const steps = [
    ['clubs', data.clubs, 'id'],
    ['club_members', data.clubMembers, 'id'],
    ['club_topics', data.topics, 'id'],
    ['club_topic_replies', data.replies, 'id'],
    ['club_topic_likes', data.topicLikes, 'topic_id,user_id'],
    ['club_events', data.clubEvents, 'id'],
    ['club_event_participants', data.clubEventParticipants, 'event_id,user_id'],
    ['events', data.events, 'id'],
    ['event_participants', data.eventParticipants, 'event_id,user_id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict, batchSize: 150 });
    register(manifest, table, rows.map((r) => r.id ?? `${r.event_id}:${r.user_id}`));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  // Compteurs manuels : nombre réel de membres par club.
  for (const club of data.clubs) {
    const count = data.clubMembers.filter((m) => m.club_id === club.id).length;
    await updateRows('clubs', { members_count: count, active_this_month: Math.max(1, Math.round(count * 0.72)) }, (q) => q.eq('id', club.id));
  }
  console.log(`  ✓ clubs.members_count recalé sur ${data.clubs.length} clubs`);
  saveManifest(manifest);
  return data;
}


async function applyMessaging(people, identity, clock, manifest) {
  const data = buildMessaging({ people, identity, clock });
  console.log(`\n[Messagerie] ${data.stats.conversations} conversations, ${data.stats.messages} messages.`);
  const steps = [
    ['conversations', data.conversations, 'id'],
    ['conversation_members', data.members, 'id'],
    ['messages', data.messages, 'id'],
    ['message_reactions', data.reactions, 'id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict, batchSize: 150 });
    register(manifest, table, rows.map((r) => r.id));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  // members_count et last_message_at sont manuels / trigger : on recale le premier.
  for (const conv of data.conversations) {
    const count = data.members.filter((m) => m.conversation_id === conv.id).length;
    await updateRows('conversations', { members_count: count }, (q) => q.eq('id', conv.id));
  }
  saveManifest(manifest);
  return data;
}


async function applyExtras(people, clock, manifest) {
  const refs = await loadReference();
  const data = buildProfileExtras({ people, clock, refs });
  console.log(`\n[Profil+] ${data.stats.kits} kits, ${data.stats.orders} commandes, ${data.stats.badges} badges.`);
  const steps = [
    ['loyalty_rewards', data.rewards, 'id'],
    ['user_progression', data.progression, 'user_id'],
    ['user_season_progress', data.seasonProgress, 'user_id,season_id'],
    ['user_territory', data.territories, 'user_id'],
    ['user_territory_private', data.territoriesPrivate, 'user_id'],
    ['user_badges', data.userBadges, 'user_id,badge_id'],
    ['user_challenges', data.userChallenges, 'id'],
    ['materiel_kits', data.kits, 'id'],
    ['materiel_kit_items', data.kitItems, 'id'],
    ['product_ownership', data.ownership, 'id'],
    ['orders', data.orders, 'id'],
    ['loyalty_history', data.loyaltyHistory, 'id'],
    ['loyalty_redemptions', data.redemptions, 'id'],
  ];
  for (const [table, rows, onConflict] of steps) {
    if (!rows.length) continue;
    await upsertRows(table, rows, { onConflict, batchSize: 150 });
    register(manifest, table, rows.map((r) => r.id ?? r.user_id));
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  saveManifest(manifest);
  return data;
}

async function main() {
  banner();
  const errors = validateCasting();
  if (errors.length) fail(`Casting invalide :\n- ${errors.join('\n- ')}`);
  console.log(`Casting : ${RESIDENTS.length} résidents + 1 démo, ${ALL_PEOPLE.filter((p) => p.visibility === 'prive').length} profils privés.`);

  const manifest = loadManifest();
  const clock = createClock(config.seedEpoch || manifest.epoch || new Date().toISOString());
  if (!manifest.epoch) manifest.epoch = clock.epoch;

  await assertTables(COLUMNS);
  console.log('✓ Schéma vérifié.');

  if (MODE === 'dry-run') {
    const identity = buildIdentity({ people: ALL_PEOPLE, clock });
    const social = buildSocial({ people: ALL_PEOPLE, identity, clock, refs: { places: {} } });
    const carnets = buildCarnets({ people: ALL_PEOPLE, identity, clock, refs: { places: {} } });
    console.log(`Profils ${identity.profiles.length}, follows ${identity.follows.length}`);
    console.log(`Posts ${social.stats.posts}, likes ${social.stats.likes}, commentaires ${social.stats.comments}, stories ${social.stats.stories}`);
    console.log(`Carnets ${carnets.stats.carnets}, médias ${carnets.stats.media}`);
    console.log('\nAucun écrit.');
    return;
  }

  if (MODE === 'apply') {
    if (PHASES.has('identity')) {
      await applyIdentity(ALL_PEOPLE, clock, manifest);
    } else {
      // Les IDs auth doivent être connus : on les relit depuis le manifeste.
      for (const person of ALL_PEOPLE) {
        const u = manifest.users[person.key];
        if (u?.id) person.id = u.id;
      }
    }
    const identity = PHASES.has('identity')
      ? buildIdentity({ people: ALL_PEOPLE, clock })
      : buildIdentity({ people: ALL_PEOPLE, clock });
    if (PHASES.has('carnets')) await applyCarnets(ALL_PEOPLE, identity, clock, manifest);
    if (PHASES.has('social')) await applySocial(ALL_PEOPLE, identity, clock, manifest);
    if (PHASES.has('outings')) await applyOutings(ALL_PEOPLE, identity, clock, manifest);
    if (PHASES.has('trips')) await applyTrips(ALL_PEOPLE, identity, clock, manifest);
    if (PHASES.has('community')) await applyCommunity(ALL_PEOPLE, identity, clock, manifest);
    if (PHASES.has('messaging')) await applyMessaging(ALL_PEOPLE, identity, clock, manifest);
    if (PHASES.has('extras')) await applyExtras(ALL_PEOPLE, clock, manifest);
    saveManifest(manifest);
    console.log('\n✓ Terminé.');
    return;
  }

  if (MODE === 'cleanup') {
    console.log('\n[Nettoyage] Suppression des entités du manifeste, dans l’ordre inverse.');
    const order = Object.keys(manifest.entities).reverse();
    for (const table of order) {
      const ids = manifest.entities[table].map((e) => e.id).filter((x) => typeof x === 'string' && x.includes(':') === false);
      if (!ids.length) continue;
      const deleted = await deleteIds(table, ids);
      console.log(`  ✓ ${table}: ${deleted}`);
    }
    console.log('\n⚠ Les comptes auth ne sont pas supprimés (à faire manuellement si souhaité).');
    return;
  }

  if (MODE === 'verify') {
    console.log('Vérification complète : voir scripts/seed/world/verify/checks.mjs (branché à l’étape suivante).');
  }
}

main().catch((err) => {
  console.error('\n✗ Échec :', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
