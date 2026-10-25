-- Drop products and listings tables entirely
-- This removes all shop/boutique data from the database

-- Drop dependent tables first
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- Also drop any product-related API check functions if they exist
DROP FUNCTION IF EXISTS public.check_product_trust_score CASCADE;
DROP FUNCTION IF EXISTS public.check_product_neuf CASCADE;
DROP FUNCTION IF EXISTS public.check_product_occasion CASCADE;
