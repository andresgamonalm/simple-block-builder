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
    out.modelo = env.GEMINI_MODEL || 'gemini-2.5-flash';

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
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responde solo: ok' }] }], generationConfig: { maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } } })
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
    const mk = body.marca || null;
    const refsTxt = await leerReferencias(brief.refs);
    const instr = [
      "Eres redactor publicitario experto. Devuelve EXCLUSIVAMENTE un JSON:",
      '{ "titular": "...", "cuerpo": "...", "cta": "..." }',
      "Reglas: titular ≤ 6 palabras; cuerpo ≤ 14 palabras; cta ≤ 3 palabras. En español, persuasivo y claro.",
      "Escribe EN LA VOZ DE LA MARCA (tono, vocabulario y público); respeta las palabras a usar/evitar para que la pieza sea aprobada.",
      voorMarca(mk),
      refsTxt ? "CONTEXTO de los links de referencia (úsalo para el tono, los datos y el estilo de la marca; no copies literal):\n" + refsTxt : "",
      `Tono: ${brief.tono || (mk && mk.tono) || "profesional y cercano"}.`,
      `Tema/brief: ${brief.que || "(general)"}.`
    ].filter(Boolean).join("\n");
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
    let res;
    try {
      res = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, signal:ctl.signal,
        body: JSON.stringify({ contents:[{ role:"user", parts:[{ text:instr }] }], generationConfig:{ responseMimeType:"application/json", temperature:0.85, maxOutputTokens:1024, thinkingConfig:{ thinkingBudget:0 } } }) });
    } catch(e) { return json({ ok:false, error:(e && e.name==="AbortError") ? `Gemini (${model}) tardó demasiado. Prueba GEMINI_MODEL=gemini-2.5-flash (o gemini-flash-latest).` : "No se pudo contactar a Gemini: "+(e.message||e) }, 500); }
    finally { clearTimeout(t); }
    if(!res.ok){ const tx = await res.text().catch(()=> ""); return json({ ok:false, error:`Gemini (${model}) respondió ${res.status}. ${tx.slice(0,400)}` }, 500); }
    let data; try { data = await res.json(); } catch { return json({ ok:false, error:"Respuesta de Gemini no es JSON." }, 500); }
    let texto = ""; const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if(Array.isArray(parts)) texto = parts.map(p => (p && p.text) || "").join("");
    const parsed = extraerJSON(texto);
    if(!parsed) return json({ ok:false, error:"No se pudo interpretar la respuesta de la IA. Inicio: "+String(texto).slice(0,160) }, 500);
    return json({ ok:true, titular:String(parsed.titular||"").slice(0,120), cuerpo:String(parsed.cuerpo||"").slice(0,240), cta:String(parsed.cta||"").slice(0,40) });
  }

  if (!brief.que || !String(brief.que).trim()) {
    return json({ ok: false, error: 'Dime qué necesitas (el brief está vacío).' }, 400);
  }

  const producto = (body.producto === 'banner') ? 'banner' : 'email';
  const marca = body.marca || null;
  const imagenes = Array.isArray(body.imagenes) ? body.imagenes.slice(0, 40) : [];
  const refsTxt = await leerReferencias(brief.refs);

  if (producto === 'banner') return generarBanner({ env, brief, marca, imagenes, refsTxt });
  return generarEmail({ env, brief, marca, imagenes, refsTxt, catalogo: Array.isArray(body.catalogo) ? body.catalogo : [] });
}

