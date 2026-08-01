import { json, readJson, requireAccess } from "../../_lib.js";
import { load, persist, sanitiseData } from "../../_domain.js";
export async function onRequestGet(context){const a=await requireAccess(context);if(a.response)return a.response;try{return json(await load())}catch{return json({error:"无法读取数据"},503)}}
export async function onRequestPut(context){const a=await requireAccess(context);if(a.response)return a.response;try{const data=sanitiseData(await readJson(context.request));return json(await persist(data,"replace",null,"完整账本保存"))}catch(e){return json({error:e.message||"保存失败"},400)}}
