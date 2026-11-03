/* ══════════════════════════════════════════════════════════════════
   INICIO Y PROYECTOS  ·  funciones/comun/dashboard.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Galería, Home, tarjetas «¿Qué vas a crear?» (crearConIA), Proyectos, En curso, Realizados, Historial, Permisos, Configuración, Papelera y alta/baja de proyectos.
   QUIÉN LO USA: Las tarjetas del Home llaman a: Display → crearBannerEnBlanco (banners), Facebook → crearBannerEnBlanco, Search → irACampanas (search), Campaña completa → crearCampanaCompleta (campana-completa).
   SECCIONES (en orden):
     1. Biblioteca de creaciones (galería) + preview
     2. Dashboard C "Portal": controlador de vistas (barra superior + páginas)
     3. §05 · PROYECTOS EN CURSO / REALIZADOS
     4. §05 · HISTORIAL DE TRABAJOS
     5. ADMIN: los proyectos de LOS DEMÁS usuarios (solo lectura, con dueño)
     6. Papelera (soft-delete)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
/* ── Biblioteca de creaciones (galería) + preview ──────────────────────── */
function esMovil(){ return window.matchMedia("(max-width:820px)").matches; }

function montarThumb(thumb, p){
  if(!p.canvas || p.canvas.length === 0){ thumb.innerHTML = `<div class="cre-empty">Pieza vacía</div>`; return; }
  const fmt = FORMATOS[p.formato] || FORMATOS.email;
  const pieceW = (p.tema.ancho && /^\d+$/.test(p.tema.ancho) && !fmt.alto) ? +p.tema.ancho : fmt.ancho;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("scrolling", "no");
  thumb.appendChild(iframe);
  const ajustar = () => {
    const w = thumb.clientWidth || 240;
    const scale = w / pieceW;
    iframe.style.width = pieceW + "px";
    iframe.style.height = Math.ceil((thumb.clientHeight || 180) / scale) + "px";
    iframe.style.transform = "scale(" + scale + ")";
  };
  ajustar();
  iframe.srcdoc = generarHTMLDePieza(p);
  requestAnimationFrame(ajustar);
}

// Color por categoría (marca Gamonal: azul + verde + amarillo; los otros en rosa/teal).
// Glifo (color del ícono) sobre el fondo SÓLIDO oficial del tipo.
const CAT_COLOR = { "Email":"#ffffff", "Banners":"#08103a", "Formato Libre":"#ffffff", "Post":"#ffffff", "Ads":"#141c3a", "Otro":"#141c3a" };
// Categoría de una pieza según su formato (para stats y la columna Tipo).
function categoriaDe(formato){
  if(formato==="email"||formato==="invitacion") return "Email";
  if(formato==="ads") return "Ads";
  if(formato==="libre") return "Formato Libre";
  if(formato && formato.indexOf("display-")===0) return "Banners";
  if(formato && formato.indexOf("fb-")===0) return "Facebook";
  if(formato==="linkedin" || (formato && formato.indexOf("linkedin-")===0)) return "Post";
  return "Otro";
}

// renderGaleria = render del Dashboard "Mis campañas" (pantalla inicial).
function proyectoPorId(id){ return workspace.proyectos.find(p => p.id === id); }

/* ── Dashboard C "Portal": controlador de vistas (barra superior + páginas) ── */
const DASH_VIEWS = { home:"pg-home", "en-curso":"pg-encurso", realizados:"pg-realizados", proyectos:"pg-proyectos", marcas:"pg-marcas", imagenes:"pg-imagenes", historial:"pg-historial", papelera:"pg-papelera", permisos:"pg-permisos", configuracion:"pg-config" };
let dashView = "home";
let filtroHome = "todas", filtroProy = "todas", buscaProy = "";

function urlDeVista(v){ return v==="home" ? "/home" : "/"+v; }
function dashVista(v){ if(!DASH_VIEWS[v]) v="home"; dashView=v; document.getElementById("galeria").classList.add("show"); renderGaleria(); if(typeof aplicarPermisosUI==="function") aplicarPermisosUI(); }
function dashIr(view){
  cerrarMenusNav();
  dashVista(view);
  setURL(urlDeVista(dashView));
  const sc=document.getElementById("dash-scroll"); if(sc) sc.scrollTop=0;
}
function dashBuscar(){ dashIr("proyectos"); setTimeout(()=>{ const b=document.getElementById("py-buscar"); if(b) b.focus(); },60); }
function toggleMenuNav(id, ev){ if(ev) ev.stopPropagation(); const m=document.getElementById(id); if(!m) return; const abierto=m.classList.contains("open"); cerrarMenusNav(); if(!abierto) m.classList.add("open"); }
function cerrarMenusNav(){ document.querySelectorAll(".cnav-menu.open").forEach(m=>m.classList.remove("open")); }
document.addEventListener("click", (e)=>{ if(!e.target.closest(".cnav-drop") && !e.target.closest(".cnav-menu")) cerrarMenusNav(); });

// El input de idea del Home rellena el brief y abre el Asistente IA.
function generarDesdeIdea(){
  const inp=document.getElementById("cb-idea");
  const v=(inp&&inp.value||"").trim();
  abrirIA();
  if(v){ const q=document.getElementById("ia-que"); if(q) q.value=v; }
}
function filtrarHome(f){ filtroHome=f; renderHome(); }
function filtrarProy(f){ filtroProy=f; renderProyectosPage(); }

function tiempoRel(ts){
  if(!ts) return "";
  const s=(Date.now()-ts)/1000;
  if(s<60) return "hace un momento";
  const m=Math.floor(s/60); if(m<60) return "hace "+m+" min";
  const h=Math.floor(m/60); if(h<24) return "hace "+h+" h";
  const d=Math.floor(h/24); if(d<7) return "hace "+d+" día"+(d!==1?"s":"");
  const w=Math.floor(d/7); if(w<5) return "hace "+w+" semana"+(w!==1?"s":"");
  return new Date(ts).toLocaleDateString("es-CL",{day:"2-digit",month:"short"});
}
const CHIP_CLASE = { "Email":"email", "Banners":"display", "Post":"post", "Formato Libre":"libre", "Ads":"ads", "Otro":"libre" };
const CHIP_TXT   = { "Email":"EMAIL", "Banners":"DISPLAY", "Post":"POST", "Formato Libre":"LIBRE", "Ads":"ADS", "Otro":"LIBRE" };
const CAT_ICO    = { "Email":"email", "Banners":"grid", "Post":"compartir", "Formato Libre":"documento", "Ads":"buscar", "Otro":"documento" };
// Fondo SÓLIDO oficial por tipo (Email azul · Display amarillo · Search gris · Libre magenta).
const CAT_TINTE  = { "Email":"#1c73cb", "Banners":"#fce865", "Post":"#040764", "Formato Libre":"#b318a3", "Ads":"#aeb6c6", "Otro":"#aeb6c6" };
// Íconos SÓLIDOS de la tabla de trabajos (según la gráfica): Email azul ·
// Display turquesa (glifo navy) · Search navy · Libre magenta.
const WORK_BG = { "Email":"#1c73cb", "Banners":"#fce865", "Post":"#040764", "Formato Libre":"#b318a3", "Ads":"#aeb6c6", "Otro":"#aeb6c6" };
const WORK_GL = { "Email":"#ffffff", "Banners":"#08103a", "Post":"#ffffff", "Formato Libre":"#ffffff", "Ads":"#141c3a", "Otro":"#141c3a" };
function chipDe(cat){ return `<span class="chip ${CHIP_CLASE[cat]||"libre"}">${CHIP_TXT[cat]||"LIBRE"}</span>`; }
function estadoDe(p){
  const listo = (p.canvas||[]).length>0 || !!p.composicion || !!p.esSet || !!(p.adsData && (p.adsData.grupos||[]).length);
  return listo ? {txt:"Listo", color:"#1c973b"} : {txt:"Borrador", color:"#c2c7d4"};
}
function todasLasPiezas(){
  const out=[];
  (workspace.proyectos||[]).forEach(pr => (pr.piezas||[]).forEach(p => out.push({pr, p})));
  return out;
}

