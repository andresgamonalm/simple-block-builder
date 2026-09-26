/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · MODELO DE CAMPAÑA  (esquema "mp-campana/1")
   ────────────────────────────────────────────────────────────────────────
   Una sola definición de la campaña, espejo de Google Ads Editor. De aquí
   salen tres cosas, y por eso no puede haber otra definición en paralelo:
     1. el EXPORTADOR / IMPORTADOR de Ads Editor   (nucleo/ads-editor.js)
     2. lo que se le explica a la IA               (esquemaParaIA)
     3. el contrato legible para personas          (CONTRATO-CAMPANA.md)

   Jerarquía (igual que en Google Ads):
     Iniciativa ─ campañas[] ─ grupos[] ─ keywords[] · negativas[] · anuncios[]
                              └ ubicaciones · edades excluidas · negativas de campaña
                                sitelinks · destacados · fragmentos

   TODO elemento tiene un `id` estable ("cmp_…", "grp_…", "tit_…"). Es lo que
   permite corregir POR PARTES ("cambia solo los títulos del grupo X") sin
   regenerar la campaña entera.

   Moneda: SIEMPRE pesos chilenos (CLP, enteros). Decisión del usuario.
   Archivo UMD: sirve en el navegador (window.MP_Modelo) y en Node (require).
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.MP_Modelo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION_ESQUEMA = 'mp-campana/1';
  const MONEDA = 'CLP';

  /* ── Límites de Google Ads (Search) ─────────────────────────────────── */
  const LIMITES = {
    titulo: 30,            // anuncio adaptable de búsqueda (RSA)
    titulosMin: 3, titulosMax: 15,
    descripcion: 90,
    descripcionesMin: 2, descripcionesMax: 4,
    ruta: 15,              // Path 1 / Path 2
    sitelinkTexto: 25, sitelinkLinea: 35,
    destacado: 25,         // Callout
    fragmentoValor: 25, fragmentoValoresMin: 3, fragmentoValoresMax: 10,
    keywordCaracteres: 80, keywordPalabras: 10,
    precioTexto: 25, precioItemsMin: 3, precioItemsMax: 8   // extensión de precio
  };

  /* ── PROTOCOLO DE LA CASA (lámina "Reglas y requisitos ADS" del usuario) ──
     Lo que Google permite es más amplio; esto es cómo SE TRABAJA aquí. */
  const PROTOCOLO = {
    fijadosPosicion1: 5,        // 5 títulos fijados en la posición 1, con marca u oferta/precio…
    titulosRotativos: 10,       // …y los 10 siguientes rotan (15 en total)
    sitelinksMin: 4,
    destacadosMin: 4,
    utmSource: 'gads',
    // medio según la puja: clics o conversión ("lo que corresponda")
    utmMedio: puja => /conver|cpa|roas/i.test(String(puja || '')) ? 'conversion' : 'clics',
    // abreviatura del tipo de campaña que abre el nombre de sus grupos (ao-coberturas)
    abreviaturaTipo: { 'always-on': 'ao', 'promociones': 'promo', 'promocion': 'promo' }
  };
  /* Encabezados predefinidos de Google para fragmentos estructurados (es / en). */
  const ENCABEZADOS_FRAGMENTO = ['Servicios', 'Marcas', 'Cursos', 'Programas de grado', 'Destinos', 'Hoteles destacados',
    'Cobertura de seguro', 'Modelos', 'Barrios', 'Catálogo de servicios', 'Programas', 'Estilos', 'Tipos',
    'Amenities', 'Brands', 'Courses', 'Degree programs', 'Destinations', 'Featured hotels', 'Insurance coverage',
    'Models', 'Neighborhoods', 'Service catalog', 'Shows', 'Styles', 'Types'];

  /* Concordancias: el modelo habla español; Ads Editor, inglés. */
  const CONCORDANCIA_A_EDITOR = { exacta: 'Exact', frase: 'Phrase', amplia: 'Broad' };
  const CONCORDANCIA_DESDE_EDITOR = { exact: 'exacta', phrase: 'frase', broad: 'amplia' };

  /* ── EL ESQUEMA ─────────────────────────────────────────────────────────
     Cada entidad: sus campos, qué significan, si son obligatorios, su límite
     y la columna de Ads Editor que les corresponde. `nota` = aclaración para
     la IA y para quien lea el contrato. */
  const ESQUEMA = [
    { entidad: 'iniciativa', titulo: 'Iniciativa', descripcion: 'La acción comercial completa (p. ej. "Auto Digital · Septiembre"). Agrupa una o varias campañas de Google Ads.',
      campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (ini_…). No se muestra ni se exporta.' },
        { campo: 'nombre', tipo: 'texto', obligatorio: true, descripcion: 'Nombre interno de la iniciativa.' },
        { campo: 'moneda', tipo: 'texto', descripcion: 'Siempre "CLP". Todos los montos son pesos chilenos enteros.' },
        { campo: 'campanas', tipo: 'lista de campaña', obligatorio: true, descripcion: 'Las campañas de Google Ads.' }
      ] },
    { entidad: 'campana', titulo: 'Campaña', descripcion: 'Una campaña de Google Ads. Por ahora: Search.',
      campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (cmp_…).' },
        { campo: 'nombre', tipo: 'texto', obligatorio: true, columna: 'Campaign', descripcion: 'Nombre EXACTO en Google Ads. Ads Editor reconoce la campaña por este nombre: cambiarlo después de publicar crea una campaña duplicada. Protocolo: sigla país-producto-nombre del producto-tipo de campaña, p. ej. "chl-producto-auto-digital-always-on".' },
        { campo: 'tipo', tipo: 'texto', obligatorio: true, columna: 'Campaign type', valores: ['Search'], descripcion: 'Tipo de campaña en Google Ads.' },
        { campo: 'redes', tipo: 'lista de texto', obligatorio: true, columna: 'Networks', valores: ['Google Search', 'Search Partners', 'Display Network'], descripcion: 'Redes donde aparece. Separadas por ";" en el CSV. Recomendado: solo "Google Search".' },
        { campo: 'idiomas', tipo: 'lista de texto', obligatorio: true, columna: 'Language', descripcion: 'Códigos de idioma, p. ej. "es".' },
        { campo: 'presupuestoDiario', tipo: 'número (CLP)', obligatorio: true, columna: 'Campaign daily budget', descripcion: 'Presupuesto DIARIO en pesos chilenos, entero, sin puntos ni símbolo.' },
        { campo: 'puja', tipo: 'texto', obligatorio: true, columna: 'Bid strategy type', valores: ['Maximize clicks', 'Maximize conversions', 'Manual CPC', 'Target CPA', 'Target ROAS', 'Maximize conversion value'], descripcion: 'Estrategia de puja.' },
        { campo: 'inicio', tipo: 'fecha AAAA-MM-DD', columna: 'Start date', descripcion: 'Fecha de inicio. Vacía = parte al publicar.' },
        { campo: 'fin', tipo: 'fecha AAAA-MM-DD', columna: 'End date', descripcion: 'Fecha de término. En una promoción debe calzar con su vigencia.' },
        { campo: 'estado', tipo: 'texto', obligatorio: true, columna: 'Campaign Status', valores: ['Enabled', 'Paused'], descripcion: 'Estado al importar. Recomendado: "Paused" para revisar en Ads Editor antes de activar.' },
        { campo: 'politicaUE', tipo: 'texto', columna: 'EU political ads', valores: ['No', 'Yes'], descripcion: 'Declaración de anuncios políticos de la UE. Para Chile: "No".' },
        { campo: 'taxonomia', tipo: '{pais, producto, tipo}', descripcion: 'Partes del nombre según el protocolo: "chl" + "producto" + nombre del producto + tipo de campaña → chl-producto-auto-digital-always-on. Minúsculas, sin tildes ni símbolos, con guion medio.' },
        { campo: 'utmEn', tipo: 'texto', valores: ['sufijo', 'plantilla'], descripcion: 'Dónde van las UTM. "sufijo" (recomendado por Google, permite utm_content por anuncio) o "plantilla" ({lpurl}?utm_…).' },
        { campo: 'plantillaSeguimiento', tipo: 'texto', columna: 'Tracking template', descripcion: 'Plantilla de seguimiento con {lpurl}. Se genera sola si utmEn = "plantilla".' },
        { campo: 'sufijoUrlFinal', tipo: 'texto', columna: 'Final URL suffix', descripcion: 'Parámetros que se agregan a la URL final: utm_source=gads&utm_medium=clics|conversion&utm_campaign=<nombre de la campaña>.' },
        { campo: 'precios', tipo: 'extensión de precio', descripcion: 'Opcional. Tipo + 3 a 8 ítems. (Modelada y validada; su exportación espera confirmar las columnas de Ads Editor.)' },
        { campo: 'ubicaciones', tipo: 'lista de ubicación', descripcion: 'Dónde se muestra. Cada una va en su propia fila del CSV.' },
        { campo: 'edadesExcluidas', tipo: 'lista de edad', descripcion: 'Rangos de edad excluidos ("18-24", "Unknown"…). Cada uno en su fila.' },
        { campo: 'negativas', tipo: 'lista de negativa', descripcion: 'Negativas de campaña: búsquedas por las que NO se paga.' },
        { campo: 'grupos', tipo: 'lista de grupo', obligatorio: true, descripcion: 'Grupos de anuncios. Cada grupo = UNA intención de búsqueda.' },
        { campo: 'sitelinks', tipo: 'lista de sitelink', descripcion: 'Enlaces de sitio a nivel campaña.' },
        { campo: 'destacados', tipo: 'lista de destacado', descripcion: 'Textos destacados (callouts) a nivel campaña.' },
        { campo: 'fragmentos', tipo: 'lista de fragmento', descripcion: 'Fragmentos estructurados a nivel campaña.' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment', descripcion: 'Por qué la campaña está armada así. Viaja en la columna Comment.' }
      ] },
    { entidad: 'ubicacion', titulo: 'Ubicación', campos: [
        { campo: 'nombre', tipo: 'texto', obligatorio: true, columna: 'Location', descripcion: 'Nombre canónico de Google (p. ej. "Santiago Metropolitan Region,Chile").' },
        { campo: 'idGoogle', tipo: 'texto', columna: 'Location ID', descripcion: 'ID de criterio geográfico de Google (p. ej. "20160").' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'edad', titulo: 'Edad excluida', campos: [
        { campo: 'edad', tipo: 'texto', obligatorio: true, columna: 'Age', valores: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'Unknown'] },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'grupo', titulo: 'Grupo de anuncios', descripcion: 'Una intención de búsqueda: sus keywords, sus negativas y su(s) anuncio(s).',
      campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (grp_…).' },
        { campo: 'nombre', tipo: 'texto', obligatorio: true, columna: 'Ad Group', descripcion: 'Nombre EXACTO del grupo (Ads Editor lo reconoce por nombre). Protocolo: <abreviatura del tipo de campaña>-<naturaleza>, p. ej. "ao-coberturas", "promo-cuotas".' },
        { campo: 'estado', tipo: 'texto', columna: 'Ad Group Status', valores: ['Enabled', 'Paused'] },
        { campo: 'keywords', tipo: 'lista de keyword', obligatorio: true },
        { campo: 'negativas', tipo: 'lista de negativa', descripcion: 'Negativas propias del grupo.' },
        { campo: 'anuncios', tipo: 'lista de anuncio', obligatorio: true },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'keyword', titulo: 'Keyword', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (kw_…).' },
        { campo: 'texto', tipo: 'texto', obligatorio: true, columna: 'Keyword', limite: LIMITES.keywordCaracteres, descripcion: 'En minúsculas, sin corchetes ni comillas (la concordancia va aparte).' },
        { campo: 'concordancia', tipo: 'texto', obligatorio: true, columna: 'Type', valores: ['exacta', 'frase'], descripcion: 'En el CSV: Exact / Phrase. La amplia NO se usa en esta app.' },
        { campo: 'estado', tipo: 'texto', columna: 'Status', valores: ['Enabled', 'Paused'] },
        { campo: 'urlFinal', tipo: 'url', columna: 'Final URL' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'negativa', titulo: 'Keyword negativa', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (neg_…).' },
        { campo: 'texto', tipo: 'texto', obligatorio: true, columna: 'Keyword', descripcion: 'El término excluido.' },
        { campo: 'concordancia', tipo: 'texto', obligatorio: true, valores: ['amplia', 'frase', 'exacta'], descripcion: 'Amplia: bloquea búsquedas que contengan TODAS sus palabras en cualquier orden. Frase: esa secuencia. Exacta: solo esa búsqueda. En el CSV: "Campaign negative" + texto tal cual (amplia), "texto" (frase) o [texto] (exacta).' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment', descripcion: 'Motivo de la exclusión.' }
      ] },
    { entidad: 'anuncio', titulo: 'Anuncio adaptable de búsqueda (RSA)', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (rsa_…).' },
        { campo: 'nombre', tipo: 'texto', descripcion: 'Nombre del anuncio según el protocolo: "ads-" + característica (ads-anual, ads-3-cuotas-gratis). Google no tiene campo de nombre para este anuncio: viaja como utm_content y en Comment.' },
        { campo: 'estado', tipo: 'texto', columna: 'Status', valores: ['Enabled', 'Paused'] },
        { campo: 'urlFinal', tipo: 'url', obligatorio: true, columna: 'Final URL', descripcion: 'https:// obligatorio (protocolo).' },
        { campo: 'sufijoUrlFinal', tipo: 'texto', columna: 'Final URL suffix', descripcion: 'UTM del anuncio: las de la campaña + utm_content=<nombre del anuncio>. Reemplaza al sufijo de la campaña para este anuncio.' },
        { campo: 'ruta1', tipo: 'texto', columna: 'Path 1', limite: LIMITES.ruta, descripcion: 'Minúsculas y guiones.' },
        { campo: 'ruta2', tipo: 'texto', columna: 'Path 2', limite: LIMITES.ruta },
        { campo: 'titulos', tipo: 'lista de {id, texto, posicion}', obligatorio: true, columna: 'Headline 1…15 + Headline N position', limite: LIMITES.titulo, descripcion: `Entre ${LIMITES.titulosMin} y ${LIMITES.titulosMax} títulos de hasta ${LIMITES.titulo} caracteres, sin punto final. "posicion" = "1", "2" o "3" si el título va fijado; vacío si rota. PROTOCOLO: 15 títulos = 5 fijados en la posición 1 (con la marca o la oferta/precio) + 10 que rotan.` },
        { campo: 'descripciones', tipo: 'lista de {id, texto, posicion}', obligatorio: true, columna: 'Description 1…4', limite: LIMITES.descripcion, descripcion: `Entre ${LIMITES.descripcionesMin} y ${LIMITES.descripcionesMax} descripciones de hasta ${LIMITES.descripcion} caracteres.` },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'sitelink', titulo: 'Sitelink (enlace de sitio)', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (sl_…).' },
        { campo: 'texto', tipo: 'texto', obligatorio: true, columna: 'Sitelink text', limite: LIMITES.sitelinkTexto, descripcion: 'PROTOCOLO: al menos 4 sitelinks por campaña, cada uno a una página DISTINTA de la URL de destino principal.' },
        { campo: 'linea1', tipo: 'texto', columna: 'Description 1', limite: LIMITES.sitelinkLinea },
        { campo: 'linea2', tipo: 'texto', columna: 'Description 2', limite: LIMITES.sitelinkLinea },
        { campo: 'urlFinal', tipo: 'url', obligatorio: true, columna: 'Final URL' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'destacado', titulo: 'Texto destacado (callout)', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (co_…).' },
        { campo: 'texto', tipo: 'texto', obligatorio: true, columna: 'Callout text', limite: LIMITES.destacado, descripcion: 'PROTOCOLO: recomendado 4 o más por campaña.' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'fragmento', titulo: 'Fragmento estructurado', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (sn_…).' },
        { campo: 'encabezado', tipo: 'texto', obligatorio: true, columna: 'Header', valores: ENCABEZADOS_FRAGMENTO.slice(0, 13), descripcion: 'Uno de los encabezados predefinidos de Google (también se aceptan sus nombres en inglés).' },
        { campo: 'valores', tipo: 'lista de texto', obligatorio: true, columna: 'Snippet Values', limite: LIMITES.fragmentoValor, descripcion: `Entre ${LIMITES.fragmentoValoresMin} y ${LIMITES.fragmentoValoresMax} valores de hasta ${LIMITES.fragmentoValor} caracteres. Separados por ";" en el CSV.` },
        { campo: 'idioma', tipo: 'texto', columna: 'Language' },
        { campo: 'estado', tipo: 'texto', columna: 'Status' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'precio', titulo: 'Extensión de precio (opcional)', descripcion: 'Un tipo y de 3 a 8 ítems, cada uno con su precio en CLP y su propia URL.',
      campos: [
        { campo: 'tipo', tipo: 'texto', obligatorio: true, valores: ['Marcas', 'Eventos', 'Ubicaciones', 'Barrios', 'Categorías de productos', 'Niveles de productos', 'Servicios', 'Categorías de servicios', 'Niveles de servicios'] },
        { campo: 'items', tipo: 'lista de {id, encabezado, descripcion, precio, unidad, urlFinal}', obligatorio: true, limite: LIMITES.precioTexto, descripcion: `Entre ${LIMITES.precioItemsMin} y ${LIMITES.precioItemsMax} ítems. Encabezado y descripción de hasta ${LIMITES.precioTexto} caracteres; precio entero en CLP; unidad opcional (por mes, por año…); URL propia del producto.` }
      ] }
  ];

  /* ── TAXONOMÍA: nombres según el protocolo ──────────────────────────────
     Minúsculas, sin tildes, sin símbolos, palabras unidas con guion medio. */
  const slugTaxonomia = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const esSlug = s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(s || ''));
  // chl-producto-auto-digital-always-on
  const nombreCampana = t => ['' + (t && t.pais || 'chl'), 'producto', t && t.producto, t && t.tipo].map(slugTaxonomia).filter(Boolean).join('-');
  // ao-coberturas / promo-cuotas
  const nombreGrupo = (tipoCampana, naturaleza) => {
    const tipo = slugTaxonomia(tipoCampana);
    return [PROTOCOLO.abreviaturaTipo[tipo] || tipo, slugTaxonomia(naturaleza)].filter(Boolean).join('-');
  };
  // ads-anual / ads-3-cuotas-gratis
  const nombreAnuncio = caracteristica => 'ads-' + slugTaxonomia(caracteristica).replace(/^ads-/, '');

  /* ── UTM según el protocolo ─────────────────────────────────────────────
     source = gads · medium = clics | conversion (según la puja) ·
     campaign = el MISMO nombre de la campaña · content = nombre del anuncio. */
  function utmDe(campana, anuncio) {
    const partes = ['utm_source=' + PROTOCOLO.utmSource, 'utm_medium=' + PROTOCOLO.utmMedio(campana.puja),
      'utm_campaign=' + slugTaxonomia(campana.nombre)];
    if (anuncio && anuncio.nombre) partes.push('utm_content=' + slugTaxonomia(anuncio.nombre));
    return partes.join('&');
  }
  // Escribe las UTM en cada campaña (y sus anuncios) según campana.utmEn.
  function aplicarUTM(ini) {
    for (const c of ini.campanas) {
      if (c.soloReferencia) continue;
      if ((c.utmEn || 'sufijo') === 'plantilla') {
        c.plantillaSeguimiento = '{lpurl}?' + utmDe(c);
        c.sufijoUrlFinal = '';
        c.grupos.forEach(g => g.anuncios.forEach(a => { a.sufijoUrlFinal = ''; }));
      } else {
        c.plantillaSeguimiento = '';
        c.sufijoUrlFinal = utmDe(c);
        c.grupos.forEach(g => g.anuncios.forEach(a => { a.sufijoUrlFinal = a.nombre ? utmDe(c, a) : ''; }));
      }
    }
    return ini;
  }

  /* ── Identificadores estables ───────────────────────────────────────── */
  let _n = 0;
  function uid(prefijo) {
    _n = (_n + 1) % 1296;
    return prefijo + '_' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6) + _n.toString(36);
  }

  /* ── Fábricas: la forma canónica de cada entidad ────────────────────── */
  function nuevaIniciativa(nombre) {
    return { esquema: VERSION_ESQUEMA, id: uid('ini'), nombre: nombre || 'Iniciativa', moneda: MONEDA, campanas: [], extras: [] };
  }
  function nuevaCampana(nombre) {
    return { id: uid('cmp'), nombre: nombre || '', tipo: 'Search', redes: ['Google Search'], idiomas: ['es'],
      presupuestoDiario: null, puja: '', inicio: '', fin: '', estado: 'Paused', politicaUE: 'No',
      ubicaciones: [], edadesExcluidas: [], negativas: [], grupos: [], sitelinks: [], destacados: [], fragmentos: [],
      taxonomia: null, utmEn: 'sufijo', plantillaSeguimiento: '', sufijoUrlFinal: '', precios: null,
      comentario: '' };
  }
  function nuevoGrupo(nombre) {
    return { id: uid('grp'), nombre: nombre || '', estado: 'Enabled', keywords: [], negativas: [], anuncios: [], comentario: '' };
  }
  const nuevaKeyword = (texto, concordancia) => ({ id: uid('kw'), texto: texto || '', concordancia: concordancia || 'exacta', estado: 'Enabled', urlFinal: '', comentario: '' });
  const nuevaNegativa = (texto, concordancia, comentario) => ({ id: uid('neg'), texto: texto || '', concordancia: concordancia || 'amplia', comentario: comentario || '' });
  const nuevoAnuncioRSA = (nombre) => ({ id: uid('rsa'), tipo: 'rsa', nombre: nombre || '', estado: 'Enabled', urlFinal: '', sufijoUrlFinal: '', ruta1: '', ruta2: '', titulos: [], descripciones: [], comentario: '' });
  const nuevoTitulo = (texto, posicion) => ({ id: uid('tit'), texto: texto || '', posicion: posicion || '' });
  const nuevaDescripcion = (texto, posicion) => ({ id: uid('des'), texto: texto || '', posicion: posicion || '' });

  /* ── Índice de IDs: id → ruta legible ("campanas[0].grupos[2]") ─────────
     Base de las correcciones por partes: la IA recibe y devuelve rutas con
     id, nunca la campaña completa. */
  function indiceDeIds(ini) {
    const idx = {};
    const recorrer = (obj, ruta) => {
      if (Array.isArray(obj)) { obj.forEach((x, i) => recorrer(x, ruta + '[' + i + ']')); return; }
      if (!obj || typeof obj !== 'object') return;
      if (obj.id) idx[obj.id] = ruta || '$';
      for (const k of Object.keys(obj)) if (obj[k] && typeof obj[k] === 'object') recorrer(obj[k], (ruta ? ruta + '.' : '') + k);
    };
    recorrer(ini, '');
    return idx;
  }
  function buscarPorId(ini, id) {
    let hallado = null;
    const recorrer = (obj, padre, clave) => {
      if (hallado || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach((x, i) => recorrer(x, obj, i)); return; }
      if (obj.id === id) { hallado = { obj, padre, clave }; return; }
      for (const k of Object.keys(obj)) recorrer(obj[k], obj, k);
    };
    recorrer(ini, null, null);
    return hallado;
  }

  /* ── El esquema en texto, tal como se le explica a la IA ────────────── */
  function esquemaParaIA() {
    const l = [`MODELO DE CAMPAÑA ${VERSION_ESQUEMA} — espejo de Google Ads Editor. Montos en ${MONEDA} (enteros).`,
      'Cada elemento tiene un "id" estable: NUNCA lo cambies ni lo inventes; para agregar, omite el id.'];
    for (const e of ESQUEMA) {
      l.push(`\n[${e.entidad}] ${e.titulo}${e.descripcion ? ' — ' + e.descripcion : ''}`);
      for (const c of e.campos) {
        if (c.campo === 'id') continue;
        const extra = [c.obligatorio ? 'obligatorio' : '', c.limite ? 'máx ' + c.limite + ' car.' : '', c.valores ? 'valores: ' + c.valores.join(' | ') : ''].filter(Boolean).join('; ');
        l.push(`  - ${c.campo} (${c.tipo}${extra ? '; ' + extra : ''})${c.descripcion ? ': ' + c.descripcion : ''}`);
      }
    }
    l.push('\nPROTOCOLO DE NOMBRES: minúsculas, sin tildes, sin símbolos, con guion medio.');
    l.push('  campaña = chl-producto-<producto>-<tipo> (chl-producto-auto-digital-always-on) · grupo = <ao|promo|…>-<naturaleza> (ao-coberturas) · anuncio = ads-<característica> (ads-3-cuotas-gratis).');
    l.push(`PROTOCOLO UTM: utm_source=${PROTOCOLO.utmSource} · utm_medium=clics o conversion (según la puja) · utm_campaign=<nombre exacto de la campaña> · utm_content=<nombre del anuncio>. Todo en minúsculas y con guion medio.`);
    return l.join('\n');
  }

  return { VERSION_ESQUEMA, MONEDA, LIMITES, PROTOCOLO, ENCABEZADOS_FRAGMENTO, ESQUEMA, CONCORDANCIA_A_EDITOR, CONCORDANCIA_DESDE_EDITOR,
    slugTaxonomia, esSlug, nombreCampana, nombreGrupo, nombreAnuncio, utmDe, aplicarUTM,
    uid, nuevaIniciativa, nuevaCampana, nuevoGrupo, nuevaKeyword, nuevaNegativa, nuevoAnuncioRSA, nuevoTitulo, nuevaDescripcion,
    indiceDeIds, buscarPorId, esquemaParaIA };
});
