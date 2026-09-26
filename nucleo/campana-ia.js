/* ════════════════════════════════════════════════════════════════════════
   MI PUBLICIDAD · NÚCLEO · DE LA IA AL MODELO
   ────────────────────────────────────────────────────────────────────────
   El pipeline de Search (functions/api/ia.js: investigar → estructurar →
   crítico → filtros → ortografía) entrega grupos, keywords, anuncios y
   recursos. Aquí se convierten en una INICIATIVA del modelo (nucleo/modelo.js)
   aplicando el protocolo de la casa: taxonomía de nombres, 5 títulos fijados
   en la posición 1 + los que rotan, UTM, https, estado pausado.
   La iniciativa guarda también su OBJETIVO y la FICHA del producto: las
   correcciones por partes los reutilizan sin volver a investigar.
   Archivo UMD: navegador (window.MP_CampanaIA), Node y funciones de Cloudflare.
   ════════════════════════════════════════════════════════════════════════ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./modelo.js'));
  else raiz.MP_CampanaIA = fabrica(raiz.MP_Modelo);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  const CHILE = { nombre: 'Chile', idGoogle: '2152' };   // criterio geográfico de Google para Chile
  const absoluta = (url, base) => { try { return new URL(url, base).href; } catch (e) { return ''; } };
  const aHttps = u => String(u || '').replace(/^http:\/\//i, 'https://');
  const pocasPalabras = (s, n) => String(s || '').split(/\s+/).filter(Boolean).slice(0, n).join(' ');

  /* datos = respuesta de la IA (formato de generarAds); opciones:
       objetivo {que, accion, gancho, ctaUrl, notas, producto, tipo}
       ficha, pais ('chl'), presupuestoDiario (CLP), puja, fecha (AAAA-MM-DD) */
  function iniciativaDesdeIA(datos, opciones) {
    const o = opciones || {};
    const obj = Object.assign({}, o.objetivo || {});
    const ficha = o.ficha ? Object.assign({}, o.ficha, { actualizada: o.fecha || new Date().toISOString().slice(0, 10) }) : null;
    const pais = M.slugTaxonomia(o.pais || 'chl') || 'chl';
    const tipo = M.slugTaxonomia(obj.tipo || 'always-on') || 'always-on';
    const producto = M.slugTaxonomia(obj.producto || (ficha && ficha.producto) || datos.nombre || 'producto') || 'producto';
    obj.producto = obj.producto || producto; obj.tipo = obj.tipo || tipo;
    const url = aHttps(obj.ctaUrl || datos.urlFinal || '');

    const ini = M.nuevaIniciativa(datos.nombre || obj.que || 'Iniciativa');
    ini.objetivo = obj; ini.ficha = ficha;
    const c = M.nuevaCampana(M.nombreCampana({ pais, producto, tipo }));
    Object.assign(c, {
      taxonomia: { pais, producto, tipo }, tipo: 'Search', redes: ['Google Search'], idiomas: ['es'], estado: 'Paused',
      presupuestoDiario: Number.isInteger(o.presupuestoDiario) && o.presupuestoDiario > 0 ? o.presupuestoDiario : null,
      puja: o.puja || 'Maximize conversions',
      comentario: ficha && ficha.propuestaValor ? String(ficha.propuestaValor).slice(0, 300) : ''
    });
    c.ubicaciones.push({ id: M.uid('ubi'), nombre: CHILE.nombre, idGoogle: CHILE.idGoogle, comentario: '' });

    const motivos = datos.negativasMotivos || {};
    const nombresUsados = new Set();
    for (const g of datos.grupos || []) {
      let nombre = M.nombreGrupo(tipo, g.nombre);
      for (let i = 2; nombresUsados.has(nombre); i++) nombre = M.nombreGrupo(tipo, g.nombre + ' ' + i);
      nombresUsados.add(nombre);
      const grp = M.nuevoGrupo(nombre);
      grp.intencion = g.intencion || '';
      grp.razonamiento = g.razonamiento || '';
      (g.keywords || []).forEach(k => grp.keywords.push(M.nuevaKeyword(k.t, k.tipo === 'frase' ? 'frase' : 'exacta')));
      (g.negativas || []).forEach(n => grp.negativas.push(M.nuevaNegativa(n, 'frase', motivos[n] || '')));
      const a = M.nuevoAnuncioRSA(M.nombreAnuncio(pocasPalabras(g.angulo || g.nombre, 4)));
      a.urlFinal = url; a.ruta1 = g.path1 || ''; a.ruta2 = g.path2 || '';
      // Papel de cada título (enfoque de conversión): viene de la IA en datos.rolesTitulos.
      const rol = t => (datos.rolesTitulos && datos.rolesTitulos[t]) || '';
      (g.titularesFijos || []).forEach(t => a.titulos.push(M.nuevoTitulo(t, '1', rol(t))));
      (g.titularesRotan || []).forEach(t => a.titulos.push(M.nuevoTitulo(t, '', rol(t))));
      (g.descripciones || []).forEach(d => a.descripciones.push(M.nuevaDescripcion(d, '')));
      grp.anuncios.push(a);
      c.grupos.push(grp);
    }
    (datos.negativas || []).forEach(n => c.negativas.push(M.nuevaNegativa(n, 'frase', motivos[n] || '')));
    (datos.sitelinks || []).forEach(s => c.sitelinks.push({ id: M.uid('sl'), texto: s.texto, linea1: s.desc1 || '', linea2: s.desc2 || '',
      urlFinal: aHttps(absoluta(s.url, url || undefined) || s.url), comentario: '' }));
    (datos.destacados || []).forEach(t => c.destacados.push({ id: M.uid('co'), texto: t, comentario: '' }));
    ini.campanas.push(c);
    M.aplicarUTM(ini);
    return ini;
  }

  return { iniciativaDesdeIA, CHILE };
});
