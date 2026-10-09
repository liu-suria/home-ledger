(()=>{
const origin='https://nav.667989.xyz';
if(new URLSearchParams(location.search).get('embed')!=='nav')return;
document.documentElement.dataset.embed='nav';
let positioned=false;
const startAtEvents=()=>{
 if(positioned||document.documentElement.dataset.mobile!=='false')return;
 const controls=document.querySelector('.controls'),header=document.querySelector('.top');
 if(!controls||!header||document.querySelector('#app')?.hidden)return;
 requestAnimationFrame(()=>{if(positioned)return;const bottom=controls.getBoundingClientRect().bottom+scrollY;const height=header.getBoundingClientRect().height;scrollTo({top:Math.max(0,bottom-height),behavior:'instant'});positioned=true});
};
document.addEventListener('familyhub:render',startAtEvents);
window.addEventListener('message',event=>{
 if(event.origin!==origin||event.source!==parent||event.data?.type!=='navdesk:theme')return;
 document.documentElement.dataset.mobile=String(event.data.mobile===true);
 startAtEvents();
 const theme=event.data.theme;if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;
});
parent.postMessage({type:'homeledger:ready'},origin);
})();
