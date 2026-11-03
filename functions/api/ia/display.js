/* ══════════════════════════════════════════════════════════════════
   IA · GOOGLE DISPLAY Y FACEBOOK (banners)  ·  functions/api/ia/display.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: generarBanner: el copy del banner (titular, bajada, CTA, etiqueta, oferta, legal) con límites de caracteres y acortado. Facebook usa este mismo generador.
   No es una ruta: lo importa functions/api/ia.js (el único punto de entrada /api/ia).
   Vive en functions/ (no en funciones/) para que el servidor NO lo publique como archivo.
   ══════════════════════════════════════════════════════════════════ */
import { json } from '../_shared.js';
import { cadenaCopy, corregirOrtografia, encargoDelUsuario, enfoqueDe, legalDelBrief, llamarGemini, reglasBrief, sinPuntoFinal, voorMarca } from './comun.js';

// ════════════ PRODUCTO 1: BANNERS DE GOOGLE DISPLAY (3 zonas) ════════════
// LÍMITES DE CARACTERES: no se eligen, los calcula el cliente desde la
// geometría del formato (ancho útil ÷ cuerpo × 0,52 × líneas permitidas) y los
// manda aquí. Escribir sin ellos es lo que producía titulares que no caben, y
// entonces el sistema tenía que quitar la bajada para que la pieza cerrara.
export const LIMITES_BANNER_POR_DEFECTO = { titulo: 27, cuerpo: 54, cta: 18, etiqueta: 18, burbuja: 16, legal: 27, palabra: 9 };
export function limitesBanner(l) {
  const d = LIMITES_BANNER_POR_DEFECTO, o = {};
  for (const k in d) {
    const v = parseInt(l && l[k]);
    o[k] = (v && v > 3) ? Math.min(v, d[k] * 6) : d[k];
  }
  return o;
}
// Recorte por PALABRAS (nunca a mitad de palabra) como última red: si tras pedir
// el acortado el texto sigue pasándose, se corta por el último espacio que cabe.
export function recortarAPalabras(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max + 1).lastIndexOf(' ');
  return (corte > max * 0.5 ? t.slice(0, corte) : t.slice(0, max)).trim();
}
// Una pasada de ACORTADO: se le pide a la IA que reescriba más corto lo que no
// cabe, conservando el significado. Es la regla 3 del manual — si el texto no
// cabe se reescribe el texto, no se estira la caja ni se corta la frase.
export async function acortarAlLimite(env, campos) {
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
export async function generarBanner({ env, brief, marca, imagenes, refsTxt, promos, estilo, limites, avisos }) {
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
