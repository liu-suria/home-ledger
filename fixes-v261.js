(()=>{'use strict';
function fix(){
  document.querySelectorAll('#manageForm button').forEach(b=>{
    const text=(b.textContent||'').trim();
    const nativeSave=/^(保存类型|保存|确认保存)$/.test(text)&&
      !b.hasAttribute('data-tpl-save')&&
      !b.hasAttribute('data-v26-save-series')&&
      !b.hasAttribute('data-v26-save-asset')&&
      !b.hasAttribute('data-import-save');
    b.type=nativeSave?'submit':'button';
  });
  const api=document.querySelector('#manageForm [data-v25="api"]');
  if(api){api.type='button';api.textContent='API 接口文档';api.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();location.href='/api.html'}}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#manageForm [data-v25="api"]');
  if(b){e.preventDefault();e.stopImmediatePropagation();location.href='/api.html'}
},true);
let n=0;(function tick(){fix();if(++n<160)setTimeout(tick,250)})();
})();