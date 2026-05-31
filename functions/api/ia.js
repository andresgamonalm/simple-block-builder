// Motor de IA: compone una pieza (lista de bloques) a partir de un brief simple.
// La IA NO escribe HTML: elige entre los bloques del editor y rellena sus campos,
// así el resultado siempre renderiza y queda 100% editable.
//
//   POST /api/ia  { brief:{que,objetivo,tono}, formato, marca?, imagenes[], catalogo[] }
//        → { ok, nombre, bloques:[{tipo,datos}] }
//   GET  /api/ia            → diagnóstico instantáneo (no llama a Gemini)
//   GET  /api/ia?gemini=1   → diagnóstico + llamada mínima a Gemini
//
// La API key de Gemini vive en env.GEMINI_API_KEY (secreto).

import { json, corsPreflight, getUserEmail } from './_shared.js';

export const onRequestOptions = () => corsPreflight();

// ── Diagnóstico (GET) ────────────────────────────────────────────────────
// Siempre responde JSON 200 (nunca 502), para ver exactamente qué pasa.
export async function onRequestGet({ request, env }) {
  const out = { version: 'diag-4' };
  try {
    const u = new URL(request.url);
    const email = await getUserEmail(request, env);
    out.autenticado = !!email;
    out.tieneKey = !!env.GEMINI_API_KEY;
    out.largoKey = (env.GEMINI_API_KEY || '').length;
    out.modelo = env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (u.searchParams.get('gemini') !== '1') {
      out.nota = 'Función viva y deploy actualizado. Para probar Gemini abre /api/ia?gemini=1';
      return json(out, 200);
    }
    // El ping a Gemini no exige sesión: es solo diagnóstico y no expone la key.
    if (!env.GEMINI_API_KEY) return json({ ...out, error: 'Falta GEMINI_API_KEY.' }, 200);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${out.modelo}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      out.paso = 'llamando-gemini';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responde solo: ok' }] }], generationConfig: { maxOutputTokens: 10 } })
      });
      out.httpStatus = res.status;
      out.respuesta = (await res.text()).slice(0, 600);
      out.paso = 'ok';
    } catch (e) {
      out.paso = 'fallo-fetch';
      out.errorFetch = (e && e.name === 'AbortError') ? 'timeout 8s (Gemini no respondió a tiempo)' : (e && e.message ? e.message : String(e));
    } finally {
      clearTimeout(t);
    }
    return json(out, 200);
  } catch (e) {
    return json({ ...out, paso: 'excepcion', error: (e && e.message ? e.message : String(e)) }, 200);
  }
}

