/* ══════════════════════════════════════════════════════════════════
   ESTADO Y UTILIDADES  ·  funciones/comun/estado.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: El estado de la app (espacio de trabajo, proyecto, pieza activa), los accesos a la pieza (pieza(), getCanvas()…), y utilidades usadas en todas partes: esc(), uid(), clone(), toast(), persistir(), mk(), renombrar, vista previa.
   QUIÉN LO USA: Lo usan TODAS las funciones. No se borra.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
const STORAGE_KEY = "sbb-project-v8";
let workspace = { proyectos: [], marcas: [], banner: {}, imagenes: [], papelera: [] };  // espacio del usuario
let proyecto = null;          // proyecto activo (referencia dentro de workspace.proyectos)
let vistaDash = "proyectos";  // "proyectos" | "creatividades"
let proyectoVistoId = null;   // proyecto cuya lista de creatividades se ve
let seleccionado = null;
let editandoCelda = null;   // { gridId, idx } cuando se edita el bloque de una columna del grid
// Devuelve el bloque que se está editando: el seleccionado, o el bloque de una
// celda del grid si estás dentro de una columna. Así los mutadores sirven para ambos.
function bloqueCtx(){
  if(editandoCelda){
    const grid = getCanvas().find(x => x.id === editandoCelda.gridId);
    const cell = grid && grid.datos.celdas && grid.datos.celdas[editandoCelda.idx];
    return (cell && cell.tipo && cell.datos) ? cell : null;
  }
  return getCanvas().find(x => x.id === seleccionado) || null;
}
let dragInfo = null;
let dragBlockId = null;
let livePreviewIntervals = [];
let dispositivo = "desktop";     // vista de dispositivo del lienzo
let panelTab = "bloques";        // pestaña activa del panel izquierdo

// Cambia la pestaña del panel izquierdo (Bloques · Diseño · Editar bloque · Plantillas).
function cambiarPanelTab(tab){
  panelTab = tab;
  document.querySelectorAll(".panel-tabs .ptab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  // En el modo email de 3 zonas, "Editar" y "Diseño" viven en el panel DERECHO:
  // aquí solo se conmutan los panes que siguen en el panel izquierdo.
  document.querySelectorAll(".panel-izq .ptab-pane").forEach(p => { p.style.display = (p.id === "pane-" + tab) ? "" : "none"; });
  if(_email3){ document.querySelectorAll("#ed-rail button[data-rail]").forEach(b => b.classList.toggle("on", b.dataset.rail === tab)); }
  if(tab === "historial") renderHistorialPanel();
  if(tab === "diseno" && typeof renderComposicionEditor === "function") renderComposicionEditor();
}

// Vista de dispositivo: previsualiza el ancho del lienzo (escritorio/tablet/móvil).
function setDispositivo(d){
  dispositivo = d;
  document.querySelectorAll("#dev-seg button").forEach(b => b.classList.toggle("on", b.dataset.dev === d));
  const fr = document.getElementById("canvas-frame"); if(fr) fr.classList.toggle("dev-movil", d === "movil");
  aplicarTema();
}

// Edición inline robusta de un nombre en el breadcrumb (clic = editar).
function _renombrarInline(span, valorActual, guardar){
  if(!span || span.getAttribute("contenteditable")==="true") return;   // ya editando
  span.contentEditable = "true"; span.focus();
  try{ const r=document.createRange(); r.selectNodeContents(span); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }catch(_){}
  const onKey = (e) => {
    if(e.key==="Enter"){ e.preventDefault(); span.blur(); }
    else if(e.key==="Escape"){ e.preventDefault(); span.textContent = valorActual; span.blur(); }
  };
  const fin = () => {
    span.removeEventListener("blur", fin); span.removeEventListener("keydown", onKey);
    span.contentEditable = "false";
    const v = (span.textContent||"").replace(/\s+/g," ").trim();
    guardar(v || valorActual);
  };
  span.addEventListener("blur", fin);
  span.addEventListener("keydown", onKey);
}
// Renombrar la creatividad (pieza) activa desde el breadcrumb.
function renombrarPiezaActual(){
  const span = document.getElementById("crumb-pieza"); const p = pieza(); if(!p || !span) return;
  _renombrarInline(span, p.nombre || "Creatividad", (v)=>{ p.nombre = v; span.textContent = v; persistir(); if(typeof renderGaleria==="function") renderGaleria(); });
}
// Renombrar el proyecto activo desde el breadcrumb del editor.
function renombrarProyectoDesdeEditor(){
  const span = document.getElementById("crumb-proyecto"); if(!proyecto || !span) return;
  _renombrarInline(span, proyecto.nombre || "Proyecto", (v)=>{ proyecto.nombre = v; span.textContent = v; persistir(); if(typeof renderGaleria==="function") renderGaleria(); });
}

// Abre la vista previa de la pieza actual (modal con toggle de dispositivo).
function abrirPreviewActual(){ if(proyecto && proyecto.activa) abrirPreview(proyecto.activa); }

function pieza(){ return proyecto && proyecto.piezas.find(p => p.id === proyecto.activa); }
function getCanvas(){ const ab = artboardActivo(); if(ab) return ab.canvas || (ab.canvas = []); return pieza()?.canvas || []; }
function getFormato(){ const ab = artboardActivo(); if(ab) return ab.fmt; return pieza()?.formato || "email"; }
function getTema(){ return pieza()?.tema || { font:"Inter", primary:"#1c73cb", text:"#1a1a1a", bg:"#ffffff", bgPagina:"", ancho:"", radio:"", gap:"0" }; }

function esc(s){ if(s==null) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escMultiline(s){ return esc(s||"").replace(/\n/g,"<br>"); }
// Quita los comentarios de metadatos (<!--SBB:…-->) que el editor incrusta para
// poder re-importar un HTML. El destinatario de un email NO los necesita y algunos
// clientes (Gmail) los filtran como texto visible (los "\n" que se ven en el correo).
function limpiarMetaComentarios(html){
  return String(html||"")
    .replace(/<!--SBB-PIECE:[\s\S]*?:SBB-PIECE-->/g, "")
    .replace(/<!--SBB:[\s\S]*?:SBB-->/g, "")
    .replace(/<!--\/SBB-->/g, "")
    .replace(/\n{3,}/g, "\n\n");
}
function escAttr(s){ return esc(s).replace(/'/g,"&#39;"); }
function hexRgba(hex, a){
  let h = String(hex||"#000000").replace("#","");
  if(h.length===3) h = h.split("").map(c=>c+c).join("");
  const r=parseInt(h.slice(0,2),16)||0, g=parseInt(h.slice(2,4),16)||0, b=parseInt(h.slice(4,6),16)||0;
  return `rgba(${r},${g},${b},${a})`;
}
function uid(){ return "b"+Math.random().toString(36).slice(2,9); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function toast(msg, ms=2200){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),ms); }
function persistir(){
  workspace._ts = Date.now();                      // marca de tiempo para sync
  // Sello "Editado hace…" (Home): solo cuando se está editando la pieza (no en el dashboard).
  try{ const _g=document.getElementById("galeria"); const _p=pieza(); if(_p && !(_g&&_g.classList.contains("show"))) _p._mod = Date.now(); }catch(_){}
  registrarHistorial();                            // captura el estado para deshacer/rehacer
  try{localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));}catch(e){}
  guardarEnNubeDebounced();
}
function mk(tipo, overrides){ return { id:uid(), tipo:tipo, datos: Object.assign(clone(BLOQUES[tipo].defaults), overrides||{}) }; }
