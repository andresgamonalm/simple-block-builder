/* ══════════════════════════════════════════════════════════════════
   GUARDADO  ·  funciones/comun/guardado.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Deshacer/rehacer, la poda única de proyectos viejos y la sincronización del espacio de trabajo con la nube (D1).
   QUIÉN LO USA: Lo usan todas las funciones.
   SECCIONES (en orden):
     1. Deshacer / Rehacer (historial por creatividad activa)
     2. Sincronización con la nube (D1 vía /api/proyectos)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
/* ── Deshacer / Rehacer (historial por creatividad activa) ───────────────
   Cada cambio pasa por persistir(); ahí registramos un snapshot del lienzo +
   tema + formato + nombre de la pieza activa. El historial se reinicia solo al
   cambiar de creatividad. Atajos: Ctrl/Cmd+Z deshace, Ctrl+Y / Ctrl+Shift+Z rehace. */
let _undo = [], _redo = [], _undoTs = [], _undoRestoring = false, _undoPiezaId = null;
function registrarHistorial(){
  if(_undoRestoring) return;
  const p = pieza(); if(!p) return;
  const snap = JSON.stringify({ canvas:p.canvas, tema:p.tema, formato:p.formato, nombre:p.nombre,
    composicion:p.composicion, artboards:p.artboards, esSet:p.esSet, setTipo:p.setTipo, masterFmt:p.masterFmt, activaFmt:p.activaFmt });
  if(_undoPiezaId !== p.id){ _undo = []; _redo = []; _undoTs = []; _undoPiezaId = p.id; }  // pieza nueva → historial limpio
  if(_undo.length && _undo[_undo.length-1] === snap) return;                 // sin cambios reales
  _undo.push(snap); _undoTs.push(Date.now());
  if(_undo.length > 120){ _undo.shift(); _undoTs.shift(); }
  _redo.length = 0;
  if(panelTab === "historial") renderHistorialPanel();
}
function aplicarSnapshot(snap){
  const p = pieza(); if(!p || !snap) return;
  const s = JSON.parse(snap);
  p.canvas = s.canvas; p.tema = s.tema; p.formato = s.formato; p.nombre = s.nombre;
  // Restaura también el estado de colección (composición por zonas / tablero).
  p.composicion = s.composicion; p.artboards = s.artboards; p.esSet = s.esSet; p.setTipo = s.setTipo; p.masterFmt = s.masterFmt; p.activaFmt = s.activaFmt;
  seleccionado = null;
  _undoRestoring = true;
  try{
    const fmtSel = document.getElementById("fmt"); if(fmtSel) fmtSel.value = p.formato;
    const frame = document.getElementById("canvas-frame"); if(frame) frame.dataset.formato = p.formato;
    aplicarTema(); renderCanvas(); renderComposicionEditor(); renderForm(); renderTabsPiezas();
    workspace._ts = Date.now();
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }catch(e){}
    guardarEnNubeDebounced();
  } finally { _undoRestoring = false; }
}
function deshacer(){
  if(_undo.length < 2){ toast("Nada que deshacer"); return; }
  _redo.push(_undo.pop()); _undoTs.pop();  // saca el estado actual
  aplicarSnapshot(_undo[_undo.length-1]);  // restaura el anterior
  toast("Deshecho");
}
function rehacer(){
  if(!_redo.length){ toast("Nada que rehacer"); return; }
  const snap = _redo.pop();
  _undo.push(snap); _undoTs.push(Date.now());
  aplicarSnapshot(snap);
  toast("Rehecho");
}
let _tsAlCargar = 0;  // timestamp real de la copia local al arrancar (para sync)
// Normaliza cualquier dato cargado al modelo workspace { proyectos:[{piezas:[]}], marcas, banner }.
/* PODA DE PROYECTOS VIEJOS (27-sep-2026, orden del usuario): una sola vez por espacio de trabajo,
   todos los proyectos pasan a la Papelera (se pueden restaurar desde ahí). Marcas, fotos y perfil
   no se tocan. La bandera viaja con el workspace a D1, así no se repite en otro equipo. No se toca
   _ts: la sincronización sigue decidiendo por la fecha real del último cambio. */
