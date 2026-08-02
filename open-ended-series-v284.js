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
    if(url.includes('/api/ledger')&&String(init.method||'GET').toUpperCase()==='PUT'&&pendingEndMode&&Date.now()-pendingEndMode.at<10000&&typeof init.body==='string'){
      const data=JSON.parse(init.body),series=Array.isArray(data.series)?data.series:[];
      const newest=series.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
      if(newest){
        newest.endMode=pendingEndMode.explicit?'fixed':'open';
        if(!pendingEndMode.explicit)newest.endDate='';
        init={...init,body:JSON.stringify(data)};
      }
      pendingEndMode=null;
    }
  }catch{}
  return nativeFetch(input,init);
};
})();