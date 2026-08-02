(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let maintaining=false,refreshTimer;
async function maintain(force=false){if(maintaining)return;maintaining=true;try{const r=await nativeFetch(force?'/api/series/maintain':'/api/cron/series-maintenance',{method:'POST',credentials:'same-origin',cache:'no-store'}),j=await r.json().catch(()=>({}));if(force&&r.ok&&(Number(j.generated)||Number(j.removed)))location.reload()}catch{}finally{maintaining=false}}
window.fetch=async function(input,init={}){const url=typeof input==='string'?input:input?.url||'',method=String(init.method||'GET').toUpperCase(),response=await nativeFetch(input,init);if(response.ok&&url.includes('/api/ledger')&&method==='PUT')setTimeout(()=>maintain(true),0);return response};
async function hidePastDone(){try{const r=await nativeFetch('/api/ledger',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json(),t=today(),hidden=new Set((d.events||[]).filter(x=>x.status==='done'&&x.date<t).map(x=>x.id));document.querySelectorAll('.event').forEach(card=>{if(hidden.has(card.dataset.id))card.remove()});document.querySelectorAll('.group').forEach(g=>{if(!g.querySelector('.event'))g.remove()})}catch{}}
function scheduleHide(){clearTimeout(refreshTimer);refreshTimer=setTimeout(hidePastDone,50)}
const app=document.querySelector('#app');if(app&&'MutationObserver'in window)new MutationObserver(scheduleHide).observe(app,{childList:true,subtree:true});
maintain(false);scheduleHide();
})();
