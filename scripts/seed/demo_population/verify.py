"""Validate an LKDV demo manifest before loading it into a sandbox."""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from uuid import UUID


# Composite application keys are included alongside database primary keys.
UNIQUE_KEYS = {
    "user_profiles": ("email", "handle"),
    "user_traveller": ("user_id",),
    "clubs": ("slug",),
    "club_members": (("club_id", "user_id"),),
    "club_event_registrations": (("event_id", "user_id"),),
    "club_event_participants": (("event_id", "user_id"),),
    "event_participants": (("event_id", "user_id"),),
    "user_follows": (("follower_id", "following_id"),),
    "follow_requests": (("requester_id", "target_id"),),
    "user_content_mutes": (("muter_id", "muted_id"),),
    "post_likes": (("post_id", "user_id"),),
    "post_saves": (("post_id", "user_id"),),
    "story_close_friends": (("owner_id", "friend_id"),),
    "story_views": (("story_id", "viewer_id"),),
    "story_likes": (("story_id", "user_id"),),
    "story_highlight_items": (("highlight_id", "story_id"),),
    "travel_groups": ("conversation_id",),
    "group_members": (("group_id", "user_id"),),
    "group_poll_votes": (("poll_id", "user_id"),),
    "conversations": ("direct_pair_key",),
    "conversation_members": (("conversation_id", "user_id"),),
    "crew_members": (("crew_id", "user_id"),),
    "trips": ("slug",),
    "trip_participants": (("trip_id", "user_id"),),
    "trip_collaborators": (("trip_id", "user_id"),),
    "hike_session_participants": (("session_id", "user_id"),),
    "outing_share_metrics": ("session_id",),
    "notification_preferences": (("user_id", "notification_type"),),
}

# Local references must stay inside the demo cohort. Catalog and route
# references may resolve from the target's existing reference data.
PERSON_REFERENCES = {
    "user_traveller": ("user_id",),
    "clubs": ("created_by",),
    "club_members": ("user_id",),
    "club_channels": ("created_by",),
    "club_channel_messages": ("author_id", "hidden_by_moderator_id"),
    "club_topics": ("author_id",),
    "club_topic_replies": ("author_id",),
    "club_events": ("organizer_id",),
    "events": ("organizer_id",),
    "club_event_registrations": ("user_id", "invited_by_user_id"),
    "club_event_participants": ("user_id",),
    "club_event_attendance": ("user_id",),
    "event_participants": ("user_id",),
    "user_follows": ("follower_id", "following_id"),
    "follow_requests": ("requester_id", "target_id"),
    "user_content_mutes": ("muter_id", "muted_id"),
    "community_posts": ("author_id",),
    "community_post_drafts": ("author_id", "user_id"),
    "post_likes": ("user_id",),
    "post_comments": ("author_id",),
    "post_comment_likes": ("user_id",),
    "post_saves": ("user_id",),
    "post_shares": ("user_id",),
    "post_stories": ("author_id",),
    "story_close_friends": ("owner_id", "friend_id"),
    "story_hidden_users": ("owner_id", "hidden_user_id"),
    "story_views": ("viewer_id",),
    "story_likes": ("user_id",),
    "story_comments": ("author_id",),
    "story_highlights": ("owner_id",),
    "travel_groups": ("owner_id",),
    "group_members": ("user_id", "invited_by"),
    "group_messages": ("user_id",),
    "group_tasks": ("created_by", "assigned_to"),
    "group_polls": ("created_by",),
    "group_poll_votes": ("user_id",),
    "group_expenses": ("paid_by",),
    "group_kit_items": ("assigned_to",),
    "conversations": ("created_by",),
    "conversation_members": ("user_id",),
    "messages": ("sender_id",),
    "message_reactions": ("user_id",),
    "message_mentions": ("mentioned_user_id",),
    "trips": ("user_id",),
    "trip_participants": ("user_id",),
    "trip_collaborators": ("user_id", "invited_by"),
    "trip_items": ("owner_id", "packed_by"),
    "crews": ("created_by",),
    "crew_members": ("user_id",),
    "carnets": ("author_id",),
    "carnet_etapes": ("created_by",),
    "carnet_moments": ("auteur_id",),
    "carnet_comments": ("author_id",),
    "carnet_likes": ("user_id",),
    "carnet_views": ("user_id",),
    "carnet_favorites": ("user_id",),
    "carnet_moment_likes": ("user_id",),
    "activity_sessions": ("user_id",),
    "hike_sessions": ("user_id",),
    "hike_session_participants": ("user_id",),
    "outing_share_metrics": ("user_id",),
    "materiel_kits": ("user_id",),
    "materiel_kit_items": ("user_id", "owner_id"),
    "product_ownership": ("user_id",),
    "materiel_loans": ("lender_id", "borrower_id"),
    "notifications": ("user_id", "actor_id"),
    "notification_preferences": ("user_id",),
}

