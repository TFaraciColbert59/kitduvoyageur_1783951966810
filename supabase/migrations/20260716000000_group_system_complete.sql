-- ============================================================
-- GROUP SYSTEM COMPLETE MIGRATION
-- Tables: travel_groups, group_members, group_messages, group_expenses,
--         group_kit_items, group_tasks, group_polls, group_poll_votes,
--         group_album, group_badges, group_invitations
-- ============================================================

-- 1. ENUMS
DROP TYPE IF EXISTS public.group_visibility CASCADE;
CREATE TYPE public.group_visibility AS ENUM ('public', 'private', 'invite_only');

DROP TYPE IF EXISTS public.group_member_role CASCADE;
CREATE TYPE public.group_member_role AS ENUM ('organizer', 'co_organizer', 'member', 'observer');

DROP TYPE IF EXISTS public.group_member_status CASCADE;
CREATE TYPE public.group_member_status AS ENUM ('pending', 'active', 'left', 'removed');

DROP TYPE IF EXISTS public.group_expense_status CASCADE;
CREATE TYPE public.group_expense_status AS ENUM ('pending', 'settled');

DROP TYPE IF EXISTS public.group_task_status CASCADE;
CREATE TYPE public.group_task_status AS ENUM ('todo', 'in_progress', 'done');

DROP TYPE IF EXISTS public.group_poll_status CASCADE;
CREATE TYPE public.group_poll_status AS ENUM ('open', 'closed');

ALTER TABLE public.travel_groups ADD COLUMN IF NOT EXISTS visibility public.group_visibility DEFAULT 'public'::public.group_visibility;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role public.group_member_role DEFAULT 'member'::public.group_member_role;
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status public.group_member_status DEFAULT 'active'::public.group_member_status;
ALTER TABLE public.group_expenses ADD COLUMN IF NOT EXISTS status public.group_expense_status DEFAULT 'pending'::public.group_expense_status;
ALTER TABLE public.group_tasks ADD COLUMN IF NOT EXISTS status public.group_task_status DEFAULT 'todo'::public.group_task_status;
ALTER TABLE public.group_polls ADD COLUMN IF NOT EXISTS status public.group_poll_status DEFAULT 'open'::public.group_poll_status;

-- 2. CORE TABLES

-- Travel Groups
CREATE TABLE IF NOT EXISTS public.travel_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    destination TEXT,
    theme TEXT DEFAULT 'Aventure',
    cover_url TEXT,
    visibility public.group_visibility DEFAULT 'public'::public.group_visibility,
    invite_code TEXT UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
    max_members INTEGER DEFAULT 20,
    departure_date DATE,
    return_date DATE,
    budget_target NUMERIC(10,2) DEFAULT 0,
    owner_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    group_level INTEGER DEFAULT 1,
    group_xp INTEGER DEFAULT 0,
    optimization_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Group Members
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role public.group_member_role DEFAULT 'member'::public.group_member_role,
    status public.group_member_status DEFAULT 'active'::public.group_member_status,
    weight_capacity INTEGER DEFAULT 15000,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- Group Messages (Chat)
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    reply_to UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
    reactions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Group Expenses (Budget)
CREATE TABLE IF NOT EXISTS public.group_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    paid_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    category TEXT DEFAULT 'Divers',
    split_between UUID[] DEFAULT '{}',
    status public.group_expense_status DEFAULT 'pending'::public.group_expense_status,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Group Kit Items (Shared Equipment)
CREATE TABLE IF NOT EXISTS public.group_kit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    weight_grams INTEGER DEFAULT 0,
    category TEXT DEFAULT 'Divers',
    quantity INTEGER DEFAULT 1,
    is_shared BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Group Tasks (Checklist)
