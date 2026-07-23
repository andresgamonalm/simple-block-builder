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

import { json, corsPreflight, getUserEmail, getSesion, tienePermiso, leerUsoIA, sumarUsoIA } from './_shared.js';

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
  const sesion = await getSesion(request, env);
  if (!sesion) return json({ ok: false, error: 'No autenticado' }, 401);
  if (!env.GEMINI_API_KEY) {
    return json({ ok: false, error: 'Falta GEMINI_API_KEY en el servidor (cárgala como secreto en Cloudflare).' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  // Permisos por servicio (el servidor manda, no solo la UI): cada producto
  // exige su permiso; los modos auxiliares exigen alguno que los use.
  const necesita = body.producto === 'ads' ? 'ads'
                 : body.producto === 'banner' ? 'banner'
                 : (body.modo === 'textos' || body.modo === 'imagen') ? 'banner'
                 : body.modo === 'concepto' ? null   // lo valida el orquestador pieza a pieza
                 : 'email';
  if (necesita && !tienePermiso(sesion, necesita)) {
    return json({ ok: false, error: 'Tu usuario no tiene acceso a este servicio (' + necesita + ').' }, 403);
  }

  // Tope de consultas de IA por usuario (protege los créditos de Gemini).
  // El admin no tiene tope; los demás solo si su ficha define limiteIA.
  if (sesion.rol !== 'admin' && typeof sesion.limiteIA === 'number') {
    const usados = await leerUsoIA(env, sesion.usuario);
    if (usados >= sesion.limiteIA) {
      return json({ ok: false, limiteIA: true, usados, limite: sesion.limiteIA,
        error: `Llegaste al límite de ${sesion.limiteIA} consultas de IA de tu cuenta. Pídele a un administrador que lo amplíe.` }, 429);
    }
    await sumarUsoIA(env, sesion.usuario);   // esta consulta cuenta
  }

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

  // Modo "imagen": genera una FOTOGRAFÍA de fondo con Imagen (misma API key de
  // Google) y la guarda en el bucket R2 de la biblioteca. Devuelve { ok, url, nombre }.
  // Sin texto ni logos dentro de la foto: el texto lo pone el editor por zonas.
  if (body.modo === "imagen") {
    if (!env.IMAGENES) return json({ ok: false, error: "Falta el bucket de imágenes (binding IMAGENES) para guardar la foto." }, 500);
    const mk = body.marca || null;
    const que = String((brief && brief.que) || body.prompt || "").trim();
    if (!que) return json({ ok: false, error: "Dime qué debe mostrar la imagen." }, 400);
    const prompt = [
      "Professional advertising background photograph for a digital display banner.",
      "Subject / context: " + que + ".",
      mk && mk.negocio ? "Brand context: " + mk.negocio + "." : "",
      "Photorealistic, high quality, natural light, commercial style, clean composition with generous empty copy space for overlay text.",
      "STRICTLY NO text, NO letters, NO numbers, NO logos, NO watermarks."
    ].filter(Boolean).join(" ");
    // Modelo con reintento: el override manda; si un modelo no existe (404), prueba el siguiente.
    const modelos = [env.GEMINI_IMAGEN_MODEL, "imagen-4.0-generate-001", "imagen-3.0-generate-002"].filter(Boolean);
    let data = null, ultimoError = "";
    for (const model of modelos) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 55000);
      let res;
      try {
        res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
          body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: String(body.aspecto || "4:3") } }) });
      } catch (e) {
        clearTimeout(t);
        return json({ ok: false, error: (e && e.name === "AbortError") ? "La generación de la imagen tardó demasiado; inténtalo de nuevo." : "No se pudo contactar al generador de imágenes: " + (e.message || e) }, 500);
      }
      clearTimeout(t);
      if (res.status === 404) { ultimoError = `El modelo ${model} no está disponible en esta cuenta.`; continue; }
      if (!res.ok) { const tx = await res.text().catch(() => ""); return json({ ok: false, error: `El generador de imágenes (${model}) respondió ${res.status}. ${tx.slice(0, 300)}` }, 500); }
      try { data = await res.json(); } catch { return json({ ok: false, error: "Respuesta del generador de imágenes no es JSON." }, 500); }
      break;
    }
    if (!data) return json({ ok: false, error: ultimoError || "No hay un modelo de imágenes disponible." }, 500);
    const pred = data.predictions && data.predictions[0];
    const b64 = pred && (pred.bytesBase64Encoded || (pred.image && pred.image.bytesBase64Encoded));
    if (!b64) return json({ ok: false, error: "El generador no devolvió imagen. " + JSON.stringify(data).slice(0, 200) }, 500);
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const slug = que.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "fondo";
    const key = `ia/${Date.now()}-${slug}.png`;
    await env.IMAGENES.put(key, bin, { httpMetadata: { contentType: "image/png" } });
    return json({ ok: true, url: "/api/upload?k=" + encodeURIComponent(key), nombre: "IA · " + slug.replace(/-/g, " ") });
  }

  if (!brief.que || !String(brief.que).trim()) {
    return json({ ok: false, error: 'Dime qué necesitas (el brief está vacío).' }, 400);
  }

  // Modo "concepto": define UNA idea de campaña (nombre, titular maestro, mensajes
  // clave) que después guía la generación de cada pieza (email + banners + search),
  // para que toda la campaña diga lo mismo con el mismo vocabulario (campaña-primero).
  if (body.modo === 'concepto') {
    const mk = body.marca || null;
    const refsTxt2 = await leerReferencias(brief.refs);
    const prompt = [
      `Eres director creativo de ${mk ? (mk.nombre || mk.empresa) : 'la marca'}. Define el CONCEPTO de una campaña multicanal (email + banners display + anuncios de Google Search).`,
      'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
      '{ "nombre": "nombre corto de la campaña (máx 5 palabras)", "idea": "la idea central en 1 frase", "titular": "titular maestro, máx 7 palabras, SIN punto final", "mensajes": [ "3 mensajes clave, máx 10 palabras cada uno" ] }',
      'Reglas: español de Chile; el concepto debe funcionar igual de bien en un email, un banner chico y un anuncio de texto; respeta el gancho EXACTO si existe (no inventes cifras ni fechas).',
      'VOZ DE MARCA:',
      voorMarca(mk),
      refsTxt2 ? 'CONTEXTO de las URLs de referencia (úsalo para el vocabulario y la propuesta de valor):\n' + refsTxt2 : '',
      'BRIEF:',
      reglasBrief(brief)
    ].filter(Boolean).join('\n');
    const { parsed, error } = await llamarGemini(env, prompt, 1024);
    if (error) return json({ ok: false, error }, 500);
    const c = parsed || {};
    return json({
      ok: true,
      nombre: String(c.nombre || brief.que).replace(/\s+/g, ' ').trim().slice(0, 60),
      concepto: {
        idea: String(c.idea || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        titular: String(c.titular || '').replace(/\s*[.。]+\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 80),
        mensajes: (Array.isArray(c.mensajes) ? c.mensajes : []).map(m => String(m).replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean).slice(0, 4)
      }
    });
  }

  const producto = (body.producto === 'banner') ? 'banner' : (body.producto === 'ads') ? 'ads' : 'email';
  const marca = body.marca || null;
  const imagenes = Array.isArray(body.imagenes) ? body.imagenes.slice(0, 40) : [];
  // Lee también el SITIO DE DESTINO del anuncio (ctaUrl), no solo las URLs de referencia.
  const refsTxt = await leerReferencias([brief.ctaUrl].concat(Array.isArray(brief.refs) ? brief.refs : []));

  if (producto === 'ads') return generarAds({ env, brief, marca, refsTxt });
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
    marca.directrices ? `DIRECTRICES DE LA MARCA (obligatorias, extraidas de su manual y sus campañas — respétalas en diseño y copy):\n${marca.directrices}` : '',
    `Paleta: principal=${marca.primary || '-'}, secundario=${marca.secondary || '-'}, CTA=${marca.cta || marca.primary || '-'}, texto-CTA=${marca.ctaText || '#fff'}, acentos=${marca.accent1 || '-'}/${marca.accent2 || '-'}, texto=${marca.text || '-'}, fondo=${marca.bg || '-'}.`,
    `Tipografías: títulos=${marca.fontTitulo || 'Inter'}, cuerpo=${marca.fontCuerpo || 'Inter'}.`
  ].filter(Boolean).join('\n');
}