// ── Voz de marca: el bloque de contexto que comparten ambos productos ──────
function voorMarca(marca) {
  if (!marca) return 'Sin marca específica: usa un estilo limpio, profesional y neutral.';
  return [
    `Marca: ${marca.nombre || marca.empresa || '-'}${marca.empresa && marca.nombre !== marca.empresa ? ' (' + marca.empresa + ')' : ''}.`,
    marca.negocio ? `A qué se dedica: ${marca.negocio}.` : '',
    marca.productos ? `Productos/líneas: ${marca.productos}.` : '',
    marca.eslogan ? `Eslogan de marca: "${marca.eslogan}".` : '',
    marca.tono ? `TONO DE VOZ (respétalo siempre): ${marca.tono}.` : '',
    marca.publico ? `Público objetivo: ${marca.publico}.` : '',
    marca.usar ? `Palabras/conceptos a USAR cuando encajen: ${marca.usar}.` : '',
    marca.evitar ? `Palabras PROHIBIDAS (NUNCA las uses): ${marca.evitar}.` : '',
    `Paleta: principal=${marca.primary || '-'}, secundario=${marca.secondary || '-'}, CTA=${marca.cta || marca.primary || '-'}, texto-CTA=${marca.ctaText || '#fff'}, acentos=${marca.accent1 || '-'}/${marca.accent2 || '-'}, texto=${marca.text || '-'}, fondo=${marca.bg || '-'}.`,
    `Tipografías: títulos=${marca.fontTitulo || 'Inter'}, cuerpo=${marca.fontCuerpo || 'Inter'}.`
  ].filter(Boolean).join('\n');
}

// ── Reglas duras del brief (comunes) ──────────────────────────────────────
function reglasBrief(brief) {
  const out = [
    `OBJETIVO / lo que necesito: ${brief.que}`,
    `ACCIÓN (texto base del CTA): ${brief.accion || '(infiere una acción razonable, ej. "Saber más")'}`,
  ];
  if (brief.gancho) out.push(`GANCHO/OFERTA EXACTO (úsalo TAL CUAL, NO inventes otros números/fechas/precios): ${brief.gancho}`);
  else out.push('Sin oferta numérica: NO inventes precios, porcentajes ni fechas.');
  return out.join('\n');
}

// ── Lee 1-3 URLs de referencia y devuelve un extracto de texto ────────────
const UA_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};
// Extrae título + meta description + Open Graph + texto visible (sirve aun en webs JS).
function extraerTextoPagina(html, max) {
  const pick = (re) => { const m = html.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const titulo = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogt    = pick(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const desc   = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
              || pick(/<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const cuerpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const meta = [titulo && 'Título: ' + titulo, (ogt && ogt !== titulo) && 'OG: ' + ogt, desc && 'Descripción: ' + desc].filter(Boolean).join(' · ');
  return ((meta ? meta + '\n' : '') + cuerpo.slice(0, max || 1200)).trim().slice(0, (max || 1200) + 300);
}
// Lee 1-3 URLs de referencia y RASTREA hasta 2 páginas internas de cada una
// (mismo dominio), con tope de páginas y presupuesto de tiempo.
// Lee SOLO las URLs exactas que el usuario pasa (hasta 3). No rastrea páginas
// internas (eso era lento); si quieres una interior, pégala como otra URL.
async function leerReferencias(refs) {
  const urls = Array.isArray(refs) ? refs.filter(u => /^https?:\/\//i.test(u)).slice(0, 3) : [];
  if (!urls.length) return '';
  const deadline = Date.now() + 9000;
  const trozos = [];
  for (const u of urls) {
    if (Date.now() > deadline) break;
    const norm = u.split('#')[0];
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.max(2500, Math.min(8000, deadline - Date.now())));
      const r = await fetch(norm, { redirect: 'follow', signal: ctl.signal, headers: UA_NAVEGADOR });
      clearTimeout(t);
      if (!r.ok) { trozos.push(`(${norm}: HTTP ${r.status})`); continue; }
      const html = await r.text();
      trozos.push(`• ${norm}\n${extraerTextoPagina(html, 1400)}`);
    } catch (e) { trozos.push(`(${norm}: no se pudo leer)`); }
  }
  return trozos.join('\n\n').slice(0, 4000);
}

// ── Llamada a Gemini con parseo robusto de JSON ───────────────────────────
// Extrae JSON de la respuesta de Gemini de forma tolerante: quita ```fences```,
// y si hay texto alrededor, busca el primer objeto/array balanceado y lo parsea.
function extraerJSON(texto) {
  let t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(t); } catch {}
  const iObj = t.indexOf('{'), iArr = t.indexOf('[');
  let start = (iObj < 0) ? iArr : (iArr < 0 ? iObj : Math.min(iObj, iArr));
  if (start < 0) return undefined;
  const open = t[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, escaped = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch { return undefined; } } }
  }
  return undefined;
}
async function llamarGemini(env, promptOrParts, maxTokens) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 40000);
  // Acepta un prompt de texto o un array de "parts" (texto + imágenes inlineData).
  const partesEntrada = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ contents: [{ role: 'user', parts: partesEntrada }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: maxTokens || 4096, thinkingConfig: { thinkingBudget: 0 } } })
    });
  } catch (e) {
    return { error: (e && e.name === 'AbortError') ? `Gemini (${model}) tardó demasiado. Prueba GEMINI_MODEL=gemini-flash-latest.` : 'No se pudo contactar a Gemini: ' + (e.message || e) };
  } finally { clearTimeout(timer); }
  if (!res.ok) { const t = await res.text().catch(() => ''); return { error: `Gemini (${model}) respondió ${res.status}. ${t.slice(0, 400)}` }; }
  let data; try { data = await res.json(); } catch { return { error: 'Respuesta de Gemini no es JSON.' }; }
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  let texto = Array.isArray(parts) ? parts.map(p => (p && p.text) || '').join('') : '';
  if (!texto) {
    const motivo = (data && data.candidates && data.candidates[0] && data.candidates[0].finishReason) || (data && data.promptFeedback && data.promptFeedback.blockReason) || 'sin contenido';
    return { error: 'Gemini no devolvió contenido (' + motivo + ').' };
  }
  const parsed = extraerJSON(texto);
  if (parsed === undefined) return { error: 'No se pudo interpretar la respuesta de la IA como JSON. Inicio: ' + String(texto).slice(0, 160) };
  return { parsed };
}

