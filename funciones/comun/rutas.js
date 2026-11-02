/* ══════════════════════════════════════════════════════════════════
   RUTAS Y PERMISOS  ·  funciones/comun/rutas.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Abrir/cerrar la galería, vista previa, modo móvil, las URL de cada sección (/gdn-ia, /fb-ia, /ads-ia…) y los permisos por servicio.
   QUIÉN LO USA: Compartido.
   SECCIONES (en orden):
     1. Secciones por ruta (path)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
function renderMarcaSelector(){
  const sel=document.getElementById("dz-marca"); if(!sel) return;
  const ms=workspace.marcas||[];
  sel.innerHTML = `<option value="">${ms.length ? "— Elegir marca —" : "— Sin marcas (crea una) —"}</option>` +
    ms.map(m=>`<option value="${m.id}">${esc(m.nombre)}</option>`).join("");
}

function abrirGaleria(){
  if(proyecto){ proyectoVistoId = proyecto.id; dashView = "proyectos"; }
  document.getElementById("galeria").classList.add("show");
  renderGaleria();
}
// El logo (con el nombre) SIEMPRE lleva al Inicio, tanto en el dashboard como
// en el editor; a Proyectos se llega por el breadcrumb o la barra superior.
function irAlInicio(){
  if(proyecto) proyectoVistoId = proyecto.id;
  dashIr("home");
}
function cerrarGaleria(){ if(esMovil()) return; document.getElementById("galeria").classList.remove("show"); }
function abrirCreacion(id){
  const pr = proyectoPorId(proyectoVistoId); if(!pr) return;
  proyecto = pr;
  document.getElementById("galeria").classList.remove("show");
  activarPieza(id);
}
function eliminarCreacion(id){
  const pr = proyectoPorId(proyectoVistoId) || proyecto; if(!pr) return;
  if(!confirm("¿Eliminar esta creatividad?")) return;
  pr.piezas = pr.piezas.filter(p => p.id !== id);
  if(pr.activa === id) pr.activa = pr.piezas[0] ? pr.piezas[0].id : null;
  persistir(); renderGaleria();
}

function abrirPreview(id){
  let p = proyecto && proyecto.piezas.find(x => x.id === id);
  if(!p){ for(const pr of workspace.proyectos){ const f=pr.piezas.find(x=>x.id===id); if(f){ p=f; break; } } }
  if(!p) return;
  document.getElementById("pv-title").textContent = p.nombre;
  // Una colección de banners se previsualiza como HOJA DE CONTACTOS con los que
  // tengas MARCADOS (el modelo: "la vista previa puede ser seleccionada").
  document.getElementById("pv-frame").srcdoc = esSetPieza(p) ? previewDeSet(p) : generarHTMLDePieza(p);
  setPreviewWidth(esMovil() ? "movil" : "full");
  document.getElementById("preview-modal").classList.add("show");
}
function cerrarPreview(){ document.getElementById("preview-modal").classList.remove("show"); document.getElementById("pv-frame").srcdoc = ""; }
function setPreviewWidth(w){
  const wrap = document.getElementById("pv-frame-wrap");
  wrap.classList.remove("movil","tablet");
  if(w === "movil") wrap.classList.add("movil");
  else if(w === "tablet") wrap.classList.add("tablet");
  ["full","tablet","movil"].forEach(k => { const b = document.getElementById("pv-w-"+k); if(b) b.classList.toggle("active", k === w); });
}

function aplicarModoDispositivo(){
  document.body.classList.toggle("movil", esMovil());
}

// ── Secciones por ruta (path) ──────────────────────────────────────────
// Cada "producto" tiene su URL. El SPA entra a la sección al navegar (irARuta)
// o al cargar un deep-link (aplicarRutaInicial). Lo "pronto" queda en gris.
const RUTAS_PRODUCTO = {
  "/email-ia": { tipo:"email",             nombre:"Email · Char-B",          serv:"email" },
  "/gdn-ia":   { tipo:"display-300x250",   nombre:"Banner Display · Char-B", serv:"banner" },
  "/free":     { tipo:"libre",             nombre:"Estilo Libre",            serv:"libre" },
  "/post-ia":  { pronto:true,              nombre:"Post RRSS" },
  "/ads-ia":   { tipo:"ads",               nombre:"Google Search Ads",       serv:"ads" },
  "/fb-ia":    { tipo:"fb-1080x1350",      nombre:"Facebook Ads · Char-B",   serv:"banner" },
};
// Permisos por servicio: 'admin' o permiso '*' = todo; si aún no cargó la
// sesión (o en pruebas locales sin whoami) no se bloquea nada.
function puede(serv){
  const u = window.SBB_USER;
  if(!u || !u.rol) return true;
  if(u.rol === "admin") return true;
  const p = u.permisos || [];
  return p.includes("*") || p.includes(serv);
}
// Oculta de la interfaz todo lo marcado con data-serv que el usuario no tiene.
function aplicarPermisosUI(){
  const u = window.SBB_USER; if(!u || !u.rol) return;
  document.querySelectorAll("[data-serv]").forEach(el => { el.style.display = puede(el.dataset.serv) ? "" : "none"; });
  const esAdmin = u.rol === "admin";
  ["menu-perm-item","menu-config-item"].forEach(id => { const el=document.getElementById(id); if(el) el.style.display = esAdmin ? "" : "none"; });
  const rolEl = document.getElementById("cuenta-rol");
  if(rolEl) rolEl.textContent = esAdmin ? "Administrador" : "Usuario limitado";
}
const RUTAS_MENU = {
  "/proyectos":     () => dashVista("proyectos"),
  "/en-curso":      () => dashVista("en-curso"),
  "/realizados":    () => dashVista("realizados"),
  "/historial":     () => dashVista("historial"),
  "/marcas":        () => dashVista("marcas"),
  "/imagenes":      () => dashVista("imagenes"),
  "/papelera":      () => dashVista("papelera"),
  "/permisos":      () => dashVista("permisos"),
  "/configuracion": () => dashVista("configuracion"),
};
let _rutaActual = "/home";   // ruta de la sección de edición en curso (para que la URL no se pise)
function normRuta(p){ return "/" + String(p||"").replace(/^\/+|\/+$/g,"").toLowerCase(); }
function slugDe(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"pieza"; }
function setURL(ruta){ if(window.history && history.pushState){ try{ if(location.pathname!==ruta) history.pushState(null,"",ruta); }catch(_){} } }
function irARuta(ruta){
  ruta = normRuta(ruta);
  if(RUTAS_MENU[ruta]){ setURL(ruta); RUTAS_MENU[ruta](); return; }
  let slugPieza = null, rutaBase = ruta;
  if(!RUTAS_PRODUCTO[ruta] && !RUTAS_MENU[ruta]){
    const seg = ruta.split("/").filter(Boolean);
    if(seg.length>=2 && RUTAS_PRODUCTO["/"+seg[0]]){ rutaBase = "/"+seg[0]; slugPieza = seg.slice(1).join("-"); }
  }
  const cfg = RUTAS_PRODUCTO[rutaBase];
  if(cfg && cfg.pronto){ toast(cfg.nombre + ": próximamente"); return; }
  if(cfg && cfg.serv && !puede(cfg.serv)){ toast("Tu usuario no tiene acceso a este servicio"); return; }
  if(cfg){ _rutaActual = ruta; setURL(ruta); crearDesde(cfg.tipo); return; }
  _rutaActual = "/home"; setURL("/home"); volverAProyectos();
}
// Deep-link: al cargar el SPA en una ruta concreta, entra a esa sección.
function aplicarRutaInicial(){
  const ruta = normRuta(location.pathname);
  if(ruta==="/" || ruta==="/home") return;   // comportamiento normal
  if(RUTAS_MENU[ruta]){ RUTAS_MENU[ruta](); return; }
  let slugPieza = null, rutaBase = ruta;
  if(!RUTAS_PRODUCTO[ruta] && !RUTAS_MENU[ruta]){
    const seg = ruta.split("/").filter(Boolean);
    if(seg.length>=2 && RUTAS_PRODUCTO["/"+seg[0]]){ rutaBase = "/"+seg[0]; slugPieza = seg.slice(1).join("-"); }
  }
  const cfg = RUTAS_PRODUCTO[rutaBase];
  if(cfg && cfg.pronto){ toast(cfg.nombre + ": próximamente"); return; }
  if(cfg && cfg.serv && !puede(cfg.serv)){ toast("Tu usuario no tiene acceso a este servicio"); setURL("/home"); return; }
  if(cfg) restaurarSeccion(rutaBase, slugPieza);
}
// Entra a una sección REABRIENDO la última pieza que tenías ahí (no crea una nueva
// en cada recarga). Si no existe ninguna de esa sección, recién entonces crea una.
function restaurarSeccion(ruta, slug){
  const cfg = RUTAS_PRODUCTO[ruta]; if(!cfg || cfg.pronto) return false;
  _rutaActual = ruta;
  let pr=null, p=null;
  // 0) deep-link con nombre: /seccion/mi-campana → abre ESA pieza.
  if(slug){ for(const PR of (workspace.proyectos||[])){ for(const P of (PR.piezas||[])){ if(rutaDeProducto(P)===ruta && slugDe(P.nombre)===slug){ pr=PR; p=P; } } } }
  // 1) la última pieza abierta, si coincide con la sección (SOLO si el deep-link no fijó una)
  if(!p) try{ const u=JSON.parse(localStorage.getItem("sbb-ultima")||"null"); if(u){ pr=proyectoPorId(u.pr); p=pr&&(pr.piezas||[]).find(x=>x.id===u.p); if(!(p && rutaDeProducto(p)===ruta)){ pr=null; p=null; } } }catch(_){}
  // 2) si no, cualquier pieza de esa sección (la última encontrada)
  if(!p){ for(const PR of (workspace.proyectos||[])){ for(const P of (PR.piezas||[])){ if(rutaDeProducto(P)===ruta){ pr=PR; p=P; } } } }
  if(p && pr){
    proyecto = pr; proyectoVistoId = pr.id;
    document.getElementById("galeria").classList.remove("show");
    activarPieza(p.id);
    return true;
  }
  // 3) ninguna existe → crea una de esta sección
  crearDesde(cfg.tipo);
  return true;
}
// La URL al editar refleja la SECCIÓN de la pieza (no existe un "/editor" genérico).
function rutaDeProducto(p){
  if(!p) return null;
  if(p.setTipo === "facebook") return "/fb-ia";
  if(esComposicion(p) || esSetPieza(p)) return "/gdn-ia";
  const f = p.formato;
  if(f==="email") return "/email-ia";
  if(f==="ads") return "/ads-ia";
  if(f==="libre") return "/free";
  if(/^fb-/.test(String(f||""))) return "/fb-ia";
  if(/^display|^linkedin/.test(String(f||""))) return "/gdn-ia";
  return "/free";   // invitación y otros documentos → lienzo abierto
}
