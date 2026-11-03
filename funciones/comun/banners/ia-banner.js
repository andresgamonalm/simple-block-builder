/* ══════════════════════════════════════════════════════════════════
   BANNERS · LO QUE TRAE LA IA  ·  funciones/comun/banners/ia-banner.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Convierte el copy de la IA en un banner del lienzo libre (composicionLibreDesdeIA, insertarBannerIA) y los límites de caracteres que se le piden.
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. LA IA DIBUJA EN EL LIENZO LIBRE
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Límites de caracteres que se le pasan a la IA. Salen del MÁSTER (es el tamaño
// para el que se escribe la campaña) salvo la palabra más larga, que sale del
// tamaño MÁS ANGOSTO del set: una palabra que no cabe ahí obliga a encoger la
// letra en ese formato. Nada de esto se elige a mano.
// conOferta: si la campaña va a llevar círculo de oferta. IMPORTA MUCHO: el
// círculo le come la mitad del ancho a la columna de texto, así que dar por
// hecho que existe recorta el titular de TODA campaña (medido: 60 → 27
// caracteres en Display, 38 → 12 en Facebook) aunque no haya ninguna oferta.
// Se decide con el gancho del encargo, que es lo que enciende el círculo.
function limitesParaIA(fmtMaster, conOferta){
  const master = fmtMaster || "display-300x250";
  const gm = geomDe(master);
  const bu = conOferta ? { visible:true, texto:"1" } : { visible:false };
  const base = planDeBanner({ zonas:{ texto:{} }, burbuja:bu }, master, 0);
  let palabra = base.maxChars.palabra;
  // La palabra más larga la manda el formato MÁS ANGOSTO del set que se va a
  // generar: en Facebook (1080 px de ancho) medir contra un 160x600 de Display
  // recortaría el copy sin motivo.
  const setDelMaster = (typeof esFacebookFmt==="function" && esFacebookFmt(master)) ? SET_FACEBOOK : SET_DISPLAY_DESKTOP;
  setDelMaster.forEach(f => {
    if(!FORMATOS[f]) return;
    const P = planDeBanner({ zonas:{ texto:{} }, burbuja:bu }, f, 0);
    if(P.maxChars.palabra < palabra) palabra = P.maxChars.palabra;
  });
  return {
    titulo: base.maxChars.titulo,
    cuerpo: base.maxChars.bajada,
    cta: base.maxChars.cta,
    etiqueta: base.maxChars.epigrafe,
    burbuja: GEOM.topeChars.cifra + 10,
    legal: gm.maxChars.legal,
    palabra: Math.max(6, palabra)
  };
}
// Banner: la IA devuelve la composición de 3 zonas; creamos la colección Display
// (máster 300x250 + todos los tamaños) con ese contenido.
// Quita del titular la oferta que ya vive en la burbuja (evita "2 Cuotas Gratis"
// repetido). Normaliza acentos/mayúsculas y recorta frases redundantes.
function _quitarOfertaDelTitular(titular, oferta){
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
  const limpiaBordes = s => s.replace(/^[\s.,;:¡!¿?·|"'-]+/,"").replace(/[\s.,;:·|"'-]+$/,"").trim();
  const no = norm(oferta);
  if(!no) return titular;
  // 1) Corta el titular en frases (por . ! ? · |) y descarta las que SEAN la oferta.
  const partes = titular.split(/(?<=[.!?])\s+|\s*[·|]\s*/).map(s=>s.trim()).filter(Boolean);
  if(partes.length > 1){
    const limpias = partes.filter(fr => { const nf=norm(fr); return nf && nf!==no && !(nf.length<=no.length+4 && no.includes(nf)); });
    if(limpias.length) return limpiaBordes(limpias.join(" "));
  }
  // 2) Sin puntuación: si la oferta es un PREFIJO/SUFIJO del titular, quítala y
  //    conserva el resto (la propuesta de valor). Trabaja sobre las palabras.
  const palTit = titular.split(/\s+/), palOf = oferta.split(/\s+/);
  const igual = (a,b) => norm(a)===norm(b);
  let ini=0, fin=palTit.length;
  if(palTit.length>palOf.length && palOf.every((w,i)=>igual(w,palTit[i]))) ini=palOf.length;              // prefijo
  else if(palTit.length>palOf.length && palOf.every((w,i)=>igual(w,palTit[palTit.length-palOf.length+i]))) fin=palTit.length-palOf.length;  // sufijo
  const resto = limpiaBordes(palTit.slice(ini,fin).join(" "));
  if(ini>0 || fin<palTit.length) return resto;
  // 3) El titular entero es (casi) la oferta → vacío (la burbuja ya la muestra).
  if(norm(titular)===no) return "";
  return limpiaBordes(titular);
}
// tipoCol: "display-desktop" (los 11 tamaños de Google) o "facebook" (los 3 de
// Meta, con máster propio 1080x1350). Es la MISMA generación de banner: cambia
// la colección de tamaños en la que se deposita.
// ── LA IA DIBUJA EN EL LIENZO LIBRE ─────────────────────────────────────
// Char-B entrega el copy (etiqueta, titular, bajada, botón, oferta y foto) y
// aquí se convierte en ELEMENTOS del modelo del usuario, colocados con SUS
// maquetas: el máster se arma con `bandasDe` + `acomodarEnBanda`, y los demás
// tamaños salen del mismo reparto que usa "Replicar". Así lo generado y lo
// dibujado a mano viven en el mismo modelo: se edita igual y se replica igual.
function composicionLibreDesdeIA(data, M, masterFmt){
  const c = libreDefault({ bg:(M && M.secondary) || "#040764" });
  const z = data.zonas || {};
  const fondoOscuro = M ? esColorOscuro(M.secondary) : true;
  let tinta = fondoOscuro ? "#ffffff" : ((M && M.text) || "#12173d");
  const fuente = (M && (M.fontTitulo || M.fontCuerpo)) || "";
  c.fondo.color = (M && M.secondary) || "#040764";

  // FOTO: la elige la IA de la biblioteca; si no eligió, se pone una (un banner
  // de color plano se ve pobre). Los logotipos nunca sirven de fondo.
  let foto = (data.imagen && /^https?:\/\/|^data:/.test(data.imagen)) ? data.imagen : "";
  if(!foto){
    const cand = (workspace.imagenes||[]).filter(sirveComoFondo);
    if(cand.length){
      let hh=0; const sem=String(data.nombre||z.titular||"x");
      for(let i=0;i<sem.length;i++) hh=(hh*31+sem.charCodeAt(i))>>>0;
      foto = cand[hh % cand.length].url;
    }
  }
  if(foto){
    c.fondo.tipo = "imagen";
    c.fondo.imagen = { url:foto, fit:"cover", foco:"center", zoom:100 };
    c.fondo.filtro = { tipo:"oscurecer", intensidad:48, color:"" };
    // Sobre una foto con velo oscuro el texto va en blanco, aunque la marca
    // tenga el fondo claro: si no, sale tinta oscura sobre foto oscura.
    tinta = "#ffffff";
  }

  const els = [];
  const add = (tipo, extra) => { const e = nuevoElementoLibre(tipo, extra); els.push(e); return e; };
  // Las medidas salen del ancho REAL del máster en unidades base: el de Display
  // es 300 y el de Facebook 1080, así que un "ancho 180" fijo servía en uno y
  // era ridículo en el otro.
  const Wm = (FORMATOS[masterFmt] ? FORMATOS[masterFmt].ancho : 300) / factorK(masterFmt);
  const u = (frac) => Math.round(Wm * frac);

  // LOGO (nunca cae).
  const urlLogo = M ? (logoDeMarca(M, fondoOscuro) || logoDeMarca(M, false)) : "";
  if(urlLogo) add("logo", { url:urlLogo, w:u(0.30), h:Math.round(u(0.30)/3), rol:"logo", prio:1, z:5 });

  // PROMOCIÓN, por orden de importancia: titular · oferta · bajada · epígrafe.
  const oferta = data.burbuja ? String(data.burbuja).slice(0,40).trim() : "";
  let titular = z.titular ? String(z.titular).slice(0,80).trim() : "";
  if(titular && oferta) titular = _quitarOfertaDelTitular(titular, oferta);
  if(titular) add("texto", { texto:titular, tam:Math.round(Wm*0.08), color:tinta, fuente, negrita:true,
                             alinH:"left", alinV:"center", w:u(0.86), h:u(0.22), rol:"promo", prio:1, z:3 });
  if(oferta){
    // La oferta es un cuadro de texto redondo: UN elemento, con su fondo de
    // acento. No hace falta figura + texto encima.
    const acc = (M && M.accent1) || "#FCE865";
    add("texto", { texto:oferta, tam:Math.round(Wm*0.052), color: esColorOscuro(acc) ? "#ffffff" : "#040764",
                   fondo:acc, radio:u(0.2), negrita:true, alinH:"center", alinV:"center",
                   w:u(0.30), h:u(0.30), padT:u(0.02), padR:u(0.02), padB:u(0.02), padL:u(0.02),
                   rol:"promo", prio:2, z:4 });
  }
  if(z.cuerpo) add("texto", { texto:String(z.cuerpo).slice(0,160), tam:Math.round(Wm*0.044), color:tinta, fuente,
                              alinH:"left", alinV:"top", w:u(0.86), h:u(0.14), rol:"promo", prio:3, z:3 });
  if(z.etiqueta) add("texto", { texto:String(z.etiqueta).slice(0,30), tam:Math.round(Wm*0.034), color:tinta, fuente,
                                alinH:"left", alinV:"center", w:u(0.40), h:u(0.07), rol:"promo", prio:4, z:3 });

  // BOTÓN (nunca cae): un solo elemento con fondo, enlace y los colores de marca.
  const txtCta = z.cta ? String(z.cta).slice(0,40) : "Saber más";
  add("boton", { texto:txtCta, fuente, link:String(data.ctaUrl||"").trim(),
                 fondo:(M && M.cta) || "#1c73cb", color:(M && M.ctaText) || "#ffffff",
                 tam:Math.round(Wm*0.047), w:u(0.42), h:u(0.115),
                 padT:u(0.015), padR:u(0.03), padB:u(0.015), padL:u(0.03), rol:"cta", prio:1, z:4 });

  // LEGAL: la frase del formulario. Con «no» declarado no se cae al descargo
  // de la marca — decidir que no lleva es una decisión, no un olvido.
  const legal = String(data.legal || (data.legalDeclarado ? "" : (M && M.disclaimer) || "")).trim();
  if(legal) add("texto", { texto:legal.slice(0,140), tam:Math.max(8, Math.round(Wm*0.028)), color:tinta, fuente,
                           alinH:"center", alinV:"center", w:u(0.90), h:u(0.05),
                           rol:"legal", esLegal:true, prio:1, z:2 });

  c.elementos = els;
  // El MÁSTER se coloca con las maquetas del usuario. Los demás tamaños los
  // reparte `acomodarPieza` igual que al pulsar Replicar.
  const base = acomodarPieza({ composicion:c }, masterFmt) || {};
  els.forEach(e => {
    const q = base[e.id]; if(!q || q.oculto) return;
    Object.assign(e, { w:q.w, h:q.h, ancla:q.ancla, dx:q.dx, dy:q.dy });
    if(q.tam != null) e.tam = q.tam;
  });
  return c;
}

