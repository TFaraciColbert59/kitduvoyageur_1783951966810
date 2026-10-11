import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONEY_RE, PLUG_RE, sharedNotes, sharedRules } from '../engine/papers';
import { AI_SUGGESTION_PREFIX } from '../engine/advice';

/**
 * Le script de rattrapage des voyages déjà préparés (lot Z1, `supabase/maintenance/`) est écrit,
 * jamais appliqué par le code : ce test garde ses textes neutres, sa zone euro et ses expressions
 * alignés sur le moteur (`engine/papers.ts`), pour qu'il rende exactement ce qu'une préparation
 * d'aujourd'hui range. Son exécution a été éprouvée à part sur un PostgreSQL jetable.
 */
const FILE = path.join(process.cwd(), 'supabase/maintenance/lot_z1_vie_privee_rattrapage.sql');
const sql = fs.readFileSync(FILE, 'utf8');
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
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatch(/is distinct from/);
    expect(updates[1]).toMatch(/b\.removed > 0/);
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
