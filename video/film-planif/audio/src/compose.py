# « Rien oublié » v2 — orgue, piano feutré, cordes, chœur. 20,000 s, 90 BPM (ressenti calme), sol mineur. Déterministe.
import numpy as np, wave, sys
SR=48000; DUR=20.0; N=int(SR*DUR); BEAT=60/90; E=BEAT/2
rng=np.random.default_rng(11)
L=np.zeros(N); R=np.zeros(N)
def hz(m): return 440*2**((m-69)/12)
def add(sig,t0,pan=0.0,gain=1.0):
    i=int(round(t0*SR)); j=min(N,i+len(sig))
    if j<=i: return
    s=sig[:j-i]*gain; L[i:j]+=s*np.cos((pan+1)*np.pi/4)*1.414; R[i:j]+=s*np.sin((pan+1)*np.pi/4)*1.414
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
n_=dict(G1=31,D2=38,G2=43,Bb2=46,C3=48,D3=50,Eb3=51,F3=53,G3=55,A3=57,Bb3=58,C4=60,D4=62,Eb4=63,F4=65,G4=67,A4=69,Bb4=70,C5=72,D5=74,F5=77,G5=79,Eb2=39,Bb1=34,F2=41)
g=lambda s:[n_[x] for x in s.split()]
# 0 – 4,667 : piano feutré, une note par mot ; orgue 16' très doux dès l'image 0
add(organ(g('G1 G2 D3'),5.8,att=0.35,rel=2.0,stops=(0.7,0.4,0,0),gain=0.07),0.0)
motif=[('D5',0),('Bb4',2),('A4',3),('G4',4),('D5',5)]
for k,(m,tb) in enumerate(motif):
    add(felt(n_[m],3.5,0.36),b(tb),pan=[-.15,.15,-.1,.1,0][k]); add(felt(n_[m]-12,3.0,0.18),b(tb)+0.015)
add(felt(n_['G3'],3.5,0.22),b(5)+0.03,pan=-.2); add(felt(n_['Bb3'],3.5,0.2),b(5)+0.05,pan=.2)
# 4,667 – 8,0 : respiration (la Terre) puis le tracé : verre aigu + orgue qui ouvre ; l'ostinato commence
add(glass(n_['G5'],4.0,0.03),b(7)-0.1,pan=-.3); add(glass(n_['D5']+12,3.6,0.02),b(7)+0.4,pan=.3)
add(organ(g('G2 D3 Bb3'),4.2,att=1.6,rel=0.6,stops=(0.4,0.8,0.2,0),gain=0.06),b(7)-0.2)
ost=['G4','D5','Bb4','D5']  # croches régulières, le « tic » calme (comme une horloge)
t=b(9)
k=0
while t<b(24)-0.01:
    vel=0.10+0.30*min(1,(t-b(9))/(b(24)-b(9)))**1.4
    add(felt(n_[ost[k%4]],1.2,vel),t,pan=(-0.25 if k%2 else 0.25)); t+=E; k+=1
for d,(m,tj) in enumerate(zip(g('D4 F4 G4 A4 Bb4'),[6.417,6.757,7.116,7.483,7.615])):  # cinq jours, calés sur l'instant où chaque jour s'allume
    add(felt(m+12,2.0,0.3),tj,pan=-0.4+0.2*d)
# 8,0 – 16,0 : la grandeur monte. Sol m | Mi b | Si b | Fa  (2 s chacun), orgue + cordes, chœur à 12 s
prog=[('G2','G3 Bb3 D4','G1'),('Eb2','G3 Bb3 Eb4','Eb2'),('Bb1','F3 Bb3 D4','Bb1'),('F2','F3 A3 C4','F2')]
for c,(bass,up,low) in enumerate(prog):
    t0=b(12)+c*3*BEAT; dur=3*BEAT+0.9
    lvl=[0.35,0.55,0.8,1.1][c]
    add(organ([n_[bass]]+g(up),dur,att=0.25,rel=0.8,stops=(0.6,1.0,0.25+0.12*c,0.05*c),gain=0.13*lvl),t0)
    add(strings([n_[bass]+12]+g(up)+[g(up)[-1]+12],dur,att=0.7,rel=0.9,bright=1800+400*c,gain=0.11*lvl),t0,pan=0)
    if c>=2: add(choir(g(up)+[g(up)[-1]+12],dur,att=1.0,rel=0.9,gain=0.12*lvl),t0)
    add(roll(n_[low]+12,1.4,0.10+0.04*c),t0+dur-0.9-1.4)