CREATE TABLE IF NOT EXISTS public.group_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status public.group_task_status DEFAULT 'todo'::public.group_task_status,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Group Polls (Votes)
CREATE TABLE IF NOT EXISTS public.group_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    status public.group_poll_status DEFAULT 'open'::public.group_poll_status,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Group Poll Votes
CREATE TABLE IF NOT EXISTS public.group_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.group_polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- Group Album (Photos/Memories)
CREATE TABLE IF NOT EXISTS public.group_album (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    location TEXT,
    taken_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Group Invitations
CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.travel_groups(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    email TEXT,
    token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_travel_groups_owner ON public.travel_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_travel_groups_visibility ON public.travel_groups(visibility);
CREATE INDEX IF NOT EXISTS idx_travel_groups_invite_code ON public.travel_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created ON public.group_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_expenses_group ON public.group_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_group_kit_items_group ON public.group_kit_items(group_id);
CREATE INDEX IF NOT EXISTS idx_group_tasks_group ON public.group_tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_group_polls_group ON public.group_polls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_album_group ON public.group_album(group_id);

-- 4. FUNCTIONS

-- Check if user is group member
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
    AND user_id = p_user_id
    AND status = 'active'
)
$$;

-- Check if user is group organizer or co-organizer
CREATE OR REPLACE FUNCTION public.is_group_organizer(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
    AND user_id = p_user_id
    AND status = 'active'
    AND role IN ('organizer', 'co_organizer')
)
$$;

-- Update group updated_at
CREATE OR REPLACE FUNCTION public.update_group_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 5. ENABLE RLS
ALTER TABLE public.travel_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_album ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- travel_groups: public groups visible to all, private only to members
DROP POLICY IF EXISTS "groups_public_read" ON public.travel_groups;
CREATE POLICY "groups_public_read" ON public.travel_groups
FOR SELECT TO public
USING (visibility = 'public'::public.group_visibility OR owner_id = auth.uid() OR public.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS "groups_auth_insert" ON public.travel_groups;
CREATE POLICY "groups_auth_insert" ON public.travel_groups
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "groups_organizer_update" ON public.travel_groups;
CREATE POLICY "groups_organizer_update" ON public.travel_groups
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_group_organizer(id, auth.uid()))
WITH CHECK (owner_id = auth.uid() OR public.is_group_organizer(id, auth.uid()));

DROP POLICY IF EXISTS "groups_owner_delete" ON public.travel_groups;
CREATE POLICY "groups_owner_delete" ON public.travel_groups
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- group_members
DROP POLICY IF EXISTS "members_read_own_group" ON public.group_members;
CREATE POLICY "members_read_own_group" ON public.group_members
FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "members_join_group" ON public.group_members;
CREATE POLICY "members_join_group" ON public.group_members
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "members_update_own" ON public.group_members;
CREATE POLICY "members_update_own" ON public.group_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS "members_delete_own" ON public.group_members;
CREATE POLICY "members_delete_own" ON public.group_members
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

-- group_messages
DROP POLICY IF EXISTS "messages_member_read" ON public.group_messages;
CREATE POLICY "messages_member_read" ON public.group_messages
FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "messages_member_insert" ON public.group_messages;
CREATE POLICY "messages_member_insert" ON public.group_messages
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "messages_own_delete" ON public.group_messages;
CREATE POLICY "messages_own_delete" ON public.group_messages
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "messages_own_update" ON public.group_messages;
CREATE POLICY "messages_own_update" ON public.group_messages
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- group_expenses
DROP POLICY IF EXISTS "expenses_member_all" ON public.group_expenses;
CREATE POLICY "expenses_member_all" ON public.group_expenses
FOR ALL TO authenticated
USING (public.is_group_member(group_id, auth.uid()))
WITH CHECK (paid_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));

-- group_kit_items
DROP POLICY IF EXISTS "kit_items_member_all" ON public.group_kit_items;
CREATE POLICY "kit_items_member_all" ON public.group_kit_items
FOR ALL TO authenticated
USING (public.is_group_member(group_id, auth.uid()))
WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- group_tasks
DROP POLICY IF EXISTS "tasks_member_all" ON public.group_tasks;
CREATE POLICY "tasks_member_all" ON public.group_tasks
FOR ALL TO authenticated
USING (public.is_group_member(group_id, auth.uid()))
WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- group_polls
DROP POLICY IF EXISTS "polls_member_all" ON public.group_polls;
CREATE POLICY "polls_member_all" ON public.group_polls
FOR ALL TO authenticated
USING (public.is_group_member(group_id, auth.uid()))
WITH CHECK (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));

-- group_poll_votes
DROP POLICY IF EXISTS "votes_member_all" ON public.group_poll_votes;
CREATE POLICY "votes_member_all" ON public.group_poll_votes
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- group_album
DROP POLICY IF EXISTS "album_member_all" ON public.group_album;
CREATE POLICY "album_member_all" ON public.group_album
FOR ALL TO authenticated
USING (public.is_group_member(group_id, auth.uid()))
WITH CHECK (uploaded_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));

