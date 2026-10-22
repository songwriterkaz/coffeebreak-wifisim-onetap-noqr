'use strict';
const APP_VER=6;
const $=s=>document.querySelector(s),PFX='coffeebreak-dsim-v1-';
const TURN_FREE=[];
const STUN=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302','stun:stun3.l.google.com:19302','stun:stun4.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:global.stun.twilio.com:3478'}];
const ICE={iceServers:(window.cbIceServers?cbIceServers():STUN),iceTransportPolicy:'all',iceCandidatePoolSize:10};
const ICE_RELAY={iceServers:[],iceTransportPolicy:'relay'};
const get=(k,d)=>{try{const v=localStorage.getItem('cbl_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},put=(k,v)=>{try{localStorage.setItem('cbl_'+k,JSON.stringify(v))}catch(e){}};
const norm=s=>{const m=String(s||'').match(/CB-?(\d{4})-?(\d{4})/i);return m?`CB-${m[1]}-${m[2]}`:null};
const rnd=n=>{const a=new Uint32Array(n);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(36)).join('')};
// link another device: ?link=CB-....&k=key
(()=>{const q=new URLSearchParams(location.search),l=norm(q.get('link')),k=q.get('k');if(l&&k&&/^[a-z0-9]{6,40}$/.test(k)){put('num',l);put('lk',k);put('setup',1);history.replaceState(null,'',location.pathname)}})();
function myNum(){let me=get('num');if(!me){const a=new Uint32Array(2);crypto.getRandomValues(a);me=`CB-${1000+a[0]%9000}-${String(a[1]%10000).padStart(4,'0')}`;put('num',me)}return me}
function linkKey(){let k=get('lk');if(!k){k=rnd(3).slice(0,24);put('lk',k)}return k}
function linkURL(){return location.href.split('#')[0].split('?')[0]+'?link='+myNum()+'&k='+linkKey()}
const pid=n=>PFX+n.replace(/-/g,'');
const fromPid=p=>norm(String(p).slice(PFX.length).replace(/^CB(\d{4})(\d{4}).*$/,'CB-$1-$2'));
function say(t){try{if(!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.rate=0.9;speechSynthesis.speak(u)}catch(e){}}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p||60)}catch(e){}}
function shareLink(me){return location.href.split('#')[0].split('?')[0]+'?add='+me}
// ---------- synced store (latest edit wins, nothing lost) ----------
let S=get('sync',null);if(!S){S={contacts:{},calls:[],profile:{ts:0}};(get('contacts',[])||[]).forEach((c,i)=>S.contacts[c.n]={name:c.name,ts:1+i});put('sync',S)}
let onSync=()=>{};
function merge(o){if(!o||typeof o!=='object')return false;let ch=false;
 for(const[n,c]of Object.entries(o.contacts||{})){if(!(norm(n)||/^tel:\+?\d{3,15}$/.test(n))||!c||typeof c.ts!=='number')continue;const m=S.contacts[n];if(!m||c.ts>m.ts){S.contacts[n]={name:String(c.name||'').slice(0,40),ts:c.ts,del:!!c.del};ch=true}}
 const ids=new Set(S.calls.map(c=>c.id));for(const c of(o.calls||[]))if(c&&c.id&&!ids.has(c.id)){S.calls.push({id:String(c.id),ts:+c.ts||0,n:norm(c.n),dir:c.dir==='in'?'in':'out'});ch=true}
 S.calls.sort((a,b)=>a.ts-b.ts);S.calls=S.calls.slice(-50);
 if(o.profile&&o.profile.ts>S.profile.ts){S.profile={name:String(o.profile.name||'').slice(0,40),ts:o.profile.ts};ch=true}
 if(ch){put('sync',S);onSync()}return ch}