# mélodie des cordes au-dessus (une note longue par accord)
for c,m in enumerate(['D5','Eb4','D5','C5']):
    add(strings([n_[m]+(12 if c==1 else 0)],3*BEAT+0.8,att=0.6,rel=0.9,bright=3000,gain=[0.03,0.045,0.07,0.09][c]),b(12)+c*3*BEAT,pan=0.15)
# 16,0 : arrivée — Si bémol majeur, plein et chaud (« Tout est prévu. »)
add(organ(g('Bb1 F2 Bb2 F3 Bb3 D4 F4'),3.4,att=0.12,rel=1.8,stops=(0.8,1.0,0.6,0.3),gain=0.24),b(24))
add(strings(g('Bb2 F3 D4 F4 Bb4 D5'),3.4,att=0.25,rel=1.8,bright=3200,gain=0.17),b(24))
add(choir(g('F4 Bb4 D5'),3.4,att=0.4,rel=1.8,gain=0.18),b(24))
add(felt(n_['Bb4'],3,0.5),b(24)); add(felt(n_['F5'],3,0.4),b(24)+0.02,pan=.2)
# 18,0 : le logo — tout retombe sur un sol grave de l'orgue et une note aiguë de piano
add(organ(g('G1 G2 D3 G3'),2.3,att=0.08,rel=1.4,stops=(0.8,0.7,0.2,0),gain=0.10),b(27))
add(felt(n_['G5'],2.2,0.55),b(27)); add(felt(n_['D5'],2.2,0.35),b(27)+0.03,pan=.25); add(felt(n_['G4'],2.2,0.3),b(27)+0.05,pan=-.25)
add(glass(n_['G5'],2.0,0.025),b(27)+0.2)
# --- automation de dynamique : calme -> grandeur
_t=np.arange(N)/SR
_k=np.interp(_t,[0,4.4,4.9,7.6,8.0,12.0,15.8,16.0,17.9,18.1,20],[0.5,0.5,0.36,0.46,0.52,0.66,1.0,1.08,1.0,0.7,0.7])
L*=_k; R*=_k
# --- grande salle (réverbération 4 s, pré-délai 25 ms) ---
def ir(sec,seed):
    r=np.random.default_rng(seed); n=int(SR*sec); t=np.arange(n)/SR
    x=r.standard_normal(n)*np.exp(-t*6.9/sec); x=filt(x,5000); x[:int(0.025*SR)]=0; return x/np.sqrt((x**2).sum())
def conv(x,h):
    n=len(x)+len(h); F=1<<int(np.ceil(np.log2(n))); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(h,F),F)[:len(x)]
wet=0.42
L2=L*(1-wet)+conv(L,ir(4.0,1))*wet*2.2; R2=R*(1-wet)+conv(R,ir(4.0,2))*wet*2.2
tt=np.arange(N)/SR; L2*=np.clip((DUR-tt)/0.9,0,1)**1.3; R2*=np.clip((DUR-tt)/0.9,0,1)**1.3
st=np.stack([L2,R2],1); st/=np.abs(st).max()*1.1
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    a=(np.clip(st,-1,1)*(2**23-1)).astype(np.int32).reshape(-1)
    by=np.zeros((a.size,3),np.uint8); by[:,0]=a&255; by[:,1]=(a>>8)&255; by[:,2]=(a>>16)&255
    w.writeframes(by.tobytes())
print('ok')
