# Prépare les images ChatGPT (assets/gen/NN-*.png|jpg) pour le film : recadrage 9:16 avec 10 % de marge pour la poussée,
# agrandissement Lanczos, étalonnage léger commun (contraste, chaleur des hautes lumières), sortie assets/prep/NN.jpg.
# Si l'image ChatGPT manque, la photo libre assets/photos/NN-*.jpg (Wikimedia Commons, crédits dans CREDITS.md) la remplace,
# avec son cadrage dans assets/photos/cadrage.json ({"NN": {"fx":0..1, "fy":0..1, "zoom":>=1}}).
# Une image absente des deux dossiers est remplacée par une image d'attente marquée (jamais livrée : le rendu final vérifie qu'il n'en reste pas).
import glob, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN=os.path.join(ROOT,'assets','gen'); OUT=os.path.join(ROOT,'assets','prep'); os.makedirs(OUT,exist_ok=True)
W,H=1188,2112  # 1080×1920 + 10 %
NAMES={1:'aube-mer-de-nuages',2:'randonneur-minuscule',3:'condor-vertige',4:'pont-suspendu',5:'torres-embrasees',6:'refuge-heure-bleue',7:'fenetre-meteo',8:'eau-glaciaire',9:'hublot-andes',10:'sac-rien-de-trop',11:'trois-amis-vent',12:'tente-voie-lactee',13:'proches-suivent',14:'guanacos-steppe'}
# point de cadrage horizontal (0 = gauche, 0,5 = centre, 1 = droite) quand le sujet n'est pas centré
FOCUS={3:0.36}
import json
PHO=os.path.join(ROOT,'assets','photos')
CAD=json.load(open(os.path.join(PHO,'cadrage.json'))) if os.path.exists(os.path.join(PHO,'cadrage.json')) else {}
found={}; crop={}
for d in (PHO,GEN):  # GEN en dernier : l'image ChatGPT l'emporte
    for f in glob.glob(os.path.join(d,'*')):
        m=re.match(r'(\d{1,2})-',os.path.basename(f))
        if m and f.lower().endswith(('.png','.jpg','.jpeg','.webp')):
            n=int(m.group(1)); found[n]=f
            crop[n]=CAD.get(f'{n:02d}',{}) if d==PHO else {'fx':FOCUS.get(n,0.5)}
status={}
for n in range(1,15):
    out=os.path.join(OUT,f'{n:02d}.jpg')
    if n in found:
        im=Image.open(found[n]).convert('RGB'); w,h=im.size
        c=crop[n]; s=max(W/w,H/h)*c.get('zoom',1.0); im=im.resize((round(w*s),round(h*s)),Image.LANCZOS)
        L=int(round((im.width-W)*c.get('fx',0.5))); T=int(round((im.height-H)*c.get('fy',0.5))); im=im.crop((L,T,L+W,T+H))
        a=np.asarray(im).astype(np.float32)/255
        lum=a.mean(-1,keepdims=True)
        a=lum+(a-lum)*1.06                      # saturation +6 %
        a=np.clip((a-0.5)*1.05+0.5,0,1)          # contraste +5 %
        a+=np.array([0.012,0.004,-0.010])*np.clip(lum-0.55,0,1)*2   # hautes lumières vers le laiton
        a+=np.array([-0.006,0.004,0.003])*np.clip(0.35-lum,0,1)*2    # ombres vers le vert forêt
        im=Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8))
        if s>1.0: im=im.filter(ImageFilter.UnsharpMask(radius=1.2,percent=40,threshold=2))
        im.save(out,quality=94); status[n]=f'ok {os.path.basename(found[n])} ({w}×{h}, ×{s:.2f})'
        ph=out+'.attente'
        if os.path.exists(ph): os.remove(ph)
    else:
        g=np.linspace(0,1,H)[:,None,None]; a=(np.array([20,40,32])*(1-g)+np.array([6,18,12])*g)*np.ones((1,W,1))
        im=Image.fromarray(a.astype(np.uint8)); d=ImageDraw.Draw(im)
        d.rectangle((60,60,W-60,H-60),outline=(208,160,112),width=4)
        d.text((100,120),f'IMAGE {n:02d} — EN ATTENTE\n{NAMES[n]}',fill=(208,160,112),font=ImageFont.load_default(size=56))
        im.save(out,quality=90); open(out+'.attente','w').write('attente'); status[n]='ATTENTE'
for n in range(1,15): print(f'{n:02d}',status[n])
