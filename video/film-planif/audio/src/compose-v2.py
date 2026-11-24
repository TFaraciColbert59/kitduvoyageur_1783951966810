# « Jusqu'où » (épisode 1, v2) — orgue, piano feutré, cordes, chœur. 30,000 s = 45 temps à 90 BPM, sol mineur. Déterministe.
# Grille : ouverture 0-3 t | question 3-16 t | respiration 16-20 t | preuves 20-36,5 t (épique) | bascule au calme 36,5 | logo 42-45 t.
import numpy as np, wave, sys
SR=48000; DUR=30.0; N=int(SR*DUR); BEAT=60/90; E=BEAT/2
rng=np.random.default_rng(11)
L=np.zeros(N); R=np.zeros(N); L_=np.zeros(N); R_=np.zeros(N)   # L_/R_ : tout ce qui commence après la bascule au calme
CUT=36.5*60/90   # 24,333 s : bascule épique -> calme
def hz(m): return 440*2**((m-69)/12)
def add(sig,t0,pan=0.0,gain=1.0):
    i=int(round(t0*SR)); j=min(N,i+len(sig))
    if j<=i: return
    s=sig[:j-i]*gain; A,B=(L_,R_) if t0>=CUT-0.02 else (L,R)
    if A is L: s=s*np.clip((CUT+0.06-(np.arange(i,j)/SR))/0.06,0,1)   # l'épique s'arrête net à la coupe
    A[i:j]+=s*np.cos((pan+1)*np.pi/4)*1.414; B[i:j]+=s*np.sin((pan+1)*np.pi/4)*1.414
def env(n,att,rel,hold=None):
    t=np.arange(n)/SR; d=n/SR
    return np.clip(t/att,0,1)**1.5*np.clip((d-t)/rel,0,1)**1.2
def filt(x,fc,order=4):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/np.sqrt(1+(f/fc)**order); return np.fft.irfft(X,len(x))
def bp(x,f0,q):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=np.exp(-((f-f0)/(f0/q))**2); return np.fft.irfft(X,len(x))
# --- orgue à tuyaux (jeux 16', 8', 4', 2 2/3') ---
def organ(midis,dur,att=0.9,rel=1.4,stops=(0.5,1.0,0.35,0.12),gain=0.1,swell=None):
    n=int(SR*dur); t=np.arange(n)/SR; out=np.zeros(n)
    flute=[1,0.45,0.18,0.10,0.05,0.03]
    for m in midis:
        for mult,sg in zip((0.5,1,2,3),stops):
            if sg<=0: continue
            f=hz(m)*mult*2**(rng.uniform(-3,3)/1200)
            if f>9000: continue
            trem=1+0.012*np.sin(2*np.pi*5.1*t+rng.uniform(0,6))
            for k,a in enumerate(flute,1):
                if f*k>12000: break
                out+=sg*a*np.sin(2*np.pi*f*k*t+rng.uniform(0,6.28))*trem
    e=env(n,att,rel)
    if swell is not None: e=e*swell(t)
    chiff=filt(rng.standard_normal(n),2500)*np.exp(-t*25)*np.clip(t/0.02,0,1)*0.012
    return (out*e+chiff)*gain/len(midis)
# --- piano feutré ---
def felt(m,dur=3.0,vel=0.5):
    n=int(SR*dur); t=np.arange(n)/SR; f0=hz(m); out=np.zeros(n); B=0.0003
    for k in range(1,9):
        fk=f0*k*np.sqrt(1+B*k*k)
        if fk>7000: break
        out+=(1/k**1.6)*np.sin(2*np.pi*fk*t+rng.uniform(0,6.28))*np.exp(-t*(0.7+0.55*k**1.25))
        out+=(0.3/k**1.6)*np.sin(2*np.pi*fk*1.0007*t)*np.exp(-t*(0.9+0.55*k**1.25))
    thump=filt(rng.standard_normal(n),400)*np.exp(-t*60)*0.25
    return (out*np.clip(t/0.012,0,1)+thump)*vel*0.32
