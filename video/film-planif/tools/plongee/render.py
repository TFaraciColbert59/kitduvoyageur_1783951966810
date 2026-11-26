# Plongée Terre -> W : caméra au nadir au-dessus du W, rayon-sphère par pixel, mosaïques Sentinel-2 cloudless 2016 (EOX, CC BY 4.0).
import numpy as np, math, json, sys, os
from PIL import Image
W,H=1080,1920; FPS=30; NF=100
R=6371.0
LON0,LAT0=-73.029,-51.006   # centre du W (boîte du tracé OSM)
FOVH=math.radians(30); tx_=math.tan(FOVH/2); ty_=tx_*H/W
mos={}
for z in (4,7,10,13):
    M=np.load(f'm{z}.npy'); x0,y0=map(int,open(f'm{z}.txt').read().split()); mos[z]=(M.astype(np.float32),x0*256,y0*256)
def merc(lon,lat,z):
    s=256*2**z; x=(lon+180)/360*s
    la=np.clip(np.radians(lat),-1.48,1.48); y=(1-np.log(np.tan(la)+1/np.cos(la))/math.pi)/2*s
    return x,y
def sample(z,lon,lat):
    M,ox,oy=mos[z]; x,y=merc(lon,lat,z); x=x-ox-0.5; y=y-oy-0.5
    h,w,_=M.shape; ok=(x>=0)&(y>=0)&(x<w-1)&(y<h-1)
    xc=np.clip(x,0,w-1.001); yc=np.clip(y,0,h-1.001); x0=xc.astype(int); y0=yc.astype(int); fx=(xc-x0)[...,None]; fy=(yc-y0)[...,None]
    c=(M[y0,x0]*(1-fx)*(1-fy)+M[y0,x0+1]*fx*(1-fy)+M[y0+1,x0]*(1-fx)*fy+M[y0+1,x0+1]*fx*fy)
    return c,ok
def unit(lon,lat):
    lo,la=math.radians(lon),math.radians(lat); return np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)])
U=unit(LON0,LAT0); E=np.array([-math.sin(math.radians(LON0)),math.cos(math.radians(LON0)),0.0]); Nn=np.cross(U,E)
sx=(np.arange(W)+0.5)/W*2-1; sy=1-(np.arange(H)+0.5)/H*2; SX,SY=np.meshgrid(sx,sy)
rng=np.random.default_rng(3)
stars=np.zeros((H,W),np.float32); k=rng.integers(0,H*W,2600); stars.flat[k]=rng.uniform(0.15,1,2600)**3
stars=np.maximum(stars,np.roll(stars,1,0)*0.25)
SUN=unit(LON0-55,LAT0+25)  # lumière rasante (matin, depuis l'est-nord)
def frame(Hkm,roll):
    D=R+Hkm; C=U*D
    cr,sr=math.cos(roll),math.sin(roll); px=SX*tx_; py=SY*ty_; ax=px*cr-py*sr; ay=px*sr+py*cr
    d=(-U)[None,None,:]+ax[...,None]*E+ay[...,None]*Nn
    d/=np.linalg.norm(d,axis=-1,keepdims=True)
    b=(d@C); c=D*D-R*R; disc=b*b-c
    hit=disc>0; t=-b-np.sqrt(np.maximum(disc,0)); P=C[None,None,:]+t[...,None]*d
    lat=np.degrees(np.arcsin(np.clip(P[...,2]/R,-1,1))); lon=np.degrees(np.arctan2(P[...,1],P[...,0]))
    gpp=2*Hkm*tx_/W*1000.0  # m par pixel au nadir
    zf=math.log2(156543.0*math.cos(math.radians(LAT0))/max(gpp,1e-3))
    levels=[4,7,10,13]; img=np.zeros((H,W,3),np.float32)
    # du plus grossier au plus fin, chaque niveau couvre ce qu'il connaît, fondu sur la fraction de zoom
    for z in levels:
        if z>4 and z>zf+1.2: break
        c,ok=sample(z,lon,lat); a=np.clip(zf-z+1.0,0,1) if z>4 else 1.0
        m=(ok&hit)[...,None]*a; img=img*(1-m)+c*m
    # ombrage doux de la sphère (lumière rasante) et assombrissement au limbe
    nrm=P/R; lam=np.clip((nrm@SUN)*0.6+0.55,0.25,1.15); mu=np.clip(-(np.sum(nrm*d,axis=-1)),0,1)
    shade=lam*(0.55+0.45*mu**0.35)
    img*=np.where(hit,shade,0)[...,None]
    # atmosphère : halo bleu au bord du disque et voile sur la surface vue de loin
    far=np.clip((math.log10(Hkm)-2.3)/2.0,0,1)
    alt=np.linalg.norm(np.cross(d,C[None,None,:]),axis=-1)-R
    glow=np.exp(-np.maximum(alt,0)/(R*0.025))*(~hit)
    sky=np.array([95,150,255],np.float32)
    img+=glow[...,None]*sky*0.9*far
    img=img*(1-0.18*far*(1-mu)[...,None]*hit[...,None])+sky*0.18*far*(1-mu)[...,None]*hit[...,None]
    # étoiles dans le noir
    img+=(stars*(~hit)*(1-np.clip(glow*3,0,1))*255*far)[...,None]
    # étalonnage : contraste, saturation, ombres vert forêt, lumières laiton
    lum=img.mean(-1,keepdims=True); img=lum+(img-lum)*1.28
    img=np.clip(img,0,None); img=255*((img/255)**1.08); img=(img-128)*1.10+128
    img+=np.array([6,3,-4],np.float32)*(img.mean(-1,keepdims=True)/255)
    yy=np.linspace(-1,1,H)[:,None]; xx=np.linspace(-1,1,W)[None,:]; vig=1-0.28*np.clip((xx**2*0.8+yy**2)-0.25,0,1)
    img*=vig[...,None]
    return np.clip(img,0,255).astype(np.uint8)
def ease(u): return u*u*(3-2*u)
os.makedirs('frames',exist_ok=True)
H0,H1=168000.0,51.0
for i in range(NF):
    t=i/FPS
    # 0–0,6 s : Terre minuscule qui dérive ; 0,6–2,25 s : plongée ; ensuite immobile
    u=np.clip((t-0.55)/1.70,0,1); e=u**2.2*(3-2.2*u)/(3-2.2) if u<1 else 1.0
    e=ease(u)**1.0
    Hk=math.exp(math.log(H0)*(1-e)+math.log(H1)*e) if u<1 else H1
    if t<0.55: Hk=H0*(1+0.06*(0.55-t))
    roll=math.radians(28*(1-ease(np.clip((t-0.3)/2.0,0,1))))
    Image.fromarray(frame(Hk,roll)).save(f'frames/{i:04d}.jpg',quality=93)
    if i%10==0: print(i,round(Hk,1),flush=True)
# projection des points pour l'image finale (immobile)
def project(lon,lat,Hkm=H1):
    P=unit(lon,lat)*R; C=U*(R+Hkm); v=P-C; dz=v@(-U); x=(v@E)/dz/tx_; y=(v@Nn)/dz/ty_
    return (x+1)/2*W,(1-y)/2*H
json.dump({'H':H1,'center':[LON0,LAT0],'fovh_deg':30},open('proj.json','w'))
print('done')