const PODA_ID = "poda-2026-09-27";
function podarProyectosUnaVez(o){
  if(!o || o._poda === PODA_ID) return o;
  const ahora = Date.now();
  (o.proyectos||[]).forEach(pr => { pr.borradoTs = ahora; o.papelera.push(pr); });
  o.proyectos = [];
  o._poda = PODA_ID;
  return o;
}
function normalizarWorkspace(o){
  if(!o || typeof o!=="object") return { proyectos:[], marcas:[], banner:{}, imagenes:[], papelera:[], perfil:{}, _poda:PODA_ID };
  if(Array.isArray(o.proyectos)){ o.marcas=o.marcas||[]; o.banner=o.banner||{}; o.imagenes=o.imagenes||[]; o.papelera=o.papelera||[]; o.perfil=o.perfil||{}; return podarProyectosUnaVez(o); }
  if(Array.isArray(o.piezas)){
    return podarProyectosUnaVez({ proyectos: o.piezas.length ? [{ id:uid(), nombre:"General", creado:Date.now(), piezas:o.piezas, activa:o.activa||o.piezas[0].id }] : [],
             marcas:o.marcas||[], banner:o.banner||{}, imagenes:o.imagenes||[], papelera:o.papelera||[], perfil:o.perfil||{}, _ts:o._ts||0 });
  }
  return { proyectos:[], marcas:[], banner:{}, imagenes:[], papelera:[], perfil:{}, _poda:PODA_ID };
}
function recuperar(){
  try{
    const r=localStorage.getItem(STORAGE_KEY);
    workspace = normalizarWorkspace(r ? JSON.parse(r) : null);
    _tsAlCargar = workspace._ts || 0;
  }catch(e){ workspace = { proyectos:[], marcas:[], banner:{} }; }
}

/* ── Sincronización con la nube (D1 vía /api/proyectos) ──────────────────
   localStorage es la caché instantánea/offline; D1 es la copia durable y
   compartida entre dispositivos. Guardado con debounce; al iniciar se carga
   lo más reciente (last-write-wins por timestamp). */
let _saveTimer = null, _guardando = false;
function setSyncEstado(txt, cls){
  const el = document.getElementById("sync-status");
  if(!el) return;
  const ico = cls==="err" ? "alerta" : "nube";
  el.innerHTML = svgIcon(ico,{size:"13px"}) + " " + esc(txt);
  el.className = "sync-status" + (cls?(" "+cls):"");
}
function guardarEnNubeDebounced(){
  clearTimeout(_saveTimer);
  setSyncEstado("Cambios pendientes…", "pend");
  _saveTimer = setTimeout(guardarEnNube, 1200);
}
async function guardarEnNube(){
  if(_guardando) { guardarEnNubeDebounced(); return; }
  _guardando = true;
  setSyncEstado("Guardando…", "saving");
  try{
    const r = await fetch("/api/proyectos", {
      method:"POST", credentials:"include",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ workspace })   // se sube el espacio completo (proyectos + marcas + banner)
    });
    if(r.ok){ setSyncEstado("Todo guardado · "+new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}), "ok"); }
    else { setSyncEstado("Guardado solo en este equipo", "err"); }
  }catch(e){ setSyncEstado("Sin conexión", "err"); }
  finally{ _guardando = false; }
}
async function sincronizarConNube(){
  setSyncEstado("Sincronizando…", "saving");
  try{
    const r = await fetch("/api/proyectos", { credentials:"include" });
    if(!r.ok){ setSyncEstado("Solo local", "err"); return; }
    const data = await r.json();
    // El servidor devuelve el blob durable bajo `proyecto` (nombre histórico de la
    // columna); puede ser el espacio nuevo {proyectos:[]} o el formato viejo {piezas:[]}.
    const remoto = data && data.proyecto;
    const tsRemoto = remoto && remoto._ts ? remoto._ts : 0;
    // Comparamos contra el timestamp REAL de localStorage al cargar (no contra
    // el que los renders de arranque pudieron regenerar).
    const tsLocal  = _tsAlCargar;
    if(remoto && (Array.isArray(remoto.proyectos) || Array.isArray(remoto.piezas)) && tsRemoto > tsLocal){
      // La nube tiene una versión más nueva → adoptarla (migrando el formato si hace falta).
      workspace = normalizarWorkspace(remoto);
      _tsAlCargar = workspace._ts || 0;
      try{localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));}catch(e){}
      // Reanclar el proyecto activo a la nueva referencia (o soltarlo si ya no existe).
      proyecto = proyecto ? proyectoPorId(proyecto.id) : null;
      const editando = !document.getElementById("galeria").classList.contains("show");
      const rutaSec = (typeof RUTAS_PRODUCTO!=="undefined") ? RUTAS_PRODUCTO[normRuta(location.pathname)] : null;
      if(editando && proyecto && pieza()){
        const p0 = pieza();
        document.getElementById("fmt").value = p0.formato; cambiarFormato(p0.formato); aplicarTema();
        renderTabsPiezas(); renderCanvas(); renderForm();
      } else if(rutaSec && !rutaSec.pronto){
        // Estás en una sección (p. ej. recargaste /email-ia) → reabre su pieza, NO te botes al home.
        restaurarSeccion(normRuta(location.pathname));
      } else {
        renderMarcaSelector();
        renderGaleria();
      }
      setSyncEstado("Guardado", "ok");
      toast("Espacio sincronizado desde la nube");
    } else if(tsLocal > tsRemoto){
      // Lo local es más nuevo (o la nube está vacía) → subirlo.
      await guardarEnNube();
    } else {
      setSyncEstado("Guardado", "ok");
    }
  }catch(e){ setSyncEstado("Sin conexión", "err"); }
}