// ════════════ PRODUCTO 1: BANNERS DE GOOGLE DISPLAY (3 zonas) ════════════
async function generarBanner({ env, brief, marca, imagenes, refsTxt }) {
  const imgsTxt = imagenes.length
    ? imagenes.map(im => `- ${im.url}  →  ${im.nombre || '(sin descripción)'}`).join('\n')
    : '(biblioteca vacía: deja "imagen" en "")';
  const prompt = [
    `Eres director creativo de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Creas banners de Google Display que rinden y suenan 100% a la marca.`,
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
    '{ "nombre": "nombre corto de la campaña", "zonas": { "titular": "...", "cuerpo": "...", "cta": "..." }, "imagen": "<URL exacta de la biblioteca o \\"\\"> " }',
    '',
    'REGLAS DURAS:',
    '- Español de Chile, claro y persuasivo. Nada de placeholders ni texto de relleno.',
    '- LÍMITES: titular ≤ 6 palabras; cuerpo ≤ 14 palabras; cta ≤ 3 palabras.',
    '- El "cta" debe reflejar la ACCIÓN del brief.',
    '- "imagen": elige la URL EXACTA de la biblioteca cuya descripción mejor calce con el brief; si ninguna calza, deja "".',
    '- NUNCA uses un logo ni un ícono como "imagen" (esos van en su propia zona, no como foto del banner).',
    '- Respeta el tono y las palabras de la marca; NO inventes ofertas/precios/fechas.',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    refsTxt ? '\nREFERENCIAS DE LA MARCA (extractos de links; úsalos para tono y datos, no copies literal):\n' + refsTxt : '',
    '',
    'BRIEF:',
    reglasBrief(brief)
  ].filter(Boolean).join('\n');

  // Multimodal "light": si llegan miniaturas, la IA VE las imágenes (máx 10, una sola
  // llamada) para elegir la mejor por contenido, no solo por nombre.
  const conThumb = (imagenes || []).filter(im => im && im.thumb).slice(0, 3);
  let entrada = prompt;
  if (conThumb.length) {
    const partes = [{ text: prompt }, { text: '\nIMÁGENES CANDIDATAS (míralas y elige en "imagen" la URL EXACTA de la que mejor calce visual y temáticamente; si ninguna sirve, ""):' }];
    for (const im of conThumb) {
      partes.push({ text: `URL: ${im.url} — ${im.nombre || '(sin nombre)'}` });
      partes.push({ inlineData: { mimeType: im.thumbMime || 'image/jpeg', data: im.thumb } });
    }
    entrada = partes;
  }

  const { parsed, error } = await llamarGemini(env, entrada, 1200);
  if (error) return json({ ok: false, error }, 500);
  const z = (parsed && parsed.zonas) || {};
  const limpia = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, n).join(' ');
  const out = {
    ok: true,
    nombre: String((parsed && parsed.nombre) || brief.que).slice(0, 80),
    zonas: { titular: limpia(z.titular, 8), cuerpo: limpia(z.cuerpo, 18), cta: limpia(z.cta, 4) },
    imagen: (typeof parsed.imagen === 'string' && /^https?:\/\//.test(parsed.imagen)) ? parsed.imagen : ''
  };
  if (!out.zonas.titular && !out.zonas.cuerpo) return json({ ok: false, error: 'La IA no produjo textos. Reformula el brief.' }, 500);
  return json(out);
}