function renderGaleria(){
  const u = window.SBB_USER || {};
  const email = u.email || "";
  const av = document.getElementById("dash-av"); if(av) av.textContent = email ? email[0] : "·";
  const dem = document.getElementById("dash-email"); if(dem) dem.textContent = email || "—";
  const rol = document.getElementById("cuenta-rol"); if(rol) rol.textContent = u.isSuperAdmin ? "Super admin" : (email ? "Editor" : "Cuenta");
  const nPap = (workspace.papelera||[]).length;
  const badge = document.getElementById("nav-pap-badge");
  if(badge){ badge.textContent = nPap || ""; badge.classList.toggle("on", nPap>0); }
  // Estados legacy ("proyectos"/"creatividades") → página Proyectos.
  if(vistaDash==="creatividades"){ vistaDash="proyectos"; dashView="proyectos"; }
  Object.keys(DASH_VIEWS).forEach(v => { const el=document.getElementById(DASH_VIEWS[v]); if(el) el.style.display = (v===dashView) ? "" : "none"; });
  document.querySelectorAll(".cnav-link, .mtabs button[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view===dashView));
  if(dashView==="home") renderHome();
  else if(dashView==="en-curso") renderEnCurso();
  else if(dashView==="realizados") renderRealizados();
  else if(dashView==="historial") renderHistorial();
  else if(dashView==="proyectos") renderProyectosPage();
  else if(dashView==="marcas") montarMarcasEn("pagina");
  else if(dashView==="imagenes") montarImagenesEn("pagina");
  else if(dashView==="papelera") montarPapeleraEnPagina();
  else if(dashView==="permisos") renderPermisosPage();
  else if(dashView==="configuracion") renderConfigPage();
  pintarIconos();
}
// Shims de compatibilidad con el render anterior.
function renderProyectos(){ renderProyectosPage(); }
function renderCreatividades(){ renderProyectosPage(); }

// ── §05 · PROYECTOS EN CURSO / REALIZADOS ────────────────────────────────
// Un proyecto es una campaña. "Realizado" = cerrado: lleva un sello `cerrado`
// con la fecha y sale de la lista de los que están en curso. No se borra nada
// y se reabre con un clic — cerrar es un estado, no una despedida. (Borrar
// sigue siendo la papelera, que es otra cosa.)
function esProyectoCerrado(pr){ return !!(pr && pr.cerrado); }
function proyectosPorEstado(cerrados){
  return (workspace.proyectos||[]).filter(pr => esProyectoCerrado(pr) === !!cerrados)
    .sort((a,b)=>(b.cerrado||b.creado||0)-(a.cerrado||a.creado||0));
}
function cerrarProyecto(id){
  const pr=(workspace.proyectos||[]).find(x=>x.id===id); if(!pr) return;
  pr.cerrado = Date.now(); persistir(); renderGaleria();
  toast(`«${pr.nombre}» pasó a realizados`);
}
function reabrirProyecto(id){
  const pr=(workspace.proyectos||[]).find(x=>x.id===id); if(!pr) return;
  delete pr.cerrado; persistir(); renderGaleria();
  toast(`«${pr.nombre}» volvió a los proyectos en curso`);
}
// Tarjeta de campaña, igual en las dos páginas: qué contiene, cuándo se creó,
// cuándo se tocó por última vez y qué se puede hacer con ella.
function tarjetaCampanaHTML(pr, cerrado){
  const piezas = pr.piezas||[];
  const ultimo = piezas.reduce((m,p)=>Math.max(m, p._mod||0), 0) || pr.creado || 0;
  const chips = piezas.length
    ? piezas.map(p=>`<button class="cm-pz" onclick="abrirPiezaDesdeDash('${pr.id}','${p.id}')" title="${escAttr(p.nombre||"")}">${chipDe(categoriaDe(p.formato))}<span>${esc(p.nombre||"Pieza")}</span></button>`).join("")
    : `<span class="cm-vacio">Sin piezas todavía</span>`;
  const acc = cerrado
    ? `<button class="btn-sec" onclick="reabrirProyecto('${pr.id}')"><span class="ico" data-ic="deshacer" data-icsize="14px"></span> Reabrir</button>`
    : `<button class="btn-sec" onclick="cerrarProyecto('${pr.id}')"><span class="ico" data-ic="check" data-icsize="14px"></span> Marcar realizado</button>`;
  return `<div class="cm-card${cerrado?" cerrada":""}">
    <div class="cm-h">
      <div class="cm-t">${esc(pr.nombre||"Proyecto")}${cerrado?` <span class="cm-sello">Realizada</span>`:""}</div>
      <div class="cm-acc">${acc}</div>
    </div>
    <div class="cm-meta">${piezas.length} pieza${piezas.length===1?"":"s"} · creada ${pr.creado?fechaHora(pr.creado):"—"}${ultimo?` · última edición ${tiempoRel(ultimo)}`:""}</div>
    <div class="cm-pzs">${chips}</div>
  </div>`;
}
function renderEnCurso(){
  const c=document.getElementById("ec-lista"); if(!c) return;
  const prs=proyectosPorEstado(false);
  const sub=document.getElementById("ec-sub");
  if(sub) sub.textContent = prs.length ? `${prs.length} campaña${prs.length===1?"":"s"} abierta${prs.length===1?"":"s"} · entra al editor y sigue trabajando` : "Campañas abiertas · entra al editor y sigue trabajando";
  c.innerHTML = prs.length ? prs.map(pr=>tarjetaCampanaHTML(pr,false)).join("")
    : `<div class="hg-vacio">No tienes campañas abiertas.<br>Crea una con Char-B y todas sus piezas quedan en el mismo proyecto.</div>`;
  pintarIconos();
}
function renderRealizados(){
  const c=document.getElementById("rz-lista"); if(!c) return;
  const prs=proyectosPorEstado(true);
  const sub=document.getElementById("rz-sub");
  if(sub) sub.textContent = prs.length ? `${prs.length} campaña${prs.length===1?"":"s"} cerrada${prs.length===1?"":"s"} · se pueden reabrir cuando quieras` : "Campañas cerradas · se abren en solo lectura y se pueden reabrir";
  c.innerHTML = prs.length ? prs.map(pr=>tarjetaCampanaHTML(pr,true)).join("")
    : `<div class="hg-vacio">Todavía no has cerrado ninguna campaña.<br>Cuando termines una, márcala como realizada en «En curso».</div>`;
  pintarIconos();
}
// Toda hora que se muestre pasa por aquí, con la zona elegida en Configuración.
function fechaHora(ts){
  if(!ts) return "—";
  try{ return new Date(ts).toLocaleString("es-CL",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:tzActiva()}); }
  catch(_){ try{ return new Date(ts).toLocaleString("es-CL"); }catch(__){ return "—"; } }
}
// ── §05 · HISTORIAL DE TRABAJOS ──────────────────────────────────────────
// El manual pide tres cosas: hora de creación, usuarios conectados con fecha y
// hora, y datos de uso. Las tres se muestran con datos REALES: los trabajos
// salen del workspace; los accesos y el uso del asistente los lleva el servidor
// (tabla `accesos` y `ia_uso` en D1) y llegan por /api/whoami — solo al
// administrador, que es quien ve el historial completo (§03).
function renderHistorial(){
  const c=document.getElementById("hi-cont"); if(!c) return;
  const u = window.SBB_USER || {};
  const trabajos = todasLasPiezas()
    .map(({pr,p}) => ({ pr, p, creado: p._creado || pr.creado || 0, mod: p._mod || 0 }))
    .sort((a,b)=>(b.mod||b.creado)-(a.mod||a.creado));
  const filas = trabajos.slice(0,60).map(({pr,p,creado,mod}) => `<tr>
      <td><button class="hi-lnk" onclick="abrirPiezaDesdeDash('${pr.id}','${p.id}')">${esc(p.nombre||"Pieza")}</button></td>
      <td>${chipDe(categoriaDe(p.formato))}</td>
      <td>${esc(pr.nombre||"—")}${esProyectoCerrado(pr)?' <span class="cm-sello">Realizada</span>':''}</td>
      <td class="hi-num">${fechaHora(creado)}</td>
      <td class="hi-num">${mod?fechaHora(mod):"—"}</td>
    </tr>`).join("");
  let h = `<div class="page-card">
    <div class="hi-h">Trabajos <small>${trabajos.length} en total${trabajos.length>60?" · se listan los 60 más recientes":""}</small></div>
    ${trabajos.length ? `<div class="hi-tabla"><table><thead><tr><th>Trabajo</th><th>Tipo</th><th>Proyecto</th><th>Creado</th><th>Última edición</th></tr></thead><tbody>${filas}</tbody></table></div>`
      : `<div class="hg-vacio">Todavía no hay trabajos que registrar.</div>`}
  </div>`;
  // Uso propio del asistente (lo sabe el servidor y es el dato que limita).
  const uso = u.usoIA || null;
  if(uso){
    h += `<div class="page-card"><div class="hi-h">Uso del asistente</div>
      <p class="hi-p">Has usado Char-B <b>${uso.usados}</b> ${uso.usados===1?"vez":"veces"}${uso.limite?` de un tope de <b>${uso.limite}</b>`:" (sin tope)"}.</p></div>`;
  }
  // Accesos: dato de administrador (§03: "ve el historial completo").
  if(u.rol==="admin"){
    const acc = Array.isArray(u.accesos) ? u.accesos : null;
    h += `<div class="page-card"><div class="hi-h">Accesos de los usuarios</div>`;
    if(acc && acc.length){
      h += `<div class="hi-tabla"><table><thead><tr><th>Usuario</th><th>Fecha y hora</th></tr></thead><tbody>`
        + acc.slice(0,80).map(a=>`<tr><td>${esc(a.usuario||"—")}</td><td class="hi-num">${fechaHora(a.ts)}</td></tr>`).join("")
        + `</tbody></table></div>`;
    } else if(acc){
      h += `<p class="hi-p">Todavía no hay accesos registrados. Se anotan desde ahora, cada vez que alguien entra.</p>`;
    } else {
      h += `<p class="hi-p">El registro de accesos no está disponible en esta sesión.</p>`;
    }
    h += `</div>`;
  }
  c.innerHTML = h;
  pintarIconos();
}

