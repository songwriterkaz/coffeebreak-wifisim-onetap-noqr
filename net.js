'use strict';
// Coffeebreak shared connection layer: shared ICE list, backup pairing line, connection check.
(function(){
var W=window,ICE_URL='https://songwriterkaz.github.io/coffeebreak-ice/ice.json';
var DEF=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302','stun:stun3.l.google.com:19302','stun:stun4.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:global.stun.twilio.com:3478'},{urls:'stun:stun.nextcloud.com:443'}];
var N=W.cbNet={internet:null,iceLoaded:false,mqtt:false,ntfy:false,seen:0,voice:null,mic:null,sound:false,cell:false,errors:[]};
function cached(){try{var v=JSON.parse(localStorage.getItem('cb_ice')||'null');if(v&&Array.isArray(v.iceServers)&&v.iceServers.length)return v.iceServers}catch(e){}return DEF}
W.cbIceServers=function(){return cached().slice()};
function applyIce(list){try{if(typeof ICE!=='undefined'){ICE.iceServers.length=0;list.forEach(function(s){ICE.iceServers.push(s)})}
 if(typeof ICE_RELAY!=='undefined'){var t=list.filter(function(s){return [].concat(s.urls).some(function(u){return /^turns?:/.test(u)})});ICE_RELAY.iceServers.length=0;t.forEach(function(s){ICE_RELAY.iceServers.push(s)})}
 if(typeof TURN_FREE!=='undefined'){var t2=list.filter(function(s){return [].concat(s.urls).some(function(u){return /^turns?:/.test(u)})});TURN_FREE.length=0;t2.forEach(function(s){TURN_FREE.push(s)})}}catch(e){}}
W.cbHasTurn=function(){return cached().some(function(s){return [].concat(s.urls).some(function(u){return /^turns?:/.test(u)})})};
function loadIce(){fetch(ICE_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){if(j&&Array.isArray(j.iceServers)&&j.iceServers.length){localStorage.setItem('cb_ice',JSON.stringify({iceServers:j.iceServers}));N.iceLoaded=true;N.internet=true;applyIce(j.iceServers)}}).catch(function(){N.internet=navigator.onLine?null:false})}
// --- watch every WebRTC connection so the check can show the voice path ---
var O=W.RTCPeerConnection;
if(O){var P=function(c){var pc=new O(c);try{pc.addEventListener('connectionstatechange',function(){var s=pc.connectionState;if(s==='connected'){N.seen=Date.now();pathOf(pc)}else if(s==='failed'){N.voice={ok:false,txt:'Could not join the two phones'}}})}catch(e){}return pc};P.prototype=O.prototype;Object.keys(O).forEach(function(k){try{P[k]=O[k]}catch(e){}});try{P.generateCertificate=O.generateCertificate}catch(e){}W.RTCPeerConnection=P}
function pathOf(pc){if(!pc.getStats)return;pc.getStats().then(function(st){var pair=null,loc={},rem={};st.forEach(function(r){if(r.type==='transport'&&r.selectedCandidatePairId)pair=st.get(r.selectedCandidatePairId)});if(!pair)st.forEach(function(r){if(r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded')pair=r});if(!pair)return;loc=st.get(pair.localCandidateId)||{};rem=st.get(pair.remoteCandidateId)||{};
 var relay=loc.candidateType==='relay'||rem.candidateType==='relay',same=loc.candidateType==='host'&&rem.candidateType==='host';
 N.voice={ok:true,relay:relay,txt:relay?(N.cell?'On mobile data - using relay':'Using relay'):same?'Direct, same WiFi':'Direct'}}).catch(function(){})}
// --- microphone ---
try{var gum=navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);if(gum)navigator.mediaDevices.getUserMedia=function(c){return gum(c).then(function(s){if(c&&c.audio)N.mic=true;return s},function(e){if(c&&c.audio)N.mic=false;throw e})}}catch(e){}
try{navigator.permissions&&navigator.permissions.query({name:'microphone'}).then(function(p){var f=function(){if(p.state==='granted')N.mic=true;else if(p.state==='denied')N.mic=false};f();p.onchange=f}).catch(function(){})}catch(e){}
try{var cn=navigator.connection;var fc=function(){N.cell=!!(cn&&cn.type==='cellular')};fc();cn&&cn.addEventListener('change',fc)}catch(e){}
W.addEventListener('error',function(e){N.errors.push(String(e.message||e))});
// --- backup pairing line over a public MQTT broker (used alongside the main call server) ---
var BROKERS=['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt','wss://test.mosquitto.org:8081/mqtt'],bi=0,ws=null,subs={},pingT=null,TP='coffeebreak-dsim-v1/';
function u8(s){return new TextEncoder().encode(s)}
function str(s){var b=u8(s);return [b.length>>8,b.length&255].concat(Array.from(b))}
function len(n){var o=[];do{var d=n%128;n=Math.floor(n/128);if(n>0)d|=128;o.push(d)}while(n>0);return o}
function pkt(h,body){return new Uint8Array([h].concat(len(body.length),body))}
function send(a){try{ws&&ws.readyState===1&&ws.send(a)}catch(e){}}
function sub(t){send(pkt(0x82,[0,1].concat(str(TP+t),[0])))}
function mq(){try{ws&&ws.close()}catch(e){}var url=BROKERS[bi%BROKERS.length],s;try{s=new WebSocket(url,'mqtt')}catch(e){bi++;setTimeout(mq,2000);return}ws=s;s.binaryType='arraybuffer';var buf=new Uint8Array(0),ok=false;
 var to=setTimeout(function(){if(!ok){bi++;mq()}},6000);
 s.onopen=function(){send(pkt(0x10,str('MQTT').concat([4,2,0,60],str('cb'+Math.random().toString(36).slice(2,12)))))};
 s.onmessage=function(ev){var d=new Uint8Array(ev.data),b=new Uint8Array(buf.length+d.length);b.set(buf);b.set(d,buf.length);buf=b;
  while(buf.length>=2){var m=1,v=0,i=1,c;do{if(i>=buf.length)return;c=buf[i++];v+=(c&127)*m;m*=128}while(c&128);if(buf.length<i+v)return;var t=buf[0]>>4,body=buf.slice(i,i+v);buf=buf.slice(i+v);
   if(t===2&&body[1]===0){ok=true;clearTimeout(to);N.mqtt=true;Object.keys(subs).forEach(sub);clearInterval(pingT);pingT=setInterval(function(){send(new Uint8Array([0xC0,0]))},25000)}
   else if(t===3){var tl=(body[0]<<8)|body[1],topic=new TextDecoder().decode(body.slice(2,2+tl)),q=(buf.length,0);try{got(topic.slice(TP.length),JSON.parse(new TextDecoder().decode(body.slice(2+tl))))}catch(e){}}}};
 var down=function(){if(ws!==s)return;N.mqtt=false;clearTimeout(to);clearInterval(pingT);if(!ok)bi++;setTimeout(mq,ok?1000:2000)};s.onclose=down;s.onerror=function(){try{s.close()}catch(e){}}}
var recent={};
function got(topic,m){if(!m||typeof m!=='object'||!m.num)return;var key=topic+m.kind+m.num;if(recent[key]&&Date.now()-recent[key]<1500)return;recent[key]=Date.now();N.seen=Date.now();if((m.kind==='pair'||m.kind==='pairok')&&W.onPair)W.onPair(m,'mqtt')}
// second backup line: ntfy.sh over normal https port 443 (works on networks that block other ports)
var nws=null,nT=null;
function nt(){clearTimeout(nT);try{nws&&nws.close()}catch(e){}var t=Object.keys(subs);if(!t.length)return;var s;try{s=new WebSocket('wss://ntfy.sh/'+t.map(function(x){return 'cbdsim1-'+x}).join(',')+'/ws')}catch(e){nT=setTimeout(nt,3000);return}nws=s;
 s.onmessage=function(ev){try{var j=JSON.parse(ev.data);if(j.event==='open')N.ntfy=true;if(j.event==='message')got(String(j.topic).replace(/^cbdsim1-/,''),JSON.parse(j.message))}catch(e){}};
 s.onclose=function(){if(nws!==s)return;N.ntfy=false;nT=setTimeout(nt,2000)};s.onerror=function(){try{s.close()}catch(e){}}}
W.cbSub=function(t){if(subs[t])return;subs[t]=1;sub(t);clearTimeout(nT);nT=setTimeout(nt,50)};
W.cbUnsub=function(t){delete subs[t]};
W.cbPub=function(t,m){var j=JSON.stringify(m),ok=false;if(N.mqtt){send(pkt(0x30,str(TP+t).concat(Array.from(u8(j)))));ok=true}if(navigator.onLine!==false){try{fetch('https://ntfy.sh/cbdsim1-'+t,{method:'POST',body:j,keepalive:true}).catch(function(){})}catch(e){}ok=true}return ok};
// --- sound output (Bluetooth headsets, earbuds, car kits) ---
W.cbOutputs=function(){var a=document.getElementById('aud');if(!a||typeof a.setSinkId!=='function')return Promise.resolve(null);
 if(navigator.mediaDevices&&navigator.mediaDevices.selectAudioOutput)return Promise.resolve('picker');
 return navigator.mediaDevices.enumerateDevices().then(function(d){return d.filter(function(x){return x.kind==='audiooutput'})}).catch(function(){return null})};
W.cbSetOutput=function(id){var a=document.getElementById('aud');if(!a)return;if(id==='picker'){navigator.mediaDevices.selectAudioOutput().then(function(d){a.setSinkId(d.deviceId)}).catch(function(){})}else a.setSinkId(id).catch(function(){})};
// --- in-app browsers and frames that can block calls ---
function inApp(){var u=navigator.userAgent||'';return /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|; wv\)|GSA\/|MicroMessenger/i.test(u)}
function framed(){try{return W.top!==W.self&&!/[?&]embed=1/.test(location.search)}catch(e){return true}}
// --- the check panel ---
function q(id){return document.getElementById(id)}
function frameNet(){try{var f=q('phonepanel');return f&&f.contentWindow&&f.contentWindow.cbNet?f.contentWindow:null}catch(e){return null}}
function rows(){var fw=frameNet(),n=fw?fw.cbNet:N,G=fw||W,r=[];
 var online=navigator.onLine!==false&&N.internet!==false;
 var srv=false,lk=0;try{srv=G.eval('typeof ready!=="undefined"&&ready');lk=G.eval('typeof linkedCount==="function"?linkedCount():0')}catch(e){}
 r.push([online,'Internet',online?(n.cell?'On mobile data':'Connected'):'No internet. Turn on WiFi or mobile data.']);
 var bk=n.mqtt||n.ntfy;r.push([srv||bk,'Call server',srv?'Connected'+(bk?', backup line connected too':''):bk?'Main server not answering, backup line connected for pairing':'Not connected yet. Waiting…']);
 var seen=n.seen||lk>0;r.push([seen?true:null,'Other phone found',seen?'Yes':'Not yet. Open the app on the other phone, then tap Connect a phone.']);
 var v=n.voice;r.push([v?v.ok:null,'Voice path',v?v.txt:'Starts on the first call'+(G.cbHasTurn&&G.cbHasTurn()?'':'. No relay key yet, so mobile data calls may not get voice')]);
 r.push([n.mic,'Microphone allowed',n.mic===true?'Yes':n.mic===false?'Blocked. Allow the microphone in your phone settings for this site.':'Your phone asks on the first call']);
 var a=null;try{a=G.document.getElementById('aud')}catch(e){}var snd=!!(a&&a.srcObject&&!a.paused&&a.srcObject.getAudioTracks&&a.srcObject.getAudioTracks().some(function(t){return t.readyState==='live'}));
 r.push([snd?true:null,'Sound playing',snd?'Yes':'Starts on a call. If you cannot hear, tap the screen once.']);
 return r}
function paint(){var b=q('cbcheckrows');if(!b)return;b.innerHTML='';rows().forEach(function(x){var d=document.createElement('div');d.style.cssText='display:flex;gap:.6em;align-items:flex-start;text-align:left;margin:.45em 0;font-size:1.1rem';var i=document.createElement('span');i.textContent=x[0]===true?'✓':x[0]===false?'✗':'…';i.style.cssText='font-weight:800;font-size:1.4rem;min-width:1.2em;color:'+(x[0]===true?'#3ddc84':x[0]===false?'#ff5a5a':'#ffd84d');var t=document.createElement('span');t.innerHTML='<b></b><br><span style="opacity:.85"></span>';t.firstChild.textContent=x[1];t.lastChild.textContent=x[2];d.appendChild(i);d.appendChild(t);b.appendChild(d)});
 var w=q('cbwarn');if(w){var m=inApp()?'This is opening inside another app, which can block calls. Tap the menu and choose Open in Safari or Open in Chrome.':framed()?'This is opening inside another page, which can block calls. Open it on its own:':'';w.textContent=m;w.style.display=m?'block':'none';if(m&&framed()){var l=document.createElement('a');l.href=location.href.split('#')[0];l.target='_blank';l.textContent=' Open the app';l.style.color='#ffd84d';w.appendChild(l)}}}
var pt=null;
function open(){var o=q('cbcheck');if(!o)return;o.classList.remove('hide');o.style.display='flex';paint();clearInterval(pt);pt=setInterval(paint,1000);
 W.cbOutputs().then(function(l){var s=q('cbout');if(!s)return;s.innerHTML='';if(!l||(Array.isArray(l)&&l.length<2&&l!=='picker')){s.style.display='none';return}s.style.display='block';
  if(l==='picker'){var bt=document.createElement('button');bt.className='big grey small';bt.textContent='Choose sound output';bt.onclick=function(){W.cbSetOutput('picker')};s.appendChild(bt);return}
  var sel=document.createElement('select');sel.style.cssText='font-size:1.1rem;padding:.4em;width:100%';sel.setAttribute('aria-label','Sound output');l.forEach(function(d,i){var op=document.createElement('option');op.value=d.deviceId;op.textContent=d.label||('Speaker '+(i+1));sel.appendChild(op)});sel.onchange=function(){W.cbSetOutput(sel.value)};s.appendChild(document.createTextNode('Sound output '));s.appendChild(sel)})}
function close(){var o=q('cbcheck');if(o){o.classList.add('hide');o.style.display='none'}clearInterval(pt)}
W.cbCheckOpen=open;W.cbCheckRows=rows;
function build(){if(q('cbcheck'))return;var o=document.createElement('section');o.id='cbcheck';o.className='ov hide';o.setAttribute('aria-live','polite');o.setAttribute('aria-label','Connection check');
 o.style.cssText='position:fixed;inset:0;z-index:40;background:#000;color:#fff;display:none;flex-direction:column;align-items:center;justify-content:flex-start;overflow:auto;padding:1.2em';
 o.innerHTML='<img src="logo.png" alt="Coffeebreak" style="width:90px;height:auto;margin:.2em auto"><p style="color:#ffd84d;font-size:1.8rem;font-weight:800;margin:.2em 0">Connection check</p><p id="cbwarn" style="display:none;background:#5a1d1d;padding:.6em;border-radius:10px;max-width:30em"></p><div id="cbcheckrows" style="max-width:30em;width:100%"></div><div id="cbout" style="max-width:30em;width:100%;margin:.6em 0;display:none"></div><p style="opacity:.8;max-width:30em;font-size:.95rem">Bluetooth headsets and car kits work automatically. If a step shows a cross, tell Coffeebreak which one.</p><button id="cbretry" class="big blue small">Reconnect now</button><button id="cbback" class="big grey small">Back</button>';
 document.body.appendChild(o);q('cbback').onclick=close;q('cbretry').onclick=function(){try{var fw=frameNet();(fw||W).eval('back=200;restart()')}catch(e){}try{mq()}catch(e){}paint()};
 var tb=q('testb');if(tb){tb.textContent='Connection check';tb.setAttribute('aria-label','Connection check');tb.onclick=function(){try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}open()}}
 if(/[?&]check=1/.test(location.search))open()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
// keep things fresh after the phone wakes up
document.addEventListener('visibilitychange',function(){if(!document.hidden){if(!ws||ws.readyState>1)mq();if(!nws||nws.readyState>1)nt();loadIce()}});
loadIce();mq();
})();
