import { json, requireAccess } from "../../_lib.js";
import { load } from "../../_domain.js";
export async function onRequestGet(context){const a=await requireAccess(context);if(a.response)return a.response;const d=await load();return json({types:d.settings.types})}
