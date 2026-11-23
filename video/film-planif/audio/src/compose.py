# Musique originale « Rien oublié » — 20,000 s, 90 BPM, sol mineur. Synthèse déterministe (numpy).
import numpy as np, wave, sys
SR=48000; DUR=20.0; N=int(SR*DUR); BEAT=60/90
rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
def hz(m): return 440*2**((m-69)/12)
def add(sig,t0,pan=0.0,gain=1.0):
    i=int(t0*SR); j=min(N,i+len(sig))
    if j<=i: return
    s=sig[:j-i]*gain; gl=np.cos((pan+1)*np.pi/4); gr=np.sin((pan+1)*np.pi/4)
    L[i:j]+=s*gl*1.4142/2*2**0.5; R[i:j]+=s*gr*1.4142/2*2**0.5
def lp(x,fc):  # one-pole low-pass
    a=np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); z=0.0
    for k in range(len(x)): z=(1-a)*x[k]+a*z; y[k]=z
    return y
def lp_fast(x,fc):
    # FFT brickwall-ish smooth low-pass
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/np.sqrt(1+(f/fc)**4); return np.fft.irfft(X,len(x))
# --- instruments ---
def piano(m,dur=4.0,vel=0.6):
    n=int(SR*dur); t=np.arange(n)/SR; f0=hz(m); B=0.0004; out=np.zeros(n)
    for k in range(1,14):
        fk=f0*k*np.sqrt(1+B*k*k)
        if fk>16000: break
        amp=(1/k**1.15)*(1+0.6*(k==2))*vel
        dec=np.exp(-t*(0.45+0.32*k)*(f0/260)**0.35)
        out+=amp*np.sin(2*np.pi*fk*t+rng.uniform(0,6.28))*dec
    att=np.minimum(1,t/0.004); hammer=rng.standard_normal(n)*np.exp(-t*90)*0.05*vel
    return (out*att+lp_fast(hammer,3000))*0.35
def pad(midis,dur,att=1.5,rel=1.5,bright=1800,gain=0.12):
    n=int(SR*dur); t=np.arange(n)/SR; out=np.zeros(n)
    for m in midis:
        for d in (-0.09,0.0,0.08):
            f=hz(m)*2**(d/12); ph=rng.uniform(0,1)
            saw=2*((f*t+ph)%1)-1
            out+=saw
    out=lp_fast(out,bright)
    env=np.minimum(1,t/att)*np.minimum(1,(dur-t)/rel).clip(0,1)
    return out*env*gain/len(midis)
def sub_boom(dur=3.0,f0=55,gain=0.9):
    n=int(SR*dur); t=np.arange(n)/SR; f=f0*(1+1.8*np.exp(-t*18)); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t*1.3)*gain
def kick(gain=0.7):
    n=int(SR*0.5); t=np.arange(n)/SR; f=48*(1+3*np.exp(-t*35)); ph=2*np.pi*np.cumsum(f)/SR
    return (np.sin(ph)*np.exp(-t*9)+lp_fast(rng.standard_normal(n),1500)*np.exp(-t*120)*0.15)*gain
def pulse(m,dur,gain=0.18,cut=900):
    n=int(SR*dur); t=np.arange(n)/SR; f=hz(m); saw=2*((f*t)%1)-1+0.5*(2*((f*1.003*t)%1)-1)
    env=np.exp(-t*7)*np.minimum(1,t/0.003)
    return lp_fast(saw,cut)*env*gain
def shimmer(dur,midis,gain=0.05):
    n=int(SR*dur); t=np.arange(n)/SR; out=np.zeros(n)
    for m in midis:
        f=hz(m); out+=np.sin(2*np.pi*f*t)*(0.6+0.4*np.sin(2*np.pi*0.23*t+m))
    env=np.minimum(1,t/1.2)*np.minimum(1,(dur-t)/0.8).clip(0,1)
    return out*env*gain/len(midis)
def riser(dur,gain=0.12):
    n=int(SR*dur); t=np.arange(n)/SR; x=rng.standard_normal(n)
    X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR); X*=np.exp(-((np.log(f+1)-np.log(2500))**2)/1.5); x=np.fft.irfft(X,n)
    return x/np.abs(x).max()*(t/dur)**2.5*gain
def pluck(m,gain=0.25):
    n=int(SR*1.6); t=np.arange(n)/SR; f=hz(m)
    s=sum(np.sin(2*np.pi*f*k*t)/k**1.6*np.exp(-t*(3+k*1.5)) for k in range(1,7))
    return s*np.minimum(1,t/0.002)*gain
