"""Map the LKDV demo workbook's social fixtures to application tables."""
from base64 import b64encode
from collections import defaultdict
from datetime import datetime, timedelta
from struct import pack
from zoneinfo import ZoneInfo
from zlib import compress, crc32

from media import landscape


def _blank_story_background():
    # The legacy story viewer requires an image URL even for text slides.
    # This PNG contains no private data. The text stays on the RLS-protected row.
    def chunk(kind, payload):
        body = kind + payload
        return pack(">I", len(payload)) + body + pack(">I", crc32(body))

    header = pack(">IIBBBBB", 9, 16, 8, 2, 0, 0, 0)
    pixels = b"".join(
        b"\0" + bytes((24 + y, 42 + y, 41 + y)) * 9
        for y in range(16)
    )
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
    png += chunk(b"IDAT", compress(pixels)) + chunk(b"IEND", b"")
    return "data:image/png;base64," + b64encode(png).decode("ascii")


STORY_BACKGROUND = _blank_story_background()
MEDIA_LABELS = {
    "fr": {"image": "Paysage illustré de démonstration", "video": "Vidéo de démo à venir"},
    "en": {"image": "Illustrated demo landscape", "video": "Demo video pending"},
    "es": {"image": "Paisaje ilustrado de demostración", "video": "Vídeo de demostración pendiente"},
    "pt": {"image": "Paisagem ilustrada de demonstração", "video": "Vídeo de demonstração pendente"},
}
INTERACTION_TABLES = {"like": "post_likes", "favori": "post_saves", "partage": "post_shares"}
ANCHOR = "P0001"
ANCHOR_PAST = "E00002"
ANCHOR_FUTURE = "E00001"
FRENCH_MONTHS = (
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre",
)


def _anchor_outing(ctx):
    outing, = [row for row in ctx.rows("30 Sorties") if row[0] == ANCHOR_FUTURE]
    start = datetime.fromisoformat(ctx.time(outing[11])).astimezone(ZoneInfo(outing[9]))
    date_label = f"{start.day} {FRENCH_MONTHS[start.month - 1]}"
    hour_label = f"{start.hour} h" if start.minute == 0 else f"{start.hour} h {start.minute:02d}"
    return date_label, hour_label


def _build_network(ctx):
    follows = set()
    for row_id, follower, followed, created, _relation, _reason in ctx.rows("12 Abonnements"):
        follows.add((follower, followed))
        ctx.add(
            "user_follows", id=ctx.id(row_id), follower_id=ctx.id(follower),
            following_id=ctx.id(followed), created_at=ctx.time(created),
        )
    follow_requests = {}
    for row_id, requester, target, status, created, responded in ctx.rows("13 Demandes"):
        follow_requests[(requester, target)] = status
        ctx.add(
            "follow_requests", id=ctx.id(row_id), requester_id=ctx.id(requester),
            target_id=ctx.id(target), status=status, created_at=ctx.time(created),
            responded_at=ctx.time(responded),
        )
    for owner, friend, created in ctx.rows("14 Proches stories"):
        ctx.add(
            "story_close_friends", owner_id=ctx.id(owner), friend_id=ctx.id(friend),
            created_at=ctx.time(created),
        )
    private = {row[0] for row in ctx.rows("10 Profils") if row[40] == "prive"}
    for owner, muted, kind, created, _reason in ctx.rows("15 Sourdines"):
        if kind != "sourdine":
            raise ValueError(f"Unknown workbook mute kind: {kind}")
        owner_id, muted_id = ctx.id(owner), ctx.id(muted)
        at = ctx.time(created)
        pair = (owner, muted)
        if pair not in follows:
            # The mute action is available only for followed profiles.
            follow_at = datetime.fromisoformat(at) - timedelta(seconds=1)
            if muted in private:
                if pair in follow_requests:
                    raise ValueError(f"Cannot mute an unconfirmed private follow: {pair}")
                ctx.add(
                    "follow_requests", id=ctx.id(f"mute-request:{owner}:{muted}"),
                    requester_id=owner_id, target_id=muted_id, status="accepted",
                    created_at=(follow_at - timedelta(seconds=1)).isoformat(),
                    responded_at=follow_at.isoformat(),
                )
            ctx.add(
                "user_follows", id=ctx.id(f"mute-follow:{owner}:{muted}"), follower_id=owner_id,
                following_id=muted_id, created_at=follow_at.isoformat(),
            )
            follows.add(pair)
        ctx.add(
            "user_content_mutes", muter_id=owner_id, muted_id=muted_id, created_at=at,
        )


