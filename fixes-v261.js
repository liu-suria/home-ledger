(()=>{'use strict';
const ACTION_SELECTOR='[data-v25],[data-v26],[data-x26],[data-tpl-new],[data-tpl-edit],[data-tpl-use],[data-tpl-delete],[data-tpl-add],[data-tpl-close],[data-tpl-save],[data-tpl-apply],[data-v26-close],[data-x26-close],[data-scope-all],[data-manage-close],[data-add],[data-remove]';
function fix(){
  document.querySelectorAll(`#manageForm button${ACTION_SELECTOR.split(',').map(s=>`:is(${s})`).join('')}`).forEach(b=>b.type='button');
  document.querySelectorAll('#manageForm button').forEach(b=>{
    const text=(b.textContent||'').trim();
    const isSave=/^(保存类型|保存|确认保存)$/.test(text)&&!b.hasAttribute('data-tpl-save')&&!b.hasAttribute('data-v26-save-series')&&!b.hasAttribute('data-v26-save-asset');
    if(isSave)b.type='submit';
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