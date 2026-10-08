"""Lieux habités GeoNames -> TSV compact pour public.geo_places (lot E).
Usage : python3 -I scripts/geo/prep_geo_places.py <dossier des dumps> <sortie.tsv>
cities500 (monde) + tous les lieux habités de FR, CH, IT, AT.
Ensuite : npx tsx scripts/geo/import_geo_places.ts <sortie.tsv>."""
import sys, os
src, out = sys.argv[1], sys.argv[2]
DETAIL = ['FR', 'CH', 'IT', 'AT']
SKIP = {'PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH', 'PPLCD'}
def kind(code, pop):
    if code == 'PPLC' or pop >= 100_000: return 'city'
    if pop >= 10_000: return 'town'
    if pop >= 200 or code in ('PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLG'): return 'village'
    return 'hamlet'
rows = {}
def take(path, only_p):
    with open(path, encoding='utf-8') as f:
        for line in f:
            c = line.rstrip('\n').split('\t')
            if len(c) < 19 or c[6] != 'P' or c[7] in SKIP: continue
            try:
                gid = int(c[0]); lat = float(c[4]); lon = float(c[5])
                pop = int(c[14] or 0)
            except ValueError:
                continue
            ele = c[15] or ''
            if not ele and c[16] and c[16] not in ('-9999', ''): ele = c[16]
            try: ele = str(int(float(ele))) if ele else ''
            except ValueError: ele = ''
            name = c[1].replace('\t', ' ').strip()
            if not name: continue
            rows[gid] = (str(gid), name, kind(c[7], pop), c[8], c[10][:20], f'{lat:.5f}', f'{lon:.5f}', ele, str(pop), c[17][:40])
take(os.path.join(src, 'cities500.txt'), True)
for cc in DETAIL:
    take(os.path.join(src, cc + '.txt'), True)
with open(out, 'w', encoding='utf-8') as f:
    for r in rows.values():
        f.write('\t'.join(r) + '\n')
from collections import Counter
print(len(rows), Counter(r[2] for r in rows.values()).most_common(), os.path.getsize(out))
