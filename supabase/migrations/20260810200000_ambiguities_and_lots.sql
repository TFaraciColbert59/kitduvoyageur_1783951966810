-- LOT 1.4 : Tables de détail pour events et topics
CREATE TABLE IF NOT EXISTS public.club_event_participants (
  event_id UUID REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.club_event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read participants" ON public.club_event_participants FOR SELECT USING (true);
CREATE POLICY "Users can manage own participation" ON public.club_event_participants FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.club_topic_likes (
  topic_id UUID REFERENCES public.club_topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id, user_id)
);
ALTER TABLE public.club_topic_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read likes" ON public.club_topic_likes FOR SELECT USING (true);
CREATE POLICY "Users can manage own likes" ON public.club_topic_likes FOR ALL USING (user_id = auth.uid());

-- LOT 6 : Boutique persistance détaillée
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_eur NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view stock movements" ON public.stock_movements FOR SELECT USING (is_admin());

CREATE TABLE IF NOT EXISTS public.loyalty_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty history" ON public.loyalty_history FOR SELECT USING (user_id = auth.uid());

-- LOT 8 : Messagerie & Notifications
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT USING (
  id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view members" ON public.conversation_participants FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view and send messages" ON public.messages FOR ALL USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
-- LOT 4 : Fusion inventaire (Prêts et réparations)
CREATE TABLE IF NOT EXISTS public.gear_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  gear_item_id UUID REFERENCES public.gear_items(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  loan_date DATE NOT NULL,
  expected_return_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.gear_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gear loans" ON public.gear_loans FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.gear_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  gear_item_id UUID REFERENCES public.gear_items(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  cost_eur NUMERIC,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.gear_repairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gear repairs" ON public.gear_repairs FOR ALL USING (user_id = auth.uid());