function insertarBannerIA(data, marca, tipoCol){
  asegurarProyectoIA();
  const M = marca ? normalizarMarca(marca) : null;
  const tema = M ? { font:M.fontCuerpo||"Inter", fontTitulo:M.fontTitulo||"Inter", primary:M.primary, text:M.text, bg:M.bg, bgPagina:M.bgPagina||"", ancho:"" }
                 : { font:"Inter", primary:"#1c73cb", text:"#1a1a1a", bg:"#ffffff", bgPagina:"", ancho:"", radio:"", gap:"0" };
  // Base desde la marca, luego sobreescribimos con lo que dio la IA.
  const comp = composicionDefault(tema);
  const z = (data.zonas)||{};
  const fondoOscuro = M ? esColorOscuro(M.secondary) : true;
  if(M){
    setPath(comp,"fondo.color", M.secondary);
    // Fuente de la marca en las zonas (evita heredar la Roboto de la app).
    const fontMarca = M.fontTitulo || M.fontCuerpo || "";
    if(fontMarca){ setPath(comp,"zonas.texto.fuente", fontMarca); setPath(comp,"zonas.cta.fuente", fontMarca); }
    setPath(comp,"zonas.logo.url", logoDeMarca(M, true) || logoDeMarca(M, false));
    setPath(comp,"zonas.cta.colorFondo", M.cta);
    setPath(comp,"zonas.cta.colorTexto", M.ctaText);
    const tcol = fondoOscuro ? "#ffffff" : M.text;
    setPath(comp,"zonas.texto.titular.color", tcol);
    setPath(comp,"zonas.texto.cuerpo.color", tcol);
  }
  // Diagramación elegida por la IA (estilo de marca). Sin ella, el modelo
  // de 3 zonas de siempre.
  const LAY = { circulo:"z-circulo", corte:"z-corte", bloque:"z-bloque", tipografica:"z-tipo" };
  if(LAYOUTS_MARCA_ACTIVOS && data.layout && LAY[data.layout]) setPath(comp,"layout", LAY[data.layout]);
  // FOTO del banner. La elige la IA de la biblioteca; si no eligió (pasa a
  // menudo), la ponemos nosotros: un banner de color plano se ve pobre y la
  // biblioteca está ahí. Se descartan logos e íconos, que no sirven de fondo.
  let foto = (data.imagen && /^https?:\/\/|^data:/.test(data.imagen)) ? data.imagen : "";
  if(!foto){
    const cand = (workspace.imagenes||[]).filter(im =>
      im && String(im.url||"").trim() &&
      !/logo|icono|icon|favicon/i.test(String(im.nombre||"")+" "+String(im.url||"")));
    if(cand.length){
      // Estable por campaña (mismo brief → misma foto) pero distinta entre campañas.
      let s=0; const sem=String(data.nombre||data.titular||"x");
      for(let i=0;i<sem.length;i++) s=(s*31+sem.charCodeAt(i))>>>0;
      foto = cand[s % cand.length].url;
    }
  }
  if(foto){
    setPath(comp,"fondo.tipo","imagen"); setPath(comp,"fondo.imagen.url", foto);
    setPath(comp,"fondo.imagen.oscurecer", 48);
  }
  // OFERTA en la burbuja (colores desde los acentos de la marca).
  const oferta = data.burbuja ? String(data.burbuja).slice(0,40).trim() : "";
  // VARIEDAD ENTRE CAMPAÑAS: cada campaña toma una RECETA de diagramación
  // (estable por nombre) — alineación, burbuja, deco, velo y proporciones —
  // para que 12 campañas no salgan con la misma gráfica clonada.
  let _h=0; const _seed=String(data.nombre||data.titular||oferta||"x");
  for(let i=0;i<_seed.length;i++) _h=(_h*31+_seed.charCodeAt(i))>>>0;
  const RECETAS=[
    {alinH:"left",   pos:"tr", deco:false, velo:40, prop:[25,50,25]},
    {alinH:"center", pos:"tl", deco:true,  velo:52, prop:[22,53,25]},
    {alinH:"left",   pos:"br", deco:true,  velo:30, prop:[25,48,27]},
    {alinH:"center", pos:"tr", deco:false, velo:58, prop:[20,55,25]}
  ];
  // hash + rotación por nº de piezas: dos campañas seguidas nunca repiten receta.
  const _rot=(typeof todasLasPiezas==='function'? todasLasPiezas().length : 0);
  const R=RECETAS[_rot%RECETAS.length];   // rotación pura: campañas consecutivas SIEMPRE distintas
  setPath(comp,"zonas.texto.alinH", R.alinH);
  setPath(comp,"zonas.cta.alinH", R.alinH);
  setPath(comp,"fondo.imagen.oscurecer", R.velo);
  setPath(comp,"prop", R.prop.slice());
  if(R.deco) setPath(comp,"deco.visible", true);
  if(oferta) setPath(comp,"burbuja.pos", R.pos);
  if(oferta){
    setPath(comp,"burbuja.visible", true);
    setPath(comp,"burbuja.texto", oferta);
    if(M && M.accent1){
      setPath(comp,"burbuja.color", M.accent1);
      setPath(comp,"burbuja.colorTexto", esColorOscuro(M.accent1) ? "#ffffff" : (esColorOscuro(M.secondary) ? M.secondary : "#040764"));
    }
  }
  // El titular NO debe repetir la oferta que ya está en la burbuja. Si la IA la
  // repitió, la quitamos y dejamos solo la propuesta de valor.
  let titular = z.titular ? String(z.titular).slice(0,80).trim() : "";
  if(titular && oferta) titular = _quitarOfertaDelTitular(titular, oferta);
  if(titular) setPath(comp,"zonas.texto.titular.texto", titular);
  if(z.cuerpo) setPath(comp,"zonas.texto.cuerpo.texto", String(z.cuerpo).slice(0,160));
  if(z.cta) setPath(comp,"zonas.cta.texto", String(z.cta).slice(0,40));
  // Etiqueta de producto sobre el titular (píldora chica, ej. "Seguro Auto").
  if(z.etiqueta) setPath(comp,"zonas.texto.etiqueta.texto", String(z.etiqueta).slice(0,30));
  if(M && M.accent1 && getPath(comp,"deco.color1")==null) setPath(comp,"deco.color1", M.accent1);
  if(M && M.accent2 && getPath(comp,"deco.color2")==null) setPath(comp,"deco.color2", M.accent2);
  // LEGAL: el manual lo pide en cada banner y tiene su banda inferior reservada.
  // Lo escribe la IA si el encargo trae condiciones; si no, el descargo de la marca.
  // La frase legal viene del formulario (obligatoria). Si el usuario escribió
  // «no», `legal` llega vacío y `legalDeclarado` en true: NO se cae al descargo
  // de la marca, porque decidir que no lleva es una decisión, no un olvido.
  const legal = String(data.legal || (data.legalDeclarado ? "" : (M && M.disclaimer) || "")).trim();
  if(legal) setPath(comp,"legal", legal.slice(0,140));
  const tipoSet = (tipoCol==="facebook") ? "facebook" : "display-desktop";
  const cfg = COLECCIONES[tipoSet] || COLECCIONES["display-desktop"];
  const p = crearPieza(cfg.master, data.nombre || (tipoSet==="facebook" ? "Facebook Ads IA" : "Banners IA"));
  p.tema = tema;
  p.esSet=true; p.setTipo=tipoSet; p.masterFmt=cfg.master; p.activaFmt=cfg.master; p.formato=cfg.master;
  // LO QUE GENERA LA IA SE EDITA COMO LO QUE DIBUJAS TÚ. Antes salía en el
  // modelo de 3 zonas y el editor del banner era otro: no se podía arrastrar
  // nada, ni añadir un cuadro de texto sobre lo generado. Ahora cae en el
  // LIENZO LIBRE, con las maquetas del usuario como diagramación de partida.
  let compLibre;
  try { compLibre = composicionLibreDesdeIA(data, M, cfg.master); }
  catch(err){ console.warn("lienzo libre desde IA:", err); compLibre = comp; }
  p.canvas=[]; p.composicion=compLibre; p.artboards=cfg.fmts.map(fmt=>({fmt}));
  // Los demás tamaños se reparten igual que al pulsar "Replicar".
  p.artboards.forEach(ab=>{ if(ab.fmt!==cfg.master) ab.pos = acomodarPieza(p, ab.fmt) || {}; });
  // VARIANTES por formato (como las campañas display reales: la burbuja no va
  // igual en todos): fuera en franjas bajas y cuadrados chicos (se come el
  // banner), centro-derecha en verticales, abajo-derecha en el 1200x1200.
  proyecto.activa = p.id;
  document.getElementById("galeria").classList.remove("show");
  activarPieza(p.id);
  cambiarPanelTab("diseno");
  persistir();
}