function renderHome(){
  // Saludo con nombre: perfil > usuario del login (capitalizado) > "Hola".
  const u = window.SBB_USER || {};
  const cap = (s)=> s ? s.charAt(0).toUpperCase()+s.slice(1) : "";
  const nombre = (workspace.perfil && workspace.perfil.nombre) || u.nombre || cap(u.usuario||"");
  const sal = document.getElementById("home-saludo");
  if(sal) sal.textContent = nombre ? ("Hola, "+nombre) : "Hola";
  // La cara de Char-B en todos sus avatares (hero, modal, etc.).
  const face = document.querySelector(".fab-charb");
  if(face && face.src) document.querySelectorAll("img.charb-face").forEach(i => { if(!i.src) i.src = face.src; });
  const hoy = new Date();
  const f = document.getElementById("home-fecha");
  if(f) f.textContent = DIAS_ES[hoy.getDay()].charAt(0).toUpperCase()+DIAS_ES[hoy.getDay()].slice(1)+" "+hoy.getDate()+" de "+MESES_ES[hoy.getMonth()]+" · aquí está tu taller de creatividades";
  const b = workspace.banner || {};
  const bt = document.getElementById("banner-titulo"); if(bt && b.titulo) bt.textContent = b.titulo;
  document.querySelectorAll("#hg-filtros .pillf").forEach(x => x.classList.toggle("on", x.dataset.f===filtroHome));
  const piezas = todasLasPiezas()
    .sort((a,b2)=>(b2.p._mod||b2.pr.creado||0)-(a.p._mod||a.pr.creado||0));
  let lista = piezas;
  if(filtroHome==="activos") lista = piezas.filter(x => estadoDe(x.p).txt==="Listo");
  // "todas" y "recientes" = todas (ya ordenadas por más recientes).
  const top = lista.slice(0,6);
  const grid = document.getElementById("hg-grid"); if(!grid) return;
  if(!top.length){
    grid.innerHTML = `<div class="hg-vacio">Aún no hay trabajos${filtroHome!=="todas"?" en este filtro":""}.<br>Crea el primero con las tarjetas de arriba o con Char-B.</div>`;
    return;
  }
  const rows = top.map(({pr,p}) => {
    const cat = categoriaDe(p.formato);
    const est = estadoDe(p);
    const fecha = p._mod ? tiempoRel(p._mod) : (pr.creado ? tiempoRel(pr.creado) : "");
    return `<div class="ult-row">
      <div class="ult-tw">
        <span class="ult-ic" style="background:${WORK_BG[cat]||"#5b6178"};color:${WORK_GL[cat]||"#fff"}">${svgIcon(CAT_ICO[cat]||"documento",{size:"17px"})}</span>
        <div style="min-width:0"><div class="ult-nm">${esc(p.nombre)}</div><div style="margin-top:3px">${chipDe(cat)}</div></div>
      </div>
      <div class="ult-proj">${esc(pr.nombre)}</div>
      <div class="ult-mod">${fecha}</div>
      <div class="ult-est"><span class="pt" style="background:${est.color}"></span>${est.txt}</div>
      <button class="ult-go" onclick="abrirPiezaDesdeDash('${pr.id}','${p.id}')" title="Abrir"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </div>`;
  }).join("");
  const totalN = piezas.length;
  grid.innerHTML = `<div class="ult-cab"><span>Trabajo</span><span>Proyecto</span><span>Última modificación</span><span>Estado</span><span></span></div>${rows}<div class="ult-ver"><a onclick="dashIr('proyectos')">Ver todos los trabajos (${totalN}) →</a></div>`;
}
function abrirPiezaDesdeDash(prId, pId){
  const pr = proyectoPorId(prId); if(!pr) return;
  proyecto = pr; proyectoVistoId = pr.id;
  document.getElementById("galeria").classList.remove("show");
  activarPieza(pId);
}

