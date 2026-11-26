import re
import xml.etree.ElementTree as ET, math, json, heapq
import numpy as np
src=open('render.py').read()
exec(src.split("mos={}")[0])
H1=51.0
def unit(lon,lat):
    lo,la=math.radians(lon),math.radians(lat); return np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)])
U=unit(LON0,LAT0); E=np.array([-math.sin(math.radians(LON0)),math.cos(math.radians(LON0)),0.0]); Nn=np.cross(U,E)
def project(lon,lat):
    P=unit(lon,lat)*R; C=U*(R+H1); v=P-C; dz=v@(-U); x=(v@E)/dz/tx_; y=(v@Nn)/dz/ty_
    return round(float((x+1)/2*W),1),round(float((1-y)/2*H),1)
t=ET.parse('w.xml').getroot()
nodes={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in t.iter('node')}
ways={w.get('id'):[nd.get('ref') for nd in w.iter('nd')] for w in t.iter('way')}
rel=[r for r in t.iter('relation')][0]; mem=[m.get('ref') for m in rel.iter('member') if m.get('type')=='way']
def hav(a,b):
    R_=6371; la1,la2=math.radians(a[1]),math.radians(b[1]); dl=math.radians(b[0]-a[0]); dp=la2-la1
    return 2*R_*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dl/2)**2))
G={}
for w in mem:
    r=ways[w]
    for i in range(len(r)-1):
        a,b=r[i],r[i+1]; d=hav(nodes[a],nodes[b]); G.setdefault(a,[]).append((b,d)); G.setdefault(b,[]).append((a,d))
grey=(-73.1813250,-51.0021595)
start=min(G,key=lambda n:hav(nodes[n],grey))
dist={start:0}; pq=[(0,start)]
while pq:
    d,n=heapq.heappop(pq)
    if d>dist[n]: continue
    for m,w in G[n]:
        if d+w<dist.get(m,1e9): dist[m]=d+w; heapq.heappush(pq,(d+w,m))
segs=[]
for w in mem:
    r=ways[w]
    if not all(n in dist for n in r): continue
    if dist[r[0]]>dist[r[-1]]: r=r[::-1]
    pts=[project(*nodes[n]) for n in r]
    segs.append({'p':' '.join(f'{x},{y}' for x,y in pts),'d0':round(dist[r[0]],3),'d1':round(dist[r[-1]],3)})
dmax=max(s['d1'] for s in segs)
stops=[('Jour 1','Refugio Grey',-73.1813250,-51.0021595),('Jour 2','Paine Grande',-73.0947591,-51.0724863),('Jour 3','Los Cuernos',-72.9853709,-51.0238463),('Jour 4','Chileno',-72.9106479,-50.9572451),('Jour 5','Base Torres',-72.9496630,-50.9426680)]
st=[]
for j,nm,lo,la in stops:
    x,y=project(lo,la); nd=min(dist,key=lambda n:hav(nodes[n],(lo,la))); st.append({'jour':j,'nom':nm,'x':x,'y':y,'d':round(dist[nd],2)})
xs=[float(p.split(',')[0]) for s in segs for p in s['p'].split()]; ys=[float(p.split(',')[1]) for s in segs for p in s['p'].split()]
print('H1',H1,'segs',len(segs),'dmax',round(dmax,1),'bbox x',min(xs),max(xs),'y',min(ys),max(ys)); print(st)
json.dump({'segs':segs,'dmax':dmax,'stops':st,'source':'OpenStreetMap relation 2203617 « La Ruta del W » (72,1 km), © contributeurs OpenStreetMap (ODbL)'},open('trace.json','w'))
