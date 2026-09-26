/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · VERSIONES Y ESTADOS DE UNA INICIATIVA
   ────────────────────────────────────────────────────────────────────────
   La iniciativa se guarda por VERSIONES (cada guardado con cambios = una
   versión nueva y completa) y avanza por ESTADOS:

     borrador ─► aprobada ─► exportada ─► publicada
        ▲            │            │            │
        └────────────┴────────────┴────────────┘  (cualquier edición vuelve a borrador)
     cualquiera ─► archivada ─► borrador

   · aprobada   = pasó el motor de reglas sin errores.
   · exportada  = se descargó el archivo para Ads Editor (queda anotada la versión).
   · publicada  = el usuario confirma que lo subió a Google Ads (queda anotada la versión).

   Tras publicar, los NOMBRES de campañas y grupos quedan fijos: Ads Editor
   reconoce campañas y grupos por su nombre, y renombrar crearía un duplicado.
   Una versión posterior se puede exportar COMPLETA o SOLO CAMBIOS (lo nuevo,
   lo modificado y lo eliminado respecto de la versión publicada).

   Todo se compara por `id` estable (el mismo que usa la corrección por partes).
   Archivo UMD: navegador (window.MP_Versiones), Node y funciones de Cloudflare.
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.MP_Versiones = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ESTADOS = ['borrador', 'aprobada', 'exportada', 'publicada', 'archivada'];
  const ETIQUETAS = { borrador: 'Borrador', aprobada: 'Aprobada', exportada: 'Exportada', publicada: 'Publicada', archivada: 'Archivada' };
  const TRANSICIONES = {
    borrador: ['aprobada', 'archivada'],
    aprobada: ['borrador', 'exportada', 'archivada'],
    exportada: ['borrador', 'exportada', 'publicada', 'archivada'],   // re-exportar la misma versión se permite
    publicada: ['borrador', 'archivada'],
    archivada: ['borrador']
  };
  const puedePasar = (de, a) => !!(TRANSICIONES[de] && TRANSICIONES[de].includes(a));

  /* ── Huella: JSON canónico (claves ordenadas) ───────────────────────────
     Dos iniciativas con el mismo contenido dan la misma huella aunque sus
     claves estén en otro orden. sinIds = además ignora los id (para saber si
     un anuncio CAMBIÓ de contenido aunque la IA haya regenerado sus títulos). */
  function canonico(x, sinIds) {
    if (Array.isArray(x)) return '[' + x.map(v => canonico(v, sinIds)).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(k => !(sinIds && k === 'id') && x[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + canonico(x[k], sinIds)).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  const huella = ini => canonico(ini, false);

  /* ── Qué es cada colección, y cómo la reconoce Ads Editor ───────────────
     clave  = lo que identifica al elemento EN ADS EDITOR. Si cambia, el
              elemento es otro: se elimina el anterior y se crea el nuevo.
     El resto de los campos (estado, URL, comentario…) se edita en su lugar. */
  const SIN = (o, ...ks) => { const r = Object.assign({}, o); ks.forEach(k => delete r[k]); return r; };
  const COLECCIONES_CAMPANA = {
    ubicaciones: { entidad: 'ubicación', clave: u => String(u.idGoogle || u.nombre), nombre: u => u.nombre },
    edadesExcluidas: { entidad: 'edad excluida', clave: e => e.edad, nombre: e => e.edad },
    negativas: { entidad: 'negativa de campaña', clave: n => n.concordancia + '|' + n.texto, nombre: n => n.texto },
    sitelinks: { entidad: 'sitelink', clave: s => canonico(SIN(s, 'estado', 'comentario'), true), nombre: s => s.texto },
    destacados: { entidad: 'destacado', clave: d => d.texto, nombre: d => d.texto },
    fragmentos: { entidad: 'fragmento', clave: f => canonico(SIN(f, 'estado', 'comentario'), true), nombre: f => f.encabezado }
  };
  const COLECCIONES_GRUPO = {
    keywords: { entidad: 'keyword', clave: k => k.concordancia + '|' + k.texto, nombre: k => k.texto },
    negativas: { entidad: 'negativa de grupo', clave: n => n.concordancia + '|' + n.texto, nombre: n => n.texto },
    // El anuncio adaptable se reconoce por su contenido: cambiar un título = anuncio nuevo.
    anuncios: { entidad: 'anuncio', clave: a => canonico(SIN(a, 'estado', 'comentario', 'nombre'), true), nombre: a => a.nombre || 'anuncio' }
  };
  const HIJOS_CAMPANA = ['ubicaciones', 'edadesExcluidas', 'negativas', 'grupos', 'sitelinks', 'destacados', 'fragmentos'];
  const HIJOS_GRUPO = ['keywords', 'negativas', 'anuncios'];
  const propios = (o, hijos) => canonico(SIN(o, 'id', ...hijos), true);
  const porId = arr => { const m = new Map(); (arr || []).forEach(x => { if (x && x.id) m.set(x.id, x); }); return m; };

  /* ── Nombres fijos tras publicar ──────────────────────────────────────── */
  function nombresFijos(publicada, actual) {
    const out = [];
    if (!publicada || !actual) return out;
    const cp = porId(publicada.campanas);
    for (const c of actual.campanas || []) {
      const p = cp.get(c.id);
      if (!p) continue;
      if (p.nombre !== c.nombre) out.push({ id: c.id, entidad: 'campaña', antes: p.nombre, ahora: c.nombre });
      const gp = porId(p.grupos);
      for (const g of c.grupos || []) { const q = gp.get(g.id); if (q && q.nombre !== g.nombre) out.push({ id: g.id, entidad: 'grupo', antes: q.nombre, ahora: g.nombre, campana: c.nombre }); }
    }
    return out;
  }

  /* ── Diferencias entre dos versiones, elemento por elemento ─────────────
     → [{ cambio:'nuevo'|'modificado'|'reemplazado'|'eliminado', entidad, id, donde, antes?, ahora? }]
     'reemplazado' = cambió lo que Ads Editor usa para reconocerlo (se sube como
     eliminar el anterior + crear el nuevo). */
  function diferencias(antes, ahora) {
    const out = [];
    const A = porId(antes && antes.campanas), B = porId(ahora && ahora.campanas);
    const coleccion = (defs, pa, pb, donde) => {
      for (const [k, def] of Object.entries(defs)) {
        const ma = porId(pa && pa[k]), mb = porId(pb && pb[k]);
        for (const [id, x] of mb) {
          const y = ma.get(id);
          if (!y) out.push({ cambio: 'nuevo', entidad: def.entidad, id, donde, ahora: x });
          else if (def.clave(y) !== def.clave(x)) out.push({ cambio: 'reemplazado', entidad: def.entidad, id, donde, antes: y, ahora: x });
          else if (canonico(y, true) !== canonico(x, true)) out.push({ cambio: 'modificado', entidad: def.entidad, id, donde, antes: y, ahora: x });
        }
        for (const [id, y] of ma) if (!mb.has(id)) out.push({ cambio: 'eliminado', entidad: def.entidad, id, donde, antes: y });
      }
    };
    for (const [id, c] of B) {
      const p = A.get(id), dc = 'Campaña «' + c.nombre + '»';
      if (!p) { out.push({ cambio: 'nuevo', entidad: 'campaña', id, donde: dc, ahora: c }); continue; }
      if (propios(p, HIJOS_CAMPANA) !== propios(c, HIJOS_CAMPANA)) out.push({ cambio: 'modificado', entidad: 'campaña', id, donde: dc, antes: p, ahora: c });
      coleccion(COLECCIONES_CAMPANA, p, c, dc);
      const GA = porId(p.grupos), GB = porId(c.grupos);
      for (const [gid, g] of GB) {
        const q = GA.get(gid), dg = dc + ' › Grupo «' + g.nombre + '»';
        if (!q) { out.push({ cambio: 'nuevo', entidad: 'grupo', id: gid, donde: dg, ahora: g }); continue; }
        if (propios(q, HIJOS_GRUPO) !== propios(g, HIJOS_GRUPO)) out.push({ cambio: 'modificado', entidad: 'grupo', id: gid, donde: dg, antes: q, ahora: g });
        coleccion(COLECCIONES_GRUPO, q, g, dg);
      }
      for (const [gid, q] of GA) if (!GB.has(gid)) out.push({ cambio: 'eliminado', entidad: 'grupo', id: gid, donde: dc + ' › Grupo «' + q.nombre + '»', antes: q });
    }
    for (const [id, p] of A) if (!B.has(id)) out.push({ cambio: 'eliminado', entidad: 'campaña', id, donde: 'Campaña «' + p.nombre + '»', antes: p });
    return out;
  }

  /* ── Archivo de SOLO CAMBIOS para Ads Editor ────────────────────────────
     Devuelve una iniciativa reducida, lista para pasar por el exportador de
     siempre (nucleo/ads-editor.js):
       · lo nuevo, tal cual;
       · lo modificado en su lugar (misma clave de Ads Editor, otros campos);
       · lo reemplazado: el anterior con Status «Removed» + el nuevo;
       · lo eliminado: con Status «Removed» (columna Status documentada por
         Google para cambiar el estado de keywords, anuncios, etc.).
     Campañas y grupos sin cambios propios van como referencia (sin fila
     propia; sus hijos los nombran). Lo que el archivo no puede expresar con
     seguridad (quitar una ubicación o una edad excluida) va a `manual`. */
  function cambiosParaEditor(publicada, actual) {
    const quitado = x => Object.assign(JSON.parse(JSON.stringify(x)), { estado: 'Removed' });
    const copiaVacia = (c, ref) => Object.assign(JSON.parse(JSON.stringify(SIN(c, ...HIJOS_CAMPANA))), ref ? { soloReferencia: true } : {},
      { ubicaciones: [], edadesExcluidas: [], negativas: [], grupos: [], sitelinks: [], destacados: [], fragmentos: [] });
    const grupoVacio = (g, ref) => Object.assign(JSON.parse(JSON.stringify(SIN(g, ...HIJOS_GRUPO))), ref ? { soloReferencia: true } : {},
      { keywords: [], negativas: [], anuncios: [] });
    const ini = Object.assign(JSON.parse(JSON.stringify(SIN(actual, 'campanas', 'extras'))), { campanas: [], extras: [] });
    const manual = [];
    const resumen = { nuevos: 0, modificados: 0, reemplazados: 0, eliminados: 0 };
    const A = porId(publicada.campanas);

    const aplicar = (defs, pa, pb, destino, dc) => {
      for (const [k, def] of Object.entries(defs)) {
        const ma = porId(pa && pa[k]), mb = porId(pb[k]);
        for (const [id, x] of mb) {
          const y = ma.get(id);
          if (!y) { destino[k].push(JSON.parse(JSON.stringify(x))); resumen.nuevos++; }
          else if (def.clave(y) !== def.clave(x)) {
            if (k === 'ubicaciones' || k === 'edadesExcluidas') manual.push(`${dc}: quitar ${def.entidad} «${def.nombre(y)}» a mano en Ads Editor.`);
            else destino[k].push(quitado(y));
            destino[k].push(JSON.parse(JSON.stringify(x))); resumen.reemplazados++;
          } else if (canonico(y, true) !== canonico(x, true)) { destino[k].push(JSON.parse(JSON.stringify(x))); resumen.modificados++; }
        }
        for (const [id, y] of ma) if (!mb.has(id)) {
          if (k === 'ubicaciones' || k === 'edadesExcluidas') manual.push(`${dc}: quitar ${def.entidad} «${def.nombre(y)}» a mano en Ads Editor.`);
          else destino[k].push(quitado(y));
          resumen.eliminados++;
        }
      }
    };

    for (const c of actual.campanas || []) {
      const p = A.get(c.id), dc = 'Campaña «' + c.nombre + '»';
      if (!p) { ini.campanas.push(JSON.parse(JSON.stringify(c))); resumen.nuevos++; continue; }
      const cambioPropio = propios(p, HIJOS_CAMPANA) !== propios(c, HIJOS_CAMPANA);
      if (cambioPropio) resumen.modificados++;
      const cc = copiaVacia(c, !cambioPropio);
      aplicar(COLECCIONES_CAMPANA, p, c, cc, dc);
      const GA = porId(p.grupos);
      for (const g of c.grupos || []) {
        const q = GA.get(g.id);
        if (!q) { cc.grupos.push(JSON.parse(JSON.stringify(g))); resumen.nuevos++; continue; }
        const gPropio = propios(q, HIJOS_GRUPO) !== propios(g, HIJOS_GRUPO);
        if (gPropio) resumen.modificados++;
        const gg = grupoVacio(g, !gPropio);
        aplicar(COLECCIONES_GRUPO, q, g, gg, dc + ' › Grupo «' + g.nombre + '»');
        if (gPropio || HIJOS_GRUPO.some(k => gg[k].length)) cc.grupos.push(gg);
      }
      for (const q of p.grupos || []) if (!(c.grupos || []).some(g => g.id === q.id)) {
        cc.grupos.push(Object.assign(grupoVacio(q, false), { estado: 'Removed' })); resumen.eliminados++;
      }
      if (cambioPropio || HIJOS_CAMPANA.some(k => cc[k].length)) ini.campanas.push(cc);
    }
    for (const p of publicada.campanas || []) if (!(actual.campanas || []).some(c => c.id === p.id)) {
      ini.campanas.push(Object.assign(copiaVacia(p, false), { estado: 'Removed' })); resumen.eliminados++;
    }
    ini.campanas = ini.campanas.filter(c => !c.soloReferencia || HIJOS_CAMPANA.some(k => c[k].length));
    const total = resumen.nuevos + resumen.modificados + resumen.reemplazados + resumen.eliminados;
    return { iniciativa: ini, manual, resumen, total };
  }

  return { ESTADOS, ETIQUETAS, TRANSICIONES, puedePasar, canonico, huella, nombresFijos, diferencias, cambiosParaEditor };
});
