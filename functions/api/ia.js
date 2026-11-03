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
//
// ESTE ARCHIVO ES SOLO LA PUERTA (/api/ia): permisos, tope de uso y el reparto por
// producto/modo. El trabajo de cada función vive en functions/api/ia/:
//   comun.js       Gemini, voz de marca, encargo, legal, URLs, ortografía (lo comparten todas)
//   display.js     banners de Google Display y Facebook (generarBanner)
//   search.js      Google Search: investigación, campaña, crítico, diagnóstico, corregir/investigar
//   documentos.js  email (piezas guardadas)

import { corsPreflight, getUserEmail, json, getSesion, tienePermiso, leerUsoIA, sumarUsoIA } from './_shared.js';
import { avisosDeReferencias, cadenaCopy, cadenaRapida, corregirOrtografia, encargoDelUsuario, leerReferencias, llamarGemini, reglasBrief, voorMarca } from './ia/comun.js';
import { aLista, diagnosticarCampana, generarAds, investigarAds, modoCampana, modoCorregir, modoInvestigar } from './ia/search.js';
import { generarBanner } from './ia/display.js';
import { generarEmail } from './ia/documentos.js';

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
                 : ['mas-keywords', 'diagnostico', 'campana', 'corregir', 'investigar'].includes(body.modo) ? 'ads'
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

  // Modo "diagnostico": revisa una campaña de Search que YA corre (capturas,
  // informes exportados de Google Ads y la queja del usuario).
  if (body.modo === 'diagnostico') return diagnosticarCampana({ env, brief, marca: body.marca || null, actual: body.actual });
  // Campañas sobre el MODELO (nucleo/): generar, corregir por partes, investigar por partes.
  if (body.modo === 'campana') return modoCampana({ env, brief, marca: body.marca || null, ficha: body.ficha || null, opciones: body.opciones || {} });
  if (body.modo === 'corregir') return modoCorregir({ env, body });
  if (body.modo === 'investigar') return modoInvestigar({ env, body });

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
// Re-exporta lo que usan las pruebas (antes todo vivía en este archivo).
export { corregirOrtografia, extraerJSON, detectarPromos, extraerEnlaces, extraerTextoPagina, legalDelBrief } from './ia/comun.js';
export { generarEmail } from './ia/documentos.js';
export { generarBanner } from './ia/display.js';
export { generarAds, armarAds, modoCampana, modoCorregir, modoInvestigar, investigarAds, analizarTabla, numeroAds, diagnosticarCampana } from './ia/search.js';
