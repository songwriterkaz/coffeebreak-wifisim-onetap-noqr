function paintState(s){const e=$('#st');const pz=get('paused',false);e.textContent=pz?'Paused - not taking calls':s.online?'Online':'Reconnecting…';e.className='status '+(pz?'pz':s.online?'on':'off');
 $('#sync').textContent=s.linked?(s.synced?'✓ Synced':'Syncing…')+' · '+(s.role==='hub'?s.linked+1:2)+' devices linked':''}
function sv(id,on){$('#'+id).classList.toggle('hide',!on)}
$('#linkb').onclick=()=>{buzz();sv('linkov',1);say('Open this link on your other device.');const u=linkURL();$('#lqr').innerHTML='';try{new QRCode($('#lqr'),{text:u,width:220,height:220})}catch(e){$('#lqr').textContent=u}};
$('#lback').onclick=()=>sv('linkov',0);
$('#lshare').onclick=async()=>{const u=linkURL();try{if(navigator.share){await navigator.share({title:'Link my Coffeebreak device',url:u});return}}catch(e){if(e.name==='AbortError')return}try{await navigator.clipboard.writeText(u);say('Link copied')}catch(e){prompt('Copy this link',u)}};
$('#testb').onclick=async()=>{buzz();sv('testov',1);$('#testres').textContent='Testing…';say('Testing your connection');const r=await testConnection();const t=testText(r);$('#testres').textContent=t;say(t)};
$('#tback').onclick=()=>sv('testov',0);
// first open: one box, one button. No email, password, phone number or account.
(function(){const w=document.createElement('section');w.id='welcome';w.className='hide';w.setAttribute('aria-label','Welcome');
 w.style.cssText='position:fixed;inset:0;background:#000;z-index:30;display:flex;flex-direction:column;gap:18px;justify-content:center;padding:24px;max-width:640px;margin:0 auto';
 w.innerHTML='<img src="logo.png" alt="Coffeebreak logo" style="width:110px;margin:0 auto;background:#fff;border-radius:18px;padding:6px"><label for="wname" class="num" style="color:#ffd84d;font-size:2.2rem">Your name</label><input id="wname" autocomplete="name" placeholder="For example Karen" style="font-size:2rem;padding:18px;border-radius:18px;border:3px solid #fff"><button id="wgo" class="big green" style="font-size:2.6rem;padding:40px 10px">Start</button><p class="note">No email, password or phone number needed. Your call ID is made for you and saved on this device.</p>';
 document.body.appendChild(w);
 const embed=new URLSearchParams(location.search).get('embed');
 if(!embed&&!(S.profile&&S.profile.name)&&!get('named')){w.classList.remove('hide');setTimeout(()=>{try{$('#wname').focus()}catch(e){}},300)}
 $('#wgo').onclick=()=>{buzz();unlockAudio&&unlockAudio();const n=($('#wname').value||'').trim().slice(0,40)||'Coffeebreak friend';S.profile={name:n,ts:Date.now()};put('sync',S);put('named',1);put('setup',1);onSync();pushSync();w.classList.add('hide');say('Hello '+n+'. You are ready.')};
 $('#wname').addEventListener('keydown',e=>{if(e.key==='Enter')$('#wgo').click()});
})();
function myName(){return(S.profile&&S.profile.name)||'Coffeebreak friend'}