def _build_posts(ctx, carnets, outing):
    date_label, hour_label = outing
    anchor_organizer = None
    for post, author, created, _local, language, title, text, post_type, audience, club, event, source in ctx.rows("40 Posts"):
        post_id = ctx.id(post)
        event_meta = {"source": "lkdv_demo", "language": language}
        if club:
            event_meta["club_id"] = str(ctx.id(club))
        if event:
            event_meta["club_event_id"] = str(ctx.id(event))
        if event == ANCHOR_FUTURE and not source:
            anchor_organizer = author
            title = f"Lille · boucle du {date_label}"
            text = (
                f"Pour le {date_label} : départ à {hour_label}, une boucle de 6,2 km "
                "et la possibilité de rentrer à la pause. J’ouvre quelques places. "
                "Dites-moi si l’heure de retour est trop juste."
            )
        elif event == ANCHOR_FUTURE and author == ANCHOR:
            text = (
                f"J’ai réservé un créneau pour le {date_label}. Si vous devez rentrer tôt, "
                "je vous retrouve volontiers à la pause avant de repartir."
            )
        elif event == ANCHOR_PAST:
            title = "Après la dernière boucle à Lille"
        ctx.add(
            "community_posts", id=post_id, author_id=ctx.id(author), title=title,
            content=text, post_type=post_type, audience=audience,
            club_id=ctx.id(club) if audience == "club" else None,
            linked_carnet_id=ctx.id(carnets.get((event, author))),
            snapshot_exclude_location=True, reposted_from_id=ctx.id(source),
            client_request_id=post_id, creation_meta=event_meta,
            created_at=ctx.time(created), updated_at=ctx.time(created),
        )

    for row_id, post, author, parent, created, _lang, text in ctx.rows("41 Commentaires"):
        is_anchor_question = author == ANCHOR and "attraper celui de 13 h 20" in text
        if is_anchor_question:
            text = text.replace("attraper celui de 13 h 20", "reprendre un train tôt")
        ctx.add(
            "post_comments", id=ctx.id(row_id), post_id=ctx.id(post), author_id=ctx.id(author),
            parent_id=ctx.id(parent), content=text, created_at=ctx.time(created),
        )
        if is_anchor_question:
            if not anchor_organizer:
                raise ValueError("The demo question requires the organizer's public post")
            at = datetime.fromisoformat(ctx.time(created)) + timedelta(minutes=2)
            ctx.add(
                "post_comment_likes", id=ctx.id("anchor-comment-like"), comment_id=ctx.id(row_id),
                user_id=ctx.id(anchor_organizer), created_at=at.isoformat(),
            )
    ctx.add(
        "community_post_drafts", user_id=ctx.id(ANCHOR), title="À relire avant de partager",
        content="Noter le temps réel de la boucle et demander si l’atelier de repli a servi.",
        post_type="post", audience="abonnies", updated_at=ctx.time("2026-11-15 17:30:00Z"),
    )


def _build_stories(ctx, carnets, outing):
    date_label, _ = outing
    story_scope = {}
    for story, author, lang, caption, media, asset, scope, club, created, expires, cycle, _state, event in ctx.rows("43 Stories"):
        if event == ANCHOR_FUTURE:
            caption = (
                f"La boucle du {date_label} se termine côté gare. Le plan est dans le fil. "
                "On garde 25 minutes pour le train retour."
            )
        story_scope[story] = scope
        label = MEDIA_LABELS.get(lang, MEDIA_LABELS["en"]).get(media)
        illustration = media == "image"
        image_url = landscape(asset or story, 90, 160) if illustration else STORY_BACKGROUND
        if len(image_url) > 2048:
            raise ValueError(f"Story image is too large to store: {story}")
        overlay = caption if not label else f"{label}\n\n{caption}"
        ctx.add(
            "post_stories", id=ctx.id(story), author_id=ctx.id(author),
            caption=caption, image_url=image_url, media_type="image" if illustration else "text",
            alt_text=label if illustration else None,
            composition=[{"type": "text", "text": overlay}],
            composition_version=1, client_request_id=f"lkdv-demo-{story}",
            visibility=scope, club_id=ctx.id(club), status="ready",
            reply_policy="everyone" if scope == "public" else "off",
            linked_carnet_id=ctx.id(carnets.get((event, author))),
            linked_carnet_day=1 if (event, author) in carnets else None,
            created_at=ctx.time(created), expires_at=ctx.time(expires),
            archived_at=ctx.time(expires) if cycle == "expirée" else None,
        )

    for index, (story, viewer, kind, created, text) in enumerate(ctx.rows("44 Interactions stories"), 1):
        at = ctx.time(created)
        if kind == "vue":
            ctx.add(
                "story_views", story_id=ctx.id(story), viewer_id=ctx.id(viewer),
                first_viewed_at=at, last_viewed_at=at,
            )
        elif kind == "like":
            ctx.add(
                "story_likes", story_id=ctx.id(story), user_id=ctx.id(viewer), created_at=at,
            )
        elif kind == "commentaire":
            # The current story_comments SELECT policy exposes rows to every
            # authenticated role, including for stories with restricted audiences.
            if story_scope[story] == "public":
                ctx.add(
                    "story_comments", id=ctx.id(f"STORY-COMMENT-{index}"),
                    story_id=ctx.id(story), author_id=ctx.id(viewer), content=text,
                    created_at=at,
                )
        else:
            raise ValueError(f"Unknown workbook story interaction: {kind}")

    for highlight, author, title, story, created, position in ctx.rows("45 À la une"):
        ctx.add(
            "story_highlights", id=ctx.id(highlight), owner_id=ctx.id(author),
            title=title, cover_story_id=ctx.id(story), position=position, created_at=ctx.time(created),
        )
        ctx.add(
            "story_highlight_items", highlight_id=ctx.id(highlight), story_id=ctx.id(story),
            position=position, added_at=ctx.time(created),
        )


