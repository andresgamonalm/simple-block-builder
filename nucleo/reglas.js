/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · MOTOR DE REGLAS
   ────────────────────────────────────────────────────────────────────────
   UN solo catálogo, usado por: la IA (antes y después de generar), la
   pantalla (mientras se edita) y la exportación (antes de entregar).

   Cada regla tiene:
     codigo     G…  = Google (lo que Ads Editor o Google rechazan)
                P…  = protocolo de la casa (lámina "Reglas y requisitos ADS" del usuario)
                C…  = coherencia (la campaña se contradice a sí misma)
                K…  = criterio (válido, pero probablemente un error o una mala práctica)
     nivel      'error'      → BLOQUEA la exportación
                'aviso'      → hay que mirarlo
                'sugerencia' → mejora opcional
   Cada hallazgo apunta al `id` del elemento: la conversación con la IA puede
   pedir "arregla el hallazgo X" y tocar SOLO esa parte.

   validar(iniciativa, contexto)
     contexto.hoy    'AAAA-MM-DD' (por defecto, hoy)
     contexto.ficha  texto con los datos reales del producto (landing, ficha);
                     si viene, se controlan las cifras de los anuncios contra él.
     contexto.marca  nombre de la marca: los títulos fijados en la posición 1
                     deben llevarla (o una oferta/precio).
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./modelo.js'));
  else raiz.MP_Reglas = fabrica(raiz.MP_Modelo);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const L = M.LIMITES;

  /* ── Catálogo (lo que se documenta y se le explica a la IA) ─────────── */
  /* fuente = documento de Google que respalda la regla (o "criterio propio" /
     "protocolo" cuando no viene de Google). Revisado contra la documentación
     vigente el 26-sep-2026. */
  const G = 'https://support.google.com/';
  const F = {
    csv: G + 'google-ads/editor/answer/57747', rsa: G + 'google-ads/answer/7684791', kwSimbolos: G + 'google-ads/answer/2453981',
    negativas: G + 'google-ads/answer/2453972', listasNeg: G + 'google-ads/answer/2453983', concordancias: G + 'google-ads/answer/7478529',
    puntuacion: G + 'adspolicy/answer/14847994', editorial: G + 'adspolicy/answer/6021546', sitelinks: G + 'adspolicy/answer/1054210',
    destacados: G + 'adspolicy/answer/6084196', fragmentos: G + 'google-ads/answer/6280012', precios: G + 'adspolicy/answer/7048464',
    destino: G + 'adspolicy/answer/6368661', engano: G + 'adspolicy/answer/6020955', maxClics: G + 'google-ads/answer/6268626',
    ubicacion: G + 'google-ads/answer/1722038', ubicaciones: G + 'google-ads/answer/1722043', demografia: G + 'google-ads/answer/2580383',
    rsaTips: G + 'google-ads/answer/9438230'
  };
  const PROTO = 'protocolo de la casa (lámina "Reglas y requisitos ADS")';
  const PROPIO = 'criterio propio (sin documento de Google que lo respalde o lo contradiga)';
  const REGLAS = [
    // GOOGLE — lo que Google o Ads Editor rechazan
    { codigo: 'G01', nivel: 'error', categoria: 'google', fuente: F.csv, que: 'La campaña tiene nombre, tipo, redes, idioma, puja y estado válidos.' },
    { codigo: 'G02', nivel: 'error', categoria: 'google', fuente: F.csv, que: 'El presupuesto diario es un entero positivo en CLP.' },
    { codigo: 'G03', nivel: 'error', categoria: 'google', fuente: F.csv, que: 'Las fechas son AAAA-MM-DD o van vacías; el término no es anterior al inicio ni a hoy.' },
    { codigo: 'G04', nivel: 'error', categoria: 'google', fuente: F.csv, que: 'Cada grupo tiene nombre único en su campaña, al menos una keyword y al menos un anuncio.' },
    { codigo: 'G05', nivel: 'error', categoria: 'google', fuente: F.kwSimbolos, que: `Keyword: máx ${L.keywordCaracteres} caracteres y ${L.keywordPalabras} palabras, sin símbolos inválidos (@ \\ ^ , = ! \` < > [ ] ( ) % | ? ; ~ y el asterisco *, que solo vale en negativas), sin repetirse en el grupo.` },
    { codigo: 'G06', nivel: 'error', categoria: 'google', fuente: F.rsa, que: `Anuncio: ${L.titulosMin}-${L.titulosMax} títulos de máx ${L.titulo}, ${L.descripcionesMin}-${L.descripcionesMax} descripciones de máx ${L.descripcion}, rutas de máx ${L.ruta}, URL final http(s). Sin textos repetidos.` },
    { codigo: 'G07', nivel: 'error', categoria: 'google', fuente: F.puntuacion, que: 'Sin puntuación repetida ("!!", "??", "..") en títulos, descripciones, sitelinks ni destacados.' },
    { codigo: 'G08', nivel: 'error', categoria: 'google', fuente: F.rsa, que: 'Posición fijada: títulos solo 1, 2 o 3; descripciones solo 1 o 2.' },
    { codigo: 'G09', nivel: 'error', categoria: 'google', fuente: F.sitelinks, que: `Sitelink: texto máx ${L.sitelinkTexto}, líneas máx ${L.sitelinkLinea} (las dos o ninguna), URL http(s), sin textos repetidos (aunque vayan a páginas distintas).` },
    { codigo: 'G10', nivel: 'error', categoria: 'google', fuente: F.destacados + ' · ' + F.fragmentos, que: `Destacado máx ${L.destacado}, sin repetir otro destacado. Fragmento: ${L.fragmentoValoresMin}-${L.fragmentoValoresMax} valores de máx ${L.fragmentoValor}.` },
    { codigo: 'G11', nivel: 'error', categoria: 'google', fuente: F.negativas, que: 'Negativa con texto, máx 10 palabras, sin símbolos inválidos (, ! @ % ^ ( ) = { } ; ~ ` < > ? \\ |).' },
    { codigo: 'G12', nivel: 'aviso', categoria: 'google', fuente: F.editorial, que: 'Mayúsculas excesivas: palabras enteras en mayúscula que no son siglas.' },
    { codigo: 'G13', nivel: 'aviso', categoria: 'google', fuente: F.fragmentos, que: 'El encabezado del fragmento estructurado es uno de los predefinidos de Google.' },
    { codigo: 'G14', nivel: 'error', categoria: 'google', fuente: F.precios, que: `Extensión de precio: ${L.precioItemsMin}-${L.precioItemsMax} ítems, encabezado y descripción de máx ${L.precioTexto}, precio entero en CLP, URL propia.` },
    { codigo: 'G15', nivel: 'error', categoria: 'google', fuente: F.destino, que: 'Discordancia de destino: las URL finales de las keywords van al mismo dominio que el anuncio del grupo.' },
    { codigo: 'G16', nivel: 'aviso', categoria: 'google', fuente: F.puntuacion, que: 'Signo de exclamación en un título: Google lo desaprobaba ("exclamation mark in the ad\'s headline"); la política vigente ya no lo nombra, pero sigue siendo riesgo de rechazo.' },
    { codigo: 'G17', nivel: 'aviso', categoria: 'google', fuente: F.sitelinks + ' · ' + F.destacados, que: 'Sitelink o destacado que la política de Google desaprueba: signo de exclamación, empieza con un símbolo, repite un texto del anuncio o de otro recurso, o lleva a un dominio distinto al del anuncio. Solo ese recurso deja de mostrarse.' },
    // PROTOCOLO DE LA CASA
    { codigo: 'P01', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: 'Nombres de campaña, grupo y anuncio en minúsculas, sin tildes ni símbolos, con guion medio. (Renombrar una campaña ya publicada crea un duplicado en Ads Editor.)' },
    { codigo: 'P02', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: 'Estructura de nombres: campaña chl-producto-<producto>-<tipo>; grupo <abreviatura del tipo>-<naturaleza>; anuncio ads-<característica>.' },
    { codigo: 'P03', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: `Títulos: ${M.PROTOCOLO.fijadosPosicion1} fijados en la posición 1 y ${M.PROTOCOLO.titulosRotativos} que rotan.` },
    { codigo: 'P04', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: 'Los títulos fijados en la posición 1 llevan la marca o la oferta/precio.' },
    { codigo: 'P05', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: `Al menos ${M.PROTOCOLO.sitelinksMin} sitelinks por campaña.` },
    { codigo: 'P06', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: 'Cada sitelink lleva a una página DISTINTA de la URL de destino principal.' },
    { codigo: 'P07', nivel: 'sugerencia', categoria: 'protocolo', fuente: PROTO, que: `Al menos ${M.PROTOCOLO.destacadosMin} textos destacados por campaña.` },
    { codigo: 'P08', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO, que: `UTM presentes y correctas: utm_source=${M.PROTOCOLO.utmSource}, utm_medium=clics o conversion según la puja, utm_campaign = nombre de la campaña; todo en minúsculas y con guion medio.` },
    { codigo: 'P09', nivel: 'error', categoria: 'protocolo', fuente: PROTO, que: 'Toda URL final (anuncios, keywords, sitelinks, precios) usa https://.' },
    { codigo: 'P10', nivel: 'aviso', categoria: 'protocolo', fuente: PROTO + ' · Google, en cambio, recomienda la amplia: ' + F.concordancias, que: 'Keywords solo en concordancia exacta o de frase (la amplia no se usa por decisión de la casa).' },
    // COHERENCIA — la campaña se contradice
    { codigo: 'C01', nivel: 'error', categoria: 'coherencia', fuente: F.negativas, que: 'Ninguna negativa (de campaña o del grupo) bloquea una keyword propia, según su concordancia.' },
    { codigo: 'C03', nivel: 'aviso', categoria: 'coherencia', fuente: F.engano, que: 'Una promoción con "hasta el DD/MM" debe calzar con la fecha de término de la campaña (ofrecer algo que ya no está disponible es tergiversación).' },
    { codigo: 'C04', nivel: 'sugerencia', categoria: 'coherencia', fuente: F.rsa, que: 'Más de 3 títulos fijados en una misma posición: Google recomienda fijar 2 o 3 por posición; fijar más le quita combinaciones y puede bajar la calidad del anuncio.' },
    { codigo: 'C05', nivel: 'aviso', categoria: 'coherencia', fuente: F.rsa, que: 'Títulos casi iguales (mismas palabras en otro orden): Google pide títulos únicos y advierte que fijar textos similares baja la calidad del anuncio.' },
    { codigo: 'C07', nivel: 'aviso', categoria: 'coherencia', fuente: F.rsaTips, que: 'Ningún título del anuncio contiene las palabras de alguna keyword del grupo (Google pide al menos una keyword en los títulos).' },
    { codigo: 'C08', nivel: 'aviso', categoria: 'coherencia', fuente: F.engano, que: 'Cifras de los anuncios que no aparecen en la ficha del producto (posible dato inventado: afirmación no confiable).' },
    // CRITERIO — válido, pero probablemente un error o una mala práctica
    { codigo: 'K01', nivel: 'aviso', categoria: 'criterio', fuente: PROPIO + '; caso real: $25 CLP diarios', que: 'Presupuesto diario menor a $1.000 CLP: probablemente un error de unidades.' },
    { codigo: 'K02', nivel: 'sugerencia', categoria: 'criterio', fuente: F.maxClics, que: 'Maximizar clics sin tope de CPC: Google puja lo necesario para gastar el presupuesto; el tope ayuda a controlar el costo si el CPC sale más alto de lo deseado (a costa de algunos clics).' },
    { codigo: 'K03', nivel: 'sugerencia', categoria: 'criterio', fuente: PROPIO, que: 'Red de búsqueda asociada o de Display en una campaña Search: mide su rendimiento por separado antes de dejarla encendida.' },
    { codigo: 'K04', nivel: 'aviso', categoria: 'criterio', fuente: F.ubicaciones, que: 'Campaña sin ubicaciones: se mostraría en todos los países.' },
    { codigo: 'K05', nivel: 'sugerencia', categoria: 'criterio', fuente: F.ubicacion, que: 'Método de ubicación no fijado en el archivo: queda "presencia o interés", que es lo que Google recomienda en Search. Cámbialo a "presencia" en Ads Editor solo si no quieres gente que está fuera de la zona.' },
    { codigo: 'K06', nivel: 'aviso', categoria: 'criterio', fuente: F.demografia, que: 'Edad "Desconocida" excluida: Google advierte que puede dejar fuera a una cantidad importante de personas.' },
    { codigo: 'K09', nivel: 'sugerencia', categoria: 'criterio', fuente: F.listasNeg, que: 'Muchas negativas idénticas en varias campañas: mejor una lista compartida (hasta 5.000 por lista y 20 listas por cuenta).' },
    { codigo: 'K10', nivel: 'sugerencia', categoria: 'criterio', fuente: F.concordancias, que: 'La misma keyword en exacta y en frase en el mismo grupo: la de frase ya cubre las búsquedas de la exacta.' },
    { codigo: 'K11', nivel: 'sugerencia', categoria: 'criterio', fuente: F.rsa, que: 'Grupo con un solo anuncio: Google recomienda al menos 2 anuncios adaptables por grupo (en promedio +6,6 % de conversiones al pasar de 1 a 2).' },
    { codigo: 'K12', nivel: 'sugerencia', categoria: 'criterio', fuente: F.fragmentos, que: 'Fragmento estructurado con menos de 4 valores: Google recomienda al menos 4 por encabezado.' }
  ];
  const POR_CODIGO = Object.fromEntries(REGLAS.map(r => [r.codigo, r]));

  /* ── Utilidades ─────────────────────────────────────────────────────── */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const palabras = s => norm(s).split(' ').filter(Boolean);
  const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  const esUrl = s => /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(s || ''));
  const dominio = s => { try { return new URL(s).hostname.replace(/^www\d*\./, ''); } catch (e) { return ''; } };
  const mismoSitio = (a, b) => !a || !b || a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
  const duplicados = arr => { const vistos = new Set(), dup = new Set(); arr.forEach(x => { const k = norm(x); if (!k) return; if (vistos.has(k)) dup.add(k); vistos.add(k); }); return dup; };
  const SIMBOLOS_KW = /[@\\^,=!`<>\[\]()%|?;~*]/;   // keywords (el * solo vale en negativas)
  const SIMBOLOS_NEG = /[,!@%^()={};~`<>?\\|]/;      // negativas
  const PUJAS = ['Maximize clicks', 'Maximize conversions', 'Manual CPC', 'Target CPA', 'Target ROAS', 'Maximize conversion value', 'Target impression share', 'Enhanced CPC'];
  const REDES = ['Google Search', 'Search Partners', 'Display Network'];

  /* ¿La negativa bloquea la keyword? (según la concordancia de la NEGATIVA)
     amplia: todas sus palabras están en la keyword, en cualquier orden
     frase:  su secuencia está dentro de la keyword
     exacta: la keyword es exactamente la negativa */
  function bloquea(neg, kw) {
    const n = palabras(neg.texto), k = palabras(kw.texto);
    if (!n.length) return false;
    if (neg.concordancia === 'exacta') return n.join(' ') === k.join(' ');
    if (neg.concordancia === 'frase') return (' ' + k.join(' ') + ' ').includes(' ' + n.join(' ') + ' ');
    return n.every(w => k.includes(w));
  }

  /* ── Validación ─────────────────────────────────────────────────────── */
  function validar(ini, contexto) {
    const cx = contexto || {};
    const hoy = cx.hoy || new Date().toISOString().slice(0, 10);
    const idx = M.indiceDeIds(ini);
    const hallazgos = [];
    const H = (codigo, el, donde, mensaje, detalle) => hallazgos.push({
      codigo, nivel: POR_CODIGO[codigo].nivel, categoria: POR_CODIGO[codigo].categoria,
      id: el && el.id || null, ruta: el && el.id ? idx[el.id] : null, donde, mensaje, detalle: detalle || null });
    const cifrasFicha = cx.ficha ? new Set((String(cx.ficha).match(/\d+(?:[.,]\d+)*/g) || []).map(n => n.replace(/[.,]/g, ''))) : null;

    const negPorCampana = [];
    for (const c of ini.campanas) {
      if (c.soloReferencia) continue;
      const dc = 'Campaña «' + c.nombre + '»';
      // G01
      if (!String(c.nombre || '').trim()) H('G01', c, dc, 'La campaña no tiene nombre.');
      if (c.tipo !== 'Search') H('G01', c, dc, `Tipo "${c.tipo}": por ahora el contrato cubre solo Search.`);
      if (!c.redes || !c.redes.length) H('G01', c, dc, 'No tiene redes.');
      (c.redes || []).filter(r => !REDES.includes(r)).forEach(r => H('G01', c, dc, `Red desconocida: "${r}".`));
      if (!c.idiomas || !c.idiomas.length) H('G01', c, dc, 'No tiene idioma.');
      if (!PUJAS.includes(c.puja)) H('G01', c, dc, `Estrategia de puja desconocida: "${c.puja}".`);
      if (!['Enabled', 'Paused'].includes(c.estado)) H('G01', c, dc, `Estado desconocido: "${c.estado}".`);
      // G02 / K01
      if (!Number.isInteger(c.presupuestoDiario) || c.presupuestoDiario <= 0) H('G02', c, dc, `Presupuesto diario inválido: "${c.presupuestoDiario}". Debe ser un entero en CLP.`);
      else if (c.presupuestoDiario < 1000) H('K01', c, dc, `Presupuesto diario de $${c.presupuestoDiario} CLP. ¿Es correcto o faltan ceros?`);
      // G03
      if (c.inicio && !esFecha(c.inicio)) H('G03', c, dc, `Fecha de inicio inválida: "${c.inicio}". Usa AAAA-MM-DD o déjala vacía.`);
      if (c.fin && !esFecha(c.fin)) H('G03', c, dc, `Fecha de término inválida: "${c.fin}".`);
      if (esFecha(c.inicio) && esFecha(c.fin) && c.fin < c.inicio) H('G03', c, dc, 'La fecha de término es anterior a la de inicio.');
      if (esFecha(c.fin) && c.fin < hoy) H('G03', c, dc, `La fecha de término (${c.fin}) ya pasó.`);
      // K02 · K03 · K04 · K05 · K06
      const conTope = c.otrasColumnas && Object.keys(c.otrasColumnas).some(k => /max.*cpc|bid limit|cpc bid ceiling/i.test(k));
      if (c.puja === 'Maximize clicks' && !conTope) H('K02', c, dc, 'Maximizar clics sin tope de CPC.');
      if ((c.redes || []).includes('Search Partners')) H('K03', c, dc, 'Tiene la red de búsqueda asociada (Search Partners).');
      if ((c.redes || []).includes('Display Network')) H('K03', c, dc, 'Tiene la red de Display dentro de una campaña Search.');
      if (!c.ubicaciones.length) H('K04', c, dc, 'No tiene ubicaciones: se mostraría en todos los países.');
      else if (!(c.otrasColumnas && Object.keys(c.otrasColumnas).some(k => /targeting method|location target/i.test(k)))) H('K05', c, dc, 'El archivo no fija el método de ubicación: queda «presencia o interés» (lo recomendado por Google).');
      c.ubicaciones.filter(u => !u.idGoogle).forEach(u => H('K04', u, dc + ' › Ubicación «' + u.nombre + '»', 'La ubicación no trae su ID de Google.'));
      c.edadesExcluidas.filter(e => /unknown|desconocid/i.test(e.edad)).forEach(e => H('K06', e, dc, 'Excluye la edad «Desconocida».'));

      // Grupos
      const nombresG = duplicados(c.grupos.filter(g => !g.soloReferencia).map(g => g.nombre));
      nombresG.forEach(n => H('G04', c, dc, `Hay dos grupos con el nombre «${n}»: Ads Editor los mezclaría.`));
      for (const g of c.grupos) {
        const dg = dc + ' › Grupo «' + g.nombre + '»';
        if (!g.soloReferencia) {
          if (!String(g.nombre || '').trim()) H('G04', g, dg, 'El grupo no tiene nombre.');
          if (!g.keywords.length) H('G04', g, dg, 'El grupo no tiene keywords.');
          if (!g.anuncios.length) H('G04', g, dg, 'El grupo no tiene anuncios.');
          else if (g.anuncios.length === 1) H('K11', g, dg, 'Tiene un solo anuncio adaptable.');
        }
        // Keywords
        const vistas = {};
        for (const k of g.keywords) {
          const dk = dg + ' › Keyword «' + k.texto + '»';
          if (!String(k.texto).trim()) H('G05', k, dk, 'Keyword vacía.');
          if (k.texto.length > L.keywordCaracteres) H('G05', k, dk, `Tiene ${k.texto.length} caracteres (máx ${L.keywordCaracteres}).`);
          if (palabras(k.texto).length > L.keywordPalabras) H('G05', k, dk, `Tiene más de ${L.keywordPalabras} palabras.`);
          if (SIMBOLOS_KW.test(k.texto)) H('G05', k, dk, 'Tiene un símbolo que Google no acepta en keywords.');
          const clave = k.concordancia + '|' + norm(k.texto);
          if (vistas[clave]) H('G05', k, dk, 'Está repetida en el grupo con la misma concordancia.');
          vistas[clave] = true;
          if (k.concordancia === 'amplia') H('P10', k, dk, 'Está en concordancia amplia (el protocolo usa solo exacta y frase).');
        }
        g.keywords.filter(k => k.concordancia === 'exacta' && vistas['frase|' + norm(k.texto)])
          .forEach(k => H('K10', k, dg + ' › Keyword «' + k.texto + '»', 'Está en exacta y en frase: la de frase ya la cubre.'));
        // Negativas del grupo + de campaña contra las keywords del grupo
        for (const n of g.negativas) {
          if (!String(n.texto).trim()) H('G11', n, dg, 'Negativa vacía.');
          else if (palabras(n.texto).length > 10) H('G11', n, dg + ' › Negativa «' + n.texto + '»', 'Tiene más de 10 palabras.');
          if (SIMBOLOS_NEG.test(n.texto)) H('G11', n, dg + ' › Negativa «' + n.texto + '»', 'Tiene un símbolo que Google no acepta en negativas.');
        }
        for (const n of c.negativas.concat(g.negativas)) for (const k of g.keywords)
          if (bloquea(n, k)) H('C01', n, dg + ' › Negativa «' + n.texto + '»', `Bloquea la keyword «${k.texto}» del propio grupo.`, { keywordId: k.id });
        // Anuncios
        for (const a of g.anuncios) {
          const da = dg + ' › Anuncio';
          const T = a.titulos, D = a.descripciones;
          if (T.length < L.titulosMin || T.length > L.titulosMax) H('G06', a, da, `Tiene ${T.length} títulos (deben ser ${L.titulosMin} a ${L.titulosMax}).`);
          if (D.length < L.descripcionesMin || D.length > L.descripcionesMax) H('G06', a, da, `Tiene ${D.length} descripciones (deben ser ${L.descripcionesMin} a ${L.descripcionesMax}).`);
          if (!esUrl(a.urlFinal)) H('G06', a, da, 'La URL final falta o no es http(s).');
          [['ruta1', 'Ruta 1'], ['ruta2', 'Ruta 2']].forEach(([k, nom]) => { if ((a[k] || '').length > L.ruta) H('G06', a, da, `${nom} tiene ${a[k].length} caracteres (máx ${L.ruta}).`); });
          T.forEach((t, i) => {
            const dt = da + ' › Título ' + (i + 1) + ' «' + t.texto + '»';
            if (t.texto.length > L.titulo) H('G06', t, dt, `Tiene ${t.texto.length} caracteres (máx ${L.titulo}).`);
            if (t.texto.includes('!')) H('G16', t, dt, 'Signo de exclamación en un título: riesgo de rechazo.');
            if (t.posicion && !['1', '2', '3'].includes(String(t.posicion))) H('G08', t, dt, `Posición "${t.posicion}" inválida.`);
          });
          D.forEach((d, i) => {
            const dd = da + ' › Descripción ' + (i + 1);
            if (d.texto.length > L.descripcion) H('G06', d, dd, `Tiene ${d.texto.length} caracteres (máx ${L.descripcion}).`);
            if (d.posicion && !['1', '2'].includes(String(d.posicion))) H('G08', d, dd, `Posición "${d.posicion}" inválida.`);
          });
          T.concat(D).forEach(x => { if (/([!?.])\1/.test(x.texto)) H('G07', x, da, `Puntuación repetida en «${x.texto}».`); });
          duplicados(T.map(t => t.texto)).forEach(x => H('G06', a, da, `Título repetido: «${x}».`));
          duplicados(D.map(d => d.texto)).forEach(x => H('G06', a, da, `Descripción repetida: «${x}».`));
          T.concat(D).forEach(x => {
            const gritos = x.texto.split(/\s+/).filter(w => w.length >= 4 && /[A-ZÁÉÍÓÚÑ]/.test(w) && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4,}/.test(w));
            if (gritos.length >= 2) H('G12', x, da, `Mayúsculas excesivas en «${x.texto}».`);
          });
          // C04 · C05
          ['1', '2', '3'].forEach(pos => {
            const n = T.filter(t => String(t.posicion) === pos).length;
            if (n > 3) H('C04', a, da, `${n} títulos fijados en la posición ${pos} (Google recomienda 2 o 3).`);
          });
          const porConjunto = {};
          T.forEach(t => { const k = palabras(t.texto).slice().sort().join(' '); (porConjunto[k] = porConjunto[k] || []).push(t.texto); });
          Object.values(porConjunto).filter(v => v.length > 1 && norm(v[0]) !== norm(v[1])).forEach(v => H('C05', a, da, `Títulos casi iguales: «${v.join('» y «')}».`));
          // C07 relevancia
          if (g.keywords.length && T.length) {
            const tit = ' ' + T.map(t => palabras(t.texto).join(' ')).join(' | ') + ' ';
            const relevante = g.keywords.some(k => {
              const w = palabras(k.texto);
              if (w.length < 2) return tit.includes(' ' + w[0] + ' ');
              for (let i = 0; i < w.length - 1; i++) if (tit.includes(' ' + w[i] + ' ' + w[i + 1] + ' ')) return true;
              return false;
            });
            if (!relevante) H('C07', a, da, 'Ningún título contiene las palabras de las keywords del grupo.');
          }
          // G15 discordancia de destino
          const dA = dominio(a.urlFinal);
          const dK = [...new Set(g.keywords.map(k => dominio(k.urlFinal)).filter(Boolean))];
          if (dA && dK.some(d => !mismoSitio(d, dA))) H('G15', a, da, `El anuncio va a ${dA} y alguna keyword a ${dK.filter(d => !mismoSitio(d, dA)).join(', ')}.`);
          // C08
          if (cifrasFicha) T.concat(D).forEach(x => {
            const inventadas = (x.texto.match(/\d+(?:[.,]\d+)*/g) || []).map(n => n.replace(/[.,]/g, '')).filter(n => !cifrasFicha.has(n));
            if (inventadas.length) H('C08', x, da, `«${x.texto}» trae cifras que no están en la ficha: ${inventadas.join(', ')}.`);
          });
        }
      }
      // C03 vigencia de promociones
      const textos = [];
      c.grupos.forEach(g => g.anuncios.forEach(a => a.titulos.concat(a.descripciones).forEach(x => textos.push(x.texto))));
      c.sitelinks.forEach(s => textos.push(s.texto, s.linea1, s.linea2));
      c.destacados.forEach(d => textos.push(d.texto));
      const fechasPromo = new Set();
      textos.forEach(t => { const m = String(t || '').match(/hasta(?: el)? (\d{1,2})\/(\d{1,2})/i); if (m) fechasPromo.add(m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')); });
      fechasPromo.forEach(md => {
        if (!esFecha(c.fin)) H('C03', c, dc, `Un texto dice "hasta el ${md.slice(3)}/${md.slice(0, 2)}", pero la campaña no tiene fecha de término válida.`);
        else if (c.fin.slice(5) !== md) H('C03', c, dc, `Un texto dice "hasta el ${md.slice(3)}/${md.slice(0, 2)}" y la campaña termina el ${c.fin}.`);
      });
      // ── PROTOCOLO ──
      const esHttps = u => /^https:\/\//i.test(String(u || ''));
      const P = M.PROTOCOLO;
      const TIPOS_PROTO = Object.keys(P.abreviaturaTipo);
      // P01 / P02 nombres
      if (!M.esSlug(c.nombre)) H('P01', c, dc, `Nombre fuera de protocolo. Sugerido: «${M.slugTaxonomia(c.nombre)}».`);
      else if (!/^[a-z]{3}-producto-[a-z0-9]+(-[a-z0-9]+)+$/.test(c.nombre)) H('P02', c, dc, 'El nombre no sigue «chl-producto-<producto>-<tipo>».');
      const tipoCamp = (c.taxonomia && c.taxonomia.tipo) ? M.slugTaxonomia(c.taxonomia.tipo) : (TIPOS_PROTO.find(t => c.nombre.endsWith('-' + t)) || '');
      const abrev = tipoCamp ? (P.abreviaturaTipo[tipoCamp] || tipoCamp) : '';
      for (const g of c.grupos) {
        if (g.soloReferencia) continue;
        const dg = dc + ' › Grupo «' + g.nombre + '»';
        if (!M.esSlug(g.nombre)) H('P01', g, dg, `Nombre fuera de protocolo. Sugerido: «${M.slugTaxonomia(g.nombre)}».`);
        else if (!/^[a-z0-9]+-[a-z0-9-]+$/.test(g.nombre) || (abrev && !g.nombre.startsWith(abrev + '-'))) H('P02', g, dg, `El nombre no sigue «${abrev || '<abreviatura del tipo>'}-<naturaleza>».`);
        for (const a of g.anuncios) {
          const da = dg + ' › Anuncio' + (a.nombre ? ' «' + a.nombre + '»' : '');
          if (!a.nombre) H('P02', a, da, 'El anuncio no tiene nombre de protocolo (ads-<característica>).');
          else if (!M.esSlug(a.nombre)) H('P01', a, da, `Nombre fuera de protocolo. Sugerido: «${M.slugTaxonomia(a.nombre)}».`);
          else if (!/^ads-[a-z0-9]/.test(a.nombre)) H('P02', a, da, 'El nombre del anuncio debe empezar con «ads-».');
          // P03 / P04 títulos
          const fijos1 = a.titulos.filter(t => String(t.posicion) === '1');
          const rotan = a.titulos.filter(t => !t.posicion);
          if (fijos1.length !== P.fijadosPosicion1 || rotan.length !== P.titulosRotativos)
            H('P03', a, da, `Tiene ${fijos1.length} fijados en la posición 1 y ${rotan.length} que rotan (protocolo: ${P.fijadosPosicion1} y ${P.titulosRotativos}).`);
          if (cx.marca) fijos1.filter(t => !norm(t.texto).includes(norm(cx.marca)) && !/\d|%|\$|gratis|dcto|descuento|cuota|oferta|precio|promo/i.test(t.texto))
            .forEach(t => H('P04', t, da + ' › «' + t.texto + '»', 'Título fijado en la posición 1 sin la marca ni una oferta/precio.'));
          // P09 https
          if (a.urlFinal && !esHttps(a.urlFinal)) H('P09', a, da, 'La URL final no usa https://.');
        }
        g.keywords.filter(k => k.urlFinal && !esHttps(k.urlFinal)).forEach(k => H('P09', k, dg + ' › Keyword «' + k.texto + '»', 'La URL final no usa https://.'));
      }
      // P05 / P06 / P07 recursos
      if (c.sitelinks.length < P.sitelinksMin) H('P05', c, dc, `Tiene ${c.sitelinks.length} sitelinks (protocolo: al menos ${P.sitelinksMin}).`);
      const principales = new Set();
      c.grupos.forEach(g => g.anuncios.forEach(a => { if (a.urlFinal) principales.add(String(a.urlFinal).replace(/\/+$/, '').toLowerCase()); }));
      c.sitelinks.forEach(sl => {
        if (principales.has(String(sl.urlFinal || '').replace(/\/+$/, '').toLowerCase())) H('P06', sl, dc + ' › Sitelink «' + sl.texto + '»', 'Lleva a la misma URL que el anuncio: debe ir a otra página.');
        if (sl.urlFinal && !esHttps(sl.urlFinal)) H('P09', sl, dc + ' › Sitelink «' + sl.texto + '»', 'La URL no usa https://.');
      });
      if (c.destacados.length < P.destacadosMin) H('P07', c, dc, `Tiene ${c.destacados.length} textos destacados (protocolo: ${P.destacadosMin} o más).`);
      // P08 UTM
      const utm = c.utmEn === 'plantilla' ? c.plantillaSeguimiento : c.sufijoUrlFinal;
      if (!utm) H('P08', c, dc, 'La campaña no tiene UTM.');
      else {
        const q = {}; String(utm).replace(/^.*?\?/, '').split('&').forEach(par => { const [k, v] = par.split('='); if (k) q[k] = v || ''; });
        const errs = [];
        if (q.utm_source !== P.utmSource) errs.push(`utm_source debe ser «${P.utmSource}»`);
        if (q.utm_medium !== P.utmMedio(c.puja)) errs.push(`utm_medium debe ser «${P.utmMedio(c.puja)}» para «${c.puja}»`);
        if (q.utm_campaign !== M.slugTaxonomia(c.nombre)) errs.push('utm_campaign debe ser el nombre de la campaña');
        Object.values(q).filter(v => v && !/^\{?[a-z0-9-_{}]+\}?$/.test(v)).forEach(v => errs.push(`«${v}» no va en minúsculas con guion`));
        if (errs.length) H('P08', c, dc, 'UTM incorrectas: ' + errs.join('; ') + '.');
      }
      // G13 / G14
      c.fragmentos.filter(f => !M.ENCABEZADOS_FRAGMENTO.map(norm).includes(norm(f.encabezado)))
        .forEach(f => H('G13', f, dc + ' › Fragmento «' + f.encabezado + '»', 'No es un encabezado predefinido de Google.'));
      if (c.precios) {
        const it = c.precios.items || [];
        const dp = dc + ' › Extensión de precio';
        if (it.length < L.precioItemsMin || it.length > L.precioItemsMax) H('G14', c, dp, `Tiene ${it.length} ítems (deben ser ${L.precioItemsMin} a ${L.precioItemsMax}).`);
        it.forEach(x => {
          if (!x.encabezado || x.encabezado.length > L.precioTexto) H('G14', x, dp, `Encabezado «${x.encabezado || ''}» vacío o de más de ${L.precioTexto}.`);
          if ((x.descripcion || '').length > L.precioTexto) H('G14', x, dp, `Descripción de más de ${L.precioTexto}.`);
          if (!Number.isInteger(x.precio) || x.precio <= 0) H('G14', x, dp, `Precio inválido: «${x.precio}» (entero en CLP).`);
          if (!esUrl(x.urlFinal)) H('G14', x, dp, 'Falta la URL propia del ítem.');
          else if (!esHttps(x.urlFinal)) H('P09', x, dp, 'La URL no usa https://.');
        });
      }

      // Recursos
      const dupSl = duplicados(c.sitelinks.map(s => s.texto));
      const dominiosAnuncio = new Set();
      c.grupos.forEach(g => g.anuncios.forEach(a => { const d = dominio(a.urlFinal); if (d) dominiosAnuncio.add(d); }));
      const textosAnuncio = new Set();
      c.grupos.forEach(g => g.anuncios.forEach(a => a.titulos.concat(a.descripciones).forEach(x => textosAnuncio.add(norm(x.texto)))));
      const textosSitelink = new Set(c.sitelinks.map(s => norm(s.texto)));
      c.sitelinks.forEach(s => {
        const ds = dc + ' › Sitelink «' + s.texto + '»';
        if (!s.texto) H('G09', s, ds, 'Sitelink sin texto.');
        if (s.texto.length > L.sitelinkTexto) H('G09', s, ds, `Texto de ${s.texto.length} caracteres (máx ${L.sitelinkTexto}).`);
        [s.linea1, s.linea2].forEach((x, i) => { if ((x || '').length > L.sitelinkLinea) H('G09', s, ds, `Línea ${i + 1} de ${x.length} caracteres (máx ${L.sitelinkLinea}).`); });
        if (!!s.linea1 !== !!s.linea2) H('G09', s, ds, 'Tiene una sola línea de descripción: van las dos o ninguna.');
        if (!esUrl(s.urlFinal)) H('G09', s, ds, 'URL final falta o no es http(s).');
        else if (dominiosAnuncio.size && ![...dominiosAnuncio].some(d => mismoSitio(dominio(s.urlFinal), d))) H('G17', s, ds, `Lleva a ${dominio(s.urlFinal)}, otro dominio que el del anuncio (${[...dominiosAnuncio].join(', ')}).`);
        [s.texto, s.linea1, s.linea2].forEach(x => { if (String(x || '').includes('!')) H('G17', s, ds, `Signo de exclamación en «${x}».`); });
        [s.texto, s.linea1, s.linea2].forEach(x => { if (/([!?.])\1/.test(x || '')) H('G07', s, ds, `Puntuación repetida en «${x}».`); });
      });
      dupSl.forEach(x => H('G09', c, dc, `Sitelink repetido: «${x}».`));
      c.destacados.forEach(d => {
        const dd = dc + ' › Destacado «' + d.texto + '»';
        if (d.texto.length > L.destacado) H('G10', d, dd, `Tiene ${d.texto.length} caracteres (máx ${L.destacado}).`);
        if (textosAnuncio.has(norm(d.texto))) H('G17', d, dd, 'Repite un texto del anuncio.');
        if (textosSitelink.has(norm(d.texto))) H('G17', d, dd, 'Repite el texto de un sitelink.');
        if (d.texto.includes('!')) H('G17', d, dd, 'Signo de exclamación.');
        else if (/^[^\p{L}\p{N}]/u.test(d.texto)) H('G17', d, dd, 'Empieza con puntuación o símbolo.');
        if (/([!?.])\1/.test(d.texto)) H('G07', d, dd, 'Puntuación repetida.');
      });
      duplicados(c.destacados.map(d => d.texto)).forEach(x => H('G10', c, dc, `Destacado repetido: «${x}».`));
      c.fragmentos.forEach(f => {
        const df = dc + ' › Fragmento «' + f.encabezado + '»';
        if (f.valores.length < L.fragmentoValoresMin || f.valores.length > L.fragmentoValoresMax) H('G10', f, df, `Tiene ${f.valores.length} valores (deben ser ${L.fragmentoValoresMin} a ${L.fragmentoValoresMax}).`);
        if (f.valores.length >= L.fragmentoValoresMin && f.valores.length < 4) H('K12', f, df, `Tiene ${f.valores.length} valores (Google recomienda al menos 4).`);
        f.valores.filter(v => v.length > L.fragmentoValor).forEach(v => H('G10', f, df, `Valor «${v}» de ${v.length} caracteres (máx ${L.fragmentoValor}).`));
      });
      c.negativas.forEach(n => {
        if (!String(n.texto).trim()) H('G11', n, dc, 'Negativa vacía.');
        else if (palabras(n.texto).length > 10) H('G11', n, dc + ' › Negativa «' + n.texto + '»', 'Tiene más de 10 palabras.');
        if (SIMBOLOS_NEG.test(n.texto)) H('G11', n, dc + ' › Negativa «' + n.texto + '»', 'Tiene un símbolo que Google no acepta en negativas.');
      });
      negPorCampana.push({ c, set: new Set(c.negativas.map(n => n.concordancia + '|' + norm(n.texto))) });
    }
    // K09 lista compartida
    for (let i = 0; i < negPorCampana.length; i++) for (let j = i + 1; j < negPorCampana.length; j++) {
      const a = negPorCampana[i], b = negPorCampana[j];
      const comunes = [...a.set].filter(x => b.set.has(x)).length;
      if (comunes >= 20) H('K09', b.c, 'Campañas «' + a.c.nombre + '» y «' + b.c.nombre + '»', `Comparten ${comunes} negativas idénticas.`);
    }

    const cuenta = n => hallazgos.filter(h => h.nivel === n).length;
    return { hallazgos, errores: cuenta('error'), avisos: cuenta('aviso'), sugerencias: cuenta('sugerencia'), exportable: cuenta('error') === 0 };
  }

  /* ── Las reglas en texto, tal como se le dan a la IA antes de escribir ── */
  function reglasParaIA() {
    return ['REGLAS QUE TU ENTREGA DEBE CUMPLIR (un "error" bloquea la exportación):']
      .concat(REGLAS.map(r => `- ${r.codigo} [${r.nivel}] ${r.que}`)).join('\n');
  }

  return { REGLAS, validar, reglasParaIA, bloquea };
});
