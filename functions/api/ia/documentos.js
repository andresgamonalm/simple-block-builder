/* ══════════════════════════════════════════════════════════════════
   IA · EMAIL (documentos)  ·  functions/api/ia/documentos.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: generarEmail: email por moldes. Fuera de la creación desde el Home; se conserva para el asistente y las piezas guardadas.
   No es una ruta: lo importa functions/api/ia.js (el único punto de entrada /api/ia).
   Vive en functions/ (no en funciones/) para que el servidor NO lo publique como archivo.
   ══════════════════════════════════════════════════════════════════ */
import { json } from '../_shared.js';
import { cadenaCopy, corregirOrtografia, encargoDelUsuario, enfoqueDe, llamarGemini, reglasBrief, sinPuntoFinal, voorMarca } from './comun.js';

// ════════════════════ PRODUCTO 2: EMAIL MARKETING (plantilla por tipo) ═══════════════
// PLANTILLAS POR TIPO: la IA solo redacta el COPY estructurado (titular, intro,
// oferta, beneficios, cierre, cta, imagen). El ESQUELETO del email (qué bloques y
// en qué orden) lo arma el código según el tipo (comercial/corporativo/informativo/
// newsletter). Así el diseño es consistente, profesional y 100% editable, sin
// depender del criterio de maquetación de la IA (se acabó el look "PowerPoint").
export const ICONOS_VALIDOS = ['check','candado','reloj','globo','regalo','corazon','estrella','casa','usuario','trending','tag','carrito','telefono','chat','info','descargar','calendario','equipo','pin','nube'];

export async function generarEmail({ env, brief, marca, imagenes, refsTxt, promos }) {
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
export function esOscuro(hex) {
  const h = String(hex || '').replace('#', '');
  const c = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}