ENTITY_REFERENCES = {
    "club_members": {"club_id": "clubs"},
    "club_channels": {"club_id": "clubs"},
    "club_channel_messages": {"channel_id": "club_channels", "club_id": "clubs"},
    "club_topics": {"club_id": "clubs"},
    "club_topic_replies": {"topic_id": "club_topics", "parent_id": "club_topic_replies"},
    "club_events": {"club_id": "clubs"},
    "events": {"club_id": "clubs", "kit_id": "materiel_kits"},
    "club_event_registrations": {"event_id": "club_events"},
    "club_event_participants": {"event_id": "club_events"},
    "club_event_attendance": {"event_id": "club_events"},
    "event_participants": {"event_id": "events"},
    "community_posts": {"club_id": "clubs", "reposted_from_id": "community_posts",
                        "linked_carnet_id": "carnets", "linked_kit_id": "materiel_kits"},
    "post_likes": {"post_id": "community_posts"},
    "post_saves": {"post_id": "community_posts"},
    "post_comments": {"post_id": "community_posts", "parent_id": "post_comments"},
    "post_comment_likes": {"comment_id": "post_comments"},
    "post_shares": {"post_id": "community_posts", "conversation_id": "conversations",
                    "message_id": "messages"},
    "post_stories": {"club_id": "clubs", "linked_carnet_id": "carnets"},
    "story_views": {"story_id": "post_stories"},
    "story_likes": {"story_id": "post_stories"},
    "story_comments": {"story_id": "post_stories"},
    "story_highlights": {"cover_story_id": "post_stories"},
    "story_highlight_items": {"highlight_id": "story_highlights", "story_id": "post_stories"},
    "travel_groups": {"parent_club_id": "clubs", "conversation_id": "conversations"},
    "group_members": {"group_id": "travel_groups"},
    "group_messages": {"group_id": "travel_groups", "reply_to": "group_messages"},
    "group_tasks": {"group_id": "travel_groups"},
    "group_polls": {"group_id": "travel_groups"},
    "group_poll_votes": {"poll_id": "group_polls"},
    "group_expenses": {"group_id": "travel_groups"},
    "group_kit_items": {"group_id": "travel_groups"},
    "conversation_members": {"conversation_id": "conversations"},
    "messages": {"conversation_id": "conversations", "reply_to_id": "messages"},
    "message_reactions": {"message_id": "messages"},
    "message_mentions": {"message_id": "messages"},
    "message_attachments": {"message_id": "messages"},
    "crew_members": {"crew_id": "crews"},
    "trips": {"group_id": "travel_groups", "kit_id": "materiel_kits", "crew_id": "crews"},
    "trip_steps": {"trip_id": "trips"},
    "trip_items": {"trip_id": "trips", "inventory_item_id": "product_ownership"},
    "trip_participants": {"trip_id": "trips"},
    "trip_collaborators": {"trip_id": "trips"},
    "carnets": {"trip_id": "trips", "groupe_id": "travel_groups"},
    "carnet_etapes": {"carnet_id": "carnets"},
    "carnet_kit_items": {"carnet_id": "carnets"},
    "carnet_moments": {"carnet_id": "carnets", "hike_session_id": "hike_sessions"},
    "carnet_comments": {"carnet_id": "carnets"},
    "carnet_likes": {"carnet_id": "carnets"},
    "carnet_views": {"carnet_id": "carnets"},
    "carnet_favorites": {"carnet_id": "carnets"},
    "carnet_moment_likes": {"moment_id": "carnet_moments"},
    "hike_sessions": {"trip_id": "trips", "carnet_id": "carnets", "kit_id": "materiel_kits",
                      "activity_session_id": "activity_sessions"},
    "hike_session_participants": {"session_id": "hike_sessions"},
    "hike_session_gear": {"session_id": "hike_sessions", "kit_id": "materiel_kits",
                          "gear_item_id": "product_ownership"},
    "outing_share_metrics": {"session_id": "hike_sessions"},
    "materiel_kits": {"lineage_root_id": "materiel_kits", "forked_from": "materiel_kits"},
    "materiel_kit_items": {"kit_id": "materiel_kits", "product_ownership_id": "product_ownership"},
    "materiel_loans": {"product_ownership_id": "product_ownership"},
}

