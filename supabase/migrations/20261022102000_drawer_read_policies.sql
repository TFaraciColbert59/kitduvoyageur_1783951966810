-- 2026-10-22 — Politiques de lecture nécessaires aux 5 slots du drawer Profil.
-- 1) geo_massifs : donnée géographique publique, lisible par tous pour le passeport.
drop policy if exists geo_massifs_read_public on public.geo_massifs;
create policy geo_massifs_read_public on public.geo_massifs
  for select to anon, authenticated using (true);

-- 2) product_ownership : les deux parties d'un prêt peuvent lire l'objet prêté
--    (nom, photo, état), sans exposer l'inventaire complet d'autrui.
drop policy if exists product_ownership_select_loan_involved on public.product_ownership;
create policy product_ownership_select_loan_involved on public.product_ownership
  for select to authenticated using (
    exists (
      select 1 from public.materiel_loans l
      where l.product_ownership_id = product_ownership.id
        and (l.lender_id = auth.uid() or l.borrower_id = auth.uid())
    )
  );
