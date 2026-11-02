/* ══════════════════════════════════════════════════════════════════
   EDITOR (despachador)  ·  funciones/comun/editor.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Decide qué se dibuja según la pieza: renderCanvas() y renderForm() mandan a banners, a Search o a bloques. También actualizarUISet() (qué botones se ven en cada modo) y la ventana Exportar.
   QUIÉN LO USA: Compartido. Si una función cambia de editor, aquí se cambia el desvío.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
function renderCanvas(){
  livePreviewIntervals.forEach(i => clearInterval(i));
  livePreviewIntervals = [];
  if(esSetPieza(pieza())){ renderTablero(); return; }   // los sets se pintan como tablero
  if(pieza() && pieza().formato==="ads"){ renderAdsCampana(); return; }   // la campaña Search tiene consola propia
  const c = document.getElementById("canvas");
  ajustarFrameParaSet(false);
  const cv = getCanvas();
  if(cv.length === 0){
    c.innerHTML = `<div class="canvas-empty"><div class="canvas-empty-ico">${svgIcon("plantilla",{size:"42px"})}</div><p>Arrastra bloques desde la izquierda<br>o usa una plantilla del menú superior</p><p class="em-hint">Reordena arrastrando · Cambia formato y colores arriba</p></div>`;
    if(!seleccionado) document.getElementById("form").innerHTML = `<div class="form-empty"><div class="form-empty-ico">${svgIcon("editar",{size:"32px"})}</div>Selecciona un bloque del canvas<br>para editar su contenido</div>`;
    return;
  }
  // Las imágenes son arrastrables por defecto y secuestran el gesto: al desactivar
  // su drag nativo, arrastrar sobre la foto mueve el BLOQUE (reordenar).
  temaRenderCtx(getTema());
  c.innerHTML = `<div class="sbb-page" style="${paddingPaginaCSS(getTema())}">${cv.map(bwHTML).join("")}</div>`;
  attachBwListeners(c);
  iniciarLivePreview();
}

function renderForm(){
  const f = document.getElementById("form");
  if(esComposicion(pieza())){ return renderFormTamaño(f); }   // colección por capas: ajustar el tamaño activo
  if(editandoCelda){ return renderFormCelda(f); }   // editando el bloque de una columna del grid
  if(!seleccionado){ f.innerHTML = `<div class="form-empty"><div class="form-empty-ico">${svgIcon("editar",{size:"32px"})}</div>Selecciona un bloque del canvas<br>para editar su contenido</div>`; actualizarPanelDer(); return; }
  const item = getCanvas().find(x => x.id===seleccionado);
  if(!item){ seleccionado=null; renderForm(); return; }
  const def = BLOQUES[item.tipo];
  if(_email3){
    // Bloque bloqueado por la marca: el equipo solo ve la tarjeta del candado.
    if(item.datos && item.datos.bloqueado && !esAdminUI()){
      f.innerHTML = `<div class="lock-card"><div class="lic">${svgIcon("candado",{size:"17px"})}</div><b>${esc(def.nombre)} bloqueado por la marca</b><p>Este bloque lo define el kit de la marca. No se puede editar ni eliminar: así ninguna pieza sale sin él. Pídele el cambio a un administrador.</p></div>`;
      actualizarPanelDer(); renderSaludEmail();
      return;
    }
    // Partición del formulario en las 3 pestañas del panel derecho.
    const iSf = def.campos.findIndex(c => c.grupo === "Identificador");
    const cont = iSf >= 0 ? def.campos.slice(0, iSf) : def.campos.slice();
    const estl = iSf >= 0 ? def.campos.slice(iSf).filter(c => !(c.grupo === "Identificador" || c.key === "compId")) : [];
    let h = `<div class="form-section">`;
    h += `<div class="p3sec" data-p3="contenido">` + (cont.map(c => renderCampo(c, item.datos)).join("") || `<div class="p3hint">Este bloque no tiene contenido editable: revisa Estilos.</div>`) + `</div>`;
    h += `<div class="p3sec" data-p3="estilos">` + estl.map(c => renderCampo(c, item.datos)).join("") + `</div>`;
    h += `<div class="p3sec" data-p3="visual">` + visualCamposHTML(item) + `</div>`;
    h += `</div>`;
    f.innerHTML = h;
    setP3(_p3tab, true);
    actualizarPanelDer(); renderSaludEmail();
    return;
  }
  let html = `<div class="form-section"><h3>${def.icono} ${def.nombre}</h3>`;
  def.campos.forEach(c => { html += renderCampo(c, item.datos); });
  html += `</div>`;
  f.innerHTML = html;
  actualizarPanelDer();
}
// Muestra/oculta los controles del set en la barra superior según la creatividad.
function actualizarUISet(){
  const es = esSetPieza(pieza());
  const esCap = esComposicion(pieza());
  const esAds = pieza() && pieza().formato==="ads";
  const esEmail = pieza() && pieza().formato==="email";
  const tools = document.getElementById("set-tools"); if(tools) tools.style.display = es ? "" : "none";
  // Zonas de la barra por modo (misma lógica siempre): el formato y la vista de
  // dispositivo solo aplican a documentos; "Enviar prueba" solo a email; en la
  // campaña Search no hay imágenes ni importación de HTML.
  const fmt = document.getElementById("tb-formato"); if(fmt) fmt.style.display = (es || esAds) ? "none" : "";
  const dev = document.getElementById("dev-seg"); if(dev) dev.style.display = (es || esAds) ? "none" : "";
  const prueba = document.getElementById("btn-prueba"); if(prueba) prueba.style.display = esEmail ? "" : "none";
  const bimg = document.getElementById("btn-imagenes"); if(bimg) bimg.style.display = esAds ? "none" : "";
  const bimp = document.getElementById("btn-importar"); if(bimp) bimp.style.display = (esAds || es) ? "none" : "";
  if(typeof renderComposicionEditor === "function") renderComposicionEditor();
  // Panel izquierdo: la campaña Search tiene SU panel (no bloques/plantillas,
  // que no existen ahí); el resto usa las pestañas de siempre.
  // Un banner se edita en UN SOLO modulo: las pestanas (Bloques / Diseno /
  // Editar bloque / Plantillas) son del editor de documentos y aqui solo
  // estorban — antes quedaban a la vista, deshabilitadas.
  const tabs = document.querySelector(".panel-tabs"); if(tabs) tabs.style.display = (esAds || esCap) ? "none" : "";
  const paneAds = document.getElementById("pane-ads"); if(paneAds) paneAds.style.display = esAds ? "" : "none";
  if(esAds){
    document.querySelectorAll(".ptab-pane").forEach(p => { if(p.id !== "pane-ads") p.style.display = "none"; });
    if(typeof renderPanelAds === "function") renderPanelAds();
  } else {
    cambiarPanelTab(panelTab || "bloques");
  }
  // Bloqueos coherentes: en colecciones no se editan bloques sueltos ni plantillas.
  const setTab = (id, bloq, titulo) => { const t=document.getElementById(id); if(t){ t.disabled=bloq; t.classList.toggle("disabled",bloq); t.title=bloq?titulo:""; } };
  setTab("ptab-plantillas", es || esAds, esAds ? "La campaña Search se genera con Char-B y se edita en su consola" : "No aplica en colecciones (edita cada banner del tablero)");
  setTab("ptab-bloques", esCap || esAds, esAds ? "La campaña Search se edita directo en su consola (clic en los textos)" : "En colecciones edita las CAPAS (Diseño global / Ajustar tamaño)");
  // Si la pestaña activa quedó bloqueada, mover a una válida.
  if(!esAds && esCap && panelTab!=="diseno") cambiarPanelTab("diseno");   // un solo modulo
  actualizarModoEmail3();
}
// (compat) el set ya no usa ventana; el tablero vive en el lienzo.
function refrescarSetSiAbierto(){}

function abrirExportar(){
  if(!proyecto || proyecto.piezas.length === 0) return;
  const actual = pieza();
  const body = document.getElementById("export-body");
  // Campaña de Google Search: se exporta como CSV para importar en Google Ads
  // (Editor o la interfaz web), no como HTML visual.
  if(actual && actual.formato === "ads"){
    const d = actual.adsData;
    if(!d || !(d.grupos||[]).length){
      body.innerHTML = `<p>Esta campaña aún no tiene datos generados. Créala con <b>Char-B (IA)</b> (el botón de la estrella) para obtener los grupos, keywords y anuncios; entonces podrás exportar el CSV.</p><div class="modal-foot" style="margin-top:18px;border-top:1px solid #e5e7ea;padding-top:14px;"><button onclick="cerrarModal('export')">Cerrar</button></div>`;
      document.getElementById("modal-export").classList.add("show");
      return;
    }
    const nKw = d.grupos.reduce((a,g)=>a+(g.keywords||[]).length,0);
    const nNeg = (d.negativas||[]).length + d.grupos.reduce((a,g)=>a+(g.negativas||[]).length,0);
    const nTit = d.grupos.reduce((a,g)=>a+(g.titulares||[]).length,0);
    const nHojas = 3 + ((d.sitelinks||[]).length ? 1 : 0);
    let h = `<p>Descarga la <b>planilla lista para Google Ads</b> (se importa en Google Ads Editor). Una <b>hoja por tipo de dato</b>, cabeceras en inglés —las únicas que Ads Editor reconoce solo— y los límites de caracteres recortados de nuevo al exportar.</p>
      <div class="export-list">
        <div class="export-row"><label><div><div class="pn">Planilla de la campaña <b>· XLSX</b></div><div class="pf">${nHojas} hojas · ${d.grupos.length} grupo${d.grupos.length!==1?"s":""} · ${nKw} keywords · ${nNeg} negativas · ${nTit} titulares con su columna de posición</div></div></label><button class="download" onclick="descargarPlanillaAds()">${svgIcon("exportar",{size:"13px"})} XLSX</button></div>
        <div class="export-row"><label><div><div class="pn">Keywords en CSV</div><div class="pf">Solo si tu flujo lo necesita; la planilla XLSX es la vía recomendada</div></div></label><button class="download" onclick="descargarCSVKeywords()">${svgIcon("exportar",{size:"13px"})} CSV</button></div>
        <div class="export-row"><label><div><div class="pn">Anuncios en CSV</div><div class="pf">Mismo contenido que la hoja «Anuncios» de la planilla</div></div></label><button class="download" onclick="descargarCSVAnuncios()">${svgIcon("exportar",{size:"13px"})} CSV</button></div>
        <div class="export-row"><label><div><div class="pn">Resumen legible</div><div class="pf">La campaña completa en un HTML para revisar o compartir</div></div></label><button class="download" onclick="descargarPieza('${actual.id}')">${svgIcon("exportar",{size:"13px"})} HTML</button></div>
      </div>
      <div class="modal-foot" style="margin-top:18px;border-top:1px solid #e5e7ea;padding-top:14px;"><button onclick="cerrarModal('export')">Cerrar</button></div>`;
    body.innerHTML = h;
    document.getElementById("modal-export").classList.add("show");
    return;
  }
  // Colección por capas: exportar cada tamaño del set (no bloques).
  if(esComposicion(actual)){
    const sizes = (actual.artboards||[]).map(a=>a.fmt);
    const seg = `<div class="export-tipo" id="export-tipo"><span>Formato:</span>${[['png','PNG (imagen)'],['jpg','JPG (imagen)'],['html','HTML5']].map(([t,l])=>`<button data-t="${t}" class="${exportTipo===t?'on':''}" onclick="setExportTipo('${t}')">${l}</button>`).join('')}</div>`;
    const nMarc = sizes.filter(f=>bannerMarcado(actual,f)).length;
    let h = `<p>Cada banner sale <b>individual y en su tamaño exacto</b>, listo para subir a Google Ads. <b>PNG/JPG</b> = imagen (lo más simple para Google Display y redes); <b>HTML5</b> = anuncio con enlace (incluye <code>ad.size</code> y <code>clickTag</code>, imágenes incrustadas).</p>${seg}`;
    h += `<div class="export-sel"><span>Se exportan los <b id="exp-n">${nMarc}</b> de ${sizes.length} que tengas marcados.</span>`
       + `<button class="lb-link" onclick="marcarExport(true)">Marcar todos</button><button class="lb-link" onclick="marcarExport(false)">Ninguno</button></div>`;
    h += `<p><button class="primary" onclick="exportarTodoZip()">${svgIcon("exportar",{size:"13px"})} Descargar los marcados en un ZIP</button> <span style="font-size:12px;color:#5b6178;">un archivo por tamaño</span></p><div class="export-list" id="export-list">`;
    sizes.forEach(fmt => { const f=FORMATOS[fmt]; if(!f) return;
      h += `<div class="export-row"><label><input type="checkbox" class="exp-ck" ${bannerMarcado(actual,fmt)?"checked":""} onchange="marcarBanner('${fmt}',this.checked);refrescarNExport()"><div><div class="pn">${f.ancho}×${f.alto}${fmt===actual.masterFmt?' <span style="color:#1c73cb;font-weight:600;">· máster</span>':''}${tieneOverride(actual,fmt)?' <span class="ajtag">· ajustado</span>':''}</div><div class="pf">${esc(HINTS[fmt]?.badge||'Display')}</div></div></label><button class="download" onclick="exportarArtboardEn('${fmt}')">${svgIcon("exportar",{size:"13px"})} Descargar</button></div>`;
    });
    h += `</div><div class="modal-foot" style="margin-top:18px;border-top:1px solid #e5e7ea;padding-top:14px;"><button onclick="cerrarModal('export')">Cerrar</button></div>`;
    body.innerHTML = h;
    document.getElementById("modal-export").classList.add("show");
    return;
  }
  // Solo se ofrecen creatividades CON contenido. Abre con la actual marcada;
  // las demás del proyecto quedan disponibles para marcar si quieres.
  const conContenido = proyecto.piezas.filter(p => (p.canvas && p.canvas.length > 0));
  if(!conContenido.length){
    body.innerHTML = `<p>Esta creatividad aún no tiene bloques. Agrega contenido antes de exportar.</p><div class="modal-foot" style="margin-top:18px;border-top:1px solid #e5e7ea;padding-top:14px;"><button onclick="cerrarModal('export')">Cerrar</button></div>`;
    document.getElementById("modal-export").classList.add("show");
    return;
  }
  // La actual primero, luego el resto.
  conContenido.sort((a,b) => (actual && a.id===actual.id ? -1 : actual && b.id===actual.id ? 1 : 0));
  let html = `<p>Se exportará la <b>creatividad actual</b> (marcada). Puedes marcar otras del proyecto si las necesitas. Cada una se descarga como HTML independiente.</p><div class="export-list" id="export-list">`;
  conContenido.forEach(p => {
    const esActual = actual && p.id===actual.id;
    const fmtBadge = HINTS[p.formato]?.badge || p.formato;
    const tag = esActual ? ` <span style="color:#1c73cb;font-weight:600;">· actual</span>` : "";
    html += `<div class="export-row"><label><input type="checkbox" data-id="${p.id}" ${esActual?"checked":""}><div><div class="pn">${esc(p.nombre)}${tag}</div><div class="pf">${esc(fmtBadge)} · ${p.canvas.length} bloque${p.canvas.length!==1?"s":""}</div></div></label><button class="download" onclick="descargarPieza('${p.id}')">${svgIcon("exportar",{size:"13px"})} Descargar</button></div>`;
  });
  html += `</div><div class="modal-foot" style="margin-top:18px;border-top:1px solid #e5e7ea;padding-top:14px;"><button onclick="cerrarModal('export')">Cerrar</button><button onclick="cerrarModal('export');abrirEnvioPrueba()">${svgIcon("enviar",{size:"13px"})} Enviar prueba</button><button onclick="copiarPiezaActual()">${svgIcon("copiar",{size:"14px"})} Copiar HTML actual</button><button class="primary" onclick="descargarSeleccionadas()">${svgIcon("exportar",{size:"13px"})} Descargar seleccionadas</button></div>`;
  body.innerHTML = html;
  document.getElementById("modal-export").classList.add("show");
}
function descargarPieza(id){
  const p = proyecto.piezas.find(x => x.id===id);
  if(!p || (p.canvas.length===0 && !p.adsData)){ toast("Pieza vacía"); return; }
  const html = generarHTMLDePieza(p);
  const blob = new Blob([html], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${slugify(p.nombre)}-${p.formato}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`Descargada: ${p.nombre}`);
}
function descargarSeleccionadas(){
  const checks = document.querySelectorAll("#export-list input[type=checkbox]:checked");
  if(checks.length===0){ toast("Selecciona al menos una pieza"); return; }
  let i=0;
  checks.forEach(ch => { setTimeout(() => descargarPieza(ch.dataset.id), i*350); i++; });
  setTimeout(() => toast(`${checks.length} pieza${checks.length>1?"s":""} descargada${checks.length>1?"s":""}`), checks.length*350+200);
}
function copiarPiezaActual(){
  const p = pieza(); if(!p || p.canvas.length===0){ toast("Pieza vacía"); return; }
  navigator.clipboard.writeText(generarHTMLDePieza(p)).then(()=>toast("HTML copiado"));
}
function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "pieza"; }
function cerrarModal(c){ document.getElementById("modal-"+c).classList.remove("show"); _remountTrasModal(); }
// Si un contenido compartido (marcas/imágenes) estaba en un modal y el dashboard
// sigue visible, re-móntalo en su página al cerrar.
function _remountTrasModal(){ const g=document.getElementById("galeria"); if(g && g.classList.contains("show")) renderGaleria(); }
