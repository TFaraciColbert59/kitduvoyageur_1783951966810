import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('prêts — statuts et libération de l’objet', () => {
  const statuses = read('supabase/migrations/20261022104000_loan_pending_and_dispute.sql');
  const release = read('supabase/migrations/20261022106000_loan_release_with_new_statuses.sql');

  it('autorise les statuts en_attente et annule', () => {
    expect(statuses).toContain("'en_attente'");
    expect(statuses).toContain("'annule'");
    expect(statuses).toContain('materiel_loans_status_check');
  });

  it('ne considère comme engageants que en_cours et en_retard', () => {
    expect(release).toContain("status in ('en_cours','en_retard')");
    expect(release).not.toContain("and status<>'rendu'");
  });

  it('libère l’objet lors d’une annulation de prêt actif', () => {
    expect(release).toContain("new.status='annule' and old.status in ('en_cours','en_retard')");
    expect(release).toContain("update public.product_ownership set status='en_stock'");
  });

  it('return_inventory_item ne clôt que les prêts réellement actifs', () => {
    expect(release).toContain(
      "where product_ownership_id=p_id and lender_id=auth.uid() and status in ('en_cours','en_retard')"
    );
  });
});