function renderProyectosPage(){
  const proys = workspace.proyectos || [];
  const nCre = todasLasPiezas().length;
  const sub = document.getElementById("py-sub");
  if(sub) sub.textContent = nCre+" creatividad"+(nCre!==1?"es":"")+" en "+proys.length+" proyecto"+(proys.length!==1?"s":"");
  document.querySelectorAll(".py-filtros .pillf").forEach(x => x.classList.toggle("on", x.dataset.f===filtroProy));
  const q = (buscaProy||"").toLowerCase();
  const cont = document.getElementById("py-lista"); if(!cont) return;
  if(!proys.length){ cont.innerHTML = `<div class="hg-vacio">Aún no tienes proyectos. Crea el primero con <b>+ Nuevo proyecto</b>.</div>`; renderEspaciosOtros(cont); return; }
  const html = proys.slice().reverse().map(pr => {
    const piezas = (pr.piezas||[]).filter(p =>
      (filtroProy==="todas" || categoriaDe(p.formato)===filtroProy) &&
      (!q || (p.nombre||"").toLowerCase().includes(q) || (pr.nombre||"").toLowerCase().includes(q)));
    if((filtroProy!=="todas" || q) && !piezas.length) return "";
    const rows = piezas.slice().reverse().map(p => {
      const cat = categoriaDe(p.formato);
      const est = estadoDe(p);
      const nT = (p.esSet||p.composicion) ? (((p.artboards||[]).length||1)+" tamaños") : "1 pieza";
      return `<div class="py-row">
        <div class="py-crea"><span class="ult-ic" style="background:${WORK_BG[cat]||'#5b6178'};color:${WORK_GL[cat]||'#fff'}">${svgIcon(CAT_ICO[cat]||'documento',{size:'16px'})}</span><div style="min-width:0"><div class="rn" onclick="abrirPiezaDesdeDash('${pr.id}','${p.id}')" title="Editar">${esc(p.nombre)}</div><div class="rs">${p._mod?"Actualizado "+tiempoRel(p._mod):""}</div></div></div>
        <span>${chipDe(cat)}</span>
        <span class="py-piezas">${nT}</span>
        <span class="st-pill"><span class="pt" style="background:${est.color}"></span>${est.txt}</span>
        <div class="py-acc">
          <button class="py-mini" onclick="abrirPiezaDesdeDash('${pr.id}','${p.id}')" title="Editar">${svgIcon("editar",{size:"14px"})}</button>
          <button class="py-mini" onclick="abrirPreview('${p.id}')" title="Vista previa">${svgIcon("ojo",{size:"14px"})}</button>
          <button class="py-mini" onclick="duplicarCreatividadEn('${pr.id}','${p.id}')" title="Duplicar">${svgIcon("copiar",{size:"14px"})}</button>
          <button class="py-mini danger" onclick="eliminarCreacionEn('${pr.id}','${p.id}')" title="Eliminar">${svgIcon("basura",{size:"14px"})}</button>
        </div>
      </div>`;
    }).join("");
    const n=(pr.piezas||[]).length;
    return `<div class="py-grupo">
      <div class="py-grupo-head">
        <span class="nom" onclick="renombrarProyectoInline(this,'${pr.id}')" title="Clic para renombrar">${esc(pr.nombre)}</span>
        <span class="cnt">${n} creatividad${n!==1?"es":""}</span>
        <div class="py-grupo-acc">
          <button class="py-nueva" onclick="toggleTiposProyecto('${pr.id}')">${svgIcon("mas",{size:"13px"})} Nueva creatividad</button>
          <button class="py-mini danger" onclick="eliminarProyecto('${pr.id}')" title="Enviar el proyecto a la papelera">${svgIcon("basura",{size:"14px"})}</button>
        </div>
      </div>
      ${proyTiposAbierto===pr.id ? tiposProyectoHTML(pr.id) : ""}
      ${piezas.length ? `<div class="py-cab"><span>Creatividad</span><span>Tipo</span><span>Piezas</span><span>Estado</span><span></span></div>${rows}` : (proyTiposAbierto===pr.id ? "" : `<div class="py-vacio">Proyecto vacío · pulsa <b>+ Nueva creatividad</b> para empezar</div>`)}
    </div>`;
  }).join("");
  cont.innerHTML = html || `<div class="hg-vacio">Nada coincide con el filtro o la búsqueda.</div>`;
  // Acción destructiva al pie, como terciaria (no compite con "+ Nuevo proyecto").
  if(proys.length && filtroProy==="todas" && !q) cont.insertAdjacentHTML("beforeend",
    `<button class="py-borrartodo" onclick="borrarTodosProyectos()">${svgIcon("basura",{size:"13px"})} Enviar todos los proyectos a la papelera</button>`);
  renderEspaciosOtros(cont);
}
// Selector inline de tipo de creatividad DENTRO del proyecto (reemplaza al
// popover flotante, que se perdía — el flujo queda a la vista: DEC-009).
let proyTiposAbierto = null;
function toggleTiposProyecto(id){ proyTiposAbierto = (proyTiposAbierto===id) ? null : id; renderProyectosPage(); }
function tiposProyectoHTML(prId){
  const tipos = [
    ["banner","banner","display-300x250","grid","Google Display"],
    ["facebook","banner","fb-1080x1350","imagen","Facebook Ads"],
    ["ads","ads","ads","buscar","Google Search"]
  ].filter(([plat])=>puedePlat(plat));
  // Cada tipo usa su TINTE claro de la paleta (mismo código de color que los
  // chips DISPLAY/FACEBOOK/ADS) — la jerarquía se lee de un vistazo.
  const claseTipo = { "display-300x250":"t-display", "fb-1080x1350":"t-display", ads:"t-ads" };
  return `<div class="py-tipos"><span class="pt-lbl">¿Qué vas a crear aquí?</span>${tipos.map(([plat,serv,fmt,ico,lbl]) =>
    `<button class="${claseTipo[fmt]||""}" onclick="proyectoVistoId='${prId}';crearConIA('${plat}')"><span style="display:inline-flex;">${svgIcon(ico,{size:"15px"})}</span> ${lbl}</button>`).join("")}</div>`;
}
// ── ADMIN: los proyectos de LOS DEMÁS usuarios (solo lectura, con dueño) ──
let _espaciosOtros = null;   // null = no cargado · [] = cargado
function renderEspaciosOtros(cont){
  const u = window.SBB_USER || {};
  if(u.rol !== "admin") return;
  if(_espaciosOtros === null){
    _espaciosOtros = [];   // evita doble fetch
    fetch("/api/proyectos?todos=1", { credentials:"include" })
      .then(r=>r.ok?r.json():null)
      .then(d=>{ if(d && d.ok){ _espaciosOtros = d.espacios || []; if(dashView==="proyectos") renderProyectosPage(); } })
      .catch(()=>{});
    return;
  }
  const conAlgo = _espaciosOtros.filter(e => (e.proyectos||[]).length);
  if(!conAlgo.length) return;
  let h = `<div class="dz-sec" style="margin:26px 0 10px;font-size:12px;letter-spacing:.08em;color:#5b6178;">ESPACIOS DE OTROS USUARIOS · solo lectura</div>`;
  conAlgo.forEach((e, ei) => {
    (e.proyectos||[]).slice().reverse().forEach(pr => {
      const piezas = pr.piezas||[];
      const rows = piezas.slice().reverse().map(p => {
        const cat = categoriaDe(p.formato); const est = estadoDe(p);
        const nT = (p.esSet||p.composicion) ? (((p.artboards||[]).length||1)+" tamaños") : "1 pieza";
        return `<div class="py-row">
          <div style="min-width:0"><div class="rn" onclick="previewAjeno(${ei},'${pr.id}','${p.id}')" title="Vista previa">${esc(p.nombre)}</div><div class="rs">${p._mod?"Actualizado "+tiempoRel(p._mod):""}</div></div>
          <span>${chipDe(cat)}</span>
          <span class="py-piezas">${nT}</span>
          <span class="st-pill"><span class="pt" style="background:${est.color}"></span>${est.txt}</span>
          <div class="py-acc"><button class="py-mini" onclick="previewAjeno(${ei},'${pr.id}','${p.id}')" title="Vista previa">${svgIcon("ojo",{size:"14px"})}</button></div>
        </div>`;
      }).join("");
      const n = piezas.length;
      h += `<div class="py-grupo">
        <div class="py-grupo-head">
          <span class="nom" style="cursor:default">${esc(pr.nombre)}</span>
          <span class="chip" style="background:#eef1fb;color:#040764;">${esc((e.usuario||"?").toUpperCase())}</span>
          <span class="cnt">${n} creatividad${n!==1?"es":""}</span>
        </div>
        ${n ? `<div class="py-cab"><span>Creatividad</span><span>Tipo</span><span>Piezas</span><span>Estado</span><span></span></div>${rows}` : ""}
      </div>`;
    });
  });
  cont.insertAdjacentHTML("beforeend", h);
}
function previewAjeno(ei, prId, pId){
  const e = (_espaciosOtros||[])[ei]; if(!e) return;
  const pr = (e.proyectos||[]).find(x=>x.id===prId); if(!pr) return;
  const p = (pr.piezas||[]).find(x=>x.id===pId); if(!p) return;
  document.getElementById("pv-title").textContent = p.nombre + " · de " + (e.usuario||"otro usuario");
  document.getElementById("pv-frame").srcdoc = (p.esSet||p.composicion) ? generarHTMLDeComposicion(p, p.masterFmt||"display-300x250") : generarHTMLDePieza(p);
  setPreviewWidth(esMovil() ? "movil" : "full");
  document.getElementById("preview-modal").classList.add("show");
}
function renombrarProyectoInline(span, id){
  const pr = proyectoPorId(id); if(!pr) return;
  _renombrarInline(span, pr.nombre || "Proyecto", (v)=>{ pr.nombre = v; persistir(); renderProyectosPage(); if(proyecto&&proyecto.id===id) renderTabsPiezas(); });
}
// (El popover flotante "menu-nueva-proy" se eliminó: el selector de tipo ahora
// es la fila inline .py-tipos dentro del proyecto — ver tiposProyectoHTML.)
function eliminarCreacionEn(prId, id){ proyectoVistoId = prId; eliminarCreacion(id); }
function duplicarCreatividadEn(prId, id){ proyectoVistoId = prId; duplicarCreatividad(id); }

