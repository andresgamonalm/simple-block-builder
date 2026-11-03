/* ══════════════════════════════════════════════════════════════════
   IA · GOOGLE SEARCH  ·  functions/api/ia/search.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Investigación (landing + competencia), armado de campaña, crítico, segundo anuncio por grupo, diagnóstico de campaña actual, y los modos campana / corregir / investigar sobre el modelo (nucleo/).
   No es una ruta: lo importa functions/api/ia.js (el único punto de entrada /api/ia).
   Vive en functions/ (no en funciones/) para que el servidor NO lo publique como archivo.
   ══════════════════════════════════════════════════════════════════ */
import LEC from '../../../nucleo/lecciones.js';
import { json } from '../_shared.js';
import CIA from '../../../nucleo/campana-ia.js';
import REG from '../../../nucleo/reglas.js';
import OPS from '../../../nucleo/operaciones.js';
import { avisosDeReferencias, cadenaCopy, cadenaRapida, corregirOrtografia, encargoDelUsuario, leerReferencias, llamarGemini, reglasBrief, sinPuntoFinal, voorMarca } from './comun.js';

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

export const aLista = (v, n, largo) => (Array.isArray(v) ? v : []).map(x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, n).map(x => x.slice(0, largo || 200));

export async function investigarAds(env, brief, marca) {
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
    url ? '1b. Si la landing es de UN producto, lee también la página del RAMO en el mismo sitio (la de la categoría, p. ej. la de seguros de auto): suele traer asistencias, garantías, cuotas de la promoción y respaldo que la página del producto no muestra. Anota de qué página sale cada dato y usa solo lo del producto encargado.' : '',
    '2. BUSCA en Google (resultados de Chile) cómo busca la gente este producto y quiénes compiten por esas búsquedas. Identifica 3 a 6 competidores y qué promete cada uno en sus anuncios y páginas.',
    '3. Detecta los MENSAJES GENÉRICOS que repiten todos (no sirven para diferenciar) y los ÁNGULOS DIFERENCIALES que esta marca tiene con respaldo en su landing y la competencia no usa.',
    '4. Piensa en las búsquedas que NO queremos pagar: lo que el producto NO es o no incluye, significados confundibles, productos parecidos que no se venden aquí.',
    '4b. SEGUROS: anota cada dato con su significado exacto. Distingue PRIMA (costo de toda la vigencia) de CUOTA (pago mensual). Si un precio es de referencia (calculado para un modelo y año de auto, una edad o un perfil), anótalo como «cuota desde $X» en evidencia de precio y su condición en "condiciones"; el caso de referencia nunca va al anuncio. Un precio o una oferta solo cuenta si lo CONFIRMAS en el texto de la página junto a su condición; lo que no puedas leer (imágenes, banners) no se anota. Si un beneficio depende del plan, anota el plan. Si la página muestra varios productos, usa solo los del producto encargado.',
    brief.enfoque === 'conversion' ? '5. CAMPAÑA DE CONVERSIÓN (venta directa online): ordena la EVIDENCIA que encuentres en la web, los materiales y el relato del usuario según las tres barreras del comprador — TRÁMITE (qué tan digital, cuánto tarda, qué no hay que hacer), PRECIO (precio visible, oferta, forma de pago) y RESPALDO (quién responde, cómo liquida, asistencia, pruebas con fuente) — y detecta los MOMENTOS DE NECESIDAD que obligan a comprar ya. Solo hechos con respaldo; si una barrera no tiene evidencia, deja su lista vacía.' : '',
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
    '  "angulosDiferenciales": ["ángulos propios de la marca, respaldados por su landing"],',
    '  "evidencia": { "tramite": ["hechos"], "precio": ["hechos"], "respaldo": ["hechos"] },',
    '  "momentos": ["situaciones que obligan a comprar ya (ej. auto recién comprado)"]',
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
      mensajesGenericos: aLista(f.mensajesGenericos, 12), angulosDiferenciales: aLista(f.angulosDiferenciales, 8),
      evidencia: { tramite: aLista(f.evidencia && f.evidencia.tramite, 8), precio: aLista(f.evidencia && f.evidencia.precio, 8), respaldo: aLista(f.evidencia && f.evidencia.respaldo, 8) },
      momentos: aLista(f.momentos, 8)
    };
    if (!ficha.producto && !ficha.beneficios.length) { ultimoError = 'la ficha llegó vacía'; continue; }
    return { ficha, urlsLeidas: r.urlsLeidas || [], fuentes: r.fuentes || [] };
  }
  return { ficha: null, urlsLeidas: [], fuentes: [], error: ultimoError };
}

export function fichaTexto(f) {
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
    l('ÁNGULOS DIFERENCIALES DE ESTA MARCA (úsalos)', f.angulosDiferenciales),
    f.evidencia ? l('EVIDENCIA · barrera del TRÁMITE', f.evidencia.tramite) : '',
    f.evidencia ? l('EVIDENCIA · barrera del PRECIO', f.evidencia.precio) : '',
    f.evidencia ? l('EVIDENCIA · barrera del RESPALDO', f.evidencia.respaldo) : '',
    l('MOMENTOS DE NECESIDAD', f.momentos)
  ].filter(Boolean).join('\n');
}

// Frases trilladas que no diferencian a nadie. Se comparan sin tildes.
export const CLICHES_ADS = [
  'los mejores precios', 'mejor precio del mercado', 'precios competitivos', 'calidad garantizada',
  'rapido y facil', 'facil y rapido', 'rapido, facil', 'rapido facil y seguro', 'la mejor opcion',
  'no esperes mas', 'haz clic aqui', 'click aqui', 'somos lideres', 'soluciones integrales',
  'excelente servicio', 'servicio de calidad', 'amplia experiencia', 'la mejor calidad',
  'todo lo que necesitas', 'tu mejor aliado', 'confia en nosotros', 'esta campana', 'este anuncio'
];
export const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const esCliche = s => { const t = sinTildes(s); return CLICHES_ADS.some(c => t.includes(c)); };
// Cifras de un texto, normalizadas ("$9.990" y "9990" son la misma).
export const cifrasDe = s => (String(s || '').match(/\d+(?:[.,]\d+)*/g) || []).map(n => n.replace(/[.,]/g, '')).filter(n => n.length);

