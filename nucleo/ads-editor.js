/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · IMPORTADOR / EXPORTADOR DE GOOGLE ADS EDITOR
   ────────────────────────────────────────────────────────────────────────
   El CONTRATO es el CSV que el usuario ya sube a Ads Editor y que "se indexa
   muy bien": un solo archivo, UTF-8 con BOM, separado por comas, líneas CRLF, estas 60
   columnas y este orden de filas:
     1. campañas (cada una seguida de sus ubicaciones y edades excluidas)
     2. grupos de anuncios, cada uno seguido de su(s) anuncio(s)
     3. keywords · 4. negativas · 5. sitelinks, destacados y fragmentos por campaña
   Ads Editor reconoce el TIPO de cada fila por las columnas que trae llenas.

   Garantía de ida y vuelta: importar y volver a exportar devuelve el mismo
   archivo. Lo que el modelo no entiende se guarda en `otrasColumnas` (por
   elemento) o en `extras` (filas sueltas) y se devuelve tal cual.
   El exportador es FIEL: no corrige nada. Corregir es trabajo del motor de
   reglas, y así queda a la vista qué cambió y por qué.
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./modelo.js'));
  else raiz.MP_AdsEditor = fabrica(raiz.MP_Modelo);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  const COLUMNAS = ['Campaign', 'Campaign type', 'Networks', 'Language', 'Campaign daily budget', 'Bid strategy type',
    'Start date', 'End date', 'Campaign Status', 'EU political ads', 'Location', 'Location ID', 'Age', 'Ad Group',
    'Ad Group Status', 'Status', 'Type', 'Keyword', 'Final URL', 'Path 1', 'Path 2']
    .concat(Array.from({ length: 15 }, (_, i) => 'Headline ' + (i + 1)))
    .concat(Array.from({ length: 15 }, (_, i) => 'Headline ' + (i + 1) + ' position'))
    .concat(['Description 1', 'Description 2', 'Description 3', 'Description 4', 'Sitelink text', 'Callout text',
      'Header', 'Snippet Values', 'Comment']);

  /* Columnas que se AGREGAN solo si alguna fila las usa (así el archivo de
     referencia, que no las trae, sigue saliendo idéntico). Pendiente de
     confirmar en la primera importación real. */
  const COLUMNAS_OPCIONALES = ['Tracking template', 'Final URL suffix'];

  /* ── CSV: lectura y escritura ───────────────────────────────────────── */
  function leerCSV(texto) {
    texto = String(texto || '').replace(/^\uFEFF/, '');
    const primera = texto.slice(0, texto.search(/\r?\n|$/));
    const sep = primera.includes('\t') ? '\t' : (primera.split(';').length > primera.split(',').length ? ';' : ',');
    const filas = []; let fila = [], campo = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; }
        else campo += c;
      } else if (c === '"') q = true;
      else if (c === sep) { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    const cab = (filas.shift() || []).map(s => s.trim());
    return { columnas: cab, separador: sep,
      filas: filas.filter(f => f.some(x => x !== '')).map(f => { const o = {}; cab.forEach((h, i) => { o[h] = f[i] == null ? '' : f[i]; }); return o; }) };
  }
  const citar = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function escribirCSV(columnas, filas) {
    return '\uFEFF' + [columnas.map(citar).join(',')].concat(filas.map(f => columnas.map(c => citar(f[c])).join(','))).join('\r\n') + '\r\n';
  }

  /* ── Utilidades de valor ────────────────────────────────────────────── */
  const lista = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
  const montoCLP = s => (/^\d+$/.test(String(s).trim()) ? parseInt(s, 10) : (String(s).trim() === '' ? null : String(s)));
  function leerNegativa(textoCrudo) {
    const t = String(textoCrudo || '').trim();
    if (/^\[.*\]$/.test(t)) return { texto: t.slice(1, -1).trim(), concordancia: 'exacta' };
    if (/^".*"$/.test(t)) return { texto: t.slice(1, -1).trim(), concordancia: 'frase' };
    return { texto: t, concordancia: 'amplia' };
  }
  const escribirNegativa = n => n.concordancia === 'exacta' ? '[' + n.texto + ']' : n.concordancia === 'frase' ? '"' + n.texto + '"' : n.texto;

  /* ── IMPORTAR: CSV de Ads Editor → iniciativa ───────────────────────── */
  function importar(texto, nombreIniciativa) {
    const { columnas, filas } = leerCSV(texto);
    const ini = M.nuevaIniciativa(nombreIniciativa || 'Importada de Ads Editor');
    ini.columnasOriginales = columnas;
    const avisos = [];
    const porNombre = {};
    const campana = nombre => {
      if (!porNombre[nombre]) {
        const c = M.nuevaCampana(nombre); c.soloReferencia = true;   // existe en la cuenta, no en este archivo
        porNombre[nombre] = c; ini.campanas.push(c);
      }
      return porNombre[nombre];
    };
    const grupo = (c, nombre) => {
      let g = c.grupos.find(x => x.nombre === nombre);
      if (!g) { g = M.nuevoGrupo(nombre); g.soloReferencia = true; c.grupos.push(g); }
      return g;
    };
    // Guarda lo que la fila trae y el modelo no usó (garantía de ida y vuelta).
    const resto = (fila, usadas) => {
      const o = {};
      for (const k of Object.keys(fila)) if (fila[k] !== '' && !usadas.includes(k)) o[k] = fila[k];
      return Object.keys(o).length ? o : undefined;
    };

    filas.forEach((f, n) => {
      const v = k => (f[k] == null ? '' : f[k]);
      const tipoFila = v('Type').trim().toLowerCase();
      if (!v('Campaign')) { ini.extras.push({ fila: f }); avisos.push(`Fila ${n + 2}: sin campaña; se conserva tal cual.`); return; }

      if (v('Campaign type')) {                                        // 1 · CAMPAÑA
        const c = campana(v('Campaign'));
        delete c.soloReferencia;
        Object.assign(c, { tipo: v('Campaign type'), redes: lista(v('Networks')), idiomas: lista(v('Language')),
          presupuestoDiario: montoCLP(v('Campaign daily budget')), puja: v('Bid strategy type'), inicio: v('Start date'),
          fin: v('End date'), estado: v('Campaign Status'), politicaUE: v('EU political ads'), comentario: v('Comment'),
          plantillaSeguimiento: v('Tracking template'), sufijoUrlFinal: v('Final URL suffix'),
          utmEn: v('Tracking template') && !v('Final URL suffix') ? 'plantilla' : 'sufijo',
          otrasColumnas: resto(f, ['Campaign', 'Campaign type', 'Networks', 'Language', 'Campaign daily budget', 'Bid strategy type', 'Start date', 'End date', 'Campaign Status', 'EU political ads', 'Comment', 'Tracking template', 'Final URL suffix']) });
        return;
      }
      const c = campana(v('Campaign'));
      if (v('Location')) {                                             // UBICACIÓN
        c.ubicaciones.push({ id: M.uid('ubi'), nombre: v('Location'), idGoogle: v('Location ID'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Location', 'Location ID', 'Comment']) });
        return;
      }
      if (/negative/.test(tipoFila) && v('Age')) {                     // EDAD EXCLUIDA
        c.edadesExcluidas.push({ id: M.uid('eda'), edad: v('Age'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Age', 'Type', 'Comment']) });
        return;
      }
      if (/negative/.test(tipoFila) && v('Keyword')) {                 // NEGATIVA (campaña o grupo)
        const nk = leerNegativa(v('Keyword'));
        const neg = Object.assign(M.nuevaNegativa(nk.texto, nk.concordancia, v('Comment')), { tipoOriginal: v('Type'),
          otrasColumnas: resto(f, ['Campaign', 'Ad Group', 'Type', 'Keyword', 'Comment']) });
        (v('Ad Group') ? grupo(c, v('Ad Group')).negativas : c.negativas).push(neg);
        return;
      }
      if (v('Headline 1')) {                                           // ANUNCIO RSA
        const a = M.nuevoAnuncioRSA();
        Object.assign(a, { estado: v('Status'), urlFinal: v('Final URL'), ruta1: v('Path 1'), ruta2: v('Path 2'), comentario: v('Comment'),
          sufijoUrlFinal: v('Final URL suffix'),
          // El anuncio no tiene nombre en Google: se recupera de su utm_content.
          nombre: ((v('Final URL suffix').match(/(?:^|&)utm_content=([^&]*)/) || [])[1] || '') });
        const usadas = ['Campaign', 'Ad Group', 'Status', 'Final URL', 'Path 1', 'Path 2', 'Comment', 'Final URL suffix'];
        for (let i = 1; i <= 15; i++) {
          usadas.push('Headline ' + i, 'Headline ' + i + ' position');
          if (v('Headline ' + i)) a.titulos.push(M.nuevoTitulo(v('Headline ' + i), v('Headline ' + i + ' position')));
        }
        for (let i = 1; i <= 4; i++) {
          usadas.push('Description ' + i, 'Description ' + i + ' position');
          if (v('Description ' + i)) a.descripciones.push(M.nuevaDescripcion(v('Description ' + i), v('Description ' + i + ' position')));
        }
        a.otrasColumnas = resto(f, usadas);
        grupo(c, v('Ad Group')).anuncios.push(a);
        return;
      }
      if (v('Keyword') && M.CONCORDANCIA_DESDE_EDITOR[tipoFila]) {      // KEYWORD
        const k = M.nuevaKeyword(v('Keyword'), M.CONCORDANCIA_DESDE_EDITOR[tipoFila]);
        Object.assign(k, { estado: v('Status'), urlFinal: v('Final URL'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Ad Group', 'Status', 'Type', 'Keyword', 'Final URL', 'Comment']) });
        grupo(c, v('Ad Group')).keywords.push(k);
        return;
      }
      if (v('Sitelink text')) {                                        // SITELINK
        c.sitelinks.push({ id: M.uid('sl'), texto: v('Sitelink text'), linea1: v('Description 1'), linea2: v('Description 2'),
          urlFinal: v('Final URL'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Sitelink text', 'Description 1', 'Description 2', 'Final URL', 'Comment']) });
        return;
      }
      if (v('Callout text')) {                                         // DESTACADO
        c.destacados.push({ id: M.uid('co'), texto: v('Callout text'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Callout text', 'Comment']) });
        return;
      }
      if (v('Header')) {                                               // FRAGMENTO ESTRUCTURADO
        c.fragmentos.push({ id: M.uid('sn'), encabezado: v('Header'), valores: lista(v('Snippet Values')), idioma: v('Language'),
          estado: v('Status'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Header', 'Snippet Values', 'Language', 'Status', 'Comment']) });
        return;
      }
      if (v('Ad Group') && v('Ad Group Status')) {                     // GRUPO
        const g = grupo(c, v('Ad Group'));
        delete g.soloReferencia;
        Object.assign(g, { estado: v('Ad Group Status'), comentario: v('Comment'),
          otrasColumnas: resto(f, ['Campaign', 'Ad Group', 'Ad Group Status', 'Comment']) });
        return;
      }
      ini.extras.push({ fila: f });                                    // lo que no se reconoce: se conserva
      avisos.push(`Fila ${n + 2}: tipo de fila no reconocido; se conserva tal cual al exportar.`);
    });

    const cont = { campanas: 0, grupos: 0, keywords: 0, anuncios: 0, negativas: 0, sitelinks: 0, destacados: 0, fragmentos: 0, ubicaciones: 0 };
    for (const c of ini.campanas) {
      if (!c.soloReferencia) cont.campanas++;
      cont.ubicaciones += c.ubicaciones.length; cont.negativas += c.negativas.length; cont.sitelinks += c.sitelinks.length;
      cont.destacados += c.destacados.length; cont.fragmentos += c.fragmentos.length;
      for (const g of c.grupos) { if (!g.soloReferencia) cont.grupos++; cont.keywords += g.keywords.length; cont.anuncios += g.anuncios.length; cont.negativas += g.negativas.length; }
    }
    return { iniciativa: ini, avisos, conteo: cont, filasLeidas: filas.length };
  }

  /* ── EXPORTAR: iniciativa → CSV de Ads Editor ───────────────────────── */
  function exportarFilas(ini) {
    const filas = [];
    const con = (base, e) => Object.assign({}, e && e.otrasColumnas, base);
    // Negativas y recursos solo llevan Status si lo tienen (p. ej. «Removed» en un archivo de cambios).
    const conEstado = e => e.estado ? { 'Status': e.estado } : {};
    const vis = ini.campanas;
    // 1 · Campañas con sus ubicaciones y edades
    for (const c of vis) {
      if (!c.soloReferencia) filas.push(con({ 'Campaign': c.nombre, 'Campaign type': c.tipo, 'Networks': (c.redes || []).join(';'),
        'Language': (c.idiomas || []).join(';'), 'Campaign daily budget': c.presupuestoDiario == null ? '' : String(c.presupuestoDiario),
        'Bid strategy type': c.puja, 'Start date': c.inicio, 'End date': c.fin, 'Campaign Status': c.estado,
        'EU political ads': c.politicaUE, 'Comment': c.comentario,
        ...(c.plantillaSeguimiento ? { 'Tracking template': c.plantillaSeguimiento } : {}),
        ...(c.sufijoUrlFinal ? { 'Final URL suffix': c.sufijoUrlFinal } : {}) }, c));
      for (const u of c.ubicaciones) filas.push(con({ 'Campaign': c.nombre, 'Location': u.nombre, 'Location ID': u.idGoogle, 'Comment': u.comentario }, u));
      for (const e of c.edadesExcluidas) filas.push(con({ 'Campaign': c.nombre, 'Age': e.edad, 'Type': 'Campaign negative', 'Comment': e.comentario }, e));
    }
    // 2 · Grupos, cada uno seguido de sus anuncios
    for (const c of vis) for (const g of c.grupos) {
      if (!g.soloReferencia) filas.push(con({ 'Campaign': c.nombre, 'Ad Group': g.nombre, 'Ad Group Status': g.estado, 'Comment': g.comentario }, g));
      for (const a of g.anuncios) {
        const f = { 'Campaign': c.nombre, 'Ad Group': g.nombre, 'Status': a.estado, 'Final URL': a.urlFinal, 'Path 1': a.ruta1, 'Path 2': a.ruta2, 'Comment': a.comentario };
        if (a.sufijoUrlFinal) f['Final URL suffix'] = a.sufijoUrlFinal;
        a.titulos.forEach((t, i) => { f['Headline ' + (i + 1)] = t.texto; f['Headline ' + (i + 1) + ' position'] = t.posicion || ''; });
        a.descripciones.forEach((d, i) => { f['Description ' + (i + 1)] = d.texto; if (d.posicion) f['Description ' + (i + 1) + ' position'] = d.posicion; });
        filas.push(con(f, a));
      }
    }
    // 3 · Keywords
    for (const c of vis) for (const g of c.grupos) for (const k of g.keywords)
      filas.push(con({ 'Campaign': c.nombre, 'Ad Group': g.nombre, 'Status': k.estado, 'Type': M.CONCORDANCIA_A_EDITOR[k.concordancia] || k.concordancia,
        'Keyword': k.texto, 'Final URL': k.urlFinal, 'Comment': k.comentario }, k));
    // 4 · Negativas: primero las de grupo, luego las de campaña
    for (const c of vis) for (const g of c.grupos) for (const n of g.negativas)
      filas.push(con({ 'Campaign': c.nombre, 'Ad Group': g.nombre, 'Type': n.tipoOriginal || 'Negative', 'Keyword': escribirNegativa(n), 'Comment': n.comentario, ...conEstado(n) }, n));
    for (const c of vis) for (const n of c.negativas)
      filas.push(con({ 'Campaign': c.nombre, 'Type': n.tipoOriginal || 'Campaign negative', 'Keyword': escribirNegativa(n), 'Comment': n.comentario, ...conEstado(n) }, n));
    // 5 · Recursos por campaña
    for (const c of vis) {
      for (const s of c.sitelinks) filas.push(con({ 'Campaign': c.nombre, 'Sitelink text': s.texto, 'Description 1': s.linea1, 'Description 2': s.linea2, 'Final URL': s.urlFinal, 'Comment': s.comentario, ...conEstado(s) }, s));
      for (const d of c.destacados) filas.push(con({ 'Campaign': c.nombre, 'Callout text': d.texto, 'Comment': d.comentario, ...conEstado(d) }, d));
      for (const s of c.fragmentos) filas.push(con({ 'Campaign': c.nombre, 'Header': s.encabezado, 'Snippet Values': (s.valores || []).join(';'), 'Language': s.idioma, 'Status': s.estado, 'Comment': s.comentario }, s));
    }
    for (const x of ini.extras || []) filas.push(Object.assign({}, x.fila));
    return filas;
  }
  function exportar(ini) {
    const filas = exportarFilas(ini);
    // Columnas: las 60 del contrato + las que traiga algún elemento y no estén.
    const cols = COLUMNAS.slice();
    COLUMNAS_OPCIONALES.forEach(k => { if (filas.some(f => f[k])) cols.push(k); });
    for (const f of filas) for (const k of Object.keys(f)) if (!cols.includes(k)) cols.push(k);
    return escribirCSV(cols, filas);
  }

  /* Nombre del archivo exportado, con la misma taxonomía que los nombres:
     <base>-ads-editor-<aaaa-mm-dd>.csv. base = el nombre de la campaña si es
     una; el prefijo común de sus nombres si son varias; si no, la iniciativa. */
  function nombreArchivo(ini, fecha) {
    const slugs = ini.campanas.filter(c => !c.soloReferencia).map(c => M.slugTaxonomia(c.nombre).split('-')).filter(x => x[0]);
    let base = '';
    if (slugs.length === 1) base = slugs[0].join('-');
    else if (slugs.length > 1) {   // prefijo común: chl-producto-auto-digital-always-on + …-promociones → chl-producto-auto-digital
      const comun = [];
      for (let i = 0; slugs.every(t => t[i] && t[i] === slugs[0][i]); i++) comun.push(slugs[0][i]);
      if (comun.length >= 2) base = comun.join('-');
    }
    base = base || M.slugTaxonomia(ini.nombre) || 'campanas';
    return base + '-ads-editor-' + (fecha || new Date().toISOString().slice(0, 10)) + '.csv';
  }

  return { COLUMNAS, COLUMNAS_OPCIONALES, nombreArchivo, leerCSV, escribirCSV, importar, exportar, exportarFilas };
});