/* Montaje de contenidos compartidos (página del dashboard ↔ modal del editor). */
function montarEn(id, destinoId){ const el=document.getElementById(id), d=document.getElementById(destinoId); if(el&&d&&el.parentElement!==d) d.appendChild(el); }
function montarMarcasEn(donde){
  if(donde==="pagina"){ montarEn("marcas-cont","slot-marcas"); renderMarcas(); mostrarBibliotecaMarcas(); }
  else montarEn("marcas-cont","modal-marcas-body");
}
function montarImagenesEn(donde){
  if(donde==="pagina"){ montarEn("imagenes-cont","slot-imagenes"); renderImagenes(); cargarR2(); }
  else montarEn("imagenes-cont","modal-imagenes-body");
}
function montarPapeleraEnPagina(){
  montarEn("papelera-cont","slot-papelera");
  renderPapelera();
  const v=document.getElementById("pg-pap-vaciar");
  if(v) v.style.display = (workspace.papelera||[]).length ? "inline-flex" : "none";
}

function renderPermisosPage(){
  const cont = document.getElementById("permisos-cont"); if(!cont) return;
  const u = window.SBB_USER || {};
  if(u.rol && u.rol !== "admin"){
    cont.innerHTML = `<div class="hg-vacio">Los permisos los administra el administrador.</div>`;
    return;
  }
  const lista = (u.usuarios && u.usuarios.length) ? u.usuarios : (u.usuario ? [{usuario:u.usuario, rol:u.rol||"admin", permisos:["*"]}] : []);
  const colores = ["#040764","#1c73cb","#20b6b6","#b318a3","#149a9a"];
  const SERV_LBL = { "*":"Todo", email:"Email", banner:"Banners", ads:"Search", libre:"Libre" };
  cont.innerHTML = `<div class="perm-tabla">
    <div class="perm-cab"><span>Usuario</span><span>Servicios</span><span>Rol</span></div>
    ${lista.map((m,i)=>{
      const esAdm = m.rol === "admin";
      const servs = (m.permisos||[]).map(p=>SERV_LBL[p]||p).join(" · ") || "—";
      return `<div class="perm-row">
        <div class="perm-user"><span class="perm-av" style="background:${colores[i%colores.length]}">${esc((m.usuario[0]||"?").toUpperCase())}</span><span class="perm-nom">${esc(m.usuario)}</span></div>
        <span class="perm-mail">${esAdm?"Todos los servicios":esc(servs)}</span>
        <span class="st-pill"><span class="pt" style="background:${esAdm?"#1c73cb":"#20b6b6"}"></span>${esAdm?"Administrador":"Limitado"}</span>
      </div>`;
    }).join("")}
  </div>
  <div class="perm-nota">Los usuarios se administran en el archivo <b>usuarios.js</b> del repositorio en GitHub: agrega o edita la línea del usuario (contraseña, rol y servicios) y guarda — en 1-2 minutos queda activo. La contraseña puede ir simple (campo <b>clave</b>) o protegida (genera la línea en <b>Configuración → Generador de acceso</b>).</div>`;
}

