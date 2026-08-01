import { json, requireAccess } from "../../_lib.js";
import { load } from "../../_domain.js";
export async function onRequestGet(context){const a=await requireAccess(context);if(a.response)return a.response;const d=await load(),today=new Date().toISOString().slice(0,10),events=d.events.filter(x=>!x.archived&&x.date===today);return json({date:today,events,count:events.length})}