// ── Reglas duras del brief (comunes) ──────────────────────────────────────
function reglasBrief(brief) {
  const tipo = brief.tipo || 'comercial';
  const newsletter = tipo === 'newsletter';
  const vende = tipo === 'comercial';
  const out = [`OBJETIVO / lo que necesito: ${brief.que}`];
  // Colocación del CTA: SOLO al final, salvo newsletter (que puede llevar uno por sección).
  out.push(newsletter
    ? 'Es un NEWSLETTER: varias secciones de novedades; puedes incluir un CTA por sección.'
    : 'UN SOLO CTA y SIEMPRE al final de la pieza (nunca arriba ni en el medio).');
  out.push(vende
    ? `Texto del CTA basado en "${brief.accion || 'Saber más'}": imperativo + adverbio de tiempo/lugar (ej.: "Cotiza hoy", "Cotizar aquí", "Contrata ahora"). Máx 3 palabras.`
    : `Texto del CTA basado en "${brief.accion || 'Saber más'}": claro y sobrio, sin urgencia (ej.: "Conoce más", "Más información"). Máx 3 palabras.`);
  out.push('Los TITULARES y las frases sobre imágenes NUNCA terminan en punto.');
  out.push('ORTOGRAFÍA: escribe en español correcto y revisado — tildes/acentos donde corresponde, mayúscula inicial, y signos ¿? ¡! de apertura y cierre bien puestos. Revisa el texto antes de responder: CERO faltas de ortografía.');
  if (brief.gancho) {
    out.push(`GANCHO/OFERTA EXACTO (úsalo TAL CUAL, NO inventes otros números/fechas/precios): ${brief.gancho}`);
    out.push(`DESTACA el gancho de forma MUY visible y al PRINCIPIO: ponlo en el TITULAR principal (hero) bien grande, y además resáltalo en un bloque "alert" (o un divisor con color de marca) cerca del inicio. Que sea lo primero que se vea.`);
  } else out.push('Sin oferta numérica: NO inventes precios, porcentajes ni fechas.');
  if (brief.notas && String(brief.notas).trim()) out.push(`INDICACIONES ADICIONALES del usuario (respétalas): ${String(brief.notas).trim()}`);
  return out.join('\n');
}
// Directriz de redacción según el TIPO (comercial = vende; corporativo/informativo/newsletter = más blando).
function enfoqueDe(tipo) {
  if (tipo === 'corporativo') return 'ENFOQUE CORPORATIVO: tono institucional, sobrio y de confianza; comunica respaldo, solidez y profesionalismo. NADA de urgencia ni lenguaje de oferta. Titular sereno; cuerpo claro y elegante; CTA suave.';
  if (tipo === 'informativo') return 'ENFOQUE INFORMATIVO: explica con claridad y calma el producto y sus beneficios; útil y didáctico, sin presión de venta. Titular descriptivo; cuerpo que orienta; CTA suave e invitador.';
  if (tipo === 'newsletter') return 'ENFOQUE NEWSLETTER: varias secciones cortas de novedades/contenido útil, en la voz cercana de la marca; cada sección con su mini-titular; sin sobre-venta.';
  return 'ENFOQUE COMERCIAL (que VENDA): el titular comunica un BENEFICIO claro (persuade, no describe); el cuerpo conecta con el deseo/dolor del público y resalta el gancho; genera urgencia/escasez cuando aplique; lenguaje concreto y enérgico, frases cortas, cero relleno; CTA potente en imperativo + adverbio.';
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
  // Quita ruido (scripts, estilos, navegación, pies, cabeceras, svg) para quedarnos con el contenido.
  const limpio = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
  // Prioriza titulares y párrafos (lo importante de una landing).
  const destacados = (limpio.match(/<(h1|h2|h3|li|p)[^>]*>([\s\S]*?)<\/\1>/gi) || [])
    .map(s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 2).slice(0, 60).join(' · ');
  const cuerpo = limpio.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const meta = [titulo && 'Título: ' + titulo, (ogt && ogt !== titulo) && 'OG: ' + ogt, desc && 'Descripción: ' + desc].filter(Boolean).join(' · ');
  const texto = (destacados || cuerpo);
  return ((meta ? meta + '\n' : '') + texto.slice(0, max || 1200)).trim().slice(0, (max || 1200) + 300);
}
// Lee 1-3 URLs de referencia y RASTREA hasta 2 páginas internas de cada una
// (mismo dominio), con tope de páginas y presupuesto de tiempo.
// Lee SOLO las URLs exactas que el usuario pasa (hasta 3). No rastrea páginas
// internas (eso era lento); si quieres una interior, pégala como otra URL.
async function leerReferencias(refs) {
  // Dedup + hasta 3 URLs (la landing de destino + referencias).
  const vistos = new Set();
  const urls = (Array.isArray(refs) ? refs : []).filter(u => {
    if (!/^https?:\/\//i.test(u || '')) return false;
    const k = u.split('#')[0]; if (vistos.has(k)) return false; vistos.add(k); return true;
  }).slice(0, 3);
  if (!urls.length) return '';
  // En PARALELO (no una por una) → el total ≈ la página más lenta, no la suma.
  const leerUna = async (u) => {
    const norm = u.split('#')[0];
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6500);
      const r = await fetch(norm, { redirect: 'follow', signal: ctl.signal, headers: UA_NAVEGADOR });
      clearTimeout(t);
      if (!r.ok) return `(${norm}: HTTP ${r.status})`;
      const html = await r.text();
      return `• ${norm}\n${extraerTextoPagina(html, 3500)}`;
    } catch (e) { return `(${norm}: no se pudo leer)`; }
  };
  const trozos = await Promise.all(urls.map(leerUna));
  return trozos.join('\n\n').slice(0, 7000);
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
    enfoqueDe(brief.tipo),
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
    '{ "nombre": "nombre corto de la campaña", "zonas": { "etiqueta": "<nombre corto del PRODUCTO en 1-3 palabras (ej. \\"Seguro Auto\\") o \\"\\">", "titular": "...", "cuerpo": "...", "cta": "..." }, "burbuja": "<la OFERTA en 2-4 palabras para el círculo de promo (ej. \\"2 Cuotas Gratis\\", \\"60% dcto.\\") — SOLO si el brief trae gancho/oferta, si no \\"\\">", "imagen": "<URL exacta de la biblioteca o \\"\\"> " }',
    '',
    'REGLAS DURAS:',
    '- Español de Chile, claro y persuasivo. Nada de placeholders ni texto de relleno.',
    '- LÍMITES: titular ≤ 6 palabras; cuerpo ≤ 14 palabras; cta ≤ 3 palabras.',
    '- "burbuja": usa el gancho EXACTO del brief abreviado (empieza con el número si lo hay: "2 Cuotas Gratis"). NUNCA inventes una oferta: sin gancho va "".',
    '- CLAVE: la OFERTA va SOLO en la burbuja. El "titular" NO puede repetir la oferta: si la burbuja dice "2 Cuotas Gratis", el titular debe comunicar la PROPUESTA DE VALOR o el beneficio (ej. "Tu auto siempre protegido", "Maneja tranquilo"), nunca "2 Cuotas Gratis" otra vez.',
    '- "titular" y "cuerpo" no deben decir lo mismo: el titular engancha, el cuerpo suma un beneficio o razón concreta distinta.',
    '- "etiqueta": el nombre del producto, NO la marca (la marca ya está en el logo).',
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
    refsTxt ? '\nCONTENIDO DE LAS URLS DE REFERENCIA — ANALÍZALO y RAZONA: identifica la propuesta de valor, beneficios, público y tono, y úsalos para escribir una pieza coherente y específica (NO copies literal, NO inventes datos que no estén):\n' + refsTxt : '',
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
    zonas: { etiqueta: limpia(z.etiqueta, 3), titular: limpia(z.titular, 8), cuerpo: limpia(z.cuerpo, 18), cta: limpia(z.cta, 4) },
    // La burbuja solo existe si el brief traía gancho (no se inventan ofertas).
    burbuja: brief.gancho ? limpia(parsed.burbuja, 5) : '',
    imagen: (typeof parsed.imagen === 'string' && /^https?:\/\//.test(parsed.imagen)) ? parsed.imagen : ''
  };
  if (!out.zonas.titular && !out.zonas.cuerpo) return json({ ok: false, error: 'La IA no produjo textos. Reformula el brief.' }, 500);
  return json(out);
}