function renderConfigPage(){
  const cont = document.getElementById("config-cont"); if(!cont) return;
  const u = window.SBB_USER || {};
  const cfg = u.config || {};
  const ints = cfg.integraciones;
  const nombre = (workspace.perfil && workspace.perfil.nombre) || "";
  const badge = (on)=> on ? `<span class="badge-ok">Conectado</span>` : `<span class="badge-no">Sin conectar</span>`;
  cont.innerHTML = `
    <div class="cfg-card"><h3>Cuenta</h3><div class="cfg-grid">
      <div><div class="cfg-lbl">Nombre (para el saludo del Inicio)</div><input class="cfg-inp" id="cfg-nombre" value="${escAttr(nombre)}" placeholder="Tu nombre"></div>
      <div><div class="cfg-lbl">Usuario</div><input class="cfg-inp" value="${escAttr(u.usuario||u.email||"")}" readonly></div>
      <div><div class="cfg-lbl">Correo de contacto</div><input class="cfg-inp" id="cfg-contacto" value="${escAttr((workspace.perfil&&workspace.perfil.contacto)||"")}" placeholder="donde te escribimos"></div>
      <div><div class="cfg-lbl">Zona horaria</div><select class="cfg-inp" id="cfg-tz">${ZONAS_HORARIAS.map(([v,l])=>`<option value="${esc(v)}" ${((workspace.perfil&&workspace.perfil.tz)||tzDelNavegador())===v?"selected":""}>${esc(l)}</option>`).join("")}</select></div>
    </div>
    <p style="font-size:12.5px;color:#5b6178;margin:12px 0 0;line-height:1.6;">Las fechas y horas del historial se muestran en esta zona. Para <b>cambiar tu contraseña</b>, usa el generador de más abajo y pásale la línea al administrador (las credenciales viven en el archivo <b>usuarios.js</b>, §03 del manual).</p>
    </div>
    ${(cfg.resendFrom||cfg.siteUrl) ? `<div class="cfg-card"><h3>Envío de correos</h3><div class="cfg-grid">
      <div><div class="cfg-lbl">Remitente</div><input class="cfg-inp" value="${escAttr(cfg.resendFrom||"—")}" readonly></div>
      <div><div class="cfg-lbl">Sitio</div><input class="cfg-inp" value="${escAttr(cfg.siteUrl||"—")}" readonly></div>
    </div></div>` : ""}
    ${ints ? `<div class="cfg-card"><h3>Integraciones</h3>
      <div class="int-row"><div><div class="int-nom">Gemini · IA</div><div class="int-sub">Generación de emails y banners</div></div>${badge(ints.gemini)}</div>
      <div class="int-row"><div><div class="int-nom">Resend · Email</div><div class="int-sub">Envío de pruebas por correo</div></div>${badge(ints.resend)}</div>
      <div class="int-row"><div><div class="int-nom">Cloudflare D1 · Datos</div><div class="int-sub">Guardado del workspace en la nube</div></div>${badge(ints.d1)}</div>
      <div class="int-row"><div><div class="int-nom">Cloudflare R2 · Imágenes</div><div class="int-sub">Almacenamiento de la biblioteca</div></div>${badge(ints.r2)}</div>
    </div>` : ""}
    ${(u.rol==="admin") ? `<div class="cfg-card"><h3>Generador de acceso (usuarios.js)</h3>
      <p style="font-size:12.5px;color:#5b6178;margin:0 0 12px;line-height:1.6;">Escribe el usuario y la contraseña que le inventaste. Te doy la <b>línea protegida</b> lista para pegar en el archivo <b>usuarios.js</b> de GitHub (la contraseña no queda legible). Elige también sus servicios editando "permisos".</p>
      <div class="cfg-grid">
        <div><div class="cfg-lbl">Usuario</div><input class="cfg-inp" id="gen-usuario" placeholder="ej. maria" autocapitalize="none" spellcheck="false"></div>
        <div><div class="cfg-lbl">Contraseña</div><input class="cfg-inp" id="gen-pass" placeholder="la contraseña que le diste"></div>
      </div>
      <div class="cfg-acciones" style="margin-top:12px;"><button class="btn-pri" onclick="generarLineaUsuario()">Generar línea</button></div>
      <textarea class="cfg-inp" id="gen-out" readonly style="display:none;margin-top:12px;height:130px;font-family:monospace;font-size:11.5px;line-height:1.5;" onclick="this.select()"></textarea>
    </div>` : ""}
    <div class="cfg-acciones"><button class="btn-pri" onclick="guardarConfig()">Guardar cambios</button></div>`;
}
// Genera la línea de usuarios.js con la contraseña PROTEGIDA (sal + huella
// sha256, calculada aquí mismo en el navegador — la contraseña no viaja a ningún lado).
async function generarLineaUsuario(){
  const usuario = (document.getElementById("gen-usuario")||{}).value.trim();
  const pass = (document.getElementById("gen-pass")||{}).value;
  if(!usuario || !pass){ toast("Escribe usuario y contraseña"); return; }
  const sal = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal+":"+pass));
  const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  const linea = JSON.stringify({ usuario, rol:"limitado", permisos:["email","banner"], workspace:"ws-"+usuario.toLowerCase().replace(/[^a-z0-9]+/g,""), sal, hash }, null, 2);
  const out = document.getElementById("gen-out");
  out.value = linea + "\n\n← Pega esto en usuarios.js (dentro de \"usuarios\": [ … ]). Ajusta \"permisos\" a los servicios que le des: email, banner, ads, libre o [\"*\"].";
  out.style.display = "";
  out.focus(); out.select();
  try{ await navigator.clipboard.writeText(linea); toast("Línea copiada al portapapeles"); }catch(_){ toast("Línea generada — cópiala del recuadro"); }
}
// Zona horaria: la del navegador ya viene bien la mayoría de las veces, pero el
// manual (§05) pide poder fijarla — un equipo reparte campañas entre países y la
// hora de un historial que miente no sirve para nada.
const ZONAS_HORARIAS = [
  ["America/Santiago","Chile · Santiago"],
  ["America/Lima","Perú · Lima"],
  ["America/Bogota","Colombia · Bogotá"],
  ["America/Mexico_City","México · Ciudad de México"],
  ["America/Argentina/Buenos_Aires","Argentina · Buenos Aires"],
  ["America/Sao_Paulo","Brasil · São Paulo"],
  ["America/New_York","EE. UU. · Nueva York"],
  ["Europe/Madrid","España · Madrid"],
  ["UTC","UTC"]
];
function tzDelNavegador(){
  try{ const t=Intl.DateTimeFormat().resolvedOptions().timeZone; if(ZONAS_HORARIAS.some(([v])=>v===t)) return t; }catch(_){}
  return "America/Santiago";
}
function tzActiva(){ return (workspace.perfil && workspace.perfil.tz) || tzDelNavegador(); }
function guardarConfig(){
  const g = (id)=> (document.getElementById(id)||{}).value || "";
  workspace.perfil = workspace.perfil || {};
  workspace.perfil.nombre = g("cfg-nombre").trim();
  const contacto = g("cfg-contacto").trim();
  if(contacto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto)){ toast("Ese correo de contacto no se ve válido"); return; }
  workspace.perfil.contacto = contacto;
  const tz = g("cfg-tz"); if(tz) workspace.perfil.tz = tz;
  persistir();
  toast("Configuración guardada");
  renderGaleria();
}

