"""Map workbook clubs, outings and group conversations to their LKDV tables."""

from collections import defaultdict
from decimal import Decimal


SPORTS = {
    "randonnée": ("rando", "trail_outing"),
    "marche": ("rando", "trail_outing"),
    "vélo": ("velo", "social_ride"),
    "course": ("course", "training"),
    "kayak": ("kayak", "training"),
    "atelier": (None, "indoor"),
}


def build_clubs(ctx):
    for row in ctx.rows("20 Clubs"):
        club, name, city, country, theme, activity, privacy, summary, owner, created, _, area, rules, members = row
        sport, _ = SPORTS[activity]
        ctx.add(
            "clubs", id=ctx.id(club), slug=f"demo-{str(ctx.id(club))[:8]}-{club.lower()}",
            name=name, type="destination" if area == "international" else "activite",
            description=summary, category=theme, privacy=privacy, activities=[activity],
            primary_sport=sport, sports=[sport] if sport else [], created_by=ctx.id(owner),
            created_at=ctx.time(created), updated_at=ctx.time(created), location_label=city,
            country_iso=country, rules=rules, members_count=members,
        )

    for club, person, role, status, joined, _ in ctx.rows("21 Membres clubs"):
        ctx.add(
            "club_members", id=ctx.id(f"club-member:{club}:{person}"),
            club_id=ctx.id(club), user_id=ctx.id(person), role=role, status=status,
            joined_at=ctx.time(joined),
        )

    for channel, club, person, label, kind, created in ctx.rows("22 Salons"):
        ctx.add(
            "club_channels", id=ctx.id(channel), club_id=ctx.id(club), created_by=ctx.id(person),
            name=label, kind=kind, created_at=ctx.time(created),
            notifications_enabled_by_default=False,
        )

    for message, channel, club, person, created, _, body in ctx.rows("23 Messages club"):
        ctx.add(
            "club_channel_messages", id=ctx.id(message), channel_id=ctx.id(channel),
            club_id=ctx.id(club), author_id=ctx.id(person), body=body, created_at=ctx.time(created),
        )

    for topic, club, person, created, _, title, body, pinned in ctx.rows("24 Sujets club"):
        ctx.add(
            "club_topics", id=ctx.id(topic), club_id=ctx.id(club), author_id=ctx.id(person),
            title=title, content=body, is_pinned=bool(pinned),
            created_at=ctx.time(created), updated_at=ctx.time(created),
        )

    for reply, topic, _, person, created, _, body in ctx.rows("25 Réponses club"):
        ctx.add(
            "club_topic_replies", id=ctx.id(reply), topic_id=ctx.id(topic),
            author_id=ctx.id(person), content=body, created_at=ctx.time(created),
        )


def build_events(ctx):
    events = {}
    for row in ctx.rows("30 Sorties"):
        (event, club, owner, title, theme, activity, format_label, city, country, zone, created,
         starts, ends, _, period, status, capacity, _, waiting, distance, elevation,
         body, meeting, fallback, visibility, _) = row
        sport, sport_format = SPORTS[activity]
        mirrored = event == "E00001"
        public = visibility == "public" and (
            mirrored or status == "cancelled" or (period == "Futur" and int(event[1:]) % 4 == 0)
        )
        # club_events has no cancellation state, whereas events is publicly readable.
        # Omit restricted cancellations until a club-only cancellation state exists.
        if status == "cancelled" and not public:
            continue
        events[event] = (public, mirrored, club, zone, country, status)
        identified = dict(
            id=ctx.id(event), club_id=ctx.id(club), organizer_id=ctx.id(owner), title=title,
            description=f"{body}\n\n{format_label.capitalize()} · {theme}\n{fallback}",
            location=city, meeting_point=meeting, starts_at=ctx.time(starts),
            ends_at=ctx.time(ends), created_at=ctx.time(created), max_participants=capacity,
        )
        if public:
            ctx.add(
                "events", **identified, event_date=ctx.date(starts, zone), country=country,
                type=sport or "autre", distance_km=distance, elevation_gain_m=elevation,
                safety_notes=fallback, status=status, level="facile", activity=sport or "autre",
                waitlist_enabled=waiting > 0 or status != "cancelled",
            )
        if not public or mirrored:
            ctx.add(
                "club_events", **identified, event_date=ctx.time(starts), sport=sport,
                format="indoor" if city == "À distance" else sport_format, visibility=visibility,
                waitlist_enabled=True,
            )

    for event, person, status, registered, _, _ in ctx.rows("31 Inscriptions"):
        public, mirrored, _, _, _, _ = events[event]
        identity = dict(event_id=ctx.id(event), user_id=ctx.id(person))
        if public:
            ctx.add(
                "event_participants", id=ctx.id(f"event-participant:{event}:{person}"),
                **identity, status="confirmed" if status == "registered" else "waitlist",
                created_at=ctx.time(registered),
            )
        if public and not mirrored:
            continue
        ctx.add(
            "club_event_registrations", **identity, status=status,
            registered_at=ctx.time(registered), updated_at=ctx.time(registered),
        )
        # Profile bootstrap uses the legacy presence relation, which has no waiting state.
        if status == "registered":
            ctx.add("club_event_participants", **identity, joined_at=ctx.time(registered))
    return events


