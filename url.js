'use strict';
// Coffeebreak link set-up: ?me=karen makes this phone "karen", ?call=karen connects to karen. Same ID on every path.
(function(){
var W=window;function g(k,d){try{var v=localStorage.getItem('cbl_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}}function p(k,v){try{localStorage.setItem('cbl_'+k,JSON.stringify(v))}catch(e){}}
function clean(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20)}
function h(s,seed){var x=seed>>>0;for(var i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)>>>0}return x>>>0}
function numFor(name){var s='coffeebreak:'+name;return 'CB-'+(1000+h(s,2166136261)%9000)+'-'+String(h(s,3735928559)%10000).padStart(4,'0')}
function nice(n){return n.charAt(0).toUpperCase()+n.slice(1)}
W.cbNameNum=numFor;
var q=new URLSearchParams(location.search),me=clean(q.get('me')),call=clean(q.get('call')),ch=false;
if(me){var n=numFor(me);if(g('num')!==n){p('num',n);p('lk',null)}p('meName',me);p('named',1);
 var S=g('sync',null)||{contacts:{},calls:[],profile:{ts:0}};if(!S.profile||!S.profile.name||/^Coffeebreak friend$/.test(S.profile.name)||g('meNameSetProfile',0)){S.profile={name:nice(me),ts:Date.now()};p('meNameSetProfile',1)}p('sync',S);ch=true}
if(call&&call!==g('meName')){var cn=numFor(call),S2=g('sync',null)||{contacts:{},calls:[],profile:{ts:0}};S2.contacts=S2.contacts||{};if(!S2.contacts[cn]||S2.contacts[cn].del)S2.contacts[cn]={name:nice(call),ts:Date.now()};p('sync',S2);p('pairWith',{n:cn,name:nice(call),t:Date.now()});p('last',cn);ch=true}
if(ch){q.delete('me');q.delete('call');var r=q.toString();history.replaceState(null,'',location.pathname+(r?'?'+r:''))}
var embed=/[?&]embed=1/.test(location.search);
function base(){return location.href.split('#')[0].split('?')[0]}
function myLink(){var m=g('meName');return m?base()+'?call='+m:null}
W.cbMyLink=myLink;
function card(){if(embed||document.getElementById('cblink'))return;var c=document.createElement('section');c.id='cblink';c.setAttribute('aria-label','Your link');
 c.style.cssText='background:#111;border:2px solid #ffd84d;border-radius:14px;margin:10px auto;padding:.8em;max-width:30em;text-align:center;color:#fff;position:relative;z-index:5';
 document.body.insertBefore(c,document.body.firstChild);paint()}
function btn(t,f,cls){var b=document.createElement('button');b.className='big '+(cls||'grey')+' small';b.textContent=t;b.onclick=f;b.style.margin='.25em';return b}
function paint(){var c=document.getElementById('cblink');if(!c)return;c.innerHTML='';var l=myLink();
 if(!l){var t=document.createElement('p');t.style.cssText='font-weight:800;color:#ffd84d;font-size:1.2rem;margin:.2em';t.textContent='Make your link';c.appendChild(t);
  var i=document.createElement('input');i.id='cbmename';i.placeholder='Type a short name, like karen';i.setAttribute('aria-label','Your short name');i.autocapitalize='none';i.style.cssText='font-size:1.3rem;padding:.5em;width:90%;border-radius:10px;border:0;text-align:center';c.appendChild(i);
  c.appendChild(btn('Make my link',function(){var v=clean(i.value);if(!v){i.focus();return}W.cbAllowLeave=1;location.href=base()+'?me='+v},'blue'));return}
 var t2=document.createElement('p');t2.style.cssText='margin:.1em;opacity:.85';t2.textContent='Your link. Send it to the other phone and they connect by opening it.';c.appendChild(t2);
 var u=document.createElement('p');u.id='cblinktext';u.style.cssText='font-weight:800;font-size:1.25rem;color:#ffd84d;word-break:break-all;margin:.3em 0';u.textContent=l;c.appendChild(u);
 c.appendChild(btn('Copy',function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(function(){b.textContent='Copied'},function(){prompt('Copy your link',l)})}));
 c.appendChild(btn('Share',function(){if(navigator.share)navigator.share({title:'Call me on Coffeebreak',text:'Open this to connect to me on Coffeebreak',url:l}).catch(function(){});else prompt('Copy your link',l)},'blue'));
 var w=document.createElement('p');w.id='cbnamewarn';w.style.cssText='display:none;background:#5a1d1d;padding:.5em;border-radius:10px;margin:.4em 0';c.appendChild(w)}
// name already used by a different phone: suggest the next free one
var tk=0;setInterval(function(){var m=g('meName');if(!m||embed)return;var bad=false;try{bad=W.eval("typeof role!=='undefined'&&role==='dev'&&!get('lk')")}catch(e){}tk=bad?tk+1:0;var w=document.getElementById('cbnamewarn');if(!w)return;
 if(tk>=4){var m2=m.replace(/\d+$/,'')+(((+(m.match(/\d+$/)||[1])[0])||1)+1);w.style.display='block';w.textContent='The name '+m+' is being used on another phone. ';var a=document.createElement('a');a.href=base()+'?me='+m2;a.textContent='Use '+m2+' instead';a.style.color='#ffd84d';a.onclick=function(){W.cbAllowLeave=1};w.appendChild(a)}else w.style.display='none'},4000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',card);else card();
})();
