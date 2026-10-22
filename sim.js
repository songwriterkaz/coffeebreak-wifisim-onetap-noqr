const me=myNum();put('setup',1);$('#me').textContent=me;$('#me').setAttribute('aria-label','Your call ID is '+me.split('').join(' '));
const PH=pairURL();
try{new QRCode($('#qr'),{text:PH,width:280,height:280,colorDark:'#000000',colorLight:'#ffffff'})}catch(e){}
let said=false;onState=s=>{paintState(s);if(s.online&&!said){said=true;buzz([80,60,80])}};
onCall=c=>{try{c.close()}catch(e){}};
state();
$('#share').onclick=async()=>{buzz();try{if(navigator.share){await navigator.share({title:'Coffeebreak call ID',text:'Call me over WiFi on Coffeebreak: '+me,url:PH});return}}catch(e){if(e.name==='AbortError')return}
 try{await navigator.clipboard.writeText(PH);$('#share').textContent='Link copied';say('Link copied')}catch(e){prompt('Copy your link',PH)}};
$('#phonepanel').src=PHONE_URL+'?embed=1';