// ════════════════════ PRODUCTO 2: EMAIL MARKETING (bloques) ═══════════════
async function generarEmail({ env, brief, marca, imagenes, refsTxt, catalogo }) {
  const tiposValidos = catalogo.map(c => c.tipo);
  const imgsTxt = imagenes.length
    ? imagenes.map(im => `- ${im.url}  →  ${im.nombre || '(sin descripción)'}`).join('\n')
    : '(biblioteca vacía: deja vacíos los campos de imagen, salvo el logo de marca)';
  const disc = marca && marca.disclaimer ? `\n- Incluye un bloque "footer" con la empresa y este disclaimer legal: "${marca.disclaimer}".` : '';
  const logo = marca && marca.logoUrl ? `\n- Si usas "header", pon su logoUrl = "${marca.logoUrl}".` : '';
  const prompt = [
    `Eres director creativo de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Escribes emails de marketing que suenan 100% a la marca y convierten.`,
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
    '{ "nombre": "asunto/nombre corto", "bloques": [ { "tipo": "<tipo del catálogo>", "datos": { ...campos } } ] }',
    '',
    'REGLAS DURAS:',
    `- Usa SOLO estos tipos: ${tiposValidos.join(', ')}.`,
    '- Rellena solo los campos que aparecen en el catálogo de ese tipo (no inventes campos).',
    '- Español de Chile, concreto y persuasivo; nada de placeholders.',
    '- Estructura real de email: header (logo) arriba → contenido → un CTA claro con la ACCIÓN del brief → footer.',
    '- Para imágenes usa SOLO una URL EXACTA de la biblioteca; si ninguna encaja, deja "".',
    '- Respeta el tono y las palabras de la marca; NO inventes ofertas/precios/fechas.' + logo + disc,
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    '',
    'CATÁLOGO (tipo → campos de ejemplo):',
    JSON.stringify(catalogo),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    refsTxt ? '\nREFERENCIAS DE LA MARCA (extractos de links; úsalos para tono y datos, no copies literal):\n' + refsTxt : '',
    '',
    'BRIEF:',
    reglasBrief(brief)
  ].filter(Boolean).join('\n');

  const { parsed, error } = await llamarGemini(env, prompt, 8192);
  if (error) return json({ ok: false, error }, 500);
  let bloques = Array.isArray(parsed && parsed.bloques) ? parsed.bloques : [];
  bloques = bloques
    .filter(b => b && typeof b.tipo === 'string' && tiposValidos.includes(b.tipo))
    .slice(0, 40)
    .map(b => ({ tipo: b.tipo, datos: (b.datos && typeof b.datos === 'object') ? b.datos : {} }));
  if (!bloques.length) return json({ ok: false, error: 'La IA no produjo bloques válidos. Reformula el brief.' }, 500);
  return json({ ok: true, nombre: String((parsed && parsed.nombre) || brief.que).slice(0, 120), bloques });
}