function contactList(){return Object.entries(S.contacts).filter(([,c])=>!c.del).sort((a,b)=>a[1].ts-b[1].ts).map(([n,c])=>({n,name:c.name}))}
function delContact(n){if(S.contacts[n]){S.contacts[n]={name:S.contacts[n].name,ts:Date.now(),del:true};put('sync',S);onSync();pushSync()}}
function setContact(n,name){S.contacts[n]={name,ts:Date.now()};put('sync',S);onSync();pushSync()}
function addCall(n,dir){S.calls.push({id:Date.now()+rnd(1),ts:Date.now(),n,dir});S.calls=S.calls.slice(-50);put('sync',S);onSync();pushSync()}
// ---------- always-online network ----------
var T0=performance.now(),connectMs=null;
let PRESENCE=!!window.CB_PRESENCE,peer=null,ready=false,role='hub',back=200,devs={},link=null,synced=false,devId=rnd(1),lastOK=0,wdBusy=false,claimT=null;
let onReady=()=>{},onCall=()=>{},onState=()=>{},onRing=()=>{},onStopRing=()=>{},onHubMsg=()=>{};
const linkedCount=()=>role==='hub'?Object.keys(devs).length:(link&&link.open?1:0);
function state(){onState({online:ready,role,linked:linkedCount(),synced:synced&&linkedCount()>0})}
function pushSync(){const m={t:'state',s:S};if(role==='hub')Object.values(devs).forEach(d=>{try{d.open&&d.send(m)}catch(e){}});else if(link&&link.open)try{link.send(m)}catch(e){}}
function toDevs(m,except){Object.entries(devs).forEach(([p,d])=>{if(p!==except)try{d.open&&d.send(m)}catch(e){}})}
function toHub(m){try{link&&link.open&&link.send(m)}catch(e){}}
function kill(){const o=peer;peer=null;try{o&&o.destroy()}catch(e){}ready=false;devs={};link=null;synced=false}
function startPeer(asHub,existing){clearTimeout(retry.t);if(asHub===undefined)asHub=true;const me=myNum();kill();role=asHub?'hub':'dev';state();
 if(PRESENCE){asHub=false;role='presence'}
 const p=existing||new Peer(PRESENCE?pid(me)+'s'+devId:asHub?pid(me):pid(me)+'d'+devId,{config:ICE,debug:0,pingInterval:4000});peer=p;
 const opened=()=>{if(p!==peer)return;ready=true;back=200;lastOK=Date.now();if(connectMs===null)connectMs=Math.round(performance.now()-T0);state();if(role==='dev')linkHub();onReady()};if(existing&&p.open)setTimeout(opened,0);else p.on('open',opened);
 p.on('disconnected',()=>{if(p!==peer)return;ready=false;state();setTimeout(()=>{if(p===peer&&p.disconnected&&!p.destroyed)try{p.reconnect()}catch(e){retry(asHub)}},300)});
 p.on('close',()=>{if(p===peer){ready=false;state();retry(asHub)}});
 p.on('error',e=>{if(p!==peer)return;
  if(e.type==='unavailable-id'){if(PRESENCE){devId=rnd(1);retry(false)}else if(asHub)startPeer(false);else{devId=rnd(1);retry(false)}}
  else if(e.type==='peer-unavailable'){const tg=(String(e.message).match(/peer (\S+)/)||[])[1];if(role==='dev'&&tg===pid(me))claimSoon(1500);else window.onPeerMissing&&window.onPeerMissing()}
  else if(['network','server-error','socket-error','socket-closed','browser-incompatible'].includes(e.type))retry(asHub)});
 p.on('connection',d=>{if(p!==peer)return;const m=d.metadata||{};checkVer(m.ver);
  if(m.kind==='link'){if(role!=='hub'||m.k!==get('lk')){d.on('open',()=>{try{d.send({t:'nope'})}catch(e){}setTimeout(()=>d.close(),500)});return}
   d.on('open',()=>{devs[d.peer]=d;synced=true;d.send({t:'state',s:S});state()});
   d.on('data',x=>{if(!x||typeof x!=='object')return;if(x.t==='state'){merge(x.s);toDevs({t:'state',s:S})}else onHubMsg(d.peer,x)});
   const gone=()=>{delete devs[d.peer];state()};d.on('close',gone);d.on('error',gone)}
  else if(m.kind==='pair'||m.kind==='pairok'){window.onPair&&window.onPair(m,d.peer);setTimeout(()=>{try{d.close()}catch(e){}},4000)}
  else window.onCallerConn&&window.onCallerConn(d)});
 p.on('call',c=>{checkVer(c.metadata&&c.metadata.ver);onCall(c)})}