b=lambda k: k*BEAT
G2,Bb2,D3,F3,G3,A3,Bb3,C4,D4,Eb4,F4,G4,A4,Bb4,D5,F5,G5=43,46,50,53,55,57,58,60,62,63,65,67,69,70,74,77,79
Eb3=51; Eb2=39; Bb1=34; F2=41
# 0) accroche : note grave + piano, la fondamentale est là dès 0
add(sub_boom(3.5,49,0.55),0.0)
add(pad([G2,D3,Bb3],4.9,att=0.25,rel=0.8,bright=900,gain=0.16),0.0)
# 0–4,67 : piano clairsemé, un mot = une note
for k,(m,v) in enumerate([(D5,0.55),(Bb4,0.45),(G4,0.45),(A4,0.45),(D5,0.6)]):
    tt=[0,2,3,4,5][k]
    add(piano(m,3.5,v),b(tt),pan=[-.25,.2,-.1,.25,0][k])
    add(piano(m-24,3.0,v*0.5),b(tt),pan=0)
add(piano(G3,4,0.4),b(5)); add(piano(Bb3,4,0.35),b(5)+0.02,pan=.2)
# 4,67–8,0 : respiration (la Terre), presque rien, puis montée vers le plan
add(shimmer(3.6,[G5,D5,Bb4],0.05),b(7)-0.2)
add(riser(b(5),0.10),b(7))
for k,m in enumerate([D4,F4,G4,A4,Bb4]):  # jours 1 à 5 qui s'allument
    add(pluck(m+12,0.16),b(7)+0.7+k*0.45,pan=-0.4+0.2*k)
# 8,0–16,0 : pulsation et cordes ; Gm | Eb | Bb | F  (3 beats each ≈ cut every 1,5 beat)
chords=[[G2,D3,G3,Bb3,D4],[Eb2,Bb2,G3,Bb3,Eb4],[Bb1,F2,F3,Bb3,D4],[F2,C4-12,A3,C4,F4]]
roots=[G2,Eb2,Bb1,F2]
for c in range(4):
    t0=b(12)+c*b(3)
    add(pad(chords[c],b(3)+0.6,att=0.08 if c else 0.4,rel=0.5,bright=1400+500*c,gain=0.15+0.02*c),t0)
    add(sub_boom(b(3),hz(roots[c]+12)/2*2,0.35),t0)
    for e in range(6):  # croches de basse pulsée
        add(pulse(roots[c]+12+(12 if e%2 else 0),0.4,0.16+0.02*c,700+300*c),t0+e*BEAT/2,pan=(-0.3 if e%2 else 0.3))
for k in range(12): add(kick(0.45+0.02*k),b(12)+k*BEAT)
for k in range(8):  # un accent par coupe (toutes les 1,5 temps)
    add(piano([D5,Bb4,G5,F5,D5,Bb4,A4,F5][k],2.5,0.33),b(12)+k*1.5*BEAT,pan=(-0.2 if k%2 else 0.2))
add(riser(b(3),0.10),b(21))
# 16,0 : résolution sur Si bémol majeur (« Tout est prévu. »)
add(sub_boom(3.0,hz(Bb1+12),0.6),b(24))
add(pad([Bb2,F3,D4,F4,C4+12],4.2,att=0.05,rel=1.6,bright=2200,gain=0.17),b(24))
add(piano(Bb4,4,0.5),b(24)); add(piano(D5,4,0.45),b(24)+0.03,pan=.2); add(piano(F5,4,0.4),b(24)+0.06,pan=-.2)
# 18,0 : logo — impact grave + note aiguë qui tient jusqu'à la fin
add(sub_boom(2.0,49,0.75),b(27)); add(kick(0.6),b(27))
add(piano(G5,2.2,0.5),b(27)); add(piano(D5,2.2,0.35),b(27)+0.02,pan=.25); add(piano(G4,2.2,0.3),b(27)+0.04,pan=-.25)
add(shimmer(2.0,[G5,D5],0.04),b(27))
# --- réverbération stéréo (convolution) ---
def ir(seconds=2.6,seed=1):
    r=np.random.default_rng(seed); n=int(SR*seconds); t=np.arange(n)/SR
    x=r.standard_normal(n)*np.exp(-t*3.0/seconds*2.3); x=lp_fast(x,6000); x[:int(0.012*SR)]=0; return x/np.sqrt((x**2).sum())
def conv(x,h): 
    n=len(x)+len(h); F=1<<int(np.ceil(np.log2(n))); return np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(h,F),F)[:len(x)]
wet=0.32
L2=L*(1-wet)+conv(L,ir(2.6,1))*wet*1.6; R2=R*(1-wet)+conv(R,ir(2.6,2))*wet*1.6
# fondu de fin dans la dernière 0,4 s (pas de queue molle)
t=np.arange(N)/SR; fade=np.clip((DUR-t)/0.45,0,1)**1.5; L2*=fade; R2*=fade
st=np.stack([L2,R2],1); st/=np.abs(st).max()*1.15
out=sys.argv[1]
with wave.open(out,'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    a=(np.clip(st,-1,1)*(2**23-1)).astype(np.int32)
    by=np.zeros((a.size,3),np.uint8); flat=a.reshape(-1)
    by[:,0]=flat&255; by[:,1]=(flat>>8)&255; by[:,2]=(flat>>16)&255
    w.writeframes(by.tobytes())
print('ok',N)
