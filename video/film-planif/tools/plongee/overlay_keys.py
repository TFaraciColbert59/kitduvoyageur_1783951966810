# Pour chaque image de la plongée, la similitude (échelle, rotation, translation) qui amène le tracé de l'image finale à sa place.
import math, json, re, numpy as np
src=open('render.py').read(); exec(src.split("mos={}")[0])
H0,H1=map(float,re.search(r'H0,H1=([\d.]+),([\d.]+)',src).groups())
def unit(lon,lat):
    lo,la=math.radians(lon),math.radians(lat); return np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)])
U=unit(LON0,LAT0); E=np.array([-math.sin(math.radians(LON0)),math.cos(math.radians(LON0)),0.0]); Nn=np.cross(U,E)
def proj(lon,lat,Hk,roll):
    P=unit(lon,lat)*R; C=U*(R+Hk); v=P-C; dz=v@(-U); px=(v@E)/dz; py=(v@Nn)/dz
    cr,sr=math.cos(roll),math.sin(roll); ax=px*cr+py*sr; ay=-px*sr+py*cr   # inverse de la rotation de l'écran
    return np.array([(ax/tx_+1)/2*W,(1-ay/ty_)/2*H])
def ease(u): return u*u*(3-2*u)
def cam(t):
    u=min(max((t-0.55)/1.70,0),1); e=ease(u)
    Hk=math.exp(math.log(H0)*(1-e)+math.log(H1)*e) if u<1 else H1
    if t<0.55: Hk=H0*(1+0.06*(0.55-t))
    roll=math.radians(28*(1-ease(min(max((t-0.3)/2.0,0),1))))
    return Hk,roll
A=(-73.1813250,-51.0021595); B=(-72.9106479,-50.9572451)
a1,b1=proj(*A,H1,0),proj(*B,H1,0); keys=[]
for i in range(100):
    t=i/30; Hk,roll=cam(t); a,b=proj(*A,Hk,roll),proj(*B,Hk,roll)
    v1=b1-a1; v=b-a; s=np.linalg.norm(v)/np.linalg.norm(v1); r=math.degrees(math.atan2(v[1],v[0])-math.atan2(v1[1],v1[0]))
    c,sn=math.cos(math.radians(r)),math.sin(math.radians(r)); M=np.array([[c,-sn],[sn,c]])*s; T=a-M@a1
    keys.append({'t':round(t,4),'s':round(s,5),'r':round(r,3),'x':round(T[0],2),'y':round(T[1],2)})
json.dump(keys,open('../../assets/map/overlay-keys.json','w'))
for k in keys[45::6]: print(k)
