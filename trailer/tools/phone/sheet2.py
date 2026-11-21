import sys, glob, os, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from locate import locate
from PIL import Image, ImageDraw
S=sys.argv[1]; out=sys.argv[2]; ids=sys.argv[3].split(',')
ALL=['p12','p13','p16','p17','p25','p29','p31','p36','p48','p49','p51']
SRC={'p12':'img40','p13':'img41','p16':'img42','p17':'img43','p25':'img18','p29':'img46','p31':'img22','p36':'img27','p48':'img37','p49':'img37','p51':'img38'}
fs=sorted(glob.glob(S+'/all/frame-*.png'))
for i in ids:
  k=ALL.index(i); src='film/assets/footage/%s.png'%SRC[i]
  meta=json.load(open('film/assets/phone/%s.json'%SRC[i])); c=meta['corners']
  if i=='p17': c=[[392,0],[1543,0],c[2],c[3]]
  fr=[Image.open(fs[k*3+n]).convert('RGB') for n in range(3)]
  greens=[]; boxes=[]
  for n in range(3):
    v,Sc,pts=locate(fs[k*3+n],src,c)
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]; m=max(30,0.25*(max(xs)-min(xs)))
    b=[int(max(0,min(xs)-m)),int(max(0,min(ys)-m)),int(min(1920,max(xs)+m)),int(min(1080,max(ys)+m))]
    a=np.asarray(fr[n].crop(b),dtype=np.int16); g=((a[...,1]>a[...,0]+60)&(a[...,1]>a[...,2]+60)).sum()
    greens.append(int(g)); boxes.append((b,round(float(v),2)))
  b=boxes[1][0]; z=fr[1].crop(b); sc=min(720/z.size[1],1920/z.size[0]); z=z.resize((int(z.size[0]*sc),int(z.size[1]*sc)),Image.LANCZOS)
  sh=Image.new('RGB',(1920,1080),(20,20,20))
  for n in range(3): sh.paste(fr[n].resize((640,360)),(640*n,0))
  sh.paste(z,(0,360))
  ImageDraw.Draw(sh).text((6,4),'%s debut/milieu/fin ; dessous : milieu agrandi x%.1f ; pixels verts purs autour de l ecran : %s'%(i,sc,greens),fill=(255,0,255))
  p=os.path.join(out,i+'-debut-milieu-fin-zoom.jpg'); q=82
  while True:
    sh.save(p,quality=q)
    if os.path.getsize(p)<290000 or q<40: break
    q-=8
  print(i,'verts',greens,'score',[x[1] for x in boxes],os.path.getsize(p))
