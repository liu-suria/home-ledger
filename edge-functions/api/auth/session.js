import { getSecrets, isAuthenticated, json } from "../../_lib.js";
export async function onRequestGet(context) { try { const { sessionSecret } = getSecrets(context); return json({ authenticated: await isAuthenticated(context.request, sessionSecret) }); } catch { return json({ authenticated: false, configured: false }, 503); } }