function retry(asHub){ready=false;state();clearTimeout(retry.t);retry.t=setTimeout(()=>startPeer(asHub),back);back=Math.min(back*2,900)}
function restart(){startPeer(PRESENCE?false:(role==='hub'||!get('lk')))}
let claimBack=4000;function claimSoon(ms){if(PRESENCE)return;clearTimeout(claimT);claimT=setTimeout(()=>{if(role!=='dev'||(link&&link.open))return;
 // probe for the call ID without dropping the current connection; only swap if we get it
 const q=new Peer(pid(myNum()),{config:ICE,debug:0,pingInterval:4000});let ok=false;
 q.on('open',()=>{ok=true;claimBack=4000;startPeer(true,q)});
 q.on('error',e=>{if(ok)return;try{q.destroy()}catch(_){}claimBack=Math.min(claimBack*2,60000);if(e.type==='unavailable-id'&&ready&&role==='dev'&&!(link&&link.open))linkHub();else claimSoon(claimBack)})},ms)}
function linkHub(){const me=myNum();if(!get('lk')){claimSoon(3000);return}
 const l=peer.connect(pid(me),{metadata:{kind:'link',ver:APP_VER,k:get('lk')},reliable:true,serialization:'json'});link=l;
 const to=setTimeout(()=>{if(!l.open)claimSoon(claimBack)},6000);
 l.on('open',()=>{clearTimeout(to);synced=true;l.send({t:'state',s:S});state()});
 l.on('data',x=>{if(!x||typeof x!=='object')return;if(x.t==='state')merge(x.s);else if(x.t==='ring')onRing(x);else if(x.t==='stop')onStopRing(x);else if(x.t==='nope'){claimSoon(10000)}});
 const gone=()=>{if(link===l){link=null;synced=false;state();claimSoon(800)}};l.on('close',gone);l.on('error',gone)}
// watchdog + heartbeat + network events
function watchdog(){if(!navigator.onLine){ready=false;state();return}
 if(!peer||peer.destroyed){restart();return}
 if(peer.disconnected){try{peer.reconnect()}catch(e){restart()}return}
}
setInterval(watchdog,4000);
addEventListener('online',()=>{back=200;startPeer(!PRESENCE)});addEventListener('offline',()=>{ready=false;state()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)watchdog()});
addEventListener('pageshow',watchdog);
try{navigator.connection&&navigator.connection.addEventListener('change',()=>{back=200;setTimeout(()=>startPeer(!PRESENCE),300)})}catch(e){}
// mic only when a call starts
async function mic(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('nomic');
 return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
// iPhone/Android audio unlock
function unlockAudio(){const a=document.getElementById('aud');if(a){a.muted=false;a.play().catch(()=>{})}try{const C=window.AudioContext||window.webkitAudioContext;if(C){window._ac=window._ac||new C();window._ac.resume()}}catch(e){}}
['touchend','click'].forEach(ev=>document.addEventListener(ev,unlockAudio,{passive:true}));
// connection self-check: does a relay (TURN) candidate get gathered
function testConnection(){return new Promise(res=>{const r={host:false,srflx:false,relay:false};let pc;try{pc=new RTCPeerConnection({iceServers:ICE.iceServers})}catch(e){res(r);return}
 pc.createDataChannel('t');pc.onicecandidate=e=>{if(!e.candidate)return;const m=/ typ (host|srflx|relay)/.exec(e.candidate.candidate);if(m)r[m[1]]=true;if(r.relay)done()};
 let fin=false;const done=()=>{if(fin)return;fin=true;try{pc.close()}catch(e){}res(r)};pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete')done()};
 pc.createOffer().then(o=>pc.setLocalDescription(o)).catch(done);setTimeout(done,8000)})}
function testText(r){return r.relay?'Connection good. Calls can go through the free relay, so they should work on any WiFi or mobile data.':r.srflx?'Connection OK. Calls should work on most WiFi. The free relay did not answer, so some networks may block calls.':'Calls may not connect on this network. Try another WiFi or mobile data.'}
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});

