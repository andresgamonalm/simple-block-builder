/* ══════════════════════════════════════════════════════════════════
   BANNERS · PANEL  ·  funciones/comun/banners/panel.js
   ══════════════════════════════════════════════════════════════════
   QUÉ HAY AQUÍ: Plantillas de banner y el módulo de edición del panel izquierdo (chips por elemento).
   QUIÉN LO USA: MOTOR COMPARTIDO.
   SECCIONES (en orden):
     1. PLANTILLAS DE BANNER (las "gráficas modelo")
     2. MÓDULO ÚNICO DE EDICIÓN DEL BANNER
     3. EL MÓDULO DE EDICIÓN DEL BANNER (uno solo)
   ORDEN DE CARGA: lo fija editor.html; pruebas/orden-carga.js comprueba que nada
   se use antes de cargarse. Archivo clásico (no módulo): sus funciones son globales.
   ══════════════════════════════════════════════════════════════════ */
// Editor de composición (3 zonas). fmt=null → Diseño global; fmt → ajuste por tamaño.
// El MÁSTER edita el Diseño global (no un override): así "editar el máster" se
// propaga a todos los que heredan, y el máster nunca queda tapado por un override.
// Selector de DIAGRAMACION: la disposicion del banner. "Libre" = el modelo de
// 3 zonas de siempre; las demas son las diagramaciones de marca.
// ── PLANTILLAS DE BANNER (las "gráficas modelo") ────────────────────────
// Una plantilla NO es otro motor de dibujo: es una combinación guardada de
// decisiones sobre el mismo modelo de 3 zonas — dónde va el logo, cómo se
// alinea el texto, si hay círculo de oferta y dónde, si hay adornos, cuánto
// filtro lleva la foto y cómo se reparte el alto. Se hizo así a propósito:
// las diagramaciones que vivían en su propio render (LAYOUTS_MARCA) fallaban
// las comprobaciones del inspector en los 11 tamaños, porque no compartían ni
// las clases ni la escalera de prioridad. Estas heredan las dos cosas, así que
// una plantilla nunca puede romper un banner.
const PLANTILLAS_BANNER = {
  "clasico": { nombre:"Clásico", sub:"logo arriba, texto a la izquierda", set:{
    "zonas.logo.alinH":"left","zonas.logo.alinV":"top",
    "zonas.texto.alinH":"left","zonas.cta.alinH":"left",
    "prop":[25,50,25],"burbuja.visible":false,"deco.visible":false,"fondo.imagen.oscurecer":40 } },
  "oferta": { nombre:"Oferta", sub:"la cifra manda, en un círculo", set:{
    "zonas.logo.alinH":"left","zonas.logo.alinV":"top",
    "zonas.texto.alinH":"left","zonas.cta.alinH":"left",
    "prop":[22,53,25],"burbuja.visible":true,"burbuja.pos":"tr","deco.visible":false,"fondo.imagen.oscurecer":45 } },
  "centrado": { nombre:"Centrado", sub:"todo al centro, con adornos", set:{
    "zonas.logo.alinH":"center","zonas.logo.alinV":"top",
    "zonas.texto.alinH":"center","zonas.cta.alinH":"center",
    "prop":[24,50,26],"burbuja.visible":false,"deco.visible":true,"fondo.imagen.oscurecer":50 } },
  "foto": { nombre:"Sobre la foto", sub:"la fotografía manda, texto abajo", set:{
    "zonas.logo.alinH":"left","zonas.logo.alinV":"top",
    "zonas.texto.alinH":"left","zonas.texto.alinV":"bottom","zonas.cta.alinH":"left",
    "prop":[20,45,35],"burbuja.visible":false,"deco.visible":false,"fondo.imagen.oscurecer":58 } },
  "tipografico": { nombre:"Tipográfico", sub:"sin foto, manda el mensaje", set:{
    "zonas.logo.alinH":"left","zonas.logo.alinV":"top",
    "zonas.texto.alinH":"left","zonas.cta.alinH":"left",
    "prop":[20,55,25],"burbuja.visible":false,"deco.visible":true,"fondo.tipo":"color" } }
};
function aplicarPlantillaBanner(k, fmt){
  const P = PLANTILLAS_BANNER[k]; if(!P) return;
  const p = pieza(); if(!esComposicion(p)) return;
  // La plantilla NO toca el contenido: ni textos, ni colores de marca, ni la
  // foto elegida. Solo la disposición.
  Object.keys(P.set).forEach(path=>{
    const val = P.set[path];
    if(fmt) setCompOv(fmt, path, Array.isArray(val)?val.slice():val);
    else    setComp(path, Array.isArray(val)?val.slice():val);
  });
  // El círculo solo se enciende si de verdad hay una oferta con cifra.
  const C = fmt ? composicionEfectiva(p,fmt) : p.composicion;
  if(P.set["burbuja.visible"]===true && !tieneCifra(getPath(C,"burbuja.texto")||"")){
    if(fmt) setCompOv(fmt,"burbuja.visible",false); else setComp("burbuja.visible",false);
  }
  p._plantilla = k;
  persistir(); renderTablero(); renderComposicionEditor();
  toast(`Plantilla «${P.nombre}» aplicada a ${fmt?"este tamaño":"todos los tamaños"}`);
}
// Miniatura de verdad: se dibuja con el MISMO render del banner, con la
// plantilla aplicada sobre el contenido real de la pieza. Lo que ves es lo que
// sale.
function miniaturaPlantilla(p, k){
  const base = clone(p.composicion || composicionDefault(p.tema));
  Object.keys(PLANTILLAS_BANNER[k].set).forEach(path=>{
    const v = PLANTILLAS_BANNER[k].set[path];
    setPath(base, path, Array.isArray(v)?v.slice():v);
  });
  if(getPath(base,"burbuja.visible")===true && !tieneCifra(getPath(base,"burbuja.texto")||""))
    setPath(base,"burbuja.visible",false);
  const W=300,H=250,esc=0.34;
  return `<div class="plt-mini" aria-hidden="true" style="width:${Math.round(W*esc)}px;height:${Math.round(H*esc)}px;">`+
    `<div class="plt-scale" style="width:${W}px;height:${H}px;transform:scale(${esc});">${renderComposicion(base,"display-300x250")}</div></div>`;
}
function selectorLayout(C, RE){
  const p = pieza(); if(!p || !esComposicion(p)) return "";
  const act = p._plantilla || "";
  const fmt = (typeof arguments[2]!=="undefined") ? arguments[2] : null;
  return `<div class="se-h">${svgIcon("plantilla",{size:"15px"})} Plantilla</div>`+
    `<div class="plt-grid">`+
    Object.keys(PLANTILLAS_BANNER).map(k=>{
      const P=PLANTILLAS_BANNER[k];
      return `<button type="button" class="plt-op${act===k?" on":""}" onclick="aplicarPlantillaBanner('${k}',${fmt?`'${fmt}'`:"null"})" title="${escAttr(P.sub)}">`+
             miniaturaPlantilla(p,k)+`<span class="plt-nom">${esc(P.nombre)}</span></button>`;
    }).join("")+
    `</div><p class="se-nota">La plantilla cambia la <b>disposición</b>: no toca tus textos, tus colores ni tu foto.</p>`;
}
// ── MÓDULO ÚNICO DE EDICIÓN DEL BANNER ──────────────────────────────────
// Un banner tiene siete elementos: logo, epígrafe, título, bajada, botón,
// oferta y legal, sobre un fondo. Este panel es UNO SOLO y funciona por
// ELEMENTO SELECCIONADO: eliges uno (en la fila de arriba o haciendo clic
// sobre él en el banner) y ves TODOS sus controles a la vez — su texto, su
// tipografía, su tamaño, su color y su posición. Nada de bucear en acordeones.
//
// Escribe por los mismos mutadores de siempre (setComp / setCompOv) y respeta
// el alcance: si editas el máster cambia el diseño de todos los tamaños; si
// editas otro tamaño, solo ese.
let elSelComp = "titulo";
function elegirElemento(k){
  elSelComp = k;
  renderComposicionEditor();
  // Marca el elemento en el banner grande para que se vea cuál es.
  setTimeout(()=>{ const l=document.querySelector(".lienzo-ovl"); if(l) l.dataset.sel=k; }, 30);
}
let _refrescoPanel = null;
function refrescarPanelBanner(){
  clearTimeout(_refrescoPanel);
  _refrescoPanel = setTimeout(()=>{
    const ed = document.getElementById("comp-editor");
    if(!ed || !ed.innerHTML) return;
    const p = pieza(); if(!p || !esComposicion(p)) return;
    const act = p.activaFmt || p.masterFmt;
    const fmt = (act && act !== (p.masterFmt||"display-300x250")) ? act : null;
    const C = fmt ? composicionEfectiva(p,fmt) : (p.composicion||composicionDefault(p.tema));
    // Chips: cuáles tienen contenido y cuál está elegido.
    ed.querySelectorAll(".se-chip").forEach((b,i)=>{
      const e = ELEMENTOS_COMP[i]; if(!e) return;
      const vacio = e.ruta ? !String(getPath(C,e.ruta)||"").trim() : false;
      b.classList.toggle("vacio", vacio);
      b.classList.toggle("on", elSelComp===e.k);
    });
    // Miniaturas de plantilla: se redibujan con el contenido real de la pieza.
    const grid = ed.querySelector(".plt-grid");
    if(grid) grid.querySelectorAll(".plt-op").forEach(op=>{
      const k = (/aplicarPlantillaBanner\('([^']+)'/.exec(op.getAttribute("onclick"))||[])[1];
      if(!k) return;
      const mini = op.querySelector(".plt-mini");
      if(mini) mini.outerHTML = miniaturaPlantilla(p, k);
    });
  }, 420);
}
// −/+ de un número: sumar y restar es lo que se hace de verdad con un tamaño.
function nudgeComp(path, delta, mn, mx, fmt){
  const p=pieza(); if(!esComposicion(p)) return;
  const C = fmt ? composicionEfectiva(p,fmt) : p.composicion;
  const act = parseFloat(getPath(C,path));
  const base = isNaN(act) ? (mn+mx)/2 : act;
  const val = Math.max(mn, Math.min(mx, Math.round(base + delta)));
  if(fmt) setCompOv(fmt,path,val); else setComp(path,val);
  renderComposicionEditor();
}
// Los elementos del banner, en el orden en que se leen de arriba abajo.
const ELEMENTOS_COMP = [
  { k:"logo",     nom:"Logo",     ico:"imagen",    ruta:"zonas.logo.url" },
  { k:"epigrafe", nom:"Epígrafe", ico:"tag",       ruta:"zonas.texto.etiqueta.texto" },
  { k:"titulo",   nom:"Título",   ico:"documento", ruta:"zonas.texto.titular.texto" },
  { k:"bajada",   nom:"Bajada",   ico:"documento", ruta:"zonas.texto.cuerpo.texto" },
  { k:"cta",      nom:"Botón",    ico:"compartir", ruta:"zonas.cta.texto" },
  { k:"oferta",   nom:"Oferta",   ico:"estrella",  ruta:"burbuja.texto" },
  { k:"legal",    nom:"Legal",    ico:"info",      ruta:"legal" },
  { k:"fondo",    nom:"Fondo",    ico:"paleta",    ruta:null }
];
function compPanelUnico(p, fmt, ctx){
  const esMaster = !fmt || fmt === (p.masterFmt||"display-300x250");
  const isOv = !!fmt && !esMaster;
  const C = isOv ? composicionEfectiva(p,fmt) : (p.composicion||composicionDefault(p.tema));
  const RE = "renderComposicionEditor()";
  const F  = fmt ? FORMATOS[fmt] : null;
  const S  = (path,expr)=> isOv ? `setCompOv('${fmt}','${path}',${expr})` : `setComp('${path}',${expr})`;
  const SV = (path,val )=> isOv ? `setCompOv('${fmt}','${path}','${val}')` : `setComp('${path}','${val}')`;
  const TG = (path)=> isOv ? `setCompOvTog('${fmt}','${path}')` : `setCompTog('${path}')`;
  const NUMF = isOv ? `'${fmt}'` : "null";
  const V  = (path)=> escAttr(getPath(C,path)||"");
  const N  = (path,def)=> { const v=parseFloat(getPath(C,path)); return isNaN(v)?def:v; };

  // ── Piezas de formulario, todas del mismo tamaño y con su nombre encima ──
  const fTexto = (etq,path,ph,multi)=> multi
    ? `<div class="se-f"><label>${etq}</label><textarea placeholder="${escAttr(ph)}" oninput="${S(path,'this.value')}">${esc(getPath(C,path)||'')}</textarea></div>`
    : `<div class="se-f"><label>${etq}</label><input type="text" placeholder="${escAttr(ph)}" value="${V(path)}" oninput="${S(path,'this.value')}"></div>`;
  const fFuente = (path)=>`<div class="se-f"><label>Tipografía</label><select onchange="${S(path,'this.value')};${RE}">`+
    `<option value="">La del banner</option>`+
    FUENTES.map(([v,l])=>`<option value="${esc(v)}" ${(getPath(C,path)||'')===v?'selected':''}>${esc(l)}</option>`).join("")+`</select></div>`;
  // Tamaño: número escribible + los botones − y +, que es como se ajusta de verdad.
  const fTam = (etq,path,mn,mx,def)=>`<div class="se-f se-tam"><label>${etq}</label><div class="se-tamrow">`+
    `<button type="button" onclick="nudgeComp('${path}',-1,${mn},${mx},${NUMF})" title="Más chico">−</button>`+
    `<input type="number" min="${mn}" max="${mx}" value="${N(path,def)}" oninput="${isOv?`setCompOvN('${fmt}','${path}',this.value,${mn},${mx})`:`setCompN('${path}',this.value,${mn},${mx})`}" onchange="${RE}">`+
    `<button type="button" onclick="nudgeComp('${path}',1,${mn},${mx},${NUMF})" title="Más grande">+</button>`+
    `<span class="se-un">px</span></div></div>`;
  const fColor = (etq,path,def)=>`<div class="se-col"><label>${esc(etq)}</label>`+
    `<input type="color" value="${esc(getPath(C,path)||def)}" oninput="${S(path,'this.value')}">`+
    `<div class="se-sw">${swatchesColor(path, isOv?fmt:null)}</div>`+
    `<input type="text" class="se-hex" placeholder="#hex" value="${V(path)}" onchange="${S(path,'this.value')};${RE}"></div>`;
  const fAlinH = (etq,path,def)=>`<div class="se-f"><label>${etq}</label><div class="cmp-alin">`+
    ['left','center','right'].map(a=>`<button class="${(getPath(C,path)||def)===a?'on':''}" onclick="${SV(path,a)};${RE}" title="${a}">${ICONS[a==='left'?'alignLeft':a==='center'?'alignCenter':'alignRight']}</button>`).join("")+
    `</div></div>`;
  const fAlinV = (etq,path,def)=>`<div class="se-f"><label>${etq}</label><div class="cmp-alin">`+
    [['top','Arriba'],['center','Centro'],['bottom','Abajo']].map(([a,l])=>`<button class="${(getPath(C,path)||def)===a?'on':''}" onclick="${SV(path,a)};${RE}">${l}</button>`).join("")+
    `</div></div>`;
  const fEstilo = (base)=>`<div class="se-f"><label>Estilo</label><div class="cmp-alin cmp-estilo">`+
    `<button class="${getPath(C,base+'.negrita')===true?'on':''}" title="Negrita" onclick="${TG(base+'.negrita')};${RE}"><b>B</b></button>`+
    `<button class="${getPath(C,base+'.italica')===true?'on':''}" title="Cursiva" onclick="${TG(base+'.italica')};${RE}"><i>i</i></button></div></div>`;

  // ── Fila de elementos: se elige cuál se edita ──────────────────────────
  const chips = ELEMENTOS_COMP.map(e=>{
    const vacio = e.ruta ? !String(getPath(C,e.ruta)||"").trim() : false;
    return `<button type="button" class="se-chip${elSelComp===e.k?' on':''}${vacio?' vacio':''}" onclick="elegirElemento('${e.k}')" title="${vacio?'Todavía sin contenido':''}">`+
           `${svgIcon(e.ico,{size:"14px"})} ${esc(e.nom)}</button>`;
  }).join("");
  let h = `<div class="se-h">${svgIcon("editar",{size:"15px"})} ¿Qué elemento quieres editar?</div>`;
  h += `<div class="se-chips">${chips}</div>`;
  h += `<p class="se-nota">También puedes hacer <b>clic sobre el elemento en el banner</b> de arriba, y arrastrarlo para moverlo.</p>`;

  // ── Controles del elemento seleccionado ───────────────────────────────
  h += `<div class="se-elem">`;
  if(elSelComp==="logo"){
    h += `<div class="se-h2">${svgIcon("imagen",{size:"14px"})} Logo</div>`;
    h += `<div class="se-acc"><button type="button" onclick="usarLogoMarcaEnZona(${NUMF})">${svgIcon("paleta",{size:"14px"})} El de la marca</button>`+
         `<button type="button" onclick="elegirImagenPath('zonas.logo.url',${NUMF})">${svgIcon("imagen",{size:"14px"})} Elegir otro</button></div>`;
    h += `<div class="se-f"><label>Dirección del archivo</label><input type="text" placeholder="${isOv?'Hereda del diseño general':'URL del logo (PNG/SVG)'}" value="${escAttr(isOv?(getPath(ovDeFmt(p,fmt),'zonas.logo.url')||""):(getPath(C,'zonas.logo.url')||""))}" onchange="${S('zonas.logo.url','this.value')}"></div>`;
    h += fTam("Alto del logo",'zonas.logo.alto',10,200,40);
    h += fTam("Ancho máximo (%)",'zonas.logo.maxw',15,100,70);
    h += fAlinH("Posición horizontal",'zonas.logo.alinH','left');
    h += fAlinV("Posición vertical",'zonas.logo.alinV','center');
    h += `<p class="se-nota">En el banner puedes <b>arrastrar el logo</b> para moverlo y usar su tirador para agrandarlo o achicarlo.</p>`;
  }
  else if(elSelComp==="epigrafe"){
    h += `<div class="se-h2">${svgIcon("tag",{size:"14px"})} Epígrafe <small>la píldora chica sobre el título</small></div>`;
    h += fTexto("Texto",'zonas.texto.etiqueta.texto',"Ej. Seguro Auto (opcional)");
    h += fTam("Tamaño de letra",'zonas.texto.etiqueta.tamano',7,40,11);
    h += fColor("Fondo",'zonas.texto.etiqueta.color','#3d55a8');
    h += fColor("Letra",'zonas.texto.etiqueta.colorTexto','#ffffff');
  }
  else if(elSelComp==="titulo" || elSelComp==="bajada"){
    const esTit = elSelComp==="titulo";
    const B = esTit ? 'zonas.texto.titular' : 'zonas.texto.cuerpo';
    h += `<div class="se-h2">${svgIcon("documento",{size:"14px"})} ${esTit?"Título":"Bajada"} <small>${esTit?"el mensaje principal":"la frase de apoyo"}</small></div>`;
    h += fTexto("Texto",B+'.texto', esTit?"Protege lo que más quieres":"Contrátalo en línea en 3 minutos", !esTit);
    h += fFuente('zonas.texto.fuente');
    h += fTam("Tamaño de letra",B+'.tamano', esTit?10:8, esTit?200:140, esTit?26:13);
    h += fEstilo(B);
    h += fColor("Color",B+'.color','#ffffff');
    h += fAlinH("Alineación",'zonas.texto.alinH','left');
    h += fAlinV("Posición del bloque de texto",'zonas.texto.alinV','center');
    h += fTam("Ancho de la caja (%)",B+'.ancho',20,100,100);
    h += `<p class="se-nota">También puedes escribir <b>directamente sobre el banner</b>: haz clic en el texto y edítalo ahí.</p>`;
  }
  else if(elSelComp==="cta"){
    h += `<div class="se-h2">${svgIcon("compartir",{size:"14px"})} Botón</div>`;
    h += fTexto("Texto del botón",'zonas.cta.texto',"Cotiza aquí");
    h += fTexto("Link al que lleva",'zonas.cta.url',"https://…");
    h += fFuente('zonas.cta.fuente');
    h += fTam("Tamaño de letra",'zonas.cta.tamano',8,120,13);
    h += fEstilo('zonas.cta');
    h += fColor("Fondo del botón",'zonas.cta.colorFondo','#2f80ed');
    h += fColor("Letra",'zonas.cta.colorTexto','#ffffff');
    h += fTam("Redondeo de las esquinas",'zonas.cta.radio',0,60,0);
    h += fAlinH("Alineación",'zonas.cta.alinH','left');
    h += fAlinV("Posición vertical",'zonas.cta.alinV','center');
  }
  else if(elSelComp==="oferta"){
    h += `<div class="se-h2">${svgIcon("estrella",{size:"14px"})} Oferta <small>el círculo de promoción</small></div>`;
    h += `<div class="se-f"><label>Texto de la oferta <small>· se enciende al escribirla</small></label><input type="text" placeholder="Ej. 60% dcto. · 2 cuotas gratis" value="${V('burbuja.texto')}" oninput="setCompOferta(this.value,${NUMF})"></div>`;
    h += fTam("Tamaño del círculo",'burbuja.tamano',40,400,96);
    h += fColor("Color del círculo",'burbuja.color','#FCE865');
    h += fColor("Letra",'burbuja.colorTexto','#040764');
    h += `<div class="se-f"><label>Posición</label><select onchange="${S('burbuja.pos','this.value')};${RE}">`+
      [['tr','Arriba derecha'],['cr','Centro derecha'],['br','Abajo derecha'],['tl','Arriba izquierda'],['bl','Abajo izquierda']]
      .map(([v,l])=>`<option value="${v}" ${(getPath(C,'burbuja.pos')||'tr')===v?'selected':''}>${l}</option>`).join("")+`</select></div>`;
    h += `<p class="se-nota">Si el texto parte con un número («60% dcto.»), el número sale grande. En el banner puedes <b>arrastrar el círculo</b> para moverlo.</p>`;
  }
  else if(elSelComp==="legal"){
    h += `<div class="se-h2">${svgIcon("info",{size:"14px"})} Legal <small>una línea, en la banda de abajo</small></div>`;
    h += fTexto("Texto legal",'legal',"Ej. Sujeto a evaluación. Infórmate en el sitio.");
    h += fTam("Tamaño de letra",'legalTamano',6,40,9);
    h += `<p class="se-nota">Va en su propia banda inferior, nunca encima de la foto. En los formatos más chicos cae, porque no hay sitio para una línea legible.</p>`;
  }
  else {   // fondo
    const esFoto = (getPath(C,'fondo.tipo')||'color')==='imagen';
    h += `<div class="se-h2">${svgIcon("paleta",{size:"14px"})} Fondo del banner</div>`;
    h += `<div class="se-seg2"><button type="button" class="${esFoto?'':'on'}" onclick="setCompFoto('',${NUMF})">Color</button>`+
         `<button type="button" class="${esFoto?'on':''}" onclick="elegirImagenPath('fondo.imagen.url',${NUMF})">Fotografía</button></div>`;
    h += fColor("Color de fondo",'fondo.color','#040764');
    const fotos = (workspace.imagenes||[]).filter(sirveComoFondo).slice(0,7);
    const urlAct = String(getPath(C,'fondo.imagen.url')||"");
    h += `<div class="se-f"><label>Fotografía</label><div class="se-fotos">`+
         `<button type="button" class="se-nofoto${esFoto?'':' on'}" onclick="setCompFoto('',${NUMF})">Sin foto</button>`+
         fotos.map(im=>`<button type="button" class="${esFoto&&im.url===urlAct?'on':''}" title="${escAttr(im.nombre||im.url)}" onclick="setCompFoto('${jsAttr(im.url)}',${NUMF})"><img src="${esc(im.url)}" alt=""></button>`).join("")+
         `</div></div>`;
    if(!fotos.length){
      const total=(workspace.imagenes||[]).length;
      h += total
        ? `<div class="se-vacio">En tu biblioteca hay ${total} imagen${total===1?"":"es"}, pero ninguna sirve de fondo: son logotipos o vectores. Un logo de fondo sale gigante y deformado.</div>`
        : `<div class="se-vacio">Tu biblioteca no tiene fotos todavía. Súbelas o pídele una a Char-B.</div>`;
    }
    h += `<div class="se-acc"><button type="button" onclick="elegirImagenPath('fondo.imagen.url',${NUMF})">${svgIcon("imagen",{size:"14px"})} Toda la biblioteca</button>`+
         `<button type="button" class="se-ia" onclick="generarFondoIA()">${svgIcon("estrella",{size:"14px"})} Generar con IA</button></div>`;
    if(esFoto){
      // EL FILTRO. Es lo que oscurece la foto para que el texto se lea encima;
      // se ajusta con el deslizador y se quita del todo con el botón.
      const vel = N('fondo.imagen.oscurecer',40);
      h += `<div class="se-f"><label>Filtro oscuro sobre la foto <small>· ${vel}%</small></label>`+
           `<div class="se-tamrow"><input type="range" min="0" max="80" value="${vel}" oninput="${isOv?`setCompOvN('${fmt}','fondo.imagen.oscurecer',this.value,0,80)`:`setCompN('fondo.imagen.oscurecer',this.value,0,80)`}" onchange="${RE}">`+
           `<button type="button" class="se-quitar" onclick="${SV('fondo.imagen.oscurecer','0')};${RE}">Quitar filtro</button></div>`+
           `<p class="se-nota">El filtro existe para que el texto se lea sobre la foto. Si lo quitas del todo, revisa que el titular siga legible.</p></div>`;
      h += `<div class="se-f"><label>Encuadre</label><select onchange="${S('fondo.imagen.fit','this.value')};${RE}">`+
        [['cover','Cubrir todo el banner'],['contain','Mostrar la foto entera']].map(([v,l])=>`<option value="${v}" ${(getPath(C,'fondo.imagen.fit')||'cover')===v?'selected':''}>${l}</option>`).join("")+`</select></div>`;
      h += `<div class="se-f"><label>Parte de la foto que manda</label><select onchange="${S('fondo.imagen.foco','this.value')};${RE}">`+
        [['center','El centro'],['top','La parte de arriba'],['bottom','La de abajo'],['left','La izquierda'],['right','La derecha']].map(([v,l])=>`<option value="${v}" ${(getPath(C,'fondo.imagen.foco')||'center')===v?'selected':''}>${l}</option>`).join("")+`</select></div>`;
      h += fTam("Acercar la foto (%)",'fondo.imagen.zoom',50,300,100);
    }
  }
  h += `</div>`;

  // ── Tipografía y ajustes que valen para TODO el banner ────────────────
  if(!isOv){
    h += `<div class="se-h">${svgIcon("paleta",{size:"15px"})} Todo el banner</div>`;
    const fuenteG = getPath(C,'zonas.texto.fuente')||'';
    h += `<div class="se-f"><label>Tipografía del banner</label><select onchange="setComp('zonas.texto.fuente',this.value);setComp('zonas.cta.fuente',this.value);renderComposicionEditor()">`+
      `<option value="">La del tema</option>`+
      FUENTES.map(([v,l])=>`<option value="${esc(v)}" ${fuenteG===v?'selected':''}>${esc(l)}</option>`).join("")+`</select></div>`;
  } else {
    h += `<div class="se-h">${svgIcon("ojo",{size:"15px"})} ¿Qué se ve en ${F?F.ancho+"×"+F.alto:"este tamaño"}?</div>`;
    const tg=(path,nom,extra)=>{
      const off = extra ? getPath(C,path)!==true : getPath(C,path)===false;
      const click = extra ? `toggleExtraComp('${path}','${fmt}')` : `toggleCompVisOv('${fmt}','${path}')`;
      return `<button type="button" class="${off?'off':''}" onclick="${click}">${esc(nom)}<span class="se-tp">${off?"Oculto":"Se ve"}</span></button>`;
    };
    h += `<div class="se-toggles">`+[["logo","Logo"],["texto","Textos"],["cta","Botón"]].map(([k,n])=>tg('zonas.'+k+'.visible',n)).join("")
       + tg('burbuja.visible','Círculo de oferta',true) + tg('deco.visible','Adornos',true) + `</div>`;
  }
  h += `<details class="se-avz"><summary>Ajustes finos (proporciones de las zonas, márgenes, adornos, fondo por zona)</summary><div>${compEditorHTML(p,fmt,ctx)}</div></details>`;
  return h;
}
// Se conserva el nombre anterior: lo llaman renderComposicionEditor y renderFormTamaño.
function compEditorSimple(p, fmt, ctx){ return compPanelUnico(p, fmt, ctx); }
// La oferta y el círculo son una sola cosa para el usuario: al escribir se
// enciende, al borrar se apaga. Antes eran dos pasos y el segundo se olvidaba.
function setCompOferta(txt, fmt){
  const t = String(txt||"");
  if(fmt){ setCompOv(fmt,'burbuja.texto',t); setCompOv(fmt,'burbuja.visible', !!t.trim()); }
  else   { setComp('burbuja.texto',t);       setComp('burbuja.visible', !!t.trim()); }
}
// "Sin foto" vuelve al fondo de color en vez de dejar una imagen vacía puesta.
function setCompFoto(url, fmt){
  const u = String(url||"");
  const set = (p,v)=> fmt ? setCompOv(fmt,p,v) : setComp(p,v);
  if(u){ set('fondo.imagen.url',u); set('fondo.tipo','imagen'); }
  else { set('fondo.tipo','color'); }
  renderComposicionEditor();
}
function compEditorHTML(p, fmt, ctx){
  const esMaster = !!fmt && fmt === (p.masterFmt||"display-300x250");
  const isOv = !!fmt && !esMaster;
  const C = isOv ? composicionEfectiva(p,fmt) : (p.composicion||composicionDefault(p.tema));
  const ov = isOv ? ovDeFmt(p,fmt) : null;
  const RE = "renderComposicionEditor()";
  const S = (path,expr)=> isOv ? `setCompOv('${fmt}','${path}',${expr})` : `setComp('${path}',${expr})`;
  const SV = (path,val)=> isOv ? `setCompOv('${fmt}','${path}','${val}')` : `setComp('${path}','${val}')`;
  const NUM = (path,mn,mx)=> isOv ? `setCompOvN('${fmt}','${path}',this.value,${mn},${mx})` : `setCompN('${path}',this.value,${mn},${mx})`;
  const TG = (path)=> isOv ? `setCompOvTog('${fmt}','${path}')` : `setCompTog('${path}')`;
  // Numéricos: clamp en vivo (no se aceptan dimensiones fuera de rango) y al salir se corrige el campo.
  const rng=(path,mn,mx,base)=>`<input type="number" class="cmp-num" min="${mn}" max="${mx}" value="${parseInt(getPath(C,path))||base}" oninput="${NUM(path,mn,mx)}" onchange="${NUM(path,mn,mx)};${RE}">`;
  const colorInp=(path,def)=>`<input type="color" value="${esc(getPath(C,path)||def)}" oninput="${S(path,'this.value')}">`;
  const hexInp=(path)=>`<input type="text" class="cmp-hex" placeholder="#hex" value="${esc(getPath(C,path)||'')}" onchange="${S(path,'this.value')};${RE}">`;
  const selFuente=(path)=>`<select onchange="${S(path,'this.value')};${RE}">${FUENTES.map(([v,l])=>`<option value="${esc(v)}" ${(getPath(C,path)||'')===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const togBtns=(base)=>`<div class="cmp-alin cmp-estilo"><button class="${getPath(C,base+'.negrita')===true?'on':''}" title="Negrita" onclick="${TG(base+'.negrita')};${RE}"><b>B</b></button><button class="${getPath(C,base+'.italica')===true?'on':''}" title="Cursiva" onclick="${TG(base+'.italica')};${RE}"><i>i</i></button></div>`;
  const selFit=(base)=>`<select onchange="${S(base+'.fit','this.value')}">${[['cover','Cubrir'],['contain','Contener']].map(([v,l])=>`<option value="${v}" ${(getPath(C,base+'.fit')||'cover')===v?'selected':''}>${l}</option>`).join('')}</select>`;
  const selFoco=(base)=>`<select onchange="${S(base+'.foco','this.value')}">${['center','top','bottom','left','right'].map(v=>`<option value="${v}" ${(getPath(C,base+'.foco')||'center')===v?'selected':''}>${v}</option>`).join('')}</select>`;
  const alinH=(path)=>`<div class="cmp-alin">${['left','center','right'].map(a=>`<button class="${(getPath(C,path)||'left')===a?'on':''}" onclick="${SV(path,a)};${RE}" title="${a}">${ICONS[a==='left'?'alignLeft':a==='center'?'alignCenter':'alignRight']}</button>`).join('')}</div>`;
  const alinV=(path)=>`<div class="cmp-alin">${[['top','chevup'],['center','-'],['bottom','chevdown']].map(([a,ic])=>`<button class="${(getPath(C,path)||'center')===a?'on':''}" onclick="${SV(path,a)};${RE}" title="${a}">${ic==='-'?'─':svgIcon(ic,{size:'13px'})}</button>`).join('')}</div>`;
  const imgBlock=(base)=>{
    const urlVal = isOv ? (getPath(ov,base+'.url')||"") : (getPath(C,base+'.url')||"");
    const ph = isOv ? "Hereda del global" : "URL imagen";
    let s=`<div class="cmp-row"><input type="text" placeholder="${ph}" value="${escAttr(urlVal)}" onchange="${S(base+'.url','this.value')}"><button class="cmp-bib" onclick="elegirImagenPath('${base}.url',${isOv?`'${fmt}'`:'null'})">${svgIcon("imagen",{size:"12px"})}</button></div>`;
    s+=miniaturasBiblioteca(base+'.url', isOv?fmt:null);
    s+=`<div class="cmp-row"><label>Ajuste</label>${selFit(base)}</div><div class="cmp-row"><label>Zoom</label>${rng(base+'.zoom',50,300,100)}</div><div class="cmp-row"><label>Foco</label>${selFoco(base)}</div><div class="cmp-row"><label>Oscurecer</label>${rng(base+'.oscurecer',0,80,40)}</div>`;
    return s;
  };
  const zonaBg=(zk)=>{
    const mode=getPath(C,'zonas.'+zk+'.bg')||'hereda';
    let s=`<div class="cmp-row"><label>Fondo</label><select onchange="${S('zonas.'+zk+'.bg','this.value')};${RE}">${[['hereda','Hereda del banner'],['color','Color propio'],['imagen','Imagen propia']].map(([v,l])=>`<option value="${v}" ${mode===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
    if(mode==='color') s+=`<div class="cmp-row">${colorInp('zonas.'+zk+'.color','#102a43')}${hexInp('zonas.'+zk+'.color')}</div><div class="cmp-row"><div class="cmp-sw-row">${swatchesColor('zonas.'+zk+'.color',isOv?fmt:null)}</div></div>`;
    else if(mode==='imagen') s+=imgBlock('zonas.'+zk+'.imagen');
    return s;
  };
  const alinRow=(zk)=>`<div class="cmp-row"><label>Posición</label>${alinH('zonas.'+zk+'.alinH')}${alinV('zonas.'+zk+'.alinV')}</div>`;
  const zonaSec=(zk,nom,icon)=>{
    const vpath='zonas.'+zk+'.visible'; const off=getPath(C,vpath)===false;
    const eyeBtn=`<button class="cmp-eye${off?' off':''}" onclick="${isOv?`toggleCompVisOv('${fmt}','${vpath}')`:`toggleCompVis('${vpath}')`}" title="Mostrar/ocultar zona">${svgIcon("ojo",{size:"13px"})}</button>`;
    const rstBtn= isOv?`<button class="cmp-eye" onclick="resetCapaTamaño('${fmt}','zonas.${zk}')" title="Volver al global">↺</button>`:'';
    return `<div class="cmp-zona-sec"><span class="zlbl">${svgIcon(icon,{size:"14px"})} ${esc(nom)}</span><span style="display:inline-flex;gap:4px">${eyeBtn}${rstBtn}</span></div>`;
  };
  let h="";
  const fondoTipo=getPath(C,'fondo.tipo')||'color';
  h+=`<div class="dz-sec">Fondo del banner (continúa en las 3 zonas)</div>`;
  h+=`<div class="cmp-row"><label>Tipo</label><select onchange="${S('fondo.tipo','this.value')};${RE}">${[['color','Color'],['imagen','Imagen']].map(([v,l])=>`<option value="${v}" ${fondoTipo===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
  if(fondoTipo==='color') h+=`<div class="cmp-row">${colorInp('fondo.color','#040764')}${hexInp('fondo.color')}</div><div class="cmp-row"><div class="cmp-sw-row" title="Colores de tu marca (solo marca)">${swatchesColor('fondo.color',isOv?fmt:null)}</div></div>`;
  else h+=imgBlock('fondo.imagen');
  // Tipografía: se elige UNA sola vez para todo el banner (título, bajada y CTA
  // usan la misma). Solo en el Diseño global (no por tamaño).
  if(!isOv){
    const fuenteG = getPath(C,'zonas.texto.fuente')||'';
    h+=`<div class="dz-sec">Tipografía del banner</div><div class="cmp-row"><select onchange="setComp('zonas.texto.fuente',this.value);setComp('zonas.cta.fuente',this.value);renderComposicionEditor()">${FUENTES.map(([v,l])=>`<option value="${esc(v)}" ${fuenteG===v?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
  }
  // Burbujas decorativas (círculos de color que asoman por los bordes, estilo campaña digital).
  const decoVis = getPath(C,'deco.visible')===true;
  h+=`<div class="cmp-zona-sec"><span class="zlbl">${svgIcon("paleta",{size:"14px"})} Burbujas decorativas</span><button class="cmp-eye${decoVis?'':' off'}" onclick="toggleExtraComp('deco.visible',${isOv?`'${fmt}'`:'null'})" title="Mostrar/ocultar burbujas de color">${svgIcon("ojo",{size:"13px"})}</button></div>`;
  if(decoVis){
    h+=`<div class="cmp-row"><label>Color 1</label>${colorInp('deco.color1','#378CE3')}${hexInp('deco.color1')}</div>`;
    h+=`<div class="cmp-row"><label>Color 2</label>${colorInp('deco.color2','#2f80ed')}${hexInp('deco.color2')}</div>`;
    h+=`<div class="cmp-row"><div class="cmp-sw-row">${swatchesColor('deco.color1',isOv?fmt:null)}</div></div>`;
  }
  h+=`<div class="cmp-hint-lienzo">${svgIcon("info",{size:"12px"})} El <b>espacio de cada zona</b> se ajusta arrastrando los divisores directamente en el banner de arriba.</div>`;
  h+=`<div class="dz-sec">Márgenes del banner (px)</div>`;
  h+=`<div class="cmp-row"><label>Arriba</label>${rng('margen.t',0,200,0)}<label style="min-width:auto;margin-left:10px">Abajo</label>${rng('margen.b',0,200,0)}</div>`;
  h+=`<div class="cmp-row"><label>Izquierda</label>${rng('margen.l',0,200,0)}<label style="min-width:auto;margin-left:10px">Derecha</label>${rng('margen.r',0,200,0)}</div>`;
  h+=zonaSec('logo','Logo','imagen')+alinRow('logo')+zonaBg('logo');
  const logoUrl = isOv ? (getPath(ov,'zonas.logo.url')||"") : (getPath(C,'zonas.logo.url')||"");
  h+=`<div class="cmp-row"><input type="text" placeholder="${isOv?'Hereda del global':'URL logo (PNG/SVG)'}" value="${escAttr(logoUrl)}" onchange="${S('zonas.logo.url','this.value')}"><button class="cmp-bib" onclick="usarLogoMarcaEnZona(${isOv?`'${fmt}'`:'null'})" title="Usar el logo de la marca aplicada">${svgIcon("paleta",{size:"12px"})}</button><button class="cmp-bib" onclick="elegirImagenPath('zonas.logo.url',${isOv?`'${fmt}'`:'null'})" title="Elegir de la biblioteca">${svgIcon("imagen",{size:"12px"})}</button></div>`;
  h+=miniaturasBiblioteca('zonas.logo.url', isOv?fmt:null);
  h+=`<div class="cmp-row"><label>Alto</label>${rng('zonas.logo.alto',16,160,48)}</div><div class="cmp-row"><label>Ancho máx</label>${rng('zonas.logo.maxw',15,100,70)}</div>`;
  h+=zonaSec('texto','Texto','documento')+alinRow('texto')+zonaBg('texto');
  // Cada parte del texto, individualizada y con su nombre claro.
  h+=`<div class="cmp-parte">Epígrafe <small>(píldora chica sobre el título)</small></div>`;
  h+=`<div class="cmp-row"><input type="text" placeholder="Ej. Seguro Auto (opcional)" value="${escAttr(getPath(C,'zonas.texto.etiqueta.texto')||'')}" oninput="${S('zonas.texto.etiqueta.texto','this.value')}"></div>`;
  h+=`<div class="cmp-row"><label>Color</label>${colorInp('zonas.texto.etiqueta.color','#3d55a8')}${colorInp('zonas.texto.etiqueta.colorTexto','#ffffff')}<label style="min-width:auto;margin-left:10px">Tam.</label>${rng('zonas.texto.etiqueta.tamano',8,20,11)}</div>`;
  h+=`<div class="cmp-parte">Título</div>`;
  h+=`<div class="cmp-row"><input type="text" placeholder="El mensaje principal" value="${escAttr(getPath(C,'zonas.texto.titular.texto')||'')}" oninput="${S('zonas.texto.titular.texto','this.value')}"></div>`;
  h+=`<div class="cmp-row"><label>Tamaño</label>${rng('zonas.texto.titular.tamano',12,60,26)}${colorInp('zonas.texto.titular.color','#ffffff')}<label style="min-width:auto;margin-left:10px">Estilo</label>${togBtns('zonas.texto.titular')}</div>`;
  h+=`<div class="cmp-parte">Bajada <small>(texto de apoyo)</small></div>`;
  h+=`<div class="cmp-row"><textarea placeholder="Una frase breve de apoyo" oninput="${S('zonas.texto.cuerpo.texto','this.value')}">${esc(getPath(C,'zonas.texto.cuerpo.texto')||'')}</textarea></div>`;
  h+=`<div class="cmp-row"><label>Tamaño</label>${rng('zonas.texto.cuerpo.tamano',9,32,13)}${colorInp('zonas.texto.cuerpo.color','#ffffff')}<label style="min-width:auto;margin-left:10px">Estilo</label>${togBtns('zonas.texto.cuerpo')}</div>`;
  h+=zonaSec('cta','Botón (CTA)','compartir')+alinRow('cta')+zonaBg('cta');
  h+=`<div class="cmp-row"><input type="text" placeholder="Texto del botón" value="${escAttr(getPath(C,'zonas.cta.texto')||'')}" oninput="${S('zonas.cta.texto','this.value')}"></div>`;
  h+=`<div class="cmp-row"><input type="text" placeholder="Link (https://…)" value="${escAttr(getPath(C,'zonas.cta.url')||'')}" onchange="${S('zonas.cta.url','this.value')}"></div>`;
  h+=`<div class="cmp-row"><label>Colores</label>${colorInp('zonas.cta.colorFondo','#2f80ed')}${colorInp('zonas.cta.colorTexto','#ffffff')}<label style="min-width:auto;margin-left:10px">Estilo</label>${togBtns('zonas.cta')}</div>`;
  h+=`<div class="cmp-row"><label>Tamaño</label>${rng('zonas.cta.tamano',11,40,13)}<span class="cmp-unit">px</span><label style="min-width:auto;margin-left:12px">Radio</label>${rng('zonas.cta.radio',0,30,8)}</div>`;
  // Burbuja de OFERTA (círculo de promo sobre el banner, estilo campaña digital).
  const buVis = getPath(C,'burbuja.visible')===true;
  h+=`<div class="cmp-zona-sec"><span class="zlbl">${svgIcon("estrella",{size:"14px"})} Burbuja de oferta (círculo)</span><button class="cmp-eye${buVis?'':' off'}" onclick="toggleExtraComp('burbuja.visible',${isOv?`'${fmt}'`:'null'})" title="Mostrar/ocultar el círculo de oferta">${svgIcon("ojo",{size:"13px"})}</button></div>`;
  if(buVis){
    h+=`<div class="cmp-row"><input type="text" placeholder="La oferta (ej. 2 Cuotas Gratis · 60% dcto.)" value="${escAttr(getPath(C,'burbuja.texto')||'')}" oninput="${S('burbuja.texto','this.value')}"></div>`;
    h+=`<div class="cmp-row"><label>Colores</label>${colorInp('burbuja.color','#FCE865')}${colorInp('burbuja.colorTexto','#040764')}</div>`;
    h+=`<div class="cmp-row"><div class="cmp-sw-row">${swatchesColor('burbuja.color',isOv?fmt:null)}</div></div>`;
    h+=`<div class="cmp-row"><label>Tamaño</label>${rng('burbuja.tamano',40,220,96)}<label style="min-width:auto;margin-left:10px">Posición</label><select onchange="${S('burbuja.pos','this.value')};${RE}">${[['tr','Arriba der.'],['cr','Centro der.'],['br','Abajo der.'],['tl','Arriba izq.'],['bl','Abajo izq.']].map(([v,l])=>`<option value="${v}" ${(getPath(C,'burbuja.pos')||'tr')===v?'selected':''}>${l}</option>`).join('')}</select></div>`;
    h+=`<p style="font-size:11px;color:#8890a8;margin:4px 0 0;line-height:1.5;">Si el texto parte con un número («2 Cuotas Gratis», «60% dcto.»), el número sale grande.</p>`;
  }
  return h;
}
// Control de ALCANCE (qué estás editando): "Todos los tamaños" vs "Solo este".
// Hace explícito el modelo (antes los rótulos "AJUSTAR… HEREDA DEL GLOBAL" no se
// entendían). Es la pieza clave para que un usuario NO técnico sepa qué toca.
function compScopeHeader(fmt){
  const p=pieza();
  const esMaster = fmt && fmt===(p.masterFmt||"display-300x250");
  // El máster edita el Diseño base (= todos), así que ahí "Todos" está activo.
  const enTodos = !fmt || esMaster;
  const F = fmt ? FORMATOS[fmt] : null;
  const etqUno = F ? `Solo ${F.ancho}×${F.alto}` : "Un tamaño";
  const btnUno = enTodos
    ? `<button type="button" onclick="toast('Haz clic en cualquier banner del tablero para ajustar solo ese tamaño')">${svgIcon("grid",{size:"13px"})} ${etqUno}</button>`
    : `<button type="button" class="on">${svgIcon("grid",{size:"13px"})} ${etqUno}</button>`;
  const btnTodos = `<button type="button" class="${enTodos?'on':''}" onclick="cambiarPanelTab('diseno')">${svgIcon("plantilla",{size:"13px"})} Todos los tamaños</button>`;
  const hint = enTodos
    ? `Lo que cambies aquí se aplica a <b>todos los tamaños</b> a la vez.`
    : `Lo que cambies aquí afecta <b>solo este tamaño</b>; los demás siguen igual.`;
  return `<div class="cmp-scope"><div class="cmp-scope-lbl">¿Qué estás editando?</div><div class="cmp-scope-seg">${btnTodos}${btnUno}</div><p class="cmp-scope-hint">${hint}</p></div>`;
}
// ── EL MÓDULO DE EDICIÓN DEL BANNER (uno solo) ──────────────────────────
// Mismo contenido lo abras por donde lo abras: alcance, marca, diagramación y
// los controles del elemento seleccionado. Lo que cambia es SOBRE QUÉ escribe:
// si el tamaño activo es el máster, sobre el diseño de todos; si es otro, solo
// sobre ese. Antes había dos paneles distintos ("Diseño global" y "Ajustar
// tamaño") y el segundo se quedó sin controles.
function moduloBannerHTML(p, fmt, ctx){
  const marcas = workspace.marcas||[];
  const C0 = p.composicion || composicionDefault(p.tema);
  const marcaSel = `<div class="se-f"><label>Marca</label><div class="se-tamrow">`+
    `<select onchange="if(this.value)aplicarMarca(this.value)">`+
    `<option value="">${marcas.length?'— Aplicar una marca —':'— Sin marcas (crea una) —'}</option>`+
    marcas.map(m=>`<option value="${m.id}" ${p.tema&&p.tema.marcaId===m.id?'selected':''}>${esc(m.nombre)}</option>`).join('')+
    `</select><button type="button" class="cmp-bib" onclick="abrirMarcas()" title="Gestionar marcas">${svgIcon("paleta",{size:"13px"})}</button></div></div>`;
  const RE = "renderComposicionEditor()";
  return `<div class="cmp-ed">${compScopeHeader(fmt)}${marcaSel}${panelFacebookHTML()}`+
    `${selectorLayout(C0, RE+";renderTablero()", fmt && fmt!==(p.masterFmt||"display-300x250") ? fmt : null)}`+
    `<button class="ia-sugerir" onclick="sugerirTextosIA()">${svgIcon("estrella",{size:"13px"})} Sugerir textos con Char-B</button>`+
    `${compPanelUnico(p, fmt, ctx)}</div>`;
}
function renderComposicionEditor(){
  const cont=document.getElementById("comp-editor"), tema=document.getElementById("diseno-tema");
  const p=pieza();
  if(!cont) return;
  if(!esComposicion(p)){ cont.style.display="none"; cont.innerHTML=""; if(tema) tema.style.display=""; return; }
  if(esLibre(p.composicion)){ cont.style.display=""; if(tema) tema.style.display="none"; return renderPanelLibre(); }
  asegurarComposicionNueva(p);
  cont.style.display=""; if(tema) tema.style.display="none";
  // Sobre el tamaño activo: si es el máster, escribe el diseño de todos.
  const act = p.activaFmt || p.masterFmt;
  const fmtMod = (act && act !== (p.masterFmt||"display-300x250")) ? act : null;
  cont.innerHTML = moduloBannerHTML(p, fmtMod, 'diseno');
  pintarIconos();
}
// El panel de un banner es UNO SOLO y vive en "diseno". Este hueco existía
// para el editor de bloques y se quedó pintando una copia invisible del módulo
// entero: mismo trabajo dos veces por cada tecla.
function renderFormTamaño(f){
  f.innerHTML = `<div class="form-empty"><div class="form-empty-ico">${svgIcon("editar",{size:"32px"})}</div>El banner se edita en el panel de la izquierda</div>`;
}
function cssComponentes(){
  const cssFull = (document.querySelector("style") && document.querySelector("style").textContent) || "";
  const i = cssFull.indexOf("COMPONENT STYLES");
  if(i < 0) return cssFull;
  const cierre = cssFull.indexOf("*/", i);
  return cierre >= 0 ? cssFull.slice(cierre + 2) : cssFull.slice(i);
}
function generarHTMLDeComposicion(p, fmt){
  const f=FORMATOS[fmt]||FORMATOS["display-300x250"];
  const css=cssComponentes();
  const fonts=`<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.tema.font)}:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">`;
  return absolutizarURLs(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(p.nombre)} · ${f.ancho}×${f.alto}</title>${fonts}
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"${p.tema.font}",Arial,sans-serif;}${css}</style></head>
<body><!--SBB-CMP:${esc(fmt)}-->${renderComposicion(composicionEfectiva(p, fmt), fmt)}</body></html>`);
}

function renderTablero(){
  const p = pieza(); if(!esSetPieza(p)) return;
  asegurarComposicionNueva(p);
  const c = document.getElementById("canvas");
  ajustarFrameParaSet(true);
  if(esComposicion(p)){ renderTableroComposicion(p, c); return; }
  const zoom = 0.7;
  let html = `<div class="tablero-hint">Clic en un banner para editarlo. Edita cada uno por separado (texto, imagen o sin imagen). El <b>máster</b> puedes aplicarlo a todos con el botón de arriba.</div><div class="tablero">`;
  p.artboards.forEach(ab => {
    const fmt = FORMATOS[ab.fmt]; if(!fmt) return;
    const activo = ab.fmt === p.activaFmt;
    const master = ab.fmt === p.masterFmt;
    const blocks = ab.canvas || [];
    const inner = blocks.length
      ? (activo ? blocks.map(bwHTML).join("") : blocks.map(it => BLOQUES[it.tipo].render(it.datos)).join(""))
      : `<div class="ab-empty">${activo ? "Añade bloques desde la izquierda" : "vacío"}</div>`;
    html += `<div class="ab${activo?' activo':''}${master?' master':''}" data-fmt="${ab.fmt}">
      <div class="ab-bar"><span class="ab-tit">${fmt.ancho}×${fmt.alto}${master?' <span class="mtag">máster</span>':''}${activo?' <span class="acttag">editando</span>':''}</span><button class="ab-dl" onclick="exportarArtboard('${ab.fmt}');event.stopPropagation();" title="Descargar este banner">${svgIcon("exportar",{size:"12px"})}</button></div>
      <div class="ab-stage" style="width:${Math.round(fmt.ancho*zoom)}px;height:${Math.round(fmt.alto*zoom)}px;">
        <div class="ab-scale" style="transform:scale(${zoom});">
          <div class="ab-frame ${ab.orient||'columna'}" data-fmt="${ab.fmt}" style="width:${fmt.ancho}px;height:${fmt.alto}px;${temaVars(p.tema)};background:${esc(p.tema.bg)};">${inner}</div>
        </div>
      </div>
    </div>`;
  });
  html += `</div>`;
  c.innerHTML = html;
  const activoFrame = c.querySelector(".ab.activo .ab-frame");
  if(activoFrame) attachBwListeners(activoFrame);
  c.querySelectorAll(".ab:not(.activo)").forEach(el => el.addEventListener("click", () => activarArtboard(el.dataset.fmt)));
  iniciarLivePreview();
}
function activarArtboard(fmt){
  const p = pieza(); if(!esSetPieza(p)) return;
  p.activaFmt = fmt; seleccionado = null;
  renderCanvas(); renderForm();
}
function aplicarMasterATodos(){
  const p = pieza(); if(!esSetPieza(p)) return;
  if(esComposicion(p)){
    // Colección por zonas: el máster efectivo (global + su ajuste) pasa a ser el
    // Diseño global, y se limpian TODOS los ajustes por tamaño → todos heredan.
    if(!confirm("¿Aplicar el diseño del banner máster a TODOS los tamaños? Se borran los ajustes individuales y todos heredan del máster.")) return;
    const mf = p.masterFmt || "display-300x250";
    p.composicion = clone(composicionEfectiva(p, mf));
    (p.artboards||[]).forEach(ab => { ab.ov = {}; });
    seleccionado = null;
    persistir(); renderTablero(); renderComposicionEditor(); renderForm();
    toast("Máster aplicado a todos · los demás tamaños ahora heredan");
    return;
  }
  const master = artboardMaster(p); if(!master) return;
  if(!confirm("¿Aplicar el contenido del máster (300×250) a TODOS los tamaños? Reemplaza lo que tengas en los demás.")) return;
  p.artboards.forEach(ab => {
    if(ab.fmt === p.masterFmt){ ab.orient = "columna"; return; }
    const a = adaptarCanvasATamaño(master.canvas, ab.fmt);
    ab.canvas = a.canvas; ab.orient = a.orient;
  });
  seleccionado = null;
  persistir(); renderCanvas(); renderForm();
  toast("Máster aplicado a todos los tamaños");
}
function piezaDeArtboard(p, ab){
  const fmt = FORMATOS[ab.fmt];
  return { nombre: `${p.nombre}-${fmt.ancho}x${fmt.alto}`, formato: ab.fmt, canvas: ab.canvas || [], tema: p.tema, _orient: ab.orient || "columna" };
}
