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

    // Lista los modelos que ESTA cuenta tiene de verdad. Google retira modelos
    // para cuentas nuevas sin aviso, asi que en vez de adivinar, se preguntan.
    if (u.searchParams.get('modelos') === '1') {
      if (!env.GEMINI_API_KEY) return json({ ...out, error: 'Falta GEMINI_API_KEY.' }, 200);
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GEMINI_API_KEY)}&pageSize=200`);
        const d = await r.json();
        const todos = (d.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => String(m.name || '').replace('models/', ''));
        out.disponibles = todos;
        out.cadenaCopy = cadenaCopy(env);
        out.cadenaRapida = cadenaRapida(env);
        out.usaraParaCopy = out.cadenaCopy.find(m => todos.includes(m)) || '(ninguno de la cadena: se probaran igual y ganara el primero que responda)';
        out.usaraParaMecanico = out.cadenaRapida.find(m => todos.includes(m)) || '(ninguno de la cadena)';
      } catch (e) { out.errorModelos = e.message || String(e); }
      return json(out, 200);
    }
    if (u.searchParams.get('gemini') !== '1') {
      out.nota = 'Función viva y deploy actualizado. Modelos de tu cuenta: /api/ia?modelos=1 · Probar Gemini: /api/ia?gemini=1';
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
                 : body.modo === 'mas-keywords' ? 'ads'
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
    const refsTxt = (await leerReferencias(brief.refs)).texto;
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
    // Usa la MISMA cadena de modelos que el resto: si uno está retirado, sigue con el siguiente.
    const { parsed, error } = await llamarGemini(env, instr, 1024, 0.85, { cadena: cadenaCopy(env) });
    if (error) return json({ ok:false, error }, 500);
    if (!parsed) return json({ ok:false, error:"No se pudo interpretar la respuesta de la IA." }, 500);
    // Segunda pasada: corrector ortográfico RAE.
    const rev = await corregirOrtografia(env, [String(parsed.titular||""), String(parsed.cuerpo||""), String(parsed.cta||"")]);
    return json({ ok:true, titular:rev.textos[0].slice(0,120), cuerpo:rev.textos[1].slice(0,240), cta:rev.textos[2].slice(0,40), ortografia: rev.revisado ? "revisada" : "sin-revisar" });
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

  // Modo "mas-keywords": amplía UN grupo existente de una campaña Search.
  // La consola lo pide con el grupo completo; se devuelven keywords NUEVAS
  // (sin repetir las que ya hay), solo exacta/frase, con el vocabulario de la landing.
  if (body.modo === 'mas-keywords') {
    const g = body.grupo || {};
    const existentes = (Array.isArray(g.keywords) ? g.keywords : []).map(k => String((k && k.t) || '').toLowerCase().trim()).filter(Boolean);
    if (!g.nombre && !g.intencion) return json({ ok: false, error: 'Falta el grupo a ampliar.' }, 400);
    const refsK = await leerReferencias([brief.ctaUrl].concat(Array.isArray(brief.refs) ? brief.refs : []));
    const prompt = [
      'Eres un especialista senior en Google Ads (Search). Amplía las keywords de UN grupo de anuncios existente.',
      'Devuelve EXCLUSIVAMENTE este JSON: { "keywords": [ { "t": "keyword en minúsculas", "tipo": "exacta" | "frase" } ] }',
      'REGLAS DURAS:',
      `- El grupo es "${String(g.nombre || '')}" y su intención de búsqueda es: ${String(g.intencion || '(la que sugiere el nombre)')}. TODAS las keywords nuevas deben calzar con ESA MISMA intención (no abras temas nuevos).`,
      '- Entrega 8 a 15 keywords NUEVAS. PROHIBIDO repetir o variar trivialmente las que ya existen (lista abajo).',
      '- "tipo" SOLO "exacta" o "frase" (la amplia está prohibida). Minúsculas, 2 a 5 palabras, como busca la gente de verdad (singular/plural, sinónimos, "online"/"precio"/"chile" cuando aplique).',
      '- Usa el VOCABULARIO REAL de la landing cuando exista el extracto.',
      existentes.length ? 'KEYWORDS QUE YA EXISTEN (no las repitas):\n' + existentes.join(' · ') : '',
      refsK.texto ? '\nEXTRACTO DE LA LANDING:\n' + refsK.texto.slice(0, 2000) : '',
      brief.que ? `\nCONTEXTO de la campaña: ${brief.que}` : ''
    ].filter(Boolean).join('\n');
    const { parsed, error } = await llamarGemini(env, prompt, 1536);
    if (error) return json({ ok: false, error }, 500);
    const setEx = new Set(existentes);
    const nuevas = (Array.isArray(parsed && parsed.keywords) ? parsed.keywords : []).map(k => ({
      t: String((k && k.t) || '').toLowerCase().replace(/^[\["'+]+|[\]"']+$/g, '').replace(/\s+/g, ' ').trim(),
      tipo: (k && k.tipo === 'frase') ? 'frase' : 'exacta'
    })).filter(k => k.t && !setEx.has(k.t) && (setEx.add(k.t), true)).slice(0, 15);
    if (!nuevas.length) return json({ ok: false, error: 'La IA no encontró keywords nuevas para esta intención.' }, 500);
    return json({ ok: true, keywords: nuevas });
  }

  if (!brief.que || !String(brief.que).trim()) {
    return json({ ok: false, error: 'Dime qué necesitas (el brief está vacío).' }, 400);
  }

  // Modo "concepto": define UNA idea de campaña (nombre, titular maestro, mensajes
  // clave) que después guía la generación de cada pieza (email + banners + search),
  // para que toda la campaña diga lo mismo con el mismo vocabulario (campaña-primero).
  if (body.modo === 'concepto') {
    const mk = body.marca || null;
    const refs2 = await leerReferencias(brief.refs);
    const refsTxt2 = refs2.texto;
    const prompt = [
      `Eres director creativo de ${mk ? (mk.nombre || mk.empresa) : 'la marca'}. Define el CONCEPTO de una campaña multicanal (email + banners display + anuncios de Google Search).`,
      '',
      encargoDelUsuario(brief),
      '',
      'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
      '{ "nombre": "nombre corto de la campaña (máx 5 palabras)", "idea": "la idea central en 1 frase", "titular": "titular maestro, máx 7 palabras, SIN punto final", "mensajes": [ "3 mensajes clave, máx 10 palabras cada uno" ] }',
      'Reglas: español de Chile; el concepto debe funcionar igual de bien en un email, un banner chico y un anuncio de texto; respeta el gancho EXACTO si existe (no inventes cifras ni fechas).',
      'VOZ DE MARCA:',
      voorMarca(mk),
      refsTxt2 ? 'CONTEXTO de las URLs de referencia (material de apoyo, NO es el encargo):\n' + refsTxt2 : '',
      reglasBrief(brief, refs2.promos, 'concepto')
    ].filter(Boolean).join('\n');
    const { parsed, error } = await llamarGemini(env, prompt, 1024, 0.9, { cadena: cadenaCopy(env), pensar: -1 });
    if (error) return json({ ok: false, error }, 500);
    const c = parsed || {};
    const mensajes = (Array.isArray(c.mensajes) ? c.mensajes : []).map(m => String(m).replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean).slice(0, 4);
    // Segunda pasada: corrector ortográfico RAE (el concepto guía TODAS las piezas).
    const rev = await corregirOrtografia(env, [String(c.nombre || brief.que), String(c.idea || ''), String(c.titular || '')].concat(mensajes));
    return json({
      ok: true,
      nombre: rev.textos[0].slice(0, 60),
      concepto: {
        idea: rev.textos[1].slice(0, 200),
        titular: rev.textos[2].replace(/\s*[.。]+\s*$/, '').slice(0, 80),
        mensajes: mensajes.map((m, i) => rev.textos[3 + i].slice(0, 120))
      },
      ortografia: rev.revisado ? 'revisada' : 'sin-revisar'
    });
  }

  const producto = (body.producto === 'banner') ? 'banner' : (body.producto === 'ads') ? 'ads' : 'email';
  const marca = body.marca || null;
  const imagenes = Array.isArray(body.imagenes) ? body.imagenes.slice(0, 40) : [];
  // Lee también el SITIO DE DESTINO del anuncio (ctaUrl), no solo las URLs de referencia.
  const refs = await leerReferencias([brief.ctaUrl].concat(Array.isArray(brief.refs) ? brief.refs : []));
  const refsTxt = refs.texto, promos = refs.promos, enlaces = refs.enlaces;

  if (producto === 'ads') return generarAds({ env, brief, marca, refsTxt, promos, enlaces });
  if (producto === 'banner') return generarBanner({ env, brief, marca, imagenes, refsTxt, promos, estilo: body.estilo === 'marca' ? 'marca' : '' });
  return generarEmail({ env, brief, marca, imagenes, refsTxt, promos, catalogo: Array.isArray(body.catalogo) ? body.catalogo : [] });
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

// ── LO QUE PIDIÓ EL USUARIO ───────────────────────────────────────────────
// Va SIEMPRE al principio del prompt, antes de cualquier contexto. Antes iba al
// final, después de ~9.000 caracteres de texto raspado de la landing: pesaba el
// 0,6% del prompt y en la práctica se ignoraba. Lo que la persona escribe es la
// instrucción de mayor rango, no una nota al pie.
function encargoDelUsuario(brief) {
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
function reglasBrief(brief, promos, producto) {
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
function enfoqueDe(tipo) {
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
const UA_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};
// Extrae título + meta description + Open Graph + JSON-LD + texto visible
// (sirve aun en webs JS: muchas llevan sus datos de producto/oferta en ld+json).
function extraerTextoPagina(html, max) {
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
function extraerEnlaces(html, urlBase) {
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
function detectarPromos(texto) {
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
async function leerReferencias(refs) {
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
    let extracto = html ? extraerTextoPagina(html, 1800) : '';
    // Landing renderizada por JS (casi sin texto) → reintenta como Googlebot:
    // muchos sitios sirven una versión pre-renderizada a los bots.
    if (!extracto || extracto.length < 250) {
      const html2 = await bajar({ ...UA_NAVEGADOR, 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
      if (html2) {
        const ex2 = extraerTextoPagina(html2, 1800);
        if (ex2.length > extracto.length) { html = html2; extracto = ex2; }
      }
    }
    if (!extracto) return { trozo: `(${norm}: no se pudo leer)`, promos: [], enlaces: [] };
    return {
      trozo: `• ${norm}\n${extracto}`,
      promos: detectarPromos(extracto),
      enlaces: esPrimera && html ? extraerEnlaces(html, norm) : []   // sitelinks: solo de la landing principal
    };
  };
  const partes = await Promise.all(urls.map((u, i) => leerUna(u, i === 0)));
  return {
    texto: partes.map(p => p.trozo).join('\n\n').slice(0, 2500),   // era 9000: ahogaba el encargo del usuario
    promos: partes.flatMap(p => p.promos).slice(0, 4),
    enlaces: partes.flatMap(p => p.enlaces).slice(0, 12)
  };
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
const CADENA_COPY   = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-pro-latest'];
const CADENA_RAPIDA = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const cadenaCopy   = env => [env.GEMINI_MODEL_COPY, env.GEMINI_MODEL].filter(Boolean).concat(CADENA_COPY);
const cadenaRapida = env => [env.GEMINI_MODEL].filter(Boolean).concat(CADENA_RAPIDA);
const modeloCopy    = env => cadenaCopy(env)[0];
const modeloRapido  = env => cadenaRapida(env)[0];

// opts: { modelo, pensar, timeout }
//   pensar = presupuesto de razonamiento. -1 = dinámico (el modelo decide),
//   0 = sin pensar (tareas mecánicas). Antes estaba fijo en 0 para TODO, que es
//   la razón principal de que el copy saliera genérico: se le apagaba la cabeza.
async function llamarGemini(env, promptOrParts, maxTokens, temp, opts) {
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
async function intentarGemini(env, promptOrParts, maxTokens, temp, o, model) {
  const pensar = (typeof o.pensar === 'number') ? o.pensar : 0;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const partesEntrada = Array.isArray(promptOrParts) ? promptOrParts : [{ text: promptOrParts }];
  const genCfg = { responseMimeType: 'application/json', temperature: (typeof temp === 'number' ? temp : 0.7), maxOutputTokens: maxTokens || 4096 };

  // Pensar cuesta tokens de salida: si no se amplía el tope, el modelo gasta el
  // presupuesto razonando y devuelve vacío (el bug que llevó a apagarlo del todo).
  const cuerpoCon = (conThinking) => {
    const g = { ...genCfg };
    if (conThinking) { g.thinkingConfig = { thinkingBudget: pensar }; if (pensar !== 0) g.maxOutputTokens = (maxTokens || 4096) * 3; }
    else g.thinkingConfig = { thinkingBudget: 0 };
    return JSON.stringify({ contents: [{ role: 'user', parts: partesEntrada }], generationConfig: g });
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
    if (!res.ok && res.status === 400 && pensar !== 0) res = await pedir(cuerpoCon(false), 40000);
  } catch (e) {
    return { error: (e && e.name === 'AbortError') ? `Gemini (${model}) tardó demasiado. Prueba con GEMINI_MODEL_COPY=gemini-2.5-flash.` : 'No se pudo contactar a Gemini: ' + (e.message || e) };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    // 404 = ese modelo no existe para esta cuenta → probar el siguiente.
    if (res.status === 404) return { modeloAusente: true, error: `El modelo ${model} no está disponible para esta cuenta.` };
    return { error: `Gemini (${model}) respondió ${res.status}. ${t.slice(0, 400)}` };
  }
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

// ── Corrección ortográfica RAE (segunda pasada, server-side) ──────────────
// La regla "cero faltas" en el prompt demostró NO bastar (salió un banner con
// falta de ortografía). Ahora TODO texto visible pasa por un corrector antes
// de devolverse: una llamada extra a Gemini con temperatura 0 que corrige SOLO
// ortografía/puntuación RAE sin tocar estilo ni largo. Si el corrector falla,
// la generación no se bloquea: se devuelven los originales y `ortografia:"sin-revisar"`.
async function corregirOrtografia(env, textos) {
  const originales = textos.map(t => String(t == null ? '' : t));
  const conTexto = originales.map((t, i) => [i, t]).filter(p => p[1].trim().length > 1);
  if (!conTexto.length) return { textos: originales, revisado: true };
  const prompt = [
    'Eres corrector ortográfico profesional de piezas publicitarias en español de Chile (normas RAE).',
    'Corrige SOLO: tildes y acentos, mayúsculas/minúsculas, signos de apertura y cierre (¿? ¡!), puntuación y erratas evidentes (letras cambiadas o faltantes).',
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

// ════════════ PRODUCTO 1: BANNERS DE GOOGLE DISPLAY (3 zonas) ════════════
async function generarBanner({ env, brief, marca, imagenes, refsTxt, promos, estilo }) {
  const imgsTxt = imagenes.length
    ? imagenes.map(im => `- ${im.url}  →  ${im.nombre || '(sin descripción)'}`).join('\n')
    : '(biblioteca vacía: deja "imagen" en "")';
  const hayOferta = !!(brief.gancho || (promos && promos.length));
  const hayFoto = imagenes.length > 0;
  // Estilo de marca: la IA ademas ELIGE la diagramacion entre cuatro cerradas.
  const conLayout = estilo === 'marca';
  const bloqueLayout = conLayout ? [
    '',
    'ELIGE TAMBIEN LA DIAGRAMACION ("layout"), la que mejor sirva a ESTE encargo:',
    '  "circulo"     → la oferta va en un círculo grande. SOLO si hay una cifra que manda (cuotas, precio, % dcto).',
    '  "corte"       → foto grande con borde curvo y el dato en una banda. Cuando el producto o la persona es lo que vende.' + (hayFoto ? '' : ' (NO la elijas: no hay fotos disponibles)'),
    '  "bloque"      → bloque de color y foto al lado, sin curvas. Para mensajes institucionales o de confianza.' + (hayFoto ? '' : ' (NO la elijas: no hay fotos disponibles)'),
    '  "tipografica" → sin foto, manda el titular. Cuando el mensaje es corto y contundente.',
    hayOferta ? 'Hay una oferta con cifra, así que "circulo" es la opción natural — elige otra solo si tienes una razón.' 
              : 'NO hay oferta con cifra: NO elijas "circulo".',
    hayFoto ? '' : 'La biblioteca está vacía: elige "tipografica".'
  ].filter(Boolean).join('\n') : '';
  const prompt = [
    `Eres director creativo de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Creas banners de Google Display que rinden y suenan 100% a la marca.`,
    '',
    // El encargo va PRIMERO. Todo lo demás es contexto de apoyo.
    encargoDelUsuario(brief),
    '',
    enfoqueDe(brief.tipo),
    '',
    'PIENSA ANTES DE ESCRIBIR (no lo muestres, solo devuelve el JSON):',
    '1. ¿Qué gana el lector? Escríbelo en una frase.',
    '2. Propón CINCO titulares distintos por ángulo (beneficio, miedo evitado, pregunta, dato concreto, tiempo/facilidad).',
    '3. Descarta los que podrían servirle a cualquier otra marca del rubro. Si los cinco sirven para cualquiera, escribe cinco nuevos.',
    '4. Devuelve el mejor.',
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
    conLayout ? '{ "layout": "circulo" | "corte" | "bloque" | "tipografica", "nombre": "nombre corto de la campaña", "zonas": {'
              : '{ "nombre": "nombre corto de la campaña", "zonas": { "etiqueta": "<nombre corto del PRODUCTO en 1-3 palabras (ej. \\"Seguro Auto\\") o \\"\\">", "titular": "...", "cuerpo": "...", "cta": "..." }, "burbuja": "<la OFERTA en 2-4 palabras para el círculo de promo (ej. \\"2 Cuotas Gratis\\", \\"60% dcto.\\") — SOLO si hay oferta real, si no \\"\\">", "imagen": "<URL exacta de la biblioteca o \\"\\"> " }',
    '',
    bloqueLayout,
    '',
    'CÓMO SE REPARTE EL MENSAJE EN ESTE BANNER (importante):',
    hayOferta
      ? '- El banner tiene un CÍRCULO de promoción aparte. La OFERTA vive ahí y SOLO ahí ("burbuja"). El "titular" NO la repite: dice la propuesta de valor o el beneficio. Ej.: burbuja "2 Cuotas Gratis" + titular "Tu auto siempre protegido". Nunca la oferta dos veces.'
      : '- No hay oferta que destacar: "burbuja" va vacía y el titular carga solo con el beneficio.',
    '- "titular" y "cuerpo" no dicen lo mismo: el titular engancha, el cuerpo suma una razón concreta distinta.',
    '- "etiqueta": el nombre del PRODUCTO, no el de la marca (la marca ya está en el logo).',
    '',
    'REGLAS DE ESCRITURA:',
    '- Español de Chile. Concreto. Nada de relleno ni placeholders.',
    '- LARGO: titular ≤ 6 palabras; cuerpo ≤ 14 palabras; cta ≤ 3 palabras. Si no cabe, REESCRIBE más corto — no lo entregues cortado a la mitad.',
    '- El "cta" refleja la acción del encargo.',
    '',
    'EJEMPLOS (el nivel que se espera):',
    'MAL  → "Zurich te ofrece la mejor cobertura del mercado"   (habla la empresa, genérico, sirve para cualquiera)',
    'BIEN → "Tu auto protegido, pase lo que pase"               (habla al lector, concreto)',
    'MAL  → "Descubre nuestras soluciones de protección"        (vacío, no dice nada)',
    'BIEN → "Choca, roba o granice: estás cubierto"             (específico, imagen mental)',
    '',
    'IMAGEN:',
    '- Si la biblioteca tiene fotos, DEBES elegir la URL EXACTA de la que mejor calce (no la dejes vacía); solo con biblioteca vacía va "".',
    '- NUNCA un logo ni un ícono como foto del banner.',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    refsTxt ? '\nCONTEXTO DEL SITIO (material de apoyo — NO es el encargo; úsalo para el vocabulario y la propuesta de valor, no copies literal):\n' + refsTxt : '',
    '',
    'REGLAS FINALES:',
    reglasBrief(brief, promos, 'banner'),
    brief.notas && String(brief.notas).trim() ? `\nRECORDATORIO — las indicaciones expresas del encargo mandan: ${String(brief.notas).trim()}` : ''
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

  const { parsed, error } = await llamarGemini(env, entrada, 1200, 0.9, { cadena: cadenaCopy(env), pensar: -1 });
  if (error) return json({ ok: false, error }, 500);
  const z = (parsed && parsed.zonas) || {};
  const limpia = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, n).join(' ');
  const LAYOUTS_OK = ['circulo','corte','bloque','tipografica'];
  let layout = (conLayout && LAYOUTS_OK.includes(parsed && parsed.layout)) ? parsed.layout : '';
  // Coherencia: el circulo exige cifra; corte y bloque exigen foto.
  if (layout === 'circulo' && !hayOferta) layout = hayFoto ? 'corte' : 'tipografica';
  if ((layout === 'corte' || layout === 'bloque') && !hayFoto) layout = hayOferta ? 'circulo' : 'tipografica';
  if (conLayout && !layout) layout = hayOferta ? 'circulo' : (hayFoto ? 'corte' : 'tipografica');
  const out = {
    ok: true,
    layout,
    nombre: String((parsed && parsed.nombre) || brief.que).slice(0, 80),
    zonas: { etiqueta: limpia(z.etiqueta, 3), titular: limpia(z.titular, 8), cuerpo: limpia(z.cuerpo, 18), cta: limpia(z.cta, 4) },
    // La burbuja solo existe con gancho del brief o promoción REAL de la landing.
    burbuja: (brief.gancho || (promos && promos.length)) ? limpia(parsed.burbuja, 5) : '',
    imagen: (typeof parsed.imagen === 'string' && /^https?:\/\//.test(parsed.imagen)) ? parsed.imagen : ''
  };
  if (!out.zonas.titular && !out.zonas.cuerpo) return json({ ok: false, error: 'La IA no produjo textos. Reformula el brief.' }, 500);
  // Segunda pasada: corrector ortográfico RAE sobre todo texto visible.
  const rev = await corregirOrtografia(env, [out.nombre, out.zonas.etiqueta, out.zonas.titular, out.zonas.cuerpo, out.zonas.cta, out.burbuja]);
  out.nombre = String(rev.textos[0]).slice(0, 80);
  out.zonas = { etiqueta: limpia(rev.textos[1], 3), titular: sinPuntoFinal(limpia(rev.textos[2], 8)), cuerpo: limpia(rev.textos[3], 18), cta: limpia(rev.textos[4], 4) };
  out.burbuja = (brief.gancho || (promos && promos.length)) ? limpia(rev.textos[5], 5) : '';
  out.ortografia = rev.revisado ? 'revisada' : 'sin-revisar';
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

async function generarEmail({ env, brief, marca, imagenes, refsTxt, promos }) {
  const tipo = ['comercial', 'corporativo', 'informativo', 'newsletter'].includes(brief.tipo) ? brief.tipo : 'comercial';
  const imgsTxt = imagenes.length
    ? imagenes.map(im => `- ${im.url}  →  ${im.nombre || '(sin descripción)'}`).join('\n')
    : '(biblioteca vacía: deja "imagen" en "")';

  const prompt = [
    `Eres director creativo de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Escribes el COPY de un email que suena 100% a la marca y convierte.`,
    '',
    // El encargo va PRIMERO, antes de cualquier contexto.
    encargoDelUsuario(brief),
    '',
    enfoqueDe(tipo),
    '',
    'PIENSA ANTES DE ESCRIBIR (no lo muestres, solo devuelve el JSON):',
    '1. ¿Qué gana el lector con esto? Una frase.',
    '2. Escribe CINCO titulares por ángulos distintos (beneficio, problema evitado, pregunta, dato concreto, facilidad).',
    '3. Tacha los que le servirían igual a cualquier competidor. Si se caen todos, escribe cinco nuevos.',
    '4. Quédate con el mejor y construye el resto del copy alrededor de él.',
    '',
    'ELIGE ADEMÁS EL MOLDE del email (cómo se arma la pieza), el que mejor sirva a ESTE encargo:',
    '  "oferta"     → la promoción manda: foto, banda de color con la oferta grande, razones, cierre. Para promos y descuentos.',
    '  "beneficios" → tres razones bien contadas, sin gritar. Para producto o servicio que hay que explicar.',
    '  "historia"   → una sola idea desarrollada en dos bandas de texto, sin lista. Para institucional y de confianza.',
    '  "anuncio"    → directo y corto: foto grande, una frase, botón. Para novedades y recordatorios.',
    'Si las indicaciones del encargo piden o prohíben algo (por ejemplo, "sin íconos" o "sin listas"), ELIGE el molde que lo respete: "historia" y "anuncio" no llevan iconos ni listas.',
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra). Solo el COPY y el molde; la maquetación la pone el sistema.',
    '{',
    '  "molde": "oferta" | "beneficios" | "historia" | "anuncio",',
    '  "nombre": "asunto del correo, concreto y sin relleno (máx 9 palabras)",',
    '  "titular": "titular principal con gancho, SIN punto final, máx 8 palabras",',
    '  "intro": "1-2 frases que presentan el mensaje (máx 30 palabras)",',
    '  "oferta": "frase corta de la oferta/gancho a destacar (o \\"\\" si no hay oferta)",',
    '  "beneficios": [ { "icono": "<clave de la lista>", "titulo": "máx 4 palabras SIN punto", "texto": "máx 14 palabras" } ],',
    '  "cierre": "párrafo breve de cierre o refuerzo (o \\"\\")",',
    '  "cta": "texto del botón, imperativo, máx 3 palabras",',
    '  "imagen": "<URL EXACTA de la biblioteca que mejor calce, o \\"\\">"',
    '}',
    '',
    'REGLAS:',
    '- Español de Chile, concreto y persuasivo; nada de placeholders ni texto de relleno.',
    '- Escribe como un AVISO, no como un comunicado: el lector debe sentir que le hablan a él (tú), no que la empresa se describe a sí misma.',
    '- Tres beneficios en los moldes "oferta" y "beneficios"; en "historia" y "anuncio" devuelve la lista VACÍA y desarrolla el "cierre".',
    '- Cada "icono" DISTINTO y relevante, de esta lista EXACTA: ' + ICONOS_VALIDOS.join(', ') + '.',
    '- Si un texto no cabe en el largo pedido, REESCRÍBELO más corto. Nunca lo entregues cortado.',
    '- "imagen": si la biblioteca tiene fotos, DEBES elegir la URL EXACTA de la que mejor calce (no la dejes vacía); solo con biblioteca vacía va "". NUNCA un logo ni un ícono.',
    '',
    'EJEMPLOS (el nivel que se espera):',
    'MAL  → "En Zurich nos complace presentarte nuestra nueva cobertura"  (comunicado, habla la empresa)',
    'BIEN → "Tu auto protegido, pase lo que pase"                          (habla al lector)',
    'MAL  → "Contamos con más de 150 años de experiencia"                  (dato de la empresa, al lector le da igual)',
    'BIEN → "Cotiza en 3 minutos, sin papeleo"                             (beneficio concreto para él)',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    '',
    'BIBLIOTECA DE IMÁGENES (url → descripción):',
    imgsTxt,
    refsTxt ? '\nCONTEXTO DEL SITIO (material de apoyo — NO es el encargo; úsalo para el vocabulario y la propuesta de valor, no copies literal):\n' + refsTxt : '',
    '',
    'REGLAS FINALES:',
    reglasBrief(brief, promos, 'email'),
    brief.notas && String(brief.notas).trim() ? `\nRECORDATORIO — las indicaciones expresas del encargo mandan sobre cualquier regla de estilo: ${String(brief.notas).trim()}` : ''
  ].filter(Boolean).join('\n');

  const { parsed, error } = await llamarGemini(env, prompt, 2048, 0.9, { cadena: cadenaCopy(env), pensar: -1 });
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

  // ── Segunda pasada: corrector ortográfico RAE sobre todo el copy ──────
  const nombreEmail = String(c.nombre || brief.que).slice(0, 120);
  const planos = [titular, intro, oferta, cierre, cta].concat(benes.flatMap(b => [b.t, b.s])).concat([nombreEmail]);
  const rev = await corregirOrtografia(env, planos);
  const titularR = sinPuntoFinal(rev.textos[0]).slice(0, 90);
  const introR   = rev.textos[1].slice(0, 260);
  const ofertaR  = sinPuntoFinal(rev.textos[2]).slice(0, 90);
  const cierreR  = rev.textos[3].slice(0, 260);
  const ctaR     = (rev.textos[4].split(' ').slice(0, 3).join(' ')) || cta;
  benes = benes.map((b, i) => ({ ico: b.ico, t: sinPuntoFinal(rev.textos[5 + i * 2]).slice(0, 40), s: rev.textos[6 + i * 2].slice(0, 140) }));
  const nombreR = rev.textos[5 + benes.length * 2].slice(0, 120) || nombreEmail;

  // ── MOLDES del email ──────────────────────────────────────────────────
  // Antes había UN esqueleto fijo (hero → alert → texto → features → cta) que
  // se aplicaba a todo: por eso todos los emails salían idénticos y ninguna
  // indicación del usuario podía cambiarlos (la estructura la decidía el código,
  // no el prompt). Ahora la IA elige el molde y aquí se arma con el vocabulario
  // de las plantillas buenas: BANDAS DE COLOR full-bleed (bloque "seccion"),
  // foto limpia a todo el ancho, y el botón dentro de la banda de cierre.
  // Nada de "hero" con texto encima (se rompe en Outlook) ni "alert" de aviso.
  const P = marca || {};
  const cNavy  = P.secondary || P.primary || '#23366f';   // banda oscura
  const cClaro = P.bg || '#ffffff';                        // banda clara
  const cTexto = P.text || '#23366f';
  const cAcento = P.accent1 || P.primary || '#2167ae';     // banda de oferta
  const cBoton = P.cta || P.primary || '#2167ae';
  const cBotonTxt = P.ctaText || '#ffffff';
  const fTit = P.fontTitulo || '';
  const blanco = '#ffffff';

  const bloques = [];
  const push = (t, datos) => bloques.push({ tipo: t, datos });
  const foto = () => { if (imagen) push('imagen', { url: imagen, anchoImg: '100', radio: '0', padTop: '0', padBottom: '0', padLeft: '0', padRight: '0' }); };
  // Banda: el primitivo de email profesional (full-bleed, con su propio color).
  const banda = (o) => push('seccion', Object.assign({
    bg: cClaro, colorTexto: cTexto, colorEyebrow: cBoton, alinH: 'center',
    eyebrow: '', titulo: '', subtitulo: '', fuenteTitulo: fTit,
    tamTitulo: '26', tamSub: '15', padV: '32', padH: '28',
    botonTexto: '', botonUrl: '', botonVariante: 'solido', botonColor: cBoton
  }, o));
  const bandaCierre = (extra) => banda(Object.assign({
    bg: cNavy, colorTexto: blanco, colorEyebrow: blanco,
    botonTexto: ctaR, botonUrl: '', botonVariante: 'solido', botonColor: cBoton, padV: '36'
  }, extra || {}));

  const molde = ['oferta', 'beneficios', 'historia', 'anuncio'].includes(c.molde)
    ? c.molde
    : (ofertaR && tipo === 'comercial') ? 'oferta' : (tipo === 'corporativo' ? 'historia' : 'beneficios');

  if (molde === 'oferta') {
    foto();
    banda({ titulo: titularR, subtitulo: introR, tamTitulo: '28' });
    if (ofertaR) banda({ bg: cAcento, colorTexto: esOscuro(cAcento) ? blanco : cTexto, titulo: ofertaR, tamTitulo: '34', padV: '26' });
    if (benes.length) push('features', { items: benes, disposicion: 'fila', porFila: '3', orientacion: 'vertical', colorIcono: cBoton });
    bandaCierre({ titulo: cierreR || '' });
  } else if (molde === 'beneficios') {
    foto();
    banda({ titulo: titularR, subtitulo: introR, tamTitulo: '28' });
    if (benes.length) push('features', { items: benes, disposicion: 'fila', porFila: '3', orientacion: 'vertical', colorIcono: cBoton });
    bandaCierre({ titulo: cierreR || '' });
  } else if (molde === 'historia') {
    // Sin íconos y sin listas: dos bandas de texto y el cierre.
    foto();
    banda({ titulo: titularR, subtitulo: introR, tamTitulo: '28' });
    if (cierreR) banda({ bg: cClaro === '#ffffff' ? '#f4f6fa' : blanco, subtitulo: cierreR, tamSub: '16', padV: '30' });
    bandaCierre({});
  } else {   // anuncio: directo y corto
    foto();
    banda({ titulo: titularR, subtitulo: introR, tamTitulo: '30', padV: '36' });
    bandaCierre({});
  }

  return json({ ok: true, nombre: nombreR, molde, bloques, ortografia: rev.revisado ? 'revisada' : 'sin-revisar' });
}
// ¿El color es oscuro? (para decidir el color del texto encima). Igual criterio
// que esColorOscuro() del editor, para que servidor y cliente coincidan.
function esOscuro(hex) {
  const h = String(hex || '').replace('#', '');
  const c = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

// ════════════ PRODUCTO 3: GOOGLE SEARCH ADS (campaña razonada) ════════════
// La IA piensa como un especialista de Search, NO como el "modo fácil" de Google:
//   - Agrupa las keywords por INTENCIÓN de búsqueda (grupos temáticos coherentes).
//   - SOLO concordancia exacta y de frase. NUNCA amplia (queda prohibida).
//   - Entrega negativas (por grupo y de campaña) para no pagar clics basura.
//   - Anuncios RSA con límites REALES de Google: titulares ≤30, descripciones ≤90,
//     rutas ≤15. El servidor VALIDA y recorta: nada sale fuera de límite.
async function generarAds({ env, brief, marca, refsTxt, promos, enlaces }) {
  const prompt = [
    `Eres un especialista senior en Google Ads (Search) de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}. Estructuras campañas como un profesional: por INTENCIÓN de búsqueda, con concordancias controladas y negativas. Detestas la concordancia amplia porque quema presupuesto.`,
    '',
    encargoDelUsuario(brief),
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
    '      "titularesFijos": [ "4 titulares ANCLADOS, ≤30 caracteres cada uno" ],',
    '      "titulares": [ "11 titulares que ROTAN, ≤30 caracteres cada uno" ],',
    '      "descripciones": [ "≤90 caracteres cada una" ],',
    '      "path1": "ruta-1", "path2": "ruta-2"',
    '    }',
    '  ],',
    '  "negativas": [ "negativas de TODA la campaña (gratis, empleo, curso, segunda mano, etc. según el caso)" ],',
    '  "sitelinks": [ { "texto": "≤25 caracteres", "desc1": "≤35 caracteres", "desc2": "≤35 caracteres", "url": "ruta REAL de la landing (ej. /cotizar)" } ]',
    '}',
    '',
    'REGLAS DURAS (violarlas invalida la respuesta):',
    '- "nombre" de la campaña y de cada grupo: LEGIBLES para humanos, con espacios y tildes (ej. "Cotizar seguro auto"), NUNCA-en-formato-slug-con-guiones.',
    '- 2 a 4 grupos de anuncios. Cada grupo = UNA sola intención de búsqueda (no mezcles "cotizar" con "qué es").',
    '- Por grupo: 20 a 25 keywords. MENOS DE 20 NO SIRVE. "tipo" SOLO puede ser "exacta" o "frase". La concordancia AMPLIA está PROHIBIDA.',
    '- MEZCLA OBLIGATORIA de concordancias dentro de cada grupo: "exacta" para las búsquedas precisas y cortas (2-3 palabras, la intención exacta del grupo); "frase" para las variantes largas y de cola (4-5 palabras). Un grupo con todas exactas, o todas de frase, está MAL. Mínimo 30% de cada tipo.',
    '- CUBRE las variantes reales de cómo busca la gente dentro de esa MISMA intención: singular/plural, sinónimos, orden distinto, con "online"/"precio"/"chile" cuando aplique. Cantidad con criterio: variantes que alguien escribiría de verdad, no relleno.',
    '- Keywords en minúsculas, sin corchetes ni comillas (el tipo va en "tipo"), 2 a 5 palabras, como la gente busca de verdad (media/larga cola). Nada de keywords de 1 palabra genérica.',
    '- RAZONA las negativas: qué búsquedas parecidas NO queremos pagar (informativas si el grupo es transaccional, "gratis", "empleo", competidores si aplica...). Mínimo 5 negativas de campaña.',
    '- TITULARES: son 15 en total, en DOS listas separadas, todos de MÁXIMO 30 CARACTERES (cuenta espacios), únicos, SIN punto final y sin exclamaciones dobles.',
    '  · "titularesFijos": exactamente 4. Son los que SIEMPRE se muestran (van anclados en Google). Deben funcionar juntos y en este orden: 1) la marca o el producto, 2) la keyword principal del grupo, 3) el beneficio o la oferta concreta, 4) la llamada a la acción.',
    '  · "titulares": exactamente 11. Son los que ROTAN. Cada uno un ángulo distinto (cobertura, precio, plazo, confianza, facilidad, respaldo...). NO repitas los 4 fijos ni los parafrasees.',
    '- 4 descripciones ÚNICAS de MÁXIMO 90 CARACTERES.',
    '- El anuncio le habla AL CLIENTE, jamás habla del anuncio o de la campaña ("esta campaña fue creada para...", "si buscas X, este anuncio..." = PROHIBIDO). No repitas la misma keyword más de 2 veces entre titular y descripción.',
    '- Cada descripción dice UNA cosa CONCRETA (una cobertura, un precio, un plazo, un beneficio real). Nada de relleno tipo "rápido, fácil y online" como frase completa, ni listas de productos sin relación con el grupo.',
    '- "path1"/"path2": máximo 15 caracteres, minúsculas, sin espacios (usa guiones), relacionados con el grupo.',
    '- "sitelinks": 4 a 6, de la MISMA landing. USA los enlaces internos reales listados abajo cuando existan (no inventes rutas); texto ≤25 caracteres, cada descripción ≤35.',
    (promos && promos.length) ? `- La landing muestra estas PROMOCIONES vigentes: ${promos.join(' · ')}. Inclúyelas TAL CUAL en 2-3 titulares y al menos 1 descripción del grupo más transaccional (sin cambiar cifras).` : '',
    '- Las keywords y los anuncios deben usar el VOCABULARIO REAL de la landing (los nombres de producto y términos que ella usa, no sinónimos genéricos).',
    '- Español de Chile. Respeta el tono y las palabras de la marca; NO inventes ofertas, precios ni fechas.',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    refsTxt ? '\nCONTENIDO DE LAS URLS DE REFERENCIA — ANALÍZALO y RAZONA: identifica la propuesta de valor, los productos y el vocabulario real del sitio, y úsalo para que las keywords y anuncios calcen con lo que la landing de verdad ofrece (NO copies literal, NO inventes datos):\n' + refsTxt : '',
    (enlaces && enlaces.length) ? '\nENLACES INTERNOS REALES de la landing (candidatos a sitelinks, "texto → ruta"):\n' + enlaces.map(e => `- ${e.texto} → ${e.ruta}`).join('\n') : '',
    '',
    'BRIEF:',
    reglasBrief(brief, promos, 'ads'),
    brief.ctaUrl ? `URL FINAL de los anuncios (landing): ${brief.ctaUrl}` : ''
  ].filter(Boolean).join('\n');

  const { parsed, error } = await llamarGemini(env, prompt, 8192, 0.8, { cadena: cadenaCopy(env), pensar: -1 });
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
    let keywords = kws.filter(k => { const key = k.t; if (seenK.has(key)) return false; seenK.add(key); return true; }).slice(0, 25);
    // MEZCLA de concordancias. La IA tiende a devolver todo de un tipo. La regla
    // del oficio: búsquedas cortas y precisas → exacta; cola larga → frase. Si un
    // tipo queda bajo el 30%, se reasigna por longitud (criterio, no azar).
    const MIN_MIX = 0.3;
    const nFrase = keywords.filter(k => k.tipo === 'frase').length;
    if (keywords.length >= 6 && (nFrase / keywords.length < MIN_MIX || nFrase / keywords.length > 1 - MIN_MIX)) {
      const porLargo = keywords.slice().sort((a, b) => b.t.split(/\s+/).length - a.t.split(/\s+/).length || b.t.length - a.t.length);
      const cuantasFrase = Math.round(keywords.length * 0.4);
      const enFrase = new Set(porLargo.slice(0, cuantasFrase).map(k => k.t));
      keywords = keywords.map(k => ({ t: k.t, tipo: enFrase.has(k.t) ? 'frase' : 'exacta' }));
    }
    // TITULARES: 4 anclados + 11 que rotan (15 = tope de Google para un RSA).
    const limpiaTit = arr => dedup((Array.isArray(arr) ? arr : []).map(t => sinPuntoFinal(clean(t)).slice(0, 30)).filter(Boolean));
    let fijos = limpiaTit(g.titularesFijos).slice(0, 4);
    let rotan = limpiaTit(g.titulares).filter(t => !fijos.some(f => f.toLowerCase() === t.toLowerCase()));
    // Si la IA ignoró la separación y mandó todo junto, se parte: los 4 primeros anclan.
    if (!fijos.length && rotan.length) { fijos = rotan.slice(0, 4); rotan = rotan.slice(4); }
    rotan = rotan.slice(0, 11);
    const titulares = fijos.concat(rotan);          // compat: la consola y el CSV siguen leyendo "titulares"
    const descripciones = dedup((Array.isArray(g.descripciones) ? g.descripciones : []).map(d => clean(d).slice(0, 90)).filter(Boolean)).slice(0, 4);
    return {
      nombre: legible(g.nombre).slice(0, 60) || 'Grupo',
      intencion: clean(g.intencion).slice(0, 200),
      razonamiento: clean(g.razonamiento).slice(0, 300),
      keywords, titulares, titularesFijos: fijos, titularesRotan: rotan, descripciones,
      negativas: dedup((Array.isArray(g.negativas) ? g.negativas : []).map(kwLimpia).filter(Boolean)).slice(0, 15),
      path1: path(g.path1), path2: path(g.path2)
    };
  }).filter(g => g.keywords.length && g.titulares.length);

  if (!grupos.length) return json({ ok: false, error: 'La IA no produjo grupos de anuncios válidos. Reformula el brief (di qué vendes y a quién).' }, 500);

  // RELLENO de keywords: la IA suele quedarse corta aunque el prompt pida 20.
  // Los grupos flacos se completan con UNA llamada extra (todos a la vez),
  // manteniendo la intención de cada grupo y sin repetir lo que ya tienen.
  const MIN_KW = 20;
  const flacos = grupos.filter(g => g.keywords.length < MIN_KW);
  if (flacos.length) {
    const pedido = [
      'Eres especialista senior en Google Ads (Search). Completa las keywords de estos grupos.',
      'Devuelve EXCLUSIVAMENTE: { "grupos": [ { "nombre": "<el mismo nombre>", "keywords": [ { "t": "...", "tipo": "exacta" | "frase" } ] } ] }',
      `- De cada grupo faltan keywords hasta llegar a ${MIN_KW}. Entrega SOLO las NUEVAS.`,
      '- Misma intención del grupo. PROHIBIDO repetir o variar trivialmente las que ya tiene.',
      '- Solo "exacta" o "frase" (amplia prohibida). Minúsculas, 2 a 5 palabras, como busca la gente: singular/plural, sinónimos, "online"/"precio"/"chile" cuando aplique.',
      '- Cortas y precisas → exacta. Largas y de cola → frase.',
      refsTxt ? '\nVOCABULARIO REAL de la landing (úsalo):\n' + refsTxt.slice(0, 1500) : '',
      '\nGRUPOS:',
      ...flacos.map(g => `- "${g.nombre}" · intención: ${g.intencion || '(la del nombre)'} · faltan ${MIN_KW - g.keywords.length} · ya tiene: ${g.keywords.map(k => k.t).join(', ')}`)
    ].filter(Boolean).join('\n');
    const extra = await llamarGemini(env, pedido, 4096, 0.8, { cadena: cadenaRapida(env) });
    const lote = Array.isArray(extra.parsed && extra.parsed.grupos) ? extra.parsed.grupos : [];
    for (const g of flacos) {
      const src = lote.find(x => clean(x && x.nombre).toLowerCase() === g.nombre.toLowerCase()) || lote[flacos.indexOf(g)];
      if (!src) continue;
      const yaHay = new Set(g.keywords.map(k => k.t));
      for (const k of (Array.isArray(src.keywords) ? src.keywords : [])) {
        const t = kwLimpia(k && k.t);
        if (!t || yaHay.has(t) || g.keywords.length >= 25) continue;
        yaHay.add(t);
        g.keywords.push({ t, tipo: (k && k.tipo === 'frase') ? 'frase' : (t.split(/\s+/).length >= 4 ? 'frase' : 'exacta') });
      }
    }
  }

  // Sitelinks validados con los límites reales de Google Ads: texto ≤25,
  // descripciones ≤35. Se prefieren rutas reales de la landing.
  const sitelinks = (Array.isArray(parsed.sitelinks) ? parsed.sitelinks : []).map(s => ({
    texto: clean(s && s.texto).slice(0, 25),
    desc1: clean(s && s.desc1).slice(0, 35),
    desc2: clean(s && s.desc2).slice(0, 35),
    url: clean(s && s.url).slice(0, 200)
  })).filter(s => s.texto).slice(0, 6);

  // Segunda pasada: corrector RAE sobre los textos VISIBLES (nombres, intención,
  // titulares, descripciones y sitelinks). Las keywords NO se corrigen: la gente
  // busca sin tildes y así deben quedar. Tras corregir se re-recortan los límites.
  const planos = [legible(parsed.nombre || brief.que).slice(0, 80)];
  for (const g of grupos) { planos.push(g.nombre, g.intencion, g.razonamiento); planos.push(...g.titulares, ...g.descripciones); }
  for (const s of sitelinks) planos.push(s.texto, s.desc1, s.desc2);
  const rev = await corregirOrtografia(env, planos);
  let k = 0;
  const nombreR = String(rev.textos[k++]).slice(0, 80);
  for (const g of grupos) {
    g.nombre = String(rev.textos[k++]).slice(0, 60) || g.nombre;
    g.intencion = String(rev.textos[k++]).slice(0, 200);
    g.razonamiento = String(rev.textos[k++]).slice(0, 300);
    g.titulares = g.titulares.map(() => sinPuntoFinal(rev.textos[k++]).slice(0, 30)).filter(Boolean);
    g.descripciones = g.descripciones.map(() => String(rev.textos[k++]).slice(0, 90)).filter(Boolean);
  }
  for (const s of sitelinks) {
    s.texto = (String(rev.textos[k++]).slice(0, 25)) || s.texto;
    s.desc1 = String(rev.textos[k++]).slice(0, 35);
    s.desc2 = String(rev.textos[k++]).slice(0, 35);
  }

  return json({
    ok: true,
    nombre: nombreR,
    urlFinal: clean(brief.ctaUrl || ''),
    grupos,
    negativas: dedup((Array.isArray(parsed.negativas) ? parsed.negativas : []).map(kwLimpia).filter(Boolean)).slice(0, 25),
    sitelinks,
    ortografia: rev.revisado ? 'revisada' : 'sin-revisar'
  });
}

// Exportados SOLO para pruebas locales (Cloudflare Pages los ignora).
export { corregirOrtografia, extraerJSON, generarEmail, generarBanner, generarAds, detectarPromos, extraerEnlaces, extraerTextoPagina };
