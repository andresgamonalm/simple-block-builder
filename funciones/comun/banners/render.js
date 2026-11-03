/* ══════════════════════════════════════════════════════════════════
   BANNERS · DIBUJO  ·  funciones/comun/banners/render.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Dibuja un banner del modelo de 3 zonas (piezas guardadas): zonas, legal, burbujas, layouts de marca y el plan de qué entra en cada tamaño.
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. LAYOUTS DE MARCA
     2. PLAN DEL BANNER: QUÉ ENTRA Y CON QUÉ MEDIDAS
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Acceso por ruta ("zonas.texto.titular.texto").
function getPath(obj, path){ return String(path).split('.').reduce((o,k)=> (o==null?undefined:o[k]), obj); }
function setPath(obj, path, val){ const ks=String(path).split('.'); let o=obj; for(let i=0;i<ks.length-1;i++){ if(o[ks[i]]==null||typeof o[ks[i]]!=="object") o[ks[i]]={}; o=o[ks[i]]; } o[ks[ks.length-1]]=val; }
function delPath(obj, path){ const ks=String(path).split('.'); let o=obj; for(let i=0;i<ks.length-1;i++){ if(o==null) return; o=o[ks[i]]; } if(o) delete o[ks[ks.length-1]]; }
function alinSelf(a){ return a==="center"?"center":a==="right"?"flex-end":"flex-start"; }
function alinFlex(a){ return (a==="center")?"center":(a==="right"||a==="bottom")?"flex-end":"flex-start"; }
function alinText(a){ return a==="center"?"center":a==="right"?"right":"left"; }
function capaImagenHTML(im, cls, esFondoBanner){
  if(!im || !im.url) return "";
  const foco=im.foco||"center";
  const zoom=Math.max(50,Math.min(300,parseInt(im.zoom)||100))/100;
  const fit=(im.fit==="contain")?"contain":"cover";
  const veil=cls==="cmp-bg"?"cmp-veil":"cmp-zveil";
  // Sobre foto el velo es OBLIGATORIO: sin él, el texto blanco es una apuesta.
  // Rango de uso del manual: 35 %–60 %.
  let op = parseInt(im.oscurecer);
  if(!isFinite(op)) op = 45;
  if(esFondoBanner) op = Math.max(GEOM.velo[0], Math.min(GEOM.velo[1], op));
  else op = Math.max(0, Math.min(100, op));
  return `<img class="${cls}" src="${esc(im.url)}" style="object-fit:${fit};object-position:${esc(foco)};transform:scale(${zoom});transform-origin:${esc(foco)};"><div class="${veil}" style="background:rgba(8,14,28,${(op/100).toFixed(2)});"></div>`;
}
// Render del contenido propio de cada zona, con las medidas del PLAN (tabla
// cerrada) y el espaciado fijo del manual.
// Desplazamiento fino de un elemento, en unidades base escaladas por k.
// Se aplica con transform: no toca el flujo, asi que no empuja a los vecinos
// ni obliga a recalcular la caida de elementos.
function offCSS(o, P){
  const x = parseFloat(o && o.off && o.off.x) || 0;
  const y = parseFloat(o && o.off && o.off.y) || 0;
  if(!x && !y) return "";
  return `transform:translate(${Math.round(x*P.g.k)}px,${Math.round(y*P.g.k)}px);`;
}
function zonaContenido(zk, z, P, c){
  const fmt = P.fmt;
  const px = (v,base)=>Math.round((parseFloat(v)||base)*P.g.k);
  if(zk==="logo"){
    if(!z.url) return "";
    const maxw=Math.max(15,Math.min(100,parseInt(z.maxw)||70));
    return `<img class="cmp-logo" draggable="false" src="${esc(z.url)}" style="height:${P.logoAlto}px;max-width:${maxw}%;${offCSS(z,P)}">`;
  }
  if(zk==="texto"){
    const ti=z.titular||{}, cu=z.cuerpo||{}, et=z.etiqueta||{};
    const fam = z.fuente ? `font-family:'${esc(z.fuente)}',Arial,sans-serif;` : "";
    const est = (o)=> `${o.negrita?'font-weight:700;':''}${o.italica?'font-style:italic;':''}`;
    // sep = desplazamiento vertical propio (unidades base, escala con k) ·
    // ancho = ancho de la caja de texto (%). Ambos editables desde el lienzo.
    const sepA=(o,aire)=>{ const v=parseFloat(o.sep)||0; return `margin-top:${aire + (v?px(v,0):0)}px;`; };
    const anchoA=(o)=>{ const v=parseFloat(o.ancho); return (v&&v>=20&&v<=100)?`width:${v}%;`:""; };
    // Epígrafe: píldora chica con el nombre corto del producto. Su fondo por
    // defecto es un blanco translúcido, que sobre navy da contraste real.
    const etEl = et.texto ? `<div style="${offCSS(et,P)}"><span class="cmp-etq" style="font-size:${P.cuerpo.epigrafe}px;padding:${Math.round(P.cuerpo.epigrafe*0.35)}px ${Math.round(P.cuerpo.epigrafe*0.9)}px;background:${esc(et.color||'rgba(255,255,255,.22)')};color:${esc(et.colorTexto||ti.color||'#fff')};${fam}">${esc(et.texto)}</span></div>` : "";
    const offEt = offCSS(et,P), offTi = offCSS(ti,P), offCu = offCSS(cu,P);
    const tiEl = ti.texto ? `<div class="cmp-tit" style="font-size:${P.cuerpo.titulo}px;color:${esc(ti.color||'#fff')};text-align:${alinText(z.alinH)};${sepA(ti, et.texto?aireDe(fmt,"epiTit"):0)}${anchoA(ti)}${fam}${est(ti)}${offTi}">${escMultiline(ti.texto)}</div>` : "";
    const cuEl = cu.texto ? `<div class="cmp-cue" style="font-size:${P.cuerpo.bajada}px;color:${esc(cu.color||'#fff')};text-align:${alinText(z.alinH)};${sepA(cu, ti.texto?aireDe(fmt,"titBaj"):0)}${anchoA(cu)}${fam}${est(cu)}${offCu}">${escMultiline(cu.texto)}</div>` : "";
    return etEl+tiEl+cuEl;
  }
  if(zk==="cta"){
    const fam = z.fuente ? `font-family:'${esc(z.fuente)}',Arial,sans-serif;` : "";
    const est = `${z.negrita?'font-weight:700;':''}${z.italica?'font-style:italic;':''}`;
    const t = P.cuerpo.cta;
    const sepC = parseFloat(z.sep) ? `margin-top:${px(parseFloat(z.sep),0)}px;` : "";
    // El botón nunca se cae. El legal NO va aquí: tiene su propia banda inferior
    // reservada (bandaLegalHTML), para que nunca se monte sobre el contenido.
    return (P.hay.cta && z.texto)
      ? `<a class="cmp-cta" href="${esc(z.url||'#')}" target="_blank" rel="noopener" style="font-size:${t}px;background:${esc(z.colorFondo||'#2f80ed')};color:${esc(z.colorTexto||'#fff')};border-radius:${px(z.radio,0)}px;padding:${Math.round(t*0.55)}px ${Math.round(t*1.25)}px;${sepC}${fam}${est}${offCSS(z,P)}">${esc(z.texto)}</a>` : "";
  }
  return "";
}
// BANDA LEGAL: una línea, abajo, con su espacio RESERVADO en cada banner (así
// no se monta nunca sobre el contenido). Sobre foto el legal no va encima de la
// imagen: la banda lleva un respaldo sólido del color de fondo del banner.
function altoBandaLegal(P){
  if(!P.hay.legal) return 0;
  return Math.round(P.cuerpo.legal*1.25) + Math.round(P.cuerpo.legal*0.5);
}
function bandaLegalHTML(P, c, bgColor, esFoto){
  if(!P.hay.legal) return "";
  const alto = altoBandaLegal(P);
  const col = c.legalColor || (esFoto || esColorOscuro(bgColor) ? "#ffffff" : colorTintaSobre(bgColor));
  // Respaldo sólido si detrás hay foto O adornos: los adornos asoman por el borde
  // inferior, justo donde vive la banda, y un celeste bajo el legal blanco lo
  // deja ilegible.
  const respaldo = (esFoto || P.hay.adornos) ? `background:${esc(bgColor)};` : "";
  return `<div class="cmp-legalbanda" style="height:${alto}px;padding:0 ${P.margen.r}px 0 ${P.margen.l}px;bottom:${Math.max(2,Math.round(P.margen.b/2))}px;${respaldo}">`
    + `<div class="cmp-legal" style="font-size:${P.cuerpo.legal}px;color:${esc(col)};">${esc(c.legal)}</div></div>`;
}
// Tinta legible sobre un fondo claro: el color oscuro de la marca si lo hay.
function colorTintaSobre(bg){
  const m = (workspace.marcas||[]).find(x=>x && x.text);
  const t = (m && m.text) || "#040764";
  return esColorOscuro(t) ? t : "#040764";
}
// ADORNOS (formas de apoyo). Manual: TRES formas de ⌀ 28 %, 16 % y 9 % del lado
// corto, SIEMPRE asomando por el borde inferior — nunca flotando en el centro —,
// siempre por detrás del contenido y nunca dos del mismo color tocándose (las
// dos que comparten color van en extremos opuestos). Se apagan en franjas y en
// cualquier formato de lado corto ≤ 250: eso lo decide geomDe().noVan.
function decoBurbujasHTML(deco, W, H){
  const c1 = deco.color1 || "#378CE3", c2 = deco.color2 || "#41B6E6";
  const S = Math.min(W, H);
  const r = GEOM.decoPct.map(p => S*p/200);          // /200 = mitad del diámetro
  const cs = [
    { x:0.16*W, y:H + r[0]*0.40, r:r[0], f:c1 },     // grande, izquierda
    { x:0.60*W, y:H + r[1]*0.30, r:r[1], f:c2 },     // media, centro-derecha
    { x:0.88*W, y:H + r[2]*0.10, r:r[2], f:c1 }      // chica, derecha (lejos de la grande)
  ];
  const circles = cs.map(c=>`<circle cx="${c.x.toFixed(0)}" cy="${c.y.toFixed(0)}" r="${c.r.toFixed(0)}" fill="${esc(c.f)}"/>`).join("");
  return `<svg class="cmp-deco" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${circles}</svg>`;
}
// CÍRCULO DE OFERTA. Diámetro cerrado: 62 % del lado corto, y sale 8 % por el
// borde. El bloque de texto le DESCUENTA ese sitio de su ancho (sin reserva
// tapaba el título y el botón). Solo existe si hay una cifra real.
// El campo "tamaño" del panel se interpreta como PORCENTAJE del lado corto
// cuando está entre 30 y 80; cualquier otro valor usa el 62 % del manual.
function diametroBurbuja(bu, fmt){
  const g = geomDe(fmt);
  const v = parseFloat(bu && bu.tamano);
  if(v && v>=30 && v<=80) return Math.min(Math.round(g.corto*v/100), Math.round(g.corto*0.72));
  return g.circuloK || Math.round(GEOM.circuloBase*g.k);
}
// Lado del banner que ocupa el círculo: 'l' (tl/bl) o 'r' (tr/br/cr).
const ladoBurbuja = bu => /l$/.test(bu && bu.pos || "tr") ? "l" : "r";
function burbujaHTML(bu, fmt){
  const dia = diametroBurbuja(bu, fmt);
  const g = geomDe(fmt);
  const bg = bu.color || "#FCE865", fg = bu.colorTexto || "#040764";
  const t = String(bu.texto||"").trim();
  const m = t.match(/^(\$?\d[\d.,]*%?)\s+([\s\S]+)$/);
  // La cifra manda: 45 % del DIÁMETRO (no del lienzo). La palabra, 20 %.
  const inner = m
    ? `<span class="bnum" style="font-size:${Math.round(dia*GEOM.cifraPctDia/100)}px;">${esc(m[1])}</span><span class="btxt" style="font-size:${Math.round(dia*0.14)}px;">${esc(m[2])}</span>`
    : `<span class="btxt" style="font-size:${Math.round(dia*0.17)}px;">${esc(t)}</span>`;
  // Sale por el borde 8 % del lado corto: el desplazamiento es NEGATIVO y se
  // compensa con padding para que el texto de dentro no se corte.
  const sale = g.sale;
  const pos = bu.pos || "tr";
  const P = pos==="tl" ? `top:${-sale}px;left:${-sale}px;padding-top:${sale}px;padding-left:${sale}px;`
        : pos==="bl" ? `bottom:${-sale}px;left:${-sale}px;padding-bottom:${sale}px;padding-left:${sale}px;`
        : pos==="br" ? `bottom:${-sale}px;right:${-sale}px;padding-bottom:${sale}px;padding-right:${sale}px;`
        : pos==="cr" ? `top:50%;margin-top:${-Math.round(dia/2)}px;right:${-sale}px;padding-right:${sale}px;`
        : `top:${-sale}px;right:${-sale}px;padding-top:${sale}px;padding-right:${sale}px;`;
  return `<div class="cmp-burbuja" style="width:${dia}px;height:${dia}px;background:${esc(bg)};color:${esc(fg)};${P}">${inner}</div>`;
}
// ── LAYOUTS DE MARCA ─────────────────────────────────────────────────────
// Cuatro disposiciones extraidas de las campanas reales. Reusan el MISMO
// modelo de datos que las 3 zonas (zonas.texto, zonas.cta, zonas.logo,
// burbuja, deco): lo que cambia es COMO se disponen, no que se guarda.
const LAYOUTS_MARCA = {
  "z-circulo": { nombre:"Círculo de oferta", sub:"cuando hay una cifra que manda", necesitaOferta:true },
  "z-corte":   { nombre:"Foto con corte circular", sub:"el producto o la persona vende", necesitaFoto:true },
  "z-bloque":  { nombre:"Bloque y foto", sub:"sobrio, sin curvas", necesitaFoto:true },
  "z-tipo":    { nombre:"Tipográfica", sub:"sin foto, manda el mensaje" }
};
// APAGADAS (15-ago-2026). Medido con Playwright sobre los 11 tamanos:
//   z-circulo → sin bajada 11/11 · sin boton 6/11 · >35% vacio 9/11 (160x600: 82%)
//   3 zonas   → sin bajada  0/11 · sin boton 0/11 · >35% vacio 0/11
// La bajada NO se dibuja en ninguna diagramacion de marca (no existe el elemento).
// Hasta que pasen la bateria de MEDICION (no solo "no revienta"), no se usan:
// cualquier pieza que traiga layout guardado cae sola al camino de 3 zonas.
const LAYOUTS_MARCA_ACTIVOS = false;
const esLayoutMarca = l => !!(LAYOUTS_MARCA_ACTIVOS && l && LAYOUTS_MARCA[l]);
// Cuanto detalle cabe segun el tamano real del banner. En 320x50 no entra una
// bajada por mucho que se encoja: se suprime, no se achica.
function detalleDe(W, H){
  const a = W*H;
  if(a < 34000)  return { bajada:false, legal:false, nota:false, pildora:false, cta:H>=60 };  // 320x50, 468x60, 200x200
  if(a < 90000)  return { bajada:false, legal:false, nota:false, pildora:true,  cta:true  };  // 250x250, 320x100
  if(a < 200000) return { bajada:true,  legal:false, nota:true,  pildora:true,  cta:true  };  // 300x250, 336x280
  return           { bajada:true,  legal:true,  nota:true,  pildora:true,  cta:true  };
}
function renderLayoutMarca(c, fmt, layout){
  const f = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const W=f.ancho, H=f.alto;
  const fam = familiaDeFormato(fmt), franja = fam==="franja", vert = fam==="vertical";
  const escF = franja ? Math.max(.5, H/110) : Math.max(.5, Math.min(W,H*1.35)/300);
  const px=(v,base)=>Math.round((parseFloat(v)||base)*escF);
  const D = detalleDe(W,H);
  const Z=c.zonas||{}, T=Z.texto||{}, ti=T.titular||{}, cu=T.cuerpo||{}, et=T.etiqueta||{}, cta=Z.cta||{}, lg=Z.logo||{};
  const fondo=c.fondo||{}, bu=c.burbuja||{};
  const bgColor = fondo.color || "#040764";
  const claro = !esColorOscuro(bgColor);
  const tinta = claro ? (ti.color && ti.color!=="#ffffff" ? ti.color : "#040764") : "#ffffff";
  const acento = cta.colorFondo || "#1C73CB";
  const hayFoto = fondo.tipo==="imagen" && fondo.imagen && fondo.imagen.url;
  const M = px(14,14);                              // margen del banner
  const cap = (s,n)=>String(s||"").trim();
  const esc2 = s=>escMultiline(cap(s));

  // ── piezas reutilizables ──
  const logoHTML = (pos)=>{
    if(!lg.url) return "";
    const h = px(lg.alto, 22);
    return `<div class="zl-logo" style="${pos}"><img src="${escAttr(lg.url)}" style="height:${h}px;max-width:${px(120,120)}px;"></div>`;
  };
  const pildora = ()=> (D.pildora && et.texto)
    ? `<span class="zl-pil" style="font-size:${px(et.tamano,10)}px;padding:${px(4,4)}px ${px(11,11)}px;background:${esc(et.color||acento)};color:${esc(et.colorTexto||"#fff")};">${esc(et.texto)}</span>` : "";
  const titular = (size)=> ti.texto
    ? `<div class="zl-tit" style="font-size:${px(ti.tamano,size||24)}px;color:${esc(tinta)};margin-top:${px(6,6)}px;">${esc2(ti.texto)}</div>` : "";
  const bajada = ()=> (D.bajada && cu.texto)
    ? `<div class="zl-baj" style="font-size:${px(cu.tamano,11)}px;color:${esc(tinta)};margin-top:${px(7,7)}px;opacity:.95;">${esc2(cu.texto)}</div>` : "";
  const boton = ()=> (D.cta && cta.texto)
    ? `<a class="zl-cta" href="${escAttr(cta.url||"#")}" target="_blank" rel="noopener" style="font-size:${px(cta.tamano,11)}px;padding:${px(8,8)}px ${px(16,16)}px;background:${esc(acento)};color:${esc(cta.colorTexto||"#fff")};margin-top:${px(11,11)}px;">${esc(cta.texto)}</a>` : "";
  const legal = ()=> (D.legal && c.legal)
    ? `<div class="zl-legal" style="left:${M}px;bottom:${px(9,9)}px;font-size:${px(8,8)}px;color:${esc(tinta)};">${esc(c.legal)}</div>` : "";
  const fotoEn = (estilo)=> hayFoto
    ? `<div class="zl-foto" style="${estilo}">${capaImagenHTML(fondo.imagen,"")}</div>` : "";
  // Circulo de oferta: reusa comp.burbuja (numero grande + unidad + resto)
  const circulo = (dia, pos)=>{
    const t = cap(bu.texto);
    if(!t) return "";
    const m = t.match(/^(\$?\d[\d.,]*%?)\s+(\S+)\s*([\s\S]*)$/);
    const col = bu.color || acento, colT = bu.colorTexto || "#ffffff";
    const inner = m
      ? `<div class="zl-of" style="gap:${px(4,4)}px;"><span class="n" style="font-size:${Math.round(dia*.30)}px">${esc(m[1])}</span><span class="u" style="font-size:${Math.round(dia*.16)}px">${esc(m[2])}</span></div>`
        + (m[3] ? `<div class="g" style="font-size:${Math.round(dia*.16)}px">${esc(m[3])}</div>` : "")
      : `<div class="g" style="font-size:${Math.round(dia*.13)}px;padding:0 ${Math.round(dia*.12)}px">${esc(t)}</div>`;
    const arriba = (D.nota && bu.arriba) ? `<div class="ar" style="font-size:${Math.round(dia*.085)}px">${esc(bu.arriba)}</div>` : "";
    return `<div class="zl-circ" style="width:${dia}px;height:${dia}px;background:${esc(col)};color:${esc(colT)};${pos}">${arriba}${inner}</div>`;
  };
  const deco = (c.deco && c.deco.visible===true) ? decoBurbujasHTML(c.deco, W, H) : "";
  const fondoPlano = hayFoto ? capaImagenHTML(fondo.imagen,"cmp-bg") + `<div class="cmp-scrim"></div>` : "";
  const envolver = (dentro, sinFondo)=>
    `<div class="cmp" style="width:${W}px;height:${H}px;background:${esc(bgColor)};">${sinFondo?"":fondoPlano}${deco}<div class="zl">${dentro}</div>${legal()}</div>`;

  // ══ FRANJA: todo en fila, para 728x90 y compania ══
  if(franja){
    const dia = Math.min(Math.round(H*1.25), Math.round(W*.22));
    const saleY = Math.round(dia*.13);
    const circ = (layout==="z-circulo") ? circulo(dia, `right:${Math.round(W*.19)}px;top:${-saleY}px;padding-top:${saleY}px;`) : "";
    return envolver(
      logoHTML(`left:${M}px;top:50%;transform:translateY(-50%);`) +
      `<div class="zl-col" style="left:${px(118,118)}px;top:50%;transform:translateY(-50%);flex-direction:row;align-items:center;gap:${px(12,12)}px;right:${circ ? Math.round(W*.19)+dia+px(10,10) : px(150,150)}px;">`
        + pildora()
        + (ti.texto?`<div class="zl-tit" style="font-size:${px(ti.tamano,20)}px;color:${esc(tinta)};">${esc(cap(ti.texto))}</div>`:"")
        + (D.bajada&&cu.texto?`<div class="zl-baj" style="font-size:${px(cu.tamano,10)}px;color:${esc(tinta)};">${esc(cap(cu.texto))}</div>`:"")
      + `</div>` + circ +
      (cta.texto?`<a class="zl-cta" href="${escAttr(cta.url||"#")}" target="_blank" rel="noopener" style="position:absolute;right:${M}px;top:50%;transform:translateY(-50%);z-index:7;font-size:${px(cta.tamano,11)}px;padding:${px(8,8)}px ${px(15,15)}px;background:${esc(acento)};color:${esc(cta.colorTexto||"#fff")};">${esc(cta.texto)}</a>`:"")
    );
  }

  // ══ Z-CIRCULO ══
  if(layout==="z-circulo"){
    const dia = vert ? Math.round(W*1.06) : Math.round(Math.min(W*.62, H*.78));
    const sale = vert ? Math.round(W*.05) : Math.round(dia*.15);
    const pos = vert ? `left:${-sale}px;top:${Math.round(H*.42)}px;padding-left:${sale}px;`
                     : `right:${-sale}px;top:${Math.round(H*.17)}px;padding-right:${sale}px;`;
    return envolver(
      logoHTML(`left:${M}px;top:${px(12,12)}px;`) +
      circulo(dia, pos) +
      `<div class="zl-col" style="left:${M}px;top:${px(46,46)}px;width:${vert?W-M*2:Math.max(px(90,90), (W-dia+sale)-M-px(8,8))}px;">`
        + pildora() + titular(vert?22:25) + bajada() + (vert?boton():"") + `</div>`
    );
  }

  // ══ Z-CORTE: foto con borde circular ══
  if(layout==="z-corte"){
    const ancho = vert ? W : Math.round(W*.48);
    const foto = vert
      ? fotoEn(`left:0;top:0;width:${W}px;height:${Math.round(H*.36)}px;`)
      : fotoEn(`right:0;top:0;width:${ancho}px;height:${H}px;border-top-left-radius:${ancho}px;border-bottom-left-radius:${ancho}px;`);
    const topTxt = vert ? Math.round(H*.40) : px(44,44);
    const banda = (c.banda && c.banda.texto)
      ? `<div class="zl-banda" style="top:${Math.round(H*.58)}px;height:${px(24,24)}px;padding:0 ${M}px;font-size:${px(13,13)}px;background:${esc(c.banda.color||acento)};color:#fff;">${esc(c.banda.texto)}</div>` : "";
    const precio = (c.precio && c.precio.valor)
      ? `<div class="zl-col" style="left:${M}px;top:${Math.round(H*.72)}px;width:${Math.round(W*.55)}px;">`
        + (c.precio.label?`<div class="zl-baj" style="font-size:${px(10,10)}px;color:${esc(tinta)};">${esc(c.precio.label)}</div>`:"")
        + `<div class="zl-out" style="font-size:${px(16,16)}px;padding:${px(4,4)}px ${px(13,13)}px;border-width:${Math.max(1,px(1.5,1.5))}px;border-color:${esc(tinta)};color:${esc(tinta)};margin-top:${px(4,4)}px;">${esc(c.precio.valor)}</div></div>` : "";
    return envolver(
      foto + logoHTML(`left:${M}px;top:${px(12,12)}px;`) +
      `<div class="zl-col" style="left:${M}px;top:${topTxt}px;width:${vert?W-M*2:Math.round(W*.48)}px;">`
        + pildora() + titular(21) + bajada() + `</div>`
      + banda + precio + (precio?"":`<div class="zl-col" style="left:${M}px;bottom:${px(14,14)}px;">${boton()}</div>`)
    , true);
  }

  // ══ Z-BLOQUE: dos rectangulos, sin curvas ══
  if(layout==="z-bloque"){
    const anchoB = vert ? W : Math.round(W*.60);
    const foto = vert
      ? fotoEn(`left:0;bottom:0;width:${W}px;height:${Math.round(H*.34)}px;`)
      : fotoEn(`right:0;top:0;width:${W-anchoB}px;height:${H}px;`);
    return envolver(
      foto +
      `<div class="zl-bloque" style="left:0;top:0;${vert?`right:0;height:${Math.round(H*.66)}px;`:`bottom:0;width:${anchoB}px;`}background:${esc(bgColor)};padding:${M}px;">`
        + `<div style="height:${px(26,26)}px"></div>` + pildora() + titular(22) + bajada() + boton() + `</div>`
      + logoHTML(`left:${M}px;top:${px(12,12)}px;`), true
    );
  }

  // ══ Z-TIPO: sin foto, manda el mensaje ══
  const centrado = (c.alinLayout==="center");
  return envolver(
    logoHTML(`left:${M}px;top:${px(12,12)}px;`) +
    `<div class="zl-col" style="left:${M}px;right:${M}px;top:${px(52,52)}px;${centrado?"align-items:center;text-align:center;":""}">`
      + pildora()
      + (ti.texto?`<div class="zl-tit" style="font-size:${px(ti.tamano,30)}px;color:${esc(tinta)};margin-top:${px(8,8)}px;">${esc2(ti.texto)}</div>`:"")
      + bajada() + boton() + `</div>`, true
  );
}
// ── PLAN DEL BANNER: QUÉ ENTRA Y CON QUÉ MEDIDAS ────────────────────────
// El manual no admite "encoger hasta que quepa": los cuerpos salen de la tabla
// cerrada (base × k, nunca bajo el piso de legibilidad) y, si el contenido no
// cabe, se QUITA el elemento menos importante en este orden:
//     Legal → Bajada → Adornos → Epígrafe
// Título, CTA y logo NUNCA se caen. Si no caben, ese formato no admite esa
// diagramación y hay que usar otra del catálogo.
// `nivel` = cuántos peldaños de la escalera se han bajado ya. El inspector puede
// pedir otro peldaño si midiendo el render real encuentra que sigue sin caber.
function planDeBanner(c, fmt, nivel){
  c = c || {};
  const g = geomDe(fmt);
  const Z=c.zonas||{}, T=Z.texto||{}, ti=T.titular||{}, cu=T.cuerpo||{},
        et=T.etiqueta||{}, cta=Z.cta||{}, lg=Z.logo||{}, bu=c.burbuja||{};
  const txt = {
    epigrafe: String(et.texto||"").trim(),
    titulo:   String(ti.texto||"").trim(),
    bajada:   String(cu.texto||"").trim(),
    cta:      String(cta.texto||"").trim(),
    legal:    String(c.legal||"").trim()
  };
  const hay = {
    logo:     !!lg.url && lg.visible!==false,
    epigrafe: !!txt.epigrafe && T.visible!==false,
    titulo:   !!txt.titulo   && T.visible!==false,
    bajada:   !!txt.bajada   && T.visible!==false,
    cta:      !!txt.cta      && cta.visible!==false,
    legal:    !!txt.legal,
    // El círculo de oferta SOLO existe si hay una cifra real. Un círculo vacío o
    // con una frase sin número es el error gráfico más visible del sistema.
    circulo:  bu.visible===true && tieneCifra(bu.texto) && g.circulo>0,
    adornos:  !!(c.deco && c.deco.visible===true)
  };
  // 1 · Lo que no cabe en este tamaño se cae solo (tabla del manual: la bajada y
  //     el epígrafe no van en un 468×60, el legal no va en un 160×600, los
  //     adornos se apagan en franjas y con lado corto ≤ 250).
  g.noVan.forEach(k => { if(k in hay) hay[k] = false; });
  // 2 · Peldaños de la escalera de caída, contando solo lo que de verdad hay
  //     (bajar un peldaño tiene que quitar algo, o no sirve de nada).
  const escalera = GEOM.caida.filter(k => hay[k]);
  const n = Math.max(0, Math.min(parseInt(nivel)||0, escalera.length));
  for(let i=0;i<n;i++) hay[escalera[i]] = false;
  // 3 · Medidas. El usuario mueve la base dentro de su rango; el formato escala.
  const cuerpo = {
    epigrafe: cuerpoDe(fmt,"epigrafe",et.tamano),
    titulo:   cuerpoDe(fmt,"titulo",ti.tamano),
    bajada:   cuerpoDe(fmt,"bajada",cu.tamano),
    cta:      cuerpoDe(fmt,"cta",cta.tamano),
    legal:    cuerpoDe(fmt,"legal",c.legalTamano)
  };
  const dia = hay.circulo ? diametroBurbuja(bu, fmt) : 0;
  // Sitio que el círculo le quita al bloque de texto: su diámetro menos lo que
  // sale por el borde, más el hueco de respeto (4 % del lado corto).
  const reserva = hay.circulo ? Math.max(0, dia - g.sale + g.hueco) : 0;
  const mg = c.margen||{};
  const margen = {
    t: Math.max(0, parseFloat(mg.t)>0 ? Math.round(parseFloat(mg.t)*g.k) : g.margen),
    r: Math.max(0, parseFloat(mg.r)>0 ? Math.round(parseFloat(mg.r)*g.k) : g.margen),
    b: Math.max(0, parseFloat(mg.b)>0 ? Math.round(parseFloat(mg.b)*g.k) : g.margen),
    l: Math.max(0, parseFloat(mg.l)>0 ? Math.round(parseFloat(mg.l)*g.k) : g.margen)
  };
  // El bloque de texto DESCUENTA el sitio del círculo de su ancho. Sin esta
  // reserva el círculo tapaba el titular y el botón en casi todos los tamaños.
  const reservaH = hay.circulo ? reserva : 0;
  const anchoTexto = Math.max(40, g.ancho - margen.l - margen.r - reservaH);
  // ANTES DE PARTIR UNA PALABRA, ENCOGER. Si la palabra más larga no cabe a lo
  // ancho de la columna, el navegador la corta por la mitad ("Auto protegid / o").
  // El manual prohíbe cortar la frase, así que el cuerpo baja —hasta el piso de
  // legibilidad, no más— hasta que la palabra entre. Con el círculo puesto, un
  // 200×200 deja 77 px de columna: el titular pasa de 18 a 16 px y se lee entero.
  const cabePalabra = (texto, fs) => {
    const larga = String(texto||"").split(/\s+/).reduce((a,w)=>Math.max(a,w.length),0);
    if(!larga) return fs;
    const necesita = Math.floor(anchoTexto/(larga*GEOM.emArial));
    return Math.max(g.piso, Math.min(fs, necesita));
  };
  cuerpo.titulo = cabePalabra(txt.titulo, cuerpo.titulo);
  cuerpo.bajada = cabePalabra(txt.bajada, cuerpo.bajada);
  // Máximo de caracteres con el ancho REAL de esta pieza (el de geomDe supone
  // círculo puesto en horizontal, que es el peor caso; este es el de verdad).
  const maxChars = {};
  const L = GEOM.lineas[g.familia];
  for(const p in cuerpo){
    let m = Math.max(4, Math.floor(anchoTexto/(cuerpo[p]*GEOM.emArial)) * L[p]);
    if(GEOM.topeChars[p]) m = Math.min(GEOM.topeChars[p], m);
    maxChars[p] = m;
  }
  // Palabra más larga que admite la columna: es el dato que la IA necesita para
  // no escribir un titular que no entre.
  maxChars.palabra = Math.max(3, Math.floor(anchoTexto/(cuerpo.titulo*GEOM.emArial)));
  return { fmt, g, hay, txt, cuerpo, dia, reserva, reservaH, margen, anchoTexto, maxChars,
           nivel:n, peldanos:escalera.length, logoAlto:altoLogo(lg, fmt) };
}
// Alto del logo: 8 % del lado corto, mínimo 14 px. Si el usuario dio un
// porcentaje propio (`altoPct`) se respeta acotado entre 4 % y 16 %; el viejo
// campo en píxeles (`alto`, que la app rellenaba con 48) se convierte a escala
// del formato y se acota igual — un logo de 48 px en un 200×200 se comía la pieza.
function altoLogo(lg, fmt){
  const g = geomDe(fmt);
  const lim = v => Math.max(GEOM.logoMin, Math.min(Math.round(g.corto*0.16), Math.round(v)));
  const pct = parseFloat(lg && lg.altoPct);
  if(pct && pct>=3 && pct<=20) return lim(g.corto*pct/100);
  const pxUsr = parseFloat(lg && lg.alto);
  if(pxUsr>0 && pxUsr!==48) return lim(Math.max(g.corto*0.04, pxUsr*g.k));
  return lim(g.corto*GEOM.logoPct/100);
}
// Alto (o ancho, en franjas) que ocupa el plan. Es una ESTIMACIÓN de vuelo
// previo: el juez de verdad es el inspector, que mide el render.
function ocupaDelPlan(P){
  const g = P.g, A = n => aireDe(P.fmt, n);
  // Cuenta líneas simulando el CORTE POR PALABRAS del navegador, no dividiendo
  // caracteres entre el ancho: "Auto protegido" en 8 caracteres por línea ocupa
  // TRES líneas (Auto / protegi / do), no dos. Contarlo mal hacía que el texto
  // se saliera de su zona en los formatos chicos (200×200).
  const lineas = (t, fs) => { if(!t) return 0;
    const porLinea = Math.max(4, Math.floor(P.anchoTexto/(fs*GEOM.emArial)));
    let total = 0;
    String(t).split("\n").forEach(parrafo => {
      let cur = 0, li = 1;
      parrafo.split(/\s+/).filter(Boolean).forEach(w => {
        const cabe = (cur ? cur+1 : 0) + w.length;
        if(cabe <= porLinea){ cur = cabe; }
        else if(w.length > porLinea){                 // palabra más larga que la línea
          if(cur) li++;
          li += Math.ceil(w.length/porLinea) - 1;
          cur = w.length % porLinea || porLinea;
        } else { li++; cur = w.length; }
      });
      total += li;
    });
    return total; };
  if(g.familia==="franja"){
    // En una franja el reparto es horizontal: lo que aprieta es el ancho.
    const anchoDe = (t,fs)=>Math.ceil(String(t||"").length*fs*GEOM.emArial);
    let w = 0;
    if(P.hay.logo) w += Math.round(P.logoAlto*2.6) + A("logoTexto");
    if(P.hay.epigrafe) w += anchoDe(P.txt.epigrafe,P.cuerpo.epigrafe) + Math.round(P.cuerpo.epigrafe*1.8) + A("epiTit");
    if(P.hay.titulo) w += anchoDe(P.txt.titulo,P.cuerpo.titulo);
    if(P.hay.bajada) w += A("titBaj") + anchoDe(P.txt.bajada,P.cuerpo.bajada);
    if(P.hay.cta) w += A("bajCta") + anchoDe(P.txt.cta,P.cuerpo.cta) + Math.round(P.cuerpo.cta*2.5);
    // La banda legal come alto: en una franja hay que comprobar que aún quepa el
    // titular por debajo de ella.
    if(P.hay.legal && (altoBandaLegal(P) + P.cuerpo.titulo*1.2 + P.margen.t) > g.alto)
      return { usa:g.ancho+1, cabe:g.ancho };
    return { usa:w + P.margen.l + P.margen.r + P.reserva, cabe:g.ancho };
  }
  let h = 0;
  if(P.hay.logo) h += P.logoAlto + A("logoTexto");
  if(P.hay.epigrafe) h += Math.round(P.cuerpo.epigrafe*1.0) + Math.round(P.cuerpo.epigrafe*0.7) + A("epiTit");
  if(P.hay.titulo) h += lineas(P.txt.titulo,P.cuerpo.titulo)*P.cuerpo.titulo*1.14;
  if(P.hay.bajada) h += A("titBaj") + lineas(P.txt.bajada,P.cuerpo.bajada)*P.cuerpo.bajada*1.32;
  if(P.hay.cta) h += A("bajCta") + P.cuerpo.cta*1.2 + Math.round(P.cuerpo.cta*0.55)*2;
  // La banda legal ya trae su propio aire interior: no se suma otra vez, o el
  // máster 300×250 perdía la bajada por 8 px.
  if(P.hay.legal) h += altoBandaLegal(P);
  return { usa:Math.round(h + P.margen.t + P.margen.b), cabe:g.alto };
}
// Baja peldaños hasta que el contenido quepa. Si se agotan y sigue sin caber, se
// devuelve el último plan marcado como `apretado` — el inspector lo avisará en
// pantalla en vez de entregar una pieza rota en silencio.
function planQueCabe(c, fmt, nivelMin){
  let P = planDeBanner(c, fmt, nivelMin||0);
  let o = ocupaDelPlan(P);
  while(o.usa > o.cabe && P.nivel < P.peldanos){
    P = planDeBanner(c, fmt, P.nivel+1);
    o = ocupaDelPlan(P);
  }
  P.apretado = o.usa > o.cabe;
  P.ocupa = o;
  return P;
}
// Renderiza la composición (3 zonas) a un tamaño concreto, con la geometría
// cerrada del manual. `nivelMin` fuerza peldaños de caída (lo usa el inspector
// cuando, midiendo el render, encuentra que aún no cabe).
function renderComposicion(comp, fmt, nivelMin){
  // Modelo LIBRE (elementos que crea el usuario). El de 3 zonas sigue vivo,
  // intacto, para las piezas que ya estaban guardadas.
  if(esLibre(comp)) return renderLibre(comp, fmt);
  // Estilo de marca: disposiciones cerradas. Si no hay layout de marca, sigue
  // el modelo de 3 zonas de siempre (las piezas existentes no cambian).
  if(comp && esLayoutMarca(comp.layout)) return renderLayoutMarca(comp, fmt, comp.layout);
  const f = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const W=f.ancho, H=f.alto, fila=(familiaDeFormato(fmt)==="franja");
  const c=comp||{}; const fondo=c.fondo||{}; const prop=(c.prop&&c.prop.length===3)?c.prop:[25,50,25];
  const P = planQueCabe(c, fmt, nivelMin);
  const g = P.g;
  const bu0 = c.burbuja||{};
  let Z=c.zonas||{};
  // Lo que el plan decidió QUITAR se quita de verdad del render.
  if(!P.hay.bajada || !P.hay.epigrafe){
    const T = Object.assign({}, Z.texto||{});
    if(!P.hay.bajada && T.cuerpo)   T.cuerpo   = Object.assign({}, T.cuerpo,   {texto:""});
    if(!P.hay.epigrafe && T.etiqueta) T.etiqueta = Object.assign({}, T.etiqueta, {texto:""});
    Z = Object.assign({}, Z, { texto:T });
  }
  const bgColor = fondo.color || "#040764";
  const esFoto = fondo.tipo==="imagen" && fondo.imagen && fondo.imagen.url;
  const fondoLayer = esFoto ? capaImagenHTML(fondo.imagen, "cmp-bg", true) : "";
  // Velo de legibilidad SOLO sobre foto (garantiza contraste del texto blanco).
  const scrim = esFoto ? `<div class="cmp-scrim"></div>` : "";
  // Google exige que el anuncio se distinga de la página: con fondo oscuro lo
  // hace el propio color, con fondo claro hace falta un borde de 1 px.
  const claro = !esFoto && !esColorOscuro(bgColor);
  const borde = claro ? `border:1px solid ${esc(colorTintaSobre(bgColor))};` : "";
  const zonaHTML=(zk,i)=>{
    const z=Object.assign({bg:"hereda",alinH:"left",alinV:"center",visible:true}, Z[zk]||{});
    const grow = (z.visible===false) ? 0 : Math.max(0,parseFloat(prop[i])||0);
    const bg = (z.bg==="color" && z.color) ? `<div class="cmp-zbg" style="background:${esc(z.color)};"></div>`
             : (z.bg==="imagen") ? capaImagenHTML(z.imagen, "cmp-zbg") : "";
    const inner = (z.visible===false) ? "" : zonaContenido(zk, z, P, c);
    // Una zona SIN contenido no debe reservar espacio: si no, deja un hueco
    // muerto (el logo vacío se comía el tercio superior de los verticales) y
    // el resto queda apelotonado. Sin contenido → no crece y no pone padding.
    const vacia = !String(inner||"").trim();
    // En FRANJA el reparto es horizontal y las zonas no crecen: el aire sobrante
    // se distribuye entre ellas (space-between). Si crecen, todo el hueco se
    // acumula en un solo sitio — un 970×90 dejaba un vacío del 33 %.
    const g2 = vacia ? 0 : (fila ? 0 : grow);
    // Espaciado del manual entre bloques: logo → primer texto 18, bajada → CTA 16.
    const sep = vacia ? 0 : (zk==="texto" && P.hay.logo) ? aireDe(fmt,"logoTexto")
              : (zk==="cta") ? aireDe(fmt,"bajCta") : 0;
    const pad = fila ? `padding:0 ${vacia?0:Math.round(sep/2)}px;` : `padding:${sep}px 0 0;`;
    const flexBase = fila ? `flex:0 1 auto;` : `flex:${g2} 1 0;`;
    return `<div class="cmp-zona" style="${flexBase}justify-content:${alinFlex(z.alinV)};align-items:${alinFlex(z.alinH)};${pad}">${bg}<div class="cmp-zin" style="align-items:${alinFlex(z.alinH)};text-align:${alinText(z.alinH)};">${inner}</div></div>`;
  };
  const zonas = ["logo","texto","cta"].map((zk,i)=>zonaHTML(zk,i)).join("");
  // DIAGRAMACIÓN C (verticales). El manual dice que en un vertical "manda el
  // ancho y el alto se REPARTE", pero repartirlo con pesos dejaba el hueco todo
  // junto: un 160×600 con 129 px de contenido en 600 px de alto salía con dos
  // tercios vacíos — el fallo que el propio manual denuncia. Cuando sobra mucho
  // alto, el aire se divide en huecos IGUALES (arriba, entre bloques y abajo):
  // ningún hueco pasa del 30 % y el banner se lee como una columna aireada, no
  // como tres islas. Con contenido suficiente vuelven a mandar las proporciones.
  const reparteAlto = !fila && g.familia==="vertical" && P.ocupa && P.ocupa.usa < g.alto*0.6;
  // RESERVA para el círculo de oferta: va posicionado encima de todo, así que el
  // contenido tiene que apartarse de su lado. Sin esto tapaba el titular
  // (300x250, 336x280, 1200x628) y el botón (728x90, 468x60).
  const buIzq = P.hay.circulo && ladoBurbuja(bu0)==="l";
  // La banda legal se descuenta del alto del contenido: espacio RESERVADO.
  const banda = altoBandaLegal(P);
  const rH = P.reservaH;
  const mpad=`${P.margen.t}px ${P.margen.r+(rH&&!buIzq?rH:0)}px ${P.margen.b+banda}px ${P.margen.l+(rH&&buIzq?rH:0)}px`;
  const deco = P.hay.adornos ? decoBurbujasHTML(c.deco, W, H) : "";
  const burbuja = P.hay.circulo ? burbujaHTML(bu0, fmt) : "";
  const legal = bandaLegalHTML(P, c, bgColor, esFoto);
  return `<div class="cmp" data-fmt="${escAttr(fmt)}" data-nivel="${P.nivel}"${P.apretado?' data-apretado="1"':''} style="width:${W}px;height:${H}px;background:${esc(bgColor)};${borde}">${fondoLayer}${scrim}${deco}<div class="cmp-zonas ${fila?'row':'col'}${reparteAlto?' reparte':''}" style="padding:${mpad};box-sizing:border-box;">${zonas}</div>${burbuja}${legal}</div>`;
}
