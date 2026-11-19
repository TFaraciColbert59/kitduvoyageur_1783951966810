"""Map journey, trail diary, activity and private inventory fixtures."""

from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TRIP_ACTIVITY = {
    "randonnée": "hiking",
    "marche": "hiking",
    "course": "running",
    "vélo": "cycling",
    "kayak": "water",
    "atelier": "cultural",
}
RECORDED_SPORT = {
    "randonnée": "rando",
    "marche": "rando",
    "course": "course",
    "vélo": "velo",
    "kayak": "kayak",
}
ITEM_CATEGORIES = {
    "gourde": "Hydratation",
    "coupe-vent": "Vêtements / Protection",
    "carnet": "Organisation du sac",
}
CURRENCY_OPTIONS = {"EUR", "USD", "GBP", "CHF", "CAD", "JPY"}
LOAN_SCENE_AT = "2026-11-13 18:00:00Z"


def _datetime(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _local_time(ctx, timestamp, zone):
    return _datetime(ctx.time(timestamp)).astimezone(ZoneInfo(zone)).strftime("%H:%M:%S")


def _inventory(ctx, profiles):
    items_by_person = defaultdict(list)
    kits_by_person = {}
    kit_totals = defaultdict(int)
    gear = list(ctx.rows("66 Équipement"))
    for kit, _, _, _, quantity, weight, _, _ in gear:
        kit_totals[kit] += quantity * weight
    for kit, person, kit_name, item, quantity, weight, provenance, reason in gear:
        owner = ctx.id(person)
        joined = ctx.time(profiles[person][41])
        if person not in kits_by_person:
            kits_by_person[person] = ctx.id(kit)
            ctx.add(
                "materiel_kits",
                id=ctx.id(kit),
                user_id=owner,
                name=kit_name,
                description="Kit de démonstration prévu pour une sortie et le trajet retour.",
                total_weight_g=kit_totals[kit],
                is_public=False,
                is_favorite=person == "P0001",
                client_request_id=f"lkdv-demo:{kit}",
                created_at=joined,
                updated_at=joined,
            )
        category = ITEM_CATEGORIES[item]
        ownership = ctx.id(f"inventory:{kit}:{item}")
        priority = "optional" if item == "carnet" else "recommended"
        condition = "use" if provenance == "occasion fictive" else "bon"
        ctx.add(
            "product_ownership",
            id=ownership,
            user_id=owner,
            name=item,
            category=category,
            weight_g=weight,
            quantity=quantity,
            condition=condition,
            description=f"{reason.capitalize()} · provenance du scénario : {provenance}.",
            listing_mode="personnel",
            status="en_stock",
            created_at=joined,
            updated_at=joined,
        )
        ctx.add(
            "materiel_kit_items",
            id=ctx.id(f"kit-item:{kit}:{item}"),
            kit_id=ctx.id(kit),
            product_ownership_id=ownership,
            user_id=owner,
            owner_id=owner,
            name=item,
            category=category,
            quantity=quantity,
            weight_g=weight,
            condition=condition,
            reason=reason,
            priority=priority,
            carry_mode="base",
            created_at=joined,
            updated_at=joined,
        )
        items_by_person[person].append(
            (ownership, item, category, quantity, weight, priority, condition, reason, provenance)
        )
    return kits_by_person, items_by_person


def _loans(ctx, profiles, items_by_person):
    close_contacts = defaultdict(list)
    for row in ctx.rows("11 Relations"):
        _, first, second, _, strength, _, _, since, status, *_ = row
        if (
            status == "actif"
            and strength in {"fort", "moyen"}
            and profiles[first][9] == profiles[second][9]
            and since < LOAN_SCENE_AT
        ):
            close_contacts[first].append(second)
            close_contacts[second].append(first)
    loan_start = _datetime(ctx.time(LOAN_SCENE_AT))
    for index, (person, items) in enumerate(items_by_person.items()):
        if index % 4 or not close_contacts[person]:
            continue
        borrower = min(close_contacts[person])
        for ownership, _, _, _, _, _, _, _, provenance in items:
            if provenance == "prêt fictif":
                ctx.add(
                    "materiel_loans",
                    id=ctx.id(f"pending-loan:{ownership}:{borrower}"),
                    product_ownership_id=ownership,
                    lender_id=ctx.id(person),
                    borrower_id=ctx.id(borrower),
                    status="en_attente",
                    loaned_at=loan_start.date().isoformat(),
                    due_date=(loan_start + timedelta(days=7)).date().isoformat(),
                    created_at=loan_start.isoformat(),
                    updated_at=loan_start.isoformat(),
                )


def build(ctx):
    profiles = {row[0]: row for row in ctx.rows("10 Profils")}
    events = {row[0]: row for row in ctx.rows("30 Sorties")}
    trip_source = {row[0]: row for row in ctx.rows("60 Voyages")}
    notebook_source = {row[0]: row for row in ctx.rows("63 Carnets")}
    activity_source = {row[3]: row for row in ctx.rows("65 Activités")}
    registered = {}
    attendance = defaultdict(list)
    for event, person, status, signed_up, present, _ in ctx.rows("31 Inscriptions"):
        if status == "registered":
            registered[(event, person)] = signed_up
        if present == "présent":
            attendance[event].append(person)
    participants = defaultdict(list)
    for trip, person, _, event in ctx.rows("62 Participants voyages"):
        participants[trip].append((person, registered[(event, person)]))
    kits, inventory = _inventory(ctx, profiles)
    _loans(ctx, profiles, inventory)
    for trip, owner, title, place, country, created, start, end, event, group, state in trip_source.values():
        _, _, organizer, _, _, activity, _, _, _, zone, *_ = events[event]
        trip_id = ctx.id(trip)
        owner_id = ctx.id(owner)
        crew = ctx.id(f"crew:{trip}")
        created_at = ctx.time(created)
        completed = state == "terminé"
        ctx.add(
            "crews",
            id=crew,
            name=f"{title[:68]} · Équipe",
            slug=f"lkdv-demo-{trip.lower()}-{str(crew)[:8]}",
            theme="Aventure",
            visibility="private",
            created_by=owner_id,
            auto_created=True,
            max_members=max(12, 1 + len(participants[trip])),
            created_at=created_at,
            updated_at=created_at,
        )
        ctx.add(
            "crew_members",
            crew_id=crew,
            user_id=owner_id,
            role="owner",
            status="active",
            joined_at=created_at,
        )
        ctx.add(
            "trips",
            id=trip_id,
            slug=f"lkdv-demo-{trip.lower()}-{str(trip_id)[:8]}",
            title=title,
            description=events[event][21],
            destination_name=place,
            destination_country_code=country,
            start_date=ctx.date(start, zone),
            end_date=ctx.date(end, zone),
            user_id=owner_id,
            status="completed" if completed else "planned",
            visibility="private",
            primary_activity=TRIP_ACTIVITY[activity],
            budget_currency=profiles[owner][17] if profiles[owner][17] in CURRENCY_OPTIONS else "EUR",
            group_id=ctx.id(group),
            kit_id=kits.get(owner),
            crew_id=crew,
            party_size=1 + len(participants[trip]),
            metadata={"demo_event_id": str(ctx.id(event)), "destination_country_code": country, "is_demo": True},
            created_at=created_at,
            updated_at=ctx.time(end) if completed else created_at,
        )
        # An existing trip trigger creates the owner's collaboration row.
        ctx.add(
            "trip_participants",
            trip_id=trip_id,
            user_id=owner_id,
            role="owner",
            status="confirmed",
            joined_at=created_at,
        )
        for person, signed_up in participants[trip]:
            joined = ctx.time(max(signed_up, created))
            member = ctx.id(person)
            organizer_role = person == organizer
            ctx.add(
                "crew_members",
                crew_id=crew,
                user_id=member,
                role="organizer" if organizer_role else "member",
                status="active",
                joined_at=joined,
            )
            ctx.add(
                "trip_participants",
                trip_id=trip_id,
                user_id=member,
                role="organizer" if organizer_role else "member",
                status="confirmed",
                joined_at=joined,
            )
            # The trip roadbook reads can_read_trip, which uses collaborators for private trips.
            ctx.add(
                "trip_collaborators",
                id=ctx.id(f"trip-collaborator:{trip}:{person}"),
                trip_id=trip_id,
                user_id=member,
                role="editor" if organizer_role else "viewer",
                joined_at=joined,
                invited_by=owner_id,
                created_at=joined,
                updated_at=joined,
            )
        for ownership, item, category, quantity, weight, priority, condition, reason, _ in inventory.get(owner, []):
            ctx.add(
                "trip_items",
                id=ctx.id(f"trip-item:{trip}:{item}"),
                trip_id=trip_id,
                inventory_item_id=ownership,
                item_name=item,
                category=category,
                quantity=quantity,
                weight_grams=weight,
                owner_id=owner_id,
                priority=priority,
                condition=condition,
                reason=reason,
                is_packed=completed,
                packed_by=owner_id if completed else None,
                status="packed" if completed else "needed",
                created_at=created_at,
                updated_at=created_at,
            )
    steps_by_trip = defaultdict(list)
    for trip, order, title, when, location, detail in ctx.rows("61 Étapes"):
        _, _, _, _, _, created, start, _, event, _, _ = trip_source[trip]
        zone = events[event][9]
        local_day = (_datetime(ctx.time(when)).astimezone(ZoneInfo(zone)).date()
                     - _datetime(ctx.time(start)).astimezone(ZoneInfo(zone)).date()).days
        day_number = 1 + local_day
        steps_by_trip[trip].append((order, day_number, title, when, location, detail))
        ctx.add(
            "trip_steps",
            id=ctx.id(f"trip-step:{trip}:{order}"),
            trip_id=ctx.id(trip),
            order_index=order - 1,
            day_number=day_number,
            title=title,
            description=detail,
            location_name=location,
            start_time=_local_time(ctx, when, zone),
            metadata={"planned_at": ctx.time(when)},
            created_at=ctx.time(created),
            updated_at=ctx.time(created),
        )
    notebooks_by_trip = {}
    for carnet, owner, trip, event, place, title, start, end, created, _, distance, gain, group in notebook_source.values():
        country = trip_source[trip][4]
        zone = events[event][9]
        carnet_id = ctx.id(carnet)
        owner_id = ctx.id(owner)
        notebooks_by_trip[trip] = carnet
        start_date = ctx.date(start, zone)
        end_date = ctx.date(end, zone)
        created_at = ctx.time(created)
        ctx.add(
            "carnets",
            id=carnet_id,
            author_id=owner_id,
            trip_id=ctx.id(trip),
            groupe_id=ctx.id(group),
            title=title,
            destination=place,
            description=events[event][21],
            start_date=start_date,
            end_date=end_date,
            country_iso=country,
            visibility="public" if carnet == "CA00001" else "private",
            distance_km=distance or 0,
            denivele_m=gain or 0,
            nb_nuits=(_datetime(end_date).date() - _datetime(start_date).date()).days,
            nb_voyageurs=max(1, len(attendance[event])),
            lieu_depart=place,
            lieu_arrivee=place,
            live_sharing=False,
            client_request_id=f"lkdv-demo:{carnet}",
            created_at=created_at,
            updated_at=created_at,
        )
        for order, (_, item, category, quantity, weight, _, _, reason, _) in enumerate(inventory.get(owner, ()), 1):
            ctx.add(
                "carnet_kit_items",
                id=ctx.id(f"carnet-kit:{carnet}:{item}"),
                carnet_id=carnet_id,
                nom=item,
                detail=category,
                poids_g=quantity * weight,
                sort_order=order,
                verdict="utile",
                verdict_note=reason,
                jours_utilises=[1],
            )
        for order, day, step_title, when, location, detail in steps_by_trip[trip]:
            ctx.add(
                "carnet_etapes",
                id=ctx.id(f"carnet-etape:{carnet}:{order}"),
                carnet_id=carnet_id,
                jour_numero=day,
                ordre=order,
                date_etape=ctx.date(when, zone),
                lieu_depart=location,
                lieu_arrivee=location,
                recit=f"{step_title}. {detail}",
                created_by=owner_id,
                created_at=created_at,
                updated_at=created_at,
            )
    first_moment_by_carnet = {}
    for carnet, person, day, when, quote, place in ctx.rows("64 Moments"):
        author_name = profiles[person][2]
        if person == "P0001":
            author_name = getattr(ctx, "anchor_name", None) or author_name
        row = notebook_source[carnet]
        trip, event = row[2:4]
        activity = activity_source.get(trip)
        posted = _datetime(ctx.time(row[8]))
        offset = _datetime(ctx.time(when)) - _datetime(ctx.time(row[6]))
        moment_id = ctx.id(f"carnet-moment:{carnet}:{day}:{when}")
        first_moment_by_carnet.setdefault(carnet, moment_id)
        ctx.add(
            "carnet_moments",
            id=moment_id,
            carnet_id=ctx.id(carnet),
            jour_numero=day,
            heure=_local_time(ctx, when, events[event][9])[:5],
            citation=quote,
            auteur_nom=author_name,
            auteur_id=ctx.id(person),
            lieu=place,
            source="manuel",
            moment_type="text",
            moment_timestamp=ctx.time(when),
            hike_session_id=ctx.id(f"hike:{activity[0]}") if activity else None,
            created_at=(posted + offset).isoformat(),
        )
    # The demo story and follow-up post both lead to this one public diary.
    anchor = notebook_source["CA00001"]
    carnet_id = ctx.id(anchor[0])
    anchor_owner = ctx.id(anchor[1])
    curated_event = anchor[3]
    created_at = _datetime(ctx.time(anchor[8]))
    readers = sorted(person for person in attendance[curated_event] if ctx.id(person) != anchor_owner)
    for index, person in enumerate(readers):
        reader_id = ctx.id(person)
        seen_at = (created_at + timedelta(days=1, hours=index)).isoformat()
        ctx.add(
            "carnet_views",
            id=ctx.id(f"carnet-view:{anchor[0]}:{person}"),
            carnet_id=carnet_id,
            user_id=reader_id,
            created_at=seen_at,
        )
        if index % 2 == 0:
            ctx.add(
                "carnet_likes",
                id=ctx.id(f"carnet-like:{anchor[0]}:{person}"),
                carnet_id=carnet_id,
                user_id=reader_id,
                reaction="useful",
                created_at=seen_at,
            )
        if index == 0:
            ctx.add(
                "carnet_favorites",
                id=ctx.id(f"carnet-favorite:{anchor[0]}:{person}"),
                carnet_id=carnet_id,
                user_id=reader_id,
                created_at=seen_at,
            )
            ctx.add(
                "carnet_comments",
                id=ctx.id(f"carnet-comment:{anchor[0]}:{person}"),
                carnet_id=carnet_id,
                author_id=reader_id,
                content="Merci d’avoir noté l’arrêt pour le retour. Je le garde pour la prochaine boucle.",
                created_at=seen_at,
            )
            ctx.add(
                "carnet_moment_likes",
                moment_id=first_moment_by_carnet[anchor[0]],
                user_id=reader_id,
                created_at=seen_at,
            )
    for activity, owner, event, trip, sport, start, end, duration, moving, distance, gain, _, _, _ in activity_source.values():
        owner_id = ctx.id(owner)
        session = ctx.id(activity)
        summary = ctx.id(f"hike:{activity}")
        started_at, ended_at = ctx.time(start), ctx.time(end)
        sport_code = RECORDED_SPORT[sport]
        ctx.add(
            "activity_sessions",
            id=session,
            user_id=owner_id,
            sport=sport_code,
            status="finished",
            share_level="none",
            client_session_id=session,
            started_at=started_at,
            ended_at=ended_at,
            distance_m=distance,
            elev_gain_m=gain,
            moving_s=moving,
            created_at=started_at,
            updated_at=ended_at,
        )
        # Summary mirrors the app's finish operation, including no invented GPS trace.
        ctx.add(
            "hike_sessions",
            id=summary,
            user_id=owner_id,
            activity_session_id=session,
            carnet_id=ctx.id(notebooks_by_trip[trip]),
            kit_id=kits.get(owner),
            trip_id=ctx.id(trip),
            title=trip_source[trip][2],
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=duration,
            distance_km=distance / 1000,
            elevation_gain_m=gain,
            visibility="private",
            processing_status="processed",
            processed_at=ended_at,
            created_at=ended_at,
            updated_at=ended_at,
        )
        for person in sorted(set(attendance[event]) | {owner}):
            ctx.add(
                "hike_session_participants",
                session_id=summary,
                user_id=ctx.id(person),
                role="owner" if person == owner else "guest",
                created_at=ended_at,
            )
        ctx.add(
            "outing_share_metrics",
            session_id=summary,
            user_id=owner_id,
            visibility={"distance": True, "duration": True, "elevationGain": True},
            created_at=ended_at,
            updated_at=ended_at,
        )
        for ownership, item, _, quantity, weight, *_ in inventory.get(owner, []):
            ctx.add(
                "hike_session_gear",
                id=ctx.id(f"hike-gear:{activity}:{item}"),
                session_id=summary,
                kit_id=kits[owner],
                item_name=item,
                weight_g=quantity * weight,
                gear_item_id=ownership,
                sport=sport_code,
                created_at=ended_at,
            )
