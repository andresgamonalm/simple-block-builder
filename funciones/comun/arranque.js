/* ══════════════════════════════════════════════════════════════════
   ARRANQUE  ·  funciones/comun/arranque.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Lo que se ejecuta al abrir la página: pinta, recupera el trabajo, abre la ruta pedida y sincroniza. Atajos de teclado.
   QUIÉN LO USA: Va SIEMPRE al final del orden de carga.
   SECCIONES (en orden):
     1. URL por vista: /home en el dashboard (home), /editor al editar una creatividad.
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
renderFormatoSelect();
renderPlantillasTab();
recuperar();
if(!workspace.marcas) workspace.marcas = [];   // kits de marca
renderMarcaSelector();
renderBiblioteca();
renderForm();
cambiarPanelTab("bloques");   // pestaña inicial del panel
pintarIconos();               // pinta los íconos SVG de la interfaz
// La app arranca en el Dashboard (lista de proyectos).
vistaDash = "proyectos"; proyectoVistoId = null;
abrirGaleria();
aplicarRutaInicial();   // si entraste por /email-ia, /gdn-ia, etc., abre esa sección
aplicarModoDispositivo();
sincronizarConNube();   // carga/sube la copia durable en D1 sin bloquear la UI
window.matchMedia("(max-width:820px)").addEventListener("change", aplicarModoDispositivo);

document.querySelectorAll(".modal-bg").forEach(m => { m.addEventListener("click", (e) => { if(e.target===m){ m.classList.remove("show"); _remountTrasModal(); } }); });
document.addEventListener("keydown", (e) => { if(e.key==="Escape"){ const abiertos=document.querySelectorAll(".modal-bg.show"); if(abiertos.length){ abiertos.forEach(m => m.classList.remove("show")); _remountTrasModal(); } } });

// Atajos del editor: deshacer/rehacer y borrar el bloque seleccionado.
document.addEventListener("keydown", (e) => {
  const t = e.target;
  const editando = !!(t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT" || t.isContentEditable));
  const hayModal = !!document.querySelector(".modal-bg.show");
  const enEditor = !document.getElementById("galeria").classList.contains("show") && !hayModal;
  if(!enEditor) return;
  const k = (e.key || "").toLowerCase();
  // Rehacer: Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z
  if((e.ctrlKey||e.metaKey) && (k==="y" || (e.shiftKey && k==="z"))){
    if(!editando){ e.preventDefault(); rehacer(); }
    return;
  }
  // Deshacer: Ctrl/Cmd+Z (si estás en un campo, deja el deshacer nativo del texto)
  if((e.ctrlKey||e.metaKey) && k==="z"){
    if(!editando){ e.preventDefault(); deshacer(); }
    return;
  }
  // Borrar con Supr o Backspace (fuera de campos de texto).
  if((e.key==="Delete" || e.key==="Backspace") && !editando){
    // Si estás editando una celda del grid, borra SOLO esa celda (no el grid entero).
    if(editandoCelda){ e.preventDefault(); eliminarCelda(editandoCelda.idx); return; }
    if(seleccionado){ e.preventDefault(); eliminarBloque(seleccionado); }
  }
});
document.getElementById("canvas-area").addEventListener("click", (e) => {
  if(e.target.id==="canvas-area" || e.target.id==="canvas-frame" || e.target.id==="canvas"){
    seleccionado = null; editandoCelda = null;
    document.querySelectorAll(".bw.selected").forEach(b => b.classList.remove("selected"));
    sincronizarCodigoEditable();
    renderForm();
  }
});
/* ── URL por vista: /home en el dashboard (home), /editor al editar una creatividad.
   El dashboard se muestra con la clase "show" en #galeria; observamos ese estado y
   ajustamos la URL sin recargar (replaceState). */
(function(){
  const gal = document.getElementById("galeria");
  if(!gal || !window.history || !history.replaceState) return;
  function sincronizarRuta(){
    const enHome = gal.classList.contains("show");
    let destino;
    if(enHome){ destino = urlDeVista(dashView); _rutaActual = destino; }
    // Editando: la URL es SIEMPRE la sección de la pieza (email-ia/gdn-ia/free).
    else { const _p=pieza(); const _r=rutaDeProducto(_p) || _rutaActual || "/home"; destino = _p&&_p.nombre ? _r+"/"+slugDe(_p.nombre) : _r; _rutaActual = _r; }
    if(location.pathname !== destino){ try{ history.replaceState(null, "", destino); }catch(_){} }
  }
  new MutationObserver(sincronizarRuta).observe(gal, { attributes:true, attributeFilter:["class"] });
  window.addEventListener("popstate", () => {
    const ruta = (location.pathname||"").replace(/\/+$/,"") || "/";
    // Si vuelves a una sección de producto, sigues editando (no salgas).
    if(RUTAS_PRODUCTO[ruta] || RUTAS_PRODUCTO["/"+ruta.split("/")[1]]) return;
    if(!gal.classList.contains("show")) volverAProyectos();
  });
  sincronizarRuta();
})();