def build(ctx):
    """Build network, posts and stories before the conversation shares."""
    outing = _anchor_outing(ctx)
    owned_carnets = {
        (event, author): carnet
        for carnet, author, _journey, event, _city, _title, *_ in ctx.rows("63 Carnets")
        if event == ANCHOR_PAST and author == ANCHOR
    }
    _build_network(ctx)
    _build_posts(ctx, owned_carnets, outing)
    _build_stories(ctx, owned_carnets, outing)


def finish(ctx):
    """Map post interactions and add the anchor's real public post share."""
    posts = {row[0]: row for row in ctx.rows("40 Posts")}
    anchor_post, = [
        row for row in posts.values()
        if row[10] == ANCHOR_FUTURE and row[8] == "public" and row[11] is None
    ]
    anchor_post_id = anchor_post[0]
    anchor_repost, = [row for row in posts.values() if row[1] == ANCHOR and row[11] == anchor_post_id]
    anchor_group, = [row for row in ctx.rows("50 Groupes") if row[4] == ANCHOR_FUTURE]
    anchor_conversation = anchor_group[11]
    date_label, _ = _anchor_outing(ctx)
    profiles = {row[0]: row[2] for row in ctx.rows("10 Profils")}
    profiles_by_conversation = defaultdict(set)
    for conversation, profile, _date, _role, _status in ctx.rows("54 Membres conversations"):
        profiles_by_conversation[conversation].add(profile)
    if ANCHOR not in profiles_by_conversation[anchor_conversation]:
        raise ValueError("The demo persona must belong to the demo group's conversation")

    recorded_anchor_share = False
    for row_id, kind, post, person, created, _origin in ctx.rows("42 Interactions posts"):
        if kind == "vue simulée":
            continue  # Workbook-only metric. No collection event happened.
        table = INTERACTION_TABLES[kind]
        values = {
            "id": ctx.id(row_id),
            "post_id": ctx.id(post),
            "user_id": ctx.id(person),
            "created_at": ctx.time(created),
        }
        if table == "post_shares" and post == anchor_post_id and person == ANCHOR:
            if recorded_anchor_share:
                raise ValueError("The demo post must have exactly one anchor share")
            recorded_anchor_share = True
            message_id = ctx.id("MESSAGE-DEMO-ANCHOR-SHARE")
            share_time = ctx.time(anchor_repost[2])
            post_uuid = str(ctx.id(post))
            title = f"Lille · boucle du {date_label}"
            ctx.add(
                "messages", id=message_id, conversation_id=ctx.id(anchor_conversation),
                sender_id=ctx.id(ANCHOR), content=title, type="text", message_type="post",
                metadata={
                    "post_id": post_uuid,
                    "post_url": f"/communaute?post={post_uuid}",
                    "title": title,
                    "image_url": None,
                    "author_name": profiles[anchor_post[1]],
                    "author_avatar": None,
                },
                created_at=share_time, updated_at=share_time,
            )
            values.update(
                conversation_id=ctx.id(anchor_conversation), message_id=message_id,
                created_at=share_time,
            )
        ctx.add(table, **values)
    if not recorded_anchor_share:
        raise ValueError("The demo post has no recorded anchor share")
