import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONEY_RE, PLUG_RE, sharedNotes, sharedRules } from '../engine/papers';
import { AI_SUGGESTION_PREFIX } from '../engine/advice';
import { untouchedSince } from '../engine/dependencies';
import { isStoredFormalities } from '../engine/formalities';
import { formalitiesBasis } from '../engine/costs';

/**
 * Le script de rattrapage des voyages déjà préparés (lot Z1, `supabase/maintenance/`) est écrit,
 * jamais appliqué par le code : ce test garde ses textes neutres, sa zone euro et ses expressions
 * alignés sur le moteur (`engine/papers.ts`), pour qu'il rende exactement ce qu'une préparation
 * d'aujourd'hui range. Son exécution a été éprouvée à part sur un PostgreSQL jetable.
 */
const FILE = path.join(process.cwd(), 'supabase/maintenance/lot_z1_vie_privee_rattrapage.sql');
const sql = fs.readFileSync(FILE, 'utf8');
/** Ce que la préparation écrit (dépenses, horodatage de l'exécution) : le script en dépend. */
const autofillSrc = fs.readFileSync(path.join(process.cwd(), 'src/features/compas/server/autofillActions.ts'), 'utf8');
/** Le SQL sans ses lignes de commentaire. */
const code = sql
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n');