# --- cordes (ensemble, archet lent, vibrato) ---
def strings(midis,dur,att=1.6,rel=1.6,bright=2600,gain=0.1,swell=None):
    n=int(SR*dur); t=np.arange(n)/SR; out=np.zeros(n)
    for m in midis:
        for v in range(5):
            f=hz(m)*2**(rng.uniform(-7,7)/1200); vib=1+0.0035*np.sin(2*np.pi*rng.uniform(4.8,5.8)*t+rng.uniform(0,6))
            ph=2*np.pi*np.cumsum(f*vib)/SR
            for k in range(1,16):
                if f*k>bright*2.2: break
                out+=np.sin(k*ph+rng.uniform(0,6))/k*(1/(1+(f*k/bright)**2))
    e=env(n,att,rel)
    if swell is not None: e=e*swell(t)
    return out*e*gain/len(midis)/5
# --- chœur « ah » (formants) ---
def choir(midis,dur,att=1.8,rel=1.8,gain=0.1,swell=None):
    n=int(SR*dur); t=np.arange(n)/SR; out=np.zeros(n)
    F=[(800,1.0,80),(1150,0.5,90),(2900,0.25,120),(3300,0.12,130)]
    for m in midis:
        for v in range(4):
            f=hz(m)*2**(rng.uniform(-9,9)/1200); vib=1+0.004*np.sin(2*np.pi*rng.uniform(4.5,5.5)*t+rng.uniform(0,6))
            ph=2*np.pi*np.cumsum(f*vib)/SR
            for k in range(1,40):
                fk=f*k
                if fk>4500: break
                a=sum(g*np.exp(-((fk-fc)/(bw*2.2))**2) for fc,g,bw in F)+0.04/k
                out+=a*np.sin(k*ph+rng.uniform(0,6))
    breath=filt(rng.standard_normal(n),3500)*0.015
    e=env(n,att,rel)
    if swell is not None: e=e*swell(t)
    return (out+breath)*e*gain/len(midis)/4
# --- grave profond (timbale douce en roulement, pas de grosse caisse) ---
def roll(m,dur,gain=0.25):
    n=int(SR*dur); t=np.arange(n)/SR; f=hz(m)
    tone=np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*1.5*t)
    rumble=filt(rng.standard_normal(n),180)
    return (tone*0.6+rumble*2.2)*(t/dur)**2*gain
def glass(m,dur,gain=0.04):
    n=int(SR*dur); t=np.arange(n)/SR; f=hz(m)
    return (np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*f*2.01*t))*env(n,0.8,1.2)*gain
b=lambda k:k*BEAT
n_=dict(G1=31,A1=33,Bb1=34,C2=36,D2=38,Eb2=39,F2=41,G2=43,A2=45,Bb2=46,C3=48,D3=50,Eb3=51,F3=53,Fs3=54,G3=55,A3=57,Bb3=58,B3=59,C4=60,D4=62,Eb4=63,F4=65,Fs4=66,G4=67,A4=69,Bb4=70,B4=71,C5=72,D5=74,Eb5=75,F5=77,G5=79,Bb5=82,D6=86)
g=lambda s:[n_[x] for x in s.split()]
# 0 - 2,0 s : ouverture sur le papier. Orgue 16' doux + une note de piano quand l'aiguille se fixe (1,3 s)
add(organ(g('G1 G2 D3'),3.0,att=0.3,rel=1.2,stops=(0.7,0.45,0,0),gain=0.06),0.0)
add(felt(n_['D5'],2.5,0.30),1.30,pan=0.1); add(felt(n_['G4'],2.5,0.16),1.32,pan=-0.1)
# 2,0 - 10,667 : la question. Une note de piano par mot, l'orgue s'épaissit, le chœur entre sur « manquait ? »
mots=[(3,'D5'),(5,'Bb4'),(7,'A4'),(8,'G4'),(10,'F4'),(11,'D5')]
for k,(tb,m) in enumerate(mots):
    add(felt(n_[m],3.2,0.29+0.025*k),b(tb),pan=[-.2,.2,-.1,.1,-.15,0][k]); add(felt(n_[m]-12,2.8,0.12),b(tb)+0.015)
