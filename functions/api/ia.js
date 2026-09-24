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
      brief.que ? `\nCONTEXTO de la campaña: ${brief.que}` : '',
      // Lo que investigó la generación original (si la pieza lo trae guardado).
      (body.analisis && Array.isArray(body.analisis.busquedas) && body.analisis.busquedas.length) ? '\nBÚSQUEDAS REALES investigadas: ' + aLista(body.analisis.busquedas, 25, 80).join(' · ') : '',
      (body.analisis && Array.isArray(body.analisis.vocabulario) && body.analisis.vocabulario.length) ? 'VOCABULARIO DEL SITIO: ' + aLista(body.analisis.vocabulario, 25, 60).join(' · ') : '',
      (body.analisis && Array.isArray(body.analisis.noOfrece) && body.analisis.noOfrece.length) ? 'NO uses nada de esto (el producto no lo es/no lo incluye): ' + aLista(body.analisis.noOfrece, 20).join(' · ') : ''
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

  // SEARCH: dos lecturas EN PARALELO. (1) El lector propio baja la landing con
  // mucho más texto que para un banner (una campaña de Search vive del
  // vocabulario del sitio). (2) Gemini lee la URL por su cuenta —sirve también
  // con sitios armados en JavaScript— y busca en Google a la competencia.
  if (producto === 'ads') {
    const urlsAds = [brief.ctaUrl].concat(Array.isArray(brief.refs) ? brief.refs : []);
    const [refsA, inv] = await Promise.all([
      leerReferencias(urlsAds, { porPagina: 6000, total: 12000 }),
      investigarAds(env, brief, marca)
    ]);
    const avisosA = avisosDeReferencias(refsA, brief)
      // Si Gemini sí leyó la URL que el lector propio no pudo, no hay nada que avisar.
      .filter(a => !(a.tipo === 'url-no-leida' && inv.urlsLeidas.some(u => a.texto.includes(u.split('?')[0]))));
    if (!inv.ficha) avisosA.push({ tipo: 'info', texto: 'No se pudo completar el análisis de la landing y la competencia en Google (' + (inv.error || 'sin respuesta') + '). La campaña se armó solo con el texto de la página: revísala con más cuidado.' });
    return generarAds({ env, brief, marca, refsTxt: refsA.texto, promos: refsA.promos, enlaces: refsA.enlaces, avisos: avisosA, ficha: inv.ficha, fuentes: inv.fuentes });
  }

  // Lee también el SITIO DE DESTINO del anuncio (ctaUrl), no solo las URLs de referencia.
  const refs = await leerReferencias([brief.ctaUrl].concat(Array.isArray(brief.refs) ? brief.refs : []));
  const refsTxt = refs.texto, promos = refs.promos, enlaces = refs.enlaces;
  const avisos = avisosDeReferencias(refs, brief);

  if (producto === 'banner') return generarBanner({ env, brief, marca, imagenes, refsTxt, promos, estilo: body.estilo === 'marca' ? 'marca' : '', limites: body.limites || null, avisos });
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
// La frase legal la pide SIEMPRE el formulario. "no" (o "n/a", "ninguna") es una
// respuesta válida y significa que esta campaña no lleva legal — no es un campo
// vacío por descuido, es una decisión registrada.
export function legalDelBrief(brief) {
  const t = String((brief && brief.legal) || '').trim();
  if (!t) return { texto: '', declarado: false };
  if (/^(no|n\/a|na|ninguna|ninguno|sin legal)\.?$/i.test(t)) return { texto: '', declarado: true };
  return { texto: t, declarado: true };
}
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
async function leerReferencias(refs, opts) {
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
function avisosDeReferencias(refs, brief) {
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
function extraerJSON(texto) {
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
// LÍMITES DE CARACTERES: no se eligen, los calcula el cliente desde la
// geometría del formato (ancho útil ÷ cuerpo × 0,52 × líneas permitidas) y los
// manda aquí. Escribir sin ellos es lo que producía titulares que no caben, y
// entonces el sistema tenía que quitar la bajada para que la pieza cerrara.
const LIMITES_BANNER_POR_DEFECTO = { titulo: 27, cuerpo: 54, cta: 18, etiqueta: 18, burbuja: 16, legal: 27, palabra: 9 };
function limitesBanner(l) {
  const d = LIMITES_BANNER_POR_DEFECTO, o = {};
  for (const k in d) {
    const v = parseInt(l && l[k]);
    o[k] = (v && v > 3) ? Math.min(v, d[k] * 6) : d[k];
  }
  return o;
}
// Recorte por PALABRAS (nunca a mitad de palabra) como última red: si tras pedir
// el acortado el texto sigue pasándose, se corta por el último espacio que cabe.
function recortarAPalabras(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max + 1).lastIndexOf(' ');
  return (corte > max * 0.5 ? t.slice(0, corte) : t.slice(0, max)).trim();
}
// Una pasada de ACORTADO: se le pide a la IA que reescriba más corto lo que no
// cabe, conservando el significado. Es la regla 3 del manual — si el texto no
// cabe se reescribe el texto, no se estira la caja ni se corta la frase.
async function acortarAlLimite(env, campos) {
  const pasados = campos.filter(c => String(c.valor || '').length > c.max);
  if (!pasados.length) return { valores: null, acortado: false };
  const prompt = [
    'Eres redactor publicitario. Estos textos de un banner NO CABEN en su espacio.',
    'Reescríbelos MÁS CORTOS respetando el límite de caracteres de cada uno.',
    'Conserva el significado, la oferta y las cifras EXACTAS. No inventes datos. No pongas punto final en titulares.',
    'Ninguna palabra debe superar ' + (campos[0].palabra || 9) + ' caracteres si se puede evitar.',
    'Devuelve EXCLUSIVAMENTE: { "textos": [ ... ] } en el MISMO orden.',
    JSON.stringify({ textos: pasados.map(c => ({ texto: c.valor, maximoCaracteres: c.max })) })
  ].join('\n');
  const { parsed } = await llamarGemini(env, prompt, 1024, 0.4);
  const out = {};
  pasados.forEach((c, i) => {
    const nuevo = parsed && Array.isArray(parsed.textos) ? String(parsed.textos[i] == null ? '' : parsed.textos[i]) : '';
    out[c.clave] = recortarAPalabras(nuevo && nuevo.length <= c.max ? nuevo : c.valor, c.max);
  });
  return { valores: out, acortado: true };
}
async function generarBanner({ env, brief, marca, imagenes, refsTxt, promos, estilo, limites, avisos }) {
  const LIM = limitesBanner(limites);
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
    'MAL  → "Te ofrecemos la mejor cobertura del mercado"   (habla la empresa, genérico, sirve para cualquiera)',
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
    // El espacio de la pieza está medido: escribir por encima del límite obliga
    // al sistema a quitar elementos para que el banner cierre.
    '',
    'ESPACIO DISPONIBLE — LÍMITES DUROS DE CARACTERES (cuéntalos, no los estimes):',
    `- titular: máximo ${LIM.titulo} caracteres.`,
    `- cuerpo (bajada): máximo ${LIM.cuerpo} caracteres, UNA sola idea.`,
    `- cta: máximo ${LIM.cta} caracteres.`,
    `- etiqueta (nombre del producto): máximo ${LIM.etiqueta} caracteres.`,
    `- burbuja (la oferta): máximo ${LIM.burbuja} caracteres.`,
    `- Ninguna palabra del titular debe pasar de ${LIM.palabra} caracteres: en los tamaños chicos la columna es angosta y una palabra más larga obliga a encoger la letra.`,
    'Si tu mejor titular no cabe, escribe otro más corto. NO se puede ensanchar la pieza.',
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
    imagen: (typeof parsed.imagen === 'string' && /^https?:\/\//.test(parsed.imagen)) ? parsed.imagen : '',
    // La frase legal la escribe el usuario en el formulario (obligatoria); "no"
    // significa que esta campaña no lleva. La IA NO la inventa nunca.
    legal: legalDelBrief(brief).texto,
    legalDeclarado: legalDelBrief(brief).declarado
  };
  if (!out.zonas.titular && !out.zonas.cuerpo) return json({ ok: false, error: 'La IA no produjo textos. Reformula el brief.' }, 500);
  // Segunda pasada: corrector ortográfico RAE sobre todo texto visible.
  const rev = await corregirOrtografia(env, [out.nombre, out.zonas.etiqueta, out.zonas.titular, out.zonas.cuerpo, out.zonas.cta, out.burbuja]);
  out.nombre = String(rev.textos[0]).slice(0, 80);
  out.zonas = { etiqueta: limpia(rev.textos[1], 3), titular: sinPuntoFinal(limpia(rev.textos[2], 8)), cuerpo: limpia(rev.textos[3], 18), cta: limpia(rev.textos[4], 4) };
  out.burbuja = (brief.gancho || (promos && promos.length)) ? limpia(rev.textos[5], 5) : '';
  out.ortografia = rev.revisado ? 'revisada' : 'sin-revisar';
  // Tercera pasada: lo que no CABE se reescribe más corto (regla 3 del manual).
  const ac = await acortarAlLimite(env, [
    { clave: 'titular',  valor: out.zonas.titular,  max: LIM.titulo,   palabra: LIM.palabra },
    { clave: 'cuerpo',   valor: out.zonas.cuerpo,   max: LIM.cuerpo,   palabra: LIM.palabra },
    { clave: 'cta',      valor: out.zonas.cta,      max: LIM.cta },
    { clave: 'etiqueta', valor: out.zonas.etiqueta, max: LIM.etiqueta },
    { clave: 'burbuja',  valor: out.burbuja,        max: LIM.burbuja }
  ]);
  if (ac.valores) {
    if (ac.valores.titular  !== undefined) out.zonas.titular  = sinPuntoFinal(ac.valores.titular);
    if (ac.valores.cuerpo   !== undefined) out.zonas.cuerpo   = ac.valores.cuerpo;
    if (ac.valores.cta      !== undefined) out.zonas.cta      = ac.valores.cta;
    if (ac.valores.etiqueta !== undefined) out.zonas.etiqueta = ac.valores.etiqueta;
    if (ac.valores.burbuja  !== undefined) out.burbuja        = ac.valores.burbuja;
  }
  out.limites = LIM;
  out.acortado = !!ac.acortado;
  if (avisos && avisos.length) out.avisos = avisos;
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
    'MAL  → "Nos complace presentarte nuestra nueva cobertura"  (comunicado, habla la empresa)',
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
  const cNavy  = P.secondary || P.primary || '#040764';   // banda oscura
  const cClaro = P.bg || '#ffffff';                        // banda clara
  const cTexto = P.text || '#040764';
  const cAcento = P.accent1 || P.primary || '#1C73CB';     // banda de oferta
  const cBoton = P.cta || P.primary || '#1C73CB';
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
// ══════════════════════════════════════════════════════════════════════════
// GOOGLE SEARCH — pipeline en etapas (sep-2026)
//
// Antes era UNA llamada: la IA leía 2.500 caracteres de la landing, no sabía
// nada de la competencia y escribía los anuncios que escribiría cualquiera.
// Ahora:
//   1. INVESTIGAR  (investigarAds): Gemini lee la landing por su cuenta y busca
//      en Google a la competencia. Sale una FICHA: beneficios con cifras reales,
//      pruebas, objeciones, cómo busca la gente, lo que el producto NO es (base
//      de las negativas) y los mensajes que todos repiten (lo que NO sirve).
//   2. ESTRUCTURAR (generarAds): grupos por intención, keywords, anuncios y
//      negativas CON MOTIVO, escritos desde la ficha.
//   3. CRITICAR   (criticarAnuncios): un editor reescribe lo genérico.
//   4. FILTROS DUROS del servidor: frases trilladas fuera, cifras que no están
//      en ninguna fuente fuera, negativas que bloquearían keywords propias fuera.
//   5. Ortografía.
// ══════════════════════════════════════════════════════════════════════════

const aLista = (v, n, largo) => (Array.isArray(v) ? v : []).map(x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, n).map(x => x.slice(0, largo || 200));

async function investigarAds(env, brief, marca) {
  const url = /^https?:\/\//i.test(brief.ctaUrl || '') ? String(brief.ctaUrl).trim() : '';
  const refs = (Array.isArray(brief.refs) ? brief.refs : []).filter(u => /^https?:\/\//i.test(u || '') && u !== url).slice(0, 2);
  const nombreMarca = marca ? (marca.nombre || marca.empresa || '') : '';
  const prompt = [
    'Eres analista senior de marketing de búsqueda (Google Ads) en Chile. Investiga ANTES de que se escriba una campaña de Search. Todavía no escribes anuncios.',
    '',
    encargoDelUsuario(brief),
    nombreMarca ? `MARCA: ${nombreMarca}${marca.negocio ? ' — ' + marca.negocio : ''}` : '',
    '',
    'TAREAS:',
    url ? `1. LEE la landing ${url}${refs.length ? ' y también ' + refs.join(' , ') : ''}. Extrae SOLO lo que la página dice de verdad: producto, beneficios, cifras, coberturas, precios, plazos, condiciones, pruebas (años, clientes, premios, respaldo).`
        : '1. No hay landing: usa el encargo y lo que encuentres en Google sobre la marca.',
    '2. BUSCA en Google (resultados de Chile) cómo busca la gente este producto y quiénes compiten por esas búsquedas. Identifica 3 a 6 competidores y qué promete cada uno en sus anuncios y páginas.',
    '3. Detecta los MENSAJES GENÉRICOS que repiten todos (no sirven para diferenciar) y los ÁNGULOS DIFERENCIALES que esta marca tiene con respaldo en su landing y la competencia no usa.',
    '4. Piensa en las búsquedas que NO queremos pagar: lo que el producto NO es o no incluye, significados confundibles, productos parecidos que no se venden aquí.',
    '',
    'Devuelve SOLO este JSON (sin texto antes ni después):',
    '{',
    '  "leyoLanding": true,',
    '  "producto": "qué se vende exactamente (nombre tal como lo usa el sitio)",',
    '  "categoria": "categoría de búsqueda",',
    '  "propuestaValor": "la promesa central de la landing en 1 frase",',
    '  "beneficios": ["beneficios CONCRETOS, con la cifra tal como aparece si la hay"],',
    '  "pruebas": ["datos verificables: años, clientes, calificaciones, respaldos, coberturas con monto"],',
    '  "ofertas": ["promociones vigentes TEXTUALES"],',
    '  "condiciones": ["requisitos o restricciones importantes"],',
    '  "publico": "a quién le habla",',
    '  "objeciones": ["dudas o miedos del cliente antes de contratar/comprar"],',
    '  "vocabulario": ["términos exactos que usa el sitio"],',
    '  "busquedas": ["12 a 20 consultas reales que escribe la gente en Chile para encontrar esto"],',
    '  "noOfrece": ["lo que el producto NO es o NO incluye, y con qué se confunde"],',
    '  "competidores": [{"nombre": "...", "promesa": "qué prometen"}],',
    '  "mensajesGenericos": ["frases/promesas que usan todos en la categoría"],',
    '  "angulosDiferenciales": ["ángulos propios de la marca, respaldados por su landing"]',
    '}',
    'REGLAS: nada inventado. Si un dato no está en la landing ni en Google, no lo pongas. Las cifras van TEXTUALES. Si no pudiste leer la landing, "leyoLanding": false.'
  ].filter(Boolean).join('\n');

  const intentos = url ? [[{ url_context: {} }, { google_search: {} }], [{ google_search: {} }]] : [[{ google_search: {} }]];
  let ultimoError = '';
  for (const tools of intentos) {
    const r = await llamarGemini(env, prompt, 4096, 0.3, { cadena: cadenaCopy(env), tools, pensar: -1, timeout: 60000 });
    if (r.error || !r.parsed || typeof r.parsed !== 'object') { ultimoError = r.error || 'respuesta vacía'; continue; }
    const f = r.parsed;
    const ficha = {
      leyoLanding: f.leyoLanding !== false && (!url || (r.urlsLeidas || []).length > 0 || tools.length === 1),
      producto: String(f.producto || '').slice(0, 160),
      categoria: String(f.categoria || '').slice(0, 120),
      propuestaValor: String(f.propuestaValor || '').slice(0, 300),
      beneficios: aLista(f.beneficios, 12), pruebas: aLista(f.pruebas, 10), ofertas: aLista(f.ofertas, 6),
      condiciones: aLista(f.condiciones, 8), publico: String(f.publico || '').slice(0, 200),
      objeciones: aLista(f.objeciones, 8), vocabulario: aLista(f.vocabulario, 25, 60),
      busquedas: aLista(f.busquedas, 25, 80), noOfrece: aLista(f.noOfrece, 20),
      competidores: (Array.isArray(f.competidores) ? f.competidores : []).slice(0, 6)
        .map(c => ({ nombre: String((c && c.nombre) || '').slice(0, 60), promesa: String((c && c.promesa) || '').slice(0, 200) })).filter(c => c.nombre),
      mensajesGenericos: aLista(f.mensajesGenericos, 12), angulosDiferenciales: aLista(f.angulosDiferenciales, 8)
    };
    if (!ficha.producto && !ficha.beneficios.length) { ultimoError = 'la ficha llegó vacía'; continue; }
    return { ficha, urlsLeidas: r.urlsLeidas || [], fuentes: r.fuentes || [] };
  }
  return { ficha: null, urlsLeidas: [], fuentes: [], error: ultimoError };
}

function fichaTexto(f) {
  if (!f) return '';
  const l = (t, a) => a && a.length ? `${t}:\n${a.map(x => '  - ' + x).join('\n')}` : '';
  return [
    f.producto && `PRODUCTO: ${f.producto}${f.categoria ? ' (categoría: ' + f.categoria + ')' : ''}`,
    f.propuestaValor && `PROPUESTA DE VALOR: ${f.propuestaValor}`,
    f.publico && `PÚBLICO: ${f.publico}`,
    l('BENEFICIOS CONCRETOS (materia prima de titulares y descripciones)', f.beneficios),
    l('PRUEBAS / DATOS VERIFICABLES', f.pruebas),
    l('OFERTAS VIGENTES (textuales)', f.ofertas),
    l('CONDICIONES', f.condiciones),
    l('OBJECIONES DEL CLIENTE (respóndelas en los anuncios)', f.objeciones),
    l('VOCABULARIO REAL DEL SITIO', f.vocabulario),
    l('CÓMO BUSCA LA GENTE (base de las keywords)', f.busquedas),
    l('LO QUE NO ES / NO INCLUYE (base de las negativas)', f.noOfrece),
    f.competidores && f.competidores.length ? 'COMPETIDORES EN GOOGLE:\n' + f.competidores.map(c => `  - ${c.nombre}: ${c.promesa}`).join('\n') : '',
    l('MENSAJES GENÉRICOS QUE USAN TODOS (PROHIBIDO construir anuncios sobre esto)', f.mensajesGenericos),
    l('ÁNGULOS DIFERENCIALES DE ESTA MARCA (úsalos)', f.angulosDiferenciales)
  ].filter(Boolean).join('\n');
}

// Frases trilladas que no diferencian a nadie. Se comparan sin tildes.
const CLICHES_ADS = [
  'los mejores precios', 'mejor precio del mercado', 'precios competitivos', 'calidad garantizada',
  'rapido y facil', 'facil y rapido', 'rapido, facil', 'rapido facil y seguro', 'la mejor opcion',
  'no esperes mas', 'haz clic aqui', 'click aqui', 'somos lideres', 'soluciones integrales',
  'excelente servicio', 'servicio de calidad', 'amplia experiencia', 'la mejor calidad',
  'todo lo que necesitas', 'tu mejor aliado', 'confia en nosotros', 'esta campana', 'este anuncio'
];
const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esCliche = s => { const t = sinTildes(s); return CLICHES_ADS.some(c => t.includes(c)); };
// Cifras de un texto, normalizadas ("$9.990" y "9990" son la misma).
const cifrasDe = s => (String(s || '').match(/\d+(?:[.,]\d+)*/g) || []).map(n => n.replace(/[.,]/g, '')).filter(n => n.length);

async function criticarAnuncios(env, grupos, ficha, marca) {
  const entrada = grupos.map((g, i) => ({ i, grupo: g.nombre, intencion: g.intencion, titularesFijos: g.titularesFijos, titulares: g.titularesRotan, descripciones: g.descripciones }));
  const prompt = [
    `Eres director creativo de performance y revisas anuncios RSA de Google Search${marca ? ' de ' + (marca.nombre || marca.empresa) : ''} antes de publicarlos. Tu trabajo es MATAR LO GENÉRICO.`,
    '',
    'PRUEBA DEL COMPETIDOR: si cambias la marca por un competidor y el texto sigue siendo verdad, es genérico → REESCRÍBELO con un dato concreto de la ficha (beneficio con cifra, prueba, oferta, objeción respondida, ángulo diferencial).',
    'También reescribe: frases trilladas ("rápido y fácil", "los mejores precios", "calidad garantizada", "atención personalizada"...), titulares que dicen lo mismo con otras palabras, descripciones sin un dato concreto, y todo lo que hable del anuncio en vez de al cliente.',
    'Lo que ya es específico y bueno, DÉJALO IGUAL.',
    'LÍMITES DUROS: titulares ≤30 caracteres (con espacios), descripciones ≤90. Titulares sin punto final. Español de Chile correcto.',
    'PROHIBIDO inventar cifras, precios, plazos o premios que no estén en la ficha.',
    'Mantén la MISMA cantidad de textos en cada lista y el orden de los titularesFijos (1 marca/producto, 2 keyword, 3 beneficio u oferta, 4 llamada a la acción).',
    '',
    'FICHA DEL PRODUCTO Y LA COMPETENCIA:',
    fichaTexto(ficha) || '(sin ficha)',
    '',
    'ANUNCIOS A REVISAR:',
    JSON.stringify(entrada),
    '',
    'Devuelve SOLO: { "grupos": [ { "i": 0, "titularesFijos": [...], "titulares": [...], "descripciones": [...] } ] }'
  ].join('\n');
  const r = await llamarGemini(env, prompt, 6144, 0.6, { cadena: cadenaCopy(env), pensar: -1, timeout: 70000 });
  return Array.isArray(r.parsed && r.parsed.grupos) ? r.parsed.grupos : null;
}

async function generarAds({ env, brief, marca, refsTxt, promos, enlaces, avisos, ficha, fuentes }) {
  avisos = Array.isArray(avisos) ? avisos : [];
  const fTxt = fichaTexto(ficha);
  const prompt = [
    `Eres un especialista senior en Google Ads (Search) de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}, con 10 años gestionando cuentas en Chile. Estructuras por INTENCIÓN de búsqueda, con concordancias controladas y negativas razonadas. Detestas la concordancia amplia y los anuncios intercambiables con los de la competencia.`,
    '',
    encargoDelUsuario(brief),
    '',
    fTxt ? '════ INVESTIGACIÓN PREVIA (landing leída + competencia en Google) — TU MATERIA PRIMA ════\n' + fTxt + '\n══════════════════════════════════════════════════' : '',
    '',
    'Devuelve EXCLUSIVAMENTE este JSON (sin texto extra):',
    '{',
    '  "nombre": "nombre corto de la campaña",',
    '  "grupos": [',
    '    {',
    '      "nombre": "nombre del grupo de anuncios",',
    '      "intencion": "qué busca la persona que escribe estas keywords (1 frase)",',
    '      "razonamiento": "por qué agrupaste así y qué esperas de este grupo (1-2 frases)",',
    '      "angulo": "el ángulo diferencial que usan los anuncios de este grupo frente a la competencia",',
    '      "keywords": [ { "t": "keyword en minúsculas", "tipo": "exacta" | "frase" } ],',
    '      "negativas": [ { "t": "término", "motivo": "por qué se excluye en este grupo" } ],',
    '      "titularesFijos": [ "4 titulares ANCLADOS, ≤30 caracteres cada uno" ],',
    '      "titulares": [ "11 titulares que ROTAN, ≤30 caracteres cada uno" ],',
    '      "descripciones": [ "4 descripciones, ≤90 caracteres cada una" ],',
    '      "path1": "ruta-1", "path2": "ruta-2"',
    '    }',
    '  ],',
    '  "negativas": [ { "t": "término negativo de campaña", "motivo": "por qué NO queremos pagar esa búsqueda en ESTE negocio" } ],',
    '  "sitelinks": [ { "texto": "≤25 caracteres", "desc1": "≤35 caracteres", "desc2": "≤35 caracteres", "url": "ruta REAL de la landing (ej. /cotizar)" } ]',
    '}',
    '',
    'ESTRUCTURA Y KEYWORDS:',
    '- "nombre" de la campaña y de cada grupo: LEGIBLES, con espacios y tildes (ej. "Cotizar seguro auto"), nunca en formato slug.',
    '- 2 a 4 grupos. Cada grupo = UNA intención (ej.: contratar/cotizar ya · comparar/precio · necesidad o problema · marca). No mezcles "cotizar" con "qué es".',
    '- Por grupo: 20 a 25 keywords, tomadas de CÓMO BUSCA LA GENTE y del VOCABULARIO REAL de la investigación. Nada que esté en "lo que NO es".',
    '- "tipo" SOLO "exacta" o "frase" (amplia PROHIBIDA). Exacta = búsquedas cortas y precisas (2-3 palabras); frase = variantes largas (4-5 palabras). Mínimo 30% de cada tipo por grupo.',
    '- Minúsculas, sin corchetes ni comillas, 2 a 5 palabras, como escribe la gente de verdad (con y sin tildes, singular/plural, "precio", "cotizar", "online", "chile" solo cuando alguien lo escribiría).',
    '',
    'ANUNCIOS (aquí se gana o se pierde):',
    '- PRUEBA DEL COMPETIDOR: si cambias la marca por un competidor y el titular sigue siendo verdad, es genérico y NO sirve. Cada anuncio se construye sobre beneficios con cifra, pruebas, ofertas, objeciones y ángulos diferenciales de la INVESTIGACIÓN.',
    '- PROHIBIDO construir sobre los "mensajes genéricos que usan todos" y las frases trilladas: "los mejores precios", "calidad garantizada", "rápido y fácil", "atención personalizada", "la mejor opción", "no esperes más", "somos líderes", "amplia experiencia".',
    '- 15 titulares, TODOS ≤30 caracteres (con espacios), únicos, sin punto final:',
    '  · "titularesFijos" (exactamente 4, en este orden, van anclados): 1) marca o producto, 2) la keyword principal del grupo casi literal, 3) el beneficio u oferta más fuerte, 4) llamada a la acción específica (no "Haz clic aquí").',
    '  · "titulares" (exactamente 11, rotan): 2 con variantes de la keyword del grupo · 3 beneficios concretos con dato · 2 pruebas/confianza con dato real · 1 que responda la objeción principal · 2 del ángulo diferencial · 1 oferta o CTA alternativa. Ninguno repite ni parafrasea a otro.',
    '- 4 descripciones ≤90 caracteres, cada una con un ángulo distinto: (1) beneficio principal + dato + CTA, (2) respuesta a una objeción, (3) prueba/confianza, (4) diferencial frente a la competencia u oferta. Una sola idea por descripción, con un dato concreto. Termina con punto.',
    '- El anuncio le habla AL CLIENTE, jamás habla del anuncio o de la campaña. No repitas la misma keyword más de 2 veces en un anuncio.',
    '- CIFRAS: SOLO las que aparecen en la investigación, la landing o el encargo, TEXTUALES. Una cifra inventada invalida el anuncio.',
    '- "path1"/"path2": ≤15 caracteres, minúsculas, con guiones, relacionados con el grupo.',
    '- "sitelinks": 4 a 6 de la MISMA landing; usa los enlaces internos reales listados abajo (no inventes rutas). Texto ≤25, descripciones ≤35.',
    (promos && promos.length) ? `- Promociones detectadas en la landing: ${promos.join(' · ')}. Úsalas TAL CUAL en 2-3 titulares y 1 descripción del grupo más transaccional.` : '',
    '',
    'NEGATIVAS (razonadas para ESTE negocio, no una lista de plantilla):',
    '- De campaña: 15 a 30, cada una con su "motivo". Sácalas de: lo que el producto NO es/no incluye, significados confundibles del término principal, productos vecinos que no se venden, búsquedas de empleo/postulación, de formación, de trámites que hace otra entidad, y búsquedas informativas si la campaña es de conversión.',
    '- PROHIBIDO poner negativas "por costumbre": cada motivo debe explicar por qué esa búsqueda llega a ESTE negocio y no convierte. Si el motivo serviría para cualquier empresa, piénsalo otra vez.',
    '- Una negativa NUNCA puede bloquear una keyword propia (si una keyword contiene la palabra, esa negativa está mal).',
    '- Las marcas de la competencia NO van como negativas salvo que el encargo lo pida.',
    '- Por grupo: 3 a 10 negativas que eviten que el grupo capture la intención de OTRO grupo o búsquedas que no calzan con su intención.',
    '',
    'VOZ DE MARCA:',
    voorMarca(marca),
    refsTxt ? '\nTEXTO DE LA LANDING (evidencia original; usa su vocabulario y datos, no copies frases largas):\n' + refsTxt : '',
    (enlaces && enlaces.length) ? '\nENLACES INTERNOS REALES de la landing (candidatos a sitelinks, "texto → ruta"):\n' + enlaces.map(e => `- ${e.texto} → ${e.ruta}`).join('\n') : '',
    '',
    'BRIEF:',
    reglasBrief(brief, promos, 'ads'),
    brief.ctaUrl ? `URL FINAL de los anuncios (landing): ${brief.ctaUrl}` : '',
    '- Español de Chile. Respeta el tono y las palabras de la marca.'
  ].filter(Boolean).join('\n');

  const { parsed, error } = await llamarGemini(env, prompt, 8192, 0.8, { cadena: cadenaCopy(env), pensar: -1 });
  if (error) return json({ ok: false, error }, 500);

  // ── Validación dura del lado del servidor ──────────────────────────────
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const legible = s => { s = clean(s); return (!/\s/.test(s) && /-/.test(s)) ? s.replace(/-+/g, ' ') : s; };
  const dedup = arr => { const seen = new Set(); return arr.filter(x => { const k = x.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
  const kwLimpia = s => clean(s).toLowerCase().replace(/^[\[\"'+-]+|[\]\"']+$/g, '').trim();
  const path = s => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 15);
  // Negativas: aceptan string u objeto {t, motivo}. Se guardan los motivos aparte
  // (la consola, el XLSX y los CSV siguen leyendo una lista de strings).
  const motivos = {};
  const negs = (arr, n) => dedup((Array.isArray(arr) ? arr : []).map(x => {
    const t = kwLimpia(x && typeof x === 'object' ? x.t : x);
    const m = x && typeof x === 'object' ? clean(x.motivo).slice(0, 200) : '';
    if (t && m && !motivos[t]) motivos[t] = m;
    return t;
  }).filter(Boolean)).slice(0, n);

  const gruposIn = Array.isArray(parsed && parsed.grupos) ? parsed.grupos.slice(0, 5) : [];
  const limpiaTit = arr => dedup((Array.isArray(arr) ? arr : []).map(t => sinPuntoFinal(clean(t)).slice(0, 30)).filter(Boolean));
  const grupos = gruposIn.map(g => {
    const seenK = new Set();
    let keywords = (Array.isArray(g.keywords) ? g.keywords : []).map(k => ({
      t: kwLimpia(k && (typeof k === 'object' ? k.t : k)),
      tipo: (k && k.tipo === 'frase') ? 'frase' : 'exacta'   // amplia jamás
    })).filter(k => k.t && !seenK.has(k.t) && (seenK.add(k.t), true)).slice(0, 25);
    let fijos = limpiaTit(g.titularesFijos).slice(0, 4);
    let rotan = limpiaTit(g.titulares).filter(t => !fijos.some(f => f.toLowerCase() === t.toLowerCase()));
    if (!fijos.length && rotan.length) { fijos = rotan.slice(0, 4); rotan = rotan.slice(4); }
    rotan = rotan.slice(0, 11);
    const descripciones = dedup((Array.isArray(g.descripciones) ? g.descripciones : []).map(d => clean(d).slice(0, 90)).filter(Boolean)).slice(0, 4);
    const angulo = clean(g.angulo).slice(0, 200);
    return {
      nombre: legible(g.nombre).slice(0, 60) || 'Grupo',
      intencion: clean(g.intencion).slice(0, 200),
      razonamiento: clean(g.razonamiento).slice(0, 300),
      angulo,
      keywords, titulares: fijos.concat(rotan), titularesFijos: fijos, titularesRotan: rotan, descripciones,
      negativas: negs(g.negativas, 15),
      path1: path(g.path1), path2: path(g.path2)
    };
  }).filter(g => g.keywords.length && g.titulares.length);

  if (!grupos.length) return json({ ok: false, error: 'La IA no produjo grupos de anuncios válidos. Reformula el brief (di qué vendes y a quién).' }, 500);

  // ── Etapa 3, en PARALELO: relleno de keywords de los grupos flacos + crítico ──
  const MIN_KW = 20;
  const flacos = grupos.filter(g => g.keywords.length < MIN_KW);
  const relleno = flacos.length ? llamarGemini(env, [
    'Eres especialista senior en Google Ads (Search). Completa las keywords de estos grupos.',
    'Devuelve EXCLUSIVAMENTE: { "grupos": [ { "nombre": "<el mismo nombre>", "keywords": [ { "t": "...", "tipo": "exacta" | "frase" } ] } ] }',
    `- De cada grupo faltan keywords hasta llegar a ${MIN_KW}. Entrega SOLO las NUEVAS.`,
    '- Misma intención del grupo. PROHIBIDO repetir o variar trivialmente las que ya tiene.',
    '- Solo "exacta" o "frase" (amplia prohibida). Minúsculas, 2 a 5 palabras, como busca la gente en Chile.',
    ficha && ficha.busquedas.length ? '\nBÚSQUEDAS REALES investigadas:\n' + ficha.busquedas.join(' · ') : '',
    ficha && ficha.noOfrece.length ? '\nNO uses nada de esto (el producto no lo es/no lo incluye):\n' + ficha.noOfrece.join(' · ') : '',
    refsTxt ? '\nVOCABULARIO REAL de la landing:\n' + refsTxt.slice(0, 2500) : '',
    '\nGRUPOS:',
    ...flacos.map(g => `- "${g.nombre}" · intención: ${g.intencion || '(la del nombre)'} · faltan ${MIN_KW - g.keywords.length} · ya tiene: ${g.keywords.map(k => k.t).join(', ')}`)
  ].filter(Boolean).join('\n'), 4096, 0.8, { cadena: cadenaRapida(env) }) : Promise.resolve(null);
  const critica = criticarAnuncios(env, grupos, ficha, marca).catch(() => null);
  const [extra, revisados] = await Promise.all([relleno, critica]);

  if (extra && extra.parsed && Array.isArray(extra.parsed.grupos)) {
    const lote = extra.parsed.grupos;
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

  // El crítico solo reemplaza un texto si su versión respeta los límites.
  let reescritos = 0;
  if (revisados) {
    for (const rv of revisados) {
      const g = grupos[Number(rv && rv.i)];
      if (!g) continue;
      const aplicar = (orig, nuevos, max, esTit) => orig.map((o, i) => {
        let n = Array.isArray(nuevos) ? clean(nuevos[i]) : '';
        if (esTit) n = sinPuntoFinal(n);
        if (!n || n.length > max || n === o) return o;
        reescritos++; return n;
      });
      g.titularesFijos = aplicar(g.titularesFijos, rv.titularesFijos, 30, true);
      g.titularesRotan = aplicar(g.titularesRotan, rv.titulares, 30, true);
      g.descripciones = aplicar(g.descripciones, rv.descripciones, 90, false);
    }
  }

  // ── Etapa 4: filtros duros ──────────────────────────────────────────────
  // Cifras permitidas = las que aparecen en alguna fuente (encargo, landing, ficha, marca).
  const fuentesTxt = [brief.que, brief.gancho, brief.notas, brief.accion, refsTxt, JSON.stringify(ficha || {}), (promos || []).join(' '),
    marca ? [marca.nombre, marca.empresa, marca.negocio, marca.productos, marca.eslogan, marca.directrices].join(' ') : ''].join(' ');
  const permitidas = new Set(cifrasDe(fuentesTxt));
  const inventada = s => cifrasDe(s).some(n => !permitidas.has(n));
  let descartados = 0;
  const mantener = (arr, minimo, malo) => {
    const out = arr.slice();
    for (let i = out.length - 1; i >= 0 && out.length > minimo; i--) if (malo(out[i])) { out.splice(i, 1); descartados++; }
    return out;
  };
  for (const g of grupos) {
    const malo = t => esCliche(t) || inventada(t);
    g.titularesRotan = mantener(dedup(g.titularesRotan), 5, malo);
    // Un titular fijo malo se reemplaza por el primer rotativo bueno.
    g.titularesFijos = g.titularesFijos.map(f => {
      if (!malo(f)) return f;
      const k = g.titularesRotan.findIndex(t => !malo(t));
      if (k < 0) return f;
      descartados++;
      return g.titularesRotan.splice(k, 1)[0];
    });
    g.titularesRotan = g.titularesRotan.filter(t => !g.titularesFijos.some(f => f.toLowerCase() === t.toLowerCase()));
    g.descripciones = mantener(dedup(g.descripciones), 2, malo);
    g.titulares = g.titularesFijos.concat(g.titularesRotan);
  }
  if (descartados) avisos.push({ tipo: 'info', texto: `Se descartaron ${descartados} textos de anuncio con frases trilladas o cifras que no aparecen en la landing ni en tu encargo.` });

  // Negativas de campaña + motivos. Una negativa que está contenida en una
  // keyword propia bloquearía esa keyword: se saca.
  let negCampana = negs(parsed.negativas, 30);
  const todasKw = grupos.flatMap(g => g.keywords.map(k => ' ' + k.t + ' '));
  const bloquea = n => todasKw.some(k => k.includes(' ' + n + ' '));
  const conflictos = negCampana.filter(bloquea).concat(grupos.flatMap(g => g.negativas.filter(n => g.keywords.some(k => (' ' + k.t + ' ').includes(' ' + n + ' ')))));
  negCampana = negCampana.filter(n => !bloquea(n));
  for (const g of grupos) g.negativas = g.negativas.filter(n => !g.keywords.some(k => (' ' + k.t + ' ').includes(' ' + n + ' ')));
  if (conflictos.length) avisos.push({ tipo: 'info', texto: `Se quitaron ${conflictos.length} negativas que habrían bloqueado keywords de la propia campaña (${conflictos.slice(0, 4).join(', ')}).` });

  const sitelinks = (Array.isArray(parsed.sitelinks) ? parsed.sitelinks : []).map(s => ({
    texto: clean(s && s.texto).slice(0, 25), desc1: clean(s && s.desc1).slice(0, 35),
    desc2: clean(s && s.desc2).slice(0, 35), url: clean(s && s.url).slice(0, 200)
  })).filter(s => s.texto && !esCliche(s.texto)).slice(0, 6);

  // ── Etapa 5: corrector RAE sobre los textos VISIBLES. Las keywords NO se
  // corrigen: la gente busca sin tildes y así deben quedar.
  const planos = [legible(parsed.nombre || brief.que).slice(0, 80)];
  for (const g of grupos) { planos.push(g.nombre, g.intencion, g.razonamiento, g.angulo); planos.push(...g.titularesFijos, ...g.titularesRotan, ...g.descripciones); }
  for (const s of sitelinks) planos.push(s.texto, s.desc1, s.desc2);
  const rev = await corregirOrtografia(env, planos);
  let k = 0;
  const nombreR = String(rev.textos[k++]).slice(0, 80);
  for (const g of grupos) {
    g.nombre = String(rev.textos[k++]).slice(0, 60) || g.nombre;
    g.intencion = String(rev.textos[k++]).slice(0, 200);
    g.razonamiento = String(rev.textos[k++]).slice(0, 300);
    g.angulo = String(rev.textos[k++]).slice(0, 200);
    const tit = t => sinPuntoFinal(t).slice(0, 30);
    g.titularesFijos = g.titularesFijos.map(() => tit(rev.textos[k++])).filter(Boolean);
    g.titularesRotan = g.titularesRotan.map(() => tit(rev.textos[k++])).filter(Boolean);
    g.titulares = g.titularesFijos.concat(g.titularesRotan);
    g.descripciones = g.descripciones.map(() => String(rev.textos[k++]).slice(0, 90)).filter(Boolean);
    // El ángulo se ve en la consola junto al razonamiento del grupo.
    if (g.angulo && !g.razonamiento.includes(g.angulo)) g.razonamiento = (g.razonamiento + ' Ángulo: ' + g.angulo).trim().slice(0, 420);
  }
  for (const s of sitelinks) {
    s.texto = (String(rev.textos[k++]).slice(0, 25)) || s.texto;
    s.desc1 = String(rev.textos[k++]).slice(0, 35);
    s.desc2 = String(rev.textos[k++]).slice(0, 35);
  }

  const negMotivos = {};
  for (const n of negCampana.concat(grupos.flatMap(g => g.negativas))) if (motivos[n]) negMotivos[n] = motivos[n];

  return json({
    ok: true,
    nombre: nombreR,
    urlFinal: clean(brief.ctaUrl || ''),
    grupos,
    negativas: negCampana,
    negativasMotivos: negMotivos,
    sitelinks,
    analisis: ficha ? {
      producto: ficha.producto, propuestaValor: ficha.propuestaValor,
      competidores: ficha.competidores, mensajesGenericos: ficha.mensajesGenericos,
      angulosDiferenciales: ficha.angulosDiferenciales, objeciones: ficha.objeciones,
      busquedas: ficha.busquedas, vocabulario: ficha.vocabulario, noOfrece: ficha.noOfrece,
      leyoLanding: ficha.leyoLanding, fuentes: (fuentes || []).slice(0, 10), reescritos
    } : null,
    avisos,
    ortografia: rev.revisado ? 'revisada' : 'sin-revisar'
  });
}

// Exportados SOLO para pruebas locales (Cloudflare Pages los ignora).
export { corregirOrtografia, extraerJSON, generarEmail, generarBanner, generarAds, investigarAds, detectarPromos, extraerEnlaces, extraerTextoPagina };
