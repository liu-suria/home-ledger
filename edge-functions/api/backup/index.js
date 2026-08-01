import { json, requireAccess } from "../../_lib.js";
import { readBackup, restoreBackup } from "../../_storage.js";
export async function onRequestGet(context){const a=await requireAccess(context);if(a.response)return a.response;return json(await readBackup())}
export async function onRequestPost(context){const a=await requireAccess(context);if(a.response)return a.response;return json(await restoreBackup())}
