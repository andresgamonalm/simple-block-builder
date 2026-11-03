/* ══════════════════════════════════════════════════════════════════
   BANNERS · INSPECTOR  ·  funciones/comun/banners/inspector.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Revisa cada banner dibujado: desborde, colisión, legibilidad, contraste, aire.
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. INSPECTOR
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// ═══ INSPECTOR ════════════════════════════════════════════════════════════
// Ninguna pieza llega al usuario sin pasar SEIS comprobaciones sobre el render
// REAL — no sobre el código que lo generó, sobre el resultado medido en pantalla.
// Comprobar que el HTML no venga vacío ni con errores NO es comprobar calidad:
// un banner completamente vacío pasa ese test.
//   1 Desborde     ningún elemento fuera del marco
//   2 Colisión     ningún texto montado sobre otro ni sobre el círculo
//   3 Legibilidad  nada bajo 9 px (lado corto ≤ 250) ni bajo 11 px en el resto
//   4 Contraste    texto contra su fondo real ≥ 4,5:1
//   5 Completa     título, CTA y logo presentes
//   6 Aire         ninguna zona muerta mayor al 30 % del alto
const INSPECTOR_SELS = { logo:".cmp-logo", etq:".cmp-etq", tit:".cmp-tit",
  cue:".cmp-cue", cta:".cmp-cta", legal:".cmp-legal", bub:".cmp-burbuja" };
const INSPECTOR_NOMBRE = { logo:"logo", etq:"epígrafe", tit:"título", cue:"bajada",
  cta:"botón", legal:"legal", bub:"círculo de oferta" };
function _insRgba(c){
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c||"");
  return m ? { r:+m[1], g:+m[2], b:+m[3], a:m[4]===undefined?1:parseFloat(m[4]) } : null;
}
function _insLum(c){
  const f = v => { v=v/255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
}
// Fondo REAL detrás de un elemento: acumula las capas translúcidas de los padres
// (una píldora blanca al 22 % sobre navy NO es blanco) hasta dar con una opaca.
function _insFondo(el, raiz){
  const capas=[]; let n=el, foto=false;
  while(n && n!==raiz.parentElement){
    const cs = getComputedStyle(n);
    if(cs.backgroundImage && cs.backgroundImage!=="none") foto = true;
    const c = _insRgba(cs.backgroundColor);
    if(c && c.a>0.001){ capas.push(c); if(c.a>=0.999) break; }
    n = n.parentElement;
  }
  if(!capas.length) return { col:null, foto };
  let out = capas[capas.length-1];
  for(let i=capas.length-2;i>=0;i--){ const f=capas[i];
    out = { r:f.r*f.a+out.r*(1-f.a), g:f.g*f.a+out.g*(1-f.a), b:f.b*f.a+out.b*(1-f.a), a:1 }; }
  return { col:out, foto };
}
const _insContraste = (L1,L2) => (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
// Mide un banner ya pintado. Devuelve { ok, fallos:[{id,que,detalle}], datos }.
function inspeccionarCmp(cmp){
  // LIENZO LIBRE: las comprobaciones no son las mismas. No existe "el título"
  // ni "el botón" —los pone el usuario, y puede no ponerlos—, y el solape ya no
  // es un fallo: poner un texto ENCIMA de una figura es justamente el modelo.
  // Quedan las que sí siguen siendo ciertas: que nada se salga del marco, que
  // nada quede por debajo del piso de legibilidad y que el texto se lea.
  if(cmp.classList.contains("cmp-libre")) return inspeccionarLibre(cmp);
  const fallos = [];
  if(!cmp) return { ok:false, fallos:[{id:"vacio",que:"No se pudo medir el banner"}], datos:{} };
  const fmt = cmp.dataset.fmt || "display-300x250";
  const g = geomDe(fmt);
  const marco = cmp.getBoundingClientRect();
  const W = g.ancho, H = g.alto;
  // El tablero y el lienzo pintan el banner con transform:scale(), y
  // getBoundingClientRect devuelve píxeles de PANTALLA. Sin dividir por la
  // escala real, cada elemento parecía desbordar el marco. Todo lo que sigue
  // está en coordenadas del banner (píxeles de verdad, los del export).
  const s = marco.width > 0 ? marco.width / W : 1;
  const el = {}, C = {};
  for(const k in INSPECTOR_SELS) el[k] = cmp.querySelector(INSPECTOR_SELS[k]);
  for(const k in el){
    if(!el[k]){ C[k]=null; continue; }
    const r = el[k].getBoundingClientRect();
    C[k] = { x:(r.left-marco.left)/s, y:(r.top-marco.top)/s, w:r.width/s, h:r.height/s,
             r:(r.right-marco.left)/s, b:(r.bottom-marco.top)/s };
  }
  const T = 1.0, nm = k => INSPECTOR_NOMBRE[k] || k;
  // 1 · DESBORDE. El círculo sale por el borde a propósito: no cuenta.
  for(const k in C){
    const c = C[k]; if(!c || !c.w || k==="bub") continue;
    if(c.x < -T || c.y < -T || c.r > W+T || c.b > H+T)
      fallos.push({ id:"desborde", que:`El ${nm(k)} se sale del marco`, detalle:`${Math.round(c.x)},${Math.round(c.y)} ${Math.round(c.w)}×${Math.round(c.h)} en ${W}×${H}` });
  }
  // Texto CORTADO: dentro de su propia caja, o recortado por su zona. Lo segundo
  // es el que se colaba: la zona se encogía, overflow:hidden tapaba el sobrante y
  // el banner salía con media frase — sin que nada lo dijera.
  ["tit","cue","cta","etq","legal"].forEach(k => {
    const e = el[k]; if(!e) return;
    if(e.scrollHeight > e.clientHeight+1 || e.scrollWidth > e.clientWidth+1)
      fallos.push({ id:"cortado", que:`El ${nm(k)} está cortado`, detalle:`${e.scrollWidth}×${e.scrollHeight} en ${e.clientWidth}×${e.clientHeight}` });
    // (Antes había aquí una segunda comprobación: el elemento contra su ZONA.
    //  Tenía sentido cuando las zonas recortaban; hoy no recortan, así que salir
    //  de la zona ya no esconde nada — lo cubren "colision" y "desborde".)
  });
  // El legal es de UNA línea: si el texto no cabe, hay que acortarlo (no se corta
  // la frase con puntos suspensivos y se hace como si nada).
  if(el.legal && el.legal.scrollWidth > el.legal.clientWidth+1)
    fallos.push({ id:"legal", que:"El texto legal no cabe en una línea",
      detalle:`acórtalo a ~${g.maxChars.legal} caracteres para este tamaño` });
  // PALABRA MÁS ANCHA QUE LA COLUMNA: el navegador la parte por la mitad y sale
  // "Auto protegid / o". No es un corte del sistema, es que el texto no cabe: hay
  // que reescribirlo más corto, que es la regla 3 del manual.
  ["tit","cue"].forEach(k => {
    const e = el[k]; if(!e) return;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    const ancho = e.clientWidth/1;   // clientWidth ya viene sin escalar (layout)
    const porLinea = Math.floor(ancho/(fs*GEOM.emArial));
    const larga = (e.textContent||"").split(/\s+/).filter(Boolean).find(w => w.length > porLinea);
    if(larga) fallos.push({ id:"palabra", que:`«${larga}» no cabe a lo ancho del ${nm(k)}`,
      detalle:`caben ${porLinea} caracteres por línea: se parte a mitad de palabra` });
  });
  // 2 · COLISIÓN entre textos, y de cualquier texto con el círculo.
  const solapa = (a,b) => a&&b&&a.w&&b.w && a.x<b.r-1 && b.x<a.r-1 && a.y<b.b-1 && b.y<a.b-1;
  [["tit","cue"],["tit","cta"],["cue","cta"],["etq","tit"],["logo","tit"],["logo","etq"],
   ["tit","legal"],["cue","legal"],["cta","legal"],
   ["tit","bub"],["cue","bub"],["cta","bub"],["logo","bub"],["etq","bub"]].forEach(([a,b])=>{
    if(solapa(C[a],C[b])) fallos.push({ id:"colision", que:`El ${nm(a)} se monta sobre el ${nm(b)}` });
  });
  // Los adornos van DETRÁS y fuera de la caja de texto: si pisan un texto, no
  // vale que estén por debajo en z — se ven igual y matan el contraste.
  const svg = cmp.querySelector(".cmp-deco");
  if(svg){
    // Solo molesta donde el texto va DESNUDO: el botón, la píldora del epígrafe
    // y la banda del legal llevan fondo propio opaco y se leen igual con un
    // adorno detrás. Lo que no se puede es un adorno celeste bajo un titular
    // blanco — y eso el contraste no lo ve, porque el adorno no es su fondo sino
    // un hermano en el z.
    const desnudo = k => {
      const e = el[k]; if(!e) return false;
      let n = e;
      while(n && n!==cmp){
        const c = _insRgba(getComputedStyle(n).backgroundColor);
        if(c && c.a>=0.9) return false;
        n = n.parentElement;
      }
      return true;
    };
    const cajas = ["tit","cue","etq","cta","legal"].filter(desnudo).map(k=>C[k]).filter(c=>c&&c.w);
    [...svg.querySelectorAll("circle")].forEach(ci=>{
      const cx=+ci.getAttribute("cx"), cy=+ci.getAttribute("cy"), r=+ci.getAttribute("r");
      const caja = { x:cx-r, y:cy-r, r:cx+r, b:cy+r, w:2*r };
      if(cajas.some(t=>solapa(t,caja)))
        fallos.push({ id:"adorno", que:"Un adorno queda por detrás del texto", detalle:"los adornos van fuera de la caja de texto" });
    });
  }
  // 3 · LEGIBILIDAD.
  const cuerpos = {};
  ["tit","cue","cta","etq","legal"].forEach(k => {
    const e = el[k]; if(!e) return;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    cuerpos[k] = Math.round(fs*10)/10;
    if(fs < g.piso-0.5)
      fallos.push({ id:"legibilidad", que:`El ${nm(k)} queda ilegible`, detalle:`${Math.round(fs)} px, el mínimo de este formato es ${g.piso} px` });
  });
  // 4 · CONTRASTE.
  const contrastes = {};
  ["tit","cue","cta","etq","legal"].forEach(k => {
    const e = el[k]; if(!e) return;
    const ct = _insRgba(getComputedStyle(e).color); const fb = _insFondo(e, cmp);
    if(!ct || !fb.col) return;
    const rz = _insContraste(_insLum(ct), _insLum(fb.col));
    contrastes[k] = Math.round(rz*10)/10;
    if(rz < 4.5)
      fallos.push({ id:"contraste", que:`El ${nm(k)} no contrasta con su fondo`, detalle:`${rz.toFixed(1)}:1, el mínimo es 4,5:1${fb.foto?" (sobre foto: sube el velo)":""}` });
  });
  // 5 · COMPLETA: título, botón y logo nunca se caen.
  if(!C.tit || !C.tit.w) fallos.push({ id:"completa", que:"Falta el título" });
  if(!C.cta || !C.cta.w) fallos.push({ id:"completa", que:"Falta el botón" });
  if(!C.logo || !C.logo.w) fallos.push({ id:"completa", que:"Falta el logo" });
  // 6 · AIRE: ninguna zona muerta mayor al 30 % del alto.
  // Se mide DENTRO de la caja útil (entre los márgenes declarados), no de borde
  // a borde: el margen es aire deliberado, y contarlo hacía fallar a un 468×60
  // que solo tenía 19 px de respiro arriba y abajo. Lo que esta comprobación
  // busca es el hueco de verdad — el vertical con dos tercios vacíos.
  const cont = Object.keys(C).map(k=>C[k]).filter(c=>c&&c.w);
  const zonasEl = cmp.querySelector(".cmp-zonas");
  let y0 = 0, y1 = H;
  if(zonasEl){
    const zs = getComputedStyle(zonasEl);
    y0 = parseFloat(zs.paddingTop) || 0;
    y1 = H - (parseFloat(zs.paddingBottom) || 0);
    // La banda legal vive en ese margen inferior: cuenta como contenido.
    if(C.legal && C.legal.w) y1 = Math.max(y1, C.legal.b);
  }
  let racha=0, peor=0;
  for(let y=y0; y<y1; y+=2){
    const hay = cont.some(c => c.y-2<=y && y<=c.b+2);
    if(hay) racha=0; else { racha+=2; if(racha>peor) peor=racha; }
  }
  const muerta = Math.round(peor/H*100);
  if(muerta > 30) fallos.push({ id:"aire", que:`Queda un hueco vacío del ${muerta} % del alto`, detalle:"el máximo es 30 %" });
  return { ok:!fallos.length, fallos, datos:{ fmt, cuerpos, contrastes, muerta, nivel:+(cmp.dataset.nivel||0) } };
}
// Renderiza un banner en `host` y, si el inspector lo rechaza, lo REHACE bajando
// un peldaño de la escalera de caída. Hasta tres intentos; si sigue fallando se
// entrega con el aviso visible — nunca en silencio.
function pintarBannerInspeccionado(host, comp, fmt, opciones){
  const o = opciones||{};
  let nivel = 0, rep = null;
  for(let intento=0; intento<3; intento++){
    host.innerHTML = renderComposicion(comp, fmt, nivel);
    rep = inspeccionarCmp(host.querySelector(".cmp"));
    if(rep.ok) break;
    // Solo tiene sentido rehacer si el fallo es de espacio; un contraste malo o
    // un logo que falta no se arreglan quitando elementos.
    const deEspacio = rep.fallos.some(f => /desborde|cortado|colision|aire|adorno/.test(f.id));
    const P = planDeBanner(comp, fmt, nivel);
    if(!deEspacio || nivel >= P.peldanos) break;
    nivel++;
  }
  rep.intentos = nivel+1;
  if(!o.sinAviso){
    const cmp = host.querySelector(".cmp");
    if(cmp) cmp.dataset.inspector = rep.ok ? "ok" : "falla";
  }
  return rep;
}
// Aviso visible junto a la pieza. El inspector sigue corriendo sobre las
// ediciones del usuario: si una edición manual rompe la pieza se avisa, pero NO
// se bloquea — desde que toca algo, la responsabilidad es suya y debe saberlo.
function avisoInspectorHTML(rep){
  if(!rep || rep.ok) return "";
  const lista = rep.fallos.slice(0,4).map(f =>
    `<li>${esc(f.que)}${f.detalle?` <span class="insp-det">${esc(f.detalle)}</span>`:""}</li>`).join("");
  const mas = rep.fallos.length>4 ? `<li>y ${rep.fallos.length-4} más</li>` : "";
  return `<div class="insp-aviso" title="El inspector mide el banner ya dibujado">
    <div class="insp-tit">${svgIcon("alerta",{size:"12px"})} Revisa este tamaño</div>
    <ul>${lista}${mas}</ul></div>`;
}
