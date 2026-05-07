// Helpers compartidos para todas las functions.
// Auth: enlace mágico vía email. La sesión se guarda en cookie HttpOnly
// firmada con HMAC-SHA256 (JWT). El secret vive en env.JWT_SECRET.
// La lista de emails permitidos vive en env.ALLOWED_EMAILS (separados por coma).

export const CORS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, ...extraHeaders } });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

const ENC = new TextEncoder();
const DEC = new TextDecoder();

// ── Base64 / Base64URL ──────────────────────────────────────────────────
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function b64UrlEncode(bytesOrStr) {
  const b64 = typeof bytesOrStr === 'string'
    ? btoa(bytesOrStr)
    : bytesToB64(bytesOrStr instanceof Uint8Array ? bytesOrStr : new Uint8Array(bytesOrStr));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return b64ToBytes(s);
}

// ── Tokens ──────────────────────────────────────────────────────────────
export function randomToken(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return b64UrlEncode(arr);
}

export async function sha256B64(str) {
  const buf = await crypto.subtle.digest('SHA-256', ENC.encode(str));
  return bytesToB64(new Uint8Array(buf));
}

// ── JWT (HS256) para cookie de sesión ───────────────────────────────────
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

export async function signJWT(payload, secret, ttlSeconds = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = b64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${header}.${b64UrlEncode(JSON.stringify(body))}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(data));
  return `${data}.${b64UrlEncode(sig)}`;
}

export async function verifyJWT(token, secret) {
  if (!token || token.split('.').length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = token.split('.');
  const data = `${headerB64}.${bodyB64}`;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, b64UrlDecode(sigB64), ENC.encode(data));
  if (!ok) return null;
  let body;
  try { body = JSON.parse(DEC.decode(b64UrlDecode(bodyB64))); }
  catch { return null; }
  if (body.exp && Math.floor(Date.now() / 1000) > body.exp) return null;
  return body;
}

// ── Cookies de sesión ───────────────────────────────────────────────────
const SESSION_COOKIE = 'sbb_session';
const SESSION_DAYS   = 30;

export function readCookie(request, name) {
  const h = request.headers.get('Cookie') || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function buildSessionCookie(jwt) {
  const maxAge = 60 * 60 * 24 * SESSION_DAYS;
  return `${SESSION_COOKIE}=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function buildLogoutCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ── Auth: lista de emails permitidos + lectura de sesión ────────────────
export function getAllowedEmails(env) {
  const raw = env.ALLOWED_EMAILS || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

export function isEmailAllowed(email, env) {
  if (!email) return false;
  return getAllowedEmails(env).includes(email.trim().toLowerCase());
}

export async function getUserEmail(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    if (env.DEV_USER_EMAIL) return env.DEV_USER_EMAIL.toLowerCase();
    return null;
  }
  const payload = await verifyJWT(token, env.JWT_SECRET || 'dev-only-secret');
  if (!payload) return null;
  const email = (payload.email || '').toLowerCase();
  // Si el email se quitó del allowlist después de loguearse, deja de tener acceso.
  if (!isEmailAllowed(email, env)) return null;
  return email || null;
}

export function isSuperAdmin(email, env) {
  const sa = (env.SUPER_ADMIN_EMAIL || 'hola@andresgamonal.com').toLowerCase();
  return email === sa;
}

export function nowIso() {
  return new Date().toISOString();
}
