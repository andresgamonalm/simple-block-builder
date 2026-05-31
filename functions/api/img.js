// Proxy de imágenes (solo lectura) para poder rasterizar banners a PNG/JPG.
// El canvas se "contamina" (tainted) con imágenes de otro origen y entonces
// toBlob() falla. Sirviendo la imagen desde nuestro propio origen, el dataURL
// queda limpio y la exportación a PNG/JPG funciona.
//
//   GET /api/img?u=<url-encoded https://…>  → los bytes de la imagen, mismo origen.
//
// No requiere sesión (son imágenes públicas que el usuario ya referencia en
// sus piezas). Limita a http(s) y a tipos de imagen.

import { corsPreflight } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

export async function onRequestGet({ request }) {
  const u = new URL(request.url).searchParams.get('u') || '';
  let target;
  try { target = new URL(u); } catch (_) { return new Response('bad url', { status: 400 }); }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return new Response('bad protocol', { status: 400 });
  }
  try {
    const r = await fetch(target.toString(), { headers: { 'User-Agent': 'SimpleBlockBuilder/1.0' } });
    if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    if (!/^image\//i.test(ct)) return new Response('not an image', { status: 415 });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response('fetch error', { status: 502 });
  }
}
