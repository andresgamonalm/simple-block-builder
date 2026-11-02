/* ══════════════════════════════════════════════════════════════════
   DOCUMENTOS · EDITOR DE BLOQUES  ·  funciones/documentos/editor-bloques.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Biblioteca de bloques, lienzo de bloques, formularios, grid, edición directa, arrastrar/soltar, importar HTML y exportar el documento.
   QUIÉN LO USA: Piezas de email y libre.
   SECCIONES (en orden):
     1. Celdas del grid en el LIENZO: clic para llenarlas/editarlas
     2. EDICIÓN DIRECTA EN EL LIENZO
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Ícono SVG por tipo de bloque (reemplaza los emojis de la biblioteca).
const BLOQUE_ICONO = {
  heading:"heading", video:"video",
  header:"heading", texto:"textoico", imagen:"imagen", cta:"cursor", imgtext:"columnas",
  divisor:"divisor", espaciador:"espaciador", diadivisor:"calendario", fechaCard:"calendario",
  evento:"reloj", mapa:"mapa", clima:"climaico", reloj:"reloj", countdown:"timer",
  formulario:"formularioico", social:"compartir", icono:"estrella", codigo:"codigoico",
  tabla:"tablaico", grid:"grid", kpi:"barchart", ring:"ring", statGrid:"grid",
  spark:"trending", rating:"estrella", product:"carrito", profileCard:"usuario",
  testimonial:"chat", article:"documento", pricing:"tag", hero:"imagen", alert:"alerta",
  features:"checklist", audio:"audioico", footer:"footerico", seccion:"heading", seccionlibre:"grid",
  bandaHeader:"heading", bandaHeaderBlanco:"heading", bandaFooter:"footerico", bandaFooterBlanco:"footerico"
};
// Bloques de documento/agenda que no tienen sentido en un banner de tamaño fijo
// (display/social): se ocultan de la biblioteca cuando el formato es un banner.
const BLOQUES_SOLO_DOC = new Set(["footer","bandaHeader","bandaHeaderBlanco","bandaFooter","bandaFooterBlanco","diadivisor","fechaCard","evento","formulario","tabla"]);
// Curación por sección: en /email-ia la biblioteca muestra SOLO los bloques de email
// (los del mockup + header/footer de marca + estructura básica). En /free van todos.
const BLOQUES_EMAIL_IA = new Set(["bandaHeader","bandaHeaderBlanco","bandaFooter","bandaFooterBlanco","seccion","grid","hero","heading","video","texto","imagen","cta","divisor","espaciador","features","kpi","audio","formulario","social","icono"]);
// En /ads-ia la pieza es una CAMPAÑA de texto: solo bloques de texto/datos.
const BLOQUES_ADS_IA = new Set(["texto","tabla","divisor","espaciador","alert"]);
function renderBiblioteca(){
  const cont = document.getElementById("biblioteca");
  if(!cont) return;
  const fmt = FORMATOS[getFormato()] || {};
  const esBannerFijo = fmt.alto > 0;   // display/social fijos → sin bloques de email/agenda
  const sec = (typeof rutaDeProducto==="function") ? rutaDeProducto(pieza()) : null;
  const permitido = (tipo) => !(esBannerFijo && BLOQUES_SOLO_DOC.has(tipo)) && (sec!=="/email-ia" || BLOQUES_EMAIL_IA.has(tipo)) && (sec!=="/ads-ia" || BLOQUES_ADS_IA.has(tipo));
  const cats = {};
  Object.entries(BLOQUES).forEach(([tipo,b]) => { if(!permitido(tipo)) return; const c=b.cat||"Otros"; if(!cats[c])cats[c]=[]; cats[c].push([tipo,b]); });
  const orden = ["Estructura","Contenido","Acción","Agenda","Datos","Cards","Multimedia","Widgets","Decoración","Avanzado"];
  let html = "";
  orden.concat(Object.keys(cats).filter(c=>!orden.includes(c))).forEach(cat => {
    if(!cats[cat] || !cats[cat].length) return;
    html += `<div class="cat-title">${cat}</div>`;
    cats[cat].forEach(([tipo,b]) => {
      html += `<div class="tile" draggable="true" data-tipo="${tipo}"><div class="tile-ico">${svgIcon(BLOQUE_ICONO[tipo]||"estrella",{size:"18px"})}</div><div><div class="tile-name">${b.nombre}</div><div class="tile-sub">${b.sub}</div></div><span class="tile-help" data-tip="${escAttr(b.sub)}">?</span></div>`;
    });
  });
  cont.innerHTML = html;
  cont.querySelectorAll(".tile").forEach(tile => {
    tile.addEventListener("dragstart", (e) => { tile.classList.add("dragging"); dragInfo={fuente:"biblioteca",tipo:tile.dataset.tipo}; e.dataTransfer.effectAllowed="copy"; try{e.dataTransfer.setData("text/plain",tile.dataset.tipo);}catch(_){}});
    tile.addEventListener("dragend", () => { tile.classList.remove("dragging"); document.getElementById("canvas-frame").classList.remove("drag-over"); limpiarDropLines(); });
    tile.addEventListener("click", () => agregarBloque(tile.dataset.tipo));   // clic = añadir al lienzo/artboard activo
    tile.style.cursor = "pointer";
  });
}

function ejecutarScriptsCodigo(){
  document.querySelectorAll(".sbb-codigo script:not([data-sbb-ran])").forEach(oldScript => {
    try{
      const newScript = document.createElement("script");
      [...oldScript.attributes].forEach(a => newScript.setAttribute(a.name, a.value));
      newScript.textContent = oldScript.textContent;
      newScript.setAttribute("data-sbb-ran","1");
      oldScript.parentNode.replaceChild(newScript, oldScript);
    }catch(e){}
  });
}
function iniciarLivePreview(){
  // Reloj en vivo
  document.querySelectorAll("[data-reloj]").forEach(el => {
    const tick = () => {
      const showSeg = el.dataset.segundos === "1";
      const showFecha = el.dataset.fecha === "1";
      const h24 = el.dataset.h24 === "1";
      const now = new Date();
      let h = now.getHours();
      const ampm = h >= 12 ? "PM" : "AM";
      if(!h24){ h = h % 12 || 12; }
      const hh = String(h).padStart(2,"0");
      const mm = String(now.getMinutes()).padStart(2,"0");
      const ss = String(now.getSeconds()).padStart(2,"0");
      const horaEl = el.querySelector(".hora");
      if(horaEl){
        horaEl.innerHTML = `${hh}<span class="sep">:</span>${mm}${showSeg?`<span class="sep">:</span><span class="seg">${ss}</span>`:""}${!h24?` <span class="seg">${ampm}</span>`:""}`;
      }
      if(showFecha){
        const fechaEl = el.querySelector(".fecha");
        if(fechaEl){
          const dow = DIAS_ES[now.getDay()];
          const dowCap = dow.charAt(0).toUpperCase() + dow.slice(1);
          fechaEl.textContent = `${dowCap}, ${now.getDate()} de ${MESES_ES[now.getMonth()]}`;
        }
      }
    };
    tick();
    livePreviewIntervals.push(setInterval(tick, 1000));
  });
  // Countdown live
  document.querySelectorAll("[data-countdown]").forEach(el => {
    const tick = () => {
      const target = new Date(el.dataset.target).getTime();
      let diff = Math.max(0, target - Date.now());
      const dias = Math.floor(diff/86400000); diff -= dias*86400000;
      const hrs = Math.floor(diff/3600000); diff -= hrs*3600000;
      const mins = Math.floor(diff/60000); diff -= mins*60000;
      const segs = Math.floor(diff/1000);
      const units = el.querySelectorAll(".unit .num");
      if(units[0]) units[0].textContent = String(dias).padStart(2,"0");
      if(units[1]) units[1].textContent = String(hrs).padStart(2,"0");
      if(units[2]) units[2].textContent = String(mins).padStart(2,"0");
      if(units[3]) units[3].textContent = String(segs).padStart(2,"0");
    };
    tick();
    livePreviewIntervals.push(setInterval(tick, 1000));
  });
  ejecutarScriptsCodigo();
}

// Calcula en qué posición (índice del array canvas) caería un drop según la Y
// del cursor, recorriendo todos los bloques del lienzo. Permite soltar en
// cualquier punto: entre bloques, antes del primero o después del último.
function calcularDropIndex(y){
  const bws = [...document.querySelectorAll("#canvas .bw")];
  for(let i=0;i<bws.length;i++){
    const r = bws[i].getBoundingClientRect();
    if(y < r.top + r.height/2) return i;
  }
  return bws.length;
}
// Dibuja la línea-guía en la posición de inserción calculada.
function mostrarDropLineEn(idx){
  limpiarDropLines();
  const page = document.querySelector("#canvas .sbb-page");
  if(!page) return;
  const bws = page.querySelectorAll(".bw");
  const line = document.createElement("div"); line.className = "drop-line";
  if(idx >= bws.length) page.appendChild(line);
  else page.insertBefore(line, bws[idx]);
}
function limpiarDropLines(){ document.querySelectorAll(".drop-line").forEach(el => el.remove()); }
// Formulario para el bloque de una columna del grid (con vuelta a la grilla).
function renderFormCelda(f){
  const grid = getCanvas().find(x => x.id === editandoCelda.gridId);
  const cell = grid && grid.datos.celdas && grid.datos.celdas[editandoCelda.idx];
  if(!cell || !cell.tipo || !BLOQUES[cell.tipo]){ editandoCelda = null; return renderForm(); }
  const def = BLOQUES[cell.tipo];
  let html = `<button class="volver-celda" onclick="cerrarEdicionCelda()">${svgIcon("chevup",{size:"12px"})} Volver a la grilla</button>`;
  html += `<div class="form-section"><h3>${def.icono||""} ${esc(def.nombre)} <span class="celda-col">· columna ${editandoCelda.idx+1}</span></h3>`;
  def.campos.forEach(c => { html += renderCampo(c, cell.datos); });
  html += `</div>`;
  f.innerHTML = html;
}
function cerrarEdicionCelda(){ editandoCelda = null; renderForm(); }
function renderCampo(c, datos){
  if(c.tipo === "mergetag") return mergeTagUI();
  if(c.grupo) return `<div class="form-group-title">${esc(c.grupo)}</div>`;
  if(c.tipo === "row2") return `<div class="form-row-2col">${renderCampoSimple(c.izq, datos)}${renderCampoSimple(c.der, datos)}</div>`;
  if(c.tipo === "gridCeldas") return renderGridCeldasCampo(datos);
  return renderCampoSimple(c, datos);
}
// Editor de las columnas del grid: por cada columna, eliges qué BLOQUE va dentro
// (cualquiera de la biblioteca) y lo editas con sus propios campos.
function renderGridCeldasCampo(datos){
  // Sincroniza el nº de celdas-editables con la DISPOSICIÓN (columnas o mosaico),
  // así el formulario muestra los mismos huecos que se ven en el lienzo.
  const cols = (typeof gridSpec==="function") ? gridSpec(datos).cells : (parseInt(datos.columnas)||3);
  if(!Array.isArray(datos.celdas)) datos.celdas = [];
  // Muestra max(cols, últimaCeldaConContenido+1): recorta vacías sobrantes y rellena hasta cols.
  let ultLlena=-1; for(let i=0;i<datos.celdas.length;i++){ if(datos.celdas[i] && datos.celdas[i].tipo) ultLlena=i; }
  const n = Math.max(cols, ultLlena+1);
  datos.celdas = datos.celdas.slice(0, n);
  while(datos.celdas.length < n) datos.celdas.push({});
  const cells = datos.celdas;
  let h = `<div class="form-row"><label>Celdas — elige el bloque de cada una <small>(o haz clic en una celda del lienzo)</small></label><div class="gcells">`;
  cells.forEach((cell, idx) => {
    const tipo = (cell && cell.tipo) || "";
    h += `<div class="gcell"><div class="gcell-top"><span class="gcell-n">Celda ${idx+1}</span><span class="gcell-acc"><button class="si-btn" onclick="moverCelda(${idx},-1)" title="Subir">↑</button><button class="si-btn" onclick="moverCelda(${idx},1)" title="Bajar">↓</button><button class="si-btn del" onclick="eliminarCelda(${idx})" title="Quitar">×</button></span></div>
      <select class="gcell-sel" onchange="cambiarTipoCelda(${idx},this.value)">${tiposCeldaOptions(tipo)}</select>
      ${tipo && BLOQUES[tipo] ? `<button class="gcell-edit" onclick="editarCelda(${idx})">${svgIcon("editar",{size:"12px"})} Editar contenido</button>` : ``}</div>`;
  });
  h += `<button class="add-subitem" onclick="agregarCelda()">+ Agregar celda</button></div></div>`;
  return h;
}
function tiposCeldaOptions(sel){
  const excl = new Set(["grid","columnas"]);   // no anidamos contenedores
  const grupos = {};
  Object.entries(BLOQUES).forEach(([k,b]) => { if(excl.has(k)) return; (grupos[b.cat||"Otros"] = grupos[b.cat||"Otros"] || []).push([k, b.nombre]); });
  let h = `<option value="">— vacío —</option>`;
  Object.entries(grupos).forEach(([cat,arr]) => { h += `<optgroup label="${esc(cat)}">` + arr.map(([v,l]) => `<option value="${v}" ${sel===v?"selected":""}>${esc(l)}</option>`).join("") + `</optgroup>`; });
  return h;
}
function renderCeldaContenido(c){
  if(!c || !c.tipo) return "";
  if(c.datos && BLOQUES[c.tipo]) return BLOQUES[c.tipo].render(c.datos);
  return renderCeldaLegacy(c);   // compatibilidad con celdas del formato antiguo (plano)
}
function renderCeldaLegacy(c){
  if(!c || !c.tipo) return "";
  if(c.tipo==="texto") return `<div class="sbb-grid-text">${c.titulo?`<h3>${esc(c.titulo)}</h3>`:""}${c.texto?`<p>${escMultiline(c.texto)}</p>`:""}</div>`;
  if(c.tipo==="imagen") return `<div class="sbb-grid-img"><img src="${esc(c.url||'https://placehold.co/300x200/e5e7ea/9ca3af?text=Imagen')}" alt="">${c.caption?`<div class="cap">${esc(c.caption)}</div>`:""}</div>`;
  if(c.tipo==="kpi") return `<div class="sbb-grid-kpi"><div class="num">${esc(c.num||'')}</div><div class="lbl">${esc(c.lbl||'')}</div></div>`;
  if(c.tipo==="icono-texto") return `<div class="sbb-grid-icon"><div class="ic">${c.icono?svgIcon(c.icono,{size:"30px"}):''}</div>${c.titulo?`<div class="t">${esc(c.titulo)}</div>`:""}${c.sub?`<div class="s">${esc(c.sub)}</div>`:""}</div>`;
  if(c.tipo==="cta") return `<a class="sbb-grid-cta" href="${esc(c.url||'#')}" target="_blank" rel="noopener">${esc(c.texto||'CTA')}</a>`;
  return "";
}
function gridSel(){ return getCanvas().find(x => x.id === seleccionado); }
function agregarCelda(){ const g=gridSel(); if(!g) return; if(!Array.isArray(g.datos.celdas)) g.datos.celdas=[]; g.datos.celdas.push({}); persistir(); renderBloqueSeleccionado(); renderForm(); }
function eliminarCelda(idx){ const g=gridSel(); if(!g||!Array.isArray(g.datos.celdas)) return; g.datos.celdas.splice(idx,1); if(editandoCelda && editandoCelda.idx===idx) editandoCelda=null; persistir(); renderBloqueSeleccionado(); renderForm(); }
function moverCelda(idx,delta){ const g=gridSel(); if(!g||!Array.isArray(g.datos.celdas)) return; const arr=g.datos.celdas; const j=idx+delta; if(j<0||j>=arr.length) return; [arr[idx],arr[j]]=[arr[j],arr[idx]]; persistir(); renderBloqueSeleccionado(); renderForm(); }
function cambiarTipoCelda(idx,tipo){ const g=gridSel(); if(!g) return; if(!Array.isArray(g.datos.celdas)) g.datos.celdas=[]; while(g.datos.celdas.length<=idx) g.datos.celdas.push({}); g.datos.celdas[idx] = (tipo && BLOQUES[tipo]) ? { tipo, datos: clone(BLOQUES[tipo].defaults) } : {}; persistir(); renderBloqueSeleccionado(); renderForm(); }
function editarCelda(idx){ const g=gridSel(); if(!g) return; const cell=(g.datos.celdas||[])[idx]; if(!cell||!cell.tipo||!BLOQUES[cell.tipo]){ toast("Elige un bloque para esta columna primero"); return; } editandoCelda={gridId:g.id, idx}; renderForm(); cambiarPanelTab("editar"); }

// ── Celdas del grid en el LIENZO: clic para llenarlas/editarlas ───────────
// Clic en una columna: vacía → elegir bloque; con contenido → editar ese bloque.
function clicCeldaGrid(gridId, idx, anchorEl, ev){
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  const g = getCanvas().find(x => x.id === gridId); if(!g) return;
  seleccionado = gridId;
  document.querySelectorAll(".bw").forEach(b => b.classList.toggle("selected", b.dataset.id===gridId));
  const cell = (g.datos.celdas||[])[idx];
  if(cell && cell.tipo && BLOQUES[cell.tipo]){ editarCelda(idx); }
  else { editandoCelda = null; renderForm(); cambiarPanelTab("editar"); abrirPickerCelda(gridId, idx, anchorEl); }
}
// Engancha el clic Y el arrastre-soltar de las celdas de un grid (idx por posición en el DOM).
function attachCeldasDeGrid(bw){
  const item = getCanvas().find(x => x.id === bw.dataset.id);
  if(!item || item.tipo !== "grid") return;
  bw.querySelectorAll(".sbb-grid-cell").forEach((cellEl, idx) => {
    cellEl.classList.add("cell-interactiva");
    cellEl.addEventListener("click", (e) => clicCeldaGrid(bw.dataset.id, idx, cellEl, e));
    // Soltar un bloque de la biblioteca DENTRO de la celda (no como hermano).
    cellEl.addEventListener("dragover", (e) => {
      if(dragInfo && dragInfo.fuente==="biblioteca" && dragInfo.tipo!=="grid" && dragInfo.tipo!=="columnas"){
        e.preventDefault(); e.stopPropagation(); cellEl.classList.add("cell-drop");
      }
    });
    cellEl.addEventListener("dragleave", () => cellEl.classList.remove("cell-drop"));
    cellEl.addEventListener("drop", (e) => {
      if(!(dragInfo && dragInfo.fuente==="biblioteca")) return;
      if(dragInfo.tipo==="grid" || dragInfo.tipo==="columnas") return;
      e.preventDefault(); e.stopPropagation(); cellEl.classList.remove("cell-drop");
      const tipo = dragInfo.tipo; dragInfo = null; limpiarDropLines();
      if(!BLOQUES[tipo]) return;
      seleccionado = bw.dataset.id;
      cambiarTipoCelda(idx, tipo);   // llena ESA celda
      editarCelda(idx);              // abre su editor
    });
  });
}
// Hace editable EN EL LIENZO el HTML pegado en un bloque de código:
// al seleccionar el bloque, su texto se edita en línea y sus <img> se pueden
// cambiar con un clic. Los cambios se guardan de vuelta en datos.codigo.
function attachCodigoEditable(bw){
  const item = getCanvas().find(x => x.id === bw.dataset.id);
  if(!item || item.tipo !== "codigo") return;
  const cont = bw.querySelector(".sbb-codigo");
  if(!cont) return;   // bloque vacío: nada que editar todavía
  const editable = () => seleccionado === item.id;
  cont.setAttribute("contenteditable", editable() ? "true" : "false");
  // Guarda el HTML editado de vuelta en el dato (sin re-render, para no perder el cursor).
  const guardar = () => {
    const html = cont.innerHTML;
    if(item.datos.codigo !== html){ item.datos.codigo = html; persistir(); }
  };
  cont.addEventListener("blur", guardar, true);
  cont.addEventListener("input", () => { clearTimeout(cont._guardarT); cont._guardarT = setTimeout(guardar, 600); });
  // Clic en una imagen → elegir otra de la biblioteca (solo en modo edición).
  cont.querySelectorAll("img").forEach(img => {
    img.addEventListener("click", (e) => {
      if(!editable()) return;
      e.preventDefault(); e.stopPropagation();
      abrirImagenes((url) => { img.setAttribute("src", url); guardar(); });
    });
  });
}
// ── EDICIÓN DIRECTA EN EL LIENZO ──────────────────────────────────────────────
// Al seleccionar un bloque, sus elementos marcados se editan in situ:
//   data-edit="campo"      → texto editable en línea (se guarda en datos[campo])
//   data-edit-img="campo"  → clic abre la biblioteca y cambia la imagen
//   data-edit-link="campo" → clic en el botón pide/edita su enlace (URL)
// El "campo" admite rutas anidadas para ítems de lista, p. ej. "items.0.t".
function _leerRuta(obj, ruta){ return ruta.split(".").reduce((o,k)=> (o==null?undefined:o[k]), obj); }
function _escribirRuta(obj, ruta, val){
  const ks = ruta.split("."); const last = ks.pop();
  let o = obj; for(const k of ks){ if(o[k]==null) o[k] = /^\d+$/.test(ks[ks.indexOf(k)+1]||last) ? [] : {}; o = o[k]; }
  o[last] = val;
}
function attachInlineEdit(bw){
  const item = getCanvas().find(x => x.id === bw.dataset.id);
  if(!item || !BLOQUES[item.tipo]) return;
  const activo = () => seleccionado === item.id;
  // Texto editable
  bw.querySelectorAll("[data-edit]").forEach(el => {
    el.setAttribute("contenteditable", activo() ? "true" : "false");
    if(el._inlineBound) return; el._inlineBound = true;
    el.classList.add("inline-edit");
    const key = el.getAttribute("data-edit");
    const guardar = () => {
      const txt = el.innerText.replace(/ /g, " ").replace(/\n$/, "");
      if(_leerRuta(item.datos, key) !== txt){ _escribirRuta(item.datos, key, txt); persistir(); }
    };
    el.addEventListener("blur", guardar);
    el.addEventListener("input", () => { clearTimeout(el._t); el._t = setTimeout(guardar, 600); });
    // Enter no debe meter saltos en campos de una línea (títulos, botones).
    el.addEventListener("keydown", (e) => { if(e.key==="Enter" && el.dataset.linea==="1"){ e.preventDefault(); el.blur(); } });
  });
  // Imágenes editables
  bw.querySelectorAll("[data-edit-img]").forEach(img => {
    if(img._inlineImgBound) return; img._inlineImgBound = true;
    img.style.cursor = "pointer";
    img.addEventListener("click", (e) => {
      if(!activo()) return;
      e.preventDefault(); e.stopPropagation();
      abrirImagenes((url) => { item.datos[img.getAttribute("data-edit-img")] = url; persistir(); renderBloqueSeleccionado(); });
    });
  });
  // Enlaces de botones editables
  bw.querySelectorAll("[data-edit-link]").forEach(btn => {
    if(btn._inlineLinkBound) return; btn._inlineLinkBound = true;
    btn.addEventListener("click", (e) => {
      if(!activo()) return;
      e.preventDefault();   // no navegar al editar
    });
    btn.addEventListener("dblclick", (e) => {
      if(!activo()) return;
      e.preventDefault(); e.stopPropagation();
      const key = btn.getAttribute("data-edit-link");
      const actual = item.datos[key] || "";
      const url = window.prompt("Enlace del botón (URL):", actual);
      if(url !== null){ item.datos[key] = url.trim(); persistir(); toast("Enlace guardado"); }
    });
  });
}
// Popover para elegir qué bloque va en una columna (mismo catálogo que el desplegable).
let _pickerCelda = null;
function cerrarPickerCelda(){ if(_pickerCelda){ _pickerCelda.remove(); _pickerCelda=null; document.removeEventListener("click", _cerrarPickerFuera, true); document.removeEventListener("keydown", _cerrarPickerEsc, true); } }
function _cerrarPickerFuera(e){ if(_pickerCelda && !_pickerCelda.contains(e.target)) cerrarPickerCelda(); }
function _cerrarPickerEsc(e){ if(e.key==="Escape") cerrarPickerCelda(); }
function abrirPickerCelda(gridId, idx, anchorEl){
  cerrarPickerCelda();
  const excl = new Set(["grid","columnas"]);
  const grupos = {};
  Object.entries(BLOQUES).forEach(([k,b]) => { if(excl.has(k)) return; (grupos[b.cat||"Otros"] = grupos[b.cat||"Otros"] || []).push([k, b.nombre]); });
  let h = `<div class="cellpick-h">Elige un bloque para la columna ${idx+1}</div>`;
  Object.entries(grupos).forEach(([cat,arr]) => { h += `<div class="cellpick-cat">${esc(cat)}</div>` + arr.map(([v,l]) => `<button class="cellpick-it" data-tipo="${esc(v)}">${esc(l)}</button>`).join(""); });
  const el = document.createElement("div"); el.className = "cellpick"; el.innerHTML = h;
  document.body.appendChild(el);
  const r = anchorEl.getBoundingClientRect();
  el.style.top = Math.max(10, Math.min(window.innerHeight - el.offsetHeight - 10, r.top)) + "px";
  el.style.left = Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, r.left)) + "px";
  el.querySelectorAll(".cellpick-it").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const tipo = btn.dataset.tipo;
    cerrarPickerCelda();
    seleccionado = gridId;
    cambiarTipoCelda(idx, tipo);   // crea/llena la celda
    editarCelda(idx);              // y abre su editor de contenido
  }));
  _pickerCelda = el;
  setTimeout(() => { document.addEventListener("click", _cerrarPickerFuera, true); document.addEventListener("keydown", _cerrarPickerEsc, true); }, 0);
}
function renderCampoSimple(c, datos){
  const val = datos[c.key];
  if(c.tipo === "check") return `<div class="form-row checkbox"><input type="checkbox" id="f-${c.key}" ${val?"checked":""} onchange="actualizarDato('${c.key}',this.checked)"><label for="f-${c.key}">${esc(c.label)}</label></div>`;
  if(c.tipo === "textarea") return `<div class="form-row"><label>${esc(c.label)}</label><textarea oninput="actualizarDato('${c.key}',this.value)">${esc(val||"")}</textarea></div>`;
  if(c.tipo === "imgurl") return `<div class="form-row"><label>${esc(c.label)}</label><input type="text" value="${esc(val||"")}" placeholder="${esc(c.placeholder||'https://…')}" oninput="actualizarDato('${c.key}',this.value)"><button class="img-biblio-btn" onclick="elegirImagenPara('${c.key}')">${svgIcon("imagen",{size:"12px"})} Elegir de la biblioteca</button></div>`;
  if(c.tipo === "color") return `<div class="form-row"><label>${esc(c.label)}</label><input type="color" value="${esc(val||"#000000")}" oninput="actualizarDato('${c.key}',this.value)"></div>`;
  if(c.tipo === "colorOpt"){
    const tiene = val && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(val).trim());
    return `<div class="form-row"><label>${esc(c.label)}</label><span style="display:inline-flex;gap:6px;align-items:center;"><input type="color" value="${esc(tiene?val:"#ffffff")}" oninput="actualizarDato('${c.key}',this.value)"><button type="button" class="img-biblio-btn" onclick="actualizarDato('${c.key}','');renderForm()">${tiene?"Quitar":"Sin fondo"}</button></span></div>`;
  }
  if(c.tipo === "date") return `<div class="form-row"><label>${esc(c.label)}</label><input type="date" value="${esc(val||"")}" onchange="actualizarDato('${c.key}',this.value)"></div>`;
  if(c.tipo === "time") return `<div class="form-row"><label>${esc(c.label)}</label><input type="time" value="${esc(val||"")}" onchange="actualizarDato('${c.key}',this.value)"></div>`;
  if(c.tipo === "datetime-local") return `<div class="form-row"><label>${esc(c.label)}</label><input type="datetime-local" value="${esc(val||"")}" onchange="actualizarDato('${c.key}',this.value)"></div>`;
  if(c.tipo === "select"){
    const opts = (c.opciones||[]).map(([v,t]) => `<option value="${esc(v)}" ${v===val?"selected":""}>${esc(t)}</option>`).join("");
    return `<div class="form-row"><label>${esc(c.label)}</label><select onchange="actualizarDato('${c.key}',this.value)">${opts}</select></div>`;
  }
  if(c.tipo === "range") return `<div class="form-row"><label>${esc(c.label)}</label><div class="range-row"><input type="range" min="${c.min}" max="${c.max}" step="${c.step||1}" value="${esc(val)}" oninput="actualizarDato('${c.key}',this.value);var n=this.parentElement.querySelector('.rnum');if(n)n.value=this.value;"><input type="number" class="rnum" min="${c.min}" max="${c.max}" step="${c.step||1}" value="${esc(val)}" oninput="actualizarDato('${c.key}',this.value);var s=this.parentElement.querySelector('input[type=range]');if(s)s.value=this.value;"></div></div>`;
  if(c.tipo === "alignH") return `<div class="form-row"><label>${esc(c.label)}</label><div class="align-picker"><button title="Izquierda" class="${val==="left"?"on":""}" onclick="actualizarDato('${c.key}','left');renderForm();">${ICONS.alignLeft}</button><button title="Centro" class="${val==="center"?"on":""}" onclick="actualizarDato('${c.key}','center');renderForm();">${ICONS.alignCenter}</button><button title="Derecha" class="${val==="right"?"on":""}" onclick="actualizarDato('${c.key}','right');renderForm();">${ICONS.alignRight}</button><button title="Justificado" class="${val==="justify"?"on":""}" onclick="actualizarDato('${c.key}','justify');renderForm();">${ICONS.alignJustify}</button></div></div>`;
  if(c.tipo === "alignV") return `<div class="form-row"><label>${esc(c.label)}</label><div class="align-picker"><button title="Arriba" class="${val==="top"?"on":""}" onclick="actualizarDato('${c.key}','top');renderForm();">${ICONS.alignTop}</button><button title="Centro" class="${val==="center"?"on":""}" onclick="actualizarDato('${c.key}','center');renderForm();">${ICONS.alignMiddle}</button><button title="Abajo" class="${val==="bottom"?"on":""}" onclick="actualizarDato('${c.key}','bottom');renderForm();">${ICONS.alignBottom}</button></div></div>`;
  if(c.tipo === "icono-picker"){
    const opts = Object.entries(ICONOS_SVG).map(([k,v]) =>
      `<button class="ic-pick ${k===val?'on':''}" title="${esc(v.nombre)}" onclick="actualizarDato('${c.key}','${k}');renderForm();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v.svg}</svg></button>`
    ).join("");
    return `<div class="form-row"><label>${esc(c.label)} (${Object.keys(ICONOS_SVG).length} disponibles)</label><div class="icon-grid">${opts}</div></div>`;
  }
  if(c.tipo === "codigo-textarea"){
    return `<div class="form-row"><label>${esc(c.label)}</label><textarea class="codigo-textarea" oninput="actualizarDato('${c.key}',this.value)" placeholder="<style>...<\/style>&#10;<div>...<\/div>&#10;<script>...<\/script>" spellcheck="false">${esc(val||"")}</textarea><div style="font-size:10.5px;color:#888;margin-top:4px;">${svgIcon("alerta",{size:"12px"})} El JS funciona en el HTML exportado y en navegadores. En email los &lt;script&gt; se ignoran. Refrescar si tu CSS no aparece.</div></div>`;
  }
  if(c.tipo === "lista"){
    const items = Array.isArray(val) ? val : [];
    let h = `<div class="form-row"><label>${esc(c.label)}</label><div class="sublist">`;
    if(items.length === 0) h += `<div class="sublist-empty">No hay elementos. Agrega uno abajo.</div>`;
    items.forEach((it, idx) => {
      const tipoSel = (c.itemTipos||[]).find(t => t.valor === it.tipo) || (c.itemTipos||[])[0];
      const opts = (c.itemTipos||[]).map(t => `<option value="${esc(t.valor)}" ${t.valor===it.tipo?"selected":""}>${esc(t.label)}</option>`).join("");
      h += `<div class="subitem"><div class="subitem-head"><select onchange="actualizarItemLista('${c.key}',${idx},'tipo',this.value)">${opts}</select><button class="si-btn" onclick="moverItemLista('${c.key}',${idx},-1)">↑</button><button class="si-btn" onclick="moverItemLista('${c.key}',${idx},1)">↓</button><button class="si-btn del" onclick="eliminarItemLista('${c.key}',${idx})">×</button></div><div class="subitem-fields">`;
      (tipoSel?.camposItem||[]).forEach(ci => {
        if(ci.tipo === "icono"){
          const grid = Object.entries(ICONOS_SVG).map(([k,v]) =>
            `<button class="ic-pick ${k===it[ci.k]?'on':''}" title="${esc(v.nombre)}" onclick="actualizarItemLista('${c.key}',${idx},'${ci.k}','${k}');renderForm();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v.svg}</svg></button>`
          ).join("");
          h += `<div><label>${esc(ci.l)} (elige uno)</label><div class="icon-grid">${grid}</div></div>`;
        } else if(ci.tipo === "textarea"){
          h += `<div><label>${esc(ci.l)}</label><textarea rows="2" oninput="actualizarItemLista('${c.key}',${idx},'${ci.k}',this.value)">${esc(it[ci.k]||"")}</textarea></div>`;
        } else {
          h += `<div><label>${esc(ci.l)}</label><input type="text" value="${esc(it[ci.k]||"")}" oninput="actualizarItemLista('${c.key}',${idx},'${ci.k}',this.value)"></div>`;
        }
      });
      h += `</div></div>`;
    });
    h += `<button class="add-subitem" onclick="agregarItemLista('${c.key}')">+ Agregar elemento</button></div></div>`;
    return h;
  }
  return `<div class="form-row"><label>${esc(c.label)}</label><input type="text" value="${esc(val||"")}" placeholder="${esc(c.placeholder||"")}" oninput="actualizarDato('${c.key}',this.value)"></div>`;
}

function agregarItemLista(key){
  const item = bloqueCtx(); if(!item) return;
  const def = BLOQUES[item.tipo];
  const todosCampos = def.campos.flatMap(c => c.tipo==="row2"?[c.izq,c.der]:[c]);
  const campo = todosCampos.find(c => c.key===key);
  if(!campo) return;
  const tipoBase = (campo.itemTipos||[])[0];
  if(!item.datos[key]) item.datos[key] = [];
  const nuevo = { tipo: tipoBase ? tipoBase.valor : "" };
  (tipoBase?.camposItem||[]).forEach(ci => nuevo[ci.k] = "");
  item.datos[key].push(nuevo);
  persistir(); renderForm(); renderBloqueSeleccionado();
}
function actualizarItemLista(key, idx, prop, valor){
  const item = bloqueCtx(); if(!item) return;
  if(!item.datos[key] || !item.datos[key][idx]) return;
  item.datos[key][idx][prop] = valor;
  persistir(); renderBloqueSeleccionado();
  if(prop==="tipo") renderForm();
}
function eliminarItemLista(key, idx){
  const item = bloqueCtx(); if(!item) return;
  if(!item.datos[key]) return;
  item.datos[key].splice(idx, 1);
  persistir(); renderForm(); renderBloqueSeleccionado();
}
function moverItemLista(key, idx, delta){
  const item = bloqueCtx(); if(!item) return;
  const arr = item.datos[key];
  if(!arr) return;
  const j = idx + delta;
  if(j<0 || j>=arr.length) return;
  [arr[idx], arr[j]] = [arr[j], arr[idx]];
  persistir(); renderForm(); renderBloqueSeleccionado();
}
function renderBloqueSeleccionado(){
  if(!seleccionado) return;
  const item = getCanvas().find(x => x.id===seleccionado);
  if(!item) return;
  const c = document.getElementById("canvas");
  const bw = c.querySelector(`.bw[data-id="${item.id}"]`);
  if(!bw) return renderCanvas();
  const handle = bw.querySelector(".bw-handle");
  const ctrls = bw.querySelector(".bw-controls");
  bw.innerHTML = "";
  if(handle) bw.appendChild(handle);
  if(ctrls) bw.appendChild(ctrls);
  const tmp = document.createElement("div");
  tmp.innerHTML = BLOQUES[item.tipo].render(item.datos);
  while(tmp.firstChild) bw.appendChild(tmp.firstChild);
  bw.querySelectorAll("img").forEach(im => { im.draggable = false; });
  if(item.tipo === "grid") attachCeldasDeGrid(bw);   // reengancha el clic de las columnas
  if(item.tipo === "codigo") attachCodigoEditable(bw);   // texto/fotos editables en el HTML pegado
  attachInlineEdit(bw);   // edición directa: texto/fotos/enlaces en el lienzo
  iniciarLivePreview();
}

function agregarBloque(tipo, datos, insertAt){
  if(!BLOQUES[tipo]) return;
  if(esComposicion(pieza())){ toast("En colecciones se editan las CAPAS (Diseño / Ajustar tamaño), no bloques sueltos"); return; }
  if(pieza() && pieza().formato==="ads"){ toast("La campaña Search se edita en su propia vista (clic en los textos) o se regenera con Char-B"); return; }
  editandoCelda = null;   // si venías editando una celda de grid, salimos al añadir un bloque suelto
  const item = { id:uid(), tipo:tipo, datos: datos || clone(BLOQUES[tipo].defaults) };
  const arr = getCanvas();
  if(typeof insertAt === "number" && insertAt >= 0 && insertAt <= arr.length) arr.splice(insertAt, 0, item);
  else arr.push(item);
  seleccionado = item.id;
  persistir(); renderCanvas(); renderForm();
}
function bloqueProtegido(id){ const it = getCanvas().find(x => x.id===id); return !!(it && it.datos && it.datos.bloqueado && !esAdminUI()); }
function eliminarBloque(id){ const p=pieza(); if(!p) return; if(bloqueProtegido(id)){ toast("Este bloque está bloqueado por la marca"); return; } p.canvas = p.canvas.filter(x => x.id!==id); if(seleccionado===id) seleccionado=null; persistir(); renderCanvas(); renderForm(); }
function duplicarBloque(id){
  const arr = getCanvas();
  const i = arr.findIndex(x => x.id===id);
  if(i<0) return;
  const c = { id:uid(), tipo:arr[i].tipo, datos:clone(arr[i].datos) };
  arr.splice(i+1, 0, c); seleccionado = c.id;
  persistir(); renderCanvas(); renderForm();
}
function moverBloque(id, delta){
  const arr = getCanvas();
  const i = arr.findIndex(x => x.id===id);
  if(i<0) return;
  const j = i + delta;
  if(j<0 || j>=arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  persistir(); renderCanvas();
}
function seleccionarBloque(id){
  editandoCelda = null;
  seleccionado = id;
  document.querySelectorAll(".bw").forEach(b => b.classList.toggle("selected", b.dataset.id===id));
  sincronizarCodigoEditable();
  renderForm();
  if(_email3){ document.getElementById("layout").classList.remove("sin-der"); }
  else cambiarPanelTab("editar");   // al seleccionar, abre la pestaña de edición
}
// Activa la edición directa (código + texto en línea) del bloque seleccionado y la apaga en los demás.
function sincronizarCodigoEditable(){
  document.querySelectorAll(".bw .sbb-codigo, .bw [data-edit]").forEach(el => {
    const bw = el.closest(".bw");
    el.setAttribute("contenteditable", (bw && bw.dataset.id===seleccionado && !bloqueProtegido(seleccionado)) ? "true" : "false");
  });
}
function actualizarDato(key, valor){
  const item = bloqueCtx(); if(!item) return;
  if(item.datos && item.datos.bloqueado && !esAdminUI()){ toast("Este bloque está bloqueado por la marca"); return; }
  item.datos[key] = valor;
  persistir(); renderBloqueSeleccionado();
}
// Elimina la creatividad actual completa (en colecciones = todos los banners) y vuelve al dashboard.
function eliminarPiezaActual(){
  const p=pieza(); const pr=proyecto; if(!p||!pr) return;
  const esCol = esSetPieza(p);
  const msg = esCol
    ? `¿Eliminar esta creatividad y TODOS sus banners (${(p.artboards||[]).length} tamaños)?\n\nNo se puede deshacer.`
    : "¿Eliminar esta creatividad?\n\nNo se puede deshacer.";
  if(!confirm(msg)) return;
  pr.piezas = (pr.piezas||[]).filter(x => x.id !== p.id);
  pr.activa = pr.piezas[0] ? pr.piezas[0].id : null;
  proyecto = pr;
  persistir();
  // Volver a la lista de creatividades del proyecto.
  proyectoVistoId = pr.id; vistaDash = "creatividades";
  document.getElementById("galeria").classList.add("show");
  renderGaleria();
  toast("Creatividad eliminada");
}
function vaciarCanvas(){
  const p=pieza(); if(!p) return;
  if(esComposicion(p)){
    if(!confirm("¿Vaciar la colección? Se restablece el diseño (textos, logo, CTA y fondo) y se borran los ajustes por tamaño.")) return;
    p.composicion = composicionDefault(p.tema);
    (p.artboards||[]).forEach(ab => ab.ov={});
    seleccionado = null; persistir(); renderTablero(); renderComposicionEditor(); renderForm();
    toast("Colección vaciada");
    return;
  }
  const cv = getCanvas();
  if(cv.length===0) return;
  if(!confirm("¿Borrar todos los bloques de esta pieza?")) return;
  cv.length = 0; seleccionado = null;
  persistir(); renderCanvas(); renderForm();
  toast("Pieza vacía");
}

const frameEl = document.getElementById("canvas-frame");
// Todo el lienzo es zona de drop: ya sea soltar un bloque nuevo de la biblioteca
// o reordenar uno existente, la posición se calcula por la Y del cursor.
frameEl.addEventListener("dragover", (e) => {
  if(!dragInfo && !dragBlockId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = dragBlockId ? "move" : "copy";
  frameEl.classList.add("drag-over");
  mostrarDropLineEn(calcularDropIndex(e.clientY));
});
frameEl.addEventListener("dragleave", (e) => { if(!frameEl.contains(e.relatedTarget)){ frameEl.classList.remove("drag-over"); limpiarDropLines(); } });
frameEl.addEventListener("drop", (e) => {
  if(!dragInfo && !dragBlockId) return;
  e.preventDefault();
  frameEl.classList.remove("drag-over");
  const idx = calcularDropIndex(e.clientY);
  if(dragBlockId){
    // Reordenar un bloque existente
    const arr = getCanvas();
    const from = arr.findIndex(x => x.id===dragBlockId);
    if(from >= 0){
      const [moved] = arr.splice(from, 1);
      let to = idx; if(from < to) to--;          // el índice se corre al sacar el bloque
      arr.splice(Math.max(0, Math.min(to, arr.length)), 0, moved);
      persistir(); renderCanvas();
    }
    dragBlockId = null;
  } else if(dragInfo && dragInfo.fuente==="biblioteca"){
    // Insertar un bloque nuevo de la biblioteca en la posición calculada
    agregarBloque(dragInfo.tipo, undefined, idx);
    dragInfo = null;
  }
  limpiarDropLines();
});

/* EXPORT */
// URLs ABSOLUTAS al exportar: dentro de la app las fotos viven en rutas
// relativas ("/api/upload?k=…"), pero fuera de ella (HubSpot, Gmail, Outlook,
// un HTML descargado) esas rutas no existen → "las fotos se caen". Esta pasada
// las ancla al dominio real antes de entregar cualquier HTML.
function absolutizarURLs(html){
  const base = (typeof location !== "undefined" && /^https?:/.test(location.origin)) ? location.origin : "https://my-ads.gamonal.app";
  return String(html)
    .replace(/(src|href|poster|background)=(["'])\/(?!\/)/g, (m, attr, q) => `${attr}=${q}${base}/`)
    .replace(/url\((['"]?)\/(?!\/)/g, (m, q) => `url(${q}${base}/`);
}
function generarHTMLDePieza(p){
  // Campaña Search: su resumen HTML sale de adsData (no de bloques).
  if(p && p.formato==="ads" && p.adsData) return generarHTMLDeAds(p);
  const fmt = FORMATOS[p.formato] || FORMATOS.email;
  const altoFijo = fmt.alto ? String(fmt.alto) : "";
  const ancho = (!altoFijo && p.tema.ancho && /^\d+$/.test(p.tema.ancho)) ? p.tema.ancho : String(fmt.ancho);
  // CSS de componentes: desde el marcador COMPONENT STYLES hasta el final del
  // <style>. Si el marcador cambiara, incluimos TODO el CSS (nunca vacío), para
  // que el HTML exportado siempre lleve sus estilos (clave para HubSpot).
  const cssFull = (document.querySelector("style") && document.querySelector("style").textContent) || "";
  const cssIdx = cssFull.indexOf("COMPONENT STYLES");
  let css;
  if(cssIdx >= 0){ const cierre = cssFull.indexOf("*/", cssIdx); css = cierre >= 0 ? cssFull.slice(cierre + 2) : cssFull.slice(cssIdx); }
  else { css = cssFull; }
  const _pg=_renderGap, _pr=_renderRadio; temaRenderCtx(p.tema);
  const cuerpo = p.canvas.map(item => {
    const meta = JSON.stringify({tipo:item.tipo, datos:item.datos});
    return `<!--SBB:${meta}:SBB-->\n${BLOQUES[item.tipo].render(item.datos).trim()}\n<!--/SBB-->`;
  }).join("\n\n");
  _renderGap=_pg; _renderRadio=_pr;
  const meta = `<!--SBB-PIECE:${JSON.stringify({nombre:p.nombre, formato:p.formato, tema:p.tema})}:SBB-PIECE-->`;
  const altoCss = altoFijo ? `height:${altoFijo}px;overflow:hidden;` : "";
  const esBanner = altoFijo !== "";
  // Fondo de página: lo elige el usuario; si no, usa el del contenido (sin
  // gris impuesto). Así banner y email se comportan igual y son controlables.
  const colorPagina = (() => {
    let v = (p.tema.bgPagina || "").trim();
    if(!v) return p.tema.bg;
    if(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) v = "#" + v;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : p.tema.bg;
  })();
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.tema.font)}:wght@300;400;500;600;700&display=swap" rel="stylesheet">`;
  // JS solo si la pieza realmente lo usa (reloj/countdown en vivo).
  const necesitaJS = /data-(reloj|countdown)/.test(cuerpo);
  const liveScript = necesitaJS ? `<script>
(function(){
  const MESES=${JSON.stringify(MESES_ES)},DIAS=${JSON.stringify(DIAS_ES)};
  document.querySelectorAll("[data-reloj]").forEach(el=>{const tick=()=>{const showSeg=el.dataset.segundos==="1",showFecha=el.dataset.fecha==="1",h24=el.dataset.h24==="1",now=new Date();let h=now.getHours();const ampm=h>=12?"PM":"AM";if(!h24)h=h%12||12;const hh=String(h).padStart(2,"0"),mm=String(now.getMinutes()).padStart(2,"0"),ss=String(now.getSeconds()).padStart(2,"0"),horaEl=el.querySelector(".hora");if(horaEl)horaEl.innerHTML=hh+'<span class="sep">:</span>'+mm+(showSeg?'<span class="sep">:</span><span class="seg">'+ss+'</span>':'')+(!h24?' <span class="seg">'+ampm+'</span>':'');if(showFecha){const fEl=el.querySelector(".fecha");if(fEl){const dow=DIAS[now.getDay()];fEl.textContent=dow.charAt(0).toUpperCase()+dow.slice(1)+", "+now.getDate()+" de "+MESES[now.getMonth()];}}};tick();setInterval(tick,1000);});
  document.querySelectorAll("[data-countdown]").forEach(el=>{const tick=()=>{const target=new Date(el.dataset.target).getTime();let diff=Math.max(0,target-Date.now());const d=Math.floor(diff/86400000);diff-=d*86400000;const h=Math.floor(diff/3600000);diff-=h*3600000;const m=Math.floor(diff/60000);diff-=m*60000;const s=Math.floor(diff/1000);const u=el.querySelectorAll(".unit .num");if(u[0])u[0].textContent=String(d).padStart(2,"0");if(u[1])u[1].textContent=String(h).padStart(2,"0");if(u[2])u[2].textContent=String(m).padStart(2,"0");if(u[3])u[3].textContent=String(s).padStart(2,"0");};tick();setInterval(tick,1000);});
})();
<\/script>` : "";
  // ── Banners de tamaño fijo (LinkedIn / Display): salida con alto fijo ──
  if(esBanner){
    return absolutizarURLs(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.nombre)}</title>
${fonts}
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"${p.tema.font}",Arial,sans-serif;background:${colorPagina};color:${p.tema.text};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
.sbb-container{max-width:${ancho}px;margin:0 auto;background:${p.tema.bg};${altoCss}}
.sbb-page{font-family:inherit;color:inherit;background:inherit;height:100%;display:flex;flex-direction:${p._orient==='fila'?'row':'column'};${p._orient==='fila'?'align-items:center;':''}}
.sbb-page > div{flex:1;min-height:0;}
${css}
/* Banner de tamaño fijo: las imágenes se ajustan al espacio (no se desbordan). */
.sbb-page img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;}
.sbb-hero{height:100%;}
.sbb-hero img.bg{width:100%!important;height:100%!important;object-fit:cover;}
</style></head><body>
${meta}
<div class="sbb-container"><div class="sbb-page" style="${paddingPaginaCSS(p.tema)}">
${cuerpo}
</div></div>
${liveScript}
</body></html>`);
  }

  // ── Email / Invitación / Libre: estructura de email "bulletproof" ──
  // Tablas anidadas + ghost table de Outlook + media query móvil para que
  // sea responsivo de verdad en Gmail, Outlook, Apple Mail, etc.
  const filas = p.canvas.map(item => {
    const m = JSON.stringify({tipo:item.tipo, datos:item.datos});
    return `<!--SBB:${m}:SBB-->\n<tr><td class="sbb-cell" align="left" style="padding:0;">${BLOQUES[item.tipo].render(item.datos).trim()}</td></tr>\n<!--/SBB-->`;
  }).join("\n");
  const bp = Number(ancho) + 20; // breakpoint móvil
  return absolutizarURLs(`<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(p.asunto || p.nombre)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
${fonts}
<style>
html,body{margin:0!important;padding:0!important;width:100%!important;}
body{font-family:"${p.tema.font}",Arial,sans-serif;background:${colorPagina};color:${p.tema.text};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;max-width:100%;height:auto;}
a{text-decoration:none;}
.sbb-page{font-family:inherit;color:inherit;}
${css}
@media screen and (max-width:${bp}px){
  .sbb-container{width:100%!important;max-width:100%!important;}
  .sbb-col{display:block!important;width:100%!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${colorPagina};">
${meta}${p.preheader ? `
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(p.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${colorPagina};">
<tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="${ancho}" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="sbb-container" width="${ancho}" cellpadding="0" cellspacing="0" border="0" style="width:${ancho}px;max-width:${ancho}px;margin:0 auto;background:${p.tema.bg};">
<tr><td class="sbb-page" style="${paddingPaginaCSS(p.tema)||'padding:0;'}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${filas}
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
${liveScript}
</body></html>`);
}

// Markup de un bloque editable (compartido entre el editor normal y el tablero).
function bwHTML(item){
  const lk = !!(item.datos && item.datos.bloqueado);
  const prot = lk && !esAdminUI();
  const candado = lk ? `<div class="bw-lock-ico">${svgIcon("candado",{size:"11px"})}</div>` : "";
  if(prot) return `<div class="bw bw-lock${seleccionado===item.id?" selected":""}" data-id="${item.id}">${candado}${BLOQUES[item.tipo].render(item.datos)}</div>`;
  return `<div class="bw${lk?" bw-lock":""}${seleccionado===item.id?" selected":""}" data-id="${item.id}" draggable="true">${candado}<div class="bw-handle">Mover</div><div class="bw-controls"><button class="bw-btn" onclick="moverBloque('${item.id}',-1);event.stopPropagation();">${svgIcon("chevup",{size:"14px"})}</button><button class="bw-btn" onclick="moverBloque('${item.id}',1);event.stopPropagation();">${svgIcon("chevdown",{size:"14px"})}</button><button class="bw-btn" onclick="duplicarBloque('${item.id}');event.stopPropagation();">${svgIcon("copiar",{size:"13px"})}</button><button class="bw-btn del" onclick="eliminarBloque('${item.id}');event.stopPropagation();">${svgIcon("equis",{size:"14px"})}</button></div>${BLOQUES[item.tipo].render(item.datos)}</div>`;
}
function attachEspGrip(bw, item){
  if(!bw || bw.querySelector(".esp-grip")) return;
  const g = document.createElement("div");
  g.className = "esp-grip";
  g.textContent = "⇕ " + (parseInt(item.datos.altoEsp)||0) + " px · arrastra";
  g.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    const y0 = e.clientY, h0 = parseInt(item.datos.altoEsp)||0;
    const spacer = bw.querySelector(".sbb-spacer");
    const mover = (ev) => {
      const h = Math.max(0, Math.min(200, h0 + Math.round(ev.clientY - y0)));
      item.datos.altoEsp = String(h);
      if(spacer) spacer.style.height = h + "px";
      g.textContent = "⇕ " + h + " px · arrastra";
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      persistir(); if(seleccionado===item.id) renderForm();
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  });
  bw.appendChild(g);
}
function attachBwListeners(c){
  c.querySelectorAll(".bw img").forEach(im => { im.draggable = false; });
  c.querySelectorAll(".bw").forEach(bw => {
    const it = getCanvas().find(x => x.id===bw.dataset.id);
    if(it && it.tipo === "espaciador") attachEspGrip(bw, it);
  });
  c.querySelectorAll(".bw").forEach(bw => {
    bw.addEventListener("click", (e) => { e.stopPropagation(); seleccionarBloque(bw.dataset.id); });
    bw.addEventListener("dragstart", (e) => {
      // No iniciar arrastre del bloque desde campos, ni desde DENTRO de una celda
      // de grid (ahí el clic edita la celda; el grid se mueve con el handle "Mover").
      if(e.target.closest("input,textarea,select,button,a")) { e.preventDefault(); return; }
      if(e.target.closest(".sbb-grid-cell")) { e.preventDefault(); return; }
      if(e.target.closest('.sbb-codigo[contenteditable="true"]')) { e.preventDefault(); return; }
      if(e.target.closest('[contenteditable="true"],[data-edit-img],[data-edit-link]')) { e.preventDefault(); return; }
      dragBlockId = bw.dataset.id; bw.classList.add("drag-source"); e.dataTransfer.effectAllowed = "move"; try{e.dataTransfer.setData("text/plain",bw.dataset.id);}catch(_){}
    });
    bw.addEventListener("dragend", () => { bw.classList.remove("drag-source"); limpiarDropLines(); dragBlockId=null; });
    attachCeldasDeGrid(bw);   // si es grid, hace clicables sus columnas
    attachCodigoEditable(bw); // si es código, hace editable su texto/fotos
    attachInlineEdit(bw);     // edición directa: texto/fotos/enlaces en el lienzo
  });
}

function abrirImportar(){ document.getElementById("import-html").value=""; document.getElementById("modal-import").classList.add("show"); }
function ejecutarImportar(){
  const html = document.getElementById("import-html").value;
  if(!html.trim()){ toast("Pega HTML primero"); return; }
  let nuevoNombre = "Pieza importada", nuevoFmt = "email", nuevoTema = clone(getTema());
  const pm = html.match(/<!--SBB-PIECE:([\s\S]*?):SBB-PIECE-->/);
  if(pm){ try{ const o=JSON.parse(pm[1]); if(o.nombre) nuevoNombre=o.nombre; if(o.formato) nuevoFmt=o.formato; if(o.tema) nuevoTema=Object.assign(nuevoTema,o.tema); }catch(e){} }
  const re = /<!--SBB:([\s\S]*?):SBB-->/g;
  const nuevos = []; let m;
  while((m = re.exec(html)) !== null){
    try { const o=JSON.parse(m[1]); if(o.tipo && BLOQUES[o.tipo]){ const def=clone(BLOQUES[o.tipo].defaults); nuevos.push({id:uid(), tipo:o.tipo, datos: Object.assign(def, o.datos||{})}); } } catch(e){}
  }
  if(nuevos.length===0){ toast("No se encontraron bloques editables"); return; }
  const p = crearPieza(nuevoFmt, nuevoNombre);
  p.canvas = nuevos; p.tema = nuevoTema;
  proyecto.activa = p.id;
  cerrarModal("import");
  activarPieza(p.id);
  toast(`Importados ${nuevos.length} bloque${nuevos.length>1?"s":""}`);
}
