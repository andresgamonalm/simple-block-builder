// Subida de imágenes a R2 (almacenamiento de Cloudflare).
//
//   POST /api/upload   (body = archivo binario; header X-Filename con el nombre)
//        → { ok, url, key }   url = absoluta a /api/upload?k=<key> (mismo dominio)
//   GET  /api/upload?k=<key>  → sirve los bytes de la imagen (público, cacheable)
//
// Ventaja: NO requiere hacer el bucket público ni copiar la URL r2.dev. La app
// referencia /api/upload?k=… en su propio dominio. Solo hace falta el binding
// R2 llamado IMAGENES (Pages → Settings → Bindings → R2).

import { json, corsPreflight, getUserEmail } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

const MAX_BYTES = 8 * 1024 * 1024;   // 8 MB por imagen
const EXT = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif', 'image/svg+xml':'svg', 'image/avif':'avif' };

function slug(s){ return String(s||'').toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'img'; }

// ── Subir (POST) ───────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    const email = await getUserEmail(request, env);
    if (!email) return json({ ok:false, error:'No autenticado' }, 401);
    if (!env.IMAGENES) return json({ ok:false, error:'Falta configurar R2: agrega el binding "IMAGENES" en Cloudflare Pages → Settings → Bindings → R2.' }, 500);

    const ct = (request.headers.get('content-type') || '').toLowerCase();
    let bytes, tipo, nombre;

    if (ct.startsWith('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') return json({ ok:false, error:'No llegó el archivo' }, 400);
      tipo = (file.type || '').toLowerCase();
      nombre = file.name || 'imagen';
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      tipo = ct;
      nombre = request.headers.get('x-filename') || 'imagen';
      bytes = new Uint8Array(await request.arrayBuffer());
    }

    if (!EXT[tipo]) return json({ ok:false, error:'Formato no soportado (usa PNG, JPG, WEBP, GIF, SVG o AVIF).' }, 400);
    if (!bytes.length) return json({ ok:false, error:'El archivo está vacío.' }, 400);
    if (bytes.length > MAX_BYTES) return json({ ok:false, error:`La imagen pesa demasiado (máx ${MAX_BYTES/1024/1024} MB).` }, 400);

    const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}-${slug(nombre)}.${EXT[tipo]}`;
    await env.IMAGENES.put(key, bytes, { httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000, immutable' } });

    const origin = new URL(request.url).origin;
    return json({ ok:true, key, url: `${origin}/api/upload?k=${encodeURIComponent(key)}` });
  } catch (e) {
    return json({ ok:false, error:'Error al subir: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
}

// ── Servir (GET) ─────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('k') || '';
  if (!key) return new Response('falta k', { status: 400 });
  if (!env.IMAGENES) return new Response('R2 no configurado', { status: 500 });
  const obj = await env.IMAGENES.get(key);
  if (!obj) return new Response('no encontrada', { status: 404 });
  const h = new Headers();
  h.set('Content-Type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream');
  h.set('Cache-Control', 'public, max-age=31536000, immutable');
  h.set('Access-Control-Allow-Origin', '*');
  return new Response(obj.body, { status: 200, headers: h });
}
