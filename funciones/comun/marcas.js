/* ══════════════════════════════════════════════════════════════════
   MARCAS  ·  funciones/comun/marcas.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Biblioteca de marcas (logo, colores, tipografías, voz) y aplicarMarca() sobre documentos y banners.
   QUIÉN LO USA: Compartido.
   SECCIONES (en orden):
     1. Marcas (kits de marca: logo, colores, tipografía, CTA, footer)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Marcas (kits de marca: logo, colores, tipografía, CTA, footer) ──
function abrirMarcas(){
  // Desde el dashboard es una página; desde el editor, un modal (mismo contenido montado donde toque).
  if(document.getElementById("galeria").classList.contains("show")){ dashVista("marcas"); return; }
  montarMarcasEn("modal");
  renderMarcas(); mostrarBibliotecaMarcas();
  document.getElementById("modal-marcas").classList.add("show");
}
// Alterna entre la BIBLIOTECA (listado) y el FORMULARIO (crear/editar una marca).
function mostrarBibliotecaMarcas(){
  document.getElementById("marca-biblioteca").style.display="";
  document.getElementById("marca-form").style.display="none";
  renderMarcas();
  const b=document.getElementById("modal-marcas").querySelector(".modal-body"); if(b) b.scrollTop=0;
}
function mostrarFormMarca(){
  document.getElementById("marca-biblioteca").style.display="none";
  document.getElementById("marca-form").style.display="";
  const b=document.getElementById("modal-marcas").querySelector(".modal-body"); if(b) b.scrollTop=0;
}
function nuevaMarcaForm(){ resetMarcaForm(); mostrarFormMarca(); }
function cerrarMarcaForm(){ mostrarBibliotecaMarcas(); }
// Normaliza una marca (vieja o nueva) al modelo extendido actual.
function normalizarMarca(m){
  m = m || {};
  return {
    id: m.id,
    nombre: m.nombre || "",
    empresa: m.empresa || "",
    logo: m.logo || m.logoUrl || "",          // principal (data URL o URL vieja)
    logoClaro: m.logoClaro || "",             // para fondos oscuros
    primary: m.primary || "#1c73cb",
    secondary: m.secondary || m.bg || "#040764",
    cta: m.cta || m.primary || "#1c73cb",
    ctaText: m.ctaText || "#ffffff",
    text: m.text || "#1a1a1a",
    bg: m.bg || "#ffffff",
    bgPagina: m.bgPagina || "#f5f5f5",
    accent1: m.accent1 || "",
    accent2: m.accent2 || "",
    fontTitulo: m.fontTitulo || m.font || "Inter",
    fontCuerpo: m.fontCuerpo || m.font || "Inter",
    negocio: m.negocio || "",
    tono: m.tono || "",
    eslogan: m.eslogan || "",
    publico: m.publico || "",
    productos: m.productos || "",
    usar: m.usar || "",
    evitar: m.evitar || "",
    directrices: m.directrices || "",
    headerTagline: m.headerTagline || "",
    direccion: m.direccion || "",
    copyright: m.copyright || "",
    unsubTexto: m.unsubTexto || "",
    disclaimer: m.disclaimer || "",
    web: m.web || "",
    facebook: m.facebook || "",
    instagram: m.instagram || "",
    linkedin: m.linkedin || "",
    youtube: m.youtube || "",
    spotify: m.spotify || "",
    gap: m.gap || "",
    radio: m.radio || "",
    bandaEstilo: (m.bandaEstilo === "blanco") ? "blanco" : "solido"
  };
}
// Redes de la marca como lista [{tipo,url}] para la fila "Síguenos" del footer
// (orden del manual: FB, IG, LinkedIn, YouTube, Spotify). El sitio web NO va aquí.
function redesDeMarca(m){
  m = normalizarMarca(m);
  return [
    {tipo:"facebook", url:m.facebook},
    {tipo:"instagram", url:m.instagram},
    {tipo:"linkedin", url:m.linkedin},
    {tipo:"youtube", url:m.youtube},
    {tipo:"spotify", url:m.spotify}
  ].filter(r=>r.url);
}
// Logo "vigente" según el fondo: claro si el fondo es oscuro y hay logo claro.
function logoDeMarca(m, fondoOscuro){ m=normalizarMarca(m); return (fondoOscuro && m.logoClaro) ? m.logoClaro : (m.logo || m.logoClaro || ""); }
function esColorOscuro(hex){
  if(!hex || hex[0] !== "#") return false;
  let h=hex.slice(1); if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return (0.299*r + 0.587*g + 0.114*b) < 140;   // luminancia
}
// Sube un logo desde archivo: lo reduce (máx 512px) y lo guarda como data URL.
function subirLogoMarca(campo, input){
  const file = input.files && input.files[0]; if(!file) return;
  if(!/^image\//.test(file.type)){ toast("Elige un archivo de imagen"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 512; let { width:w, height:h } = img;
      if(w>max || h>max){ const r=Math.min(max/w, max/h); w=Math.round(w*r); h=Math.round(h*r); }
      const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
      cv.getContext("2d").drawImage(img,0,0,w,h);
      // PNG conserva transparencia (clave para logos); si no, queda PNG igual.
      const data = cv.toDataURL("image/png");
      document.getElementById("marca-"+campo+"-data").value = data;
      pintarLogoPrev(campo, data);
      toast("Logo cargado");
    };
    img.onerror = () => toast("No se pudo leer la imagen");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  input.value = "";   // permite re-subir el mismo archivo
}
function quitarLogoMarca(campo){ document.getElementById("marca-"+campo+"-data").value=""; pintarLogoPrev(campo,""); }
function pintarLogoPrev(campo, data){
  const prev=document.getElementById("marca-"+campo+"-prev"); if(!prev) return;
  prev.innerHTML = data ? `<img src="${escAttr(data)}" alt="">` : `<span>Sin logo</span>`;
}
function renderMarcas(){
  const cont = document.getElementById("marca-list");
  const ms = workspace.marcas || [];
  if(!ms.length){ cont.innerHTML = `<div class="marca-vacia">Aún no tienes marcas en tu biblioteca.<br>Crea la primera con <b>＋ Nueva marca</b> (o usa una plantilla lista).</div>`; return; }
  // "Aplicar" solo tiene sentido con una creatividad abierta (en el editor).
  const enEditor = !document.getElementById("galeria").classList.contains("show") && !!pieza();
  const hint = enEditor ? "" : `<div style="font-size:12px;color:#6b7280;background:#f3f4f8;border:1px solid var(--bdr);border-radius:9px;padding:9px 12px;margin-bottom:12px;line-height:1.45;">Esta es tu <b>biblioteca de marcas</b>: edítalas o crea nuevas. Para <b>aplicar</b> una marca, ábrela dentro de una creatividad (Email, Banner…) y usa <b>«Aplicar marca»</b> en la pestaña Diseño.</div>`;
  cont.innerHTML = hint + ms.map(normalizarMarca).map(m => {
    const dark = esColorOscuro(m.bg);
    const logoCard = dark ? (m.logoClaro||m.logo) : (m.logo||m.logoClaro);
    return `<div class="marca-card">
    ${logoCard ? `<span class="mlogo${dark?' dark':''}"><img src="${escAttr(logoCard)}" alt=""></span>` : `<span class="mlogo"></span>`}
    <div class="minfo"><div class="mn">${esc(m.nombre)}</div>
      <div class="msw"><i style="background:${esc(m.primary)}" title="Principal"></i><i style="background:${esc(m.secondary)}" title="Secundario"></i><i style="background:${esc(m.cta)}" title="CTA"></i>${m.accent1?`<i style="background:${esc(m.accent1)}" title="Acento 1"></i>`:""}${m.accent2?`<i style="background:${esc(m.accent2)}" title="Acento 2"></i>`:""}<i style="background:${esc(m.bg)}" title="Fondo"></i></div></div>
    <div class="macc">
      ${enEditor ? `<button class="primary" onclick="aplicarMarca('${m.id}')">Aplicar</button>` : ""}
      <button onclick="editarMarca('${m.id}')">Editar</button>
      <button onclick="eliminarMarca('${m.id}')" title="Eliminar">${svgIcon("basura",{size:"13px"})}</button>
    </div></div>`;
  }).join("");
}
function resetMarcaForm(){
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.value=v; };
  set("marca-edit-id",""); set("marca-nombre",""); set("marca-empresa","");
  set("marca-logo-data",""); set("marca-logoClaro-data","");
  pintarLogoPrev("logo",""); pintarLogoPrev("logoClaro","");
  set("marca-primary","#1c73cb"); set("marca-secondary","#040764"); set("marca-cta","#1c73cb");
  set("marca-ctaText","#ffffff"); set("marca-text","#1a1a1a"); set("marca-bg","#ffffff"); set("marca-bgpagina","#f5f5f5");
  set("marca-accent1","#d9c6b1"); set("marca-accent2","#a3bdcb");
  set("marca-fontTitulo","Inter"); set("marca-fontCuerpo","Inter");
  set("marca-negocio",""); set("marca-tono",""); set("marca-eslogan","");
  set("marca-publico",""); set("marca-productos",""); set("marca-usar",""); set("marca-evitar",""); set("marca-directrices","");
  set("marca-headerTagline",""); set("marca-direccion",""); set("marca-copyright",""); set("marca-unsubTexto",""); set("marca-disclaimer","");
  set("marca-web",""); set("marca-facebook",""); set("marca-instagram",""); set("marca-linkedin",""); set("marca-youtube",""); set("marca-spotify","");
  set("marca-gap",""); set("marca-radio",""); set("marca-bandaEstilo","solido");
  document.getElementById("marca-form-titulo").textContent="Nueva marca";
}
function editarMarca(id){
  const raw=(workspace.marcas||[]).find(x=>x.id===id); if(!raw) return;
  const m=normalizarMarca(raw);
  const set=(i,v)=>{ const e=document.getElementById(i); if(e) e.value=v; };
  set("marca-edit-id",m.id); set("marca-nombre",m.nombre); set("marca-empresa",m.empresa);
  set("marca-logo-data",m.logo); set("marca-logoClaro-data",m.logoClaro);
  pintarLogoPrev("logo",m.logo); pintarLogoPrev("logoClaro",m.logoClaro);
  set("marca-primary",m.primary); set("marca-secondary",m.secondary); set("marca-cta",m.cta);
  set("marca-ctaText",m.ctaText); set("marca-text",m.text); set("marca-bg",m.bg); set("marca-bgpagina",m.bgPagina);
  set("marca-accent1",m.accent1||"#d9c6b1"); set("marca-accent2",m.accent2||"#a3bdcb");
  set("marca-fontTitulo",m.fontTitulo); set("marca-fontCuerpo",m.fontCuerpo);
  set("marca-negocio",m.negocio); set("marca-tono",m.tono); set("marca-eslogan",m.eslogan);
  set("marca-publico",m.publico); set("marca-productos",m.productos); set("marca-usar",m.usar); set("marca-evitar",m.evitar); set("marca-directrices",m.directrices);
  set("marca-headerTagline",m.headerTagline); set("marca-direccion",m.direccion); set("marca-copyright",m.copyright); set("marca-unsubTexto",m.unsubTexto); set("marca-disclaimer",m.disclaimer);
  set("marca-web",m.web); set("marca-facebook",m.facebook); set("marca-instagram",m.instagram); set("marca-linkedin",m.linkedin); set("marca-youtube",m.youtube); set("marca-spotify",m.spotify);
  set("marca-gap",m.gap); set("marca-radio",m.radio); set("marca-bandaEstilo",m.bandaEstilo||"solido");
  document.getElementById("marca-form-titulo").textContent="Editar marca";
  mostrarFormMarca();
}
function guardarMarca(){
  const g=id=>{ const e=document.getElementById(id); return e?e.value:""; };
  const nombre=g("marca-nombre").trim();
  if(!nombre){ toast("Ponle un nombre a la marca"); return; }
  const datos={ nombre, empresa:g("marca-empresa").trim(),
    logo:g("marca-logo-data"), logoClaro:g("marca-logoClaro-data"),
    primary:g("marca-primary"), secondary:g("marca-secondary"), cta:g("marca-cta"), ctaText:g("marca-ctaText"),
    text:g("marca-text"), bg:g("marca-bg"), bgPagina:g("marca-bgpagina"),
    accent1:g("marca-accent1"), accent2:g("marca-accent2"),
    fontTitulo:g("marca-fontTitulo"), fontCuerpo:g("marca-fontCuerpo"),
    negocio:g("marca-negocio").trim(), tono:g("marca-tono").trim(), eslogan:g("marca-eslogan").trim(),
    publico:g("marca-publico").trim(), productos:g("marca-productos").trim(), usar:g("marca-usar").trim(), evitar:g("marca-evitar").trim(), directrices:g("marca-directrices").trim(),
    headerTagline:g("marca-headerTagline").trim(), direccion:g("marca-direccion").trim(), copyright:g("marca-copyright").trim(), unsubTexto:g("marca-unsubTexto").trim(), disclaimer:g("marca-disclaimer").trim(),
    web:g("marca-web").trim(), facebook:g("marca-facebook").trim(), instagram:g("marca-instagram").trim(), linkedin:g("marca-linkedin").trim(), youtube:g("marca-youtube").trim(), spotify:g("marca-spotify").trim(),
    gap:g("marca-gap").trim(), radio:g("marca-radio").trim(), bandaEstilo:g("marca-bandaEstilo") };
  workspace.marcas = workspace.marcas || [];
  const id=g("marca-edit-id");
  if(id){ const m=workspace.marcas.find(x=>x.id===id); if(m){ Object.keys(m).forEach(k=>{ if(!(k in datos) && k!=="id") delete m[k]; }); Object.assign(m,datos); } }
  else { datos.id="m"+Math.random().toString(36).slice(2,9); workspace.marcas.push(datos); }
  persistir(); resetMarcaForm(); renderMarcaSelector(); mostrarBibliotecaMarcas();
  toast(id ? "Marca actualizada" : `"${nombre}" agregada a tu biblioteca`);
}
// PLANTILLA DE EJEMPLO. Rellena el formulario para partir de algo armado, con
// la paleta de Gamonal. NO trae logotipo: los campos de logo quedan vacíos y los
// sube el usuario (decisión suya: nada de marcas de relleno).
function rellenarMarcaEjemplo(){
  const set=(i,v)=>{ const e=document.getElementById(i); if(e) e.value=v; };
  set("marca-nombre","Matías"); set("marca-empresa","Seguros Matías");
  // Paleta Gamonal: Azul principal #040764 · Azul secundario #1C73CB ·
  // Amarillo #FCE865 (círculo de oferta) · Azul secundario claro #378CE3
  // (adornos) · Gris claro #F5F5F5 de fondo de página.
  set("marca-primary","#1C73CB"); set("marca-secondary","#040764"); set("marca-cta","#1C73CB");
  set("marca-ctaText","#ffffff"); set("marca-text","#040764"); set("marca-bg","#ffffff"); set("marca-bgpagina","#F5F5F5");
  set("marca-accent1","#FCE865"); set("marca-accent2","#378CE3");
  set("marca-fontTitulo","Arial"); set("marca-fontCuerpo","Arial");
  // Sin logotipo: se sube desde "El de la marca" o la biblioteca.
  set("marca-logo-data",""); set("marca-logoClaro-data","");
  set("marca-negocio","Aseguradora con productos digitales de contratación online.");
  set("marca-tono","Cercano, confiable y claro; transmite respaldo y tranquilidad sin tecnicismos.");
  set("marca-eslogan","Tu mejor compañía para el futuro");
  set("marca-directrices","DIAGRAMACION: fondo de banner plano, sin degradados ni sombras; logo arriba a la izquierda; etiqueta chica con el tipo de producto sobre el nombre; LA OFERTA en un circulo de color con el numero grande; adornos anclados a los bordes (nunca flotando, nunca dos del mismo color juntas, siempre 3+ formas de escalas distintas); CTA sobrio; legal en letra chica. FOTOGRAFIA: natural estilo carrete de telefono, personas reales en un momento de compromiso, luz natural, nunca poses de banco de imagenes ni grupos posados, nada de filtros ni destellos. COPY: titulares con beneficio concreto y la oferta exacta; una idea por frase; nunca hablar de la campana misma ni rellenar con frases genericas tipo rapido-facil-online; el precio o la oferta real siempre visible cuando exista.");
  set("marca-publico","Personas y familias que contratan seguros online.");
  set("marca-productos","Seguro Celular Protegido, Seguro Auto Digital, Seguro Maneja tus km, Seguro Protección Urgencias, Seguro SOAP");
  set("marca-usar","respaldo, tranquilidad, cobertura, protección, confianza, 100% online, contrata online");
  set("marca-evitar","barato, gratis, regalo");
  set("marca-headerTagline","Seguros que te respaldan");
  set("marca-direccion","");
  set("marca-copyright","© "+new Date().getFullYear()+" Seguros Matías");
  set("marca-unsubTexto","Darme de baja");
  set("marca-disclaimer","Infórmate sobre las condiciones y coberturas en el sitio. Producto sujeto a evaluación y condiciones de la póliza.");
  set("marca-web",""); set("marca-facebook",""); set("marca-instagram","");
  set("marca-linkedin",""); set("marca-youtube",""); set("marca-spotify","");
  set("marca-gap","16"); set("marca-radio","0");
  document.getElementById("marca-form-titulo").textContent="Nueva marca · ejemplo (colores y textos cargados, sin logotipo)";
  const body=document.getElementById("modal-marcas").querySelector(".modal-body"); if(body) body.scrollTop=99999;
  toast("Plantilla de ejemplo cargada — sube el logotipo para completarla");
}
const svgURL = s => "data:image/svg+xml,"+encodeURIComponent(s);
function eliminarMarca(id){
  if(!confirm("¿Eliminar esta marca?")) return;
  workspace.marcas=(workspace.marcas||[]).filter(x=>x.id!==id);
  persistir(); renderMarcas(); renderMarcaSelector();
}
function aplicarMarca(id){
  const raw=(workspace.marcas||[]).find(x=>x.id===id); if(!raw) return;
  const m=normalizarMarca(raw);
  const p=pieza(); if(!p) return;
  p.tema.font=m.fontCuerpo||p.tema.font; p.tema.fontTitulo=m.fontTitulo||m.fontCuerpo||p.tema.font;
  p.tema.primary=m.primary||p.tema.primary;
  p.tema.text=m.text||p.tema.text; p.tema.bg=m.bg||p.tema.bg; p.tema.bgPagina=m.bgPagina||"";
  if(m.gap!=="" && m.gap!=null) p.tema.gap=String(m.gap);
  if(m.radio!=="" && m.radio!=null) p.tema.radio=String(m.radio);
  p.tema.marcaId=m.id;
  if(esComposicion(p)){
    // Banner por zonas: aplica la identidad al diseño global.
    const C=p.composicion;
    setPath(C,"fondo.color", m.secondary);
    // Fuente de la marca en las zonas de texto y CTA — si no,
    // el banner heredaría la Roboto de la app y el titular se vería estirado.
    const fontMarca = m.fontTitulo || m.fontCuerpo || "";
    if(fontMarca){ setPath(C,"zonas.texto.fuente", fontMarca); setPath(C,"zonas.cta.fuente", fontMarca); }
    const fondoOsc = (C.fondo && C.fondo.tipo==="imagen") ? true : esColorOscuro(m.secondary);
    // Si el fondo es una foto, asegura un velo mínimo para que el texto se lea.
    if(C.fondo && C.fondo.tipo==="imagen" && C.fondo.imagen && (parseInt(C.fondo.imagen.oscurecer)||0) < 30){
      setPath(C,"fondo.imagen.oscurecer","40");
    }
    const logoMarca = logoDeMarca(m, fondoOsc);
    if(logoMarca){ setPath(C,"zonas.logo.url", logoMarca); setPath(C,"zonas.logo.visible", true); }
    setPath(C,"zonas.cta.colorFondo", m.cta);
    setPath(C,"zonas.cta.colorTexto", m.ctaText);
    const txtColor = fondoOsc ? "#ffffff" : m.text;
    setPath(C,"zonas.texto.titular.color", txtColor);
    setPath(C,"zonas.texto.cuerpo.color", txtColor);
    if(m.eslogan && !getPath(C,"zonas.texto.titular.texto")) setPath(C,"zonas.texto.titular.texto", m.eslogan);
    // Acentos de la marca → colores por defecto de la burbuja de oferta y las
    // burbujas decorativas (no se encienden solas; solo quedan listas).
    if(m.accent1){
      if(getPath(C,"burbuja.color")==null) setPath(C,"burbuja.color", m.accent1);
      if(getPath(C,"burbuja.colorTexto")==null) setPath(C,"burbuja.colorTexto", esColorOscuro(m.accent1) ? "#ffffff" : (esColorOscuro(m.secondary) ? m.secondary : "#040764"));
      if(getPath(C,"deco.color1")==null) setPath(C,"deco.color1", m.accent1);
    }
    if(m.accent2 && getPath(C,"deco.color2")==null) setPath(C,"deco.color2", m.accent2);
    renderTablero(); renderComposicionEditor();
  } else {
    const bandBg = m.primary || m.secondary || "#1C73CB";
    const lClaro = m.logoClaro || m.logo || "";
    const lColor = m.logo || m.logoClaro || "";
    const redesM = redesDeMarca(m);
    let tieneHeader=false, tieneFooter=false;
    (p.canvas||[]).forEach(b=>{
      if(b.tipo==="cta" && m.cta){ b.datos.colorFondo=m.cta; if(m.ctaText) b.datos.colorTexto=m.ctaText; }
      if(b.tipo==="header"){ tieneHeader=true; if(m.logo) b.datos.logoUrl=m.logo; if(m.headerTagline && !b.datos.bajada) b.datos.bajada=m.headerTagline; }
      if(b.tipo==="footer"){ tieneFooter=true; if(m.empresa) b.datos.empresa=m.empresa; if(m.direccion) b.datos.direccion=m.direccion; if(m.copyright) b.datos.copyright=m.copyright; if(m.unsubTexto){ b.datos.mostrarUnsub=true; b.datos.unsubTexto=m.unsubTexto; } }
      if(b.tipo==="bandaHeader"||b.tipo==="bandaHeaderBlanco"){ tieneHeader=true; b.datos.bg=bandBg; b.datos.logoClaro=lClaro; b.datos.logoColor=lColor; }
      if(b.tipo==="bandaFooter"||b.tipo==="bandaFooterBlanco"){ tieneFooter=true; b.datos.bg=bandBg; b.datos.logoClaro=lClaro; b.datos.logoColor=lColor; if(m.web) b.datos.web=m.web; if(redesM.length) b.datos.redes=redesM; if(m.copyright) b.datos.copyright=m.copyright; if(m.disclaimer) b.datos.disclaimer=m.disclaimer; if(m.unsubTexto){ b.datos.mostrarUnsub=true; b.datos.unsubTexto=m.unsubTexto; } }
    });
    // En email/documento: si no hay header/footer, creamos el header y footer de MARCA (banda con logo + redes).
    const esDoc = ["email","invitacion","libre"].includes(p.formato);
    const estiloBanda = (m.bandaEstilo === "blanco") ? "blanco" : "solido";   // estilo definido en la marca
    if(esDoc){
      if(!tieneHeader && (lClaro || lColor)){
        p.canvas = p.canvas || [];
        p.canvas.unshift(mk("bandaHeader", { estilo:estiloBanda, bg:bandBg, logoClaro:lClaro, logoColor:lColor }));
      }
      if(!tieneFooter && (lClaro || lColor || redesM.length || m.copyright || m.disclaimer)){
        const fd = { estilo:estiloBanda, bg:bandBg, logoClaro:lClaro, logoColor:lColor, web:m.web||"", redes:redesM, copyright:m.copyright||"", direccion:m.direccion||"", disclaimer:m.disclaimer||"" };
        if(m.unsubTexto){ fd.mostrarUnsub=true; fd.unsubTexto=m.unsubTexto; }
        p.canvas = p.canvas || [];
        p.canvas.push(mk("bandaFooter", fd));
      }
    }
    aplicarTema(); renderCanvas(); renderForm();
  }
  persistir();
  cerrarModal("marcas");
  toast("Marca aplicada: "+m.nombre);
}
