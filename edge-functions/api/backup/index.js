import { json, readJson, requireAccess } from "../../_lib.js";
import { listBackups, readBackup, restoreBackup } from "../../_storage.js";
export async function onRequestGet(context){const a=await requireAccess(context);if(a.response)return a.response;const u=new URL(context.request.url),slot=u.searchParams.get("slot");return json(slot===null?await listBackups():await readBackup(Number(slot)))}
export async function onRequestPost(context){const a=await requireAccess(context);if(a.response)return a.response;let slot=null;try{slot=(await readJson(context.request)).slot??null}catch{}return json(await restoreBackup(slot))}
