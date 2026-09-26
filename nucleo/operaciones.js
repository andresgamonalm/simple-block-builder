/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · CORRECCIONES POR PARTES
   ────────────────────────────────────────────────────────────────────────
   La IA no reescribe la campaña entera para arreglar un detalle: recibe SOLO
   la parte en cuestión (con sus id) y devuelve OPERACIONES sobre esos id.
   Este módulo es el único que las aplica, y las valida contra el esquema
   (campos permitidos, valores, límites de Google) antes de tocar nada:

     { op: 'cambiar', id, campo, valor }                  cambia un campo
     { op: 'agregar', en: idPadre, lista, elemento }      agrega un elemento (puede traer hijos)
     { op: 'quitar',  id }                                quita un elemento

   aplicar(iniciativa, ops, opciones) → { iniciativa (copia), aplicadas[], rechazadas[{op, motivo}], tocados[] }
   La original nunca se modifica: quien llama decide si guarda (y el guardado
   crea una versión nueva, ver nucleo/versiones.js).
   Archivo UMD: navegador (window.MP_Operaciones), Node y funciones de Cloudflare.
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./modelo.js'));
  else raiz.MP_Operaciones = fabrica(raiz.MP_Modelo);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const L = M.LIMITES;

  /* Qué entidad vive en cada lista, y qué listas admite cada entidad. */
  const ENTIDAD_DE_LISTA = { campanas: 'campana', grupos: 'grupo', keywords: 'keyword', negativas: 'negativa', anuncios: 'anuncio',
    titulos: 'titulo', descripciones: 'descripcion', sitelinks: 'sitelink', destacados: 'destacado', fragmentos: 'fragmento',
    ubicaciones: 'ubicacion', edadesExcluidas: 'edad' };
  const LISTAS_DE = {
    iniciativa: ['campanas'],
    campana: ['grupos', 'negativas', 'sitelinks', 'destacados', 'fragmentos', 'ubicaciones', 'edadesExcluidas'],
    grupo: ['keywords', 'negativas', 'anuncios'],
    anuncio: ['titulos', 'descripciones']
  };
  const MAXIMO_EN_LISTA = { titulos: L.titulosMax, descripciones: L.descripcionesMax };

  /* Campos editables por entidad, sacados del ESQUEMA (una sola definición).
     Quedan fuera: el id, las listas de entidades (se editan con agregar/quitar)
     y los campos compuestos que se generan solos (taxonomía, UTM, precios). */
  const NO_EDITABLES = ['id', 'moneda', 'taxonomia', 'precios', 'plantillaSeguimiento', 'sufijoUrlFinal'];
  // El objetivo y la ficha no tienen id: la ficha cambia con el modo 'investigar'.
  // La extensión de precio aún no se exporta.
  const SIN_OPERACIONES = ['objetivo', 'ficha', 'precio'];
  const CAMPOS = {};
  for (const e of M.ESQUEMA) {
    if (SIN_OPERACIONES.includes(e.entidad)) continue;
    CAMPOS[e.entidad] = {};
    for (const c of e.campos) {
      if (NO_EDITABLES.includes(c.campo)) continue;
      if (/^lista de (?!texto)/.test(c.tipo) || /^\{|^objetivo$|^ficha$|^extensión/.test(c.tipo)) continue;
      CAMPOS[e.entidad][c.campo] = c;
    }
  }
  CAMPOS.titulo = { texto: { tipo: 'texto', obligatorio: true, limite: L.titulo }, posicion: { tipo: 'texto', valores: ['', '1', '2', '3'] } };
  CAMPOS.descripcion = { texto: { tipo: 'texto', obligatorio: true, limite: L.descripcion }, posicion: { tipo: 'texto', valores: ['', '1', '2'] } };

  /* Valida y normaliza UN valor contra la definición del campo. → { ok, valor } | { ok:false, motivo } */
  function validarValor(def, valor) {
    if (/^número/.test(def.tipo)) {
      const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/[$\s.]/g, ''));
      if (!Number.isInteger(n) || n < 0) return { ok: false, motivo: `"${valor}" no es un entero en CLP.` };
      return { ok: true, valor: n };
    }
    if (def.tipo === 'lista de texto') {
      if (!Array.isArray(valor) || valor.some(v => typeof v !== 'string')) return { ok: false, motivo: 'Se esperaba una lista de textos.' };
      const v = valor.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (def.valores && v.some(x => !def.valores.includes(x))) return { ok: false, motivo: `Valores permitidos: ${def.valores.join(', ')}.` };
      const largo = def.limite && v.find(x => x.length > def.limite);
      if (largo) return { ok: false, motivo: `«${largo}» tiene ${largo.length} caracteres (máx ${def.limite}).` };
      return { ok: true, valor: v };
    }
    if (valor == null || typeof valor === 'object') return { ok: false, motivo: 'Se esperaba un texto.' };
    const v = String(valor).replace(/\s+/g, ' ').trim();
    if (def.valores && !def.valores.includes(v)) return { ok: false, motivo: `«${v}» no es válido. Valores permitidos: ${def.valores.filter(Boolean).join(', ')}.` };
    if (def.limite && v.length > def.limite) return { ok: false, motivo: `«${v}» tiene ${v.length} caracteres (máx ${def.limite}).` };
    if (def.obligatorio && !v) return { ok: false, motivo: 'No puede quedar vacío.' };
    return { ok: true, valor: v };
  }

  /* Ubica un id: el objeto, la lista que lo contiene, su entidad y su padre. */
  function ubicar(ini, id) {
    if (ini.id === id) return { obj: ini, entidad: 'iniciativa', lista: null, padre: null };
    let hallado = null;
    const recorrer = (obj, entidad) => {
      for (const lista of LISTAS_DE[entidad] || []) {
        for (const x of obj[lista] || []) {
          if (hallado) return;
          const ent = ENTIDAD_DE_LISTA[lista];
          if (x.id === id) { hallado = { obj: x, entidad: ent, lista, padre: obj, entidadPadre: entidad }; return; }
          recorrer(x, ent);
        }
      }
    };
    recorrer(ini, 'iniciativa');
    return hallado;
  }
  // Campaña que contiene un id (o el id de la campaña misma).
  const campanaDe = (ini, id) => ini.campanas.find(c => c.id === id || !!ubicar({ id: '__', campanas: [c] }, id));

  /* Construye un elemento nuevo con la fábrica del modelo (id nuevo, valores por
     defecto) y le aplica los campos validados. Admite hijos anidados. */
  const FABRICA = {
    campanas: e => M.nuevaCampana(e.nombre), grupos: e => M.nuevoGrupo(e.nombre),
    keywords: e => M.nuevaKeyword(e.texto, e.concordancia), negativas: e => M.nuevaNegativa(e.texto, e.concordancia, e.comentario),
    anuncios: e => M.nuevoAnuncioRSA(e.nombre), titulos: e => M.nuevoTitulo(e.texto, e.posicion), descripciones: e => M.nuevaDescripcion(e.texto, e.posicion),
    sitelinks: () => ({ id: M.uid('sl'), texto: '', linea1: '', linea2: '', urlFinal: '', comentario: '' }),
    destacados: () => ({ id: M.uid('co'), texto: '', comentario: '' }),
    fragmentos: () => ({ id: M.uid('sn'), encabezado: '', valores: [], idioma: 'es', estado: 'Enabled', comentario: '' }),
    ubicaciones: () => ({ id: M.uid('ubi'), nombre: '', idGoogle: '', comentario: '' }),
    edadesExcluidas: () => ({ id: M.uid('eda'), edad: '', comentario: '' })
  };
  function construir(lista, elemento, errores, ruta) {
    const ent = ENTIDAD_DE_LISTA[lista];
    if (!elemento || typeof elemento !== 'object' || Array.isArray(elemento)) { errores.push(`${ruta}: se esperaba un objeto.`); return null; }
    const obj = FABRICA[lista](elemento);
    for (const [k, v] of Object.entries(elemento)) {
      if (k === 'id') continue;                                     // el id lo pone el modelo, nunca la IA
      if ((LISTAS_DE[ent] || []).includes(k)) continue;              // los hijos se procesan abajo
      const def = CAMPOS[ent][k];
      if (!def) { errores.push(`${ruta}: el campo «${k}» no existe en ${ent} o no se edita así.`); continue; }
      const r = validarValor(def, v);
      if (!r.ok) errores.push(`${ruta}.${k}: ${r.motivo}`); else obj[k] = r.valor;
    }
    for (const [k, def] of Object.entries(CAMPOS[ent])) if (def.obligatorio && (obj[k] === '' || obj[k] == null) && !(LISTAS_DE[ent] || []).includes(k)) errores.push(`${ruta}: falta «${k}».`);
    for (const hija of LISTAS_DE[ent] || []) {
      if (elemento[hija] == null) continue;
      if (!Array.isArray(elemento[hija])) { errores.push(`${ruta}.${hija}: se esperaba una lista.`); continue; }
      obj[hija] = elemento[hija].map((x, i) => construir(hija, x, errores, `${ruta}.${hija}[${i}]`)).filter(Boolean);
      if (MAXIMO_EN_LISTA[hija] && obj[hija].length > MAXIMO_EN_LISTA[hija]) errores.push(`${ruta}.${hija}: máximo ${MAXIMO_EN_LISTA[hija]}.`);
    }
    return obj;
  }

  /* ── Aplicar ─────────────────────────────────────────────────────────── */
  function aplicar(original, ops, opciones) {
    const op_ = opciones || {};
    const ini = JSON.parse(JSON.stringify(original));
    const aplicadas = [], rechazadas = [], tocados = new Set(), campanasTocadas = new Set();
    const nombresFijos = new Set(op_.nombresFijos || []);     // ids de campañas/grupos ya publicados
    const no = (op, motivo) => rechazadas.push({ op, motivo });
    for (const op of Array.isArray(ops) ? ops : []) {
      if (!op || typeof op !== 'object') { no(op, 'Operación vacía.'); continue; }
      const cmp = campanaDe(ini, op.id || op.en);
      const n0 = aplicadas.length;
      if (op.op === 'cambiar') {
        const u = ubicar(ini, op.id);
        if (!u) { no(op, `No existe el id «${op.id}».`); continue; }
        const def = CAMPOS[u.entidad] && CAMPOS[u.entidad][op.campo];
        if (!def) { no(op, `«${op.campo}» no es un campo editable de ${u.entidad}.`); continue; }
        if (op.campo === 'nombre' && nombresFijos.has(op.id)) { no(op, 'Ya está publicado: Ads Editor lo reconoce por su nombre y renombrarlo crearía un duplicado.'); continue; }
        const r = validarValor(def, op.valor);
        if (!r.ok) { no(op, r.motivo); continue; }
        u.obj[op.campo] = r.valor;
        aplicadas.push(op); tocados.add(op.id);
      } else if (op.op === 'agregar') {
        const u = ubicar(ini, op.en);
        if (!u) { no(op, `No existe el id «${op.en}».`); continue; }
        if (!(LISTAS_DE[u.entidad] || []).includes(op.lista)) { no(op, `${u.entidad} no tiene la lista «${op.lista}». Admite: ${(LISTAS_DE[u.entidad] || []).join(', ') || 'ninguna'}.`); continue; }
        const errores = [];
        const nuevo = construir(op.lista, op.elemento, errores, op.lista);
        if (errores.length || !nuevo) { no(op, errores.join(' ')); continue; }
        u.obj[op.lista] = u.obj[op.lista] || [];
        if (MAXIMO_EN_LISTA[op.lista] && u.obj[op.lista].length >= MAXIMO_EN_LISTA[op.lista]) { no(op, `Ya tiene ${MAXIMO_EN_LISTA[op.lista]} (el máximo de Google).`); continue; }
        u.obj[op.lista].push(nuevo);
        aplicadas.push(Object.assign({}, op, { idNuevo: nuevo.id })); tocados.add(nuevo.id);
      } else if (op.op === 'quitar') {
        const u = ubicar(ini, op.id);
        if (!u || !u.lista) { no(op, u ? 'La iniciativa no se quita así.' : `No existe el id «${op.id}».`); continue; }
        u.padre[u.lista] = u.padre[u.lista].filter(x => x.id !== op.id);
        aplicadas.push(op); tocados.add(u.padre.id || op.id);
      } else { no(op, `Operación desconocida «${op.op}» (cambiar | agregar | quitar).`); continue; }
      if (cmp && aplicadas.length > n0) campanasTocadas.add(cmp.id);
    }
    // Las UTM salen de los nombres: si la campaña ya las usaba, se recalculan
    // (renombrar un anuncio cambia su utm_content).
    for (const c of ini.campanas) if (campanasTocadas.has(c.id) && (c.sufijoUrlFinal || c.plantillaSeguimiento)) M.aplicarUTM({ campanas: [c] });
    return { iniciativa: ini, aplicadas, rechazadas, tocados: [...tocados] };
  }

  /* ── Lo que se le muestra a la IA ────────────────────────────────────────
     resumen: el índice de la campaña con sus id (pocas líneas).
     vista:   SOLO las partes pedidas, completas, con dónde están. */
  const sinVacios = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'otrasColumnas' || k === 'extras' || v === '' || v === null || (Array.isArray(v) && !v.length)) ? undefined : v));
  function resumen(ini) {
    const l = [];
    for (const c of ini.campanas) {
      if (c.soloReferencia) continue;
      l.push(`campaña [${c.id}] «${c.nombre}» · ${c.presupuestoDiario || '?'} CLP/día · ${c.puja || 'sin puja'} · ${c.negativas.length} negativas · ${c.sitelinks.length} sitelinks · ${c.destacados.length} destacados`);
      for (const g of c.grupos) {
        l.push(`  grupo [${g.id}] «${g.nombre}»${g.intencion ? ' — ' + g.intencion : ''} · ${g.keywords.length} keywords · ${g.negativas.length} negativas`);
        for (const a of g.anuncios) l.push(`    anuncio [${a.id}] ${a.nombre || ''} · ${a.titulos.length} títulos · ${a.descripciones.length} descripciones · «${(a.titulos[0] || {}).texto || ''}»`);
      }
    }
    return l.join('\n');
  }
  function vista(ini, ids) {
    const partes = [], vistos = new Set();
    for (const id of ids || []) {
      const u = ubicar(ini, id);
      if (!u || vistos.has(id)) continue;
      // Si ya se incluyó un ancestro, esta parte ya va dentro.
      const texto = JSON.stringify(u.obj);
      if (partes.some(p => p.json.includes('"id":"' + id + '"'))) continue;
      vistos.add(id);
      partes.push({ id, entidad: u.entidad, dentroDe: u.padre && u.padre.id ? `${u.entidadPadre} [${u.padre.id}] «${u.padre.nombre || ''}»` : '', json: texto, datos: sinVacios(u.obj) });
    }
    return partes.map(({ id, entidad, dentroDe, datos }) => ({ id, entidad, dentroDe, datos }));
  }

  function operacionesParaIA() {
    const l = ['OPERACIONES (tu única forma de cambiar la campaña; nunca la devuelvas entera):',
      '  { "op": "cambiar", "id": "<id existente>", "campo": "<campo>", "valor": <valor> }',
      '  { "op": "agregar", "en": "<id del padre>", "lista": "<lista>", "elemento": { ...campos, sin id } }',
      '  { "op": "quitar", "id": "<id existente>" }',
      'Listas por entidad: ' + Object.entries(LISTAS_DE).map(([e, ls]) => `${e} → ${ls.join(', ')}`).join(' · '),
      'Campos editables:'];
    for (const [e, cs] of Object.entries(CAMPOS)) {
      const ks = Object.entries(cs).map(([k, d]) => k + (d.limite ? `(≤${d.limite})` : '') + (d.valores ? `[${d.valores.filter(Boolean).join('|')}]` : ''));
      if (ks.length) l.push(`  ${e}: ${ks.join(', ')}`);
    }
    l.push('Los id NUNCA se inventan: usa los que ves. Un título o descripción se cambia con su propio id (campo "texto").');
    return l.join('\n');
  }

  return { ENTIDAD_DE_LISTA, LISTAS_DE, CAMPOS, validarValor, ubicar, aplicar, resumen, vista, operacionesParaIA };
});
