/* ══════════════════════════════════════════════════════════════════
   BANNERS · EDICIÓN  ·  funciones/comun/banners/edicion.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Ajustes por tamaño (overrides), el tablero de tamaños y la edición directa sobre el banner (arrastrar, divisores, logo, textos).
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. Custom por tamaño (overrides sobre el Diseño global)
     2. LIENZO DE EDICIÓN DIRECTA (arrastrar de verdad)
     3. MOTOR ÚNICO DE ARRASTRE
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ── Custom por tamaño (overrides sobre el Diseño global) ──
function ovDeFmt(p, fmt){ const ab=(p.artboards||[]).find(a=>a.fmt===fmt); if(!ab) return {}; ab.ov=ab.ov||{}; return ab.ov; }
// Merge profundo global+override. Un valor "" (string vacío) en el override
// significa "no tocar" → hereda del global. Para quitar algo en un tamaño se
// usa el ojo (visible:false), no vaciar el campo.
function deepMergeOv(base, ov){
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for(const k in (ov||{})){
    const v=ov[k];
    if(v==="" || v===undefined) continue;
    if(Array.isArray(v)){ out[k]=v.slice(); }
    else if(v && typeof v==="object"){ out[k]=deepMergeOv((base&&typeof base[k]==="object")?base[k]:{}, v); }
    else out[k]=v;
  }
  return out;
}
function composicionEfectiva(p, fmt){
  asegurarComposicionNueva(p);
  const g = p.composicion||{}; const ab=(p.artboards||[]).find(a=>a.fmt===fmt); const ov=(ab&&ab.ov)||{};
  const ef = deepMergeOv(g, ov);
  // LIENZO LIBRE: si este tamaño tiene un reacomodo por bandas (lo escribe
  // "Replicar"), sus posiciones mandan sobre las del máster. Es lo que hace que
  // una franja no sea el cuadrado escalado, sino el diseño REPARTIDO según las
  // proporciones de su familia.
  if(esLibre(ef) && ab && ab.pos && Array.isArray(ef.elementos)){
    ef.elementos = ef.elementos
      .map(e => {
        const q = ab.pos[e.id];
        if(!q) return e;
        const n = Object.assign({}, e, { w:q.w, h:q.h, ancla:q.ancla, dx:q.dx, dy:q.dy });
        if(q.tam != null) n.tam = q.tam;
        n._oculto = !!q.oculto;
        return n;
      })
      .filter(e => !e._oculto);   // lo que no cabe legible en este tamaño, cae
  }
  return ef;
}
function ovTieneValor(o){ if(o==null||o==="") return false; if(typeof o==="object"){ return Object.keys(o).some(k=>ovTieneValor(o[k])); } return true; }
function tieneOverride(p, fmt){ const ab=(p.artboards||[]).find(a=>a.fmt===fmt); return !!(ab&&ab.ov&&ovTieneValor(ab.ov)); }
function setCompOv(fmt, path, val){ const p=pieza(); if(!esComposicion(p))return; setPath(ovDeFmt(p,fmt), path, val); persistir(); renderTablero(); refrescarPanelBanner(); }
function toggleCompVisOv(fmt, path){ const p=pieza(); if(!esComposicion(p))return; const ef=composicionEfectiva(p,fmt); const cur=getPath(ef,path); setCompOv(fmt,path,!(cur!==false)); renderComposicionEditor(); }
function resetTamaño(fmt){ const p=pieza(); const ab=(p.artboards||[]).find(a=>a.fmt===fmt); if(ab){ ab.ov={}; delete ab.pos; } persistir(); renderTablero(); renderComposicionEditor(); toast("Tamaño restablecido al diseño de todos"); }
function resetCapaTamaño(fmt, path){ const p=pieza(); const ab=(p.artboards||[]).find(a=>a.fmt===fmt); if(ab&&ab.ov){ delPath(ab.ov, path); } persistir(); renderTablero(); renderComposicionEditor(); }
function familiaDeFormato(fmt){ const f=FORMATOS[fmt]; if(!f) return "cuadrado"; const r=f.ancho/f.alto; return r>=2.2?"franja":(r<=0.6?"vertical":"cuadrado"); }
// Pone el logo de la marca aplicada en la zona Logo de la composición (global o por tamaño).
function usarLogoMarcaEnZona(fmt){
  const p=pieza(); if(!esComposicion(p)) return;
  const mid = p.tema && p.tema.marcaId;
  let m = mid ? (workspace.marcas||[]).find(x=>x.id===mid) : null;
  if(!m && (workspace.marcas||[]).length===1) m = workspace.marcas[0];
  if(!m){ toast("Elige una marca primero (selector «Marca» arriba)"); return; }
  m = normalizarMarca(m);
  const fondoCol = (p.composicion && p.composicion.fondo && p.composicion.fondo.color) || "#040764";
  const url = logoDeMarca(m, esColorOscuro(fondoCol));
  if(!url){ toast("La marca no tiene logo"); return; }
  if(fmt) setCompOv(fmt,'zonas.logo.url',url); else setComp('zonas.logo.url',url);
  renderForm(); renderTablero();
  toast("Logo de la marca aplicado");
}
function renderTableroComposicion(p, c){
  const sizes = (p.artboards && p.artboards.length) ? p.artboards.map(a=>a.fmt) : SET_DISPLAY_DESKTOP;
  const grupos = { cuadrado:[], vertical:[], franja:[] };
  sizes.forEach(fmt => { if(FORMATOS[fmt]) grupos[familiaDeFormato(fmt)].push(fmt); });
  const titulos = { cuadrado:"Cuadrados y rectángulos", vertical:"Verticales", franja:"Franjas (horizontales)" };
  const zoom = 0.7;
  const celda = (fmt) => {
    const f=FORMATOS[fmt]; const master = fmt===(p.masterFmt||"display-300x250");
    const activo = fmt===p.activaFmt; const ajustado = tieneOverride(p, fmt);
    return `<div class="ab${activo?' activo':''}" data-fmt="${fmt}">
      <div class="ab-bar">${esLibre(p.composicion)?`<label class="ab-check" title="Incluir en la vista previa y en la exportación" onclick="event.stopPropagation()"><input type="checkbox" ${bannerMarcado(p,fmt)?"checked":""} onchange="marcarBanner('${fmt}',this.checked)"></label>`:""}<span class="ab-tit">${f.ancho}×${f.alto}${master?' <span class="mtag">máster</span>':''}${ajustado?' <span class="ajtag">· ajustado</span>':''}</span><span class="ab-insp" data-insp="${fmt}"></span><button class="ab-dl" onclick="exportarArtboard('${fmt}');event.stopPropagation();" title="Descargar este banner">${svgIcon("exportar",{size:"12px"})}</button></div>
      <div class="ab-stage" style="width:${Math.round(f.ancho*zoom)}px;height:${Math.round(f.alto*zoom)}px;"><div class="ab-scale" style="transform:scale(${zoom});">${renderComposicion(composicionEfectiva(p, fmt), fmt)}</div></div>
      <div class="ab-aviso" data-aviso="${fmt}"></div>
    </div>`;
  };
  // Píldoras de TAMAÑO arriba del lienzo: tocas una y ese banner aparece para
  // editarlo (pedido del usuario: sin scroll al tablero para cambiar de tamaño).
  const pills = sizes.filter(f=>FORMATOS[f]).map(fmt=>{
    const f=FORMATOS[fmt]; const master=fmt===(p.masterFmt||"display-300x250");
    const activo=fmt===p.activaFmt; const ajustado=tieneOverride(p,fmt);
    return `<button type="button" class="fmt-pill${activo?' on':''}${ajustado?' aj':''}" data-fmt="${fmt}" title="${master?'Máster: editarlo edita el diseño base de todos':''}${ajustado?' · tiene ajustes propios':''}">${f.ancho}×${f.alto}${master?'<span class="fp-m">M</span>':''}</button>`;
  }).join("");
  let html = "";
  if(esLibre(p.composicion)){
    const marcados = bannersMarcados(p).length;
    html += `<div class="lb-barra">
      <button class="lb-guardar" id="lb-guardar" onclick="guardarBanner()">${svgIcon("check",{size:"14px"})} <span class="lb-gtxt">Guardado</span></button>
      <button class="lb-replicar" onclick="replicarBanner()">${svgIcon("plantilla",{size:"14px"})} Replicar a los demás tamaños</button>
      <span class="lb-sep"></span>
      <span class="lb-selinfo"><b id="lb-nsel">${marcados}</b> de ${(p.artboards||[]).length} seleccionados</span>
      <button class="lb-link" onclick="marcarTodosBanners(true)">Todos</button>
      <button class="lb-link" onclick="marcarTodosBanners(false)">Ninguno</button>
    </div><div class="lb-resultado" id="lb-resultado"></div>`;
  }
  html += `<div class="fmt-pills">${pills}</div>`;
  // Lienzo de edición directa del tamaño activo (arrastrar de verdad) + tablero.
  html += renderLienzoEdicion(p);
  html += `<div class="tablero-hint">${svgIcon("info",{size:"13px"})} Arriba editas el tamaño activo arrastrando. Abajo están <b>todos los tamaños</b>: <b>clic en uno</b> lo activa para ajustarlo (lo que no toques hereda de todos).</div>`;
  ["cuadrado","vertical","franja"].forEach(g => {
    if(!grupos[g].length) return;
    html += `<div class="tab-grupo"><div class="tab-grupo-tit">${titulos[g]}</div><div class="tablero grupo-${g}">${grupos[g].map(celda).join("")}</div></div>`;
  });
  c.innerHTML = html;
  const irATamano = (f)=>{ p.activaFmt=f; renderTablero(); renderComposicionEditor(); };
  c.querySelectorAll(".ab").forEach(el=>el.addEventListener("click",()=>irATamano(el.dataset.fmt)));
  c.querySelectorAll(".fmt-pill").forEach(el=>el.addEventListener("click",()=>irATamano(el.dataset.fmt)));
  // El overlay del lienzo se mide DESPUÉS de pintar (necesita tamaños reales).
  requestAnimationFrame(()=>{ try{ attachLienzoInteraccion(p, c); }catch(e){ console.warn("lienzo:",e); } });
  // El INSPECTOR corre sobre el render ya pintado, también sobre las ediciones
  // del usuario. No bloquea: avisa.
  inspeccionarConFreno(p, c);
  iniciarLivePreview();
}
// El inspector mide 11 banners: si se lanza en cada render (y un arrastre son
// muchos renders) se acumulan pasadas que no sirven de nada. Con freno, solo corre
// cuando el tablero se queda quieto.
let _inspTimer = null;
function inspeccionarConFreno(p, cont, ms){
  if(_inspTimer) clearTimeout(_inspTimer);
  _inspTimer = setTimeout(() => {
    _inspTimer = null;
    if(!document.body.contains(cont)) return;   // ya se repinto: la proxima pasada manda
    esperarImagenes(cont).then(()=>{
      try{ inspeccionarTablero(p, cont); }catch(e){ console.warn("inspector:",e); }
    });
  }, ms==null ? 220 : ms);
}
// Medir antes de que carguen las imágenes da falsos positivos: un logo aún sin
// cargar mide 0×0 y el inspector cantaba "falta el logo" y una zona muerta que
// no existía. Se espera la carga (con tope de 1,2 s por si una URL está muerta:
// en ese caso el logo SÍ falta de verdad y hay que decirlo).
function esperarImagenes(cont){
  const imgs = [...cont.querySelectorAll(".cmp img")].filter(i => !i.complete);
  if(!imgs.length) return Promise.resolve();
  return Promise.race([
    Promise.all(imgs.map(i => new Promise(r => {
      i.addEventListener("load", r, {once:true}); i.addEventListener("error", r, {once:true});
    }))),
    new Promise(r => setTimeout(r, 1200))
  ]);
}
// Pasa el inspector por TODOS los tamaños del tablero y deja el aviso al lado de
// cada uno. Guarda el resumen en p._inspeccion para la barra y el export.
function inspeccionarTablero(p, cont){
  const res = {};
  cont.querySelectorAll(".ab").forEach(ab => {
    const fmt = ab.dataset.fmt; const cmp = ab.querySelector(".cmp");
    if(!cmp) return;
    const rep = inspeccionarCmp(cmp);
    res[fmt] = rep;
    const chip = ab.querySelector('[data-insp="'+fmt+'"]');
    if(chip) chip.innerHTML = rep.ok ? "" : `<span class="insp-chip">${rep.fallos.length}</span>`;
    const av = ab.querySelector('[data-aviso="'+fmt+'"]');
    if(av) av.innerHTML = avisoInspectorHTML(rep);
    ab.classList.toggle("ab-falla", !rep.ok);
  });
  p._inspeccion = res;
  pintarResumenInspector(res);
  return res;
}
// Resumen en la barra del editor: cuántos tamaños están sanos. Es la única forma
// de que el usuario sepa, de un vistazo, si la campaña se puede entregar.
function pintarResumenInspector(res){
  const el = document.getElementById("ed-inspector"); if(!el) return;
  const fmts = Object.keys(res||{});
  if(!fmts.length){ el.innerHTML = ""; el.className = "ed-insp"; return; }
  const malos = fmts.filter(f => !res[f].ok);
  if(!malos.length){
    el.className = "ed-insp ok";
    el.innerHTML = `${svgIcon("check",{size:"13px"})}<span class="ei-larga">${fmts.length} tamaños revisados</span><span class="ei-corta">${fmts.length}</span>`;
    el.title = "El inspector midió los banners dibujados: sin desbordes, colisiones, textos ilegibles ni huecos.";
  } else {
    el.className = "ed-insp mal";
    el.innerHTML = `${svgIcon("alerta",{size:"13px"})}<span class="ei-larga">${malos.length} de ${fmts.length} por revisar</span><span class="ei-corta">${malos.length}</span>`;
    el.title = "Tamaños con avisos: " + malos.map(f=>f.replace("display-","")).join(", ");
  }
  el.onclick = () => {
    if(!malos.length){ toast("Los "+fmts.length+" tamaños pasan las 6 comprobaciones"); return; }
    const primero = document.querySelector(".ab-falla");
    if(primero) primero.scrollIntoView({behavior:"smooth", block:"center"});
    toast("Revisa: " + malos.map(f=>f.replace("display-","")).join(" · "));
  };
}
// Mutadores de la composición global (por ruta, ej. "zonas.texto.titular.texto").
function setComp(path, val){ const p=pieza(); if(!esComposicion(p))return; setPath(p.composicion, path, val); persistir(); renderTablero(); refrescarPanelBanner(); }
function toggleCompVis(path){ const p=pieza(); if(!esComposicion(p))return; const cur=getPath(p.composicion,path); setComp(path, !(cur!==false)); renderComposicionEditor(); }
// Numéricos con CLAMP: nunca se guardan dimensiones fuera del rango permitido.
function clampN(v, mn, mx){ v=parseFloat(v); if(isNaN(v)) return mn; return Math.max(mn, Math.min(mx, v)); }
function setCompN(path, val, mn, mx){ setComp(path, String(clampN(val,mn,mx))); }
function setCompOvN(fmt, path, val, mn, mx){ setCompOv(fmt, path, String(clampN(val,mn,mx))); }
// Alterna un booleano (negrita/cursiva) global o por tamaño.
function setCompTog(path){ const p=pieza(); if(!esComposicion(p))return; setComp(path, getPath(p.composicion,path)!==true); }
function setCompOvTog(fmt, path){ const p=pieza(); if(!esComposicion(p))return; const ef=composicionEfectiva(p,fmt); setCompOv(fmt, path, getPath(ef,path)!==true); }
// Escribe según el ALCANCE del tamaño activo: si es el máster (o global) toca el
// Diseño de todos; si es otro tamaño, solo su ajuste. Sin re-render (lo hace quien llama).
function esFmtMaster(fmt){ const p=pieza(); return !fmt || fmt===(p.masterFmt||"display-300x250"); }
function setCompScope(fmt, path, val){ if(esFmtMaster(fmt)){ const p=pieza(); if(!esComposicion(p))return; setPath(p.composicion,path,val); } else { setPath(ovDeFmt(pieza(),fmt),path,val); } }
function propScope(fmt){ const ef=composicionEfectiva(pieza(), fmt); return (ef.prop&&ef.prop.length===3)?ef.prop.map(x=>parseFloat(x)||0):[25,50,25]; }

// ── LIENZO DE EDICIÓN DIRECTA (arrastrar de verdad) ──────────────────────
// Banner grande del tamaño activo con: zonas clicables (editar contenido),
// divisores arrastrables (cambiar el % de cada zona) y burbuja arrastrable
// (imanta a 5 posiciones). Aditivo: los controles del panel siguen intactos.
function renderLienzoEdicion(p){
  const fmt = p.activaFmt || p.masterFmt || "display-300x250";
  const F = FORMATOS[fmt]; if(!F) return "";
  const ef = composicionEfectiva(p, fmt);
  const s = 1;   // display se revisa a TAMAÑO REAL; si no cabe, el visor hace scroll
  const Ws = F.ancho, Hs = F.alto;
  const esMaster = esFmtMaster(fmt);
  const alcance = esMaster ? "editando TODOS los tamaños" : `editando SOLO ${F.ancho}×${F.alto}`;
  return `<div class="lienzo" data-fmt="${fmt}" data-escala="${s}">
    <div class="lienzo-head">
      <div class="lz-tit"><span class="lz-badge">${F.ancho}×${F.alto}</span> ${esMaster?'Máster · '+alcance:alcance}</div>
      <div class="lz-ayuda">${svgIcon("info",{size:"13px"})} ${esLibre(p.composicion)
        ? 'Arrastra cualquier elemento para <b>moverlo</b> · tira de una <b>punta</b> para agrandarlo o achicarlo · <b>clic</b> para seleccionarlo'
        : 'Arrastra los <b>divisores</b> para el espacio de cada zona · arrastra la <b>burbuja</b> para moverla · <b>clic</b> en una zona para editarla'}</div>
    </div>
    <div class="lienzo-vp"><div class="lienzo-stage" style="width:${Ws}px;height:${Hs}px;">
      <div class="lienzo-scale" style="width:${F.ancho}px;height:${F.alto}px;transform:scale(${s});">${renderComposicion(ef, fmt)}</div>
      <div class="lienzo-ovl"></div>
    </div></div>
  </div>`;
}
// Mide las zonas reales y coloca zonas clicables, divisores y la burbuja. Todo
// el arrastre actualiza el DOM en vivo y solo PERSISTE al soltar (estable).
function attachLienzoInteraccion(p, root){
  // Lienzo LIBRE: su propia interacción (mover y redimensionar por las puntas).
  if(esLibre(p.composicion)) return attachLibre(p, root);
  const wrap = root.querySelector(".lienzo"); if(!wrap) return;
  const fmt = wrap.dataset.fmt;
  const stage = wrap.querySelector(".lienzo-stage");
  const ovl = wrap.querySelector(".lienzo-ovl");
  const cmp = wrap.querySelector(".cmp");
  if(!stage || !ovl || !cmp) return;
  ovl.innerHTML = "";   // evita duplicados si se reengancha (varios rAF en cola)
  const fila = (familiaDeFormato(fmt)==="franja");
  // Si el banner CABE, se muestra a tamaño real; si no, se reduce LO JUSTO para
  // verse completo (nunca se agranda). El export siempre va a píxeles reales.
  const Fr = FORMATOS[fmt];
  if(Fr){
    const dispoW = Math.max(280, (wrap.clientWidth || 760) - 8);   // el ancho REAL del lienzo
    const dispoH = Math.max(240, window.innerHeight - 300);
    const s2 = Math.min(dispoW/Fr.ancho, dispoH/Fr.alto, 1);
    const sc = stage.querySelector(".lienzo-scale");
    stage.style.width = Math.round(Fr.ancho*s2)+"px";
    stage.style.height = Math.round(Fr.alto*s2)+"px";
    if(sc) sc.style.transform = "scale("+s2+")";
    wrap.dataset.escala = s2;
    const tit = wrap.querySelector(".lz-tit");
    if(tit){
      let z = tit.querySelector(".lz-zoom");
      if(!z){ z=document.createElement("span"); z.className="lz-zoom"; tit.appendChild(z); }
      z.textContent = s2>=0.995 ? " · tamaño real" : " · vista al "+Math.round(s2*100)+"% (se exporta a "+Fr.ancho+"×"+Fr.alto+" reales)";
    }
  }
  const sr = stage.getBoundingClientRect();
  const rel = (el)=>{ const r=el.getBoundingClientRect(); return { x:r.left-sr.left, y:r.top-sr.top, w:r.width, h:r.height }; };
  const zonasDom = [...cmp.querySelectorAll(".cmp-zona")];
  const nombres = ["Logo","Texto","Botón (CTA)"];
  // 1) Zonas clicables (para editar su contenido en el panel).
  const visibles = [];
  zonasDom.forEach((z,i)=>{ const rc=rel(z); if(rc.w<6||rc.h<6) return; visibles.push({i,z,rc});
    const hs=document.createElement("div"); hs.className="lienzo-zona";
    hs.style.cssText=`left:${rc.x}px;top:${rc.y}px;width:${rc.w}px;height:${rc.h}px;`;
    hs.innerHTML=`<span class="lz-ztag">${nombres[i]}</span>`;
    hs.addEventListener("click",(e)=>{ e.stopPropagation(); seleccionarZonaLienzo(fmt, i); });
    if(["logo","titulo","cta"][i]===elSelComp) hs.classList.add("sel");
    ovl.appendChild(hs);
  });
  // 2) Divisores entre zonas visibles consecutivas.
  for(let k=0;k<visibles.length-1;k++){
    const a=visibles[k], b=visibles[k+1];
    const div=document.createElement("div"); div.className="lienzo-div "+(fila?"v":"h");
    if(fila) div.style.left=(b.rc.x)+"px"; else div.style.top=(b.rc.y)+"px";
    div.innerHTML=`<div class="lz-grip"></div>`;
    arrastrarDivisor(div, fmt, a, b, fila, stage, cmp, zonasDom);
    ovl.appendChild(div);
  }
  // 3) La burbuja se mueve agarrándola (motor único). Aquí solo su botón de
  //    quitar, que es otra acción.
  const bub = cmp.querySelector(".cmp-burbuja");
  if(bub){
    const rc = rel(bub);
    const x = document.createElement("button");
    x.type = "button"; x.className = "lienzo-quitar"; x.title = "Quitar el círculo de oferta"; x.textContent = "×";
    x.style.cssText = `left:${rc.x + rc.w - 13}px;top:${rc.y - 9}px;`;
    x.addEventListener("pointerdown", e=>e.stopPropagation());
    x.addEventListener("click", e=>{ e.stopPropagation(); setCompScope(fmt,"burbuja.visible",false); persistir(); renderTablero(); });
    ovl.appendChild(x);
  }
  // 4) TIRADOR DE TAMAÑO DEL LOGO. Moverlo ya lo hace el motor único (se agarra
  //    el logo directamente); aquí solo queda el asa que cambia su alto.
  const logoEl = cmp.querySelector(".cmp-logo");
  if(logoEl){
    const ponerAsaLogo = ()=>{
      if(!ovl.isConnected || ovl.querySelector(".lienzo-rzlogo")) return;
      const rc = rel(logoEl); if(rc.w <= 4 || rc.h <= 4) return;
      const rz = document.createElement("div");
      rz.className = "lienzo-rzlogo"; rz.title = "Arrastra para cambiar el tamaño del logo";
      rz.style.cssText = `left:${rc.x + rc.w - 6}px;top:${rc.y + rc.h - 6}px;`;
      redimensionarLogo(rz, fmt, stage, logoEl);
      ovl.appendChild(rz);
    };
    // Una imagen sin cargar mide 0x0: el asa se ponía y se descartaba sola.
    if(logoEl.complete && logoEl.naturalWidth) ponerAsaLogo();
    else logoEl.addEventListener("load", ponerAsaLogo, {once:true});
  }
  // Clic en el fondo del banner (fuera de cualquier elemento): edita el fondo.
  cmp.addEventListener("click",(e)=>{
    if(e.target.closest(".cmp-mov")) return;
    if(typeof elegirElemento === "function") elegirElemento("fondo");
  });
  // Texto editable DIRECTO sobre el banner (Título y Bajada).
  hacerTextoEditableLienzo(cmp, ovl, stage, fmt, rel);
  // Mover cada texto y el CTA en vertical + ajustar el ancho de la caja.
  hacerArrastrables(cmp, ovl, stage, fmt, rel);
}
// Grips de arrastre por elemento: ▲▼ mueve Título/Bajada/CTA (escribe su "sep"
// por alcance: global si editas el máster, override si es un tamaño) y el
// tirador lateral cambia el ANCHO de la caja de texto (%).
// ── MOTOR ÚNICO DE ARRASTRE ─────────────────────────────────────────────
// Antes había cuatro gestos distintos y no se parecían en nada: el logo y la
// burbuja se agarraban directo; el título, la bajada y el botón NO se podían
// agarrar (había que encontrar un tirador de 14 px a su izquierda, y solo movía
// en vertical); y los divisores eran una franja fina entre zonas. Por eso no se
// sentía fluido: el gesto natural —tomar el elemento y moverlo— no funcionaba
// en la mayoría de los elementos.
//
// Ahora todos se agarran igual. Lo que se guarda al soltar NO son píxeles:
//   · si sueltas cerca de un borde o del centro, se guarda la ALINEACIÓN
//     (izquierda / centro / derecha, arriba / medio / abajo) y el desplazamiento
//     vuelve a cero — así el elemento se comporta bien en los 11 tamaños;
//   · si sueltas en cualquier otro sitio, se guarda un DESPLAZAMIENTO en
//     unidades base, que se multiplica por la k de cada formato al replicar.
// Es lo que permite mover a mano sin romper la herencia entre tamaños.
const ARRASTRABLES = [
  { k:"logo",     sel:".cmp-logo",     off:"zonas.logo.off",           alinH:"zonas.logo.alinH", alinV:"zonas.logo.alinV" },
  { k:"epigrafe", sel:".cmp-etq",      off:"zonas.texto.etiqueta.off" },
  { k:"titulo",   sel:".cmp-tit",      off:"zonas.texto.titular.off",  ancho:"zonas.texto.titular.ancho" },
  { k:"bajada",   sel:".cmp-cue",      off:"zonas.texto.cuerpo.off",   ancho:"zonas.texto.cuerpo.ancho" },
  { k:"cta",      sel:".cmp-cta",      off:"zonas.cta.off",            alinH:"zonas.cta.alinH" },
  { k:"oferta",   sel:".cmp-burbuja",  off:"burbuja.off",              pos:"burbuja.pos" }
];
const IMAN = 9;   // px de pantalla dentro de los cuales se pega a una guía

function hacerArrastrables(cmp, ovl, stage, fmt, rel){
  const F = FORMATOS[fmt]; if(!F) return;
  const sL = parseFloat(cmp.closest(".lienzo")?.dataset.escala) || 1;
  const k  = factorK(fmt) * sL;              // px de pantalla por unidad base
  const marco = cmp.getBoundingClientRect();
  ARRASTRABLES.forEach(item=>{
    const el = cmp.querySelector(item.sel); if(!el) return;
    const enganchar = ()=>{
      const rc = rel(el); if(rc.w < 4 || rc.h < 4) return;
      hacerArrastrable(el, item, { fmt, stage, ovl, cmp, sL, k, marco, rel });
      if(item.ancho) tiradorDeAncho(el, item, { fmt, stage, ovl, cmp, sL, k, rel });
    };
    // Una imagen que aún no cargó mide 0×0 y se descartaría sola.
    if(el.tagName === "IMG" && !(el.complete && el.naturalWidth))
      el.addEventListener("load", enganchar, { once:true });
    else enganchar();
  });
}

// Guías de alineación: se dibujan mientras arrastras y se apagan al soltar.
function guiaLienzo(ovl, orient, pos){
  const g = document.createElement("div");
  g.className = "lz-guia " + orient;
  if(orient==="v") g.style.left = pos+"px"; else g.style.top = pos+"px";
  ovl.appendChild(g);
  return g;
}

function hacerArrastrable(el, item, ctx){
  const { fmt, ovl, cmp, sL, k, rel } = ctx;
  // El lienzo se re-engancha varias veces (hay más de un requestAnimationFrame
  // en cola). Cada nodo lleva SU propio guardia: los manejadores del banner se
  // apilaban (un arrastre de 40 px se guardaba seis veces, o sea 240), pero el
  // clon editable vive en el overlay, que sí se limpia y se vuelve a crear —
  // si el guardia cortara la función entera, el clon nuevo se quedaría sin
  // manejador y el texto dejaría de arrastrarse.
  const iniciar = (e)=>{
    if(e.button !== 0) return;
    // Un <img> o un <a> arrancan el arrastre nativo del navegador y se quedan
    // con el gesto: hay que impedirlo o el elemento no se mueve nunca.
    if(el.tagName === "IMG" || el.tagName === "A") e.preventDefault();
    // Un clic corto sigue sirviendo para escribir el texto: el arrastre solo
    // empieza a partir de 4 px, así los dos gestos conviven en el mismo sitio.
    const x0 = e.clientX, y0 = e.clientY;
    let arrastrando = false, dx = 0, dy = 0, raf = null;
    let guias = [], snapH = null, snapV = null;

    // Caja del elemento y de su zona, medidas UNA vez (nada de medir por frame).
    const rEl   = rel(el);
    const zona  = el.closest(".cmp-zona") || cmp;
    const rZona = rel(zona);
    const rCmp  = rel(cmp);
    // Posiciones a las que se imanta: bordes y centro de su zona.
    const holguraX = rZona.w - rEl.w, holguraY = rZona.h - rEl.h;
    const anclasX = [
      { v:"left",   px:rZona.x },
      { v:"center", px:rZona.x + rZona.w/2 - rEl.w/2 },
      { v:"right",  px:rZona.x + rZona.w - rEl.w }
    ];
    const anclasY = [
      { v:"top",    px:rZona.y },
      { v:"center", px:rZona.y + rZona.h/2 - rEl.h/2 },
      { v:"bottom", px:rZona.y + rZona.h - rEl.h }
    ];
    // El clon editable del texto vive en el overlay, sin escalar: hay que
    // moverlo a la par o el arrastre no se ve.
    const clon = ovl.querySelector(`.lienzo-edit[data-for="${item.sel}"]`);

    const pintar = ()=>{
      raf = null;
      el.style.transform = `translate(${dx/sL}px, ${dy/sL}px)`;
      if(clon) clon.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const mover = (ev)=>{
      const ddx = ev.clientX - x0, ddy = ev.clientY - y0;
      if(!arrastrando){
        if(Math.abs(ddx) < 4 && Math.abs(ddy) < 4) return;   // todavía es un clic
        arrastrando = true;
        el.classList.add("arrastrando");
        ovl.classList.add("arrastrando");
        document.body.classList.add("sbb-arrastrando");
        if(el.isContentEditable) el.blur();
      }
      // Acotado al marco: un elemento no se puede arrastrar fuera del banner.
      dx = Math.max(rCmp.x - rEl.x, Math.min(rCmp.x + rCmp.w - (rEl.x + rEl.w), ddx));
      dy = Math.max(rCmp.y - rEl.y, Math.min(rCmp.y + rCmp.h - (rEl.y + rEl.h), ddy));
      // Imantado: si el borde queda a menos de IMAN px de una guía, se pega.
      guias.forEach(g=>g.remove()); guias = []; snapH = null; snapV = null;
      const cx = rEl.x + dx, cy = rEl.y + dy;
      // Solo se puede ALINEAR lo que tiene holgura dentro de su zona. Un titular
      // que ocupa todo el ancho tiene sus tres anclas en el mismo sitio: ahí no
      // hay nada que alinear, y hacerlo lo devolvía a su posición de partida.
      if(holguraX >= 4){
        let mejorX = null, dMinX = IMAN;
        anclasX.forEach(a=>{ const d = Math.abs(cx - a.px); if(d < dMinX){ dMinX = d; mejorX = a; } });
        // Lanzarlo contra un borde cuenta como soltarlo en ese borde.
        if(!mejorX && cx <= anclasX[0].px) mejorX = anclasX[0];
        if(!mejorX && cx >= anclasX[2].px) mejorX = anclasX[2];
        if(mejorX){ dx = mejorX.px - rEl.x; snapH = mejorX.v; guias.push(guiaLienzo(ovl,"v", mejorX.px + (mejorX.v==="right"?rEl.w:mejorX.v==="center"?rEl.w/2:0))); }
      }
      if(holguraY >= 4){
        let mejorY = null, dMinY = IMAN;
        anclasY.forEach(a=>{ const d = Math.abs(cy - a.px); if(d < dMinY){ dMinY = d; mejorY = a; } });
        if(!mejorY && cy <= anclasY[0].px) mejorY = anclasY[0];
        if(!mejorY && cy >= anclasY[2].px) mejorY = anclasY[2];
        if(mejorY){ dy = mejorY.px - rEl.y; snapV = mejorY.v; guias.push(guiaLienzo(ovl,"h", mejorY.px + (mejorY.v==="bottom"?rEl.h:mejorY.v==="center"?rEl.h/2:0))); }
      }
      if(!raf) raf = requestAnimationFrame(pintar);
    };
    const soltar = ()=>{
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      if(raf) cancelAnimationFrame(raf);
      guias.forEach(g=>g.remove());
      el.classList.remove("arrastrando");
      ovl.classList.remove("arrastrando");
      document.body.classList.remove("sbb-arrastrando");
      el.style.transform = ""; if(clon) clon.style.transform = "";
      if(!arrastrando){
        // Fue un clic: selecciona ese elemento en el panel y no mueve nada.
        if(typeof elegirElemento === "function") elegirElemento(item.k);
        return;
      }

      // Se guarda ALINEACIÓN cuando cayó sobre una guía, y DESPLAZAMIENTO en
      // unidades base cuando cayó libre. Nunca píxeles de pantalla.
      const offAct = getPath(composicionEfectiva(pieza(), fmt), item.off) || {};
      let ox = parseFloat(offAct.x) || 0, oy = parseFloat(offAct.y) || 0;
      if(snapH && item.alinH){ setCompScope(fmt, item.alinH, snapH); ox = 0; }
      else ox = Math.round(ox + dx/k);
      if(snapV && item.alinV){ setCompScope(fmt, item.alinV, snapV); oy = 0; }
      else oy = Math.round(oy + dy/k);
      // La burbuja tiene sus cinco posiciones con nombre: si cayó en una esquina
      // se guarda esa, que es lo que entiende su render.
      if(item.pos && (snapH || snapV)){
        const h = snapH || "right", v = snapV || "top";
        const mapa = { "left-top":"tl", "left-bottom":"bl", "right-top":"tr",
                       "right-bottom":"br", "right-center":"cr" };
        const nom = mapa[h+"-"+v];
        if(nom){ setCompScope(fmt, item.pos, nom); ox = 0; oy = 0; }
      }
      setCompScope(fmt, item.off, { x:ox, y:oy });
      persistir(); renderTablero();
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  if(!el.dataset.arrastrable){
    el.dataset.arrastrable = "1";
    el.classList.add("cmp-mov");
    el.addEventListener("pointerdown", iniciar);
    el.addEventListener("dragstart", (e)=>e.preventDefault());
    if(el.tagName === "A") el.addEventListener("click", (e)=>e.preventDefault());
    if(el.tagName === "IMG" || el.tagName === "A") el.setAttribute("draggable","false");
  }
  // El clon editable (Título y Bajada) se dibuja ENCIMA en el overlay: sin esto
  // se quedaba con el gesto y el texto no se podía arrastrar nunca.
  const clonEd = ovl.querySelector(`.lienzo-edit[data-for="${item.sel}"]`);
  if(clonEd && !clonEd.dataset.arrastrable){
    clonEd.dataset.arrastrable = "1";
    clonEd.classList.add("cmp-mov");
    clonEd.addEventListener("pointerdown", iniciar);
  }
}

// Tirador lateral: cambia el ANCHO de la caja de texto (en % de su zona).
function tiradorDeAncho(el, item, ctx){
  const { fmt, ovl, sL, rel } = ctx;
  const rc = rel(el);
  const zona = el.closest(".cmp-zona");
  const zw = zona ? rel(zona).w : rc.w;
  const w = document.createElement("div");
  w.className = "lienzo-wh"; w.title = "Arrastra para cambiar el ancho de la caja";
  w.style.cssText = `left:${rc.x + rc.w - 4}px;top:${rc.y + rc.h/2 - 11}px;`;
  w.addEventListener("pointerdown",(e)=>{
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX; let dx = 0;
    const clon = ovl.querySelector(`.lienzo-edit[data-for="${item.sel}"]`);
    const mv = (ev)=>{ dx = ev.clientX - x0;
      el.style.width = (rc.w + dx)/sL + "px";
      if(clon) clon.style.width = (rc.w + dx + 4) + "px";
      w.style.transform = `translateX(${dx}px)`;
    };
    const up = ()=>{
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      el.style.width = ""; if(clon) clon.style.width = ""; w.style.transform = "";
      if(Math.abs(dx) > 2 && zw > 0){
        const pct = Math.max(20, Math.min(100, Math.round((rc.w + dx)/zw*100)));
        setCompScope(fmt, item.ancho, String(pct));
        persistir(); renderTablero();
      }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });
  ovl.appendChild(w);
}
// Edición inline del texto en el lienzo: clic → escribir, Enter = salto de línea,
// y una barrita con tamaño (A-/A+) y alineación (izq/centro/der).
function hacerTextoEditableLienzo(cmp, ovl, stage, fmt, rel){
  const partes=[
    {sel:".cmp-tit", path:"zonas.texto.titular.texto", size:"zonas.texto.titular.tamano", mn:12, mx:60},
    {sel:".cmp-cue", path:"zonas.texto.cuerpo.texto",  size:"zonas.texto.cuerpo.tamano",  mn:9,  mx:32}
  ];
  // El overlay NO está escalado: el clon editable debe compensar la escala de
  // la vista (si no, en un 1200px "al 75%" el texto se dibuja gigante, se monta
  // sobre la bajada y tapa los controles).
  const sV = parseFloat(cmp.closest(".lienzo")?.dataset.escala)||1;
  const pxScaled = (v)=>{ const n=parseFloat(v); return isNaN(n) ? v : (n*sV)+"px"; };
  partes.forEach(pt=>{
    const el=cmp.querySelector(pt.sel); if(!el) return;
    const rc=rel(el); const cs=getComputedStyle(el);
    const ed=document.createElement("div"); ed.className="lienzo-edit"; ed.contentEditable="true"; ed.spellcheck=false;
    ed.dataset.for=pt.sel;
    ed.style.cssText=`left:${rc.x-2}px;top:${rc.y-1}px;width:${rc.w+4}px;font-family:${cs.fontFamily};font-size:${pxScaled(cs.fontSize)};font-weight:${cs.fontWeight};line-height:${cs.lineHeight&&cs.lineHeight!=="normal"?pxScaled(cs.lineHeight):cs.lineHeight};color:${cs.color};text-align:${cs.textAlign};letter-spacing:${cs.letterSpacing&&cs.letterSpacing!=="normal"?pxScaled(cs.letterSpacing):cs.letterSpacing};`;
    ed.textContent=el.textContent;
    el.style.visibility="hidden";
    ed.addEventListener("focus",()=>mostrarBarraTexto(ed, stage, fmt, pt));
    ed.addEventListener("blur",()=>{ setTimeout(()=>{
      if(document.activeElement && document.activeElement.closest && document.activeElement.closest(".lienzo-textbar")) return;
      ocultarBarraTexto();
      const val=ed.innerText.replace(/ /g," ").replace(/\n{3,}/g,"\n\n").replace(/[ \t]+\n/g,"\n").trim();
      setCompScope(fmt, pt.path, val); marcarTableroSucio(); repintarSiSucio();
    }, 70); });
    ovl.appendChild(ed);
  });
}
// El tablero se repinta UNA vez cuando terminas de editar, no en cada pulsacion.
// Los 11 banners mas el inspector son trabajo real: hacerlo por tecla es lo que
// se sentia como "no es fluido".
let _tableroSucio = false;
function marcarTableroSucio(){ _tableroSucio = true; }
function repintarSiSucio(){
  if(!_tableroSucio) return;
  _tableroSucio = false;
  persistir(); renderTablero();
}
function ocultarBarraTexto(){ const b=document.getElementById("lienzo-textbar"); if(b) b.remove(); }
function mostrarBarraTexto(ed, stage, fmt, pt){
  ocultarBarraTexto();
  const bar=document.createElement("div"); bar.className="lienzo-textbar"; bar.id="lienzo-textbar";
  const aln=[["left","alignLeft"],["center","alignCenter"],["right","alignRight"]];
  bar.innerHTML=
    `<button type="button" data-act="menos" title="Más chico">A−</button>`+
    `<button type="button" data-act="mas" title="Más grande">A+</button>`+
    `<span class="sep"></span>`+
    aln.map(([a,ic])=>`<button type="button" data-aln="${a}" title="${a}">${ICONS[ic]||a}</button>`).join("");
  // Posición: sobre el elemento editable.
  const er=ed.getBoundingClientRect(), sr=stage.getBoundingClientRect();
  bar.style.left=Math.max(2,(er.left-sr.left))+"px";
  bar.style.top=Math.max(2,(er.top-sr.top-40))+"px";
  bar.querySelectorAll("button").forEach(b=>{
    b.addEventListener("pointerdown",e=>e.preventDefault());   // no quitar el foco del texto
    b.addEventListener("click",e=>{
      e.preventDefault();
      // commit del texto actual antes de aplicar el cambio
      const val=ed.innerText.replace(/ /g," ").replace(/\n{3,}/g,"\n\n").trim();
      setCompScope(fmt, pt.path, val);
      // El cambio se aplica EN VIVO al banner y al clon editable, y el tablero se
      // repinta al SALIR del texto. Antes cada clic repintaba los 11 banners, y eso
      // borraba el overlay: perdias el foco y la barrita se cerraba, asi que habia
      // que volver a hacer clic en el texto para cada A+ y cada alineacion.
      // `stage` es .lienzo-stage; el banner vive dentro, en .lienzo-scale > .cmp
      const cmpEl = stage.querySelector(".cmp");
      const orig = cmpEl && cmpEl.querySelector(pt.sel);
      const sVv = parseFloat(stage.closest(".lienzo")?.dataset.escala)||1;
      if(b.dataset.act){
        const cur=parseInt(getPath(composicionEfectiva(pieza(),fmt), pt.size))||(pt.mn+pt.mx>>1);
        const nv=Math.max(pt.mn,Math.min(pt.mx, cur+(b.dataset.act==="mas"?2:-2)));
        setCompScope(fmt, pt.size, String(nv));
        // Vista previa inmediata con el cuerpo REAL: lo decide la tabla de
        // geometria (base x k, acotada al rango), igual que en el render.
        const parte = pt.sel===".cmp-tit" ? "titulo" : "bajada";
        const px = cuerpoDe(fmt, parte, nv);
        if(orig) orig.style.fontSize = px+"px";
        ed.style.fontSize = Math.round(px*sVv)+"px";
      } else if(b.dataset.aln){
        setCompScope(fmt, "zonas.texto.alinH", b.dataset.aln);
        const zin = orig && orig.closest(".cmp-zin");
        if(zin){ zin.style.textAlign = b.dataset.aln; zin.style.alignItems = alinFlex(b.dataset.aln); }
        if(orig) orig.style.textAlign = b.dataset.aln;
        ed.style.textAlign = b.dataset.aln;
      }
      marcarTableroSucio();          // se repinta al salir del texto
      ed.focus();                    // el foco NO se pierde: sigues escribiendo
    });
  });
  stage.querySelector(".lienzo-ovl").appendChild(bar);
}
function seleccionarZonaLienzo(fmt, i){
  const p=pieza(); p.activaFmt=fmt;
  // Zona 0 = logo · 1 = textos · 2 = boton. El panel se abre en ESE elemento.
  elSelComp = ["logo","titulo","cta"][i] || "titulo";
  renderComposicionEditor();
}
// Arrastrar el LOGO por el banner (se imanta a las 9 posiciones) y su tirador
// para agrandarlo o achicarlo. Es la peticion mas repetida del usuario y no
// rompe el modelo de 3 zonas: lo que se escribe es su alineacion y su alto.
// Tirador de tamaño del logo: arrastrar en diagonal cambia su ALTO en unidades
// base, así que el cambio se replica proporcional en los once tamaños.
function redimensionarLogo(rz, fmt, stage, logoEl){
  rz.addEventListener("pointerdown",(e)=>{
    e.preventDefault(); e.stopPropagation();
    const sL = parseFloat(stage.closest(".lienzo")?.dataset.escala) || 1;
    const k  = factorK(fmt) * sL;
    const C  = composicionEfectiva(pieza(), fmt);
    const a0 = parseFloat(getPath(C,"zonas.logo.alto"));
    const base = isNaN(a0) ? 40 : a0;
    const y0 = e.clientY; let val = base;
    const mv = (ev)=>{
      val = Math.max(10, Math.min(200, Math.round(base + (ev.clientY - y0)/Math.max(0.2,k))));
      logoEl.style.height = (val*factorK(fmt)) + "px";
      rz.style.transform = `translateY(${ev.clientY - y0}px)`;
    };
    const up = ()=>{
      window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up);
      rz.style.transform = "";
      setCompScope(fmt,"zonas.logo.alto",val); persistir(); renderTablero();
    };
    window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up);
  });
}
function arrastrarDivisor(div, fmt, a, b, fila, stage, cmp, zonasDom){
  div.addEventListener("pointerdown",(e)=>{
    e.preventDefault(); div.classList.add("drag"); div.setPointerCapture(e.pointerId);
    const sr=stage.getBoundingClientRect();
    const za=zonasDom[a.i], zb=zonasDom[b.i];
    const propA0=parseFloat(getComputedStyle(za).flexGrow)||a.rc[fila?"w":"h"];
    const propB0=parseFloat(getComputedStyle(zb).flexGrow)||b.rc[fila?"w":"h"];
    const suma=propA0+propB0;
    // Rango combinado de las dos zonas (en px de pantalla).
    const iniPx = fila ? (a.rc.x) : (a.rc.y);
    const largo = fila ? (a.rc.w+b.rc.w) : (a.rc.h+b.rc.h);
    const mover=(ev)=>{
      const pos = fila ? (ev.clientX-sr.left) : (ev.clientY-sr.top);
      let frac=(pos-iniPx)/largo; frac=Math.max(0.12,Math.min(0.88,frac));
      const nA=+(suma*frac).toFixed(1), nB=+(suma-suma*frac).toFixed(1);
      za.style.flexGrow=nA; zb.style.flexGrow=nB;
      if(fila) div.style.left=(a.rc.x+largo*frac)+"px"; else div.style.top=(a.rc.y+largo*frac)+"px";
      div._nA=nA; div._nB=nB;
    };
    const soltar=()=>{
      document.removeEventListener("pointermove",mover); document.removeEventListener("pointerup",soltar);
      div.classList.remove("drag");
      if(div._nA!=null){ const prop=propScope(fmt).slice(); prop[a.i]=Math.round(div._nA); prop[b.i]=Math.round(div._nB);
        setCompScope(fmt,"prop",prop); persistir(); renderTablero(); }
    };
    document.addEventListener("pointermove",mover); document.addEventListener("pointerup",soltar);
  });
}
// Biblioteca: elegir imagen/logo y aplicarla a una ruta (global o por tamaño).
function elegirImagenPath(path, fmt){ abrirImagenes(url=>{ if(fmt) setCompOv(fmt,path,url); else setComp(path,url); renderComposicionEditor(); }); }
function elegirImagenComp(path){ elegirImagenPath(path, null); }
// 🪄 Miniaturas de la biblioteca, clic = aplicar (regla 5: sin copiar URL).
function jsAttr(s){ return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'"); }
function miniaturasBiblioteca(path, fmt){
  const imgs=(workspace.imagenes||[]).slice(0,8);
  if(!imgs.length) return "";
  const call=(u)=> (fmt ? `setCompOv('${fmt}','${path}','${jsAttr(u)}')` : `setComp('${path}','${jsAttr(u)}')`)+`;renderComposicionEditor()`;
  return `<div class="cmp-bibmini">${imgs.map(im=>`<button class="bibmini" title="${escAttr(im.nombre||im.url)}" onclick="${call(im.url)}"><img src="${esc(im.url)}" alt=""></button>`).join("")}</div>`;
}
function coloresMarcaPreset(){
  const cols=[]; const add=c=>{ if(c && !cols.includes(c)) cols.push(c); };
  (workspace.marcas||[]).forEach(m=>{ const n=normalizarMarca(m); add(n.primary); add(n.secondary); add(n.cta); add(n.accent1); add(n.accent2); add(n.bg); add(n.text); });
  ["#040764","#102a43","#1c1c28","#0b7a4b","#1c73cb","#b3261e","#ffffff","#f5f5f5"].forEach(add);
  return cols.slice(0,14);
}
// SOLO colores de la marca (sin presets genéricos). El resto se elige con el mezclador HEX.
function coloresDeMarca(){
  const cols=[]; const add=c=>{ if(c && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(c).trim()) && !cols.includes(c)) cols.push(c); };
  (workspace.marcas||[]).forEach(m=>{ const n=normalizarMarca(m); [n.primary,n.secondary,n.cta,n.accent1,n.accent2,n.bg,n.text].forEach(add); });
  return cols.slice(0,16);
}
// Swatches de color = SOLO colores de la marca; escriben en una ruta (global o por tamaño).
function swatchesColor(path, fmt){
  const re = "renderComposicionEditor()";
  const set = (c)=> fmt ? `setCompOv('${fmt}','${path}','${c}')` : `setComp('${path}','${c}')`;
  const cols = coloresDeMarca();
  if(!cols.length) return `<span class="cmp-sw-vacio">Aplica una marca para ver su paleta · o usa el HEX</span>`;
  return cols.map(c=>`<button class="cmp-sw" style="background:${esc(c)}" title="${esc(c)}" onclick="${set(c)};${re}"></button>`).join("");
}
// ✨ Sugerir titular + cuerpo + CTA con IA (Gemini) para la composición global.
async function sugerirTextosIA(){
  const p=pieza(); if(!esComposicion(p)) return;
  const que = prompt("¿De qué es la pieza? (una frase) — la IA escribe titular, cuerpo y CTA:", getPath(p.composicion,'zonas.texto.titular.texto')||"");
  if(que===null) return;
  // Usa TODOS los recursos de la marca aplicada (voz + colores) para que el texto suene a la marca.
  const mid = p.tema && p.tema.marcaId;
  const marcaRaw = mid ? (workspace.marcas||[]).find(x=>x.id===mid) : null;
  const marca = marcaRaw ? normalizarMarca(marcaRaw) : null;
  // URL a revisar OPCIONAL (vacío por defecto → más rápido; pega una si quieres que la lea).
  const refsIn = prompt("URL a revisar (opcional, máx. 2, separa con espacios).\nDéjalo vacío para que sea más rápido; pega una URL solo si quieres que la IA la lea:", "");
  const refs = (refsIn||"").split(/[\s,]+/).map(s=>s.trim()).filter(s=>/^https?:\/\//.test(s)).slice(0,2);
  toast("Char-B está pensando los textos…", 8000);
  try{
    const r=await fetch('/api/ia',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({modo:'textos',marca,brief:{que,tono:(marca&&marca.tono)||'profesional y cercano',refs}})});
    const raw=await r.text(); let d={}; try{ d=JSON.parse(raw); }catch(_){}
    if(!r.ok||!d.ok){ toast(d.error||raw.slice(0,140)||('Error '+r.status),5000); return; }
    if(d.titular) setComp('zonas.texto.titular.texto',d.titular);
    if(d.cuerpo) setComp('zonas.texto.cuerpo.texto',d.cuerpo);
    if(d.cta) setComp('zonas.cta.texto',d.cta);
    renderComposicionEditor();
    toast("Textos sugeridos por Char-B");
  }catch(e){ toast("Sin conexión: "+(e.message||e),4000); }
}
// Genera una FOTOGRAFÍA de fondo con IA (Imagen, misma API) y la aplica al banner.
async function generarFondoIA(){
  const p=pieza(); if(!esComposicion(p)) return;
  const que = prompt("¿Qué debe mostrar la fotografía de fondo? (una frase):", getPath(p.composicion,'zonas.texto.titular.texto')||"");
  if(que===null || !que.trim()) return;
  const mid = p.tema && p.tema.marcaId;
  const marcaRaw = mid ? (workspace.marcas||[]).find(x=>x.id===mid) : null;
  const M = marcaRaw ? normalizarMarca(marcaRaw) : null;
  toast("Generando la fotografía con IA… (puede tardar hasta un minuto)", 12000);
  try{
    const r=await fetch('/api/ia',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({modo:'imagen',brief:{que:que.trim()},marca:M?{nombre:M.nombre,negocio:M.negocio}:null})});
    const raw=await r.text(); let d={}; try{ d=JSON.parse(raw); }catch(_){}
    if(!r.ok||!d.ok||!d.url){ toast(d.error||raw.slice(0,140)||('Error '+r.status),6000); return; }
    workspace.imagenes = workspace.imagenes || [];
    workspace.imagenes.push({ id:"img"+Math.random().toString(36).slice(2,9), url:d.url, nombre:d.nombre||("IA · "+que.trim()), creado:Date.now(), enR2:true });
    setComp('fondo.tipo','imagen');
    setComp('fondo.imagen.url',d.url);
    persistir(); renderTablero(); renderComposicionEditor();
    toast("Fotografía generada y aplicada como fondo (quedó también en tu biblioteca)");
  }catch(e){ toast("Sin conexión: "+(e.message||e),4000); }
}
// Toggle de elementos APAGADOS por defecto (burbuja de oferta / burbujas deco):
// visible solo cuando es exactamente true, así que el toggle escribe true/false explícito.
function toggleExtraComp(path, fmt){
  const p=pieza(); if(!esComposicion(p)) return;
  if(fmt){ const ef=composicionEfectiva(p,fmt); setCompOv(fmt, path, getPath(ef,path)===true ? false : true); }
  else setComp(path, getPath(p.composicion,path)===true ? false : true);
  renderForm(); renderComposicionEditor();
}