describe('script de rattrapage de vie privée (écrit, non appliqué)', () => {
  it('une transaction, un contrôle avant/après, jamais appliqué seul', () => {
    expect(sql).toContain('SCRIPT ÉCRIT, NON APPLIQUÉ');
    expect(sql).toMatch(/ÉTAPE A — CONTRÔLE \(lecture seule\)/);
    expect(sql).toMatch(/ÉTAPE B — CORRECTION \(une seule transaction\)/);
    expect(code).toMatch(/^begin;$/m);
    expect(code).toMatch(/^commit;/m);
    expect(code.indexOf('begin;')).toBeLessThan(code.indexOf('commit;'));
    // Le contrôle (SELECT) précède la transaction.
    expect(code.indexOf('with t0 as')).toBeLessThan(code.indexOf('begin;'));
  });

  it('ne touche que les voyages : ni le profil voyageur, ni un secret, ni une autre table', () => {
    expect(code).not.toMatch(/user_traveller/);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}|\bsk-[A-Za-z0-9]{10,}|service_role|password|api[_-]?key/i);
    const written = [...code.matchAll(/\b(?:update|delete\s+from|insert\s+into)\s+(?:only\s+)?([\w.]+)/gi)].map((m) => m[1]);
    expect([...new Set(written)].sort()).toEqual(['public.trip_expenses', 'public.trips']);
    // Pas de migration appliquée par mégarde : aucun DDL durable (les fonctions sont dans pg_temp).
    expect(code).not.toMatch(/\b(?:alter\s+\w+|drop\s+(?:table|function|schema|index|trigger|policy|view|type|column)|truncate)\b/i);
    for (const m of code.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w.]+)/gi)) expect(m[1]).toMatch(/^pg_temp\./);
    for (const m of code.matchAll(/create\s+temp(?:orary)?\s+table\s+([\w.]+)[^;]*;/gi)) expect(m[0]).toMatch(/on commit drop/);
  });

  it('est idempotent par construction : tout UPDATE est gardé par « is distinct from » ou une valeur qui change', () => {
    const updates = [...code.matchAll(/update\s+public\.\w+[\s\S]*?;/gi)].map((m) => m[0]);
    expect(updates).toHaveLength(3);
    // Métadonnées des voyages : seulement si la valeur change.
    expect(updates[0]).toMatch(/is distinct from/);
    // Enveloppe : seulement si elle vaut encore l'ancien total et qu'il y a des formalités à retirer.
    expect(updates[1]).toMatch(/b\.removed > 0/);
    // Base des dépenses gardées : seulement tant qu'elle nomme encore la nationalité.
    expect(updates[2]).toMatch(/like '%ressortissant français%'/);
    expect(updates[2]).toMatch(/not f\.supprimable/);
  });

  describe('dépenses « Formalités » : supprimer seulement l’intact, neutraliser le reste', () => {
    /** Texte sans retours à la ligne ni espaces multiples, pour comparer des blocs de l'étape A et de B.2. */
    const flat = (t: string) => t.replace(/\s+/g, ' ');
    const codeFlat = flat(code);
    const CLASSIFY = flat(`case when (t.metadata #>> '{compas,autofill,at}') ~ '`);

    it('le classement « supprimable » est le même texte à l’étape A et en B.2', () => {
      const cases = [...codeFlat.matchAll(/case when \(t\.metadata #>> '\{compas,autofill,at\}'\) ~ '[^']+' then .*? else false end as supprimable/g)].map((m) => m[0]);
      expect(cases).toHaveLength(2);
      expect(cases[0]).toBe(cases[1]);
      expect(codeFlat).toContain(CLASSIFY);
      // Les mêmes filtres de reconnaissance (écrite par une préparation, base « ressortissant français »).
      const wheres = [...codeFlat.matchAll(/where e\.title like 'Formalités : %' and e\.metadata ->> 'autofill' is not null and e\.metadata ->> 'basis' like '%ressortissant français%'/g)];
      expect(wheres).toHaveLength(2);
    });

    it('supprimable = prévue (is_planned) ET jamais retouchée (updated_at borné par autofill.at et par created_at)', () => {
      const [block] = [...codeFlat.matchAll(/case when \(t\.metadata[^;]*? as supprimable/g)].map((m) => m[0]);
      expect(block).toContain('then e.is_planned');
      expect(block).toContain("and e.updated_at <= (t.metadata #>> '{compas,autofill,at}')::timestamptz + interval '5 seconds'");
      expect(block).toContain("and e.updated_at <= e.created_at + interval '5 seconds'");
      // Sans horodatage lisible : jamais supprimable (on neutralise), et le cast n'est atteint que si le texte est valide.
      expect(block).toMatch(/else false end as supprimable/);
    });

    it('la marge de 5 s est celle d’untouchedSince, et le motif de date accepte l’horodatage que la préparation écrit', () => {
      const margin = /interval '(\d+) seconds'/.exec(sql);
      expect(margin).not.toBeNull();
      const ms = Number((margin as RegExpExecArray)[1]) * 1000;
      const at = '2026-10-01T10:00:00.000Z';
      const base = Date.parse(at);
      expect(untouchedSince(new Date(base + ms).toISOString(), at)).toBe(true);
      expect(untouchedSince(new Date(base + ms + 1).toISOString(), at)).toBe(false);
      const pattern = /\{compas,autofill,at\}'\) ~ '([^']+)'/.exec(sql);
      expect(pattern).not.toBeNull();
      const re = new RegExp((pattern as RegExpExecArray)[1]);
      expect(re.test(new Date().toISOString())).toBe(true);
      expect(re.test(at)).toBe(true);
      expect(re.test('pas une date')).toBe(false);
      expect(re.test('2026-13-45T25:00:00.000Z')).toBe(false);
    });

    it('colle à ce que la préparation écrit : dépense prévue, `autofill` = runId, base, et `at` sur la trace', () => {
      expect(autofillSrc).toMatch(/is_planned: true,\s*metadata: \{ autofill: runId, source: l\.source, basis: l\.basis \}/);
      expect(autofillSrc).toMatch(/autofill: \{\s*runId,\s*at: new Date\(\)\.toISOString\(\),/);
      // La reconnaissance est celle du code (isStoredFormalities) : titre, `autofill`, base « ressortissant français ».
      const basis = formalitiesBasis('2026-09-03');
      expect(isStoredFormalities({ title: 'Formalités : ESTA (40 $)', metadata: { autofill: 'run-1', basis } })).toBe(true);
      expect(basis).toContain('ressortissant français');
      expect(sql).toContain("e.title like 'Formalités : %'");
    });

    it('seules les supprimables sont supprimées et retirées des identifiants ; les autres gardent leur ligne', () => {
      const del = /delete from public\.trip_expenses e[\s\S]*?;/i.exec(code)?.[0] ?? '';
      expect(del).toMatch(/and f\.supprimable/);
      const fix = /pg_temp\.z1_fix_metadata\([\s\S]*?\) as metadata/.exec(code)?.[0] ?? '';
      expect(fix).toMatch(/where f\.trip_id = t\.id and f\.supprimable/);
    });

    it('la base neutralisée ne dit rien du profil, et le code ne la reconnaît plus comme « Formalités » rangée', () => {
      const m = /to_jsonb\('([^']+)'::text\)/.exec(code);
      expect(m).not.toBeNull();
      const neutral = (m as RegExpExecArray)[1];
      expect(neutral).not.toMatch(/français|francais|ressortissant|nationalit|passeport|résident|domicile/i);
      expect(isStoredFormalities({ title: 'Formalités : ESTA (40 $)', metadata: { autofill: 'run-1', basis: neutral } })).toBe(false);
      // Seule la base change : ni le montant, ni is_planned, ni le titre ne sont réécrits.
      const upd = /update public\.trip_expenses e[\s\S]*?;/i.exec(code)?.[0] ?? '';
      expect(upd).toMatch(/set metadata = jsonb_set\(e\.metadata, '\{basis\}'/);
      expect(upd).not.toMatch(/\bamount\b|is_planned\s*=|\btitle\s*=/);
    });

    it('l’enveloppe : abaissée du seul montant supprimé, remise à NULL si c’était tout, jamais négative', () => {
      const budget = /create temp table z1_budget[\s\S]*?;/i.exec(code)?.[0] ?? '';
      expect(flat(budget)).toMatch(/from z1_formalities f where f\.trip_id = t\.id and f\.supprimable and f\.run = /);
      const upd = flat(/update public\.trips t\s+set estimated_budget[\s\S]*?;/i.exec(code)?.[0] ?? '');
      expect(upd).toContain('set estimated_budget = nullif(b.old_total - b.removed, 0)');
      expect(upd).toContain('t.estimated_budget = b.old_total');
      expect(upd).toContain('b.removed > 0');
      expect(upd).toContain('b.removed <= b.old_total');
      expect(upd).toContain("t.metadata #>> '{compas,autofill,budgetSet}' = 'true'");
      // NULL = « pas de budget » (chk_trips_budget l'admet) : l'annulation du préremplissage fait de même.
      expect(autofillSrc).toMatch(/run\.budgetSet \? \{ estimated_budget: null \}/);
      // Jamais 0 : le script ne pose ni `= 0` ni `greatest` sur l'enveloppe.
      expect(upd).not.toMatch(/estimated_budget = 0\b/);
    });

    it('le contrôle de l’étape A compte séparément supprimables, neutralisables, à vérifier et enveloppes', () => {
      for (const col of [
        'depenses_formalites_supprimables',
        'depenses_formalites_a_neutraliser',
        'dont_reglees',
        'depenses_formalites_a_verifier',
        'enveloppes_a_abaisser',
        'dont_remises_a_vide',
      ])
        expect(code).toContain(`as ${col}`);
      expect(code).not.toContain('depenses_formalites_a_supprimer');
      // « À vérifier » = « Formalités : … » que le script ne reconnaît pas (rien à supprimer ni à neutraliser).
      expect(flat(code)).toContain("not exists (select 1 from formalities f where f.id = e.id)");
      // Les enveloppes comptées sont celles que B.5 touchera (mêmes conditions).
      expect(flat(code)).toContain('where estimated_budget = old_total and removed > 0 and removed <= old_total');
    });
  });

  it('les lignes neutres sont exactement celles que la préparation range', () => {
    const [papers, plugs] = sharedNotes('US', 'États-Unis', true);
    const asTemplate = (line: string, ...values: string[]) => values.reduce((t, v) => t.replace(v, '%s'), line);
    expect(sql).toContain(`'${asTemplate(papers, 'États-Unis')}'`);
    expect(sql).toContain(`'${asTemplate(plugs, 'A/B', 'États-Unis')}'`);
    // Le motif de reconnaissance d'une ligne déjà neutre : mêmes mots, mêmes apostrophes.
    expect(sql).toContain(String.raw`^Papiers : conditions d’entrée \(.+\) à vérifier auprès du service officiel de ton pays avant de partir\.$`);
    expect(sql).toContain(String.raw`^Prises de type [^ :]+ \(.+\) : vérifie que tes chargeurs s’y branchent\.$`);
    expect(papers).toMatch(/^Papiers : conditions d’entrée \(.+\) à vérifier auprès du service officiel de ton pays avant de partir\.$/);
    expect(plugs).toMatch(/^Prises de type [^ :]+ \(.+\) : vérifie que tes chargeurs s’y branchent\.$/);
  });

  it('le préfixe des conseils de l’IA est celui du code', () => {
    expect(sql).toContain(`'${AI_SUGGESTION_PREFIX}%'`);
  });

  it('la zone euro du script est celle des règles', () => {
    const listed = /euro boolean := code is not null and code = any \(array\[([^\]]+)\]/.exec(sql);
    expect(listed).not.toBeNull();
    const inSql = [...(listed as RegExpExecArray)[1].matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort();
    const inCode: string[] = [];
    for (let a = 65; a <= 90; a += 1)
      for (let b = 65; b <= 90; b += 1) {
        const cc = String.fromCharCode(a, b);
        if (sharedRules(cc, cc, true).euro) inCode.push(cc);
      }
    expect(inSql).toEqual(inCode.sort());
  });

  it('les expressions de change et de prises sont celles du filtre de l’IA (\\b devient \\y en PostgreSQL)', () => {
    const grab = (name: string) => new RegExp(`${name}\\s+constant text := \\$re\\$(.+?)\\$re\\$;`).exec(sql)?.[1];
    expect(grab('money_re')).toBe(MONEY_RE.source.replace(/\\b/g, String.raw`\y`));
    expect(grab('plug_re')).toBe(PLUG_RE.source);
    // Le contrôle de l'étape A les reprend à l'identique.
    expect(sql).toContain(MONEY_RE.source.replace(/\\b/g, String.raw`\y`).replace(/\[’'\]/, "[’'']"));
    expect(sql).toContain(PLUG_RE.source);
  });
});
