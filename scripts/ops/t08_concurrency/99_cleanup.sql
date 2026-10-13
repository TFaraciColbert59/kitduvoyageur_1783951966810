-- Nettoyage local : le joueur de test et ses dépendances partent en cascade.
DELETE FROM public.progression_claims WHERE user_id='a0808080-0000-4000-8000-000000000001';
DELETE FROM public.progression_outbox WHERE user_id='a0808080-0000-4000-8000-000000000001';
DELETE FROM public.progression_decisions WHERE user_id='a0808080-0000-4000-8000-000000000001';
DELETE FROM public.reward_transactions WHERE user_id='a0808080-0000-4000-8000-000000000001';
DELETE FROM public.reward_accounts WHERE user_id='a0808080-0000-4000-8000-000000000001';
DELETE FROM public.user_progression WHERE user_id='a0808080-0000-4000-8000-000000000001';
DELETE FROM auth.users WHERE id='a0808080-0000-4000-8000-000000000001';
