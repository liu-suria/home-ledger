import { json, readJson, requireAccess } from "../../_lib.js";
import { builtInTemplates, load, persist, sanitiseEvent, uid } from "../../_domain.js";

const text=(v,n)=>String(v??"").trim().slice(0,n);
function cleanItem(item,typeIds){
 const type=typeIds.has(String(item?.type))?String(item.type):[...typeIds][0];
 const amount=item?.amount===""||item?.amount==null?null:Math.round(Number(item.amount)*100)/100;
 if(amount!==null&&(!Number.isFinite(amount)||amount<0))throw Error("模板金额不正确");
 return{title:text(item?.title,100),type,offsetDays:Math.max(0,Math.min(36500,Number(item?.offsetDays)||0)),amount,currency:text(item?.currency||"CNY",8).toUpperCase()||"CNY",payment:text(item?.payment,50),note:text(item?.note,1000)};
}
function cleanTemplate(body,typeIds,id){
 const name=text(body?.name,40),items=Array.isArray(body?.items)?body.items.slice(0,100).map(x=>cleanItem(x,typeIds)).filter(x=>x.title):[];
 if(!name)throw Error("模板名称不能为空");
 if(!items.length)throw Error("模板至少需要一个事项");
 return{id:id||uid("tpl"),name,items,updatedAt:new Date().toISOString()};
}
export async function onRequestGet(context){
 const a=await requireAccess(context);if(a.response)return a.response;
 const d=await load();return json({templates:[...builtInTemplates.map(x=>({...x,builtIn:true})),...(d.templates||[]).map(x=>({...x,builtIn:false}))]});
}
export async function onRequestPost(context){
 const a=await requireAccess(context);if(a.response)return a.response;
 try{
  const d=await load(),body=await readJson(context.request),action=String(body.action||"apply"),typeIds=new Set(d.settings.types.map(x=>x.id));
  if(action==="save"){
   const requested=text(body.id,100),index=(d.templates||[]).findIndex(x=>x.id===requested),template=cleanTemplate(body,typeIds,index>=0?requested:uid("tpl"));
   if(index>=0)d.templates[index]=template;else d.templates.push(template);
   return json({template,data:await persist(d,index>=0?"template.update":"template.create",null,template.name)},index>=0?200:201);
  }
  const tpl=[...builtInTemplates,...(d.templates||[])].find(x=>x.id===body.id);if(!tpl)return json({error:"模板不存在"},404);
  const baseText=body.startDate||new Date().toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(baseText))throw Error("起始日期不正确");
  const base=new Date(baseText+"T12:00:00"),created=[];
  for(const item of tpl.items||[]){const date=new Date(base);date.setDate(date.getDate()+Number(item.offsetDays||0));const event=sanitiseEvent({...item,id:uid(),date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`,type:typeIds.has(item.type)?item.type:[...typeIds][0]},typeIds);d.events.push(event);created.push(event)}
  return json({created,data:await persist(d,"template.apply",null,`应用模板 ${tpl.name}`)},201);
 }catch(e){return json({error:e.message||"模板操作失败"},400)}
}
export async function onRequestDelete(context){
 const a=await requireAccess(context);if(a.response)return a.response;
 try{const d=await load(),id=new URL(context.request.url).searchParams.get("id"),i=(d.templates||[]).findIndex(x=>x.id===id);if(i<0)return json({error:"个人模板不存在或内置模板不可删除"},404);const[t]=d.templates.splice(i,1);return json({ok:true,data:await persist(d,"template.delete",null,t.name)})}catch(e){return json({error:e.message||"删除失败"},400)}
}
