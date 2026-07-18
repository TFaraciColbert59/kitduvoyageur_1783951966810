-- Migration: ensure gear_items has compartment column
-- Timestamp: 20260718141000

alter table public.gear_items add column if not exists compartment text;
