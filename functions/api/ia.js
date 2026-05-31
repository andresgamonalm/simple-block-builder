// Motor de IA: compone una pieza (lista de bloques) a partir de un brief simple.
// La IA NO escribe HTML: elige entre los bloques del editor y rellena sus campos,
// así el resultado siempre renderiza y queda 100% editable.
//
//   POST /api/ia  { brief:{que,objetivo,tono}, formato, marca?, imagenes[], catalogo[] }
//        → { ok, nombre, bloques:[{tipo,datos}] }
//
// Requiere sesión válida. La API key de Gemini vive en env.GEMINI_API_KEY (secreto).

import { json, corsPreflight, getUserEmail } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

// Envoltura: cualquier excepción se convierte en un JSON legible (nunca un 502 mudo).
export async function onRequestPost(ctx) {
  try {
    return await generar(ctx);
  } catch (e) {
    return json({ ok: false, error: 'Error interno del motor IA: ' + (e && e.message ? e.message : String(e)) }, 500);
  }
}

async function generar({ request, env }) {
  const email = await getUserEmail(request, env);
  if (!email) return json({ ok: false, error: 'No autenticado' }, 401);

  if (!env.GEMINI_API_KEY) {
    return json({ ok: false, error: 'Falta GEMINI_API_KEY en el servidor (cárgala como secreto en Cloudflare).' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  const brief = body.brief || {};
  if (!brief.que || !String(brief.que).trim()) {
    return json({ ok: false, error: 'Dime qué necesitas (el brief está vacío).' }, 400);
  }

  const formato = String(body.formato || 'email');
  const marca = body.marca || null;
  const imagenes = Array.isArray(body.imagenes) ? body.imagenes.slice(0, 40) : [];
  const catalogo = Array.isArray(body.catalogo) ? body.catalogo : [];

  const tiposValidos = catalogo.map(c => c.tipo);
  const marcaTxt = marca
    ? `Colores: principal=${marca.primary||'-'}, texto=${marca.text||'-'}, fondo=${marca.bg||'-'}, CTA=${marca.cta||marca.primary||'-'}. Tipografía: ${marca.font||'Inter'}. Logo (URL): ${marca.logoUrl||'(ninguno)'}. Empresa: ${marca.empresa||'-'}.`
    : 'Sin marca específica: usa un estilo limpio y profesional.';
  const imgsTxt = imagenes.length
    ? imagenes.map(im => `- ${im.url}  →  ${im.nombre || '(sin descripción)'}`).join('\n')
    : '(la biblioteca está vacía: deja vacíos los campos de imagen url/imagenUrl, salvo el logo de marca)';

  const instruccion = [
    'Eres un compositor experto de piezas de marketing (emails, banners, posts de redes, invitaciones) para un editor de bloques.',
    'Tu tarea: a partir del brief, componer UNA pieza ordenada y lista para usar, eligiendo bloques del catálogo y rellenando sus campos con contenido real en español.',
    '',
    'Devuelve EXCLUSIVAMENTE un JSON válido con esta forma exacta:',
    '{ "nombre": "nombre corto de la pieza", "bloques": [ { "tipo": "<tipo del catálogo>", "datos": { ...campos } } ] }',
    '',
    'Reglas estrictas:',
    `- Usa SOLO estos tipos: ${tiposValidos.join(', ')}.`,
    '- Para cada bloque, rellena solo los campos que aparecen en el catálogo de ese tipo (no inventes campos nuevos).',
    '- Escribe textos concretos y persuasivos acordes al objetivo; nada de "lorem ipsum" ni placeholders.',
    '- El botón/CTA debe reflejar el objetivo del brief.',
    '- Para campos de imagen (url, imagenUrl): usa SOLO una URL EXACTA de la biblioteca provista, eligiendo por su descripción. Si ninguna encaja, deja "".',
    '- Para el logo (logoUrl en header) usa la URL del logo de la marca si existe.',
    '- Ordena como una pieza real: encabezado/hero arriba, contenido en medio, CTA cerca del final, footer si aplica al formato.',
    '- Ajusta la cantidad de bloques al formato: un banner pequeño lleva pocos bloques; un email puede llevar varios.',
    '',
    `Formato de salida de la pieza: ${formato}.`,
    `Marca: ${marcaTxt}`,
    '',
    'CATÁLOGO DE BLOQUES (tipo → campos con un valor de ejemplo):',
    JSON.stringify(catalogo),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    '',
    'BRIEF:',
    `- Qué necesito: ${brief.que}`,
    `- Objetivo / CTA: ${brief.objetivo || '(no especificado: infiere uno razonable)'}`,
    `- Tono: ${brief.tono || 'profesional y cercano'}`,
  ].join('\n');

  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  // Timeout propio: si Gemini se cuelga, abortamos y devolvemos un error legible
  // (en vez de dejar que Cloudflare corte con un 502 mudo).
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 22000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruccion }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 2048 }
      })
    });
  } catch (e) {
    const abortado = e && (e.name === 'AbortError');
    return json({ ok: false, error: abortado
      ? `Gemini (${model}) tardó demasiado y se canceló. Suele ser el modelo: prueba GEMINI_MODEL=gemini-1.5-flash o gemini-2.5-flash.`
      : 'No se pudo contactar a Gemini: ' + (e.message || e) }, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return json({ ok: false, error: `Gemini (${model}) respondió ${res.status}. ${t.slice(0, 400)}` }, 502);
  }

  let data;
  try { data = await res.json(); } catch { return json({ ok: false, error: 'Respuesta de Gemini no es JSON.' }, 502); }

  let texto = '';
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  if (Array.isArray(parts)) texto = parts.map(p => (p && p.text) || '').join('');
  if (!texto) {
    const motivo = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'sin contenido';
    return json({ ok: false, error: 'Gemini no devolvió contenido (' + motivo + ').' }, 502);
  }

  // Parseo defensivo: por si viniera envuelto en ```json ... ```
  let parsed;
  try {
    const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(limpio);
  } catch {
    return json({ ok: false, error: 'No se pudo interpretar la respuesta de la IA como JSON.' }, 502);
  }

  let bloques = Array.isArray(parsed?.bloques) ? parsed.bloques : [];
  // Filtra a tipos válidos y limita el tamaño.
  bloques = bloques
    .filter(b => b && typeof b.tipo === 'string' && tiposValidos.includes(b.tipo))
    .slice(0, 40)
    .map(b => ({ tipo: b.tipo, datos: (b.datos && typeof b.datos === 'object') ? b.datos : {} }));

  if (!bloques.length) {
    return json({ ok: false, error: 'La IA no produjo bloques válidos. Intenta reformular el brief.' }, 502);
  }

  return json({ ok: true, nombre: String(parsed.nombre || brief.que).slice(0, 120), bloques });
}