-- group_invitations
DROP POLICY IF EXISTS "invitations_organizer_manage" ON public.group_invitations;
CREATE POLICY "invitations_organizer_manage" ON public.group_invitations
FOR ALL TO authenticated
USING (invited_by = auth.uid() OR public.is_group_organizer(group_id, auth.uid()))
WITH CHECK (invited_by = auth.uid() AND public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS "invitations_public_read_by_token" ON public.group_invitations;
CREATE POLICY "invitations_public_read_by_token" ON public.group_invitations
FOR SELECT TO public
USING (true);

-- 7. TRIGGERS
DROP TRIGGER IF EXISTS update_travel_groups_updated_at ON public.travel_groups;
CREATE TRIGGER update_travel_groups_updated_at
    BEFORE UPDATE ON public.travel_groups
    FOR EACH ROW EXECUTE FUNCTION public.update_group_updated_at();

-- 8. SAMPLE DATA
DO $$
DECLARE
    existing_user_id UUID;
    group1_id UUID := gen_random_uuid();
    group2_id UUID := gen_random_uuid();
    group3_id UUID := gen_random_uuid();
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN
        SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

        IF existing_user_id IS NOT NULL THEN
            INSERT INTO public.travel_groups (id, name, description, destination, theme, visibility, departure_date, return_date, budget_target, owner_id, group_level, group_xp, optimization_score)
            VALUES
                (group1_id, 'Trek Himalaya 2026', 'Expedition au camp de base de l''Everest, 14 jours de trek intense', 'Nepal - Everest Base Camp', 'Trek', 'public'::public.group_visibility, '2026-10-01', '2026-10-15', 3500.00, existing_user_id, 3, 1250, 78),
                (group2_id, 'Van Life Scandinavie', 'Road trip en van de Stockholm a Oslo via les fjords', 'Scandinavie', 'Van Life', 'public'::public.group_visibility, '2026-07-20', '2026-08-10', 2200.00, existing_user_id, 2, 680, 65),
                (group3_id, 'Tour du Mont Blanc', 'TMB complet en 11 jours, refuges reserves', 'Alpes - France/Italie/Suisse', 'Randonnee', 'invite_only'::public.group_visibility, '2026-08-05', '2026-08-16', 1800.00, existing_user_id, 1, 200, 55)
            ON CONFLICT (id) DO NOTHING;

            -- Add owner as organizer member
            INSERT INTO public.group_members (group_id, user_id, role, status)
            VALUES
                (group1_id, existing_user_id, 'organizer'::public.group_member_role, 'active'::public.group_member_status),
                (group2_id, existing_user_id, 'organizer'::public.group_member_role, 'active'::public.group_member_status),
                (group3_id, existing_user_id, 'organizer'::public.group_member_role, 'active'::public.group_member_status)
            ON CONFLICT (group_id, user_id) DO NOTHING;

            -- Sample kit items for group1
            INSERT INTO public.group_kit_items (group_id, assigned_to, name, weight_grams, category, quantity)
            VALUES
                (group1_id, existing_user_id, 'Tente 4 saisons', 2800, 'Abri', 1),
                (group1_id, existing_user_id, 'Rechaud MSR', 340, 'Cuisine', 1),
                (group1_id, existing_user_id, 'Filtre eau Sawyer', 85, 'Eau', 1),
                (group1_id, existing_user_id, 'Trousse medicale', 620, 'Securite', 1),
                (group1_id, existing_user_id, 'Corde 50m', 3200, 'Technique', 1)
            ON CONFLICT (id) DO NOTHING;

            -- Sample tasks
            INSERT INTO public.group_tasks (group_id, created_by, title, status, due_date)
            VALUES
                (group1_id, existing_user_id, 'Reserver les vols Katmandou', 'done'::public.group_task_status, '2026-06-01'),
                (group1_id, existing_user_id, 'Obtenir les permits TIMS', 'in_progress'::public.group_task_status, '2026-09-01'),
                (group1_id, existing_user_id, 'Souscrire assurance altitude', 'todo'::public.group_task_status, '2026-09-15'),
                (group1_id, existing_user_id, 'Acheter rations lyophilisees', 'todo'::public.group_task_status, '2026-09-20')
            ON CONFLICT (id) DO NOTHING;

            -- Sample poll
            INSERT INTO public.group_polls (group_id, created_by, question, options, status)
            VALUES
                (group1_id, existing_user_id, 'Quelle date de depart preferez-vous ?', '["1er octobre", "8 octobre", "15 octobre"]'::jsonb, 'open'::public.group_poll_status)
            ON CONFLICT (id) DO NOTHING;

            -- Sample expenses
            INSERT INTO public.group_expenses (group_id, paid_by, title, amount, category)
            VALUES
                (group1_id, existing_user_id, 'Permits TIMS x4', 120.00, 'Administratif'),
                (group1_id, existing_user_id, 'Nuit refuge Namche', 80.00, 'Hebergement')
            ON CONFLICT (id) DO NOTHING;

            -- Sample messages
            INSERT INTO public.group_messages (group_id, user_id, content)
            VALUES
                (group1_id, existing_user_id, 'Salut tout le monde ! Heureux de partir avec vous pour cette aventure !'),
                (group1_id, existing_user_id, 'J''ai trouve des vols Paris-Katmandou a 650 euros, ca vous interesse ?'),
                (group1_id, existing_user_id, 'Super ! Je viens de reserver les permits TIMS, je vous envoie les details.')
            ON CONFLICT (id) DO NOTHING;

        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Sample data insertion failed: %', SQLERRM;
END $$;
