import json, sys
ev = json.load(open(sys.argv[1] + '/events.json'))
ev = [e for e in ev if e.get('db', 0) > -90 and not str(e['what']).startswith('(')]
ev.sort(key=lambda e: (e['t'], e['stem']))
hdr = open(sys.argv[2]).read()
rows = ['| T (s) | Nature | Stem | Niveau (dB avant gain commun +2,25) | Détail |', '| --- | --- | --- | --- | --- |']
for e in ev:
    rows.append('| %.3f | %s | %s | %+.0f | %s |' % (e['t'], e['what'], e['stem'], e['db'], e.get('note', '')))
print(hdr + '\n'.join(rows) + '\n')
