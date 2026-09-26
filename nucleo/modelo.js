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
    keywordCaracteres: 80, keywordPalabras: 10
  };

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
        { campo: 'nombre', tipo: 'texto', obligatorio: true, columna: 'Campaign', descripcion: 'Nombre EXACTO en Google Ads. Ads Editor reconoce la campaña por este nombre: cambiarlo después de publicar crea una campaña duplicada. Convención: "Search | Producto | Objetivo".' },
        { campo: 'tipo', tipo: 'texto', obligatorio: true, columna: 'Campaign type', valores: ['Search'], descripcion: 'Tipo de campaña en Google Ads.' },
        { campo: 'redes', tipo: 'lista de texto', obligatorio: true, columna: 'Networks', valores: ['Google Search', 'Search Partners', 'Display Network'], descripcion: 'Redes donde aparece. Separadas por ";" en el CSV. Recomendado: solo "Google Search".' },
        { campo: 'idiomas', tipo: 'lista de texto', obligatorio: true, columna: 'Language', descripcion: 'Códigos de idioma, p. ej. "es".' },
        { campo: 'presupuestoDiario', tipo: 'número (CLP)', obligatorio: true, columna: 'Campaign daily budget', descripcion: 'Presupuesto DIARIO en pesos chilenos, entero, sin puntos ni símbolo.' },
        { campo: 'puja', tipo: 'texto', obligatorio: true, columna: 'Bid strategy type', valores: ['Maximize clicks', 'Maximize conversions', 'Manual CPC', 'Target CPA', 'Target ROAS', 'Maximize conversion value'], descripcion: 'Estrategia de puja.' },
        { campo: 'inicio', tipo: 'fecha AAAA-MM-DD', columna: 'Start date', descripcion: 'Fecha de inicio. Vacía = parte al publicar.' },
        { campo: 'fin', tipo: 'fecha AAAA-MM-DD', columna: 'End date', descripcion: 'Fecha de término. En una promoción debe calzar con su vigencia.' },
        { campo: 'estado', tipo: 'texto', obligatorio: true, columna: 'Campaign Status', valores: ['Enabled', 'Paused'], descripcion: 'Estado al importar. Recomendado: "Paused" para revisar en Ads Editor antes de activar.' },
        { campo: 'politicaUE', tipo: 'texto', columna: 'EU political ads', valores: ['No', 'Yes'], descripcion: 'Declaración de anuncios políticos de la UE. Para Chile: "No".' },
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
        { campo: 'nombre', tipo: 'texto', obligatorio: true, columna: 'Ad Group', descripcion: 'Nombre EXACTO del grupo (Ads Editor lo reconoce por nombre). Convención: "AD | Intención".' },
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
        { campo: 'estado', tipo: 'texto', columna: 'Status', valores: ['Enabled', 'Paused'] },
        { campo: 'urlFinal', tipo: 'url', obligatorio: true, columna: 'Final URL' },
        { campo: 'ruta1', tipo: 'texto', columna: 'Path 1', limite: LIMITES.ruta, descripcion: 'Minúsculas y guiones.' },
        { campo: 'ruta2', tipo: 'texto', columna: 'Path 2', limite: LIMITES.ruta },
        { campo: 'titulos', tipo: 'lista de {id, texto, posicion}', obligatorio: true, columna: 'Headline 1…15 + Headline N position', limite: LIMITES.titulo, descripcion: `Entre ${LIMITES.titulosMin} y ${LIMITES.titulosMax} títulos de hasta ${LIMITES.titulo} caracteres, sin punto final. "posicion" = "1", "2" o "3" si el título va fijado; vacío si rota.` },
        { campo: 'descripciones', tipo: 'lista de {id, texto, posicion}', obligatorio: true, columna: 'Description 1…4', limite: LIMITES.descripcion, descripcion: `Entre ${LIMITES.descripcionesMin} y ${LIMITES.descripcionesMax} descripciones de hasta ${LIMITES.descripcion} caracteres.` },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'sitelink', titulo: 'Sitelink (enlace de sitio)', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (sl_…).' },
        { campo: 'texto', tipo: 'texto', obligatorio: true, columna: 'Sitelink text', limite: LIMITES.sitelinkTexto },
        { campo: 'linea1', tipo: 'texto', columna: 'Description 1', limite: LIMITES.sitelinkLinea },
        { campo: 'linea2', tipo: 'texto', columna: 'Description 2', limite: LIMITES.sitelinkLinea },
        { campo: 'urlFinal', tipo: 'url', obligatorio: true, columna: 'Final URL' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'destacado', titulo: 'Texto destacado (callout)', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (co_…).' },
        { campo: 'texto', tipo: 'texto', obligatorio: true, columna: 'Callout text', limite: LIMITES.destacado },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] },
    { entidad: 'fragmento', titulo: 'Fragmento estructurado', campos: [
        { campo: 'id', tipo: 'texto', descripcion: 'Identificador estable (sn_…).' },
        { campo: 'encabezado', tipo: 'texto', obligatorio: true, columna: 'Header', descripcion: 'Uno de los encabezados que acepta Google (p. ej. "Tipos", "Servicios").' },
        { campo: 'valores', tipo: 'lista de texto', obligatorio: true, columna: 'Snippet Values', limite: LIMITES.fragmentoValor, descripcion: `Entre ${LIMITES.fragmentoValoresMin} y ${LIMITES.fragmentoValoresMax} valores de hasta ${LIMITES.fragmentoValor} caracteres. Separados por ";" en el CSV.` },
        { campo: 'idioma', tipo: 'texto', columna: 'Language' },
        { campo: 'estado', tipo: 'texto', columna: 'Status' },
        { campo: 'comentario', tipo: 'texto', columna: 'Comment' }
      ] }
  ];

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
      comentario: '' };
  }
  function nuevoGrupo(nombre) {
    return { id: uid('grp'), nombre: nombre || '', estado: 'Enabled', keywords: [], negativas: [], anuncios: [], comentario: '' };
  }
  const nuevaKeyword = (texto, concordancia) => ({ id: uid('kw'), texto: texto || '', concordancia: concordancia || 'exacta', estado: 'Enabled', urlFinal: '', comentario: '' });
  const nuevaNegativa = (texto, concordancia, comentario) => ({ id: uid('neg'), texto: texto || '', concordancia: concordancia || 'amplia', comentario: comentario || '' });
  const nuevoAnuncioRSA = () => ({ id: uid('rsa'), tipo: 'rsa', estado: 'Enabled', urlFinal: '', ruta1: '', ruta2: '', titulos: [], descripciones: [], comentario: '' });
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
    return l.join('\n');
  }

  return { VERSION_ESQUEMA, MONEDA, LIMITES, ESQUEMA, CONCORDANCIA_A_EDITOR, CONCORDANCIA_DESDE_EDITOR,
    uid, nuevaIniciativa, nuevaCampana, nuevoGrupo, nuevaKeyword, nuevaNegativa, nuevoAnuncioRSA, nuevoTitulo, nuevaDescripcion,
    indiceDeIds, buscarPorId, esquemaParaIA };
});