def build_groups(ctx, events):
    conversation_members = defaultdict(list)
    for conversation, person, joined, role, _ in ctx.rows("54 Membres conversations"):
        conversation_members[conversation].append((person, joined, role))

    for conversation, kind, title, owner, created, _, _, _, _ in ctx.rows("53 Conversations"):
        members = conversation_members[conversation]
        direct_pair = ":".join(sorted(str(ctx.id(person)) for person, _, _ in members)) if kind == "direct" else None
        ctx.add(
            "conversations", id=ctx.id(conversation), type=kind, name=title,
            title=title if kind == "group" else None, created_by=ctx.id(owner),
            members_count=len(members), direct_pair_key=direct_pair, created_at=ctx.time(created),
            last_message_at=ctx.time(created), updated_at=ctx.time(created),
        )
        for person, joined, role in members:
            ctx.add(
                "conversation_members", id=ctx.id(f"conversation-member:{conversation}:{person}"),
                conversation_id=ctx.id(conversation), user_id=ctx.id(person),
                joined_at=ctx.time(joined), created_at=ctx.time(joined), updated_at=ctx.time(joined),
                last_read_at=ctx.time(joined), role="owner" if kind == "group" and role == "organise" else "member",
                status="active",
            )

    groups = {}
    for group, title, city, club, event, owner, created, starts, ends, cap, audience, conversation, cycle in ctx.rows("50 Groupes"):
        _, _, _, zone, country, event_status = events[event]
        if group == "G00001":
            title = "Boucle de Lille · groupe de préparation"
        groups[group] = (owner, starts, ends, zone, event_status)
        ctx.add(
            "travel_groups", id=ctx.id(group), name=title,
            description="Préparation entre participants à une sortie LKDV de démonstration.",
            destination=city, theme="Sortie", parent_club_id=ctx.id(club), owner_id=ctx.id(owner),
            created_at=ctx.time(created), updated_at=ctx.time(created), max_members=cap,
            departure_date=ctx.date(starts, zone), return_date=ctx.date(ends, zone),
            visibility="private" if audience == "privé" else "public", country_iso=country,
            conversation_id=ctx.id(conversation), is_ephemeral=(cycle == "éphémère"),
        )

    group_members = defaultdict(list)
    for group, person, _, joined, _ in ctx.rows("51 Membres groupes"):
        group_members[group].append(ctx.id(person))
        # seed_group_owner_membership_trg supplies the owning organizer.
        if person != groups[group][0]:
            ctx.add(
                "group_members", id=ctx.id(f"group-member:{group}:{person}"),
                group_id=ctx.id(group), user_id=ctx.id(person), role="member",
                status="active", joined_at=ctx.time(joined),
            )

    for message, conversation, person, created, _, body, reply, group, _, kind in ctx.rows("55 Messages"):
        # These editorial lines originally cited the workbook date and specific trains.
        body = body.replace(
            "Si tu dois prendre le 13 h 20, je te montre le raccourci à la pause. Je passe à la gare vers 9 h 40.",
            "Si tu dois prendre le premier train du retour, je te montre le raccourci à la pause. Je passe à la gare un peu avant le départ.",
        ).replace(
            "Parfait. Je descends du train à 9 h 36. Tu prends le thé ou j’en apporte ?",
            "Parfait. Je descends du train juste avant le rendez-vous. Tu prends le thé ou j’en apporte ?",
        ).replace(
            "Deux, c’est bien. Je note rendez-vous devant la gare à 10 h.",
            "Deux, c’est bien. Je garde l’heure annoncée et le rendez-vous devant la gare.",
        )
        ctx.add(
            "messages", id=ctx.id(message), conversation_id=ctx.id(conversation),
            sender_id=ctx.id(person), type=kind, message_type=kind, content=body,
            created_at=ctx.time(created), updated_at=ctx.time(created), reply_to_id=ctx.id(reply),
        )
        # /groupes and /messagerie read distinct surfaces for the same discussion.
        if group:
            ctx.add(
                "group_messages", id=ctx.id(message), group_id=ctx.id(group), user_id=ctx.id(person),
                content=body, created_at=ctx.time(created), reply_to=ctx.id(reply),
            )

    for group, tool, title, detail, person, created, _ in ctx.rows("52 Outils groupes"):
        owner, starts, ends, zone, status = groups[group]
        past = status == "past"
        common = dict(group_id=ctx.id(group), created_at=ctx.time(created))
        if tool == "sondage":
            ctx.add(
                "group_polls", id=ctx.id(f"poll:{group}:{title}"), **common,
                created_by=ctx.id(person), question=title, options=["Boucle courte", "Atelier à couvert"],
                ends_at=ctx.time(starts), status="closed" if past else "open",
            )
        elif tool == "tâche":
            ctx.add(
                "group_tasks", id=ctx.id(f"task:{group}:{title}"), **common, title=title,
                description=detail, created_by=ctx.id(owner), assigned_to=ctx.id(person),
                due_date=ctx.date(starts, zone), status="done" if past else "todo",
            )
        elif tool == "kit partagé":
            ctx.add(
                "group_kit_items", id=ctx.id(f"group-kit:{group}:{title}"), **common,
                assigned_to=ctx.id(person), name=title, notes=detail, category="Commun",
                quantity=1, is_shared=True, start_date=ctx.date(starts, zone), end_date=ctx.date(ends, zone),
            )
        elif tool == "dépense fictive":
            amount = Decimal(detail.split(" ", 1)[0].replace(",", "."))
            ctx.add(
                "group_expenses", id=ctx.id(f"group-expense:{group}:{title}"), **common,
                title=f"{title} (démo)", amount=float(amount), paid_by=ctx.id(person),
                split_between=group_members[group], category="Alimentation", status="settled" if past else "pending",
            )
        else:
            raise ValueError(f"Outil de groupe LKDV inconnu : {tool}")

    for group, person, title, option, created in ctx.rows("56 Votes groupe"):
        ctx.add(
            "group_poll_votes", id=ctx.id(f"poll-vote:{group}:{title}:{person}"),
            poll_id=ctx.id(f"poll:{group}:{title}"), user_id=ctx.id(person),
            option_index=int(option), created_at=ctx.time(created),
        )