function crearProyecto(){
  const nombre = prompt("Nombre del nuevo proyecto:", "Proyecto " + (workspace.proyectos.length+1));
  if(nombre === null) return;
  const pr = { id:uid(), nombre: (nombre.trim() || ("Proyecto " + (workspace.proyectos.length+1))), creado: Date.now(), piezas: [], activa: null };
  workspace.proyectos.push(pr);
  persistir();
  // Flujo guiado: el proyecto recién creado abre con su selector "¿Qué vas a
  // crear aquí?" desplegado — el paso siguiente queda a la vista.
  proyTiposAbierto = pr.id;
  abrirProyecto(pr.id);
}
function abrirProyecto(id){
  if(!proyectoPorId(id)) return;
  proyectoVistoId = id;
  dashVista("proyectos");
}
function volverAProyectos(){
  vistaDash = "proyectos"; proyectoVistoId = null;
  dashVista("proyectos");
}
// Guardar explícito (aunque el guardado es automático, el botón da tranquilidad).
async function guardarProyectoAhora(){
  persistir();
  toast("Guardando el proyecto…");
  await guardarEnNube();
  toast("Proyecto guardado ✓");
}
// Salir del proyecto: guarda y vuelve a la lista de proyectos (deja el proyecto
// abierto/seleccionado para que la persona no se pierda).
function salirDelProyecto(){
  persistir();
  guardarEnNube();
  if(proyecto) proyectoVistoId = proyecto.id;
  dashIr("proyectos");
}
function renombrarProyecto(id){
  const pr = proyectoPorId(id); if(!pr) return;
  const n = prompt("Nuevo nombre del proyecto:", pr.nombre);
  if(n === null) return;
  pr.nombre = n.trim() || pr.nombre; persistir(); renderGaleria();
  if(proyecto && proyecto.id === id) renderTabsPiezas();
}
function renombrarProyectoActual(){ if(proyectoVistoId) renombrarProyecto(proyectoVistoId); }
function eliminarProyecto(id){
  const pr = proyectoPorId(id); if(!pr) return;
  if(!confirm(`¿Enviar el proyecto "${pr.nombre}" (${(pr.piezas||[]).length} creatividad${(pr.piezas||[]).length!==1?"es":""}) a la Papelera?\n\nPodrás restaurarlo desde la Papelera.`)) return;
  moverAPapelera(id);
  if(proyectoVistoId === id){ proyectoVistoId = null; vistaDash = "proyectos"; }
  if(proyecto && proyecto.id === id) proyecto = null;
  persistir(); renderGaleria();
  toast("Proyecto enviado a la Papelera");
}
/* ── Papelera (soft-delete) ───────────────────────────────────────────────
   Borrar un proyecto NO lo destruye: lo mueve a workspace.papelera con un
   sello borradoTs. Desde la Papelera se puede Restaurar o Eliminar definitivo.
   Sincroniza con D1 como parte del workspace (last-write-wins). */
function moverAPapelera(id){
  const i = workspace.proyectos.findIndex(x => x.id === id); if(i<0) return;
  const pr = workspace.proyectos.splice(i,1)[0];
  pr.borradoTs = Date.now();
  (workspace.papelera = workspace.papelera || []).push(pr);
}
function borrarTodosProyectos(){
  const n = workspace.proyectos.length; if(!n){ toast("No hay proyectos que borrar"); return; }
  if(!confirm(`¿Enviar TODOS los proyectos (${n}) a la Papelera?\n\nPodrás restaurarlos desde la Papelera mientras no la vacíes.`)) return;
  workspace.proyectos.slice().forEach(pr => moverAPapelera(pr.id));
  proyectoVistoId = null; vistaDash = "proyectos"; proyecto = null;
  persistir(); renderGaleria();
  toast(`${n} proyecto${n!==1?"s":""} en la Papelera`);
}
function abrirPapelera(){ dashVista("papelera"); }
function renderPapelera(){
  const pap = workspace.papelera || [];
  const list = document.getElementById("pap-list"); if(!list) return;
  const tb = document.getElementById("pap-toolbar"); if(tb) tb.style.display = pap.length ? "flex" : "none";
  if(!pap.length){ list.innerHTML = `<div class="pap-empty">La papelera está vacía.</div>`; return; }
  list.innerHTML = pap.slice().reverse().map(pr => {
    const nP = (pr.piezas||[]).length;
    const f = pr.borradoTs ? new Date(pr.borradoTs).toLocaleDateString("es-CL",{day:"2-digit",month:"short"}) : "";
    return `<div class="pap-row">
      <span class="pap-nom">${esc(pr.nombre)}</span>
      <span class="pap-meta">${nP} creatividad${nP!==1?"es":""}${f?" · borrado "+f:""}</span>
      <div class="pap-acc">
        <button onclick="restaurarProyecto('${pr.id}')">${svgIcon("chevleft",{size:"13px"})} Restaurar</button>
        <button class="danger" onclick="eliminarDefinitivo('${pr.id}')">${svgIcon("basura",{size:"13px"})} Eliminar</button>
      </div>
    </div>`;
  }).join("");
}
function restaurarProyecto(id){
  const i = (workspace.papelera||[]).findIndex(x => x.id === id); if(i<0) return;
  const pr = workspace.papelera.splice(i,1)[0];
  delete pr.borradoTs;
  workspace.proyectos.push(pr);
  persistir(); renderPapelera(); renderGaleria();
  toast(`"${pr.nombre}" restaurado`);
}
function eliminarDefinitivo(id){
  const pr = (workspace.papelera||[]).find(x => x.id === id); if(!pr) return;
  if(!confirm(`¿Eliminar definitivamente "${pr.nombre}"?\n\nEsta acción NO se puede deshacer.`)) return;
  workspace.papelera = workspace.papelera.filter(x => x.id !== id);
  persistir(); renderPapelera(); renderGaleria();
  toast("Eliminado definitivamente");
}
function vaciarPapelera(){
  const n = (workspace.papelera||[]).length; if(!n){ toast("La papelera ya está vacía"); return; }
  if(!confirm(`¿Vaciar la Papelera? Se eliminarán definitivamente ${n} proyecto${n!==1?"s":""}.\n\nEsta acción NO se puede deshacer.`)) return;
  workspace.papelera = [];
  persistir(); renderPapelera(); renderGaleria();
  toast("Papelera vaciada");
}
function duplicarCreatividad(id){
  const pr = proyectoPorId(proyectoVistoId); if(!pr) return;
  const orig = pr.piezas.find(x => x.id === id); if(!orig) return;
  const copia = clone(orig); copia.id = uid(); copia.nombre = orig.nombre + " (copia)";
  pr.piezas.push(copia); persistir(); renderCreatividades();
}

