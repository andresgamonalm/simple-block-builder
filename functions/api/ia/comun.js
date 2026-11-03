/* ══════════════════════════════════════════════════════════════════
   IA · COMÚN  ·  functions/api/ia/comun.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Lo que comparten todas las funciones: voz de marca, encargo del usuario, frase legal, reglas de redacción, lectura de URLs, llamada a Gemini (con cadenas de modelos) y corrección ortográfica.
   No es una ruta: lo importa functions/api/ia.js (el único punto de entrada /api/ia).
   Vive en functions/ (no en funciones/) para que el servidor NO lo publique como archivo.
   ══════════════════════════════════════════════════════════════════ */

// ── Voz de marca: el bloque de contexto que comparten ambos productos ──────
export function voorMarca(marca) {
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

// ── LO QUE PIDIÓ EL USUARIO ───────────────────────────────────────────────
// Va SIEMPRE al principio del prompt, antes de cualquier contexto. Antes iba al
// final, después de ~9.000 caracteres de texto raspado de la landing: pesaba el
// 0,6% del prompt y en la práctica se ignoraba. Lo que la persona escribe es la
// instrucción de mayor rango, no una nota al pie.
export function encargoDelUsuario(brief) {
  const out = ['════ EL ENCARGO (lo que te pidió la persona — MANDA sobre todo lo demás) ════',
               `QUÉ NECESITA: ${brief.que}`];
  if (brief.accion) out.push(`ACCIÓN que debe provocar: ${brief.accion}`);
  if (brief.gancho) out.push(`GANCHO / OFERTA, textual: "${brief.gancho}" — úsalo TAL CUAL. No inventes otras cifras, fechas ni precios.`);
  const n = brief.notas && String(brief.notas).trim();
  if (n) out.push(
    `INDICACIONES EXPRESAS (son ÓRDENES, no sugerencias — si alguna choca con una regla de estilo de más abajo, GANA la indicación):\n  » ${n}`);
  out.push('═════════════════════════════════════════════════════════════════════════════');
  return out.join('\n');
}

// ── Reglas de redacción, por PRODUCTO ─────────────────────────────────────
// Antes había un solo bloque común para email, banner y Search. Eso metía
// reglas de email ("un solo CTA al final", bloques "hero"/"alert") dentro de los
// prompts de banner y de Google Search, donde esos conceptos no existen — y
// además se contradecía con la regla de la burbuja: le ordenaba poner el gancho
// en el titular Y le prohibía poner el gancho en el titular, en el mismo prompt.
// La frase legal la pide SIEMPRE el formulario. "no" (o "n/a", "ninguna") es una
// respuesta válida y significa que esta campaña no lleva legal — no es un campo
// vacío por descuido, es una decisión registrada.
export function legalDelBrief(brief) {
  const t = String((brief && brief.legal) || '').trim();
  if (!t) return { texto: '', declarado: false };
  if (/^(no|n\/a|na|ninguna|ninguno|sin legal)\.?$/i.test(t)) return { texto: '', declarado: true };
  return { texto: t, declarado: true };
}
export function reglasBrief(brief, promos, producto) {
  const tipo = brief.tipo || 'comercial';
  const out = [];
  if (producto === 'email') {
    out.push(tipo === 'newsletter'
      ? 'Es un NEWSLETTER: varias secciones de novedades; puedes incluir un CTA por sección.'
      : 'UN SOLO CTA y SIEMPRE al final de la pieza (nunca arriba ni en el medio).');
    out.push(tipo === 'comercial'
      ? `Texto del CTA basado en "${brief.accion || 'Saber más'}": imperativo + adverbio de tiempo/lugar (ej.: "Cotiza hoy", "Contrata ahora"). Máx 3 palabras.`
      : `Texto del CTA basado en "${brief.accion || 'Saber más'}": claro y sobrio, sin urgencia (ej.: "Conoce más"). Máx 3 palabras.`);
    if (brief.gancho) out.push(`El gancho va DESTACADO y arriba: en el titular principal y repetido como oferta después de la foto.`);
  }
  out.push('Los TITULARES nunca terminan en punto.');
  out.push('ORTOGRAFÍA: español de Chile correcto — tildes donde corresponde, mayúscula inicial, signos ¿? ¡! de apertura y cierre. CERO faltas.');
  if (!brief.gancho) {
    if (promos && promos.length) out.push(`El encargo no trae gancho, pero la LANDING muestra estas promociones VIGENTES: ${promos.join(' · ')}. Puedes usarlas TAL CUAL (sin cambiar cifras ni condiciones). NO inventes ninguna otra.`);
    else out.push('Sin oferta numérica: NO inventes precios, porcentajes ni fechas.');
  }
  return out.join('\n');
}
// Directriz de redacción según el TIPO (comercial = vende; corporativo/informativo/newsletter = más blando).
export function enfoqueDe(tipo) {
  if (tipo === 'corporativo') return 'ENFOQUE CORPORATIVO: tono institucional, sobrio y de confianza; comunica respaldo, solidez y profesionalismo. NADA de urgencia ni lenguaje de oferta. Titular sereno; cuerpo claro y elegante; CTA suave.';
  if (tipo === 'informativo') return 'ENFOQUE INFORMATIVO: explica con claridad y calma el producto y sus beneficios; útil y didáctico, sin presión de venta. Titular descriptivo; cuerpo que orienta; CTA suave e invitador.';
  if (tipo === 'newsletter') return 'ENFOQUE NEWSLETTER: varias secciones cortas de novedades/contenido útil, en la voz cercana de la marca; cada sección con su mini-titular; sin sobre-venta.';
  return [
    'ENFOQUE COMERCIAL (que VENDA): esto es PUBLICIDAD, no comunicación corporativa.',
    '- El titular vende un BENEFICIO concreto para el lector (persuade, no describe el producto ni habla de la empresa).',
    '- Háblale al lector de TÚ y de lo que ÉL gana. La primera frase es sobre el lector, nunca sobre la marca.',
    '- PROHIBIDO el tono de comunicado: "Nos complace anunciar", "En [marca] estamos comprometidos", "Queremos informarte", "Le informamos", "Nos es grato", "Estimado cliente". Si una frase podría abrir una memoria anual, reescríbela.',
    '- Genera urgencia o escasez SOLO si el gancho la trae de verdad; lenguaje concreto y enérgico, frases cortas, cero relleno.',
    '- CTA potente en imperativo + adverbio.'
  ].join('\n');
}

// ── Lee 1-3 URLs de referencia y devuelve un extracto de texto ────────────
export const UA_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};
// Extrae título + meta description + Open Graph + JSON-LD + texto visible
// (sirve aun en webs JS: muchas llevan sus datos de producto/oferta en ld+json).
export function extraerTextoPagina(html, max) {
  const pick = (re) => { const m = html.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
  const titulo = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogt    = pick(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const desc   = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
              || pick(/<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  // Datos estructurados (nombre/descripcion/ofertas): oro en landings renderizadas por JS.
  let ld = '';
  const ldBloques = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const bl of ldBloques.slice(0, 4)) {
    try {
      const j = JSON.parse(bl.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, ''));
      const nodos = Array.isArray(j) ? j : (j['@graph'] || [j]);
      for (const n of nodos) {
        if (!n || typeof n !== 'object') continue;
        const partes = [n.name, n.headline, n.description, n.offers && (n.offers.price ? 'precio ' + n.offers.price + ' ' + (n.offers.priceCurrency || '') : ''), n.slogan].filter(Boolean);
        if (partes.length) ld += partes.join(' · ') + ' · ';
      }
    } catch {}
  }
  // Quita ruido (scripts, estilos, navegación, pies, cabeceras, svg) para quedarnos con el contenido.
  const limpio = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
  // Prioriza titulares, párrafos y BOTONES/CTAs (lo importante de una landing).
  const destacados = (limpio.match(/<(h1|h2|h3|h4|li|p|button|strong)[^>]*>([\s\S]*?)<\/\1>/gi) || [])
    .map(s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 2).slice(0, 80).join(' · ');
  const cuerpo = limpio.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const meta = [titulo && 'Título: ' + titulo, (ogt && ogt !== titulo) && 'OG: ' + ogt, desc && 'Descripción: ' + desc, ld && 'Datos: ' + ld.slice(0, 700)].filter(Boolean).join(' · ');
  const texto = (destacados || cuerpo);
  return ((meta ? meta + '\n' : '') + texto.slice(0, max || 1200)).trim().slice(0, (max || 1200) + 1000);
}

// Enlaces internos de la landing (texto + ruta): candidatos REALES a sitelinks.
export function extraerEnlaces(html, urlBase) {
  let host = ''; try { host = new URL(urlBase).host; } catch {}
  const out = []; const vistos = new Set();
  const re = /<a[^>]+href=["']([^"'#?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const href = m[1].trim();
    const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!texto || texto.length < 3 || texto.length > 35) continue;
    if (/^(javascript:|mailto:|tel:)/i.test(href)) continue;
    let esInterno = href.startsWith('/');
    let ruta = href;
    if (/^https?:\/\//i.test(href)) { try { const u = new URL(href); esInterno = u.host === host; ruta = u.pathname; } catch { continue; } }
    if (!esInterno || ruta === '/' || ruta === '') continue;
    const k = (texto + '|' + ruta).toLowerCase();
    if (vistos.has(k)) continue; vistos.add(k);
    out.push({ texto: texto.slice(0, 30), ruta: ruta.slice(0, 80) });
  }
  return out;
}

// Promociones REALES visibles en el texto (cuotas, %, gratis, 2x1, sorteos).
// Se ofrecen a la IA para usarlas TAL CUAL — lo contrario de inventar ofertas.
export function detectarPromos(texto) {
  const t = ' ' + String(texto || '') + ' ';
  const out = [];
  const push = (s) => { s = String(s).replace(/\s+/g, ' ').trim(); if (s && !out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s.slice(0, 60)); };
  const patrones = [
    /\b\d{1,2}\s*cuotas?\s+(?:gratis|sin\s+inter[eé]s)\b/gi,
    /\b(?:hasta\s+)?\d{1,3}\s*%\s*(?:de\s+)?(?:dcto|desc(?:uento)?|off)\b\.?/gi,
    /\b(?:2x1|3x2)\b/gi,
    /\b\d{1,2}\s+mes(?:es)?\s+gratis\b/gi,
    /\benv[ií]o\s+gratis\b/gi,
    /\bsorteo\s+(?:de\s+)?[a-z0-9áéíóúñ ]{3,30}/gi
  ];
  for (const re of patrones) { let m; while ((m = re.exec(t))) push(m[0]); }
  return out.slice(0, 4);
}
// Lee 1-3 URLs de referencia y RASTREA hasta 2 páginas internas de cada una
// (mismo dominio), con tope de páginas y presupuesto de tiempo.
// Lee SOLO las URLs exactas que el usuario pasa (hasta 3). No rastrea páginas
// internas (eso era lento); si quieres una interior, pégala como otra URL.
// Devuelve { texto, promos, enlaces }: el extracto para el prompt, las
// promociones REALES detectadas y los enlaces internos (candidatos a sitelinks).
export async function leerReferencias(refs, opts) {
  const porPagina = (opts && opts.porPagina) || 1800, total = (opts && opts.total) || 2500;
  // Dedup + hasta 3 URLs (la landing de destino + referencias).
  const vistos = new Set();
  const urls = (Array.isArray(refs) ? refs : []).filter(u => {
    if (!/^https?:\/\//i.test(u || '')) return false;
    const k = u.split('#')[0]; if (vistos.has(k)) return false; vistos.add(k); return true;
  }).slice(0, 3);
  if (!urls.length) return { texto: '', promos: [], enlaces: [] };
  // En PARALELO (no una por una) → el total ≈ la página más lenta, no la suma.
  const leerUna = async (u, esPrimera) => {
    const norm = u.split('#')[0];
    const bajar = async (headers) => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6500);
      try {
        const r = await fetch(norm, { redirect: 'follow', signal: ctl.signal, headers });
        clearTimeout(t);
        return r.ok ? await r.text() : null;
      } catch { clearTimeout(t); return null; }
    };
    let html = await bajar(UA_NAVEGADOR);
    let extracto = html ? extraerTextoPagina(html, porPagina) : '';
    // Landing renderizada por JS (casi sin texto) → reintenta como Googlebot:
    // muchos sitios sirven una versión pre-renderizada a los bots.
    if (!extracto || extracto.length < 250) {
      const html2 = await bajar({ ...UA_NAVEGADOR, 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
      if (html2) {
        const ex2 = extraerTextoPagina(html2, porPagina);
        if (ex2.length > extracto.length) { html = html2; extracto = ex2; }
      }
    }
    if (!extracto) return { trozo: `(${norm}: no se pudo leer)`, promos: [], enlaces: [], noLeida: norm };
    return {
      trozo: `• ${norm}\n${extracto}`,
      promos: detectarPromos(extracto),
      enlaces: esPrimera && html ? extraerEnlaces(html, norm) : [],  // sitelinks: solo de la landing principal
      leida: norm
    };
  };
  const partes = await Promise.all(urls.map((u, i) => leerUna(u, i === 0)));
  return {
    texto: partes.map(p => p.trozo).join('\n\n').slice(0, total),   // era 9000: ahogaba el encargo del usuario
    promos: partes.flatMap(p => p.promos).slice(0, 4),
    enlaces: partes.flatMap(p => p.enlaces).slice(0, 12),
    // Si una URL no se pudo leer HAY QUE DECIRLO: nunca generar en silencio como
    // si se hubiera leído. Un anuncio escrito sin leer la landing sale genérico.
    noLeidas: partes.filter(p => p.noLeida).map(p => p.noLeida),
    leidas: partes.filter(p => p.leida).map(p => p.leida)
  };
}
// Avisos que viajan al cliente con la generación: lo que el usuario tiene que
// saber para no confiar a ciegas en la pieza.
export function avisosDeReferencias(refs, brief) {
  const av = [];
  (refs.noLeidas || []).forEach(u => av.push({
    tipo: 'url-no-leida',
    texto: `No se pudo leer ${u}. El copy se escribió sin el contenido de esa página, así que revisa nombres de producto y condiciones.`
  }));
  // Discrepancia entre el GANCHO del encargo y lo que anuncia la landing. No se
  // elige en silencio: manda el encargo y se muestran las dos versiones. Publicar
  // una cifra equivocada en seguros no es una errata, es un problema legal.
  const cifraEncargo = (String(brief.gancho || '').match(/\d+(?:[.,]\d+)?\s*%?/) || [])[0];
  if (cifraEncargo && (refs.promos || []).length) {
    const choca = (refs.promos || []).filter(p => {
      const c = (String(p).match(/\d+(?:[.,]\d+)?\s*%?/) || [])[0];
      return c && c.replace(/\s/g, '') !== cifraEncargo.replace(/\s/g, '');
    });
    if (choca.length) av.push({
      tipo: 'discrepancia',
      texto: `Tu gancho dice "${String(brief.gancho).trim()}" y la página anuncia "${choca[0]}". Se generó con TU dato; revisa cuál corresponde antes de publicar.`
    });
  }
  return av;
}

// ── Llamada a Gemini con parseo robusto de JSON ───────────────────────────
// Extrae JSON de la respuesta de Gemini de forma tolerante: quita ```fences```,
// y si hay texto alrededor, busca el primer objeto/array balanceado y lo parsea.
export function extraerJSON(texto) {
  let t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(t); } catch {}
  // Devuelve el indice donde CIERRA el bloque que abre en `start`, o -1.
  const cierre = (s, start) => {
    const open = s[start], close = open === '{' ? '}' : ']';
    let depth = 0, inStr = false, escaped = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
  };
  // Se prueban TODOS los comienzos posibles, no solo el primero. Cuando el
  // modelo razona antes de responder, el primer "{" suele estar DENTRO del
  // razonamiento (un fragmento que el modelo cita): antes se intentaba ese,
  // fallaba el JSON.parse y se abandonaba devolviendo undefined, aunque la
  // respuesta buena viniera despues. Nos quedamos con el bloque valido MAS
  // GRANDE, que es la respuesta y no una cita.
  let mejor, mejorLargo = -1, probados = 0;
  for (let i = 0; i < t.length && probados < 80; i++) {
    const ch = t[i];
    if (ch !== '{' && ch !== '[') continue;
    probados++;
    const j = cierre(t, i);
    if (j < 0) continue;
    try {
      const v = JSON.parse(t.slice(i, j + 1));
      if (v && typeof v === 'object' && (j - i) > mejorLargo) { mejor = v; mejorLargo = j - i; }
    } catch {}
  }
  return mejor;
}

// Dos gamas de modelo, según la tarea:
//   COPY (escribir el aviso)  → el modelo que RAZONA. Encontrar el ángulo de un
//     titular exige descartar las tres ideas obvias antes de escribir; eso es
//     justamente lo que hace el "pensamiento" del modelo.
//   MECÁNICO (corrector, ampliar keywords) → el modelo rápido y barato basta.
// Ambos se pueden forzar por variable de entorno sin tocar código.
// Google RETIRA modelos para cuentas nuevas sin aviso (le paso a esta app con
// gemini-2.0-flash y despues con gemini-2.5-pro: 404 "no longer available to
// new users"). Por eso no se fija UN modelo: se prueba una cadena y se usa el
// primero que responda. Un 404 de modelo ya no rompe la generacion.
// Para forzar uno concreto: GEMINI_MODEL_COPY (copy) o GEMINI_MODEL (mecanico).
export const CADENA_COPY   = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-pro-latest'];
export const CADENA_RAPIDA = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
export const cadenaCopy   = env => [env.GEMINI_MODEL_COPY, env.GEMINI_MODEL].filter(Boolean).concat(CADENA_COPY);
export const cadenaRapida = env => [env.GEMINI_MODEL].filter(Boolean).concat(CADENA_RAPIDA);
export const modeloCopy    = env => cadenaCopy(env)[0];
export const modeloRapido  = env => cadenaRapida(env)[0];

// opts: { modelo, pensar, timeout }
//   pensar = presupuesto de razonamiento. -1 = dinámico (el modelo decide),
//   0 = sin pensar (tareas mecánicas). Antes estaba fijo en 0 para TODO, que es
//   la razón principal de que el copy saliera genérico: se le apagaba la cabeza.
export async function llamarGemini(env, promptOrParts, maxTokens, temp, opts) {
  const o = opts || {};
  // Lista de modelos a probar en orden. Si el primero ya no existe para esta
  // cuenta (404), se pasa al siguiente en vez de fallar.
  const cadena = o.cadena || (o.modelo ? [o.modelo] : cadenaRapida(env));
  let ultimo = null;
  for (let i = 0; i < cadena.length; i++) {
    const r = await intentarGemini(env, promptOrParts, maxTokens, temp, o, cadena[i]);
    if (!r.modeloAusente) return r;
    ultimo = r;
  }
  return ultimo || { error: 'No hay ningún modelo de Gemini disponible para esta cuenta.' };
}
export async function intentarGemini(env, promptOrParts, maxTokens, temp, o, model) {
  const pensar = (typeof o.pensar === 'number') ? o.pensar : 0;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const partesEntrada = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
  const genCfg = { temperature: (typeof temp === 'number' ? temp : 0.7), maxOutputTokens: maxTokens || 4096 };
  // Con HERRAMIENTAS (leer URLs, buscar en Google) Gemini no acepta el modo
  // JSON estricto: se pide el JSON en el texto y lo rescata extraerJSON.
  if (!o.tools) genCfg.responseMimeType = 'application/json';
  const conTools = (b) => (o.tools ? { ...b, tools: o.tools } : b);

  // Pensar cuesta tokens de salida: si no se amplía el tope, el modelo gasta el
  // presupuesto razonando y devuelve vacío (el bug que llevó a apagarlo del todo).
  // Cuerpo sin NINGUN thinkingConfig: para el reintento cuando el modelo
  // rechaza el parametro (no es lo mismo que pedir presupuesto 0).
  const cuerpoSinThinking = () => JSON.stringify(conTools({ contents: [{ role: 'user', parts: partesEntrada }], generationConfig: { ...genCfg } }));
  const cuerpoCon = (conThinking) => {
    const g = { ...genCfg };
    if (conThinking) { g.thinkingConfig = { thinkingBudget: pensar }; if (pensar !== 0) g.maxOutputTokens = (maxTokens || 4096) * 3; }
    else g.thinkingConfig = { thinkingBudget: 0 };
    return JSON.stringify(conTools({ contents: [{ role: 'user', parts: partesEntrada }], generationConfig: g }));
  };

  const pedir = async (cuerpo, ms) => {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: cuerpo }); }
    finally { clearTimeout(timer); }
  };

  const espera = o.timeout || (pensar !== 0 ? 90000 : 40000);
  let res;
  try {
    res = await pedir(cuerpoCon(true), espera);
    // Si el modelo o la cuenta no aceptan este thinkingBudget, se reintenta sin
    // él en vez de fallar: la generación nunca se cae por este parámetro.
    // Algunos modelos NO admiten que se les desactive el pensamiento y
    // responden 400. Antes solo se reintentaba si se habia pedido pensar; con
    // thinkingBudget 0 (el caso normal) la generacion se caia sin red.
    if (!res.ok && res.status === 400) res = await pedir(cuerpoSinThinking(), 40000);
  } catch (e) {
    return { error: (e && e.name === 'AbortError') ? `Gemini (${model}) tardó demasiado. Prueba con GEMINI_MODEL_COPY=gemini-2.5-flash.` : 'No se pudo contactar a Gemini: ' + (e.message || e) };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    // 404 = ese modelo no existe para esta cuenta → probar el siguiente.
    if (res.status === 404) return { modeloAusente: true, error: `El modelo ${model} no está disponible para esta cuenta.` };
    // Con herramientas, un 400 suele ser "este modelo no admite url_context /
    // google_search": se prueba el siguiente de la cadena en vez de rendirse.
    if (o.tools && res.status === 400) return { modeloAusente: true, error: `El modelo ${model} no acepta las herramientas pedidas. ${t.slice(0, 200)}` };
    return { error: `Gemini (${model}) respondió ${res.status}. ${t.slice(0, 400)}` };
  }
  let data; try { data = await res.json(); } catch { return { error: 'Respuesta de Gemini no es JSON.' }; }
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  // Los modelos que RAZONAN devuelven su cadena de pensamiento en partes
  // marcadas con `thought: true`, ADEMAS de la respuesta. Concatenarlas todas
  // metia el razonamiento delante del JSON y la generacion se caia con "no se
  // pudo interpretar la respuesta como JSON" (el usuario veia el modelo
  // pensando en voz alta: "Wait, what about... Let's re-read"). Paso el
  // 8-sep-2026 sin tocar el codigo: `gemini-flash-latest` es un ALIAS que
  // Google repunta, y el modelo nuevo piensa aunque se le pida thinkingBudget 0.
  const utiles = Array.isArray(parts) ? parts.filter(p => p && p.thought !== true) : [];
  let texto = utiles.map(p => (p && p.text) || '').join('');
  // Red de seguridad: si el modelo marco TODAS las partes como pensamiento (o
  // no las marco y el filtro no dejo nada), se usa el texto completo y que
  // decida extraerJSON, que ahora sabe saltarse la prosa.
  if (!texto && Array.isArray(parts)) texto = parts.map(p => (p && p.text) || '').join('');
  if (!texto) {
    const motivo = (data && data.candidates && data.candidates[0] && data.candidates[0].finishReason) || (data && data.promptFeedback && data.promptFeedback.blockReason) || 'sin contenido';
    return { error: 'Gemini no devolvió contenido (' + motivo + ').' };
  }
  const parsed = extraerJSON(texto);
  // Qué leyó de verdad con las herramientas: URLs recuperadas y fuentes de Google.
  const cand = (data && data.candidates && data.candidates[0]) || {};
  const urlsLeidas = ((cand.urlContextMetadata || cand.url_context_metadata || {}).urlMetadata || [])
    .filter(m => /SUCCESS/i.test(String(m.urlRetrievalStatus || m.url_retrieval_status || '')))
    .map(m => m.retrievedUrl || m.retrieved_url).filter(Boolean);
  const fuentes = ((cand.groundingMetadata || {}).groundingChunks || [])
    .map(c => c && c.web && (c.web.title || c.web.uri)).filter(Boolean).slice(0, 12);
  if (parsed === undefined) {
    const fin = (data && data.candidates && data.candidates[0] && data.candidates[0].finishReason) || '';
    // Si se quedo sin tokens, el JSON viene cortado: hay que decirlo asi, no
    // "no es JSON", que manda a buscar el problema donde no esta.
    if (fin === 'MAX_TOKENS') return { error: `Gemini (${model}) se quedo sin espacio de respuesta y el JSON llego cortado. Reintenta; si se repite, sube el tope.` };
    return { error: 'No se pudo interpretar la respuesta de la IA como JSON. Inicio: ' + String(texto).slice(0, 160) };
  }
  return { parsed, urlsLeidas, fuentes, texto };
}

