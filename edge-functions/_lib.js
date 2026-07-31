const encoder = new TextEncoder();

// Shared by the home page and /admin, so a successful login always unlocks both.
export const COOKIE_NAME = "__Host-homeledger_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}

export function getSecrets(context) {
  const env = context?.env || {};
  const adminPassword = env.ADMIN_PASSWORD || globalThis.ADMIN_PASSWORD;
  const sessionSecret = env.SESSION_SECRET || globalThis.SESSION_SECRET;
  if (!adminPassword || !sessionSecret) throw new Error("ADMIN_PASSWORD and SESSION_SECRET must be configured");
  return { adminPassword: String(adminPassword), sessionSecret: String(sessionSecret) };
}

export function parseCookies(request) {
  return (request.headers.get("Cookie") || "").split(";").reduce((result, item) => {
    const index = item.indexOf("=");
    if (index > 0) result[item.slice(0, index).trim()] = item.slice(index + 1).trim();
    return result;
  }, {});
}

function base64url(bytes) { let binary = ""; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function hmac(value, secret) { const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(value))); }
function safeEqual(a, b) { if (typeof a !== "string" || typeof b !== "string") return false; let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
async function digest(value) { return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }

export async function passwordMatches(value, expected) { return safeEqual(await digest(value), await digest(expected)); }
export async function createSession(secret) { const issuedAt = Math.floor(Date.now() / 1000); const nonce = base64url(crypto.getRandomValues(new Uint8Array(18))); const unsigned = `${issuedAt}.${nonce}`; return `${unsigned}.${await hmac(unsigned, secret)}`; }
export async function isAuthenticated(request, secret) { const token = parseCookies(request)[COOKIE_NAME]; if (!token) return false; const [issued, nonce, signature, ...extra] = token.split("."); const now = Math.floor(Date.now() / 1000); return !extra.length && /^\d{10}$/.test(issued) && /^[A-Za-z0-9_-]{16,}$/.test(nonce) && Number(issued) <= now + 60 && now - Number(issued) <= SESSION_MAX_AGE && safeEqual(signature, await hmac(`${issued}.${nonce}`, secret)); }
export function sessionCookie(value) { return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`; }
export function clearSessionCookie() { return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`; }
export async function requireAuth(context) { try { const { sessionSecret } = getSecrets(context); return await isAuthenticated(context.request, sessionSecret) ? { sessionSecret } : { response: json({ error: "Unauthorized" }, 401) }; } catch { return { response: json({ error: "Server authentication is not configured" }, 503) }; } }
export async function readJson(request) { const text = await request.text(); if (text.length > 250000) throw new Error("Request body is too large"); try { const value = JSON.parse(text || "{}"); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw new Error("Invalid JSON request body"); } }