export async function criticarAnuncios(env, grupos, ficha, marca, opts) {
  const o = opts || {};
  const papel = t => (o.rolDe && o.rolDe[String(t).toLowerCase()]) || '';
  const entrada = grupos.map((g, i) => ({ i, grupo: g.nombre, intencion: g.intencion, titularesFijos: g.titularesFijos, titulares: g.titularesRotan, descripciones: g.descripciones,
    ...(o.conversion ? { papelesFijos: g.titularesFijos.map(papel), papelesRotan: g.titularesRotan.map(papel) } : {}) }));
  const prompt = [
    `Eres director creativo de performance y revisas anuncios RSA de Google Search${marca ? ' de ' + (marca.nombre || marca.empresa) : ''} antes de publicarlos. Tu trabajo es MATAR LO GENÉRICO.`,
    '',
    'PRUEBA DEL COMPETIDOR: si cambias la marca por un competidor y el texto sigue siendo verdad, es genérico → REESCRÍBELO con un dato concreto de la ficha (beneficio con cifra, prueba, oferta, objeción respondida, ángulo diferencial).',
    'También reescribe: frases trilladas ("rápido y fácil", "los mejores precios", "calidad garantizada", "atención personalizada"...), titulares que dicen lo mismo con otras palabras, descripciones sin un dato concreto, y todo lo que hable del anuncio en vez de al cliente.',
    'Lo que ya es específico y bueno, DÉJALO IGUAL.',
    'LÍMITES DUROS: titulares ≤30 caracteres (con espacios), descripciones ≤90. Titulares sin punto final. Español de Chile correcto.',
    'PROHIBIDO inventar cifras, precios, plazos o premios que no estén en la ficha.',
    o.protocolo
      ? 'Mantén la MISMA cantidad de textos en cada lista y la MISMA posición de cada uno. Los titularesFijos van fijados en la posición 1: TODOS llevan el nombre de la marca, cada uno en una variante distinta (marca + otro mensaje), y así debe quedar tras reescribir.'
      : 'Mantén la MISMA cantidad de textos en cada lista y el orden de los titularesFijos (1 marca/producto, 2 keyword, 3 beneficio u oferta, 4 llamada a la acción).',
    o.conversion ? 'CAMPAÑA DE CONVERSIÓN: cada titular tiene un PAPEL (papelesFijos/papelesRotan, misma posición). Si lo reescribes, conserva su papel. Reescribe también toda descripción que invite a leer (conoce, infórmate, visita) o que no termine en una acción de compra.' : '',
    'Reescribe también todo texto con mayúscula en cada palabra (estilo inglés): en español va solo al inicio y en nombres propios.',
    o.conversion ? LEC.leccionParaIA('conversion') : '',
    LEC.leccionParaIA('seguros'),
    'Reescribe también todo texto con un error de rubro según la lección de seguros (prima por cuota, precio de ejemplo, beneficio de un plan presentado como de todos, la marca como sujeto de un atributo).',
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

// SEGUNDO ANUNCIO POR GRUPO (lección de conversión 5b, v8 validada por el usuario):
// cada grupo lleva dos anuncios con ángulos distintos para aprender cuál convierte.
// Los 5 fijados (con la marca) son los mismos; cambian los que rotan y las descripciones.
export async function segundoAnuncio(env, grupos, ficha, marca, opts) {
  const o = opts || {};
  const papel = t => (o.rolDe && o.rolDe[String(t).toLowerCase()]) || '';
  const entrada = grupos.map((g, i) => ({ i, grupo: g.nombre, intencion: g.intencion, anguloPrimero: g.angulo,
    titularesFijos: g.titularesFijos, titularesPrimero: g.titularesRotan.map(t => ({ t, rol: papel(t) })), descripcionesPrimero: g.descripciones }));
  const prompt = [
    `Eres especialista senior en Google Ads (Search)${marca ? ' de ' + (marca.nombre || marca.empresa) : ''} en Chile. Cada grupo ya tiene UN anuncio. Escribe el SEGUNDO anuncio de cada grupo, para probar cuál convierte más.`,
    '',
    'EL SEGUNDO ANUNCIO TIENE OTRO ÁNGULO: si el primero se carga al TRÁMITE (qué tan fácil y rápido es comprar), este se carga al RESPALDO (garantías, asistencias, atención, quién responde); si el primero ya es de respaldo, este se carga al trámite. El precio puede aparecer en ambos.',
    'Los 5 titularesFijos se comparten (no los escribas). Tú escribes: 10 "titulares" que rotan y 4 "descripciones", DISTINTOS de los del primer anuncio (no la misma frase reordenada).',
    'Cada titular declara su "rol": keyword, tramite, precio, respaldo o cta. Entre los 10 tienen que estar las tres barreras.',
    'LÍMITES DUROS: titulares ≤30 caracteres (con espacios) y sin punto final; descripciones ≤90 y terminan en una acción de compra. Español de Chile correcto; mayúscula solo al inicio y en nombres propios.',
    'PROHIBIDO inventar cifras, precios, plazos o garantías que no estén en la ficha.',
    o.conversion ? LEC.leccionParaIA('conversion') : '',
    LEC.leccionParaIA('seguros'),
    '', 'FICHA DEL PRODUCTO Y LA COMPETENCIA:', fichaTexto(ficha) || '(sin ficha)',
    '', 'GRUPOS Y SU PRIMER ANUNCIO:', JSON.stringify(entrada),
    '', 'Devuelve SOLO: { "grupos": [ { "i": 0, "angulo": "respaldo | tramite: en 3-6 palabras", "titulares": [ { "t": "...", "rol": "respaldo" } ], "descripciones": [ "..." ] } ] }'
  ].filter(Boolean).join('\n');
  const r = await llamarGemini(env, prompt, 6144, 0.7, { cadena: cadenaCopy(env), pensar: -1, timeout: 70000 });
  return Array.isArray(r.parsed && r.parsed.grupos) ? r.parsed.grupos : null;
}

// ══════════════════════════════════════════════════════════════════════════
// TU CAMPAÑA ACTUAL — diagnóstico de una campaña que YA corre (sep-2026)
//
// El usuario pega capturas, sube los informes que exporta de Google Ads y dice
// qué le parece mal. Las CIFRAS no se las pedimos a la IA: se calculan aquí,
// leyendo los informes (analizarTablas). La IA interpreta, prioriza y propone;
// el servidor valida lo que propone contra esos números.
// ══════════════════════════════════════════════════════════════════════════

// Nombres de columna de Google Ads, en español y en inglés (sin tildes).
export const COLS_ADS = {
  termino: ['search term', 'termino de busqueda', 'terminos de busqueda', 'consulta de busqueda'],
  keyword: ['keyword', 'palabra clave', 'palabras clave', 'search keyword'],
  concordancia: ['match type', 'tipo de concordancia', 'concordancia', 'search keyword match type', 'criterion type'],
  campana: ['campaign', 'campana'],
  grupo: ['ad group', 'grupo de anuncios'],
  clics: ['clicks', 'clics'],
  impr: ['impr.', 'impressions', 'impresiones', 'impr'],
  costo: ['cost', 'costo', 'coste'],
  conv: ['conversions', 'conversiones', 'conv.', 'conv'],
  cpc: ['avg. cpc', 'cpc prom.', 'cpc promedio', 'cpc medio', 'cpc'],
  calidad: ['quality score', 'nivel de calidad'],
  estado: ['status', 'estado']
};
// "$2.000" · "1.234,5" · "2,000.50" · "12%" → número. En CLP el punto es de miles.
export function numeroAds(v) {
  let t = String(v == null ? '' : v).replace(/[^\d.,\-]/g, '');
  if (!t || t === '-' || t === '--') return 0;
  const p = t.lastIndexOf('.'), c = t.lastIndexOf(',');
  if (p >= 0 && c >= 0) t = p > c ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  else if (c >= 0) t = /,\d{3}$/.test(t) && !/,\d{3},\d{1,2}$/.test(t) ? t.replace(/,/g, '') : t.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  else if (p >= 0 && /^\-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}
export function separarFila(linea, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') { if (q && linea[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}
// Lee UN informe (texto CSV/TSV, con o sin líneas de título arriba) y calcula
// sus totales y hallazgos. Devuelve null si no parece un informe de Google Ads.
export function analizarTabla(nombre, texto) {
  const lineas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) return null;
  let sep = '\t';
  const muestra = lineas.slice(0, 8).join('\n');
  if (!muestra.includes('\t')) sep = (muestra.split(';').length > muestra.split(',').length) ? ';' : ',';
  // La fila de cabecera es la primera que nombra columnas conocidas.
  let hi = -1, idx = {};
  for (let i = 0; i < Math.min(lineas.length, 12); i++) {
    const cab = separarFila(lineas[i], sep).map(sinTildes);
    const m = {};
    for (const [k, alias] of Object.entries(COLS_ADS)) { const j = cab.findIndex(h => alias.includes(h)); if (j >= 0) m[k] = j; }
    if ((m.termino != null || m.keyword != null) && (m.costo != null || m.clics != null)) { hi = i; idx = m; break; }
  }
  if (hi < 0) return null;
  const filas = lineas.slice(hi + 1).map(l => separarFila(l, sep))
    .filter(f => !/^total/i.test(sinTildes(f[0] || '')) && f.some(x => x));
  const col = (f, k) => idx[k] != null ? f[idx[k]] : '';
  const tipo = idx.termino != null ? 'terminos' : 'keywords';
  const items = filas.map(f => ({
    t: String(col(f, tipo === 'terminos' ? 'termino' : 'keyword') || '').toLowerCase().replace(/^[\[\"+]+|[\]\"]+$/g, '').trim(),
    concordancia: sinTildes(col(f, 'concordancia')), campana: col(f, 'campana'), grupo: col(f, 'grupo'),
    clics: numeroAds(col(f, 'clics')), impr: numeroAds(col(f, 'impr')), costo: numeroAds(col(f, 'costo')),
    conv: numeroAds(col(f, 'conv')), calidad: idx.calidad != null ? numeroAds(col(f, 'calidad')) : null
  })).filter(x => x.t && !/^total/.test(sinTildes(x.t)));
  if (!items.length) return null;
  const suma = k => items.reduce((a, x) => a + x[k], 0);
  const tot = { costo: Math.round(suma('costo')), clics: Math.round(suma('clics')), impr: Math.round(suma('impr')), conv: +suma('conv').toFixed(1) };
  tot.cpc = tot.clics ? Math.round(tot.costo / tot.clics) : null;
  tot.ctr = tot.impr ? +(tot.clics / tot.impr * 100).toFixed(2) : null;
  tot.cpa = tot.conv ? Math.round(tot.costo / tot.conv) : null;
  const porCosto = (a, b) => b.costo - a.costo;
  const sinConv = items.filter(x => x.costo > 0 && !x.conv).sort(porCosto);
  const r = {
    nombre: String(nombre || 'informe').slice(0, 80), tipo, filas: items.length, totales: tot,
    gastoSinConversion: Math.round(sinConv.reduce((a, x) => a + x.costo, 0)),
    sinConversion: sinConv.slice(0, 40).map(x => ({ t: x.t, costo: Math.round(x.costo), clics: x.clics, campana: x.campana, grupo: x.grupo })),
    convierten: items.filter(x => x.conv > 0).sort((a, b) => b.conv - a.conv).slice(0, 25)
      .map(x => ({ t: x.t, conv: x.conv, costo: Math.round(x.costo), cpa: Math.round(x.costo / x.conv) })),
    campanas: [...new Set(items.map(x => x.campana).filter(Boolean))].slice(0, 10)
  };
  if (tipo === 'keywords') {
    r.amplias = items.filter(x => /broad|amplia/.test(x.concordancia)).sort(porCosto).slice(0, 30)
      .map(x => ({ t: x.t, costo: Math.round(x.costo), conv: x.conv, grupo: x.grupo, campana: x.campana }));
    r.calidadBaja = items.filter(x => x.calidad != null && x.calidad > 0 && x.calidad < 5).sort(porCosto).slice(0, 30)
      .map(x => ({ t: x.t, calidad: x.calidad, costo: Math.round(x.costo), cpc: x.clics ? Math.round(x.costo / x.clics) : null, grupo: x.grupo, campana: x.campana }));
    r.cpcAltos = items.filter(x => x.clics >= 3).map(x => ({ t: x.t, cpc: Math.round(x.costo / x.clics), costo: Math.round(x.costo), conv: x.conv, grupo: x.grupo, campana: x.campana }))
      .sort((a, b) => b.cpc - a.cpc).slice(0, 15);
  }
  return r;
}
export function analizarTablas(tablas) {
  return (Array.isArray(tablas) ? tablas : []).slice(0, 6)
    .map(t => analizarTabla(t && t.nombre, String((t && t.texto) || '').slice(0, 400000))).filter(Boolean);
}
export const clp = n => (n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CL'));
export function hechosTexto(hs) {
  return hs.map(h => {
    const t = h.totales;
    const l = [`▸ ${h.nombre} (${h.tipo === 'terminos' ? 'términos de búsqueda' : 'keywords'}, ${h.filas} filas): costo ${clp(t.costo)} · ${t.clics} clics · CPC prom. ${clp(t.cpc)} · CTR ${t.ctr == null ? '—' : t.ctr + '%'} · ${t.conv} conversiones · CPA ${clp(t.cpa)}.`,
      `  Gasto SIN ninguna conversión: ${clp(h.gastoSinConversion)} (${t.costo ? Math.round(h.gastoSinConversion / t.costo * 100) : 0}% del costo).`];
    if (h.sinConversion.length) l.push('  Lo que más gasta sin convertir: ' + h.sinConversion.slice(0, 25).map(x => `"${x.t}" ${clp(x.costo)}/${x.clics} clics`).join(' · '));
    if (h.convierten.length) l.push('  Lo que SÍ convierte (no bloquear): ' + h.convierten.slice(0, 15).map(x => `"${x.t}" ${x.conv} conv. CPA ${clp(x.cpa)}`).join(' · '));
    if (h.amplias && h.amplias.length) l.push('  En concordancia AMPLIA: ' + h.amplias.slice(0, 15).map(x => `"${x.t}" ${clp(x.costo)}`).join(' · '));
    if (h.calidadBaja && h.calidadBaja.length) l.push('  Nivel de calidad bajo 5: ' + h.calidadBaja.slice(0, 15).map(x => `"${x.t}" QS ${x.calidad}, CPC ${clp(x.cpc)}`).join(' · '));
    if (h.cpcAltos && h.cpcAltos.length) l.push('  CPC más altos: ' + h.cpcAltos.slice(0, 10).map(x => `"${x.t}" ${clp(x.cpc)}`).join(' · '));
    return l.join('\n');
  }).join('\n');
}

export async function diagnosticarCampana({ env, brief, marca, actual }) {
  actual = actual || {};
  const hechos = analizarTablas(actual.tablas);
  const imgs = (Array.isArray(actual.imagenes) ? actual.imagenes : []).slice(0, 6)
    .map(im => ({ mime: /^image\/(png|jpe?g|webp)$/.test(im && im.mime) ? im.mime : 'image/jpeg', data: String((im && im.data) || '').replace(/^data:[^,]+,/, '') }))
    .filter(im => im.data.length > 100 && im.data.length < 6000000);
  const notas = String(actual.notas || '').trim().slice(0, 3000);
  if (!hechos.length && !imgs.length && !notas) return json({ ok: false, error: 'Pega una captura, sube un informe de Google Ads o cuéntame qué está mal.' }, 400);
  const tablasSinLeer = (Array.isArray(actual.tablas) ? actual.tablas.length : 0) - hechos.length;
  // Extracto crudo de los informes (para lo que las columnas conocidas no cubren).
  const crudo = (Array.isArray(actual.tablas) ? actual.tablas : []).slice(0, 6)
    .map(t => `• ${String(t.nombre || '').slice(0, 80)}\n${String(t.texto || '').split(/\r?\n/).slice(0, 60).join('\n').slice(0, 5000)}`).join('\n\n');

  const prompt = [
    'Eres auditor senior de Google Ads (Search) en Chile, de los que cobran por encontrar la plata que se está botando. Revisas una campaña que YA está corriendo.',
    '',
    '════ EL OBJETIVO DE LA CAMPAÑA (manda sobre todo: cada recomendación debe acercar a esto, nunca alejarse) ════',
    `QUÉ SE VENDE / QUÉ SE BUSCA: ${brief.que || '(no indicado: dedúcelo de los datos)'}`,
    brief.accion ? `ACCIÓN que se busca: ${brief.accion}` : '',
    brief.ctaUrl ? `LANDING: ${brief.ctaUrl}` : '',
    brief.notas ? `INDICACIONES: ${brief.notas}` : '',
    '══════════════════════════════════════════════════',
    notas ? `\nLO QUE AL USUARIO LE PARECE MAL (su queja, en sus palabras):\n» ${notas}` : '',
    hechos.length ? '\nCIFRAS CALCULADAS DE SUS INFORMES (son exactas: úsalas como evidencia, no las cambies):\n' + hechosTexto(hechos) : '',
    crudo ? '\nEXTRACTO DE LOS INFORMES:\n' + crudo : '',
    imgs.length ? `\nADEMÁS hay ${imgs.length} captura(s) de pantalla de su cuenta: léelas (columnas, cifras, configuración visible). Si una cifra de la captura choca con las calculadas, mandan las calculadas.` : '',
    '',
    'QUÉ REVISAR (en este orden de impacto): términos de búsqueda que gastan sin convertir · concordancia amplia · CPC altos y su causa (nivel de calidad, competencia, estrategia de puja sin tope) · nivel de calidad (relevancia del anuncio, CTR esperado, experiencia en la landing) · configuración (red de búsqueda asociada, expansión a Display, ubicación "presencia o interés", horarios, dispositivos) · anuncios genéricos · coherencia keyword → anuncio → landing.',
    '',
    'Devuelve SOLO este JSON:',
    '{',
    '  "resumen": "el diagnóstico en 2 frases, directo",',
    '  "problemas": [ { "titulo": "…", "evidencia": "el dato concreto que lo prueba", "impacto": "alto" | "medio" | "bajo", "ahorro": "cuánto se deja de botar, SOLO si sale de las cifras (ej. \'$84.000 al mes\'), si no \'\'" } ],',
    '  "negativas": [ { "t": "término negativo", "motivo": "por qué, ligado al objetivo", "nivel": "campaña" | "<nombre del grupo>" } ],',
    '  "pausar": [ { "keyword": "…", "grupo": "…", "motivo": "…" } ],',
    '  "concordancia": [ { "keyword": "…", "de": "amplia", "a": "frase" | "exacta", "motivo": "…" } ],',
    '  "ajustes": [ { "ajuste": "…", "recomendacion": "qué cambiar exactamente", "motivo": "…" } ],',
    '  "anuncios": [ { "problema": "…", "recomendacion": "…" } ],',
    '  "noHacer": [ "LECCIONES para la próxima versión de la campaña: lo que NO hay que repetir, concreto (ej. \'no usar amplia en seguro auto: 62% del gasto fue en búsquedas de SOAP\')" ]',
    '}',
    'REGLAS:',
    '- Ordena "problemas" por impacto. Cada uno con EVIDENCIA concreta de los datos o las capturas; si no hay datos, dilo como hipótesis a verificar.',
    '- NO inventes cifras: los montos y porcentajes salen de las CIFRAS CALCULADAS o de lo que se lee en las capturas.',
    '- Negativas: saca las de los términos que gastan sin convertir y NO calzan con el objetivo. JAMÁS propongas como negativa algo que esté en "lo que SÍ convierte" ni el producto del objetivo. Minúsculas, 1 a 4 palabras.',
    '- "noHacer": 4 a 8 lecciones accionables; son el aporte que usará la IA que rearme la campaña.',
    '- Español de Chile, directo, sin relleno.'
  ].filter(Boolean).join('\n');

  const partes = [{ text: prompt }].concat(imgs.map(im => ({ inline_data: { mime_type: im.mime, data: im.data } })));
  const { parsed, error } = await llamarGemini(env, partes, 6144, 0.4, { cadena: cadenaCopy(env), pensar: -1, timeout: 90000 });
  if (error) return json({ ok: false, error }, 500);
  const d = parsed || {};
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const kw = s => clean(s).toLowerCase().replace(/^[\[\"'+-]+|[\]\"']+$/g, '').trim();

  // Validación contra los números: una negativa que bloquearía un término que
  // CONVIERTE o el producto del objetivo se descarta (con aviso).
  const convierten = hechos.flatMap(h => h.convierten.map(x => ' ' + x.t + ' '));
  const objetivo = ' ' + sinTildes(brief.que || '') + ' ';
  const bloqueaBueno = n => { const k = ' ' + sinTildes(n) + ' '; return convierten.some(t => sinTildes(t).includes(k)) || (n.length >= 4 && objetivo.includes(k)); };
  const gastoDe = n => hechos.reduce((a, h) => a + h.sinConversion.filter(x => (' ' + x.t + ' ').includes(' ' + n + ' ')).reduce((b, x) => b + x.costo, 0), 0);
  const avisos = [];
  const vistos = new Set();
  const descartadas = [];
  const negativas = (Array.isArray(d.negativas) ? d.negativas : []).map(x => ({
    t: kw(x && typeof x === 'object' ? x.t : x), motivo: clean(x && x.motivo).slice(0, 220), nivel: clean(x && x.nivel).slice(0, 60) || 'campaña'
  })).filter(x => {
    if (!x.t || x.t.split(' ').length > 5 || vistos.has(x.t)) return false;
    vistos.add(x.t);
    if (bloqueaBueno(x.t)) { descartadas.push(x.t); return false; }
    return true;
  }).slice(0, 60).map(x => ({ ...x, gasto: gastoDe(x.t) || null }));
  if (descartadas.length) avisos.push({ tipo: 'info', texto: `Se descartaron ${descartadas.length} negativas propuestas porque bloquearían búsquedas que SÍ convierten o el producto de tu objetivo (${descartadas.slice(0, 4).join(', ')}).` });
  if (tablasSinLeer > 0) avisos.push({ tipo: 'info', texto: `${tablasSinLeer} archivo(s) no parecían un informe de Google Ads (no se encontraron columnas de término/keyword y costo/clics). Se leyeron como texto.` });

  const lista = (arr, map, n) => (Array.isArray(arr) ? arr : []).map(map).filter(Boolean).slice(0, n);
  const totalGeneral = hechos.find(h => h.tipo === 'keywords') || hechos[0] || null;
  const diagnostico = {
    resumen: clean(d.resumen).slice(0, 500),
    metricas: totalGeneral ? totalGeneral.totales : null,
    gastoSinConversion: hechos.length ? Math.max(...hechos.map(h => h.gastoSinConversion)) : null,
    problemas: lista(d.problemas, x => x && x.titulo ? { titulo: clean(x.titulo).slice(0, 140), evidencia: clean(x.evidencia).slice(0, 400), impacto: ['alto', 'medio', 'bajo'].includes(x.impacto) ? x.impacto : 'medio', ahorro: clean(x.ahorro).slice(0, 80) } : null, 10),
    negativas,
    pausar: lista(d.pausar, x => x && x.keyword ? { keyword: kw(x.keyword), grupo: clean(x.grupo).slice(0, 80), motivo: clean(x.motivo).slice(0, 220) } : null, 40),
    concordancia: lista(d.concordancia, x => x && x.keyword ? { keyword: kw(x.keyword), de: clean(x.de).slice(0, 20) || 'amplia', a: x.a === 'exacta' ? 'exacta' : 'frase', motivo: clean(x.motivo).slice(0, 220) } : null, 40),
    ajustes: lista(d.ajustes, x => x && x.ajuste ? { ajuste: clean(x.ajuste).slice(0, 120), recomendacion: clean(x.recomendacion).slice(0, 300), motivo: clean(x.motivo).slice(0, 220) } : null, 12),
    anuncios: lista(d.anuncios, x => x && x.problema ? { problema: clean(x.problema).slice(0, 200), recomendacion: clean(x.recomendacion).slice(0, 300) } : null, 8),
    noHacer: lista(d.noHacer, x => clean(x).slice(0, 260) || null, 10),
    convierten: hechos.flatMap(h => h.convierten.map(x => x.t)).slice(0, 25),
    campanas: [...new Set(hechos.flatMap(h => h.campanas))].slice(0, 10)
  };
  // La lección más barata de todas, si los datos la muestran, no depende de la IA.
  if (hechos.some(h => h.amplias && h.amplias.length) && !diagnostico.noHacer.some(t => /amplia/i.test(t)))
    diagnostico.noHacer.push('No usar concordancia amplia: en tus datos hay keywords amplias gastando (la campaña nueva usa solo exacta y frase).');
  return json({ ok: true, diagnostico, hechos, avisos });
}

// Lo que la generación de Search recibe de un diagnóstico: un APORTE. El
// objetivo sigue siendo el encargo; esto dice qué no repetir.
export function aprendizajeTexto(a) {
  if (!a || typeof a !== 'object') return '';
  const l = (t, arr) => (Array.isArray(arr) && arr.length) ? `${t}:\n${arr.slice(0, 25).map(x => '  - ' + x).join('\n')}` : '';
  const neg = (Array.isArray(a.negativas) ? a.negativas : []).map(n => typeof n === 'object' ? `${n.t}${n.motivo ? ' (' + n.motivo + ')' : ''}` : String(n));
  const txt = [
    a.resumen ? `DIAGNÓSTICO DE LA CAMPAÑA QUE YA CORRE: ${a.resumen}` : '',
    l('LO QUE NO HAY QUE REPETIR', a.noHacer),
    l('Problemas detectados', (a.problemas || []).map(p => typeof p === 'object' ? `${p.titulo}${p.evidencia ? ' — ' + p.evidencia : ''}` : String(p))),
    l('Búsquedas que SÍ convierten (úsalas como keywords o como base de sus variantes)', a.convierten),
    l('Keywords que se pausaron por gastar sin resultado (NO las vuelvas a proponer)', (a.pausar || []).map(x => typeof x === 'object' ? x.keyword : x)),
    l('Negativas confirmadas con datos reales (inclúyelas)', neg)
  ].filter(Boolean).join('\n');
  return txt ? '════ APRENDIZAJE DE LA CAMPAÑA ACTUAL (un APORTE: el ENCARGO de arriba sigue siendo el objetivo; esto dice qué evitar y qué sí funciona) ════\n' + txt + '\n══════════════════════════════════════════════════' : '';
}

export async function generarAds(args) {
  const r = await armarAds(args);
  return json(r, r.ok ? 200 : (r.status || 500));
}
// El pipeline de Search, devolviendo DATOS (lo usan generarAds y el modo 'campana').
// protocolo = protocolo de la casa: 5 títulos fijados en la posición 1 (marca u
// oferta) + 10 que rotan, en vez de 4 anclados + 11.
export async function armarAds({ env, brief, marca, refsTxt, promos, enlaces, avisos, ficha, fuentes, protocolo }) {
  avisos = Array.isArray(avisos) ? avisos : [];
  const NFIJ = protocolo ? 5 : 4, NROT = protocolo ? 10 : 11;
  // Enfoque de CONVERSIÓN: la IA recibe la lección (nucleo/lecciones.js) y
  // declara el PAPEL de cada título (keyword, tramite, precio, respaldo, cta).
  const conversion = brief.enfoque === 'conversion';
  const rolDe = {};   // texto (minúsculas) → papel; se hereda cuando un texto se reescribe
  const llevarRol = (viejo, nuevo) => { const r = rolDe[String(viejo).toLowerCase()]; if (r && nuevo) rolDe[String(nuevo).toLowerCase()] = r; };
  const fTxt = fichaTexto(ficha);
  const prompt = [
    `Eres un especialista senior en Google Ads (Search) de ${marca ? (marca.nombre || marca.empresa) : 'la marca'}, con 10 años gestionando cuentas en Chile. Estructuras por INTENCIÓN de búsqueda, con concordancias controladas y negativas razonadas. Detestas la concordancia amplia y los anuncios intercambiables con los de la competencia.`,
    '',
    encargoDelUsuario(brief),
    '',
    fTxt ? '════ INVESTIGACIÓN PREVIA (landing leída + competencia en Google) — TU MATERIA PRIMA ════\n' + fTxt + '\n══════════════════════════════════════════════════' : '',
    conversion ? '\n' + LEC.leccionParaIA('conversion') : '',
    '\n' + LEC.leccionParaIA('seguros'),
    aprendizajeTexto(brief.aprendizaje),
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
    conversion ? `      "titularesFijos": [ { "t": "titular ANCLADO ≤30 caracteres", "rol": "keyword|tramite|precio|respaldo|cta" } ] (exactamente ${NFIJ}),` : `      "titularesFijos": [ "${NFIJ} titulares ANCLADOS, ≤30 caracteres cada uno" ],`,
    conversion ? `      "titulares": [ { "t": "titular que ROTA ≤30 caracteres", "rol": "keyword|tramite|precio|respaldo|cta" } ] (exactamente ${NROT}),` : `      "titulares": [ "${NROT} titulares que ROTAN, ≤30 caracteres cada uno" ],`,
    '      "descripciones": [ "4 descripciones, ≤90 caracteres cada una" ],',
    '      "path1": "ruta-1", "path2": "ruta-2"',
    '    }',
    '  ],',
    '  "negativas": [ { "t": "término negativo de campaña", "motivo": "por qué NO queremos pagar esa búsqueda en ESTE negocio" } ],',
    '  "sitelinks": [ { "texto": "≤25 caracteres", "desc1": "≤35 caracteres", "desc2": "≤35 caracteres", "url": "ruta REAL de la landing (ej. /cotizar)" } ],',
    '  "destacados": [ "4 a 6 textos destacados, ≤25 caracteres" ]',
    '}',
    '',
    'ESTRUCTURA Y KEYWORDS:',
    '- "nombre" de la campaña y de cada grupo: LEGIBLES, con espacios y tildes (ej. "Cotizar seguro auto"), nunca en formato slug.',
    conversion
      ? '- 2 a 4 grupos. Cada grupo = UNA intención de COMPRA (comprar/contratar · precio u oferta · inmediatez · detalle del objeto · momento de necesidad; la marca propia va en otra campaña). Nada informativo.'
      : '- 2 a 4 grupos. Cada grupo = UNA intención (ej.: contratar/cotizar ya · comparar/precio · necesidad o problema · marca). No mezcles "cotizar" con "qué es".',
    conversion ? '- PAPEL de cada titular ("rol"): entre fijos y rotativos tienen que estar la keyword y las TRES barreras (tramite, precio, respaldo). Si una barrera no tiene evidencia en las fuentes, no la inventes: cúbrela con lo que sí haya.' : '',
    '- Por grupo: 20 a 25 keywords, tomadas de CÓMO BUSCA LA GENTE y del VOCABULARIO REAL de la investigación. Nada que esté en "lo que NO es".',
    '- "tipo" SOLO "exacta" o "frase" (amplia PROHIBIDA). Exacta = búsquedas cortas y precisas (2-3 palabras); frase = variantes largas (4-5 palabras). Mínimo 30% de cada tipo por grupo.',
    '- Minúsculas, sin corchetes ni comillas, 2 a 5 palabras, como escribe la gente de verdad (con y sin tildes, singular/plural, "precio", "cotizar", "online", "chile" solo cuando alguien lo escribiría).',
    '',
    'ANUNCIOS (aquí se gana o se pierde):',
    '- PRUEBA DEL COMPETIDOR: si cambias la marca por un competidor y el titular sigue siendo verdad, es genérico y NO sirve. Cada anuncio se construye sobre beneficios con cifra, pruebas, ofertas, objeciones y ángulos diferenciales de la INVESTIGACIÓN.',
    '- PROHIBIDO construir sobre los "mensajes genéricos que usan todos" y las frases trilladas: "los mejores precios", "calidad garantizada", "rápido y fácil", "atención personalizada", "la mejor opción", "no esperes más", "somos líderes", "amplia experiencia".',
    '- 15 titulares, TODOS ≤30 caracteres (con espacios), únicos, sin punto final, con mayúscula SOLO al inicio y en nombres propios (norma del español; nada de mayúscula en cada palabra):',
    protocolo
      ? '  · "titularesFijos" (exactamente 5, van TODOS fijados en la posición 1 y Google elige uno): TODOS llevan el NOMBRE DE LA MARCA, cada uno en una variante distinta: la marca combinada con un mensaje diferente (producto, oferta, trámite, respaldo, acción de compra). Nunca la misma frase reordenada. (el nombre del producto solo no basta), con 5 formulaciones realmente distintas (no la misma frase reordenada).'
      : '  · "titularesFijos" (exactamente 4, en este orden, van anclados): 1) marca o producto, 2) la keyword principal del grupo casi literal, 3) el beneficio u oferta más fuerte, 4) llamada a la acción específica (no "Haz clic aquí").',
    protocolo
      ? '  · "titulares" (exactamente 10, rotan): 3 con la keyword del grupo o su variante · 3 beneficios concretos con dato · 1 prueba/confianza con dato real · 1 que responda la objeción principal · 1 del ángulo diferencial · 1 llamada a la acción específica. Ninguno repite ni parafrasea a otro.'
      : '  · "titulares" (exactamente 11, rotan): 2 con variantes de la keyword del grupo · 3 beneficios concretos con dato · 2 pruebas/confianza con dato real · 1 que responda la objeción principal · 2 del ángulo diferencial · 1 oferta o CTA alternativa. Ninguno repite ni parafrasea a otro.',
    '- 4 descripciones ≤90 caracteres, cada una con un ángulo distinto: (1) beneficio principal + dato + CTA, (2) respuesta a una objeción, (3) prueba/confianza, (4) diferencial frente a la competencia u oferta. Una sola idea por descripción, con un dato concreto. Termina con punto.',
    '- El anuncio le habla AL CLIENTE, jamás habla del anuncio o de la campaña. No repitas la misma keyword más de 2 veces en un anuncio.',
    '- CIFRAS: SOLO las que aparecen en la investigación, la landing o el encargo, TEXTUALES. Una cifra inventada invalida el anuncio.',
    '- "path1"/"path2": ≤15 caracteres, minúsculas, con guiones, relacionados con el grupo.',
    '- "sitelinks": 4 a 6 de la MISMA landing; usa los enlaces internos reales listados abajo (no inventes rutas). Cada uno a una página DISTINTA de la URL final. Texto ≤25, descripciones ≤35, sin signos de exclamación.',
    '- "destacados": 4 a 6 atributos concretos (≤25 caracteres, sin signos de exclamación, sin empezar con un símbolo) que NO repitan ningún titular ni sitelink.',
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
  if (error) return { ok: false, error, status: 500 };

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
  // Un titular puede venir como texto o como { t, rol } (enfoque de conversión).
  const ROLES_OK = Object.keys(LEC.ROLES_TITULO);
  const limpiaTit = arr => dedup((Array.isArray(arr) ? arr : []).map(x => {
    const t = sinPuntoFinal(clean(x && typeof x === 'object' ? x.t : x)).slice(0, 30);
    const rol = x && typeof x === 'object' ? String(x.rol || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
    if (t && ROLES_OK.includes(rol)) rolDe[t.toLowerCase()] = rol;
    return t;
  }).filter(Boolean));
  const grupos = gruposIn.map(g => {
    const seenK = new Set();
    let keywords = (Array.isArray(g.keywords) ? g.keywords : []).map(k => ({
      t: kwLimpia(k && (typeof k === 'object' ? k.t : k)),
      tipo: (k && k.tipo === 'frase') ? 'frase' : 'exacta'   // amplia jamás
    })).filter(k => k.t && !seenK.has(k.t) && (seenK.add(k.t), true)).slice(0, 25);
    let fijos = limpiaTit(g.titularesFijos).slice(0, NFIJ);
    let rotan = limpiaTit(g.titulares).filter(t => !fijos.some(f => f.toLowerCase() === t.toLowerCase()));
    if (!fijos.length && rotan.length) { fijos = rotan.slice(0, NFIJ); rotan = rotan.slice(NFIJ); }
    rotan = rotan.slice(0, NROT);
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

  if (!grupos.length) return { ok: false, status: 500, error: 'La IA no produjo grupos de anuncios válidos. Reformula el brief (di qué vendes y a quién).' };

  // APRENDIZAJE (si viene de "Tu campaña actual"): lo que se pausó por gastar sin
  // resultado no vuelve como keyword, y las negativas confirmadas con datos entran.
  const apr = (brief.aprendizaje && typeof brief.aprendizaje === 'object') ? brief.aprendizaje : null;
  if (apr) {
    const pausadas = new Set((Array.isArray(apr.pausar) ? apr.pausar : []).map(x => kwLimpia(typeof x === 'object' ? x.keyword : x)).filter(Boolean));
    let quitadas = 0;
    for (const g of grupos) { const n0 = g.keywords.length; g.keywords = g.keywords.filter(k => !pausadas.has(k.t)); quitadas += n0 - g.keywords.length; }
    if (quitadas) avisos.push({ tipo: 'info', texto: `Se quitaron ${quitadas} keywords que en tu campaña actual gastaban sin resultado.` });
    parsed.negativas = (Array.isArray(parsed.negativas) ? parsed.negativas : []).concat(
      (Array.isArray(apr.negativas) ? apr.negativas : []).filter(n => !n || typeof n !== 'object' || !n.nivel || /campa/i.test(n.nivel))
        .map(n => typeof n === 'object' ? { t: n.t, motivo: n.motivo ? 'Dato de tu campaña actual: ' + n.motivo : 'Dato de tu campaña actual' } : n));
  }

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
  const critica = criticarAnuncios(env, grupos, ficha, marca, { protocolo, conversion, rolDe }).catch(() => null);
  const segundo = protocolo ? segundoAnuncio(env, grupos, ficha, marca, { conversion, rolDe }).catch(() => null) : Promise.resolve(null);
  const [extra, revisados, segundos] = await Promise.all([relleno, critica, segundo]);

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
        llevarRol(o, n);
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
  // Segundo anuncio: mismos filtros; no repite títulos del primero; si queda flaco, no va.
  if (Array.isArray(segundos)) {
    for (const sg of segundos) {
      const g = grupos[Number(sg && sg.i)];
      if (!g) continue;
      const usados = new Set(g.titularesFijos.concat(g.titularesRotan).map(t => t.toLowerCase()));
      const rotan = limpiaTit(sg.titulares).filter(t => t.length <= 30 && !usados.has(t.toLowerCase()) && !esCliche(t) && !inventada(t)).slice(0, NROT);
      const descs = dedup((Array.isArray(sg.descripciones) ? sg.descripciones : []).map(d => clean(d).slice(0, 90))
        .filter(d => d && !esCliche(d) && !inventada(d) && !g.descripciones.includes(d))).slice(0, 4);
      // Protocolo: 10 que rotan. Si los filtros dejaron menos, se completa con títulos buenos del
      // primer anuncio (Google permite repetir títulos entre anuncios del mismo grupo).
      for (const t of g.titularesRotan) { if (rotan.length >= NROT) break; if (!rotan.some(x => x.toLowerCase() === t.toLowerCase())) rotan.push(t); }
      if (rotan.length >= 5 && descs.length >= 2) g.anuncioB = { angulo: clean(sg.angulo).slice(0, 60) || 'respaldo', titularesRotan: rotan, descripciones: descs };
    }
  }
  if (descartados) avisos.push({ tipo: 'info', texto: `Se descartaron ${descartados} textos de anuncio con frases trilladas o cifras que no aparecen en la landing ni en tu encargo.` });

  // Negativas de campaña + motivos. Una negativa que está contenida en una
  // keyword propia bloquearía esa keyword: se saca.
  let negCampana = negs(parsed.negativas, apr ? 60 : 30);
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
  const titulosTodos = new Set(grupos.flatMap(g => g.titularesFijos.concat(g.titularesRotan)).map(t => t.toLowerCase()));
  const destacados = dedup((Array.isArray(parsed.destacados) ? parsed.destacados : []).map(t => clean(t).replace(/!/g, '').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 25))
    .filter(t => t && !esCliche(t) && !titulosTodos.has(t.toLowerCase()) && !sitelinks.some(s => s.texto.toLowerCase() === t.toLowerCase()))).slice(0, 6);

  // ── Etapa 5: corrector RAE sobre los textos VISIBLES. Las keywords NO se
  // corrigen: la gente busca sin tildes y así deben quedar.
  const planos = [legible(parsed.nombre || brief.que).slice(0, 80)];
  for (const g of grupos) { planos.push(g.nombre, g.intencion, g.razonamiento, g.angulo); planos.push(...g.titularesFijos, ...g.titularesRotan, ...g.descripciones); if (g.anuncioB) planos.push(...g.anuncioB.titularesRotan, ...g.anuncioB.descripciones); }
  for (const s of sitelinks) planos.push(s.texto, s.desc1, s.desc2);
  planos.push(...destacados);
  const rev = await corregirOrtografia(env, planos);
  let k = 0;
  const nombreR = String(rev.textos[k++]).slice(0, 80);
  for (const g of grupos) {
    g.nombre = String(rev.textos[k++]).slice(0, 60) || g.nombre;
    g.intencion = String(rev.textos[k++]).slice(0, 200);
    g.razonamiento = String(rev.textos[k++]).slice(0, 300);
    g.angulo = String(rev.textos[k++]).slice(0, 200);
    const tit = t => sinPuntoFinal(t).slice(0, 30);
    const corregir = v => { const n = tit(rev.textos[k++]); llevarRol(v, n); return n; };
    g.titularesFijos = g.titularesFijos.map(corregir).filter(Boolean);
    g.titularesRotan = g.titularesRotan.map(corregir).filter(Boolean);
    g.titulares = g.titularesFijos.concat(g.titularesRotan);
    g.descripciones = g.descripciones.map(() => String(rev.textos[k++]).slice(0, 90)).filter(Boolean);
    if (g.anuncioB) {
      g.anuncioB.titularesRotan = g.anuncioB.titularesRotan.map(corregir).filter(Boolean);
      g.anuncioB.descripciones = g.anuncioB.descripciones.map(() => String(rev.textos[k++]).slice(0, 90)).filter(Boolean);
    }
    // El ángulo se ve en la consola junto al razonamiento del grupo.
    if (g.angulo && !g.razonamiento.includes(g.angulo)) g.razonamiento = (g.razonamiento + ' Ángulo: ' + g.angulo).trim().slice(0, 420);
  }
  for (const s of sitelinks) {
    s.texto = (String(rev.textos[k++]).slice(0, 25)) || s.texto;
    s.desc1 = String(rev.textos[k++]).slice(0, 35);
    s.desc2 = String(rev.textos[k++]).slice(0, 35);
  }
  for (let i = 0; i < destacados.length; i++) destacados[i] = String(rev.textos[k++]).slice(0, 25) || destacados[i];

  const negMotivos = {};
  for (const n of negCampana.concat(grupos.flatMap(g => g.negativas))) if (motivos[n]) negMotivos[n] = motivos[n];

  return {
    ok: true,
    nombre: nombreR,
    urlFinal: clean(brief.ctaUrl || ''),
    grupos,
    negativas: negCampana,
    negativasMotivos: negMotivos,
    sitelinks,
    destacados,
    rolesTitulos: conversion ? Object.fromEntries(grupos.flatMap(g => g.titularesFijos.concat(g.titularesRotan, g.anuncioB ? g.anuncioB.titularesRotan : [])).map(t => [t, rolDe[t.toLowerCase()] || '']).filter(x => x[1])) : null,
    enfoque: conversion ? 'conversion' : '',
    analisis: ficha ? {
      producto: ficha.producto, propuestaValor: ficha.propuestaValor,
      competidores: ficha.competidores, mensajesGenericos: ficha.mensajesGenericos,
      angulosDiferenciales: ficha.angulosDiferenciales, objeciones: ficha.objeciones,
      busquedas: ficha.busquedas, vocabulario: ficha.vocabulario, noOfrece: ficha.noOfrece,
      leyoLanding: ficha.leyoLanding, fuentes: (fuentes || []).slice(0, 10), reescritos
    } : null,
    avisos,
    ortografia: rev.revisado ? 'revisada' : 'sin-revisar'
  };
}

// ════════════ CAMPAÑAS SOBRE EL MODELO (paso 4 de la nueva arquitectura) ════════════
// La campaña vive en el modelo de nucleo/modelo.js (espejo de Ads Editor, con ids).
//   'campana'    → la genera completa (investiga, o reutiliza la ficha si viene).
//   'corregir'   → recibe una instrucción y SOLO las partes afectadas; la IA
//                  devuelve operaciones sobre ids (nucleo/operaciones.js). Nunca
//                  reescribe la campaña: gasta poco y no rompe lo que estaba bien.
//   'investigar' → responde una pregunta con Google/la landing y actualiza SOLO
//                  los campos de la ficha que correspondan.
export const hoyCL = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };
export const resumenValidacion = (v, soloIds) => ({
  errores: v.errores, avisos: v.avisos, sugerencias: v.sugerencias, exportable: v.exportable,
  hallazgos: v.hallazgos.filter(h => !soloIds || soloIds.has(h.id)).map(({ codigo, nivel, id, donde, mensaje }) => ({ codigo, nivel, id, donde, mensaje }))
});

export async function modoCampana({ env, brief, marca, ficha, opciones }) {
  // Enfoque: por defecto CONVERSIÓN (el negocio es venta directa online); se puede
  // pedir otro explícitamente con opciones.enfoque = ''.
  const enfoque = opciones.enfoque === undefined ? 'conversion' : String(opciones.enfoque || '');
  brief = Object.assign({}, brief, { enfoque });
  const urlsAds = [brief.ctaUrl].concat(Array.isArray(brief.refs) ? brief.refs : []);
  let fuentes = [], avisos = [];
  // Con ficha guardada no se vuelve a investigar (es lo caro): solo se relee la landing.
  const [refs, inv] = await Promise.all([
    leerReferencias(urlsAds, { porPagina: 6000, total: 12000 }),
    ficha ? Promise.resolve({ ficha, urlsLeidas: [], fuentes: ficha.fuentes || [] }) : investigarAds(env, brief, marca)
  ]);
  avisos = avisosDeReferencias(refs, brief).filter(a => !(a.tipo === 'url-no-leida' && (inv.urlsLeidas || []).some(u => a.texto.includes(u.split('?')[0]))));
  if (!inv.ficha) avisos.push({ tipo: 'info', texto: 'No se pudo investigar la landing y la competencia (' + (inv.error || 'sin respuesta') + '). La campaña se armó solo con el texto de la página.' });
  fuentes = inv.fuentes || [];
  const d = await armarAds({ env, brief, marca, refsTxt: refs.texto, promos: refs.promos, enlaces: refs.enlaces, avisos, ficha: inv.ficha, fuentes, protocolo: true });
  if (!d.ok) return json(d, d.status || 500);
  const fichaG = inv.ficha ? Object.assign({}, inv.ficha, { fuentes: fuentes.slice(0, 10) }) : null;
  const objetivo = { que: brief.que || '', accion: brief.accion || '', gancho: brief.gancho || '', ctaUrl: brief.ctaUrl || '', notas: brief.notas || '',
    producto: opciones.producto || '', tipo: opciones.tipo || '', enfoque };
  const ini = CIA.iniciativaDesdeIA(d, { objetivo, ficha: fichaG, presupuestoDiario: Number(opciones.presupuestoDiario) || null, puja: opciones.puja, fecha: hoyCL() });
  if (opciones.nombre) ini.nombre = String(opciones.nombre).slice(0, 120);
  const v = REG.validar(ini, { hoy: hoyCL(), marca: marca ? (marca.nombre || marca.empresa) : '' });
  return json({ ok: true, iniciativa: ini, validacion: resumenValidacion(v), avisos: d.avisos, ortografia: d.ortografia });
}

// Corrige la ortografía de los textos VISIBLES que traen las operaciones
// (títulos, descripciones, sitelinks, destacados). Las keywords no: la gente
// busca sin tildes.
export async function ortografiaDeOps(env, ini, ops) {
  const refs = [];
  const visible = (ent, campo) => ['titulo', 'descripcion', 'sitelink', 'destacado'].includes(ent) && ['texto', 'linea1', 'linea2'].includes(campo);
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op === 'cambiar' && typeof op.valor === 'string') { const u = OPS.ubicar(ini, op.id); if (u && visible(u.entidad, op.campo)) refs.push([op, 'valor']); }
    if (op.op === 'agregar' && op.elemento && typeof op.elemento === 'object') {
      const ent = OPS.ENTIDAD_DE_LISTA[op.lista];
      for (const c of ['texto', 'linea1', 'linea2']) if (typeof op.elemento[c] === 'string' && visible(ent, c)) refs.push([op.elemento, c]);
      for (const hija of ['titulos', 'descripciones']) (Array.isArray(op.elemento[hija]) ? op.elemento[hija] : []).forEach(x => { if (x && typeof x.texto === 'string') refs.push([x, 'texto']); });
    }
  }
  if (!refs.length) return false;
  const rev = await corregirOrtografia(env, refs.map(([o, k]) => o[k]));
  refs.forEach(([o, k], i) => { if (rev.textos[i]) o[k] = rev.textos[i]; });
  return rev.revisado;
}

export async function modoCorregir({ env, body }) {
  const ini = body.iniciativa;
  const instruccion = String(body.instruccion || '').trim();
  if (!ini || !Array.isArray(ini.campanas)) return json({ ok: false, error: 'Falta la iniciativa.' }, 400);
  if (!instruccion && !(Array.isArray(body.hallazgos) && body.hallazgos.length)) return json({ ok: false, error: 'Dime qué corregir.' }, 400);
  const marca = body.marca || null;
  const cx = { hoy: hoyCL(), marca: marca ? (marca.nombre || marca.empresa) : '' };
  const antes = REG.validar(ini, cx);
  // Qué partes ve la IA: las que eligió el usuario, o las que nombran los hallazgos;
  // si no hay ninguna, la campaña completa (la respuesta igual son solo operaciones).
  let ids = (Array.isArray(body.ids) ? body.ids : []).filter(id => OPS.ubicar(ini, id));
  const hallazgosPedidos = (Array.isArray(body.hallazgos) ? body.hallazgos : []).map(h => typeof h === 'string' ? antes.hallazgos.find(x => x.codigo + ':' + x.id === h) : h).filter(Boolean);
  if (!ids.length && hallazgosPedidos.length) ids = [...new Set(hallazgosPedidos.map(h => h.id).filter(Boolean))];
  const parcial = ids.length > 0;
  if (!parcial) ids = ini.campanas.map(c => c.id);
  const partes = OPS.vista(ini, ids);
  const obj = ini.objetivo || {};
  const cabecera = [
    'Eres especialista senior en Google Ads (Search) en Chile. Corriges una campaña YA ARMADA, por partes: cambias SOLO lo necesario para cumplir la instrucción, sin tocar lo que está bien.',
    '',
    '════ OBJETIVO DE LA CAMPAÑA (no lo pierdas de vista) ════',
    obj.que ? 'Qué se vende / para quién: ' + obj.que : '', obj.accion ? 'Acción buscada: ' + obj.accion : '', obj.gancho ? 'Oferta (textual): ' + obj.gancho : '',
    obj.ctaUrl ? 'Landing: ' + obj.ctaUrl : '', obj.notas ? 'Indicaciones: ' + obj.notas : '',
    ini.ficha ? '\n════ FICHA DEL PRODUCTO (investigación guardada: úsala, no inventes datos) ════\n' + fichaTexto(ini.ficha) : '',
    marca ? '\nVOZ DE MARCA:\n' + voorMarca(marca) : '',
    obj.enfoque === 'conversion' ? '\n' + LEC.leccionParaIA('conversion') + '\nSi agregas o cambias un título, pon también su "rol" (keyword, tramite, precio, respaldo o cta).' : '',
    '\n' + LEC.leccionParaIA('seguros'),
    '\n' + OPS.operacionesParaIA(),
    '\n' + REG.reglasParaIA(),
    '\nREGLAS DE LA CORRECCIÓN: cifras SOLO de la ficha o el objetivo · títulos ≤30 sin punto final · descripciones ≤90 · keywords solo exacta o frase · una negativa nunca bloquea una keyword propia · no renombres campañas ni grupos salvo que te lo pidan.',
    '\nÍNDICE DE LA CAMPAÑA (con ids):\n' + OPS.resumen(ini)
  ];
  const pedir = async (extra) => {
    const prompt = cabecera.concat([
      '\n════ LO QUE PIDE EL USUARIO ════\n' + (instruccion || 'Corrige los hallazgos indicados.'),
      hallazgosPedidos.length ? '\nHALLAZGOS A RESOLVER:\n' + hallazgosPedidos.map(h => `- [${h.codigo}] ${h.donde}: ${h.mensaje} (id ${h.id})`).join('\n') : '',
      '\n' + (parcial ? 'PARTES A CORREGIR' : 'LA CAMPAÑA') + ' (JSON, con sus ids):\n' + JSON.stringify(extra ? extra.partes : partes),
      extra ? '\n' + extra.texto : '',
      '\nDevuelve EXCLUSIVAMENTE: { "explicacion": "qué cambiaste y por qué, en 1-3 frases para el usuario", "operaciones": [ ... ] }',
      'Si la instrucción no requiere cambios, "operaciones": [] y explícalo.'
    ]).filter(Boolean).join('\n');
    return llamarGemini(env, prompt, 6144, 0.4, { cadena: cadenaCopy(env), pensar: -1 });
  };

  let r = await pedir(null);
  if (r.error) return json({ ok: false, error: r.error }, 500);
  let ops = Array.isArray(r.parsed && r.parsed.operaciones) ? r.parsed.operaciones : [];
  let explicacion = String((r.parsed && r.parsed.explicacion) || '').slice(0, 600);
  const opciones = { nombresFijos: Array.isArray(body.nombresFijos) ? body.nombresFijos : [] };
  let ortografia = await ortografiaDeOps(env, ini, ops);
  let res = OPS.aplicar(ini, ops, opciones);

  // Una ronda de reparación: si hubo operaciones rechazadas o la corrección creó
  // ERRORES nuevos en lo que tocó, se le devuelve eso a la IA (una sola vez).
  const erroresNuevos = v => { const ya = new Set(antes.hallazgos.filter(h => h.nivel === 'error').map(h => h.codigo + ':' + h.id + ':' + h.mensaje)); return v.hallazgos.filter(h => h.nivel === 'error' && !ya.has(h.codigo + ':' + h.id + ':' + h.mensaje)); };
  let despues = REG.validar(res.iniciativa, cx);
  let nuevos = erroresNuevos(despues);
  let reparada = false;
  if (res.rechazadas.length || nuevos.length) {
    const idsRep = [...new Set(res.tocados.concat(nuevos.map(h => h.id)).filter(id => id && OPS.ubicar(res.iniciativa, id)))];
    const texto = ['════ TU PRIMERA PROPUESTA TUVO PROBLEMAS (ya se aplicó lo válido) ════',
      res.rechazadas.length ? 'Operaciones RECHAZADAS:\n' + res.rechazadas.map(x => '- ' + JSON.stringify(x.op) + ' → ' + x.motivo).join('\n') : '',
      nuevos.length ? 'ERRORES que aparecieron tras tus cambios:\n' + nuevos.map(h => `- [${h.codigo}] ${h.donde}: ${h.mensaje} (id ${h.id})`).join('\n') : '',
      'Devuelve SOLO las operaciones que faltan para resolver esto, sobre el estado ACTUAL que ves arriba.'].filter(Boolean).join('\n');
    const r2 = await pedir({ partes: OPS.vista(res.iniciativa, idsRep.length ? idsRep : ids), texto });
    const ops2 = Array.isArray(r2.parsed && r2.parsed.operaciones) ? r2.parsed.operaciones : [];
    if (!r2.error && ops2.length) {
      await ortografiaDeOps(env, res.iniciativa, ops2);
      const res2 = OPS.aplicar(res.iniciativa, ops2, opciones);
      res = { iniciativa: res2.iniciativa, aplicadas: res.aplicadas.concat(res2.aplicadas), rechazadas: res2.rechazadas, tocados: [...new Set(res.tocados.concat(res2.tocados))] };
      if (r2.parsed.explicacion) explicacion = (explicacion + ' ' + String(r2.parsed.explicacion)).trim().slice(0, 900);
      despues = REG.validar(res.iniciativa, cx);
      nuevos = erroresNuevos(despues);
      reparada = true;
    }
  }
  return json({ ok: true, explicacion, iniciativa: res.iniciativa, aplicadas: res.aplicadas, rechazadas: res.rechazadas, tocados: res.tocados,
    parcial, reparada, erroresNuevos: nuevos.map(({ codigo, id, donde, mensaje }) => ({ codigo, id, donde, mensaje })),
    validacion: resumenValidacion(despues), antes: { errores: antes.errores, avisos: antes.avisos, sugerencias: antes.sugerencias },
    ortografia: ortografia ? 'revisada' : 'sin-revisar' });
}

export const CAMPOS_FICHA_LISTA = ['beneficios', 'pruebas', 'ofertas', 'condiciones', 'objeciones', 'vocabulario', 'busquedas', 'noOfrece', 'mensajesGenericos', 'angulosDiferenciales'];
export const CAMPOS_FICHA_TEXTO = ['producto', 'categoria', 'propuestaValor', 'publico'];
export async function modoInvestigar({ env, body }) {
  const ini = body.iniciativa || null;
  const ficha = Object.assign({}, (ini && ini.ficha) || body.ficha || {});
  const obj = (ini && ini.objetivo) || body.objetivo || {};
  const pregunta = String(body.pregunta || '').trim();
  if (!pregunta) return json({ ok: false, error: '¿Qué quieres que averigüe?' }, 400);
  const urlEnPregunta = (pregunta.match(/https?:\/\/\S+/) || [])[0];
  const prompt = [
    'Eres analista de marketing de búsqueda (Google Ads) en Chile. Te hacen UNA pregunta puntual sobre un producto cuya ficha ya está investigada.',
    'Investiga SOLO eso (busca en Google, resultados de Chile; lee la URL si la hay) y responde. No rehagas la ficha entera.',
    '', 'PREGUNTA: ' + pregunta,
    obj.que ? 'PRODUCTO / OBJETIVO: ' + obj.que : '', obj.ctaUrl ? 'LANDING: ' + obj.ctaUrl : '',
    '', 'FICHA ACTUAL:', fichaTexto(ficha) || '(vacía)',
    '', 'Devuelve SOLO este JSON:',
    '{ "respuesta": "lo que averiguaste, en 2-5 frases, con los datos concretos",',
    '  "ficha": { SOLO los campos de la ficha que esta respuesta cambia, con su contenido COMPLETO actualizado (la lista entera, no solo lo nuevo) } }',
    'Campos posibles de la ficha: ' + CAMPOS_FICHA_TEXTO.concat(CAMPOS_FICHA_LISTA).join(', ') + ', competidores ([{nombre, promesa}]).',
    'REGLAS: nada inventado; cifras textuales; si no encontraste nada, dilo y deja "ficha": {}.'
  ].filter(Boolean).join('\n');
  const url = urlEnPregunta || (/^https?:\/\//.test(obj.ctaUrl || '') ? obj.ctaUrl : '');
  const intentos = url ? [[{ url_context: {} }, { google_search: {} }], [{ google_search: {} }]] : [[{ google_search: {} }]];
  let r = null;
  for (const tools of intentos) { r = await llamarGemini(env, prompt, 3072, 0.3, { cadena: cadenaCopy(env), tools, pensar: -1, timeout: 60000 }); if (!r.error && r.parsed) break; }
  if (!r || r.error || !r.parsed) return json({ ok: false, error: (r && r.error) || 'Sin respuesta de la investigación.' }, 500);
  const cambio = (r.parsed.ficha && typeof r.parsed.ficha === 'object') ? r.parsed.ficha : {};
  const cambiados = [];
  for (const k of CAMPOS_FICHA_TEXTO) if (typeof cambio[k] === 'string' && cambio[k].trim()) { ficha[k] = cambio[k].trim().slice(0, 300); cambiados.push(k); }
  for (const k of CAMPOS_FICHA_LISTA) if (Array.isArray(cambio[k])) { ficha[k] = aLista(cambio[k], 25, 120); cambiados.push(k); }
  if (Array.isArray(cambio.competidores)) {
    ficha.competidores = cambio.competidores.slice(0, 8).map(c => ({ nombre: String((c && c.nombre) || '').slice(0, 60), promesa: String((c && c.promesa) || '').slice(0, 200) })).filter(c => c.nombre);
    cambiados.push('competidores');
  }
  const fuentesNuevas = (r.fuentes || []).slice(0, 10);
  if (fuentesNuevas.length) ficha.fuentes = [...new Set((ficha.fuentes || []).concat(fuentesNuevas))].slice(0, 20);
  if (cambiados.length) ficha.actualizada = hoyCL();
  return json({ ok: true, respuesta: String(r.parsed.respuesta || '').slice(0, 1500), ficha, cambiados, fuentes: fuentesNuevas });
}