# These operational tables have no role in the community fixture.
NON_DEMO_TABLES = {
    "sos_alerts", "payment_intents", "user_payment_methods", "orders", "order_items",
    "order_encashment_events", "stripe_events", "push_subscriptions",
    "affiliate_conversions", "marketplace_transactions", "reward_withdrawals",
    "notification_deliveries", "user_addresses", "user_documents",
}


def _timestamp(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else None


def _uuid(value):
    try:
        return str(UUID(value)) == value
    except (AttributeError, TypeError, ValueError):
        return False


def verify(manifest):
    """Return validation errors. An empty list means the manifest passed."""
    if not isinstance(manifest, dict):
        return ["Le manifeste doit être un objet JSON."]
    tables = manifest.get("tables")
    if not isinstance(tables, dict):
        return ["Le champ tables doit être un objet JSON."]
    counts = manifest.get("counts")
    if not isinstance(counts, dict):
        return ["Le champ counts doit être un objet JSON."]
    errors = []

    def expect(condition, message):
        if not condition:
            errors.append(message)

    expect(manifest.get("version") == 1, "Version du manifeste différente de 1.")
    expect(_timestamp(manifest.get("as_of")) is not None, "as_of doit porter un fuseau.")
    expect(set(counts) == set(tables), "Les tables déclarées dans counts diffèrent de tables.")
    for table, rows in tables.items():
        expect(table not in NON_DEMO_TABLES or not rows, f"Table opérationnelle alimentée : {table}.")
        expect(isinstance(rows, list) and all(isinstance(r, dict) for r in rows),
               f"{table} doit contenir une liste de lignes JSON.")
        if isinstance(rows, list):
            count = counts.get(table)
            expect(type(count) is int and count == len(rows),
                   f"{table} : le compteur attendu ne correspond pas à {len(rows)} lignes.")
    if any(not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows)
           for rows in tables.values()):
        return errors
    # Catch malformed optional references before using them as dictionary keys.
    for table, rows in tables.items():
        scalar_keys = {"id", *PERSON_REFERENCES.get(table, ()), *ENTITY_REFERENCES.get(table, ())}
        for key in UNIQUE_KEYS.get(table, ()):
            scalar_keys.update((key,) if isinstance(key, str) else key)
        for index, row in enumerate(rows, 1):
            expect(all(not isinstance(row.get(field), (list, dict)) for field in scalar_keys),
                   f"{table} ligne {index} : référence ou clé composite invalide.")
    if any("référence ou clé composite invalide" in msg for msg in errors):
        return errors

    by_id = {table: {row["id"]: row for row in rows if row.get("id") is not None}
             for table, rows in tables.items()}
    profiles = tables.get("user_profiles", [])
    cohort = by_id.get("user_profiles", {})
    anchor = manifest.get("anchor_id")
    expect(_uuid(anchor) and anchor in cohort, "L’ancre de démo doit être un profil du lot.")
    expect(len(profiles) == 1000 and len(cohort) == 1000,
           f"Attendu : 1 000 profils distincts. Lu : {len(profiles)} lignes, {len(cohort)} UUID.")
    for row in profiles:
        user = row.get("id")
        expect(_uuid(user), f"Profil {user!r} : identifiant UUID invalide.")
        expect(row.get("is_demo") is True, f"Profil {user} : is_demo doit valoir true.")
        expect(row.get("role") in (None, "user"),
               f"Profil {user} : rôle applicatif privilégié dans le seed.")
        email = row.get("email")
        if user != anchor:
            expect(isinstance(email, str) and email.lower().endswith("@lkdv.invalid"),
                   f"Profil {user} : adresse synthétique hors du domaine réservé.")

    editorial = manifest.get("editorial")
    if editorial is not None:
        expect(isinstance(editorial, dict), "Le modèle éditorial doit être un objet JSON.")
        if isinstance(editorial, dict):
            people, relations = editorial.get("people"), editorial.get("relations")
            valid_collections = (
                isinstance(people, list) and all(isinstance(row, dict) for row in people)
                and isinstance(relations, list) and all(isinstance(row, dict) for row in relations)
            )
            expect(valid_collections, "Le modèle éditorial doit contenir people et relations.")
            if valid_collections:
                ids = [row.get("id") for row in people]
                expect(len(ids) == 1000 and all(_uuid(value) for value in ids)
                       and set(ids) == set(cohort),
                       "Le modèle éditorial doit correspondre à chacun des 1 000 profils.")
                seen_relations = set()
                seen_pairs = set()
                for index, relation in enumerate(relations, 1):
                    i = relation.get("id")
                    a = relation.get("person_a")
                    b = relation.get("person_b")
                    intro = relation.get("introduced_by")
                    expect(_uuid(intro) and intro in cohort or intro is None,
                           f"Relation {index} : intermédiaire hors de la cohorte.")
                    if not (_uuid(i) and _uuid(a) and _uuid(b) and a != b and a in cohort and b in cohort):
                        errors.append(f"Relation {index} : identifiant ou personnes invalides.")
                        continue
                    pair = frozenset((a, b))
                    expect(i not in seen_relations and pair not in seen_pairs,
                           f"Relation {index} : relation ou paire dupliquée.")
                    seen_relations.add(i)
                    seen_pairs.add(pair)
                expect(bool(seen_relations), "Aucune relation éditoriale présente.")

    for table, rows in tables.items():
        rules = [("id",)] + [
            (rule,) if isinstance(rule, str) else rule for rule in UNIQUE_KEYS.get(table, ())
        ]
        for rule in rules:
            seen = set()
            for index, row in enumerate(rows, 1):
                values = tuple(row.get(col) for col in rule)
                if None in values:
                    continue
                expect(values not in seen, f"{table} ligne {index} : doublon {', '.join(rule)}.")
                seen.add(values)
        for index, row in enumerate(rows, 1):
            for field in PERSON_REFERENCES.get(table, ()):
                user = row.get(field)
                expect(user is None or user in cohort,
                       f"{table} ligne {index} : {field} hors de la cohorte démo.")
            for field, target in ENTITY_REFERENCES.get(table, {}).items():
                entity = row.get(field)
                expect(entity is None or entity in by_id.get(target, {}),
                       f"{table} ligne {index} : {field} ne réfère pas à {target}.")
            if table in ("user_follows", "follow_requests", "user_content_mutes", "story_close_friends"):
                first, second = PERSON_REFERENCES[table]
                expect(row.get(first) != row.get(second),
                       f"{table} ligne {index} : référence à soi-même.")
            if table == "notification_preferences":
                expect(row.get("email_enabled") is False and row.get("push_enabled") is False,
                       f"{table} ligne {index} : canal de notification externe activé.")

    members = defaultdict(dict)
    for row in tables.get("conversation_members", []):
        members[row.get("conversation_id")][row.get("user_id")] = _timestamp(row.get("joined_at"))
    for row in tables.get("conversations", []):
        if row.get("type") == "direct":
            expect(len(members[row.get("id")]) == 2,
                   f"Conversation directe {row.get('id')} : deux membres requis.")
    for row in tables.get("messages", []):
        conversation = row.get("conversation_id")
        user = row.get("sender_id")
        expect(user in members[conversation],
               f"Message {row.get('id')} : auteur hors de la conversation.")
        sent = _timestamp(row.get("created_at"))
        joined = members[conversation].get(user)
        expect(sent is None or joined is None or joined <= sent,
               f"Message {row.get('id')} : envoyé avant l’adhésion de l’auteur.")

    for table, ref, container in (
        ("community_posts", "reposted_from_id", None),
        ("post_comments", "parent_id", "post_id"),
        ("club_topic_replies", "parent_id", "topic_id"),
        ("group_messages", "reply_to", "group_id"),
        ("messages", "reply_to_id", "conversation_id"),
    ):
        for row in tables.get(table, []):
            parent = by_id.get(table, {}).get(row.get(ref))
            if parent is None:
                continue
            expect(row.get("id") != parent.get("id"), f"{table} : réponse ou repost vers soi-même.")
            if container is not None:
                expect(row.get(container) == parent.get(container),
                       f"{table} {row.get('id')} : réponse dans un autre fil.")
            after = _timestamp(row.get("created_at"))
            before = _timestamp(parent.get("created_at"))
            expect(after is None or before is None or before < after,
                   f"{table} {row.get('id')} : date antérieure ou égale à sa source.")

    for table, column in (("story_views", "first_viewed_at"), ("story_likes", "created_at"),
                          ("story_comments", "created_at")):
        for row in tables.get(table, []):
            slide = by_id.get("post_stories", {}).get(row.get("story_id"))
            if slide is None:
                continue
            created = _timestamp(slide.get("created_at"))
            expires = _timestamp(slide.get("expires_at"))
            touched = _timestamp(row.get(column))
            expect(not (created and expires and touched) or created <= touched < expires,
                   f"{table} : interaction hors de la fenêtre de la story {row.get('story_id')}.")
            if table == "story_comments":
                # The application's SELECT policy is currently open to
                # authenticated readers, independently of the story audience.
                expect(slide.get("visibility") == "public",
                       f"Commentaire sur une story à audience restreinte : {row.get('story_id')}.")

    for table in ("club_events", "events"):
        for row in tables.get(table, []):
            start = _timestamp(row.get("starts_at"))
            end = _timestamp(row.get("ends_at"))
            expect(not (start and end) or start < end,
                   f"{table} {row.get('id')} : début postérieur ou égal à la fin.")
    for table, event_table, registered_at in (
        ("club_event_registrations", "club_events", "registered_at"),
        ("event_participants", "events", "created_at"),
    ):
        for row in tables.get(table, []):
            source = by_id.get(event_table, {}).get(row.get("event_id"))
            if source is None:
                continue
            start = _timestamp(source.get("starts_at"))
            registered = _timestamp(row.get(registered_at))
            expect(not (start and registered) or registered < start,
                   f"{table} : inscription après le départ de {row.get('event_id')}.")

    if _uuid(anchor):
        for table, field, label in (
            ("community_posts", "author_id", "publication"),
            ("post_stories", "author_id", "story"),
            ("user_follows", "follower_id", "abonnement"),
            ("club_members", "user_id", "club"),
            ("group_members", "user_id", "groupe"),
            ("conversation_members", "user_id", "conversation"),
            ("messages", "sender_id", "message"),
            ("notifications", "user_id", "notification"),
        ):
            expect(any(row.get(field) == anchor for row in tables.get(table, [])),
                   f"Parcours de l’ancre incomplet : {label} manquant.")
        expect(any(row.get("user_id") == anchor
                   for table in ("club_event_registrations", "event_participants")
                   for row in tables.get(table, [])),
               "Parcours de l’ancre incomplet : inscription à une sortie manquante.")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args(argv)
    try:
        with args.manifest.open(encoding="utf-8") as file:
            manifest = json.load(file)
    except (OSError, ValueError) as error:
        print(f"Manifeste illisible : {error}", file=sys.stderr)
        return 1
    errors = verify(manifest)
    if errors:
        print(f"Échec de validation : {len(errors)} erreur(s).", file=sys.stderr)
        for error in errors[:30]:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"Manifeste valide : 1 000 profils, {sum(manifest['counts'].values()):,} lignes "
          f"dans {len(manifest['tables'])} tables.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