// start the instant the script loads, before any UI work
if(navigator.onLine!==false)startPeer(!PRESENCE);
// keep the screen awake while the phone is open
let wl=null;async function wake(){try{if('wakeLock' in navigator&&!document.hidden&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}catch(e){wl=null}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){wake();watchdog()}});['click','touchend'].forEach(ev=>document.addEventListener(ev,wake,{passive:true}));wake();

// pairing: the hello travels through the signalling server itself, so it works even before audio can connect
const PHONE_URL=!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?'https://songwriterkaz.github.io/coffeebreak-onetap-phone'+(window.CB_NOQR?'-noqr':'')+'/':location.origin+(window.CB_NOQR?'/phone-noqr/':'/phone/');
function pairURL(){return PHONE_URL+'?pair='+myNum()+'&n='+encodeURIComponent((S.profile&&S.profile.name)||'Coffeebreak friend')}
function sendPair(to,kind){const bk=window.cbPub&&cbPub(to.replace(/-/g,''),{kind,ver:APP_VER,num:myNum(),name:(S.profile&&S.profile.name)||'Coffeebreak friend'});if(!peer||!ready)return !!bk;try{const d=peer.connect(pid(to),{metadata:{kind,ver:APP_VER,num:myNum(),name:(S.profile&&S.profile.name)||'Coffeebreak friend'},serialization:'json'});setTimeout(()=>{try{d.close()}catch(e){}},4000);return true}catch(e){return false}}
(()=>{const q=new URLSearchParams(location.search),a=norm(q.get('pair'));if(a&&a!==myNum()){put('pairWith',{n:a,name:String(q.get('n')||'').slice(0,40)||'Coffeebreak friend',t:Date.now()});history.replaceState(null,'',location.pathname)}})();
// short code pairing (no QR): a temporary helper ID made from a 6 digit code
let codePeer=null,codeVal=null;
function startCode(cb){if(codePeer&&codeVal&&codePeer.open){cb(codeVal);return}try{codePeer&&codePeer.destroy()}catch(e){}
 const c=String(100000+(crypto.getRandomValues(new Uint32Array(1))[0]%900000));window.cbSub&&cbSub('code'+c);const q=new Peer(PFX+'code'+c,{config:ICE,debug:0,pingInterval:4000});codePeer=q;
 q.on('open',()=>{codeVal=c;cb(c);clearTimeout(startCode.t);startCode.t=setTimeout(stopCode,15*60000)});
 q.on('error',e=>{if(q!==codePeer)return;if(e.type==='unavailable-id'){codePeer=null;startCode(cb)}else setTimeout(()=>{if(q===codePeer&&!q.open){codePeer=null;startCode(cb)}},1000)});
 q.on('disconnected',()=>{try{q.reconnect()}catch(e){}});
 q.on('connection',d=>{const m=d.metadata||{};if(m.kind==='pair'){window.onPair&&window.onPair(m,d.peer)}setTimeout(()=>{try{d.close()}catch(e){}},4000)})}
function stopCode(){codeVal&&window.cbUnsub&&cbUnsub('code'+codeVal);try{codePeer&&codePeer.destroy()}catch(e){}codePeer=null;codeVal=null}
function sendCode(code){const bk=window.cbPub&&cbPub('code'+code,{kind:'pair',ver:APP_VER,num:myNum(),name:(S.profile&&S.profile.name)||'Coffeebreak friend'});if(!peer||!ready)return !!bk;try{const d=peer.connect(PFX+'code'+code,{metadata:{kind:'pair',ver:APP_VER,num:myNum(),name:(S.profile&&S.profile.name)||'Coffeebreak friend'},serialization:'json'});setTimeout(()=>{try{d.close()}catch(e){}},4000);return true}catch(e){return false}}

// same version everywhere: if the other phone is newer, update and reload this one
function checkVer(v){v=+v||0;if(v>APP_VER&&get('reloadFor',0)<v){put('reloadFor',v);try{navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).finally(()=>setTimeout(()=>location.reload(),800))}catch(e){location.reload()}}}

window.cbSub&&cbSub(myNum().replace(/-/g,''));
