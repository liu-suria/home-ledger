(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
let pendingEndMode=null;
document.addEventListener('submit',e=>{
  if(e.target?.id!=='eventForm')return;
  const repeat=e.target.querySelector('[name="repeat"]')?.value;
  if(!repeat||repeat==='none'){pendingEndMode=null;return}
  pendingEndMode={explicit:!!e.target.querySelector('[name="endDate"]')?.value,at:Date.now()};
},true);
window.fetch=async function(input,init={}){
  try{
    const url=typeof input==='string'?input:input?.url||'';
    const method=String(init.method||'GET').toUpperCase();
    if(url.includes('/api/ledger')&&method==='PUT'&&pendingEndMode&&Date.now()-pendingEndMode.at<10000&&typeof init.body==='string'){
      const data=JSON.parse(init.body),series=Array.isArray(data.series)?data.series:[];
      const newest=series.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
      if(newest){
        newest.endMode=pendingEndMode.explicit?'fixed':'open';
        if(!pendingEndMode.explicit)newest.endDate='';
        init={...init,body:JSON.stringify(data)};
      }
      pendingEndMode=null;
    }
    if(url.includes('/api/series')&&method==='POST'&&typeof init.body==='string'){
      const body=JSON.parse(init.body);
      if(body?.action==='update'&&body.patch){
        body.patch.endMode=body.patch.endDate?'fixed':'open';
        if(!body.patch.endDate)body.patch.endDate='';
        init={...init,body:JSON.stringify(body)};
      }
    }
  }catch{}
  return nativeFetch(input,init);
};
})();