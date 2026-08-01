import { json, requireAccess } from "../../_lib.js";
import { load, stats } from "../../_domain.js";
export async function onRequestGet(context){const a=await requireAccess(context);if(a.response)return a.response;return json(stats(await load()))}