// ── Corrección ortográfica RAE (segunda pasada, server-side) ──────────────
// La regla "cero faltas" en el prompt demostró NO bastar (salió un banner con
// falta de ortografía). Ahora TODO texto visible pasa por un corrector antes
// de devolverse: una llamada extra a Gemini con temperatura 0 que corrige SOLO
// ortografía/puntuación RAE sin tocar estilo ni largo. Si el corrector falla,
// la generación no se bloquea: se devuelven los originales y `ortografia:"sin-revisar"`.
export async function corregirOrtografia(env, textos) {
  const originales = textos.map(t => String(t == null ? '' : t));
  const conTexto = originales.map((t, i) => [i, t]).filter(p => p[1].trim().length > 1);
  if (!conTexto.length) return { textos: originales, revisado: true };
  const prompt = [
    'Eres corrector ortográfico profesional de piezas publicitarias en español de Chile (normas RAE).',
    'Corrige SOLO: tildes y acentos, mayúsculas/minúsculas, signos de apertura y cierre (¿? ¡!), puntuación y erratas evidentes (letras cambiadas o faltantes).',
    'MAYÚSCULAS (norma RAE): solo al inicio del texto y en nombres propios (marcas, nombres de producto, lugares, siglas). Si un texto trae mayúscula inicial en cada palabra, al estilo inglés, pásalo a minúscula: "Cotiza Tu Seguro Hoy" → "Cotiza tu seguro hoy"; "Seguro Hogar Total <Marca>" se mantiene si "Hogar Total" es el nombre del producto.',
    'NO cambies: el estilo, el orden de las palabras, el vocabulario, los números, los nombres de marca o producto, ni el largo. NO agregues punto final a un texto que no lo tenía. NO "mejores" la redacción.',
    'Devuelve EXCLUSIVAMENTE este JSON: { "textos": [ ... ] } con la MISMA cantidad de textos, en el MISMO orden (idénticos si ya estaban correctos).',
    'TEXTOS A REVISAR:',
    JSON.stringify({ textos: conTexto.map(p => p[1]) })
  ].join('\n');
  const { parsed, error } = await llamarGemini(env, prompt, 3072, 0);
  if (error || !parsed || !Array.isArray(parsed.textos) || parsed.textos.length !== conTexto.length) {
    return { textos: originales, revisado: false };
  }
  const out = originales.slice();
  for (let j = 0; j < conTexto.length; j++) {
    const corregido = String(parsed.textos[j] == null ? '' : parsed.textos[j]).replace(/\s+/g, ' ').trim();
    if (corregido) out[conTexto[j][0]] = corregido;
  }
  return { textos: out, revisado: true };
}
export const sinPuntoFinal = s => String(s == null ? '' : s).replace(/\s*[.。]+\s*$/, '').replace(/\s+/g, ' ').trim();
