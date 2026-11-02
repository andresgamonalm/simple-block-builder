/* ══════════════════════════════════════════════════════════════════
   DOCUMENTOS · EMAIL  ·  funciones/documentos/email.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Editor de email de 3 zonas, asunto y preencabezado, salud del correo, historial y enviar prueba.
   QUIÉN LO USA: Piezas de email guardadas.
   SECCIONES (en orden):
     1. Enviar prueba por correo (vía Resend)
     2. EDITOR DE EMAIL "3 ZONAS" (mockup aprobado 23-jul)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Enviar prueba por correo (vía Resend) ──
function abrirEnvioPrueba(){
  const p = pieza();
  if(!p || !p.canvas.length){ toast("La pieza está vacía"); return; }
  const a = document.getElementById("prueba-alert"); a.className = "prueba-alert";
  document.getElementById("prueba-emails").value = (window.SBB_USER && window.SBB_USER.email) || "";
  document.getElementById("modal-prueba").classList.add("show");
}
async function enviarPrueba(){
  const p = pieza(); if(!p) return;
  const a = document.getElementById("prueba-alert");
  const destinatarios = document.getElementById("prueba-emails").value.split(",").map(s => s.trim()).filter(Boolean);
  if(!destinatarios.length){ a.className = "prueba-alert err"; a.textContent = "Escribe al menos un correo."; return; }
  const btn = document.getElementById("prueba-btn"); btn.disabled = true; btn.textContent = "Enviando…";
  a.className = "prueba-alert";
  try{
    const r = await fetch("/api/test-send", {
      method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ destinatarios, asunto:`[Prueba] ${p.nombre}`, html: limpiarMetaComentarios(generarHTMLDePieza(p)) })
    });
    const data = await r.json().catch(() => ({}));
    if(r.ok && data.ok){ a.className = "prueba-alert ok"; a.textContent = "Enviado. Revisa tu bandeja (y spam)."; toast("Prueba enviada"); }
    else { a.className = "prueba-alert err"; a.textContent = data.error || "No se pudo enviar."; }
  }catch(e){ a.className = "prueba-alert err"; a.textContent = "Error de red."; }
  finally{ btn.disabled = false; btn.textContent = "Enviar prueba"; }
}

/* ═══════════════ EDITOR DE EMAIL "3 ZONAS" (mockup aprobado 23-jul) ═══════════════
   Rail (Bloques·Media·Plantillas·Historial) + bloques a la izquierda + lienzo +
   panel DERECHO de propiedades con pestañas Contenido/Estilos/Visualización.
   Solo aplica al formato email (documentos de bloques); el resto de modos no cambia. */