// ── Generación (POST) ────────────────────────────────────────────────────
// Envoltura: cualquier excepción se convierte en JSON legible (nunca un 502 mudo).
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

  // Modo "textos": sugiere copy para una Composición (titular + cuerpo + CTA).
  if (body.modo === "textos") {
    const instr = [
      "Eres redactor publicitario experto. Devuelve EXCLUSIVAMENTE un JSON:",
      '{ "titular": "...", "cuerpo": "...", "cta": "..." }',
      "Reglas: titular ≤ 6 palabras; cuerpo ≤ 14 palabras; cta ≤ 3 palabras. En español, persuasivo y claro.",
      `Tono: ${brief.tono || "profesional y cercano"}.`,
      `Tema/brief: ${brief.que || "(general)"}.`
    ].join("\n");
    const model = env.GEMINI_MODEL || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    let res;
    try {
      res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, signal:ctl.signal,
        body: JSON.stringify({ contents:[{ role:"user", parts:[{ text:instr }] }], generationConfig:{ responseMimeType:"application/json", temperature:0.85, maxOutputTokens:300 } }) });
    } catch(e) { return json({ ok:false, error:(e && e.name==="AbortError") ? `Gemini (${model}) tardó demasiado. Prueba GEMINI_MODEL=gemini-1.5-flash.` : "No se pudo contactar a Gemini: "+(e.message||e) }, 502); }
    finally { clearTimeout(t); }
    if(!res.ok){ const tx = await res.text().catch(()=> ""); return json({ ok:false, error:`Gemini (${model}) respondió ${res.status}. ${tx.slice(0,400)}` }, 502); }
    let data; try { data = await res.json(); } catch { return json({ ok:false, error:"Respuesta de Gemini no es JSON." }, 502); }
    let texto = ""; const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if(Array.isArray(parts)) texto = parts.map(p => (p && p.text) || "").join("");
    let parsed; try { parsed = JSON.parse(texto.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"")); }
    catch { return json({ ok:false, error:"No se pudo interpretar la respuesta de la IA." }, 502); }
    return json({ ok:true, titular:String(parsed.titular||"").slice(0,120), cuerpo:String(parsed.cuerpo||"").slice(0,240), cta:String(parsed.cta||"").slice(0,40) });
  }

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
    : '(la biblioteca está vacía: deja vacíos los campos de imagen, salvo el logo de marca)';

  const instruccion = [
    'Eres un compositor experto de piezas de marketing (emails, banners, posts, invitaciones) para un editor de bloques.',
    'A partir del brief, compón UNA pieza ordenada y lista para usar, eligiendo bloques del catálogo y rellenando sus campos con contenido real en español.',
    '',
    'Devuelve EXCLUSIVAMENTE un JSON válido con esta forma exacta:',
    '{ "nombre": "nombre corto", "bloques": [ { "tipo": "<tipo del catálogo>", "datos": { ...campos } } ] }',
    '',
    'Reglas:',
    `- Usa SOLO estos tipos: ${tiposValidos.join(', ')}.`,
    '- Rellena solo los campos que aparecen en el catálogo de ese tipo (no inventes campos).',
    '- Textos concretos y persuasivos acordes al objetivo; nada de placeholders.',
    '- El CTA debe reflejar el objetivo del brief.',
    '- Para imágenes (url/imagenUrl) usa SOLO una URL EXACTA de la biblioteca; si ninguna encaja, deja "".',
    '- Ordena como una pieza real: encabezado/hero arriba, contenido en medio, CTA al final, footer si aplica.',
    '',
    `Formato: ${formato}. Marca: ${marcaTxt}`,
    '',
    'CATÁLOGO (tipo → campos de ejemplo):',
    JSON.stringify(catalogo),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    '',
    'BRIEF:',
    `- Qué necesito: ${brief.que}`,
    `- Objetivo / CTA: ${brief.objetivo || '(infiere uno razonable)'}`,
    `- Tono: ${brief.tono || 'profesional y cercano'}`,
  ].join('\n');

  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

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
      ? `Gemini (${model}) tardó demasiado y se canceló. Prueba GEMINI_MODEL=gemini-1.5-flash.`
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
    const motivo = (data && data.candidates && data.candidates[0] && data.candidates[0].finishReason) || (data && data.promptFeedback && data.promptFeedback.blockReason) || 'sin contenido';
    return json({ ok: false, error: 'Gemini no devolvió contenido (' + motivo + ').' }, 502);
  }

  let parsed;
  try {
    const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(limpio);
  } catch {
    return json({ ok: false, error: 'No se pudo interpretar la respuesta de la IA como JSON.' }, 502);
  }

  let bloques = Array.isArray(parsed && parsed.bloques) ? parsed.bloques : [];
  bloques = bloques
    .filter(b => b && typeof b.tipo === 'string' && tiposValidos.includes(b.tipo))
    .slice(0, 40)
    .map(b => ({ tipo: b.tipo, datos: (b.datos && typeof b.datos === 'object') ? b.datos : {} }));

  if (!bloques.length) {
    return json({ ok: false, error: 'La IA no produjo bloques válidos. Reformula el brief.' }, 502);
  }

  return json({ ok: true, nombre: String((parsed && parsed.nombre) || brief.que).slice(0, 120), bloques });
}
