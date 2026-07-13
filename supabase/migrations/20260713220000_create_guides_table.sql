-- Migration: Create guides table
-- Timestamp: 20260713220000

CREATE TABLE IF NOT EXISTS public.guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Destination',
  destination TEXT NOT NULL DEFAULT '',
  read_time INTEGER NOT NULL DEFAULT 5,
  difficulty TEXT NOT NULL DEFAULT 'Débutant',
  image TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guides_slug ON public.guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_author_id ON public.guides(author_id);
CREATE INDEX IF NOT EXISTS idx_guides_featured ON public.guides(featured);
CREATE INDEX IF NOT EXISTS idx_guides_category ON public.guides(category);

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_can_read_guides" ON public.guides;
CREATE POLICY "public_can_read_guides"
  ON public.guides
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "users_manage_own_guides" ON public.guides;
CREATE POLICY "users_manage_own_guides"
  ON public.guides
  FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Seed data
DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;
  END IF;

  INSERT INTO public.guides (slug, title, category, destination, read_time, difficulty, image, alt, excerpt, tags, featured, author_id) VALUES
    ('checklist-sac-a-dos-trek-nepal', 'Checklist complète : sac à dos pour le trek au Népal', 'Checklist', 'Népal', 12, 'Intermédiaire', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800', 'Randonneur avec sac à dos devant les montagnes de l''Himalaya au Népal', 'Tout ce qu''il faut emporter pour un trek en haute altitude au Népal : vêtements, équipement technique, pharmacie et documents.', ARRAY['trek', 'népal', 'himalaya', 'checklist', 'altitude'], true, existing_user_id),
    ('guide-achat-tente-4-saisons', 'Guide d''achat : choisir sa tente 4 saisons', 'Guide d''achat', 'Général', 10, 'Intermédiaire', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800', 'Tente orange installée dans un paysage enneigé en montagne', 'Comparatif des meilleures tentes 4 saisons du marché : critères de choix, poids, résistance au vent et rapport qualité-prix.', ARRAY['tente', 'hiver', 'comparatif', 'achat'], true, existing_user_id),
    ('preparer-voyage-patagonie', 'Préparer son voyage en Patagonie : guide complet', 'Destination', 'Patagonie', 15, 'Expert', 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800', 'Paysage spectaculaire de la Patagonie avec montagnes et lac turquoise', 'De Torres del Paine au Fitz Roy, tout savoir pour organiser un trek en Patagonie : saison idéale, permis, hébergements et équipement.', ARRAY['patagonie', 'trek', 'amérique-du-sud', 'torres-del-paine'], true, existing_user_id),
    ('guide-pratique-voyage-solo-femme', 'Voyager seule en tant que femme : conseils pratiques', 'Guide pratique', 'Général', 8, 'Débutant', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800', 'Femme voyageant seule avec sac à dos dans une ville étrangère', 'Sécurité, logement, rencontres et gestion du budget : tous les conseils pour voyager seule en toute sérénité.', ARRAY['solo', 'femme', 'sécurité', 'conseils'], false, existing_user_id),
    ('comparatif-chaussures-randonnee-2025', 'Comparatif chaussures de randonnée 2025', 'Comparatif', 'Général', 9, 'Débutant', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 'Paire de chaussures de randonnée robustes sur un sentier de montagne', 'Les 10 meilleures chaussures de randonnée testées et comparées : légèreté, imperméabilité, semelle et confort sur longue distance.', ARRAY['chaussures', 'randonnée', 'comparatif', 'équipement'], false, existing_user_id),
    ('checklist-voyage-moto-aventure', 'Checklist voyage moto aventure : l''essentiel', 'Checklist', 'Général', 7, 'Intermédiaire', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Moto d''aventure chargée de bagages sur une route de montagne', 'Équipement de protection, outillage, pièces de rechange et documents : la checklist indispensable pour partir en voyage moto.', ARRAY['moto', 'aventure', 'checklist', 'voyage'], false, existing_user_id),
    ('guide-achat-sac-de-couchage', 'Choisir son sac de couchage : guide d''achat complet', 'Guide d''achat', 'Général', 11, 'Débutant', 'https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?w=800', 'Sac de couchage déroulé dans une tente avec vue sur les étoiles', 'Duvet ou synthétique, température de confort, poids et encombrement : tout pour choisir le sac de couchage adapté à votre pratique.', ARRAY['sac-de-couchage', 'bivouac', 'achat', 'température'], false, existing_user_id),
    ('destination-islande-guide-complet', 'Islande : le guide complet pour un road trip', 'Destination', 'Islande', 14, 'Intermédiaire', 'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=800', 'Route circulaire en Islande avec aurores boréales dans le ciel nocturne', 'Ring Road, aurores boréales, geysers et cascades : planifiez votre road trip en Islande avec ce guide pratique complet.', ARRAY['islande', 'road-trip', 'aurores-boréales', 'europe'], false, existing_user_id)
  ON CONFLICT (slug) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Guides seed data insertion failed: %', SQLERRM;
END $$;
