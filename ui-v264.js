(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
async function req(url,opt={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opt}),t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{}if(!r.ok)throw Error(j.error||`请求失败 ${r.status}`);return j}
function esc(v){const e=document.createElement('i');e.textContent=v==null?'':String(v);return e.innerHTML}
function modal(title,body){const d=$('#manageDialog'),f=$('#manageForm');f.innerHTML=`<div class="modal"><header><h2>${esc(title)}</h2><button type="button" class="close" data-v264-close>×</button></header><div class="manage-body">${body}</div></div>`;d.showModal()}
async function showStats(){
 const [s,d,r]=await Promise.all([req('/api/stats'),req('/api/ledger'),req('/api/exchange-rates').catch(()=>({rates:{CNY:1}}))]);
 const today=new Date().toISOString().slice(0,10),after=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
 const pending=(d.events||[]).filter(x=>!x.archived&&x.status!=='done');
 const subscriptions=pending.filter(x=>x.type==='subscription'&&x.amount!=null);
 const sum=end=>subscriptions.filter(x=>x.date>=today&&x.date<=end).reduce((a,x)=>{const c=x.currency||'CNY',rate=c==='CNY'?1:Number(r.rates?.[c]||0);return a+Number(x.amount||0)*rate},0);
 const typeMap=new Map((d.settings?.types||[]).map(x=>[x.id,x.name]));
 const counts={};for(const x of pending)counts[x.type]=(counts[x.type]||0)+1;
 const typeRows=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<div><b>${n}</b><span>${esc(typeMap.get(id)||id)}</span></div>`).join('');
 modal('统计',`<div class="v25-stats"><div><b>${s.today||0}</b><span>今天</span></div><div><b>${s.next7||0}</b><span>未来 7 天</span></div><div><b>${s.next30||0}</b><span>未来 30 天</span></div><div><b>${s.overdue||0}</b><span>已逾期</span></div><div><b>${s.done||0}</b><span>已完成</span></div><div><b>${s.total||0}</b><span>全部事项</span></div><div><b>${(d.series||[]).filter(x=>x.active!==false).length}</b><span>进行中循环</span></div><div><b>${(d.series||[]).filter(x=>x.active===false).length}</b><span>已暂停循环</span></div><div><b>¥${sum(after(30)).toFixed(2)}</b><span>30 天订阅</span></div><div><b>¥${sum(after(90)).toFixed(2)}</b><span>季度订阅</span></div><div><b>¥${sum(after(365)).toFixed(2)}</b><span>年度订阅</span></div><div><b>${subscriptions.length}</b><span>待续费订阅</span></div></div>${typeRows?`<h3 style="margin:18px 0 8px">按类型</h3><div class="v25-stats">${typeRows}</div>`:''}`)
}
function cleanTop(){const top=$('.top');if(!top)return;const old=top.querySelector('[data-action="export"]');if(old)old.remove();if(!top.querySelector('[data-v264="stats"]')){const b=document.createElement('button');b.type='button';b.className='ghost compact';b.textContent='统计';b.dataset.v264='stats';const manage=top.querySelector('[data-action="manage"]');top.insertBefore(b,manage||top.querySelector('[data-action="new"]'))}}
function cleanMenu(){const form=$('#manageForm');if(!form)return;const removeSelectors=['[data-v25="stats"]','[data-v25="series"]','[data-v25="backup"]','[data-v26="subscriptions"]','[data-v26="series"]','[data-x26="backups"]'];for(const s of removeSelectors)$$(`${s}`,form).forEach(x=>x.remove());$$('button',form).forEach(b=>{const t=b.textContent.trim();if(['数据概览','循环规则','查看备份','订阅统计','循环高级管理','历史备份'].includes(t))b.remove()})}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.v264==='stats'){e.preventDefault();e.stopImmediatePropagation();showStats().catch(err=>alert(err.message));return}if(b.hasAttribute('data-v264-close')){$('#manageDialog').close();return}},true);
let n=0;(function tick(){cleanTop();cleanMenu();if(++n<240)setTimeout(tick,250)})();
})();