q=[(3,'G2','G3 Bb3 D4',4),(7,'Eb2','G3 Bb3 Eb4',4),(11,'C2','G3 C4 Eb4',2.5),(13.5,'D2','A3 D4 G4',2.5)]  # dernier accord : Ré suspendu, la question reste ouverte
for c,(tb,bass,up,lb) in enumerate(q):
    add(organ([n_[bass]]+g(up),lb*BEAT+0.8,att=0.5,rel=0.9,stops=(0.6,0.9,0.15+0.08*c,0),gain=0.06+0.022*c),b(tb))
add(strings(g('D4 G4 A4'),2.5*BEAT+0.9,att=0.9,rel=0.9,bright=2200,gain=0.062),b(13.5))
add(choir(g('A4 D5'),2.5*BEAT+1.0,att=0.8,rel=1.0,gain=0.095),b(13.5))
# 10,667 - 13,333 : respiration (la Terre). Tout tombe : un ré grave tenu et deux notes de verre
add(organ(g('D2 A2'),4*BEAT+0.4,att=0.15,rel=0.5,stops=(0.8,0.35,0,0),gain=0.05),b(16))
add(glass(n_['A4']+12,2.6,0.022),b(16)+0.3,pan=-.3); add(glass(n_['D6'],2.2,0.016),b(17.5),pan=.3)
add(roll(n_['D2']+12,1.6,0.09),b(20)-1.6)   # le roulement qui annonce l'épique
# 13,333 - 24,333 : les preuves. Orgue plein, cordes, chœur ; l'arpège passe des croches aux doubles croches à 19,0 s
prog=[(20,'G1','G3 Bb3 D4',4,'D5'),(24,'Eb2','G3 Bb3 Eb4',4,'Eb5'),(28,'Bb1','F3 Bb3 D4',2,'F5'),(30,'F2','F3 A3 C4',2,'C5'),
      (32,'C2','G3 C4 Eb4',1.5,'Eb5'),(33.5,'D2','Fs3 A3 D4',1.5,'D5')]
for c,(tb,bass,up,lb,mel) in enumerate(prog):
    lvl=0.55+0.09*c; dur=lb*BEAT+0.5
    add(organ([n_[bass],n_[bass]+12]+g(up),dur,att=0.08,rel=0.6,stops=(0.8,1.0,0.35+0.08*c,0.08+0.04*c),gain=0.15*lvl),b(tb))
    add(strings([n_[bass]+12]+g(up)+[g(up)[-1]+12],dur,att=0.35,rel=0.6,bright=2000+250*c,gain=0.12*lvl),b(tb))
    add(choir(g(up)+[g(up)[-1]+12],dur,att=0.45,rel=0.6,gain=0.10*lvl),b(tb))
    add(strings([n_[mel]],dur,att=0.3,rel=0.6,bright=3200,gain=0.05*lvl),b(tb),pan=0.15)
arp={'G1':'G4 Bb4 D5 Bb4','Eb2':'G4 Bb4 Eb5 Bb4','Bb1':'F4 Bb4 D5 Bb4','F2':'F4 A4 C5 A4','C2':'G4 C5 Eb5 C5','D2':'Fs4 A4 D5 A4'}
t=b(20); k=0
while t<b(34.5)-0.01:
    tb=t/BEAT; cur=[p for p in prog if p[0]<=tb+1e-6][-1]
    ns=g(arp[cur[1]]); step=E if t<19.0 else E/2
    vel=0.06+0.07*min(1,(t-b(20))/(b(34.5)-b(20)))
    add(organ([ns[k%4]],step*1.6,att=0.01,rel=0.08,stops=(0,0.6,0.5,0.2),gain=vel),t,pan=(-0.3 if k%2 else 0.3)); t+=step; k+=1
