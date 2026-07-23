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

// ── Auth por USUARIO + CONTRASEÑA (archivo usuarios.json del repo) ──────
// Los usuarios viven en usuarios.js (raíz del repo): usuario, rol
// ('admin'|'limitado'), permisos (['*'] o ['email','banner','ads','libre']),
// workspace (clave de su espacio en D1) y la contraseña como "clave" simple
// o como sal+hash (sha256 de "sal:contraseña" — nunca legible). Editar el
// archivo en GitHub = alta/baja/cambio de contraseña (auto-deploy en 1-2 min).
import USUARIOS_FILE from '../../usuarios.js';

export function listaUsuarios() {
  return (USUARIOS_FILE && Array.isArray(USUARIOS_FILE.usuarios)) ? USUARIOS_FILE.usuarios : [];
}
export function buscarUsuario(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  return listaUsuarios().find(u => String(u.usuario || '').toLowerCase() === n) || null;
}
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', ENC.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verificarPassword(u, password) {
  if (!u) return false;
  // Opción simple: "clave" en texto plano en el archivo (elección del admin).
  if (u.clave != null && u.clave !== '') return String(password || '') === String(u.clave);
  // Opción protegida: sal + hash (generador en Configuración).
  if (!u.hash || !u.sal) return false;
  const h = await sha256Hex(u.sal + ':' + String(password || ''));
  return h === u.hash;
}

// Sesión: la cookie guarda { u: usuario }. El resto (rol/permisos/workspace)
// se lee SIEMPRE del archivo → quitar un usuario del archivo lo saca al tiro.
export async function getSesion(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    // DEV_USER_EMAIL es SOLO para desarrollo local (wrangler pages dev):
    // entra como el primer admin del archivo, nunca en producción.
    if (env.DEV_USER_EMAIL) {
      let host = '';
      try { host = new URL(request.url).hostname; } catch {}
      if (host === 'localhost' || host === '127.0.0.1') {
        const adm = listaUsuarios().find(u => u.rol === 'admin');
        if (adm) return sesionDe(adm);
      }
    }
    return null;
  }
  const payload = await verifyJWT(token, env.JWT_SECRET || 'dev-only-secret');
  if (!payload || !payload.u) return null;   // cookies del login viejo (email) quedan inválidas
  const u = buscarUsuario(payload.u);
  if (!u) return null;
  return sesionDe(u);
}
function sesionDe(u) {
  return { usuario: u.usuario, nombre: u.nombre || null, rol: (u.rol === 'admin') ? 'admin' : 'limitado', permisos: Array.isArray(u.permisos) ? u.permisos : [], ws: u.workspace || u.usuario, limiteIA: (typeof u.limiteIA === 'number') ? u.limiteIA : null };
}
// ── Tope de consultas de IA por usuario (contado en D1, no manipulable desde
//    el cliente). Protege los créditos de Gemini. null = sin tope. ──────────
export async function leerUsoIA(env, usuario) {
  if (!env || !env.DB) return 0;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS ia_uso (usuario TEXT PRIMARY KEY, usados INTEGER DEFAULT 0)').run();
    const r = await env.DB.prepare('SELECT usados FROM ia_uso WHERE usuario=?').bind(usuario).first();
    return (r && r.usados) || 0;
  } catch { return 0; }
}
export async function sumarUsoIA(env, usuario) {
  if (!env || !env.DB) return;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS ia_uso (usuario TEXT PRIMARY KEY, usados INTEGER DEFAULT 0)').run();
    await env.DB.prepare('INSERT INTO ia_uso (usuario, usados) VALUES (?,1) ON CONFLICT(usuario) DO UPDATE SET usados=usados+1').bind(usuario).run();
  } catch {}
}
// Reinicia el contador de un usuario (para cuando el admin quiera darle más).
export async function reiniciarUsoIA(env, usuario) {
  if (!env || !env.DB) return;
  try { await env.DB.prepare('DELETE FROM ia_uso WHERE usuario=?').bind(usuario).run(); } catch {}
}
export function tienePermiso(s, servicio) {
  if (!s) return false;
  if (s.rol === 'admin') return true;
  const p = s.permisos || [];
  return p.includes('*') || p.includes(servicio);
}

// Compat: los endpoints viejos piden "el email del usuario"; ahora devuelve la
// CLAVE DE WORKSPACE de la sesión (para andres sigue siendo su email histórico,
// así no se migra ninguna fila de D1).
export async function getUserEmail(request, env) {
  const s = await getSesion(request, env);
  return s ? s.ws : null;
}

export function getAllowedEmails() {
  return listaUsuarios().map(u => u.usuario);
}

export function isSuperAdmin(_email, _env) {
  return false;   // compat: el rol ahora viene de la sesión (getSesion().rol === 'admin')
}

export function nowIso() {
  return new Date().toISOString();
}
