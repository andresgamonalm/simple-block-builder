/* ══════════════════════════════════════════════════════════════════
   FORMATOS Y PIEZAS  ·  funciones/comun/formatos.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Registro FORMATOS (todos los tamaños: Display, Facebook, Search, email…), el selector de formato, el tema, crear/activar/borrar piezas y las pestañas de la campaña.
   QUIÉN LO USA: Compartido: cada tamaño de Display y Facebook está declarado aquí.
   SECCIONES (en orden):
     1. Registro único de FORMATOS (fuente de verdad para tamaño/UI/export)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Formatos de tamaño fijo (banners): el Formato manda y el "Ancho canvas"
// del Tema no debe aplicarse, para que no se pisen entre sí.
// ── Registro único de FORMATOS (fuente de verdad para tamaño/UI/export) ──
// alto:0 = formato flexible (sin alto fijo). alto>0 = banner/post de tamaño
// fijo. 'badge' agrupa en los menús. Agregar un formato = añadir una línea.
const FORMATOS = {
  // Formato Universal: ancho a elección (Diseño › Ancho del lienzo), alto siempre libre.
  "libre":           { label:"Estilo Libre",              badge:"Formato Universal", ancho:600, alto:0, txt:"Ancho a tu elección (edítalo en Diseño › Ancho del lienzo). El alto es libre: crece con el contenido." },
  // Email / documento
  "email":           { label:"Email · 600px",            badge:"Email",     ancho:600,  alto:0,    txt:"600px de ancho. Gmail, Outlook, HubSpot." },
  "invitacion":      { label:"Invitación · 920px",        badge:"Email",     ancho:920,  alto:0,    txt:"920px responsive. Invitaciones digitales." },
  // Google Search: la "pieza" es la CAMPAÑA (grupos + keywords + anuncios), no un
  // visual. Ancho grande: la consola de campaña usa el espacio como una plataforma.
  "ads":             { label:"Campaña Google Search",     badge:"Ads",       ancho:1180, alto:0,   txt:"Grupos de anuncios, keywords (exacta/frase) y anuncios RSA. Exporta CSV para Google Ads." },
  // FACEBOOK ADS · solo imagen estática. Tiene su PROPIO MÁSTER (1080×1350): no
  // puede colgar del 300×250 de Display, el factor saldría 3,6 y todo saldría
  // desproporcionado. Tres piezas cubren Feed, Marketplace, columna derecha y
  // Audience Network. Sin Reels, sin Stories, sin carrusel, sin animación.
  "fb-1080x1350":    { label:"Feed vertical · 1080×1350", badge:"Facebook", ancho:1080, alto:1350, txt:"4:5, el que Meta recomienda. Feed de Facebook e Instagram." },
  "fb-1080x1080":    { label:"Cuadrado · 1080×1080",      badge:"Facebook", ancho:1080, alto:1080, txt:"1:1. Feed · Marketplace · columna derecha · Audience Network." },
  "fb-1200x628":     { label:"Horizontal · 1200×628",     badge:"Facebook", ancho:1200, alto:628,  txt:"1.91:1 para feed horizontal y enlaces. La misma pieza sirve para Display." },
  // LinkedIn (tamaños oficiales)
  "linkedin":        { label:"Portada perfil · 1584×396", badge:"LinkedIn",  ancho:1584, alto:396,  txt:"Banner/portada de perfil 1584×396." },
  "linkedin-post":   { label:"Post cuadrado · 1200×1200", badge:"LinkedIn",  ancho:1200, alto:1200, txt:"Post cuadrado del feed 1200×1200." },
  "linkedin-link":   { label:"Enlace/imagen · 1200×627",  badge:"LinkedIn",  ancho:1200, alto:627,  txt:"Imagen de enlace compartido 1200×627 (1.91:1)." },
  // Facebook (tamaños oficiales)
  "fb-post":         { label:"Post / enlace · 1200×630",  badge:"Facebook",  ancho:1200, alto:630,  txt:"Post o enlace del feed 1200×630." },
  "fb-square":       { label:"Cuadrado · 1080×1080",      badge:"Facebook",  ancho:1080, alto:1080, txt:"Post cuadrado 1080×1080." },
  "fb-story":        { label:"Story/Reel · 1080×1920",    badge:"Facebook",  ancho:1080, alto:1920, txt:"Story o Reel vertical 1080×1920." },
  "fb-cover":        { label:"Portada página · 820×312",  badge:"Facebook",  ancho:820,  alto:312,  txt:"Portada de página 820×312." },
  // Google Display (tamaños IAB)
  "display-300x250": { label:"300×250 Medium Rectangle",  badge:"Display",   ancho:300,  alto:250,  txt:"Medium Rectangle 300×250." },
  "display-336x280": { label:"336×280 Large Rectangle",   badge:"Display",   ancho:336,  alto:280,  txt:"Large Rectangle 336×280." },
  "display-728x90":  { label:"728×90 Leaderboard",        badge:"Display",   ancho:728,  alto:90,   txt:"Leaderboard 728×90." },
  "display-970x250": { label:"970×250 Billboard",         badge:"Display",   ancho:970,  alto:250,  txt:"Billboard 970×250." },
  "display-300x600": { label:"300×600 Half Page",         badge:"Display",   ancho:300,  alto:600,  txt:"Half Page 300×600." },
  "display-160x600": { label:"160×600 Wide Skyscraper",   badge:"Display",   ancho:160,  alto:600,  txt:"Wide Skyscraper 160×600." },
  "display-320x50":  { label:"320×50 Mobile Banner",      badge:"Display",   ancho:320,  alto:50,   txt:"Mobile Banner 320×50." },
  "display-320x100": { label:"320×100 Large Mobile",      badge:"Display",   ancho:320,  alto:100,  txt:"Large Mobile Banner 320×100." },
  "display-970x90":  { label:"970×90 Large Leaderboard",  badge:"Display",   ancho:970,  alto:90,   txt:"Large Leaderboard 970×90." },
  "display-468x60":  { label:"468×60 Banner",             badge:"Display",   ancho:468,  alto:60,   txt:"Banner 468×60." },
  "display-250x250": { label:"250×250 Square",            badge:"Display",   ancho:250,  alto:250,  txt:"Square 250×250." },
  "display-200x200": { label:"200×200 Small Square",      badge:"Display",   ancho:200,  alto:200,  txt:"Small Square 200×200." },
  // Tamaños de imagen que pide Performance Max / Demand Gen (recursos de campaña MAX).
  "display-1200x628": { label:"1200×628 MAX Apaisado",    badge:"Display",   ancho:1200, alto:628,  txt:"Imagen apaisada 1.91:1 para Performance Max / Demand Gen." },
  "display-1200x1200":{ label:"1200×1200 MAX Cuadrado",   badge:"Display",   ancho:1200, alto:1200, txt:"Imagen cuadrada para Performance Max / Demand Gen." }
};
function esFormatoFijo(f){ const x = FORMATOS[f]; return !!(x && x.alto > 0); }
// HINTS derivado (compatibilidad con código existente: badge + txt).
const HINTS = Object.fromEntries(Object.entries(FORMATOS).map(([k,v]) => [k, { badge:v.badge, txt:v.txt }]));

// Modo de edición: limita qué formatos se pueden elegir según el punto de
// entrada. "todos" (Formato Libre) habilita todo; el resto solo su categoría
// + Formato Libre. Evita, p.ej., convertir un email en banner por error.
let modoFormato = "todos";
const CATS_PERMITIDAS = {
  email:   ["Email", "Formato Libre"],
  banners: ["Banners", "Formato Libre"],
  post:    ["Post", "Formato Libre"],
  todos:   null   // sin restricción
};
function modoDeCategoria(cat){
  return cat==="Email" ? "email" : (cat==="Banners"||cat==="Facebook") ? "banners" : cat==="Post" ? "post" : "todos";
}
function renderFormatoSelect(){
  // El selector depende de la SECCIÓN: en /email-ia solo se ofrece Email (no se
  // cambia a Display/Social desde ahí). En /free (universal) van todos los documentos
  // + Colecciones. Los formatos visuales fijos (Display/Social) son Colecciones (capas).
  const sec = (typeof rutaDeProducto==="function") ? rutaDeProducto(pieza()) : null;
  const soloEmail = sec === "/email-ia";
  const soloAds = sec === "/ads-ia";
  const DOC = soloAds ? ["ads"] : soloEmail ? ["email"] : ["libre","email","invitacion"];
  const grupos = {};
  DOC.forEach(k => { const v=FORMATOS[k]; if(v){ (grupos[v.badge]=grupos[v.badge]||[]).push([k,v]); } });
  let html = "";
  Object.entries(grupos).forEach(([badge,arr]) => {
    html += `<optgroup label="${esc(badge)}">`;
    arr.forEach(([k,v]) => { html += `<option value="${k}">${esc(v.label)}</option>`; });
    html += `</optgroup>`;
  });
  // Colecciones solo fuera de email-ia y ads (en /free / universal).
  if(!soloEmail && !soloAds) html += `<optgroup label="Colecciones"><option value="__coleccion:display-desktop">Google Display · Desktop</option><option value="__coleccion:social">Social (LinkedIn / Facebook)</option></optgroup>`;
  document.getElementById("fmt").innerHTML = html;
}
function cambiarFormato(f){
  if(f && f.indexOf("__coleccion:") === 0){ convertirEnColeccion(f.slice("__coleccion:".length)); return; }
  const p = pieza(); if(!p) return;
  p.formato = f;
  // Cambiar de formato muestra su tamaño REAL: se sale de la vista de dispositivo.
  dispositivo = "desktop";
  document.querySelectorAll("#dev-seg button").forEach(b => b.classList.toggle("on", b.dataset.dev === "desktop"));
  document.getElementById("canvas-frame").dataset.formato = f;
  aplicarTema();   // reconcilia el ancho inline según el nuevo formato
  renderCanvas();  // banners de alto fijo distribuyen los bloques con flex
  renderTabsPiezas();
  renderPlantillasTab();  // las plantillas del panel concuerdan con el formato actual
  renderBiblioteca();     // la biblioteca oculta bloques que no aplican al formato
  actualizarModoEmail3(); // el editor "3 zonas" solo vive en el formato email
  persistir();
}

function aplicarTema(){
  const t = getTema();
  const f = document.getElementById("canvas-frame");
  f.style.setProperty("--sbb-font", `"${t.font}", "Inter", Arial, sans-serif`);
  f.style.setProperty("--sbb-primary", t.primary);
  f.style.setProperty("--sbb-text", t.text);
  f.style.setProperty("--sbb-bg", t.bg);
  // Tamaño del lienzo desde el registro FORMATOS. Para formatos fijos manda el
  // Formato (ancho×alto). Para flexibles, el ancho del Formato salvo que el
  // usuario fije un "Ancho canvas" propio.
  const fmtKey = getFormato();
  const fmt = FORMATOS[fmtKey] || FORMATOS.email;
  const formatoFijo = fmt.alto > 0;
  // En un set, el tablero gestiona su propio tamaño (no se dimensiona el frame a un solo artboard).
  if(esSetPieza(pieza())){ ajustarFrameParaSet(true); }
  else {
  f.dataset.fijo = formatoFijo ? "1" : "";
  if(formatoFijo){
    f.style.maxWidth = fmt.ancho + "px";
    f.style.height = fmt.alto + "px";
  } else {
    f.style.height = "";
    // Ancho propio del usuario, con piso defensivo: un valor guardado menor a
    // 320px deja el lienzo inusable (se veia "como de 200px") → se ignora.
    if(t.ancho && /^\d+$/.test(t.ancho) && parseInt(t.ancho) >= 320) f.style.maxWidth = t.ancho + "px";
    else f.style.maxWidth = fmt.ancho + "px";
    // Vista de dispositivo: previsualiza el ancho en tablet/móvil (solo flexibles).
    if(dispositivo === "tablet") f.style.maxWidth = "768px";
    else if(dispositivo === "movil") f.style.maxWidth = "390px";
  }
  }
  // El selector de dispositivo solo aplica a formatos flexibles.
  const devSeg = document.getElementById("dev-seg");
  if(devSeg) devSeg.style.opacity = formatoFijo ? ".4" : "1";
  document.getElementById("tema-font").value = t.font;
  document.getElementById("tema-primary").value = t.primary;
  document.getElementById("tema-text").value = t.text;
  document.getElementById("tema-bg").value = t.bg;
  const bgpInput = document.getElementById("tema-bgpagina");
  if(bgpInput) bgpInput.value = t.bgPagina || "";
  const anchoInput = document.getElementById("tema-ancho");
  anchoInput.value = t.ancho || "";
  // Deshabilita el campo cuando el formato fija el tamaño, para que quede claro.
  anchoInput.disabled = formatoFijo;
  anchoInput.placeholder = formatoFijo ? "—" : ("p. ej. " + fmt.ancho + " · editable");
  anchoInput.title = formatoFijo ? "El tamaño lo define el formato del banner" : "Escribe el ancho que quieras en px. En Formato Libre es totalmente libre.";
  // Espaciado entre bloques y radio global
  const gapInput = document.getElementById("tema-gap");
  if(gapInput){ const g=parseInt(t.gap)||0; gapInput.value=g; const lbl=document.getElementById("val-gap"); if(lbl) lbl.textContent=g+" px"; }
  const radioInput = document.getElementById("tema-radio");
  if(radioInput){ const r=(t.radio!=null && /^\d+$/.test(String(t.radio)))?parseInt(t.radio):""; radioInput.value=r===""?0:r; const lbl=document.getElementById("val-radio"); if(lbl) lbl.textContent = r===""?"natural":(r+" px"); }
  // Color CTA propio (vacío = usa el principal) y margen del lienzo (4 lados).
  const ctaInput = document.getElementById("tema-cta");
  if(ctaInput) ctaInput.value = t.ctaColor || t.primary;
  const m = t.margen || {};
  ["t","r","b","l"].forEach(s => { const el = document.getElementById("tema-m"+s); if(el) el.value = (m[s]!=null && parseInt(m[s])>0) ? parseInt(m[s]) : ""; });
  // refresca los hex visibles
  const setHex = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = (v||"").toUpperCase(); };
  setHex("hex-primary", t.primary);
  setHex("hex-text", t.text);
  setHex("hex-bg", t.bg);
  setHex("hex-cta", t.ctaColor || t.primary);
}
function cambiarTema(key, valor){ const p = pieza(); if(!p) return; p.tema[key] = valor; aplicarTema(); renderCanvas(); persistir(); }
// Margen del lienzo (4 lados) — padding alrededor de TODO el contenido de la pieza.
function cambiarMargen(side, valor){ const p = pieza(); if(!p) return; if(!p.tema.margen || typeof p.tema.margen !== "object") p.tema.margen = {t:0,r:0,b:0,l:0}; p.tema.margen[side] = (valor==="" ? 0 : (parseInt(valor)||0)); aplicarTema(); renderCanvas(); persistir(); }
// CSS de padding de la página según el margen del tema (vacío si todo es 0).
function paddingPaginaCSS(t){ const m=(t&&t.margen)||{}; const T=parseInt(m.t)||0,Rr=parseInt(m.r)||0,B=parseInt(m.b)||0,L=parseInt(m.l)||0; return (T||Rr||B||L) ? `padding:${T}px ${Rr}px ${B}px ${L}px;` : ""; }

function crearPieza(formato, nombre){
  // _creado: hora de creación del trabajo. El manual (§05) la pide en el
  // historial, y antes solo existía la del proyecto entero.
  const p = { id:uid(), nombre: nombre || `Pieza ${proyecto.piezas.length+1}`, campana:"General", formato: formato||"email", canvas:[], _creado: Date.now(), tema: { font:"Inter", primary:"#1c73cb", text:"#1a1a1a", bg:"#ffffff", bgPagina:"", ancho:"", radio:"", gap:"0" } };
  proyecto.piezas.push(p);
  proyecto.activa = p.id;
  return p;
}
function activarPieza(id){
  proyecto.activa = id; seleccionado = null;
  const p = pieza(); if(!p) return;
  modoFormato = modoDeCategoria(categoriaDe(p.formato));   // limita formatos según el tipo
  renderFormatoSelect();
  renderMarcaSelector();
  document.getElementById("fmt").value = p.formato;
  cambiarFormato(p.formato);
  aplicarTema(); renderCanvas(); renderForm(); renderTabsPiezas();
  actualizarUISet();
  // Recuerda la última pieza abierta para que RECARGAR la página la reabra (no te bote al home).
  try{ localStorage.setItem("sbb-ultima", JSON.stringify({ pr: proyecto.id, p: id })); }catch(_){}
  persistir();
}
function eliminarPieza(id){
  if(proyecto.piezas.length <= 1){ toast("Debes tener al menos una pieza"); return; }
  if(!confirm("¿Eliminar esta pieza?")) return;
  proyecto.piezas = proyecto.piezas.filter(p => p.id !== id);
  if(proyecto.activa === id) proyecto.activa = proyecto.piezas[0].id;
  activarPieza(proyecto.activa);
}
function nuevaPiezaPrompt(){
  if(!proyecto) return;
  const nombre = prompt("Nombre de la creatividad:", `Creatividad ${proyecto.piezas.length+1}`);
  if(nombre === null) return;
  crearPieza("email", nombre || `Creatividad ${proyecto.piezas.length+1}`);
  activarPieza(proyecto.activa);
}
function renombrarPieza(id, nuevo){ const p = proyecto.piezas.find(x => x.id===id); if(p){ p.nombre = nuevo||"Creatividad"; persistir(); renderTabsPiezas(); } }
function renderTabsPiezas(){
  const span = document.getElementById("crumb-pieza");
  const p = pieza();
  if(span && p) span.textContent = p.nombre;
  const sp = document.getElementById("crumb-proyecto");
  if(sp && proyecto) sp.textContent = proyecto.nombre || "Proyecto";
  const chip = document.getElementById("ed-chip");
  if(chip && p) chip.innerHTML = chipDe(categoriaDe(p.formato));
  renderPestanasPiezas();
}
// Pestanas para moverse entre las piezas del proyecto sin volver al dashboard.
// Una campana generada por Char-B deja email + banners + Search en el MISMO
// proyecto; antes solo se abria la ultima y las otras quedaban invisibles.
function renderPestanasPiezas(){
  const cont = document.getElementById("tb-piezas");
  if(!cont) return;
  const piezas = (proyecto && proyecto.piezas) || [];
  if(piezas.length < 2){ cont.hidden = true; cont.innerHTML = ""; return; }
  const act = proyecto.activa;
  cont.hidden = false;
  const nom = String((proyecto && proyecto.nombre) || "");
  const esCampana = /^campa(ñ|n)a\s*·/i.test(nom);
  const rot = esCampana
    ? `<span class="pz-lbl camp" title="${escAttr(nom)}">Campaña<b>${esc(nom.replace(/^campa(ñ|n)a\s*·\s*/i,""))}</b></span>`
    : `<span class="pz-lbl">En este proyecto</span>`;
  cont.innerHTML = rot + piezas.map(p =>
    `<button class="pz${p.id===act?" on":""}" onclick="irAPieza('${p.id}')" title="${escAttr(p.nombre||"Creatividad")}">`+
    `${chipDe(categoriaDe(p.formato))}<span class="nm">${esc(p.nombre||"Creatividad")}</span></button>`).join("")
    + `<button class="pz pz-mas" onclick="menuNuevaPestana(event)" title="Agregar otra creatividad a este proyecto">+</button>`;
}
// El "+" de las pestanas: agrega SIEMPRE una creatividad nueva al proyecto,
// nunca reemplaza la que tienes abierta (como una pestana de navegador).
function menuNuevaPestana(ev){
  if(ev) ev.stopPropagation();
  document.querySelectorAll(".pz-menu").forEach(m=>m.remove());
  // Las tres plataformas del alcance. Con una sola marcada, la generación cae en
  // ESTE proyecto (no crea otro), así que el "+" agrega una plataforma a la
  // misma campaña — y nace generada, no vacía.
  const tipos = [["banner","display-300x250","Google Display"],["facebook","fb-1080x1350","Facebook Ads"],
                 ["ads","ads","Google Search"]].filter(t=>puedePlat(t[0]));
  const m = document.createElement("div");
  m.className = "pz-menu";
  m.innerHTML = tipos.map(t=>`<button onclick="crearConIA('${t[0]}')">${chipDe(categoriaDe(t[1]))}<span>${t[2]}</span></button>`).join("");
  const b = ev && ev.currentTarget;
  const r = b ? b.getBoundingClientRect() : {left:20,bottom:120};
  m.style.left = Math.round(r.left)+"px"; m.style.top = Math.round(r.bottom+4)+"px";
  document.body.appendChild(m);
  setTimeout(()=>document.addEventListener("click", function cerrar(){ m.remove(); document.removeEventListener("click", cerrar); }, {once:true}), 0);
}
async function nuevaPestana(formato){
  document.querySelectorAll(".pz-menu").forEach(m=>m.remove());
  if(!proyecto) return;
  const cat = categoriaDe(formato);
  const sug = (cat==="Banners"?"Banner ":cat==="Ads"?"Campaña Search ":cat==="Email"?"Email ":"Pieza ")
            + new Date().toLocaleDateString("es-CL",{day:"2-digit",month:"short"});
  const nom = await pedirNombreTrabajo(sug);
  if(nom===null) return;
  // Se crea SIEMPRE una pieza nueva: nunca se reutiliza la que está abierta.
  if(cat==="Banners" || cat==="Post"){
    const cfg = COLECCIONES[cat==="Banners"?"display-desktop":"social"];
    const np = crearPieza(cfg.master, nom);
    np.esSet=true; np.setTipo=cat==="Banners"?"display-desktop":"social"; np.masterFmt=cfg.master;
    np.activaFmt=cfg.master; np.formato=cfg.master; np.canvas=[];
    np.composicion=composicionDefault(np.tema); np.artboards=cfg.fmts.map(f=>({fmt:f}));
    proyecto.activa=np.id; activarPieza(np.id); cambiarPanelTab("diseno");
  } else {
    crearPieza(formato, nom);
    activarPieza(proyecto.activa);
  }
  try{ const r=rutaDeProducto(pieza()); if(r) setURL(r+"/"+slugDe(nom)); }catch(_){}
}
function irAPieza(id){
  if(!proyecto || proyecto.activa === id) return;
  activarPieza(id);
  try{ const r = rutaDeProducto(pieza()); if(r) setURL(r + "/" + slugDe(pieza().nombre)); }catch(_){}
}
function editarNombre(span, id){
  span.contentEditable = "true"; span.focus();
  document.execCommand("selectAll", false, null);
  span.addEventListener("blur", () => { span.contentEditable="false"; renombrarPieza(id, span.textContent.trim()); }, {once:true});
  span.addEventListener("keydown", (e) => { if(e.key==="Enter"){ e.preventDefault(); span.blur(); } }, {once:true});
}
