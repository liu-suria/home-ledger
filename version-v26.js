(()=>{
  const V='Beta v2.7.3';
  window.__FAMILY_HUB_VERSION__=V;
  try{
    if(!localStorage.getItem('family-hub-v273-ready')){
      ['family-hub-v240','family-hub-v220','family-hub-v221','family-hub-v262-ready','family-hub-v263-ready','family-hub-v264-ready','family-hub-v270-ready','family-hub-v271-ready','family-hub-v272-ready'].forEach(k=>localStorage.removeItem(k));
      localStorage.setItem('family-hub-v273-ready','1');
    }
  }catch{}
  function sync(){
    document.title=`Family Hub · 家庭事务中心 · ${V}`;
    document.querySelectorAll('.brand small,.login-card p').forEach(x=>x.textContent=`家庭事务中心 · ${V}`);
    document.querySelectorAll('.v25-summary').forEach(x=>x.remove());
  }
  function load(src){
    if(document.querySelector(`script[src="${src}"]`))return;
    const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);
  }
  load('/ui-v270.js?v=273');
  const lazy=()=>{
    ['/scopes-v26.js?v=273','/fixes-v261.js?v=273','/templates-v262.js?v=273','/manage-save-v263.js?v=273'].forEach(load);
  };
  if('requestIdleCallback' in window)requestIdleCallback(lazy,{timeout:1200});
  else setTimeout(lazy,500);
  sync();
  document.addEventListener('DOMContentLoaded',sync,{once:true});
  [0,150,500,1200,2500].forEach(ms=>setTimeout(sync,ms));
})();
