/* ══════════════════════════════════════════════════════════════════
   BANNERS · LIENZO LIBRE  ·  funciones/comun/banners/lienzo-libre.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: El modelo del usuario: elementos (texto, figura, logo) con ancla, arrastre, tamaño, escribir sobre el banner, panel, capas, guardar y REPLICAR a los demás tamaños con las proporciones por banda.
   QUIÉN LO USA: MOTOR COMPARTIDO de Display y Facebook.
   SECCIONES (en orden):
     1. Composición en capas (Diseño global de una colección)
     2. Modelo de 3 ZONAS (logo · texto · cta) con fondo de banner continuo
     3. PROPORCIONES POR FAMILIA (maquetas del usuario, 10-sep-2026)
     4. INTERACCIÓN DEL LIENZO LIBRE
     5. ESCRIBIR DIRECTAMENTE SOBRE EL BANNER
     6. PANEL DEL LIENZO LIBRE
     7. MUTADORES DEL LIENZO LIBRE
     8. GUARDADO EXPLÍCITO
     9. REPLICAR
     10. SELECCIÓN DE BANNERS para vista previa y exportación
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Tablero: TODOS los banners del set en el lienzo. El activo es editable; los
// demás son vista previa (clic para activarlos).
// ═══ Composición en capas (Diseño global de una colección) ═══════════════
function esComposicion(p){ return !!(p && p.esSet && p.composicion); }
// ── Modelo de 3 ZONAS (logo · texto · cta) con fondo de banner continuo ──
function imgDefComp(){ return { url:"", foco:"center", fit:"cover", zoom:100, oscurecer:40 }; }
// ══════════════════════════════════════════════════════════════════════════
// LIENZO LIBRE — el modelo del usuario (18-ago-2026)
// ══════════════════════════════════════════════════════════════════════════
// El banner deja de ser tres zonas con papeles fijos y pasa a ser una lista de
// ELEMENTOS que crea el usuario: cuadros de texto y figuras, tantos como
// quiera, más el logo y el fondo. Se mueven con el ratón y se redimensionan
// desde las puntas. El CTA no es un elemento aparte: es una figura con un texto
// encima y un enlace.
//
// CÓMO SOBREVIVE A "REPLICAR", que es lo único delicado del modelo:
// la posición NO se guarda en píxeles del 300×250, porque un 160×600 tiene otra
// forma y no hay escala que valga. Se guarda:
//   · el ANCLA: a qué esquina o borde pertenece el elemento;
//   · su DISTANCIA a ese ancla, en unidades base;
//   · su TAMAÑO, en unidades base.
// Al replicar, cada formato multiplica por su propio factor k y recoloca desde
// su ancla. Un logo anclado arriba-izquierda queda arriba-izquierda en los once,
// a la distancia proporcional. Lo que no cuadre lo marca el inspector.
const ANCLAS_LIBRE = [
  ["tl","Arriba izquierda"], ["tc","Arriba centro"], ["tr","Arriba derecha"],
  ["ml","Centro izquierda"], ["mc","Centro"],        ["mr","Centro derecha"],
  ["bl","Abajo izquierda"],  ["bc","Abajo centro"],  ["br","Abajo derecha"]
];
const FIGURAS_LIBRE = [["circulo","Círculo"],["cuadrado","Cuadrado"],["rect","Rectángulo"]];
const FILTROS_FONDO = [
  ["","Sin filtro"], ["oscurecer","Oscurecer"], ["aclarar","Aclarar"],
  ["gris","Blanco y negro"], ["marca","Tinte de marca"], ["desenfoque","Desenfoque"]
];

function libreDefault(tema){
  return {
    modo: "libre",
    fondo: { tipo:"color", color:(tema&&tema.bg)||"#ffffff",
             imagen:{ url:"", fit:"cover", foco:"center", zoom:100 },
             filtro:{ tipo:"", intensidad:40, color:"" } },
    elementos: []
  };
}
// Un elemento nuevo nace en el centro, con un tamaño cómodo para el máster.
function nuevoElementoLibre(tipo, extra){
  const base = { id:uid(), tipo, ancla:"mc", dx:0, dy:0, w:120, h:40, z:1, rot:0 };
  if(tipo==="texto") Object.assign(base, {
    texto:"Escribe aquí", fuente:"", tam:18, color:"#111111", alinH:"left", alinV:"top",
    negrita:false, italica:false, padT:0, padR:0, padB:0, padL:0, w:150, h:44,
    // Un cuadro de texto con FONDO y REDONDEO es un botón completo en UN solo
    // elemento. Antes hacía falta una figura + un texto encima: dos cosas que
    // arrastrar por separado, y que el reparto por bandas separaba al replicar.
    fondo:"", radio:0 });
  if(tipo==="figura") Object.assign(base, {
    forma:"rect", relleno:"#1c73cb", borde:"", bordeAncho:0, radio:0, w:120, h:40 });
  if(tipo==="logo") Object.assign(base, { url:"", w:90, h:32, ancla:"tl", dx:14, dy:14 });
  if(tipo==="boton"){
    base.tipo = "texto";
    Object.assign(base, { texto:"Cotiza aquí", fuente:"", tam:14, color:"#ffffff",
      alinH:"center", alinV:"center", negrita:true, italica:false,
      padT:6, padR:14, padB:6, padL:14, w:120, h:34,
      fondo:"#1c73cb", radio:0, link:"", rol:"cta" });
  }
  return Object.assign(base, extra||{});
}
// Dónde y de qué tamaño cae un elemento en un formato concreto.
function cajaLibre(el, fmt){
  const F = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const k = factorK(fmt);
  const W = F.ancho, H = F.alto;
  const w = Math.round((parseFloat(el.w)||10) * k);
  const h = Math.round((parseFloat(el.h)||10) * k);
  const dx = (parseFloat(el.dx)||0) * k;
  const dy = (parseFloat(el.dy)||0) * k;
  const a = String(el.ancla||"tl");
  const hz = a[1], vt = a[0];
  let left;
  if(hz==="l") left = dx;
  else if(hz==="r") left = W - dx - w;
  else left = W/2 + dx - w/2;
  let top;
  if(vt==="t") top = dy;
  else if(vt==="b") top = H - dy - h;
  else top = H/2 + dy - h/2;
  return { left:Math.round(left), top:Math.round(top), w, h, k };
}
// El camino inverso: el usuario suelta el elemento en un punto del banner y hay
// que guardar su ancla y su distancia. El ancla se elige por el TERCIO en que
// cae su centro, que es lo que hace que "esto va abajo a la derecha" se
// mantenga al replicar.
function anclarLibre(el, fmt, left, top){
  const F = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const k = factorK(fmt);
  const W = F.ancho, H = F.alto;
  const w = (parseFloat(el.w)||10) * k, h = (parseFloat(el.h)||10) * k;
  const cx = left + w/2, cy = top + h/2;
  const hz = cx < W/3 ? "l" : cx > W*2/3 ? "r" : "c";
  const vt = cy < H/3 ? "t" : cy > H*2/3 ? "b" : "m";
  let dx;
  if(hz==="l") dx = left;
  else if(hz==="r") dx = W - left - w;
  else dx = cx - W/2;
  let dy;
  if(vt==="t") dy = top;
  else if(vt==="b") dy = H - top - h;
  else dy = cy - H/2;
  return { ancla: vt+hz, dx: Math.round(dx/k), dy: Math.round(dy/k) };
}
// CSS del filtro de fondo. Va SOBRE la imagen, como pide el modelo.
function filtroFondoCSS(f){
  if(!f || !f.tipo) return "";
  const i = Math.max(0, Math.min(100, parseFloat(f.intensidad)||40));
  if(f.tipo==="oscurecer")  return `background:rgba(0,0,0,${i/100});`;
  if(f.tipo==="aclarar")    return `background:rgba(255,255,255,${i/100});`;
  if(f.tipo==="marca")      return `background:${esc(f.color||"#040764")};opacity:${i/100};`;
  return "";
}
function filtroImagenCSS(f){
  if(!f || !f.tipo) return "";
  const i = Math.max(0, Math.min(100, parseFloat(f.intensidad)||40));
  if(f.tipo==="gris")        return `filter:grayscale(${i}%);`;
  if(f.tipo==="desenfoque")  return `filter:blur(${(i/100*6).toFixed(1)}px);`;
  return "";
}
// Dibuja un banner del modelo libre en un formato dado.
function renderLibre(comp, fmt){
  const F = FORMATOS[fmt] || FORMATOS["display-300x250"];
  const k = factorK(fmt);
  const fo = comp.fondo || {};
  const esFoto = (fo.tipo==="imagen") && fo.imagen && fo.imagen.url;
  let fondo = "";
  if(esFoto){
    const im = fo.imagen;
    fondo = `<div class="lb-bg" style="background-image:url('${escAttr(im.url)}');background-size:${im.fit==="contain"?"contain":"cover"};`
          + `background-position:${esc(im.foco||"center")};background-repeat:no-repeat;`
          + `${parseFloat(im.zoom)&&parseFloat(im.zoom)!==100?`background-size:${parseFloat(im.zoom)}%;`:""}`
          + `${filtroImagenCSS(fo.filtro)}"></div>`
          + (filtroFondoCSS(fo.filtro) ? `<div class="lb-veil" style="${filtroFondoCSS(fo.filtro)}"></div>` : "");
  }
  const els = (comp.elementos||[]).slice().sort((a,b)=>(a.z||0)-(b.z||0)).map(el=>{
    const c = cajaLibre(el, fmt);
    const pos = `left:${c.left}px;top:${c.top}px;width:${c.w}px;height:${c.h}px;`;
    // Un elemento con enlace sale como <a> — así el banner exportado es
    // clicable de verdad. En el editor no navega (se anula el clic).
    const lk = String(el.link||"").trim();
    const et = lk ? "a" : "div";
    const at = lk ? ` href="${escAttr(lk)}"${el.nuevaVentana===false?"":' target="_blank" rel="noopener"'}` : "";
    if(el.tipo==="logo"){
      if(!el.url) return "";
      return `<${et} class="lb-el lb-logo" data-el="${esc(el.id)}"${at} style="${pos}">`
           + `<img draggable="false" src="${escAttr(el.url)}" style="width:100%;height:100%;object-fit:contain;object-position:center;"></${et}>`;
    }
    if(el.tipo==="figura"){
      const r = el.forma==="circulo" ? "50%" : Math.round((parseFloat(el.radio)||0)*k)+"px";
      const bw = Math.round((parseFloat(el.bordeAncho)||0)*k);
      const bd = (bw && el.borde) ? `border:${bw}px solid ${esc(el.borde)};` : "";
      return `<${et} class="lb-el lb-fig" data-el="${esc(el.id)}"${at} style="${pos}background:${esc(el.relleno||"transparent")};border-radius:${r};${bd}"></${et}>`;
    }
    // Texto
    const fam = el.fuente ? `font-family:'${esc(el.fuente)}',Arial,sans-serif;` : "";
    const pad = `padding:${Math.round((parseFloat(el.padT)||0)*k)}px ${Math.round((parseFloat(el.padR)||0)*k)}px `
              + `${Math.round((parseFloat(el.padB)||0)*k)}px ${Math.round((parseFloat(el.padL)||0)*k)}px;`;
    const just = el.alinV==="center" ? "center" : el.alinV==="bottom" ? "flex-end" : "flex-start";
    const bgTxt = el.fondo ? `background:${esc(el.fondo)};` : "";
    const rTxt  = parseFloat(el.radio) ? `border-radius:${Math.round(parseFloat(el.radio)*k)}px;` : "";
    return `<${et} class="lb-el lb-txt" data-el="${esc(el.id)}"${at} style="${pos}${pad}${bgTxt}${rTxt}display:flex;flex-direction:column;justify-content:${just};`
         + `font-size:${Math.round((parseFloat(el.tam)||14)*k)}px;color:${esc(el.color||"#111")};text-align:${alinText(el.alinH)};`
         + `${fam}${el.negrita?"font-weight:700;":""}${el.italica?"font-style:italic;":""}line-height:1.22;text-decoration:none;">`
         + `<div class="lb-txt-in">${escMultiline(el.texto||"")}</div></${et}>`;
  }).join("");
  const bgCol = (!esFoto && fo.color) ? `background:${esc(fo.color)};` : (!esFoto ? "background:#ffffff;" : "");
  const borde = (!esFoto && fo.color && !esColorOscuro(fo.color)) ? "box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);" : "";
  return `<div class="cmp cmp-libre" data-fmt="${esc(fmt)}" style="width:${F.ancho}px;height:${F.alto}px;${bgCol}${borde}">${fondo}${els}</div>`;
}
function esLibre(c){ return !!(c && c.modo === "libre"); }
// ── PROPORCIONES POR FAMILIA (maquetas del usuario, 10-sep-2026) ────────
// El usuario entregó dos maquetas medidas con los repartos que usa de verdad.
// Son la razón por la que los HORIZONTALES y los LATERALES salían mal: un
// diseño pensado para un cuadrado, escalado a una franja de 728×90, deja el
// logo, la promoción y el botón donde no corresponde. Aquí están sus números,
// literales:
//
//   FRANJA (horizontal) — reparto en COLUMNAS
//     25 % logo · 50 % promoción · 25 % CTA
//     dentro del 50 % del medio: 40 % promoción + 10 % legal (abajo)
//
//   VERTICAL (lateral) — reparto APILADO
//     20 % logo · 50 % promoción · 20 % CTA · 10 % legal
//
// Y su nota, que manda: «Legal es relativo, no siempre está». Cuando no hay
// legal, su porcentaje se reparte entre las demás bandas en vez de dejar un
// hueco muerto.
const PROPORCIONES_BANNER = {
  franja:   { dir:"row", logo:25, promo:50, cta:25, legal:10 },   // legal dentro del bloque de promoción
  vertical: { dir:"col", logo:20, promo:50, cta:20, legal:10 },
  // Cuadrados y grandes: el usuario no dio maqueta; se mantiene el reparto
  // apilado de siempre, que sí funcionaba.
  cuadrado: { dir:"col", logo:25, promo:50, cta:25, legal:10 },
  grande:   { dir:"col", logo:25, promo:50, cta:25, legal:10 }
};
// Las cuatro bandas de un formato, ya resueltas en fracciones 0..1 del lado que
// corresponda. `conLegal` decide si la banda legal existe.
function bandasDe(fmt, conLegal){
  const fam = familiaGeom(fmt);
  const P = PROPORCIONES_BANNER[fam] || PROPORCIONES_BANNER.cuadrado;
  const legal = conLegal ? P.legal : 0;
  if(P.dir === "row"){
    // Columnas: logo | promoción | CTA. El legal va DENTRO de la del medio,
    // pegado abajo, ocupando su parte del alto.
    const total = P.logo + P.promo + P.cta;
    const l = P.logo/total, m = P.promo/total, c = P.cta/total;
    const altoLegal = legal ? (legal / P.promo) : 0;   // del alto de la banda del medio
    return { dir:"row", conLegal:!!legal,
      logo:  { x:0,     y:0, w:l, h:1 },
      promo: { x:l,     y:0, w:m, h:1-altoLegal },
      legal: legal ? { x:l, y:1-altoLegal, w:m, h:altoLegal } : null,
      cta:   { x:l+m,   y:0, w:c, h:1 } };
  }
  // Apilado: logo · promoción · CTA · legal. Sin legal, su 10 % se reparte.
  const total = P.logo + P.promo + P.cta + legal;
  const a = P.logo/total, b = P.promo/total, c = P.cta/total, d = legal/total;
  return { dir:"col", conLegal:!!legal,
    logo:  { x:0, y:0,       w:1, h:a },
    promo: { x:0, y:a,       w:1, h:b },
    cta:   { x:0, y:a+b,     w:1, h:c },
    legal: legal ? { x:0, y:a+b+c, w:1, h:d } : null };
}
// Cuántas líneas ocupa un texto en una caja de ancho dado. Es una estimación
// (ancho medio de carácter ≈ 0,54 del cuerpo, el mismo modelo que usa
// `limitesParaIA`), pero al alza: más vale sobrar caja que cortar el texto.
function lineasDe(texto, anchoCaja, cuerpo){
  const t = String(texto || "");
  const c = Math.max(1, parseFloat(cuerpo) || 10);
  const cabenPorLinea = Math.max(1, Math.floor(Math.max(1, anchoCaja) / (c * 0.54)));
  let n = 0;
  t.split(/\n/).forEach(linea => { n += Math.max(1, Math.ceil(linea.length / cabenPorLinea)); });
  return Math.max(1, n);
}
// REACOMODO POR BANDAS. Es el arreglo de los horizontales y los laterales:
// en vez de escalar el diseño del máster (que en una franja de 728×90 deja el
// logo enorme y el botón fuera de sitio), cada elemento se COLOCA en la banda
// que le toca por su papel, centrado y ajustado a esa banda sin deformarse.
// Devuelve la posición ya en unidades base del formato destino.
function acomodarEnBanda(el, fmt, banda){
  const F = FORMATOS[fmt]; const k = factorK(fmt);
  const W = F.ancho / k, H = F.alto / k;      // el marco, en unidades base
  // MARGEN POR EJE Y ACOTADO A LA BANDA. Un margen calculado sobre el marco
  // entero se comía enteras las bandas finas — la del legal en una franja mide
  // 22 unidades y el margen valía 13 por lado — y el elemento «no cabía» y caía.
  const mx = Math.min(Math.max(3, Math.round(W * 0.045)), banda.w * W * 0.15);
  const my = Math.min(Math.max(3, Math.round(H * 0.045)), banda.h * H * 0.15);
  const bx = banda.x * W + mx, by = banda.y * H + my;
  const bw = Math.max(8, banda.w * W - mx*2), bh = Math.max(6, banda.h * H - my*2);
  const w0 = Math.max(1, parseFloat(el.w) || 10), h0 = Math.max(1, parseFloat(el.h) || 10);
  // EL DISEÑO NO SE AGRANDA. Las unidades base ya escalan solas con la k del
  // formato (por eso un sello de 10 unidades queda a 10 px en 300×250 y a 40 en
  // 1200×1200). El reparto solo COLOCA cada elemento en su banda y lo encoge lo
  // justo si ahí no cabe; agrandarlo deformaba el diseño que el usuario hizo.
  const escala = Math.min(1, bw / w0, bh / h0);
  const w = Math.max(6, Math.round(w0 * escala));
  let   h = Math.max(4, Math.round(h0 * escala));
  // La letra encoge con la caja, pero nunca por debajo del piso de legibilidad.
  let tam = parseFloat(el.tam);
  let oculto = false;
  let wFin = w;
  if(el.tipo === "texto" && !isNaN(tam)){
    tam = Math.max(1, Math.round(tam * escala));
    const piso = Math.max(1, Math.ceil(pisoDe(fmt) / k));   // en unidades base
    if(tam < piso) tam = piso;
    // CUENTA LAS LÍNEAS QUE EL TEXTO PARTE SOLO. Contar solo los saltos escritos
    // daba una caja de una línea para un titular que ocupaba tres: el texto se
    // cortaba en silencio en los once tamaños.
    // El MARGEN INTERNO del cuadro cuenta: el texto vive dentro de él, no en el
    // borde. Sin sumarlo, la burbuja de oferta se cortaba por dos píxeles.
    const pv = (parseFloat(el.padT)||0) + (parseFloat(el.padB)||0);
    const ph = (parseFloat(el.padL)||0) + (parseFloat(el.padR)||0);
    const alto = (anchoCaja, cuerpo) =>
      Math.ceil(cuerpo * 1.35 * lineasDe(el.texto, Math.max(4, anchoCaja - ph), cuerpo)) + pv;
    // 1) Si no cabe, se ENSANCHA hasta el ancho de su banda (menos líneas).
    if(alto(wFin, tam) > Math.min(bh, h) && wFin < bw) wFin = Math.round(bw);
    // 2) Si sigue sin caber en la banda, se ENCOGE la letra hasta el piso —
    //    la regla del manual: encoger antes de partir o de dejar caer.
    while(alto(wFin, tam) > bh && tam > piso) tam--;
    const necesita = alto(wFin, tam);
    // 3) Si ni al piso cabe, el elemento CAE en ese formato en vez de salir
    //    ilegible o recortado. Es lo que el usuario dijo del legal: «es
    //    relativo, no siempre está».
    if(necesita > bh) oculto = true;
    else if(necesita > h) h = necesita;             // que su propia caja no lo corte
  }
  return posFinal(wFin, h, tam, oculto);

  // Centrado en su banda, guardado con ancla para que siga comportándose bien
  // si después lo retocas a mano.
  function posFinal(ww, hh, tt, oc){
    const l = bx + (bw - ww)/2, t = by + (bh - hh)/2;
    const prov = anclarLibre({ w:ww, h:hh }, fmt, l * k, t * k);
    const out = { w:ww, h:hh, ancla:prov.ancla, dx:prov.dx, dy:prov.dy };
    if(!isNaN(tt)) out.tam = tt;
    if(oc) out.oculto = true;
    return out;
  }
}
// PRIORIDAD de un elemento dentro de su banda: 1 manda y nunca cae. Si no está
// puesta a mano, se deduce — dentro de la promoción, el texto MÁS GRANDE es el
// titular, y por debajo van bajada, epígrafe y adornos. Es la escalera de caída
// del manual, aplicada al modelo del usuario.
function prioLibre(el){
  const n = parseFloat(el && el.prio);
  if(!isNaN(n) && n > 0) return n;
  if(!el) return 3;
  if(el.tipo === "logo") return 1;
  return 2;
}
// Coloca TODOS los elementos de la pieza en las bandas del formato dado.
function acomodarPieza(p, fmt){
  const c = p.composicion; if(!esLibre(c)) return null;
  const els = c.elementos || [];
  const hayLegal = els.some(e => rolLibre(e) === "legal");
  const B = bandasDe(fmt, hayLegal);
  const pos = {};
  const porRol = { logo:[], promo:[], cta:[], legal:[] };
  els.forEach(e => { (porRol[rolLibre(e)] || porRol.promo).push(e); });
  Object.keys(porRol).forEach(rol => {
    const banda = B[rol] || B.promo;
    if(!porRol[rol].length || !banda) return;
    // Por importancia: primero lo que manda; a igual prioridad, el texto más
    // grande antes (dentro de la promoción, ese es el titular).
    const orden = porRol[rol].slice().sort((a,b)=>
      (prioLibre(a) - prioLibre(b)) || ((parseFloat(b.tam)||0) - (parseFloat(a.tam)||0)));
    // Si algo no cabe legible, NO se encoge a todos: cae el MENOS importante y
    // la banda se reparte de nuevo entre los que quedan. Sin esto, en una franja
    // de 728×90 el titular se quedaba con un cuarto de banda por culpa de un
    // epígrafe que igual no cabía.
    let vivos = orden.slice();
    const caidos = [];
    for(let vuelta = 0; vuelta < orden.length; vuelta++){
      const calc = repartir(vivos);
      const sobra = vivos.length > 1;                    // el último nunca se toca
      const iMalo = calc.findIndex(q => q && q.oculto);
      if(iMalo < 0 || !sobra){
        // Logo, promoción y botón NUNCA caen del todo: si al último que queda
        // no le alcanza, sale igual (y el inspector lo dirá). Solo el legal
        // puede desaparecer, que es lo que dijo el usuario.
        calc.forEach((q,i)=>{ if(q && q.oculto && rol !== "legal") delete q.oculto; pos[vivos[i].id] = q; });
        break;
      }
      // Cae el menos importante de los que no caben (el más al final del orden).
      let fuera = -1;
      for(let i = vivos.length - 1; i >= 0; i--) if(calc[i] && calc[i].oculto){ fuera = i; break; }
      if(fuera < 0){ calc.forEach((q,i)=>{ pos[vivos[i].id] = q; }); break; }
      caidos.push(vivos[fuera]); vivos = vivos.filter((_,i)=>i!==fuera);
    }
    caidos.forEach(e => { pos[e.id] = Object.assign(acomodarEnBanda(e, fmt, banda), { oculto:true }); });

    // Reparte la banda entre los que quedan, dando más sitio a lo importante.
    function repartir(lista){
      const n = lista.length;
      const pesos = lista.map(e => { const pr = prioLibre(e); return pr <= 1 ? 3 : pr <= 2 ? 2 : 1; });
      const total = pesos.reduce((a,b)=>a+b, 0) || 1;
      let acum = 0;
      return lista.map((e, i) => {
        const ini = acum / total, frac = pesos[i] / total; acum += pesos[i];
        const apila = (B.dir === "row" && rol === "promo") || B.dir === "col";
        const sub = apila
          ? { x:banda.x, y:banda.y + banda.h*ini, w:banda.w, h:banda.h*frac }
          : { x:banda.x + banda.w*ini, y:banda.y, w:banda.w*frac, h:banda.h };
        return acomodarEnBanda(e, fmt, n === 1 ? banda : sub);
      });
    }
  });
  return pos;
}
// Qué PAPEL cumple un elemento. El usuario puede fijarlo a mano (`rol`); si no,
// se deduce: el logo es logo, lo que lleva enlace es el botón, y un texto
// marcado como legal es el legal. Todo lo demás es promoción.
function rolLibre(el){
  if(!el) return "promo";
  if(el.rol) return el.rol;
  if(el.tipo === "logo") return "logo";
  if(el.esLegal) return "legal";
  if(String(el.link || "").trim()) return "cta";
  return "promo";
}
const ROLES_LIBRE = [["","Automático"],["logo","Logo"],["promo","Promoción"],["cta","Botón (CTA)"],["legal","Legal"]];

// Inspección del lienzo libre: desborde, legibilidad y contraste. Ni "completa"
// ni "colisión" ni "aire" aplican aquí — el usuario decide qué pone y dónde.
function inspeccionarLibre(cmp){
  const fallos = [];
  const R = cmp.getBoundingClientRect();
  const W = R.width, H = R.height, T = 1.5;
  const fmt = cmp.dataset.fmt || "display-300x250";
  const piso = (typeof GEOM!=="undefined" && GEOM.piso) ? pisoDe(fmt) : 9;
  [...cmp.querySelectorAll(".lb-el")].forEach(el=>{
    const r = el.getBoundingClientRect();
    const x = r.left-R.left, y = r.top-R.top;
    const nom = el.classList.contains("lb-txt") ? "Un texto"
              : el.classList.contains("lb-logo") ? "El logo" : "Una figura";
    if(x < -T || y < -T || x+r.width > W+T || y+r.height > H+T)
      fallos.push({ id:"desborde", que:`${nom} se sale del marco`,
                    detalle:`${Math.round(x)},${Math.round(y)} ${Math.round(r.width)}×${Math.round(r.height)} en ${Math.round(W)}×${Math.round(H)}` });
    if(el.classList.contains("lb-txt")){
      const px = parseFloat(getComputedStyle(el).fontSize)||0;
      if(px && px < piso)
        fallos.push({ id:"legibilidad", que:`Un texto queda en ${px.toFixed(1)} px`,
                      detalle:`por debajo del piso de ${piso} px para este tamaño` });
      if(el.scrollHeight > el.clientHeight+1 || el.scrollWidth > el.clientWidth+1)
        fallos.push({ id:"cortado", que:"Un texto no cabe en su cuadro",
                      detalle:`${el.scrollWidth}×${el.scrollHeight} en ${el.clientWidth}×${el.clientHeight}` });
    }
  });
  return { ok: fallos.length===0, fallos };
}
// Piso de legibilidad del formato (la misma tabla del manual).
function pisoDe(fmt){
  const F = FORMATOS[fmt]; if(!F) return 9;
  return Math.min(F.ancho, F.alto) <= 250 ? 9 : 11;
}
// ── INTERACCIÓN DEL LIENZO LIBRE ────────────────────────────────────────
// Un solo gesto para todo: se agarra el elemento y se mueve; se agarra una
// PUNTA y se redimensiona en proporción. Nada de tiradores escondidos.
let elLibreSel = null;                 // id del elemento seleccionado
const PUNTAS = ["tl","tr","bl","br"];

function elLibre(p, id){ const c = compDe(p); return (c.elementos||[]).find(e=>e.id===id) || null; }
function compDe(p){ return p && p.composicion; }

function attachLibre(p, root){
  const wrap = root.querySelector(".lienzo"); if(!wrap) return;
  const fmt = wrap.dataset.fmt;
  const stage = wrap.querySelector(".lienzo-stage");
  const ovl = wrap.querySelector(".lienzo-ovl");
  const cmp = wrap.querySelector(".cmp-libre");
  if(!stage || !ovl || !cmp) return;
  ovl.innerHTML = "";
  const sL = parseFloat(wrap.dataset.escala) || 1;
  const k  = factorK(fmt) * sL;                 // px de pantalla por unidad base
  const F  = FORMATOS[fmt];
  const sr = stage.getBoundingClientRect();

  // Clic en el fondo: deselecciona.
  cmp.addEventListener("pointerdown",(e)=>{
    if(e.target.closest(".lb-el")) return;
    elLibreSel = null; pintarSelLibre(); renderPanelLibre();
  });

  (cmp.querySelectorAll(".lb-el")||[]).forEach(el=>{
    const id = el.dataset.el;
    const dato = elLibre(p, id); if(!dato) return;
    el.style.cursor = "grab";
    // Un elemento con enlace es un <a>: en el editor no debe navegar.
    if(el.tagName === "A") el.addEventListener("click", e=>e.preventDefault());
    el.addEventListener("pointerdown",(e)=>{
      if(e.button!==0) return;
      if(el.isContentEditable) return;          // ya se está escribiendo dentro
      e.preventDefault(); e.stopPropagation();
      // ESCRIBIR EN EL BANNER: clic en un texto que YA estaba seleccionado
      // entra a editarlo, como en cualquier herramienta de diseño. El primer
      // clic selecciona (y permite arrastrar), el segundo escribe.
      const yaEstaba = (elLibreSel === id);
      elLibreSel = id; pintarSelLibre(); renderPanelLibre();
      if(yaEstaba && dato.tipo === "texto"){
        return editarTextoLibre(el, dato, { fmt, stage, ovl, cmp, sL, k, F, pintarSel:pintarSelLibre });
      }
      arrastrarLibre(e, el, dato, { fmt, stage, ovl, cmp, sL, k, F });
    });
    // El doble clic entra siempre, aunque no estuviera seleccionado.
    if(dato.tipo === "texto") el.addEventListener("dblclick",(e)=>{
      e.preventDefault(); e.stopPropagation();
      elLibreSel = id; pintarSelLibre();
      editarTextoLibre(el, dato, { fmt, stage, ovl, cmp, sL, k, F, pintarSel:pintarSelLibre });
    });
  });

  pintarSelLibre();

  // Marco de selección con las cuatro puntas, sobre el elemento elegido.
  function pintarSelLibre(){
    ovl.querySelectorAll(".lb-sel").forEach(n=>n.remove());
    if(!elLibreSel) return;
    const el = cmp.querySelector(`.lb-el[data-el="${elLibreSel}"]`);
    const dato = elLibre(p, elLibreSel);
    if(!el || !dato) return;
    const r = el.getBoundingClientRect();
    const s2 = stage.getBoundingClientRect();
    const caja = document.createElement("div");
    caja.className = "lb-sel";
    caja.style.cssText = `left:${r.left-s2.left}px;top:${r.top-s2.top}px;width:${r.width}px;height:${r.height}px;`;
    PUNTAS.forEach(q=>{
      const h = document.createElement("div");
      h.className = "lb-punta " + q;
      h.title = "Arrastra para agrandar o achicar";
      h.addEventListener("pointerdown",(ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        redimensionarLibre(ev, el, dato, q, { fmt, stage, ovl, cmp, sL, k, F });
      });
      caja.appendChild(h);
    });
    ovl.appendChild(caja);
  }
  wrap._pintarSel = pintarSelLibre;
}

// Mover: en vivo con transform, y al soltar se guarda ANCLA + distancia.
function arrastrarLibre(e0, el, dato, ctx){
  const { fmt, stage, ovl, cmp, sL, k, F } = ctx;
  const s2 = stage.getBoundingClientRect();
  const r0 = el.getBoundingClientRect();
  const x0 = e0.clientX, y0 = e0.clientY;
  const left0 = r0.left - s2.left, top0 = r0.top - s2.top;
  let dx=0, dy=0, raf=null, movido=false;
  const guias = [];
  const limpiarGuias = ()=>{ while(guias.length) guias.pop().remove(); };
  const pintar = ()=>{ raf=null; el.style.transform = `translate(${dx/sL}px,${dy/sL}px)`;
    const sel = ovl.querySelector(".lb-sel"); if(sel) sel.style.transform = `translate(${dx}px,${dy}px)`; };
  const mover = (ev)=>{
    let ddx = ev.clientX-x0, ddy = ev.clientY-y0;
    if(!movido && Math.abs(ddx)<3 && Math.abs(ddy)<3) return;
    movido = true; document.body.classList.add("sbb-arrastrando");
    // Acotado al banner: nada se puede sacar fuera del marco.
    const anchoS = s2.width, altoS = s2.height;
    ddx = Math.max(-left0, Math.min(anchoS - left0 - r0.width, ddx));
    ddy = Math.max(-top0,  Math.min(altoS  - top0  - r0.height, ddy));
    // Imantado a los bordes y al centro del banner, con guía visible.
    limpiarGuias();
    const izq = left0+ddx, der = left0+ddx+r0.width, cx = izq + r0.width/2;
    const arr = top0+ddy,  aba = top0+ddy+r0.height, cy = arr + r0.height/2;
    const M = 8*sL;
    const pegar = (val, destino)=> Math.abs(val-destino) < M;
    if(pegar(izq,0)) { ddx = -left0; guias.push(guiaLibre(ovl,"v",0)); }
    else if(pegar(der,anchoS)) { ddx = anchoS-left0-r0.width; guias.push(guiaLibre(ovl,"v",anchoS-1)); }
    else if(pegar(cx,anchoS/2)) { ddx = anchoS/2 - r0.width/2 - left0; guias.push(guiaLibre(ovl,"v",anchoS/2)); }
    if(pegar(arr,0)) { ddy = -top0; guias.push(guiaLibre(ovl,"h",0)); }
    else if(pegar(aba,altoS)) { ddy = altoS-top0-r0.height; guias.push(guiaLibre(ovl,"h",altoS-1)); }
    else if(pegar(cy,altoS/2)) { ddy = altoS/2 - r0.height/2 - top0; guias.push(guiaLibre(ovl,"h",altoS/2)); }
    dx=ddx; dy=ddy;
    if(!raf) raf = requestAnimationFrame(pintar);
  };
  const soltar = ()=>{
    window.removeEventListener("pointermove",mover); window.removeEventListener("pointerup",soltar);
    if(raf) cancelAnimationFrame(raf);
    limpiarGuias(); document.body.classList.remove("sbb-arrastrando");
    el.style.transform = "";
    const sel = ovl.querySelector(".lb-sel"); if(sel) sel.style.transform = "";
    if(!movido) return;
    // Del punto de pantalla a la posición del banner, y de ahí a ancla+distancia.
    const escala = (F.ancho / s2.width);
    const nuevoLeft = (left0 + dx) * escala;
    const nuevoTop  = (top0  + dy) * escala;
    Object.assign(dato, anclarLibre(dato, fmt, nuevoLeft, nuevoTop));
    fijarPosLibre(fmt, dato);      // en un tamaño que no es el máster, queda suyo
    persistir(); renderTablero(); renderPanelLibre();
  };
  window.addEventListener("pointermove",mover); window.addEventListener("pointerup",soltar);
}

// Redimensionar desde una punta, EN PROPORCIÓN (como pide el modelo).
function redimensionarLibre(e0, el, dato, punta, ctx){
  const { fmt, stage, ovl, cmp, sL, k, F } = ctx;
  const s2 = stage.getBoundingClientRect();
  const r0 = el.getBoundingClientRect();
  const x0 = e0.clientX, y0 = e0.clientY;
  const left0 = r0.left - s2.left, top0 = r0.top - s2.top;
  const w0 = parseFloat(dato.w)||10, h0 = parseFloat(dato.h)||10;
  const prop = h0 / w0;
  let w=w0, h=h0, nl=left0, nt=top0, raf=null;
  const escala = (F.ancho / s2.width);
  const pintar = ()=>{ raf=null;
    el.style.width=(w*factorK(fmt))+"px"; el.style.height=(h*factorK(fmt))+"px";
    el.style.left=(nl*escala)+"px"; el.style.top=(nt*escala)+"px";
    const sel=ovl.querySelector(".lb-sel");
    if(sel){ const rr=el.getBoundingClientRect();
      sel.style.left=(rr.left-s2.left)+"px"; sel.style.top=(rr.top-s2.top)+"px";
      sel.style.width=rr.width+"px"; sel.style.height=rr.height+"px"; }
  };
  const mover=(ev)=>{
    const ddx = ev.clientX-x0, ddy = ev.clientY-y0;
    // La punta que arrastras decide el signo; la proporción se conserva.
    const signo = (punta==="br") ? 1 : (punta==="tl") ? -1 : (punta==="tr") ? 1 : -1;
    const deltaU = ((punta==="tr"||punta==="br") ? ddx : -ddx) * escala;
    w = Math.max(8, Math.round(w0 + deltaU));
    h = Math.max(8, Math.round(w * prop));
    // Las puntas de la izquierda y de arriba mueven el origen.
    const wPx = w*factorK(fmt)/escala, hPx = h*factorK(fmt)/escala;
    nl = (punta==="tl"||punta==="bl") ? left0 + (r0.width - wPx) : left0;
    nt = (punta==="tl"||punta==="tr") ? top0  + (r0.height - hPx) : top0;
    if(!raf) raf = requestAnimationFrame(pintar);
  };
  const soltar=()=>{
    window.removeEventListener("pointermove",mover); window.removeEventListener("pointerup",soltar);
    if(raf) cancelAnimationFrame(raf);
    el.style.width=el.style.height=el.style.left=el.style.top="";
    dato.w = w; dato.h = h;
    Object.assign(dato, anclarLibre(dato, fmt, nl*escala, nt*escala));
    fijarPosLibre(fmt, dato);
    persistir(); renderTablero(); renderPanelLibre();
  };
  window.addEventListener("pointermove",mover); window.addEventListener("pointerup",soltar);
}
// ── ESCRIBIR DIRECTAMENTE SOBRE EL BANNER ───────────────────────────────
// Pedido del usuario: el texto se edita EN EL BANNER, no en un formulario al
// lado. Se hace `contenteditable` sobre el elemento REAL, dentro de la vista
// escalada: lo que se escribe se ve exactamente del tamaño y con la tipografía
// con que va a salir. (El motor de 3 zonas usa un clon en el overlay porque sus
// zonas son flex y editarlas en su sitio las reflujaba; aquí cada texto es una
// caja absoluta, así que no hace falta clon ni compensar la escala.)
let _editandoLibre = null;
function editarTextoLibre(el, dato, ctx){
  // Ya se está escribiendo en ESTE texto: no reentrar. Un doble clic dispara
  // el segundo pointerdown Y el dblclick, y la segunda entrada cerraba la
  // primera y repintaba el tablero — el cuadro se abría y se cerraba solo.
  if(_editandoLibre && _editandoLibre.dato === dato) return;
  if(_editandoLibre) cerrarTextoLibre();
  const { fmt, stage, ovl, cmp } = ctx;
  const k = factorK(fmt);
  const inner = el.querySelector(".lb-txt-in") || el;
  el.classList.add("lb-editando");
  inner.contentEditable = "true";
  inner.spellcheck = false;
  // La caja de selección estorba mientras escribes; vuelve al salir.
  ovl.querySelectorAll(".lb-sel").forEach(n=>n.style.display="none");
  _editandoLibre = { el, inner, dato, ctx };
  inner.focus();
  // Si aún dice el texto de ejemplo, se selecciona entero: escribes encima.
  const rango = document.createRange();
  if(String(dato.texto||"").trim() === "Escribe aquí"){
    rango.selectNodeContents(inner);
  } else {
    rango.selectNodeContents(inner); rango.collapse(false);
  }
  const selDoc = window.getSelection(); selDoc.removeAllRanges(); selDoc.addRange(rango);
  barraTextoLibre(el, dato, ctx);
  inner.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){ e.preventDefault(); cerrarTextoLibre(); }
    // Enter = salto de línea (el render usa escMultiline). Ctrl/Cmd+Enter cierra.
    if(e.key === "Enter" && (e.metaKey || e.ctrlKey)){ e.preventDefault(); cerrarTextoLibre(); }
  });
  inner.addEventListener("blur", ()=>{
    // Si el foco se fue a la barrita, se sigue escribiendo.
    setTimeout(()=>{
      const a = document.activeElement;
      if(a && a.closest && a.closest(".lb-textbar")) return;
      if(_editandoLibre && _editandoLibre.inner === inner) cerrarTextoLibre();
    }, 60);
  });
}
// Guarda lo escrito y repinta UNA vez. Los 11 banners más el inspector son
// trabajo real: hacerlo por tecla es justo lo que se siente como "va lento".
function cerrarTextoLibre(){
  const E = _editandoLibre; if(!E) return;
  _editandoLibre = null;
  const { el, inner, dato, ctx } = E;
  const txt = String(inner.innerText || "")
    .replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  inner.contentEditable = "false";
  el.classList.remove("lb-editando");
  quitarBarraTextoLibre();
  dato.texto = txt;
  // QUE NO SE CORTE EN SILENCIO: si lo escrito no cabe en su cuadro, el cuadro
  // crece hasta que quepa. Antes el texto se recortaba y solo lo avisaba el
  // inspector, con el trabajo ya hecho.
  const k = factorK(ctx.fmt);
  const necesita = Math.ceil((inner.scrollHeight || 0) / k)
                 + (parseFloat(dato.padT)||0) + (parseFloat(dato.padB)||0);
  if(necesita > (parseFloat(dato.h)||0)) dato.h = necesita;
  marcarSinGuardar(); persistir(); renderTablero(); renderPanelLibre();
}
function quitarBarraTextoLibre(){ const b=document.getElementById("lb-textbar"); if(b) b.remove(); }
// Barrita flotante sobre el texto: tamaño, negrita/cursiva y alineación. Los
// cambios se ven EN VIVO sobre el banco y el tablero se repinta al salir, para
// no perder el foco de lo que estás escribiendo.
function barraTextoLibre(el, dato, ctx){
  quitarBarraTextoLibre();
  const { stage, ovl, fmt } = ctx;
  const k = factorK(fmt);
  const sL = parseFloat(stage.closest(".lienzo")?.dataset.escala) || 1;
  const bar = document.createElement("div");
  bar.className = "lb-textbar"; bar.id = "lb-textbar";
  const aln = [["left","alignLeft"],["center","alignCenter"],["right","alignRight"]];
  bar.innerHTML =
      `<button type="button" data-tam="-1" title="Más chico">A−</button>`
    + `<span class="lb-tb-n">${Math.round(parseFloat(dato.tam)||18)}</span>`
    + `<button type="button" data-tam="1" title="Más grande">A+</button>`
    + `<span class="sep"></span>`
    + `<button type="button" data-est="negrita" class="${dato.negrita?"on":""}" title="Negrita"><b>B</b></button>`
    + `<button type="button" data-est="italica" class="${dato.italica?"on":""}" title="Cursiva"><i>i</i></button>`
    + `<span class="sep"></span>`
    + aln.map(([a,ic])=>`<button type="button" data-aln="${a}" class="${(dato.alinH||"left")===a?"on":""}" title="Alinear">${ICONS[ic]||a}</button>`).join("")
    + `<span class="sep"></span>`
    + `<button type="button" data-fin="1" class="lb-tb-ok" title="Terminar">Listo</button>`;
  const er = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const arriba = er.top - sr.top - 38;
  bar.style.left = Math.max(2, Math.min(er.left - sr.left, sr.width - 250)) + "px";
  bar.style.top  = (arriba >= 2 ? arriba : Math.min(er.bottom - sr.top + 6, sr.height - 36)) + "px";
  bar.querySelectorAll("button").forEach(b=>{
    b.addEventListener("pointerdown", e=>e.preventDefault());   // no robar el foco
    b.addEventListener("click", e=>{
      e.preventDefault();
      if(b.dataset.fin){ return cerrarTextoLibre(); }
      if(b.dataset.tam){
        const nv = Math.max(6, Math.min(200, Math.round((parseFloat(dato.tam)||18) + (b.dataset.tam==="1"?1:-1))));
        dato.tam = nv;
        el.style.fontSize = Math.round(nv*k) + "px";
        const n = bar.querySelector(".lb-tb-n"); if(n) n.textContent = nv;
      } else if(b.dataset.est){
        dato[b.dataset.est] = !dato[b.dataset.est];
        b.classList.toggle("on", !!dato[b.dataset.est]);
        if(b.dataset.est==="negrita") el.style.fontWeight = dato.negrita ? "700" : "";
        else el.style.fontStyle = dato.italica ? "italic" : "";
      } else if(b.dataset.aln){
        dato.alinH = b.dataset.aln;
        el.style.textAlign = b.dataset.aln;
        bar.querySelectorAll("[data-aln]").forEach(x=>x.classList.toggle("on", x.dataset.aln===dato.alinH));
      }
      marcarSinGuardar();
      const foco = _editandoLibre && _editandoLibre.inner;
      if(foco) foco.focus();
    });
  });
  ovl.appendChild(bar);
}

// ── PANEL DEL LIENZO LIBRE ──────────────────────────────────────────────
// La estructura del documento del usuario: Marca · Fondo · Logo · Formas para
// dibujar · Cuadro de texto · Enlace CTA. Arriba, lo que se añade; abajo, las
// propiedades de lo que tengas seleccionado.
function renderPanelLibre(){
  const cont = document.getElementById("comp-editor"); if(!cont) return;
  const p = pieza(); if(!p || !esLibre(p.composicion)) return;
  const c = p.composicion;
  const sel = (c.elementos||[]).find(e=>e.id===elLibreSel) || null;
  const marcas = workspace.marcas||[];
  const S = (id,expr)=>`setLibre('${id}',${expr})`;
  let h = `<div class="cmp-ed lb-panel">`;

  // ── MARCA
  h += `<div class="se-h">${svgIcon("paleta",{size:"15px"})} Marca</div>`;
  h += `<div class="se-f"><div class="se-tamrow"><select onchange="if(this.value)aplicarMarca(this.value)">`
     + `<option value="">${marcas.length?"— Aplicar una marca —":"— Sin marcas —"}</option>`
     + marcas.map(m=>`<option value="${m.id}" ${p.tema&&p.tema.marcaId===m.id?"selected":""}>${esc(m.nombre)}</option>`).join("")
     + `</select><button type="button" class="cmp-bib" onclick="abrirMarcas()" title="Crear o editar marcas">${svgIcon("mas",{size:"13px"})}</button></div></div>`;

  // ── AÑADIR ELEMENTOS
  h += `<div class="se-h">${svgIcon("mas",{size:"15px"})} Añadir al banner</div>`;
  h += `<div class="lb-add">`
     + `<button type="button" onclick="anadirLibre('texto')">${svgIcon("documento",{size:"15px"})} Cuadro de texto</button>`
     + `<button type="button" onclick="anadirLibre('boton')">${svgIcon("enlace",{size:"15px"})} Botón</button>`
     + `<button type="button" onclick="anadirLibre('logo')">${svgIcon("imagen",{size:"15px"})} Logo</button>`
     + FIGURAS_LIBRE.map(([f,n])=>`<button type="button" onclick="anadirLibre('figura','${f}')"><span class="lb-ico ${f}"></span> ${n}</button>`).join("")
     + `</div>`;
  h += `<p class="se-nota">Haz <b>doble clic</b> en un texto del banner para escribirlo ahí mismo. El botón es un cuadro de texto con fondo y enlace: uno solo, se arrastra entero.</p>`;

  // ── FONDO
  const fo = c.fondo||{}; const esFoto = fo.tipo==="imagen" && fo.imagen && fo.imagen.url;
  h += `<div class="se-h">${svgIcon("imagen",{size:"15px"})} Fondo</div>`;
  h += `<div class="se-seg2"><button type="button" class="${esFoto?"":"on"}" onclick="fondoLibre('color')">Color plano</button>`
     + `<button type="button" class="${esFoto?"on":""}" onclick="fondoLibre('foto')">Fotografía</button></div>`;
  if(!esFoto){
    h += `<div class="se-col"><label>Color</label><input type="color" value="${esc(fo.color||"#ffffff")}" oninput="${S('fondo.color','this.value')}">`
       + `<div class="se-sw">${swatchesLibre('fondo.color')}</div>`
       + `<input type="text" class="se-hex" placeholder="#hex" value="${escAttr(fo.color||"")}" onchange="${S('fondo.color','this.value')};renderPanelLibre()"></div>`;
  } else {
    const fotos=(workspace.imagenes||[]).filter(sirveComoFondo).slice(0,7);
    h += `<div class="se-fotos">`
       + fotos.map(im=>`<button type="button" class="${im.url===fo.imagen.url?"on":""}" title="${escAttr(im.nombre||"")}" onclick="${S('fondo.imagen.url',"'"+jsAttr(im.url)+"'")};renderPanelLibre()"><img src="${esc(im.url)}" alt=""></button>`).join("")
       + `</div>`;
    h += `<div class="se-acc"><button type="button" onclick="elegirFotoLibre()">${svgIcon("imagen",{size:"14px"})} Biblioteca</button>`
       + `<button type="button" onclick="document.getElementById('lb-subir').click()">${svgIcon("mas",{size:"14px"})} Subir foto</button></div>`
       + `<input type="file" id="lb-subir" accept="image/*" style="display:none" onchange="subirFotoLibre(this.files)">`;
    h += `<div class="se-f"><label>Encuadre</label><select onchange="${S('fondo.imagen.fit','this.value')};renderTablero()">`
       + [["cover","Cubrir el banner"],["contain","Ver la foto entera"]].map(([v,l])=>`<option value="${v}" ${(fo.imagen.fit||"cover")===v?"selected":""}>${l}</option>`).join("")
       + `</select></div>`;
  }
  // Filtro (va SOBRE la imagen, con tipo e intensidad)
  const fi = fo.filtro||{};
  h += `<div class="se-f"><label>Filtro sobre el fondo</label><select onchange="${S('fondo.filtro.tipo','this.value')};renderPanelLibre()">`
     + FILTROS_FONDO.map(([v,l])=>`<option value="${v}" ${(fi.tipo||"")===v?"selected":""}>${l}</option>`).join("")+`</select></div>`;
  if(fi.tipo){
    h += `<div class="se-f"><label>Intensidad <small>· ${parseInt(fi.intensidad)||40}%</small></label>`
       + `<div class="se-tamrow"><input type="range" min="0" max="100" value="${parseInt(fi.intensidad)||40}" oninput="${S('fondo.filtro.intensidad','this.value')}" onchange="renderPanelLibre()">`
       + `<button type="button" class="se-quitar" onclick="${S('fondo.filtro.tipo',"''")};renderPanelLibre()">Quitar</button></div></div>`;
    if(fi.tipo==="marca") h += `<div class="se-col"><label>Color</label><input type="color" value="${esc(fi.color||"#040764")}" oninput="${S('fondo.filtro.color','this.value')}"><div class="se-sw">${swatchesLibre('fondo.filtro.color')}</div></div>`;
  }

  // ── ELEMENTO SELECCIONADO
  h += `<div class="se-h">${svgIcon("editar",{size:"15px"})} ${sel ? nombreLibre(sel) : "Elemento"}</div>`;
  h += sel ? propsLibreHTML(sel) : `<p class="se-nota">Haz clic en un elemento del banner para editarlo, o añade uno arriba.</p>`;

  // ── CAPAS (delante / detrás)
  const els = (c.elementos||[]).slice().sort((a,b)=>(b.z||0)-(a.z||0));
  if(els.length){
    h += `<div class="se-h">${svgIcon("grid",{size:"15px"})} Capas <small style="font-weight:400;color:#8890a8">de delante a detrás</small></div>`;
    h += `<div class="lb-capas">` + els.map(e=>`<button type="button" class="lb-capa${e.id===elLibreSel?" on":""}" onclick="elLibreSel='${e.id}';renderPanelLibre();renderTablero()">`
       + `<span class="lb-capa-n">${esc(nombreLibre(e))}</span>`
       + `<span class="lb-capa-acc"><i onclick="event.stopPropagation();moverCapaLibre('${e.id}',1)" title="Traer adelante">▲</i>`
       + `<i onclick="event.stopPropagation();moverCapaLibre('${e.id}',-1)" title="Enviar atrás">▼</i>`
       + `<i class="del" onclick="event.stopPropagation();borrarLibre('${e.id}')" title="Eliminar">×</i></span></button>`).join("") + `</div>`;
  }
  h += `</div>`;
  cont.style.display=""; cont.innerHTML = h;
  const tema=document.getElementById("diseno-tema"); if(tema) tema.style.display="none";
  pintarIconos();
}
function nombreLibre(e){
  if(e.tipo==="logo") return "Logo";
  if(e.tipo==="texto" && e.fondo && String(e.link||"").trim()){
    const t=String(e.texto||"").trim();
    return t ? ("Botón · "+t.slice(0,18)+(t.length>18?"…":"")) : "Botón";
  }
  if(e.tipo==="figura") return (FIGURAS_LIBRE.find(f=>f[0]===e.forma)||["","Figura"])[1];
  const t=String(e.texto||"").trim();
  return t ? ("Texto · "+t.slice(0,22)+(t.length>22?"…":"")) : "Cuadro de texto";
}
// Propiedades del elemento seleccionado, según su tipo.
function propsLibreHTML(e){
  const S=(campo,expr)=>`setElLibre('${e.id}','${campo}',${expr})`;
  const num=(etq,campo,mn,mx,def)=>`<div class="se-f se-tam"><label>${etq}</label><div class="se-tamrow">`
    +`<button type="button" onclick="nudgeElLibre('${e.id}','${campo}',-1,${mn},${mx})">−</button>`
    +`<input type="number" min="${mn}" max="${mx}" value="${parseFloat(e[campo])||def}" oninput="${S(campo,'this.value')}" onchange="renderPanelLibre()">`
    +`<button type="button" onclick="nudgeElLibre('${e.id}','${campo}',1,${mn},${mx})">+</button></div></div>`;
  const color=(etq,campo,def)=>`<div class="se-col"><label>${etq}</label><input type="color" value="${esc(e[campo]||def)}" oninput="${S(campo,'this.value')}">`
    +`<div class="se-sw">${swatchesElLibre(e.id,campo)}</div>`
    +`<input type="text" class="se-hex" placeholder="#hex" value="${escAttr(e[campo]||"")}" onchange="${S(campo,'this.value')};renderPanelLibre()"></div>`;
  let h = "";
  if(e.tipo==="texto"){
    h += `<div class="se-f"><label>Texto</label><textarea oninput="${S('texto','this.value')}">${esc(e.texto||"")}</textarea></div>`;
    h += `<div class="se-f"><label>Tipografía</label><select onchange="${S('fuente','this.value')};renderPanelLibre()"><option value="">La del tema</option>`
       + FUENTES.map(([v,l])=>`<option value="${esc(v)}" ${(e.fuente||"")===v?"selected":""}>${esc(l)}</option>`).join("")+`</select></div>`;
    h += num("Tamaño de letra","tam",6,200,18);
    h += color("Color","color","#111111");
    h += `<div class="se-f"><label>Alineación</label><div class="cmp-alin">`
       + ["left","center","right"].map(a=>`<button class="${(e.alinH||"left")===a?"on":""}" onclick="${S('alinH',"'"+a+"'")};renderPanelLibre()">${ICONS[a==="left"?"alignLeft":a==="center"?"alignCenter":"alignRight"]}</button>`).join("")
       + `</div></div>`;
    h += `<div class="se-f"><label>Estilo</label><div class="cmp-alin"><button class="${e.negrita?"on":""}" onclick="${S('negrita',!e.negrita)};renderPanelLibre()"><b>B</b></button>`
       + `<button class="${e.italica?"on":""}" onclick="${S('italica',!e.italica)};renderPanelLibre()"><i>i</i></button></div></div>`;
    h += `<div class="se-h2">Fondo del cuadro <small>· con fondo, es un botón</small></div>`;
    h += color("Color de fondo","fondo","#1c73cb");
    h += `<div class="se-acc"><button type="button" onclick="${S('fondo',"''")};renderPanelLibre()">Sin fondo</button></div>`;
    h += num("Redondear puntas","radio",0,60,0);
    h += `<div class="se-h2">Margen del cuadro</div>`;
    h += `<div class="lb-pads">`+[["padT","Arriba"],["padB","Abajo"],["padL","Izq."],["padR","Der."]]
       .map(([c2,l])=>`<label>${l}<input type="number" min="0" max="80" value="${parseFloat(e[c2])||0}" oninput="${S(c2,'this.value')}"></label>`).join("")+`</div>`;
  }
  if(e.tipo==="figura"){
    h += `<div class="se-f"><label>Forma</label><select onchange="${S('forma','this.value')};renderPanelLibre()">`
       + FIGURAS_LIBRE.map(([v,l])=>`<option value="${v}" ${(e.forma||"rect")===v?"selected":""}>${l}</option>`).join("")+`</select></div>`;
    h += color("Color de fondo","relleno","#1c73cb");
    h += color("Color de borde","borde","#000000");
    h += num("Grosor del borde","bordeAncho",0,20,0);
    if(e.forma!=="circulo") h += num("Redondear puntas","radio",0,60,0);
  }
  if(e.tipo==="logo"){
    h += `<div class="se-acc"><button type="button" onclick="logoDeMarcaLibre('${e.id}')">${svgIcon("paleta",{size:"14px"})} El de la marca</button>`
       + `<button type="button" onclick="elegirLogoLibre('${e.id}')">${svgIcon("imagen",{size:"14px"})} Subir o elegir</button></div>`;
    h += `<div class="se-f"><label>Dirección</label><input type="text" value="${escAttr(e.url||"")}" onchange="${S('url','this.value')};renderTablero()"></div>`;
  }
  // Comunes: tamaño, posición y enlace.
  // El PAPEL decide en qué banda cae al replicar (maquetas del usuario).
  const rolAuto = rolLibre(Object.assign({}, e, { rol:"" }));
  h += `<div class="se-h2">Papel en el banner</div>`;
  h += `<div class="se-f"><label>Es el… <small>· decide su banda al replicar</small></label>`
     + `<select onchange="${S('rol','this.value')};renderTablero()">`
     + ROLES_LIBRE.map(([v,l])=>`<option value="${v}" ${(e.rol||"")===v?"selected":""}>${l}${v===""?" ("+(({logo:"Logo",promo:"Promoción",cta:"Botón",legal:"Legal"})[rolAuto])+")":""}</option>`).join("")
     + `</select></div>`;
  h += `<div class="se-h2">Tamaño y posición</div>`;
  h += `<div class="lb-pads"><label>Ancho<input type="number" min="4" max="2000" value="${Math.round(parseFloat(e.w)||10)}" oninput="${S('w','this.value')}"></label>`
     + `<label>Alto<input type="number" min="4" max="2000" value="${Math.round(parseFloat(e.h)||10)}" oninput="${S('h','this.value')}"></label></div>`;
  h += `<div class="se-f"><label>Anclado a</label><select onchange="${S('ancla','this.value')};renderTablero()">`
     + ANCLAS_LIBRE.map(([v,l])=>`<option value="${v}" ${(e.ancla||"tl")===v?"selected":""}>${l}</option>`).join("")+`</select></div>`;
  h += `<p class="se-nota">El ancla es lo que hace que al <b>replicar</b> el elemento se quede en su esquina en todos los tamaños.</p>`;
  h += `<div class="se-h2">Enlace</div>`;
  h += `<div class="se-f"><label>URL de destino</label><input type="text" placeholder="https://…" value="${escAttr(e.url&&e.tipo!=="logo"?e.url:(e.link||""))}" onchange="${S('link','this.value')}"></div>`;
  h += `<div class="se-f"><label><input type="checkbox" ${e.nuevaVentana!==false?"checked":""} onchange="${S('nuevaVentana','this.checked')}"> Abrir en una ventana nueva</label></div>`;
  h += `<button class="lb-borrar" onclick="borrarLibre('${e.id}')">${svgIcon("basura",{size:"13px"})} Eliminar este elemento</button>`;
  return h;
}
// ── MUTADORES DEL LIENZO LIBRE ──────────────────────────────────────────
function setLibre(path, val){
  const p=pieza(); if(!p||!esLibre(p.composicion)) return;
  setPath(p.composicion, path, val);
  marcarSinGuardar(); renderTablero();
}
function setElLibre(id, campo, val){
  const p=pieza(); const e=elLibre(p,id); if(!e) return;
  const nums=["tam","w","h","padT","padR","padB","padL","radio","bordeAncho"];
  e[campo] = nums.includes(campo) ? (parseFloat(val)||0) : val;
  marcarSinGuardar(); renderTablero();
}
function nudgeElLibre(id, campo, delta, mn, mx){
  const p=pieza(); const e=elLibre(p,id); if(!e) return;
  const v = Math.max(mn, Math.min(mx, Math.round((parseFloat(e[campo])||0) + delta)));
  e[campo]=v; marcarSinGuardar(); renderTablero(); renderPanelLibre();
}
function anadirLibre(tipo, forma){
  const p=pieza(); if(!p||!esLibre(p.composicion)) return;
  const c=p.composicion; c.elementos=c.elementos||[];
  const zMax=c.elementos.reduce((m,x)=>Math.max(m,x.z||0),0);
  const e=nuevoElementoLibre(tipo, forma?{forma}:null);
  e.z=zMax+1;
  // El botón toma los colores de CTA de la marca aplicada, si la hay.
  if(tipo==="boton"){
    const mid=p.tema&&p.tema.marcaId;
    const m=mid?(workspace.marcas||[]).find(x=>x.id===mid):null;
    if(m){ const M=normalizarMarca(m); if(M.cta) e.fondo=M.cta; if(M.ctaText) e.color=M.ctaText; }
  }
  c.elementos.push(e);
  elLibreSel=e.id;
  // Un logo sin imagen no se dibuja, así que parecería que no pasó nada: se le
  // pone el de la marca aplicada y, si no hay marca, se abre la biblioteca.
  if(tipo==="logo"){
    const mid=p.tema&&p.tema.marcaId;
    const m=mid?(workspace.marcas||[]).find(x=>x.id===mid):null;
    if(m){ const M=normalizarMarca(m);
      const oscuro=(c.fondo&&c.fondo.tipo==="color")?esColorOscuro(c.fondo.color):true;
      e.url = logoDeMarca(M,oscuro) || logoDeMarca(M,false) || ""; }
    if(!e.url){ marcarSinGuardar(); renderTablero(); renderPanelLibre();
      return abrirImagenes(url=>{ e.url=url; marcarSinGuardar(); renderTablero(); renderPanelLibre(); }); }
  }
  marcarSinGuardar(); renderTablero(); renderPanelLibre();
}
function borrarLibre(id){
  const p=pieza(); const c=p&&p.composicion; if(!c) return;
  c.elementos=(c.elementos||[]).filter(e=>e.id!==id);
  if(elLibreSel===id) elLibreSel=null;
  marcarSinGuardar(); renderTablero(); renderPanelLibre();
}
function moverCapaLibre(id, delta){
  const p=pieza(); const c=p&&p.composicion; if(!c) return;
  const els=(c.elementos||[]).slice().sort((a,b)=>(a.z||0)-(b.z||0));
  const i=els.findIndex(e=>e.id===id); if(i<0) return;
  const j=i+delta; if(j<0||j>=els.length) return;
  const zi=els[i].z||0, zj=els[j].z||0;
  els[i].z=zj; els[j].z=zi;
  marcarSinGuardar(); renderTablero(); renderPanelLibre();
}
function fondoLibre(modo){
  const p=pieza(); const c=p&&p.composicion; if(!c) return;
  c.fondo=c.fondo||{};
  if(modo==="color"){ c.fondo.tipo="color"; }
  else { c.fondo.tipo="imagen"; c.fondo.imagen=c.fondo.imagen||{url:"",fit:"cover",foco:"center",zoom:100}; }
  marcarSinGuardar(); renderTablero(); renderPanelLibre();
}
function elegirFotoLibre(){ abrirImagenes(url=>{ setLibre("fondo.imagen.url",url); setLibre("fondo.tipo","imagen"); renderPanelLibre(); }); }
function elegirLogoLibre(id){ abrirImagenes(url=>{ setElLibre(id,"url",url); renderPanelLibre(); }); }
function logoDeMarcaLibre(id){
  const p=pieza(); const mid=p.tema&&p.tema.marcaId;
  const m=mid?(workspace.marcas||[]).find(x=>x.id===mid):null;
  if(!m){ toast("Aplica una marca primero"); return; }
  const M=normalizarMarca(m);
  const c=p.composicion, oscuro=(c.fondo&&c.fondo.tipo==="color")?esColorOscuro(c.fondo.color):true;
  setElLibre(id,"url", logoDeMarca(M,oscuro) || logoDeMarca(M,false) || "");
  renderPanelLibre();
}
async function subirFotoLibre(files){
  if(!files||!files.length) return;
  toast("Subiendo la foto…");
  try{ await subirImagenes(files); const ult=(workspace.imagenes||[])[0];
    if(ult){ setLibre("fondo.imagen.url",ult.url); setLibre("fondo.tipo","imagen"); renderPanelLibre(); }
  }catch(e){ toast("No se pudo subir la foto"); }
}
// ── GUARDADO EXPLÍCITO ──────────────────────────────────────────────────
// El modelo pide un botón de guardar. `persistir()` sigue existiendo, pero los
// cambios del lienzo libre quedan marcados como pendientes hasta que se pulsa.
let _libreSinGuardar = false;
function marcarSinGuardar(){ _libreSinGuardar = true; pintarEstadoGuardado(); persistir(); }
function guardarBanner(){ _libreSinGuardar = false; persistir(); pintarEstadoGuardado(); toast("Banner guardado"); }
function pintarEstadoGuardado(){
  const b=document.getElementById("lb-guardar"); if(!b) return;
  b.classList.toggle("pend", _libreSinGuardar);
  const t=b.querySelector(".lb-gtxt"); if(t) t.textContent = _libreSinGuardar ? "Guardar cambios" : "Guardado";
}
// ── REPLICAR ────────────────────────────────────────────────────────────
// El corazón del modelo: diseñas el 300×250 y el resto se ajusta. Como cada
// elemento guarda su ANCLA y su tamaño en unidades base, replicar es limpiar los
// ajustes propios de cada tamaño para que todos vuelvan a seguir al máster.
function replicarBanner(){
  const p=pieza(); if(!p||!esLibre(p.composicion)) return;
  const otros=(p.artboards||[]).filter(a=>a.fmt!==p.masterFmt);
  const tocados=otros.filter(a=>a.ov&&Object.keys(a.ov).length);
  if(tocados.length && !confirm(`${tocados.length} tamaño(s) tienen ajustes propios que hiciste a mano.\n\nAl replicar vuelven a seguir al diseño del máster y esos ajustes se pierden.\n\n¿Replicar igual?`)) return;
  // Cada tamaño recibe el diseño REPARTIDO en sus bandas (25/50/25 en franjas,
  // 20/50/20/10 en verticales — las maquetas del usuario). El máster se queda
  // como lo dibujaste.
  otros.forEach(a=>{ a.ov={}; a.pos = acomodarPieza(p, a.fmt) || {}; });
  persistir(); renderTablero();
  toast(`Replicado a ${otros.length} tamaños · revisando…`);
  // El inspector dice cuáles quedaron bien y cuáles hay que mirar.
  setTimeout(()=>{
    const res=p._inspeccion||{};
    const malos=Object.keys(res).filter(f=>!res[f].ok);
    const n=Object.keys(res).length;
    const cartel=document.getElementById("lb-resultado");
    if(cartel){
      cartel.className = "lb-resultado " + (malos.length?"aviso":"ok");
      cartel.innerHTML = malos.length
        ? `${svgIcon("info",{size:"14px"})} <b>${n-malos.length} de ${n}</b> quedaron bien. Revisa: ${malos.map(f=>FORMATOS[f]?FORMATOS[f].ancho+"×"+FORMATOS[f].alto:f).join(" · ")}`
        : `${svgIcon("check",{size:"14px"})} <b>Los ${n} tamaños</b> quedaron bien.`;
      pintarIconos();
    }
  }, 2200);
}
// ── SELECCIÓN DE BANNERS para vista previa y exportación ────────────────
function bannerMarcado(p, fmt){
  if(!p._sel) return true;                 // por defecto, todos
  return p._sel.indexOf(fmt) >= 0;
}
function marcarBanner(fmt, on){
  const p=pieza(); if(!p) return;
  if(!p._sel) p._sel=(p.artboards||[]).map(a=>a.fmt);
  p._sel = on ? [...new Set(p._sel.concat([fmt]))] : p._sel.filter(f=>f!==fmt);
  persistir();
  const n=document.getElementById("lb-nsel"); if(n) n.textContent=p._sel.length;
}
function marcarTodosBanners(on){
  const p=pieza(); if(!p) return;
  p._sel = on ? (p.artboards||[]).map(a=>a.fmt) : [];
  persistir(); renderTablero();
}
function bannersMarcados(p){
  return (p.artboards||[]).map(a=>a.fmt).filter(f=>bannerMarcado(p,f));
}
function swatchesLibre(path){
  const cols = (typeof coloresDeMarca==="function") ? coloresDeMarca() : [];
  if(!cols.length) return `<span class="cmp-sw-vacio">Aplica una marca para ver su paleta</span>`;
  return cols.map(c=>`<button class="cmp-sw" style="background:${esc(c)}" title="${esc(c)}" onclick="setLibre('${path}','${c}');renderPanelLibre()"></button>`).join("");
}
function swatchesElLibre(id, campo){
  const cols = (typeof coloresDeMarca==="function") ? coloresDeMarca() : [];
  if(!cols.length) return `<span class="cmp-sw-vacio">Aplica una marca</span>`;
  return cols.map(c=>`<button class="cmp-sw" style="background:${esc(c)}" title="${esc(c)}" onclick="setElLibre('${id}','${campo}','${c}');renderPanelLibre()"></button>`).join("");
}
// Si estás ajustando un tamaño que NO es el máster, lo que mueves ahí queda
// guardado para ese tamaño (pisa el reacomodo automático de "Replicar"). En el
// máster no: ahí estás definiendo el diseño que se replica.
function fijarPosLibre(fmt, el){
  const p = pieza(); if(!p || !el) return;
  if(fmt === (p.masterFmt || "display-300x250")) return;
  const ab = (p.artboards||[]).find(a=>a.fmt===fmt); if(!ab) return;
  ab.pos = ab.pos || {};
  ab.pos[el.id] = { w:el.w, h:el.h, ancla:el.ancla, dx:el.dx, dy:el.dy };
}
function guiaLibre(ovl, orient, pos){
  const g=document.createElement("div"); g.className="lz-guia "+orient;
  if(orient==="v") g.style.left=pos+"px"; else g.style.top=pos+"px";
  ovl.appendChild(g); return g;
}

function composicionDefault(tema){
  // Los textos parten en blanco (#fff): el fondo del tema solo se adopta si es
  // OSCURO. Un tema claro dejaba el prearmado blanco-sobre-blanco → "no
  // funciona nada" (escribías y no se veía). Default seguro: navy.
  const bg=(tema&&tema.bg&&typeof esColorOscuro==="function"&&esColorOscuro(tema.bg))?tema.bg:"#040764";
  const pri=(tema&&tema.primary)||"#2f80ed";
  const zona=(extra)=>Object.assign({ bg:"hereda", color:"", imagen:imgDefComp(), alinH:"left", alinV:"center", visible:true }, extra);
  return {
    fondo:{ tipo:"color", color:bg, imagen:imgDefComp() },
    prop:[25,50,25],
    zonas:{
      logo:  zona({ url:"", alto:48, maxw:70 }),
      texto: zona({ titular:{texto:"Tu mensaje aquí",tamano:26,color:"#ffffff"}, cuerpo:{texto:"Escribe una bajada breve o pídesela a Char-B",tamano:13,color:"#ffffff"} }),
      cta:   zona({ texto:"Saber más", url:"", colorFondo:pri, colorTexto:"#ffffff", radio:8, tamano:13 })
    }
  };
}
// Migración del modelo viejo (6 capas) → 3 zonas. Se aplica perezosamente.
function migrarComposicion(c, tema){
  if(c && c.zonas) return c;
  const n = composicionDefault(tema);
  if(!c) return n;
  if(c.imagen && c.imagen.url){ n.fondo.tipo="imagen"; Object.assign(n.fondo.imagen, c.imagen); }
  if(c.fondoColor && c.fondoColor.color) n.fondo.color=c.fondoColor.color;
  if(c.logo){ Object.assign(n.zonas.logo, { url:c.logo.url||"", alto:c.logo.tamano||48, maxw:c.logo.maxw||70, alinH:c.logo.alinH||"left", visible:c.logo.visible!==false }); }
  if(c.titular){ Object.assign(n.zonas.texto.titular, { texto:c.titular.texto||"", tamano:c.titular.tamano||26, color:c.titular.color||"#ffffff" }); n.zonas.texto.alinH=c.titular.alinH||"left"; }
  if(c.cuerpo){ Object.assign(n.zonas.texto.cuerpo, { texto:c.cuerpo.texto||"", tamano:c.cuerpo.tamano||13, color:c.cuerpo.color||"#ffffff" }); }
  if(c.cta){ Object.assign(n.zonas.cta, { texto:c.cta.texto||"Saber más", url:c.cta.url||"", colorFondo:c.cta.colorFondo||"#2f80ed", colorTexto:c.cta.colorTexto||"#ffffff", alinH:c.cta.alinH||"left" }); }
  return n;
}
function asegurarComposicionNueva(p){
  // El lienzo LIBRE no tiene zonas y no hay nada que migrar: sin esta salida se
  // le aplicaba la migración al modelo de 3 zonas y se perdía el modelo nuevo.
  if(p && esLibre(p.composicion)) return;
  if(p && p.esSet && p.composicion && !p.composicion.zonas){
    p.composicion = migrarComposicion(p.composicion, p.tema);
    (p.artboards||[]).forEach(a=>{ if(a.ov) a.ov={}; });   // overrides viejos no son compatibles
  }
  // El MÁSTER nunca debe tener override propio (taparía el Diseño global y editarlo
  // no se propagaría). Si una pieza vieja lo tiene, se fusiona al global y se limpia.
  if(p && p.esSet && p.composicion){
    const mf = p.masterFmt || "display-300x250";
    const abM = (p.artboards||[]).find(a=>a.fmt===mf);
    if(abM && abM.ov && ovTieneValor(abM.ov)){
      p.composicion = deepMergeOv(p.composicion, abM.ov);
      abM.ov = {};
    }
  }
}