// ════════════════════ PRODUCTO 2: EMAIL MARKETING (plantilla por tipo) ═══════════════
// PLANTILLAS POR TIPO: la IA solo redacta el COPY estructurado (titular, intro,
// oferta, beneficios, cierre, cta, imagen). El ESQUELETO del email (qué bloques y
// en qué orden) lo arma el código según el tipo (comercial/corporativo/informativo/
// newsletter). Así el diseño es consistente, profesional y 100% editable, sin
// depender del criterio de maquetación de la IA (se acabó el look "PowerPoint").
const ICONOS_VALIDOS = ['check','candado','reloj','globo','regalo','corazon','estrella','casa','usuario','trending','tag','carrito','telefono','chat','info','descargar','calendario','equipo','pin','nube'];
const sinPuntoFinal = s => String(s == null ? '' : s).replace(/\s*[.。]+\s*$/, '').replace(/\s+/g, ' ').trim();

async function generarEmail({ env, brief, marca, imagenes, refsTxt }) {
  const tipo = ['comercial', 'corporativo', 'informativo', 'newsletter'].includes(brief.tipo) ? brief.tipo : 'comercial';
  const imgsTxt = imagenes.length
    ? imagenes.map(im => `- ${im.url}  →  ${im.nombre || '(sin descripción)'}`).join('\n')
    : '(biblioteca vacía: deja "imagen" en "")';

  const prompt = [
    `Eres director creativo de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Escribes el COPY de un email que suena 100% a la marca y convierte.`,
    enfoqueDe(tipo),
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra). SOLO redactas el copy: NO maquetes, NO elijas bloques.',
    '{',
    '  "nombre": "asunto / nombre corto del email",',
    '  "titular": "titular principal con gancho, SIN punto final, máx 8 palabras",',
    '  "intro": "1-2 frases que presentan el mensaje (máx 30 palabras)",',
    '  "oferta": "frase corta de la oferta/gancho a destacar (o \\"\\" si no hay oferta)",',
    '  "beneficios": [ { "icono": "<clave de la lista>", "titulo": "máx 4 palabras SIN punto", "texto": "máx 14 palabras" } ],',
    '  "cierre": "frase breve de cierre o refuerzo (o \\"\\")",',
    '  "cta": "texto del botón, imperativo, máx 3 palabras",',
    '  "imagen": "<URL EXACTA de la biblioteca que mejor calce, o \\"\\">"',
    '}',
    '',
    'REGLAS:',
    '- Español de Chile, concreto y persuasivo; nada de placeholders ni texto de relleno.',
    '- Exactamente 3 beneficios. Cada "icono" DISTINTO y relevante, de esta lista EXACTA: ' + ICONOS_VALIDOS.join(', ') + '.',
    '- "imagen": elige la URL EXACTA de la biblioteca cuya descripción mejor calce con el brief; si ninguna calza o está vacía, deja "". NUNCA un logo ni un ícono.',
    '- Titulares y frases sobre imagen NUNCA terminan en punto.',
    '- Respeta el tono y las palabras de la marca; NO inventes ofertas/precios/fechas.',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    refsTxt ? '\nCONTENIDO DE LAS URLS DE REFERENCIA — ANALÍZALO y RAZONA: identifica la propuesta de valor, beneficios, público y tono, y úsalos para escribir copy coherente y específico (NO copies literal, NO inventes datos que no estén):\n' + refsTxt : '',
    '',
    'BRIEF:',
    reglasBrief(brief)
  ].filter(Boolean).join('\n');

  const { parsed, error } = await llamarGemini(env, prompt, 2048);
  if (error) return json({ ok: false, error }, 500);

  // ── Copy normalizado ──────────────────────────────────────────────────
  const c = parsed || {};
  const titular = (sinPuntoFinal(c.titular) || brief.gancho || brief.que || 'Novedad').slice(0, 90);
  const intro   = String(c.intro || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  const oferta  = sinPuntoFinal(c.oferta).slice(0, 90);
  const cierre  = String(c.cierre || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  const cta     = (String(c.cta || brief.accion || 'Saber más').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')) || 'Saber más';
  const imagen  = (typeof c.imagen === 'string' && /^https?:\/\//.test(c.imagen)) ? c.imagen
                : (imagenes[0] && imagenes[0].url) || '';
  // Beneficios con íconos DISTINTOS y válidos.
  let benes = Array.isArray(c.beneficios) ? c.beneficios.slice(0, 4) : [];
  const usados = new Set();
  benes = benes.map((b, i) => {
    let ico = (b && ICONOS_VALIDOS.includes(b.icono)) ? b.icono : '';
    if (!ico || usados.has(ico)) ico = ICONOS_VALIDOS.find(k => !usados.has(k)) || ICONOS_VALIDOS[i % ICONOS_VALIDOS.length];
    usados.add(ico);
    return { ico, t: sinPuntoFinal(b && b.titulo).slice(0, 40), s: String((b && b.texto) || '').replace(/\s+/g, ' ').trim().slice(0, 140) };
  }).filter(b => b.t || b.s);

  // ── Esqueleto por TIPO (el "molde" del email) ─────────────────────────
  const bloques = [];
  const push = (t, datos) => bloques.push({ tipo: t, datos });
  // 1) Imagen principal → HERO (titular ENCIMA de la foto). Sin foto → título de texto.
  if (imagen) push('hero', { imagenUrl: imagen, titulo: titular, sub: '', ctaTexto: '', alturaHero: '340', oscurecer: '45', radioImg: '0' });
  else        push('texto', { titulo: titular, contenido: '', tamano: '26', negrita: true, alinH: 'center' });
  // 2) Oferta destacada — SIEMPRE después de la foto (solo comercial la resalta en banner).
  if (oferta && tipo === 'comercial') push('alert', { tipo: 'info', titulo: oferta, mensaje: '' });
  // 3) Intro
  if (intro) push('texto', { contenido: intro });
  // 4) Beneficios (íconos distintos)
  if (benes.length) push('features', { items: benes });
  // 5) Respiro / cierre según el tono del tipo
  if (tipo === 'comercial') {
    push('espaciador', { altoEsp: '24' });
  } else {
    push('divisor', {});
    if (cierre) push('texto', { contenido: cierre });
    else push('espaciador', { altoEsp: '16' });
  }
  // 6) UN solo CTA, al final (el enlace lo fija el usuario en el cliente).
  push('cta', { texto: cta, url: '' });

  return json({ ok: true, nombre: String(c.nombre || brief.que).slice(0, 120), bloques });
}

// ════════════ PRODUCTO 3: GOOGLE SEARCH ADS (campaña razonada) ════════════
// La IA piensa como un especialista de Search, NO como el "modo fácil" de Google:
//   - Agrupa las keywords por INTENCIÓN de búsqueda (grupos temáticos coherentes).
//   - SOLO concordancia exacta y de frase. NUNCA amplia (queda prohibida).
//   - Entrega negativas (por grupo y de campaña) para no pagar clics basura.
//   - Anuncios RSA con límites REALES de Google: titulares ≤30, descripciones ≤90,
//     rutas ≤15. El servidor VALIDA y recorta: nada sale fuera de límite.
async function generarAds({ env, brief, marca, refsTxt }) {
  const prompt = [
    `Eres un especialista senior en Google Ads (Search) de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Estructuras campañas como un profesional: por INTENCIÓN de búsqueda, con concordancias controladas y negativas. Detestas la concordancia amplia porque quema presupuesto.`,
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
    '{',
    '  "nombre": "nombre corto de la campaña",',
    '  "grupos": [',
    '    {',
    '      "nombre": "nombre del grupo de anuncios",',
    '      "intencion": "qué busca la persona que escribe estas keywords (1 frase)",',
    '      "razonamiento": "por qué agrupaste así y qué esperas de este grupo (1-2 frases)",',
    '      "keywords": [ { "t": "keyword en minúsculas", "tipo": "exacta" | "frase" } ],',
    '      "negativas": [ "términos a excluir en este grupo" ],',
    '      "titulares": [ "≤30 caracteres cada uno" ],',
    '      "descripciones": [ "≤90 caracteres cada una" ],',
    '      "path1": "ruta-1", "path2": "ruta-2"',
    '    }',
    '  ],',
    '  "negativas": [ "negativas de TODA la campaña (gratis, empleo, curso, segunda mano, etc. según el caso)" ]',
    '}',
    '',
    'REGLAS DURAS (violarlas invalida la respuesta):',
    '- "nombre" de la campaña y de cada grupo: LEGIBLES para humanos, con espacios y tildes (ej. "Cotizar seguro auto"), NUNCA-en-formato-slug-con-guiones.',
    '- 2 a 4 grupos de anuncios. Cada grupo = UNA sola intención de búsqueda (no mezcles "cotizar" con "qué es").',
    '- Por grupo: 12 a 20 keywords. "tipo" SOLO puede ser "exacta" o "frase". La concordancia AMPLIA está PROHIBIDA.',
    '- CUBRE las variantes reales de cómo busca la gente dentro de esa MISMA intención: singular/plural, sinónimos, orden distinto, con "online"/"precio"/"chile" cuando aplique. Cantidad con criterio: variantes que alguien escribiría de verdad, no relleno.',
    '- Keywords en minúsculas, sin corchetes ni comillas (el tipo va en "tipo"), 2 a 5 palabras, como la gente busca de verdad (media/larga cola). Nada de keywords de 1 palabra genérica.',
    '- RAZONA las negativas: qué búsquedas parecidas NO queremos pagar (informativas si el grupo es transaccional, "gratis", "empleo", competidores si aplica...). Mínimo 5 negativas de campaña.',
    '- Por grupo: 8 a 12 titulares ÚNICOS de MÁXIMO 30 CARACTERES (cuenta espacios) y 4 descripciones ÚNICAS de MÁXIMO 90 CARACTERES. Incluye la keyword principal en 2-3 titulares, beneficios en otros y llamada a la acción en otros. SIN punto final en titulares. Sin signos de exclamación dobles.',
    '- El anuncio le habla AL CLIENTE, jamás habla del anuncio o de la campaña ("esta campaña fue creada para...", "si buscas X, este anuncio..." = PROHIBIDO). No repitas la misma keyword más de 2 veces entre titular y descripción.',
    '- Cada descripción dice UNA cosa CONCRETA (una cobertura, un precio, un plazo, un beneficio real). Nada de relleno tipo "rápido, fácil y online" como frase completa, ni listas de productos sin relación con el grupo.',
    '- "path1"/"path2": máximo 15 caracteres, minúsculas, sin espacios (usa guiones), relacionados con el grupo.',
    '- Español de Chile. Respeta el tono y las palabras de la marca; NO inventes ofertas, precios ni fechas.',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    refsTxt ? '\nCONTENIDO DE LAS URLS DE REFERENCIA — ANALÍZALO y RAZONA: identifica la propuesta de valor, los productos y el vocabulario real del sitio, y úsalo para que las keywords y anuncios calcen con lo que la landing de verdad ofrece (NO copies literal, NO inventes datos):\n' + refsTxt : '',
    '',
    'BRIEF:',
    reglasBrief(brief),
    brief.ctaUrl ? `URL FINAL de los anuncios (landing): ${brief.ctaUrl}` : ''
  ].filter(Boolean).join('\n');

  const { parsed, error } = await llamarGemini(env, prompt, 8192);
  if (error) return json({ ok: false, error }, 500);

  // ── Validación dura del lado del servidor ──────────────────────────────
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  // Si la IA devolvió un nombre-en-slug (sin espacios, con guiones), se hace legible.
  const legible = s => { s = clean(s); return (!/\s/.test(s) && /-/.test(s)) ? s.replace(/-+/g, ' ') : s; };
  const dedup = arr => { const seen = new Set(); return arr.filter(x => { const k = x.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
  const kwLimpia = s => clean(s).toLowerCase().replace(/^[\[\"'+]+|[\]\"']+$/g, '').trim();
  const path = s => clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 15);

  const gruposIn = Array.isArray(parsed && parsed.grupos) ? parsed.grupos.slice(0, 5) : [];
  const grupos = gruposIn.map(g => {
    const kws = (Array.isArray(g.keywords) ? g.keywords : []).map(k => ({
      t: kwLimpia(k && k.t),
      tipo: (k && k.tipo === 'frase') ? 'frase' : 'exacta'   // amplia jamás: cualquier otra cosa cae a exacta
    })).filter(k => k.t);
    const seenK = new Set();
    const keywords = kws.filter(k => { const key = k.t; if (seenK.has(key)) return false; seenK.add(key); return true; }).slice(0, 25);
    const titulares = dedup((Array.isArray(g.titulares) ? g.titulares : []).map(t => sinPuntoFinal(clean(t)).slice(0, 30)).filter(Boolean)).slice(0, 15);
    const descripciones = dedup((Array.isArray(g.descripciones) ? g.descripciones : []).map(d => clean(d).slice(0, 90)).filter(Boolean)).slice(0, 4);
    return {
      nombre: legible(g.nombre).slice(0, 60) || 'Grupo',
      intencion: clean(g.intencion).slice(0, 200),
      razonamiento: clean(g.razonamiento).slice(0, 300),
      keywords, titulares, descripciones,
      negativas: dedup((Array.isArray(g.negativas) ? g.negativas : []).map(kwLimpia).filter(Boolean)).slice(0, 15),
      path1: path(g.path1), path2: path(g.path2)
    };
  }).filter(g => g.keywords.length && g.titulares.length);

  if (!grupos.length) return json({ ok: false, error: 'La IA no produjo grupos de anuncios válidos. Reformula el brief (di qué vendes y a quién).' }, 500);

  return json({
    ok: true,
    nombre: legible(parsed.nombre || brief.que).slice(0, 80),
    urlFinal: clean(brief.ctaUrl || ''),
    grupos,
    negativas: dedup((Array.isArray(parsed.negativas) ? parsed.negativas : []).map(kwLimpia).filter(Boolean)).slice(0, 25)
  });
}