// Crear una creatividad en el proyecto abierto (o crea/pide uno antes) y abrir el editor.
function pedirNombreTrabajo(sug){
  return new Promise((res)=>{
    const bg=document.createElement("div");
    bg.style.cssText="position:fixed;inset:0;background:rgba(10,14,40,.45);z-index:9000;display:flex;align-items:center;justify-content:center;";
    const face=(document.querySelector(".fab-charb")||{}).src||"";
    bg.innerHTML=`<div style="background:#fff;border-radius:12px;width:440px;max-width:92vw;padding:20px 22px;font-family:var(--f);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="width:38px;height:38px;border-radius:10px;background:#EAF7F7;display:flex;align-items:center;justify-content:center;">${face?`<img src="${face}" style="width:22px;height:25px;object-fit:contain;">`:""}</span>
        <div><b style="color:var(--navy);font-size:15px;">Char-B</b><div style="font-size:13px;color:#5b6178;">¿Cómo llamamos a este trabajo? Será también su dirección.</div></div>
      </div>
      <input id="pnt-inp" type="text" style="width:100%;border:1px solid #e4e8f0;border-radius:9px;padding:11px 12px;font-family:var(--f);font-size:14px;" value="${escAttr(sug)}">
      <div style="display:flex;justify-content:flex-end;gap:9px;margin-top:14px;">
        <button id="pnt-can" style="border:1px solid #e4e8f0;background:#fff;color:#3a4066;border-radius:9px;padding:9px 16px;font-family:var(--f);font-size:14px;font-weight:600;cursor:pointer;">Cancelar</button>
        <button id="pnt-ok" style="border:none;background:var(--navy);color:#fff;border-radius:9px;padding:9px 18px;font-family:var(--f);font-size:14px;font-weight:600;cursor:pointer;">Crear</button>
      </div></div>`;
    document.body.appendChild(bg);
    const inp=bg.querySelector("#pnt-inp"); inp.focus(); inp.select();
    const fin=(v)=>{ bg.remove(); res(v); };
    bg.querySelector("#pnt-ok").onclick=()=>fin(inp.value.trim()||sug);
    bg.querySelector("#pnt-can").onclick=()=>fin(null);
    inp.addEventListener("keydown",e=>{ if(e.key==="Enter") fin(inp.value.trim()||sug); if(e.key==="Escape") fin(null); });
  });
}
function crearTrabajoHome(fmt, ruta){ _rutaActual = ruta; crearDesde(fmt); }
async function crearDesde(formato){
  let pr = proyectoPorId(proyectoVistoId);
  if(!pr){
    // Sin proyecto abierto (p. ej. desde la barra lateral en el dashboard):
    // crea uno automáticamente para no dejar el botón "muerto".
    workspace.proyectos = workspace.proyectos || [];
    pr = { id:uid(), nombre:"Proyecto "+(workspace.proyectos.length+1), creado:Date.now(), piezas:[], activa:null };
    workspace.proyectos.push(pr);
    proyectoVistoId = pr.id;
  }
  proyecto = pr;
  const cat = categoriaDe(formato);
  // NOMBRE propio desde el inicio: define el proyecto y el path (URL) de la pieza.
  const _fecha = new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"short"});
  const _sug = (cat==="Banners"?"Campaña Display ":cat==="Ads"?"Campaña Search ":cat==="Email"?"Email ":cat==="Post"?"Post ":"Pieza ")+_fecha;
  let nom = await pedirNombreTrabajo(_sug);
  if(nom===null) return;              // canceló: no se crea nada
  nom = String(nom).trim() || _sug;
  if(/^Proyecto \d+$/.test(pr.nombre||"")) pr.nombre = nom;
  // Formatos visuales de tamaño fijo → modelo de capas (colección). Documentos → bloques.
  if(cat === "Banners" || cat === "Post" || cat === "Facebook"){
    crearComposicion(cat==="Banners" ? "display-desktop" : cat==="Facebook" ? "facebook" : "social");
    const pz = pieza(); if(pz){ pz.nombre = nom; persistir(); if(typeof renderTabsPiezas==="function") renderTabsPiezas(); }
    setURL(rutaDeProducto(pz)+"/"+slugDe(nom));
    return;
  }
  crearPieza(formato, nom);
  document.getElementById("galeria").classList.remove("show");
  activarPieza(proyecto.activa);
  setURL(rutaDeProducto(pieza())+"/"+slugDe(nom));
}
function nuevaCreatividadPrompt(){
  const pr = proyectoPorId(proyectoVistoId); if(!pr){ toast("Abre un proyecto primero"); return; }
  const opt = prompt("Tipo de creatividad:\n\nemail · banner · post · libre", "email");
  if(opt === null) return;
  const map = { email:"email", banner:"display-300x250", post:"linkedin-post", libre:"libre" };
  crearDesde(map[(opt||"").trim().toLowerCase()] || "email");
}
function irAPlantillas(){
  if(proyecto){ document.getElementById("galeria").classList.remove("show"); activarPieza(proyecto.activa); cambiarPanelTab("plantillas"); }
  else toast("Abre o crea una creatividad primero");
}
function editarBanner(){
  workspace.banner = workspace.banner || {};
  const t = prompt("Título del bloque de creación:", workspace.banner.titulo || "¿Qué vas a crear hoy?");
  if(t === null) return;
  const s = prompt("Texto de apoyo (opcional):", workspace.banner.subtitulo || "");
  workspace.banner.titulo = t || "¿Qué vas a crear hoy?";
  if(s !== null) workspace.banner.subtitulo = s;
  persistir(); renderGaleria();
}
// Crear = generar. El manual no admite lienzo en blanco ("toda pieza nace de una
// generación de la IA"), así que los accesos del Home abren el asistente con su
// plataforma ya marcada en vez de dejar un banner vacío que el usuario tenga que
// llenar control por control — que era justamente lo que hacía el editor
// inentendible: se llegaba a una pieza en cero.
// Crear una pieza. DOS caminos, y la diferencia es del producto, no del capricho:
//
//   · GRÁFICAS (Google Display · Facebook Ads) → LIENZO EN BLANCO. Es el modelo
//     del usuario: diseña el máster a mano con sus herramientas, guarda y pulsa
//     "Replicar". La IA no dibuja el banner. (Esto SUSTITUYE la regla "sin
//     lienzo en blanco" del §01 del manual: el usuario la cambió por escrito.)
//   · GOOGLE SEARCH → asistente. Una campaña de Search son grupos, keywords y
//     anuncios RSA: eso no se dibuja a mano, lo escribe la IA.
//
// Hasta hoy las cuatro tarjetas llamaban al asistente; por eso pulsar "Google
// Display" se iba a Gemini y, cuando Gemini falló, parecía que se había muerto
// el aplicativo entero.
function crearConIA(plat){
  if(plat==="ads"){
    if(!puedePlat("ads")){ toast("Tu usuario no tiene acceso a este servicio"); return; }
    // Search se arma como CAMPAÑA (con versiones, revisión y conversación por partes): pantalla propia.
    irACampanas(); return;
  }
  if(plat==="todas"){ crearCampanaCompleta(); return; }   // funciones/campana-completa/crear.js
  crearBannerEnBlanco(plat);
}