add(roll(n_['D2']+12,b(35)-b(32),0.20),b(32))   # grand roulement vers le sommet
# 23,0 - 24,333 : les Torres à l'aube. Sol MAJEUR (tierce picarde), tutti
add(organ(g('G1 G2 D3 G3 B3 D4 G4'),2*BEAT+0.6,att=0.05,rel=0.5,stops=(0.9,1.0,0.7,0.35),gain=0.26),b(34.5))
add(strings(g('G2 D3 B3 D4 G4 B4 D5'),2*BEAT+0.6,att=0.12,rel=0.5,bright=3400,gain=0.18),b(34.5))
add(choir(g('B4 D5 G5'),2*BEAT+0.6,att=0.15,rel=0.5,gain=0.2),b(34.5))
# 24,333 : coupe nette vers le calme. « Le voyage commence / bien avant le départ. » Orgue doux en Mi bémol, puis piano seul
add(organ(g('Eb2 Bb2 G3 Bb3 D4'),3.4,att=0.04,rel=1.6,stops=(0.5,0.7,0,0),gain=0.075),b(36.5))
for tb,m,v in [(37,'Bb4',0.32),(38.5,'G4',0.26),(39.5,'F4',0.24),(40.5,'D5',0.30)]:
    add(felt(n_[m],3.0,v),b(tb),pan=0.12); add(felt(n_[m]-12,2.6,0.12),b(tb)+0.02)
# 28,0 - 30,0 : le logo. Sol grave de l'orgue, accord ouvert au piano, une note de verre
add(organ(g('G1 G2 D3 G3'),2.4,att=0.06,rel=1.4,stops=(0.8,0.7,0.2,0),gain=0.09),b(42))
add(felt(n_['G5'],2.2,0.5),b(42)); add(felt(n_['D5'],2.2,0.32),b(42)+0.03,pan=.25); add(felt(n_['G4'],2.2,0.28),b(42)+0.05,pan=-.25)
add(glass(n_['G5'],2.0,0.022),b(42)+0.2)
# --- automation de dynamique : doux -> question -> quasi-silence -> épique -> chute nette -> logo
_t=np.arange(N)/SR
_k=np.interp(_t,[0,2.0,7.0,10.4,10.75,13.0,13.33,19.0,23.0,24.30,24.40,27.9,28.0,30],
                [0.55,0.42,0.42,0.52,0.40,0.40,0.55,0.85,1.15,1.15,0.55,0.55,0.62,0.62])
L*=_k; R*=_k; L_*=_k; R_*=_k
# --- grande salle (réverbération 4 s, pré-délai 25 ms) ---
def ir(sec,seed):
    r=np.random.default_rng(seed); n=int(SR*sec); t=np.arange(n)/SR
    x=r.standard_normal(n)*np.exp(-t*6.9/sec); x=filt(x,5000); x[:int(0.025*SR)]=0; return x/np.sqrt((x**2).sum())
def conv(x,h):
    n=len(x)+len(h); F=1<<int(np.ceil(np.log2(n))); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(h,F),F)[:len(x)]
wet=0.42
tt=np.arange(N)/SR; gate=np.where(tt<CUT,1.0,np.exp(-(tt-CUT)/0.35))   # la queue de réverbération de l'épique s'éteint en ~0,7 s
L2=(L*(1-wet)+conv(L,ir(4.0,1))*wet*2.2)*gate+L_*(1-wet)+conv(L_,ir(4.0,1))*wet*2.2
R2=(R*(1-wet)+conv(R,ir(4.0,2))*wet*2.2)*gate+R_*(1-wet)+conv(R_,ir(4.0,2))*wet*2.2
tt=np.arange(N)/SR; L2*=np.clip((DUR-tt)/0.9,0,1)**1.3; R2*=np.clip((DUR-tt)/0.9,0,1)**1.3
st=np.stack([L2,R2],1); st/=np.abs(st).max()*1.1
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    a=(np.clip(st,-1,1)*(2**23-1)).astype(np.int32).reshape(-1)
    by=np.zeros((a.size,3),np.uint8); by[:,0]=a&255; by[:,1]=(a>>8)&255; by[:,2]=(a>>16)&255
    w.writeframes(by.tobytes())
print('ok')