def build_notifications(ctx, events):
    comment_posts = {row[0]: row[1] for row in ctx.rows("41 Commentaires")}
    group_conversations = {row[0]: row[11] for row in ctx.rows("50 Groupes")}
    for notice, target, actor, kind, reference, created, read, _ in ctx.rows("70 Notifications"):
        if kind in {"message direct", "nouveau message"}:
            # The normal message insert trigger provides the in-app notification.
            continue
        identity = str(ctx.id(reference))
        if kind == "réponse au commentaire":
            obj = ctx.id(comment_posts[reference])
            notification = ("post_comment_reply", "Réponse à votre commentaire", "community_post", obj, f"/communaute/post/{obj}")
        elif kind == "sondage du groupe":
            conversation = ctx.id(group_conversations[reference])
            notification = ("group_poll", "Sondage de préparation", "group", identity, f"/messagerie?conversation={conversation}")
        elif kind in {"rappel sortie", "rappel de sortie"}:
            public, _, club, _, _, _ = events[reference]
            link = f"/sorties/{identity}" if public else f"/clubs/{ctx.id(club)}"
            notification = ("event_reminder", "Rappel pour votre prochaine sortie", "event" if public else "club_event", identity, link)
        else:
            raise ValueError(f"Notification LKDV inconnue : {kind}")

        category, title, related, obj, link = notification
        seen = read == "lue"
        ctx.add(
            "notifications", id=ctx.id(notice), user_id=ctx.id(target), actor_id=ctx.id(actor),
            type=category, title=title, related_type=related, related_id=obj, link=link,
            created_at=ctx.time(created), updated_at=ctx.time(created),
            read=seen, read_at=ctx.time(created) if seen else None,
            channels_sent=["in_app"], group="social",
        )


def build(ctx):
    build_clubs(ctx)
    events = build_events(ctx)
    build_groups(ctx, events)
    build_notifications(ctx, events)
