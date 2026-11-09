/* Rejoué tel quel sur la référence et sur l'application (?debug=1). Il modifie l'état : l'exécuter sur une page fraîche. */
(()=>{const K=window.__ks,out={};
const snap=(label)=>{const k=K.kit(),t=K.totals(),c=K.cog(),cs=K.cogState(c),bl=K.blockers();
 return {label,kit:k.id,bag:k.bag,bagWeight_g:K.bagWeight(),totalCap_L:+K.totalCap().toFixed(3),
  capOf:Object.fromEntries(['lid','main','front','sides','hip','back'].map(z=>[z,+K.capOf(z).toFixed(3)])),
  totals:{base:Math.round(t.base),back:Math.round(t.back),worn:Math.round(t.worn),cons:Math.round(t.cons),used_L:+t.used.toFixed(3),cap_L:+t.cap.toFixed(3),buy:t.buy,rent:t.rent},
  cog:{x:+c.x.toFixed(4),y:+c.y.toFixed(4),z:+c.z.toFixed(4)},cogState:cs.t,
  blockers:bl.map(b=>b.t||b.n||JSON.stringify(b).slice(0,60)),readiness:K.readiness(bl,cs),
  tips:K.tips().map(x=>x.t),pieces:K.pieces().map(p=>[p,K.pieceState(p),K.pieceCw(p)]),
  orderTotal_eur:K.orderTotal(),ptsCorps:[K.ptsUsed('corps'),K.ptsCap('corps')],ptsChassis:[K.ptsUsed('chassis'),K.ptsCap('chassis')],
  mods:Object.fromEntries(K.MODS.map(m=>[m,K.modOn(m)])),
  cabin:k.cabin?Object.fromEntries(Object.entries(K.cabinDims()).map(([a,b])=>[a,+b.toFixed(2)])):null};};
const res=[];
for(let i=0;i<3;i++){K.loadKit(i,true);res.push(snap('kit '+i+' au chargement'));}
K.loadKit(0,true);K.autopack();res.push(snap('kit 0 après rangement automatique'));
K.setMode('custo',true);K.S.part='all';K.S.cat='mod';
res.push({label:'optList modules kit 0',opts:K.optList().map(o=>[o.id,o.w,!!o.cur,!!o.off])});
K.applyOpt('tool');K.applyOpt('hipp');res.push(snap('kit 0 + porte-piolet + poches de ceinture'));
K.S.cat='shape';res.push({label:'optList corps (7 points utilisés)',opts:K.optList().map(o=>[o.id,o.w,!!o.cur,!!o.off,o.why||''])});
K.S.cat='mod';K.applyOpt('tool');K.S.cat='shape';K.applyOpt('b28');res.push(snap('kit 0 passé au corps 28 L'));
K.S.cat='col';K.S.part='all';K.applyOpt('preset:nuit');res.push(snap('kit 0 coloris Nuit'));
K.confirmOrder();res.push(snap('kit 0 après précommande'));
K.loadKit(2,true);res.push(snap('kit 2 cabine'));
return res;})()
