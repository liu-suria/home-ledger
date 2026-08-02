(function(){
'use strict';
/*
 * Legacy v2.5 enhancement layer retired in v2.7.3.
 * Statistics now open on demand from the header button, and settings are
 * provided by ui-v270.js. Keeping only the tiny theme bootstrap avoids an
 * extra stats request and a permanent 600ms DOM polling loop on every page.
 */
try{
  const value=localStorage.getItem('family-hub-theme')||'system';
  if(value==='dark'||value==='light'){
    document.documentElement.dataset.theme=value;
    document.documentElement.style.colorScheme=value;
  }else{
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme='';
  }
}catch{}
})();
