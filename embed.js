(()=>{
const origin='https://nav.667989.xyz';
if(new URLSearchParams(location.search).get('embed')!=='nav')return;
document.documentElement.dataset.embed='nav';
window.addEventListener('message',event=>{
 if(event.origin!==origin||event.source!==parent||event.data?.type!=='navdesk:theme')return;
 document.documentElement.dataset.mobile=String(event.data.mobile===true);
 const theme=event.data.theme;if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;
});
parent.postMessage({type:'homeledger:ready'},origin);
})();
