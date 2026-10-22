'use strict';
// Coffeebreak keep-open layer: screen awake, stay connected to the paired phone, ask before leaving.
(function(){
var W=window,isPhone=typeof W.onPair==='function',embed=/[?&]embed=1/.test(location.search),android=/Android/i.test(navigator.userAgent);
var K=W.cbKeep={link:null,peerNum:null,up:false,lastPong:0,drops:0};
function $i(id){return document.getElementById(id)}
// 1. screen awake the whole time
var lock=null;function wakeUp(){try{if('wakeLock' in navigator&&!document.hidden&&!lock){navigator.wakeLock.request('screen').then(function(l){lock=l;l.addEventListener('release',function(){lock=null;setTimeout(wakeUp,500)})}).catch(function(){})}}catch(e){}}
setInterval(wakeUp,5000);
// 2. silent looping sound after the first tap (helps iPhone keep the page running)
var sil=null;function silent(){if(sil)return;try{var r=8000,n=r,b=new ArrayBuffer(44+n),v=new DataView(b),w=function(o,s){for(var i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,r,true);v.setUint32(28,r,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,'data');v.setUint32(40,n,true);for(var i=0;i<n;i++)v.setUint8(44+i,128);
 sil=new Audio(URL.createObjectURL(new Blob([b],{type:'audio/wav'})));sil.loop=true;sil.setAttribute('playsinline','');sil.volume=0.01;sil.play().catch(function(){sil=null})}catch(e){sil=null}}
['touchend','click'].forEach(function(ev){document.addEventListener(ev,function(){silent();wakeUp()},{passive:true})});
// 3. ask before leaving
if(!embed){W.addEventListener('beforeunload',function(e){if(W.cbAllowLeave)return;e.preventDefault();e.returnValue='Leave the app?';return 'Leave the app?'});
 try{history.pushState({cbk:1},'',location.href);W.addEventListener('popstate',function(){if(confirm('Leave the app? Calls will stop coming in.')){W.cbAllowLeave=1;history.back()}else history.pushState({cbk:1},'',location.href)})}catch(e){}}
// 4. reconnect straight away on return
function back(){wakeUp();try{if(typeof peer!=='undefined'){if(!peer||peer.destroyed){back200();restart()}else if(peer.disconnected)peer.reconnect()}}catch(e){}if(isPhone&&(!K.link||!K.link.open))keep(true);if(sil&&sil.paused)sil.play().catch(function(){})}
function back200(){try{W.eval('back=200')}catch(e){}}
document.addEventListener('visibilitychange',function(){if(!document.hidden)back()});W.addEventListener('focus',back);W.addEventListener('pageshow',back);W.addEventListener('online',function(){setTimeout(back,100)});
// 5. full-screen Keep open button on Android
function fsBtn(){if(embed||!android||!document.documentElement.requestFullscreen||$i('cbkeepfs'))return;var b=document.createElement('button');b.id='cbkeepfs';b.className='big grey small';b.textContent='Keep open (full screen)';b.setAttribute('aria-label','Keep open full screen');b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:35;width:auto;padding:.6em 1.2em';
 b.onclick=function(){document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(function(){});wakeUp();silent()};document.body.appendChild(b);
 document.addEventListener('fullscreenchange',function(){b.style.display=document.fullscreenElement?'none':''})}
// 6. stay connected to the paired phone, with pings and instant reconnect
function nameOf(n){try{var c=S.contacts[n];return c&&!c.del&&c.name||'the other phone'}catch(e){return 'the other phone'}}
function bar(){if(!isPhone)return;var e=$i('cbbar');if(!e){e=document.createElement('div');e.id='cbbar';e.setAttribute('role','status');e.style.cssText='position:sticky;top:0;left:0;right:0;z-index:36;padding:.55em;text-align:center;font-weight:800;font-size:1.05rem;color:#000';document.body.insertBefore(e,document.body.firstChild)}
 var n=K.peerNum;if(!n){e.style.display='none';return}e.style.display='block';var up=K.link&&K.link.open&&Date.now()-K.lastPong<12000;K.up=up;e.style.background=up?'#3ddc84':'#ffd84d';e.textContent=(up?'Connected to ':'Reconnecting to ')+nameOf(n)}
function target(){try{var l=get('last',null);if(l&&norm(l)&&l!==myNum())return l;var cl=contactList().filter(function(c){return norm(c.n)});return cl.length?cl[cl.length-1].n:null}catch(e){return null}}
function wire(d,n){K.link=d;K.peerNum=n;d.on('data',function(x){if(!x||typeof x!=='object')return;if(x.t==='kping'){try{d.send({t:'kpong'})}catch(e){}K.lastPong=Date.now()}else if(x.t==='kpong')K.lastPong=Date.now();bar()});
 d.on('open',function(){K.lastPong=Date.now();bar()});var gone=function(){if(K.link===d){K.link=null;K.drops++;bar();setTimeout(function(){keep(true)},300)}};d.on('close',gone);d.on('error',gone)}
var kt=null;function keep(now){clearTimeout(kt);if(!isPhone)return;var n=target();if(!n){kt=setTimeout(keep,3000);return}K.peerNum=n;
 if(K.link&&K.link.open&&K.link.cbNum===n){bar();return}
 if(typeof peer==='undefined'||!peer||!ready||peer.disconnected){bar();kt=setTimeout(keep,now?700:1500);return}
 try{if(K.link)K.link.close()}catch(e){}var d=peer.connect(pid(n),{metadata:{kind:'keep',ver:APP_VER,num:myNum()},serialization:'json',reliable:true});d.cbNum=n;wire(d,n);
 kt=setTimeout(function(){if(!d.open){try{d.close()}catch(e){}if(K.link===d)K.link=null;keep()}},5000)}
W.cbKeepIn=function(d){var m=d.metadata||{},n=norm(m.num);if(!n)return;if(K.link&&K.link.open&&K.link.cbNum===n&&K.link!==d){try{K.link.close()}catch(e){}}d.cbNum=n;wire(d,n);try{put('last',n)}catch(e){}};
setInterval(function(){if(!isPhone)return;var d=K.link;if(d&&d.open){try{d.send({t:'kping'})}catch(e){}if(Date.now()-K.lastPong>12000){try{d.close()}catch(e){}}}else keep();bar()},4000);
function start(){fsBtn();bar();if(isPhone)keep(true);wakeUp()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
