/* ══════════════════════════════════════════════════════════════════
   ASISTENTE CHAR-B  ·  funciones/comun/asistente-ia.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: La ventana del asistente y generarConIA(): pide a /api/ia y reparte el resultado a cada función (banners, Search, email).
   QUIÉN LO USA: Compartido. La parte que dibuja banners está en banners/ia-banner.js; la de Search en search/consola.js.
   SECCIONES (en orden):
     1. Generar con IA (Gemini)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Generar con IA (Gemini) ─────────────────────────────────────────────
// La IA compone una pieza eligiendo entre estos bloques y rellenando sus campos.
const IA_TIPOS = ["header","hero","texto","imagen","imgtext","cta","divisor","espaciador","features","alert","kpi","ring","rating","product","profileCard","testimonial","article","pricing","fechaCard","evento","social","footer"];
function catalogoBloquesParaIA(){
  const styleKeys = new Set(Object.keys(styleDefaults));
  const recortar = (v) => {
    if(typeof v === "string") return v.length > 60 ? v.slice(0,60) : v;
    if(Array.isArray(v)) return v.slice(0,1);   // un ejemplo de item basta para mostrar la forma
    return v;
  };
  return IA_TIPOS.map(tipo => {
    const def = BLOQUES[tipo]; if(!def) return null;
    const campos = {};
    Object.entries(def.defaults).forEach(([k,v]) => { if(!styleKeys.has(k)) campos[k] = recortar(v); });
    return { tipo, nombre: def.nombre, campos };
  }).filter(Boolean);
}
// Campaña-primero: el asistente ya no elige UN formato sino que marca con checks
// qué PIEZAS genera de un mismo brief — 'email' (bloques), 'banner' (colección
// Display por zonas) y 'ads' (Google Search: grupos + keywords + anuncios RSA).
// Con 2+ piezas se pide antes un CONCEPTO de campaña que guía a todas.
// Las TRES plataformas del alcance (manual §01: "el producto es publicidad
// pagada en las tres plataformas"). El email quedó FUERA DE ALCANCE: ya no se
// ofrece en ninguna superficie de creación. La clave `email` sigue en el objeto
// y la rama del motor sigue viva porque las piezas de email ya guardadas tienen
// que seguir abriéndose, editándose y exportándose — nada se borra.
const IA_PLATAFORMAS = ["banner","facebook","ads"];
// Facebook es del mismo servicio que Display para los permisos: quien puede
// hacer banners puede hacer los dos.
const PERMISO_PLAT = { banner:"banner", facebook:"banner", ads:"ads", email:"email" };
const puedePlat = (p)=> puede(PERMISO_PLAT[p] || p);
let iaPiezas = { banner:true, facebook:false, ads:false, email:false };
// Estilo de generacion: "marca" usa las diagramaciones cerradas del manual;
// "libre" deja el sistema abierto de siempre.
let iaEstilo = "marca";
function iaSetEstilo(e){
  iaEstilo = (e==="libre") ? "libre" : "marca";
  document.querySelectorAll("#ia-estilo-seg button").forEach(b=>b.classList.toggle("on", b.dataset.e===iaEstilo));
}
const iaSeleccionadas = ()=> IA_PLATAFORMAS.filter(k => iaPiezas[k]);
function iaTogglePieza(p){
  if(!(p in iaPiezas)) return;
  if(!iaPiezas[p] && !puedePlat(p)){ toast("Tu usuario no tiene acceso a este servicio"); return; }
  iaPiezas[p] = !iaPiezas[p];
  if(!iaSeleccionadas().length) iaPiezas[p] = true;   // al menos una
  iaPintaPiezas();
}
// Compat: selección única (la usan los deep-links por sección y el Home).
function iaSetFormato(f){
  iaPiezas = { banner:false, facebook:false, ads:false, email:false };
  // "email" ya no se genera: un deep-link antiguo cae en Display, que es el
  // producto equivalente dentro del alcance.
  const k = IA_PLATAFORMAS.includes(f) ? f : "banner";
  iaPiezas[k] = true;
  iaPintaPiezas();
}
function iaPintaPiezas(){
  // Permisos: sin acceso a un servicio, ni se ofrece ni queda marcado.
  IA_PLATAFORMAS.forEach(k => { if(iaPiezas[k] && !puedePlat(k)) iaPiezas[k] = false; });
  if(!iaSeleccionadas().length){ const primero = IA_PLATAFORMAS.find(puedePlat); if(primero) iaPiezas[primero] = true; }
  document.querySelectorAll("#ia-piezas-seg button").forEach(b => { b.style.display = puedePlat(b.dataset.p) ? "" : "none"; b.classList.toggle("on", !!iaPiezas[b.dataset.p]); });
  const tw = document.getElementById("ia-tono-wrap"); if(tw) tw.style.display = "none";   // el email quedó fuera de alcance
  // Search es 100% texto: el campo de fotos solo aplica a las piezas gráficas.
  const fw = document.getElementById("ia-fotos-wrap"); if(fw) fw.style.display = (iaPiezas.banner || iaPiezas.facebook) ? "" : "none";
  const n = iaSeleccionadas().length;
  const h = document.getElementById("ia-piezas-hint");
  if(h) h.innerHTML = n>1 ? `Char-B definirá primero <b>un concepto de campaña</b> y las ${n} plataformas seguirán la misma idea, en su propio proyecto.` : `Con 2 o más plataformas, Char-B define primero <b>un concepto de campaña</b> y todas siguen la misma idea.`;
}
/* Flujo por pasos del Asistente IA (1 Producto · 2 Brief · 3 Resultado). */
// El asistente es UNA SOLA VENTANA: todos los campos a la vista. `iaIrPaso` ya no
// navega entre etapas — solo decide si se está pidiendo el brief o mostrando el
// estado de la generación. Se conserva el nombre porque lo llaman abrirIA(),
// iaGenerar() y los deep-links.
let iaPaso = 1;
function iaIrPaso(n){
  iaPaso = (n === 3) ? 3 : 1;
  const generando = iaPaso === 3;
  const campos = ["ia-paso-1","ia-paso-2"];
  campos.forEach(id => { const p=document.getElementById(id); if(p) p.style.display = generando ? "none" : ""; });
  const est = document.getElementById("ia-paso-3");
  if(est) est.style.display = generando ? "" : "none";
  const gen=document.getElementById("ia-btn"), can=document.getElementById("ia-cancelar"),
        lim=document.getElementById("ia-limpiar");
  if(gen) gen.style.display = generando ? "none" : "";
  if(lim) lim.style.display = generando ? "none" : "";
  if(can) can.textContent = generando ? "Cerrar" : "Cancelar";
}
function iaAtras(){ iaIrPaso(1); }
// Limpiar (a la izquierda del pie, como pide el manual): deja el formulario en
// blanco sin cerrar la ventana. La marca y las piezas marcadas se conservan.
function iaLimpiar(){
  ["ia-que","ia-objetivo","ia-gancho","ia-legal","ia-ctaurl","ia-ref1","ia-ref2","ia-notas"].forEach(id => {
    const e = document.getElementById(id); if(e) e.value = "";
  });
  _iaFotos = []; renderIaFotos();
  const est = document.getElementById("ia-estado"); if(est){ est.textContent=""; est.className="ia-estado"; }
  const q = document.getElementById("ia-que"); if(q) q.focus();
  toast("Formulario limpio");
}
function iaGenerar(){
  const que = (document.getElementById("ia-que").value || "").trim();
  if(!que){
    toast("Cuéntame qué necesitas para la campaña");
    const q = document.getElementById("ia-que");
    if(q){ q.focus(); q.scrollIntoView({behavior:"smooth", block:"center"}); }
    return;
  }
  iaIrPaso(3);
  generarConIA();
}
let _iaFotos = [];   // fotos elegidas de la biblioteca para la IA
function elegirFotosIA(){ abrirImagenes(url => { if(url && !_iaFotos.includes(url)){ _iaFotos.push(url); } renderIaFotos(); }); }
function quitarFotoIA(i){ _iaFotos.splice(i,1); renderIaFotos(); }
function renderIaFotos(){
  const c=document.getElementById("ia-fotos"); if(!c) return;
  c.innerHTML = _iaFotos.length
    ? _iaFotos.map((u,i)=>`<span class="ia-foto"><img src="${escAttr(u)}" alt=""><button type="button" onclick="quitarFotoIA(${i})" title="Quitar">×</button></span>`).join("")
    : `<span style="font-size:12px;color:#8890a8">Ninguna elegida · la IA elegirá sola de tu biblioteca</span>`;
}
function iaSetTono(t){
  const tono = ["comercial","corporativo","informativo","newsletter"].includes(t) ? t : "comercial";
  document.getElementById("ia-tono").value = tono;
  document.querySelectorAll("#ia-tono-seg button").forEach(b => b.classList.toggle("on", b.dataset.tono===tono));
}
// yaElegida = la plataforma ya viene decidida por quien llamó (crearConIA), así
// que no se toca la selección.
function abrirIA(yaElegida){
  // Preselección según dónde estés: dentro de una sección propone SU plataforma;
  // desde el dashboard, la campaña completa.
  const enEditor = !document.getElementById("galeria").classList.contains("show");
  const sec = enEditor && (typeof rutaDeProducto==="function") ? rutaDeProducto(pieza()) : null;
  if(yaElegida === true){ /* la eligió el acceso del Home */ }
  else if(sec==="/ads-ia") iaSetFormato("ads");
  else if(sec==="/fb-ia") iaSetFormato("facebook");
  else if(sec==="/gdn-ia") iaSetFormato("banner");
  else { iaPiezas = { banner:puedePlat("banner"), facebook:puedePlat("facebook"), ads:puedePlat("ads"), email:false }; iaPintaPiezas(); }
  const ms = document.getElementById("ia-marca");
  const marcas = workspace.marcas||[];
  ms.innerHTML = (marcas.length ? "" : `<option value="">— Sin marca (crea una en Marcas) —</option>`) +
    marcas.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join("");
  // Preselecciona la marca ya aplicada a la pieza activa (evita confundir marcas).
  const aplicada = (typeof pieza==="function") && pieza() && pieza().tema && pieza().tema.marcaId;
  if(aplicada && marcas.some(m=>m.id===aplicada)) ms.value = aplicada;
  _iaFotos = []; renderIaFotos();
  const est = document.getElementById("ia-estado"); est.textContent = ""; est.className = "ia-estado";
  iaIrPaso(1);
  document.getElementById("modal-ia").classList.add("show");
  // Foto de Char-B en los avatares del asistente (reusa la de la mascota flotante).
  const _face = document.querySelector(".fab-charb");
  if(_face && _face.src) document.querySelectorAll("#modal-ia .charb-face").forEach(i => i.src = _face.src);
  pintarIconos();
}
async function generarConIA(){
  const que = (document.getElementById("ia-que").value || "").trim();
  if(!que){ toast("Cuéntame qué necesitas"); return; }
  const sel = iaSeleccionadas();
  if(!sel.length){ toast("Marca al menos una plataforma"); return; }
  const accion = (document.getElementById("ia-objetivo").value || "").trim();
  const gancho = (document.getElementById("ia-gancho").value || "").trim();
  const ctaUrl = (document.getElementById("ia-ctaurl").value || "").trim();
  // FRASE LEGAL: siempre se pide. Si la campaña no lleva, se escribe «no» —
  // así queda REGISTRO de que se decidió, en vez de un campo vacío ambiguo.
  const legal = (document.getElementById("ia-legal").value || "").trim();
  if(!legal){
    toast("Escribe la frase legal. Si esta campaña no lleva, escribe «no».", 5000);
    const el = document.getElementById("ia-legal");
    if(el){ el.focus(); el.classList.add("ia-falta"); setTimeout(()=>el.classList.remove("ia-falta"), 2500); }
    return;
  }
  const tipo = (document.getElementById("ia-tono") || {}).value || "comercial";
  let notas = (document.getElementById("ia-notas").value || "").trim();
  // Dos URLs de referencia (opcionales) → solo se leen las que pegues.
  const refs = [document.getElementById("ia-ref1").value, document.getElementById("ia-ref2").value]
    .map(s => (s||"").trim()).filter(s => /^https?:\/\//.test(s)).slice(0,2);
  const marca = (workspace.marcas||[]).find(m => m.id === document.getElementById("ia-marca").value) || null;
  const M = marca ? normalizarMarca(marca) : null;
  const marcaAPI = marcaParaIA(M);
  const btn = document.getElementById("ia-btn"); const est = document.getElementById("ia-estado");
  const esCampana = sel.length > 1;
  // El texto del paso 3 se adapta al producto: una campaña de Search NO es una
  // gráfica (no tiene "identidad visual"), son grupos, keywords y anuncios.
  const hint = document.getElementById("ia-hint");
  if(hint){
    if(esCampana) hint.textContent = "Char-B está armando tu campaña (Display, Facebook y/o Search) con una idea común. Al terminar se abre directo en el editor.";
    else if(sel[0]==="ads") hint.textContent = "Char-B está armando tu campaña de Google Search: grupos por intención, keywords (exacta y frase) y los anuncios. Al terminar se abre directo en el editor.";
    else if(sel[0]==="facebook") hint.textContent = "Char-B está armando tu anuncio de Facebook: la imagen en sus 3 tamaños y los textos del anuncio. Al terminar se abre directo en el editor.";
    else hint.textContent = "Char-B está armando tus banners con la identidad de la marca. Al terminar se abren directo en el editor.";
  }
  btn.disabled = true; est.className = "ia-estado loading";
  est.textContent = esCampana ? `Armando la campaña (${sel.length} piezas) para «${M ? M.nombre : 'sin marca'}»…`
    : sel[0]==="ads" ? `Armando la campaña de Search para «${M ? M.nombre : 'sin marca'}»…`
    : `Generando para «${M ? M.nombre : 'sin marca'}»…`;
  // Biblioteca candidata (solo si hay email/banner). Fotos elegidas a mano mandan;
  // si no, toda la biblioteca + el bucket R2 (sin logos/íconos).
  const fotosElegidas = _iaFotos.length > 0;
  let biblioteca = [];
  if(sel.some(k => k!=="ads")){
    if(fotosElegidas){
      biblioteca = _iaFotos.map(u => { const im=(workspace.imagenes||[]).find(x=>x.url===u); return { url:u, nombre: im?im.nombre:"" }; });
    } else {
      biblioteca = (workspace.imagenes||[]).filter(sirveComoFondo).map(i => ({ url:i.url, nombre:i.nombre }));
      try{
        const rr = await fetch("/api/upload?list=1",{credentials:"include"});
        if(rr.ok){ const dd=await rr.json(); if(dd&&dd.ok&&Array.isArray(dd.objects)){
          const urls=new Set(biblioteca.map(i=>i.url));
          dd.objects.forEach(o=>{ const nombre=String(o.key||"").split("/").pop().replace(/\.[a-z0-9]+$/i,""); const cand={url:o.url,nombre,key:o.key}; if(!urls.has(o.url) && sirveComoFondo(cand)) biblioteca.push(cand); });
        }}
      }catch(e){}
    }
  }
  try{
    // 1) Con 2+ piezas: CONCEPTO de campaña primero (una idea que guía todo),
    //    y la campaña vive en SU propio proyecto (proyecto = campaña).
    if(esCampana){
      est.textContent = "Definiendo el concepto de la campaña…";
      let nombreCampana = "";
      try{
        const rc = await fetch("/api/ia", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ modo:"concepto", brief:{ que, accion, gancho, refs, notas, legal }, marca: marcaAPI }) });
        const dc = await rc.json().catch(()=>null);
        if(dc && dc.ok && dc.concepto){
          nombreCampana = dc.nombre || "";
          notas = (notas ? notas + "\n" : "") +
            `CONCEPTO DE CAMPAÑA (esta pieza es parte de una campaña multicanal: sigue ESTA idea y vocabulario): ` +
            `Idea: ${dc.concepto.idea}. Titular maestro: "${dc.concepto.titular}". Mensajes clave: ${(dc.concepto.mensajes||[]).join(" · ")}.`;
        }
      }catch(_){ /* sin concepto se sigue igual: el brief compartido ya da coherencia */ }
      const pr = { id:uid(), nombre: "Campaña · " + (nombreCampana || que.split(" ").slice(0,5).join(" ")), creado:Date.now(), piezas:[], activa:null };
      workspace.proyectos.push(pr); proyecto = pr; proyectoVistoId = pr.id;
    }
    // 2) Cada pieza marcada, en orden, con el MISMO brief (+ concepto).
    const fallas = [];
    const avisosIA = [];   // lo que el usuario TIENE que saber antes de publicar
    for(const producto of sel){
    // Display y Facebook son la MISMA generación de banner: cambia el máster y
    // la colección de tamaños donde se deposita.
    const esGrafica = (producto==="banner" || producto==="facebook");
    const masterDe = producto==="facebook" ? "fb-1080x1350" : "display-300x250";
    let imagenes = [];
    if(producto !== "ads"){   // una campaña Search es 100% texto: sin fotos
      imagenes = biblioteca.map(i => ({ url:i.url, nombre:i.nombre }));
      // Sin fotos en la biblioteca → genera una fotografía de fondo con IA (Imagen).
      if(esGrafica && imagenes.length===0){
        est.textContent = "No hay fotos en tu biblioteca: generando una con IA…";
        try{
          const rf = await fetch("/api/ia", { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ modo:"imagen", brief:{ que }, marca: M ? { nombre:M.nombre, negocio:M.negocio } : null }) });
          const df = await rf.json().catch(()=>null);
          if(df && df.ok && df.url){
            imagenes.push({ url: df.url, nombre: df.nombre || "Fondo IA" });
            biblioteca.push({ url: df.url, nombre: df.nombre || "Fondo IA" });
            workspace.imagenes = workspace.imagenes || [];
            workspace.imagenes.push({ id:"img"+Math.random().toString(36).slice(2,9), url:df.url, nombre:df.nombre||"Fondo IA", creado:Date.now(), enR2:true });
            persistir();
          }
        }catch(_){}
      }
      if(esGrafica && imagenes.length){
        est.textContent = "Mirando tus imágenes…";
        // Ocho miniaturas, no tres: la IA elegía a ciegas entre 50 fotos porque
        // solo veía las tres primeras de la lista.
        for(const it of imagenes.slice(0,8)){ const th = await miniaturaIA(it.url, 224); if(th) it.thumb = th; }
      } else if(producto==="email" && imagenes.length && !fotosElegidas){
        // En email, descarta imágenes muy pequeñas (lado < 300px → suelen ser íconos).
        est.textContent = "Revisando imágenes…";
        const lista = imagenes.slice(0,20);
        const dims = await Promise.all(lista.map(it => dimsImagen(it.url)));
        imagenes = lista.filter((it,i) => !dims[i] || Math.min(dims[i].w, dims[i].h) >= 300).concat(imagenes.slice(20));
      }
    }
    est.textContent = `Generando ${producto==="facebook"?"el anuncio de Facebook":producto==="banner"?"los banners":producto==="ads"?"la campaña de Search (lee la landing y revisa a la competencia en Google; toma 1 a 2 minutos)":"el email"}…`;
    const r = await fetch("/api/ia", {
      method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        // El servidor conoce tres productos: banner, ads y email. Facebook es un
        // banner con otro máster, así que viaja como banner.
        producto: esGrafica ? "banner" : producto,
        plataforma: producto,
        // Search: si la pieza abierta trae un diagnóstico de la campaña actual,
        // viaja como APORTE (el encargo de este formulario sigue siendo el objetivo).
        brief: Object.assign({ que, accion, gancho, refs, ctaUrl, tipo, notas, legal },
          producto==="ads" ? { aprendizaje: aprendizajeDeAds(pieza() && pieza().formato==="ads" ? pieza().adsData : null) } : {}),
        estilo: iaEstilo,
        formato: producto==="email" ? "email" : producto==="ads" ? "ads" : masterDe,
        marca: marcaAPI,
        imagenes,
        // El ESPACIO de la pieza lo sabe el cliente (tiene la tabla de geometría):
        // se lo pasamos a la IA para que escriba copy que quepa, en vez de tener
        // que quitarle elementos al banner después para que cierre.
        // El círculo solo existe si el gancho trae una cifra: si no, el titular
        // dispone del ancho completo y no hay por qué encogerlo.
        limites: esGrafica ? limitesParaIA(masterDe, tieneCifra(gancho)) : null,
        catalogo: producto==="email" ? catalogoBloquesParaIA() : null
      })
    });
    const raw = await r.text();
    let data = {}; try{ data = JSON.parse(raw); }catch(_){}
    if(!r.ok || !data.ok){
      fallas.push(`${producto}: ${data.error || (raw ? raw.slice(0,200) : "Error " + r.status)}`);
      continue;   // la campaña sigue con las demás piezas
    }
    // Avisos del servidor (URL que no se pudo leer, discrepancia de cifra entre
    // el encargo y la landing, texto que hubo que acortar). No se descartan: una
    // cifra equivocada en una campaña de seguros no es una errata.
    if(Array.isArray(data.avisos)) data.avisos.forEach(a => avisosIA.push(a));
    if(data.acortado) avisosIA.push({ tipo:"acortado",
      texto:"Algún texto no cabía en el espacio del banner y se reescribió más corto. Revisa que siga diciendo lo que querías." });
    if(esGrafica) insertarBannerIA(data, marca, producto==="facebook" ? "facebook" : "display-desktop");
    else if(producto==="ads") insertarAdsIA(data, marca, { que, accion, gancho, refs, ctaUrl, tipo, notas, legal });
    else insertarPiezaIA(data, "email", marca);
    const pz=pieza();
    if(pz && producto==="email" && Array.isArray(pz.canvas)){
      // Foto principal como HERO (titular ENCIMA de la foto) + párrafo debajo.
      // Evita el "foto chica al lado" (escolar) y la "foto sola sin texto".
      const iVis = pz.canvas.findIndex(b => ["imgtext","imagen","hero"].includes(b.tipo));
      if(iVis>=0 && pz.canvas[iVis].tipo!=="hero"){
        const v = pz.canvas[iVis];
        const url = v.tipo==="imgtext" ? v.datos.imagenUrl : v.datos.url;
        if(url){
          let titulo = v.tipo==="imgtext" ? (v.datos.titulo||"") : "";
          let cuerpo = v.tipo==="imgtext" ? (v.datos.texto||"") : "";
          let quitar = 1;
          if(v.tipo==="imagen"){ const nx=pz.canvas[iVis+1]; if(nx && nx.tipo==="texto"){ titulo=nx.datos.titulo||""; cuerpo=nx.datos.contenido||""; quitar=2; } }
          if(!titulo) titulo = (M && M.eslogan) || (data.nombre||"");
          const repl = [ mk("hero", { imagenUrl:url, titulo:titulo, sub:"", ctaTexto:"", oscurecer:"45", alturaHero:"340", radioImg:"0" }) ];
          if(cuerpo) repl.push(mk("texto", { contenido:cuerpo }));
          pz.canvas.splice(iVis, quitar, ...repl);
        }
      }
      // Salvo newsletter: un solo CTA, abajo. Quita el botón del hero y los CTA intermedios.
      if(tipo!=="newsletter"){
        pz.canvas.forEach(b=>{ if(b.tipo==="hero"){ b.datos.ctaTexto=""; } });
        const idx = pz.canvas.map((b,i)=>b.tipo==="cta"?i:-1).filter(i=>i>=0);
        idx.slice(0,-1).reverse().forEach(i=>pz.canvas.splice(i,1));
      }
      // Íconos distintos en atributos/features si la IA repitió o dejó vacío.
      diversificarIconos(pz);
      // Garantiza una FOTO: solo si NO hay ya un bloque visual (hero/imagen/imgtext con url).
      // El servidor ya arma un hero con foto; esto es una red de seguridad por si no llegó.
      const fotoForzar = fotosElegidas ? _iaFotos[0] : (imagenes.find(i=>i&&i.url)||{}).url;
      const tieneFoto = pz.canvas.some(b => ["hero","imagen","imgtext"].includes(b.tipo) && b.datos && (b.datos.imagenUrl||b.datos.url));
      if(fotoForzar && !tieneFoto){
        const idxH = pz.canvas.findIndex(b => b.tipo==="bandaHeader" || b.tipo==="bandaHeaderBlanco" || b.tipo==="header");
        pz.canvas.splice(idxH>=0?idxH+1:0, 0, mk("hero", { imagenUrl:fotoForzar, titulo:(M&&M.eslogan)||(data.nombre||""), sub:"", ctaTexto:"", oscurecer:"45", alturaHero:"340", radioImg:"0" }));
      }
      // La OFERTA (alert) va justo DESPUÉS de la foto principal, no pegada al header.
      const idxImg = pz.canvas.findIndex(b => ["imgtext","hero","imagen"].includes(b.tipo));
      const idxAlert = pz.canvas.findIndex(b => b.tipo==="alert");
      if(idxImg>=0 && idxAlert>=0 && idxAlert < idxImg){
        const al = pz.canvas.splice(idxAlert,1)[0];
        const ni = pz.canvas.findIndex(b => ["imgtext","hero","imagen"].includes(b.tipo));
        pz.canvas.splice(ni+1, 0, al);
      }
    }
    // Enlace del CTA: lo fija el usuario (la IA no lo inventa).
    if(ctaUrl && pz){
      if(esComposicion(pz)){ setComp("zonas.cta.url", ctaUrl); }
      else { (pz.canvas||[]).forEach(b=>{ if(b.tipo==="cta") b.datos.url=ctaUrl; if(b.tipo==="hero"&&b.datos.ctaTexto) b.datos.ctaUrl=ctaUrl; if(b.tipo==="seccion"&&b.datos.botonTexto) b.datos.botonUrl=ctaUrl; }); }
    }
    persistir(); if(esComposicion(pz)) renderTablero(); else renderCanvas();
    }   // fin del for por pieza
    if(fallas.length === sel.length){
      est.textContent = "No se pudo generar: " + fallas.join(" · ");
      est.className = "ia-estado err"; btn.disabled = false; return;
    }
    cerrarModal("ia");
    if(avisosIA.length) mostrarAvisosIA(avisosIA);
    if(fallas.length) toast(`Campaña generada con avisos — falló ${fallas.join(" · ")}`);
    else if(esCampana) toast(`Campaña completa: ${sel.length} piezas con el mismo concepto, en su propio proyecto`);
    else toast(sel[0]==="ads" ? "Campaña de Search lista — revísala y exporta el CSV" : "Pieza generada por Char-B (IA) — edítala a tu gusto");
  }catch(e){ est.textContent = "Sin conexión: " + (e.message||e); est.className = "ia-estado err"; }
  finally{ btn.disabled = false; }
}
// Avisos de la generación, en pantalla y no en un toast que se va: si una URL no
// se pudo leer o el gancho no coincide con la landing, el usuario tiene que
// enterarse ANTES de publicar. Generar en silencio como si todo hubiera salido
// bien es el fallo que este panel existe para evitar.
function mostrarAvisosIA(avisos){
  if(!avisos || !avisos.length) return;
  let cont = document.getElementById("ia-avisos");
  if(!cont){
    cont = document.createElement("div");
    cont.id = "ia-avisos";
    cont.className = "ia-avisos";
    document.body.appendChild(cont);
  }
  const ico = { "url-no-leida":"nube", "discrepancia":"alerta", "acortado":"info" };
  cont.innerHTML = `<div class="iav-caja">
    <div class="iav-tit">${svgIcon("alerta",{size:"14px"})} Revisa antes de publicar
      <button class="iav-x" onclick="document.getElementById('ia-avisos').remove()" title="Cerrar">×</button></div>
    <ul>${avisos.slice(0,5).map(a=>`<li>${svgIcon(ico[a.tipo]||"info",{size:"12px"})} ${esc(a.texto)}</li>`).join("")}</ul>
  </div>`;
}
function asegurarProyectoIA(){
  if(!proyecto){
    const pr = { id:uid(), nombre:"Generado con Char-B (IA)", creado:Date.now(), piezas:[], activa:null };
    workspace.proyectos.push(pr); proyecto = pr; proyectoVistoId = pr.id;
  }
}
// Si la IA puso el mismo ícono (o ninguno) en los atributos, asigna íconos distintos y relevantes.
const ICONOS_FEATURES = ["check","candado","reloj","globo","regalo","corazon","estrella","casa","usuario","trending","tag","carrito","telefono","chat","info","descargar"];
function diversificarIconos(p){
  (p.canvas||[]).forEach(b=>{
    if(!b.datos || !Array.isArray(b.datos.items)) return;
    const items = b.datos.items;
    const icos = items.map(it=>it && it.ico).filter(Boolean);
    const repetidos = icos.length && new Set(icos).size < items.length;  // hay vacíos o repetidos
    if(!repetidos) return;
    let k=0;
    items.forEach(it=>{ if(it) it.ico = ICONOS_FEATURES[k++ % ICONOS_FEATURES.length]; });
  });
}
function insertarPiezaIA(data, formato, marca){
  asegurarProyectoIA();
  const M = marca ? normalizarMarca(marca) : null;
  const tema = M
    ? { font:M.fontCuerpo||"Inter", fontTitulo:M.fontTitulo||"Inter", primary:M.primary, text:M.text, bg:M.bg, bgPagina:M.bgPagina||"", ancho:"", radio:(M.radio||""), gap:(M.gap||"0"), marcaId:M.id }
    : { font:"Inter", primary:"#1c73cb", text:"#1a1a1a", bg:"#ffffff", bgPagina:"", ancho:"", radio:"", gap:"0" };
  let bloques = (data.bloques||[]).filter(b => b && BLOQUES[b.tipo]);
  // Con marca: quitamos el header/footer que haya inventado la IA (su logo suele
  // quedar roto) — la marca pondrá su propio header y footer con el logo real.
  if(M) bloques = bloques.filter(b => !["header","footer","bandaHeader","bandaFooter","bandaHeaderBlanco","bandaFooterBlanco"].includes(b.tipo));
  const sinPunto = s => String(s==null?"":s).replace(/\s*[.。]+\s*$/,"").replace(/\s+$/,"");
  const canvas = bloques.map(b => {
    const d = Object.assign(clone(BLOQUES[b.tipo].defaults), b.datos||{});
    // Los TÍTULOS no llevan punto final (sí el cuerpo).
    if(d.titulo!==undefined) d.titulo = sinPunto(d.titulo);
    if(d.titular!==undefined) d.titular = sinPunto(d.titular);
    return { id:uid(), tipo:b.tipo, datos:d };
  });
  const p = { id:uid(), nombre:(data.nombre||"Generado por Char-B (IA)"), campana:"General", formato, canvas, tema };
  proyecto.piezas.push(p); proyecto.activa = p.id;
  document.getElementById("galeria").classList.remove("show");
  activarPieza(p.id);
  if(M) aplicarMarca(M.id);   // añade header + footer de marca (con el logo real) y aplica identidad
  persistir();
}
