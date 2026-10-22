import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8');

const statuses = read('20261022104000_loan_pending_and_dispute.sql');
const legacyRelease = read('20261022106000_loan_release_with_new_statuses.sql');
const trust = read('20261022111100_materiel_loan_trust_guard.sql');
const release = read('20261022111300_loan_release_after_annulation.sql');

/** Corps d'une fonction SQL : évite de confondre les blocs d'un même fichier. */
function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`function public.${name}()`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf('$function$;', start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('prêts — statuts et libération de l’objet', () => {
  it('autorise les statuts en_attente et annule', () => {
    expect(statuses).toContain("'en_attente'");
    expect(statuses).toContain("'annule'");
    expect(statuses).toContain('materiel_loans_status_check');
  });

  it('ne considère comme engageants que en_cours et en_retard', () => {
    expect(release).toContain("status in ('en_cours','en_retard')");
    expect(release).not.toContain("and status<>'rendu'");
  });

  it('ne tente plus la libération depuis le garde BEFORE UPDATE', () => {
    const body = functionBody(release, 'inventory_loan_guard');
    expect(body).not.toContain("set status='en_stock'");
    expect(body).not.toContain("new.status='annule' and old.status in ('en_cours','en_retard')");
  });

  it('libère l’objet au retour comme à l’annulation d’un prêt actif', () => {
    const body = functionBody(release, 'inventory_loan_return');
    expect(body).toContain("new.status in ('rendu','annule')");
    expect(body).toContain("old.status in ('en_cours','en_retard')");
    expect(body).toContain("status in ('en_cours','en_retard')");
    expect(body).toContain("update public.product_ownership set status='en_stock'");
    expect(body).toContain('not exists');
    expect(release).toMatch(
      /create trigger inventory_loan_return\s+after update on public\.materiel_loans/i
    );
  });

  it('return_inventory_item ne clôt que les prêts réellement actifs', () => {
    expect(legacyRelease).toContain(
      "where product_ownership_id=p_id and lender_id=auth.uid() and status in ('en_cours','en_retard')"
    );
  });
});

describe('prêts — intégrité des notes et de la date de retour', () => {
  it('installe la garde en BEFORE UPDATE sur materiel_loans', () => {
    expect(trust).toMatch(/create or replace function public\.materiel_loan_trust_guard\(\)/i);
    expect(trust).toMatch(/create trigger materiel_loan_trust_guard/i);
    expect(trust).toMatch(/before update on public\.materiel_loans/i);
    expect(trust).toMatch(
      /for each row execute function public\.materiel_loan_trust_guard\(\)/i
    );
  });

  it('n’autorise chaque note que dans le bon sens', () => {
    expect(trust).toContain('auth.uid() is distinct from old.lender_id');
    expect(trust).toContain("Seul le prêteur peut noter l''emprunteur");
    expect(trust).toContain('auth.uid() is distinct from old.borrower_id');
    expect(trust).toContain("Seul l''emprunteur peut noter le prêteur");
    expect(trust).toContain("errcode='42501'");
  });

  it('n’accepte une note qu’après le retour et jamais deux fois', () => {
    expect(trust).toContain("old.status <> 'rendu' or new.status <> 'rendu'");
    expect(trust).toContain('old.borrower_rating is not null');
    expect(trust).toContain('old.lender_rating is not null');
    expect(trust).toContain("errcode='23514'");
    expect(trust).toContain("La note de l''emprunteur est déjà enregistrée");
    expect(trust).toContain("La note du prêteur est déjà enregistrée");
  });

  it('fige returned_at sauf au passage à rendu, où le serveur l’impose', () => {
    expect(trust).toContain('new.returned_at := coalesce(old.returned_at, current_date)');
    expect(trust).toContain('new.returned_at is distinct from old.returned_at');
    expect(trust).toContain('Date de retour immuable');
    expect(trust).toContain("new.status = 'rendu' and old.status <> 'rendu'");
  });

  it('laisse passer le service role et les migrations', () => {
    expect(trust).toMatch(/if auth\.uid\(\) is null then\s+return new;/i);
    expect(trust).toMatch(
      /revoke all on function public\.materiel_loan_trust_guard\(\) from public, anon, authenticated/i
    );
  });
});