let _email3 = false, _p3tab = "contenido";
function esAdminUI(){ const u = window.SBB_USER; return !u || !u.rol || u.rol === "admin"; }
function esModoEmail3(){ const p = pieza(); return !!(p && p.formato === "email" && !esComposicion(p)); }
function actualizarModoEmail3(){
  const on = esModoEmail3();
  const lay = document.getElementById("layout"); if(!lay) return;
  const paneE = document.getElementById("pane-editar"), paneD = document.getElementById("pane-diseno");
  const cuerpo = document.getElementById("pd-cuerpo");
  if(on && !_email3){
    _email3 = true;
    lay.classList.add("email3");
    cuerpo.appendChild(paneD); cuerpo.appendChild(paneE);
    if(panelTab !== "bloques" && panelTab !== "plantillas" && panelTab !== "historial") panelTab = "bloques";
    cambiarPanelTab(panelTab);
  } else if(!on && _email3){
    _email3 = false;
    lay.classList.remove("email3","sin-izq","sin-der");
    const izq = document.querySelector(".panel-izq");
    const ref = document.getElementById("pane-plantillas");
    izq.insertBefore(paneD, ref); izq.insertBefore(paneE, ref);
    paneD.style.display = "none"; paneE.style.display = "none";
    cambiarPanelTab(panelTab === "historial" ? "bloques" : (panelTab || "bloques"));
  }
  const bar = document.getElementById("asunto-bar"); if(bar) bar.style.display = on ? "block" : "none";
  if(on){ renderAsuntoBar(); actualizarPanelDer(); renderSaludEmail(); }
}
// El panel derecho decide qué muestra: el bloque seleccionado o el Diseño general.
function actualizarPanelDer(){
  if(!_email3) return;
  const paneE = document.getElementById("pane-editar"), paneD = document.getElementById("pane-diseno");
  const hayBloque = !!seleccionado || !!editandoCelda;
  paneD.style.display = hayBloque ? "none" : "";
  paneE.style.display = hayBloque ? "" : "none";
  const item = (seleccionado && !editandoCelda) ? getCanvas().find(x => x.id === seleccionado) : null;
  document.getElementById("pd-que").textContent = hayBloque ? "Estás editando" : "Diseño general";
  document.getElementById("pd-titulo").textContent = item ? (BLOQUES[item.tipo] ? BLOQUES[item.tipo].nombre : "Bloque")
    : (editandoCelda ? "Columna de la grilla" : "Diseño general del correo");
  document.getElementById("pd-volver").style.display = hayBloque ? "" : "none";
  const conTabs = !!item && !(item.datos && item.datos.bloqueado && !esAdminUI());
  document.getElementById("pd-tabs").style.display = conTabs ? "flex" : "none";
}
function pdVolverGeneral(){
  seleccionado = null; editandoCelda = null;
  document.querySelectorAll(".bw").forEach(b => b.classList.remove("selected"));
  renderForm();
}
function setP3(t, sinRepintar){
  _p3tab = t;
  document.querySelectorAll("#pd-tabs button").forEach(b => b.classList.toggle("on", b.dataset.p3t === t));
  document.querySelectorAll("#form .p3sec").forEach(sec => sec.classList.toggle("on", sec.dataset.p3 === t));
}
function visualCamposHTML(item){
  const v = (item.datos && item.datos.verEn) || "";
  const btn = (val, lab, ic) => `<button class="${v === val ? "on" : ""}" onclick="actualizarDato('verEn','${val}')">${svgIcon(ic,{size:"14px"})}<br>${lab}</button>`;
  let h = `<div class="form-group-title">Este bloque se muestra en</div>
  <div class="p3vseg">${btn("","Ambos","monitor")}${btn("desktop","Escritorio","monitor")}${btn("movil","Solo móvil","movilico")}</div>
  <div class="p3hint">"Solo móvil" lo oculta en escritorio, y al revés. Gmail, Apple Mail y la mayoría lo respetan; Outlook de escritorio muestra siempre ambos.</div>`;
  h += renderCampo({key:"compId", label:"Nombre / id del componente (para reconocerlo)", tipo:"text", placeholder:"ej. hero-principal"}, item.datos);
  if(esAdminUI()){
    h += `<div class="form-group-title">Bloqueo de marca (solo admin)</div>
    <button class="p3lockbtn" onclick="toggleBloqueoBloque()">${svgIcon("candado",{size:"13px"})} ${item.datos.bloqueado ? "Desbloquear este bloque" : "Bloquear edición para el equipo"}</button>
    <div class="p3hint">Un bloque bloqueado no se puede editar ni eliminar por usuarios limitados (ideal para header y footer legales).</div>`;
  }
  return h;
}
function toggleBloqueoBloque(){
  const item = bloqueCtx(); if(!item) return;
  item.datos.bloqueado = !item.datos.bloqueado;
  persistir(); renderCanvas(); renderForm();
  toast(item.datos.bloqueado ? "Bloque bloqueado para el equipo" : "Bloque desbloqueado");
}
// Rail izquierdo: pestañas del panel (Media abre la biblioteca real).
function railTab(t){
  document.getElementById("layout").classList.remove("sin-izq");
  if(t === "media"){ abrirImagenes(); return; }
  cambiarPanelTab(t);
}
function colPanel(lado){
  const lay = document.getElementById("layout");
  lay.classList.toggle(lado === "izq" ? "sin-izq" : "sin-der");
}
// Asunto y preencabezado de la pieza (solo email).
function renderAsuntoBar(){
  const p = pieza(); if(!p) return;
  const a = document.getElementById("ab-asunto"), pr = document.getElementById("ab-pre");
  if(a && document.activeElement !== a) a.value = p.asunto || "";
  if(pr && document.activeElement !== pr) pr.value = p.preheader || "";
  _contadorAsunto("ab-c-asunto", (p.asunto||"").length, 60);
  _contadorAsunto("ab-c-pre", (p.preheader||"").length, 90);
}
function _contadorAsunto(id, n, max){
  const el = document.getElementById(id); if(!el) return;
  el.textContent = n + "/" + max;
  el.style.color = n > max ? "var(--magenta,#C7147E)" : "";
  el.style.fontWeight = n > max ? "600" : "";
}
function setAsuntoPieza(k, v){
  const p = pieza(); if(!p) return;
  p[k] = v;
  _contadorAsunto(k === "asunto" ? "ab-c-asunto" : "ab-c-pre", v.length, k === "asunto" ? 60 : 90);
  persistir(); renderSaludEmail();
}
// Salud del correo: verificaciones honestas y automáticas.
function renderSaludEmail(){
  const el = document.getElementById("salud-correo"); if(!el) return;
  const p = pieza();
  if(!_email3 || !p){ el.style.display = "none"; return; }
  const cv = getCanvas() || [];
  const it = (ok, txt) => `<div class="sld"><span class="okc${ok ? "" : " pend"}">${ok ? "✓" : "!"}</span>${txt}</div>`;
  const conFoto = cv.filter(b => b.tipo === "imagen");
  const sinAlt = conFoto.filter(b => !(b.datos.alt||"").trim()).length;
  const ctas = cv.filter(b => b.tipo === "cta").length;
  let peso = 0; try{ peso = Math.round(generarHTMLDePieza(p).length / 1024); }catch(_){}
  el.innerHTML = `<b>Salud del correo</b>`
    + it(true, "Estilos embebidos y fotos con URL absoluta: no se caen al pegarlo en HubSpot u otra plataforma")
    + it(!!(p.asunto||"").trim() && !!(p.preheader||"").trim(), (p.asunto||"").trim() ? ((p.preheader||"").trim() ? "Asunto y preencabezado definidos" : "Falta el preencabezado (arriba del correo)") : "Falta el asunto (arriba del correo)")
    + (conFoto.length ? it(sinAlt === 0, sinAlt === 0 ? "Todas las fotos tienen texto alternativo" : `${sinAlt} foto${sinAlt>1?"s":""} sin texto alternativo (pestaña Contenido)`) : "")
    + (ctas > 1 ? it(false, `Hay ${ctas} botones CTA: en email convierte mejor UNO solo al final`) : "")
    + (peso ? it(peso < 400, `Peso del HTML: ${peso} KB${peso >= 400 ? " · Gmail recorta sobre ~100 KB de HTML, revisa" : " · carga rápida"}`) : "");
  el.style.display = "";
}
// Historial de versiones de la sesión (del deshacer, con hora) + restaurar.
function renderHistorialPanel(){
  const cont = document.getElementById("historial-cont"); if(!cont) return;
  if(!_undo.length){ cont.innerHTML = `<div class="form-empty" style="padding:30px 16px;">Aún no hay cambios registrados en esta sesión.</div>`; return; }
  const fmtH = (ts) => new Date(ts).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
  let h = `<div class="p3hint" style="margin:12px 14px 6px;">Versiones de esta sesión de trabajo (cada cambio queda registrado). Restaurar no borra nada: la versión actual queda en el historial.</div>`;
  for(let i = _undo.length - 1; i >= 0 && i >= _undo.length - 30; i--){
    const actual = i === _undo.length - 1;
    h += `<div class="hist-item${actual ? " act" : ""}">${actual ? "" : `<button class="rest" onclick="restaurarVersion(${i})">Restaurar</button>`}<b>${fmtH(_undoTs[i]||Date.now())} · versión ${i+1}</b><small>${actual ? "Versión actual" : "Clic en Restaurar para volver a este punto"}</small></div>`;
  }
  cont.innerHTML = h;
}
function restaurarVersion(i){
  if(!_undo[i]) return;
  const snap = _undo[i];
  aplicarSnapshot(snap);
  _undo.push(snap); _undoTs.push(Date.now());
  renderHistorialPanel();
  toast("Versión restaurada");
}
// Buscador de la biblioteca de bloques.
function filtrarBiblioteca(q){
  q = String(q||"").toLowerCase().trim();
  const cont = document.getElementById("biblioteca"); if(!cont) return;
  cont.querySelectorAll(".tile").forEach(t => { t.style.display = (!q || t.textContent.toLowerCase().includes(q)) ? "" : "none"; });
  cont.querySelectorAll(".cat-title").forEach(cat => {
    let el = cat.nextElementSibling, alguno = false;
    while(el && !el.classList.contains("cat-title")){ if(el.classList.contains("tile") && el.style.display !== "none") alguno = true; el = el.nextElementSibling; }
    cat.style.display = alguno ? "" : "none";
  });
}
// Variables de personalización de la plataforma de envío (con texto de respaldo).
const MERGE_TAGS = {
  hubspot:  { nombre:"contact.firstname", apellido:"contact.lastname", email:"contact.email" },
  mailchimp:{ nombre:"FNAME", apellido:"LNAME", email:"EMAIL" },
  sfmc:     { nombre:"FirstName", apellido:"LastName", email:"EmailAddress" }
};
function mergeTagUI(){
  return `<div class="mtag-box"><div class="form-group-title" style="margin-top:0;">Variable de personalización</div>
  <div class="form-row"><label>Plataforma que enviará el correo</label><select id="mtag-plat" class="dz-sel"><option value="hubspot">HubSpot</option><option value="mailchimp">Mailchimp</option><option value="sfmc">Salesforce Marketing Cloud</option></select></div>
  <div class="form-row"><label>Variable</label><select id="mtag-var" class="dz-sel"><option value="nombre">Nombre</option><option value="apellido">Apellido</option><option value="email">Email</option></select></div>
  <div class="form-row"><label>Si el contacto no tiene el dato, mostrar</label><input type="text" id="mtag-fb" class="dz-inp" placeholder="ej. Hola"></div>
  <button class="dz-btn-link" onclick="insertarMergeTag()">Insertar al final del contenido</button></div>`;
}
function insertarMergeTag(){
  const item = bloqueCtx(); if(!item) return;
  const plat = (document.getElementById("mtag-plat")||{}).value || "hubspot";
  const v = (document.getElementById("mtag-var")||{}).value || "nombre";
  const fb = ((document.getElementById("mtag-fb")||{}).value || "").trim();
  const campo = MERGE_TAGS[plat][v];
  let tok;
  if(plat === "hubspot")   tok = fb ? `{{ ${campo} || "${fb}" }}` : `{{ ${campo} }}`;
  else if(plat === "mailchimp") tok = fb ? `*|IF:${campo}|**|${campo}|**|ELSE:|*${fb}*|END:IF|*` : `*|${campo}|*`;
  else tok = `%%${campo}%%`;
  item.datos.contenido = ((item.datos.contenido||"") + " " + tok).trim();
  persistir(); renderCanvas(); renderForm();
  toast("Variable insertada: la plataforma de envío la reemplaza por el dato real");
}
