import { json, readJson, requireAuth } from "../../_lib.js";
import { readData, saveData } from "../../_storage.js";

const text=(v,n)=>String(v??"").trim().slice(0,n);
const date=v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(String(v))?String(v||""):null;
const id=v=>/^[a-zA-Z0-9_-]{3,100}$/.test(String(v))?String(v):null;
const REPEATS=["none","daily","weekly","monthly","quarterly","yearly","interval"];
const DEFAULT_TYPES=[
 {id:"reminder",name:"其他事项"},{id:"baby",name:"宝宝事项"},{id:"subscription",name:"订阅续费"},
 {id:"maintenance",name:"家庭维护"},{id:"document",name:"证件到期"},{id:"warranty",name:"保修到期"},{id:"vehicle",name:"车辆事项"}
];

function sanitiseTypes(value){
 const source=Array.isArray(value)?value:DEFAULT_TYPES,result=[],seen=new Set();
 for(const item of source.slice(0,30)){const typeId=id(item?.id),name=text(item?.name,20);if(!typeId||!name||seen.has(typeId))continue;seen.add(typeId);result.push({id:typeId,name});}
 return result.length?result:DEFAULT_TYPES;
}
function amount(value){if(value===null||value===""||value===undefined)return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e8)throw Error("金额不正确");return Math.round(n*100)/100;}
function common(item,typeIds){
 const eventId=id(item.id),title=text(item.title,100),eventDate=date(item.date);
 if(!eventId||!title||eventDate===null)throw Error("事项标题、日期或标识不正确");
 const calendar=item.calendar==="lunar"?"lunar":"solar";
 return {id:eventId,title,type:typeIds.has(String(item.type))?String(item.type):[...typeIds][0],date:eventDate,calendar,
  lunarMonth:calendar==="lunar"?Math.max(1,Math.min(12,Number(item.lunarMonth)||1)):null,
  lunarDay:calendar==="lunar"?Math.max(1,Math.min(30,Number(item.lunarDay)||1)):null,
  amount:amount(item.amount),currency:text(item.currency||"CNY",8).toUpperCase()||"CNY",payment:text(item.payment,50),note:text(item.note,1000),
  archived:!!item.archived,createdAt:text(item.createdAt,40),updatedAt:text(item.updatedAt,40)};
}
function sanitiseEvent(item,typeIds){
 if(!item||typeof item!=="object"||Array.isArray(item))throw Error("事项格式不正确");
 return {...common(item,typeIds),seriesId:id(item.seriesId)||null,occurrenceDate:date(item.occurrenceDate)||date(item.date)||"",status:item.status==="done"?"done":"pending"};
}
function sanitiseSeries(item,typeIds){
 if(!item||typeof item!=="object"||Array.isArray(item))throw Error("循环规则格式不正确");
 const base=common({...item,date:item.startDate},typeIds),repeat=REPEATS.includes(item.repeat)?item.repeat:"none";
 const startDate=date(item.startDate),endDate=date(item.endDate);
 if(!startDate||endDate===null)throw Error("循环起止日期不正确");
 return {...base,id:id(item.id),startDate,endDate,repeat,intervalDays:Math.max(1,Math.min(3650,Number(item.intervalDays)||1)),active:item.active!==false};
}
function sanitise(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||!Array.isArray(data.events)||data.events.length>1000||!Array.isArray(data.series||[])||(data.series||[]).length>200)throw Error("数据格式不正确");
 const types=sanitiseTypes(data.settings?.types),typeIds=new Set(types.map(x=>x.id));
 return {version:7,updatedAt:new Date().toISOString(),settings:{siteName:text(data.settings?.siteName||"Family Hub",30)||"Family Hub",types},series:(data.series||[]).map(x=>sanitiseSeries(x,typeIds)),events:data.events.map(x=>sanitiseEvent(x,typeIds))};
}
export async function onRequestGet(context){const auth=await requireAuth(context);if(auth.response)return auth.response;try{return json(await readData())}catch{return json({error:"无法读取数据"},503)}}
export async function onRequestPut(context){const auth=await requireAuth(context);if(auth.response)return auth.response;try{const data=sanitise(await readJson(context.request));await saveData(data);return json(data)}catch(error){return json({error:error.message||"保存失败"},400)}}
