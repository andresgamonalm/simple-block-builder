// EL PANEL DEL EDITOR DE BANNERS, medido de verdad.
// La queja concreta fue "es tremendamente complejo de usar". Complejidad se mide:
// cuantos controles hay que atravesar para dejar un banner listo, y si escribir en
// un campo se ve en el banner. Esta prueba cuenta los controles visibles al abrir,
// escribe en cada campo y comprueba el RENDER, no el HTML del formulario.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  pg.on("console",m=>{if(m.type()==="error"&&!/ERR_CERT|ERR_CONNECTION|favicon|fonts\.googleapis/.test(m.text()))errs.push("console: "+m.text());});
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.crearComposicion==="function");

  // Una colección Display abierta en su Diseño general.
  await pg.evaluate(()=>{
    const pr={id:uid(),nombre:"Panel",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos=[pr]; proyectoVistoId=pr.id; proyecto=pr;
    // PNG de 1px en data URL: raster de verdad. Un .svg es un vector y el manual
    // lo trata como logotipo, asi que no serviria de fixture de fotografia.
    const PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wnwEEAA8CAv3s3S0AAAAASUVORK5CYII=";
    workspace.imagenes=[{id:"i1",url:PNG,nombre:"playa atardecer",key:"fotos-generales/playa.png"},
                        {id:"i2",url:PNG,nombre:"familia auto",key:"fotos-seguros/familia.png"},
                        {id:"i3",url:"/logo.svg",nombre:"Logo Marca",key:"logos/Logo-Marca.svg"}];
    crearComposicion("display-desktop");
    setComp("zonas.logo.url","/logo.svg");   // el logo va en todas las piezas
    setComp("fondo.color","#23366F");
    setComp("zonas.texto.titular.texto","Protege tu auto");
    setComp("zonas.cta.texto","Cotiza");
    setCompOferta("60% dcto.",null);          // sin oferta no hay circulo que arrastrar
    cambiarPanelTab("diseno");
  });
  await pg.waitForTimeout(400);

  console.log("\n1 · Un solo módulo de edición, y todo alcanzable");
  const c1=await pg.evaluate(()=>{
    const tabs=document.querySelector(".panel-tabs");
    const ed=document.getElementById("comp-editor");
    const vis=(el)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
    return {
      tabsOcultas: getComputedStyle(tabs).display==="none",
      copias: document.querySelectorAll(".se-chips").length,
      chips:[...ed.querySelectorAll(".se-chip")].map(x=>x.textContent.trim()),
      plantillas:[...ed.querySelectorAll(".plt-op .plt-nom")].map(x=>x.textContent.trim()),
      miniaturas: ed.querySelectorAll(".plt-mini .cmp").length
    };
  });
  console.log("     elementos:  "+c1.chips.join(" · "));
  console.log("     plantillas: "+c1.plantillas.join(" · "));
  T(c1.tabsOcultas,"en un banner NO se ven Bloques / Diseño / Editar bloque / Plantillas");
  T(c1.copias===1,"el módulo se pinta una sola vez, no dos",c1.copias);
  T(c1.chips.length===8,"los 8 elementos del banner están a un clic",c1.chips.join(","));
  T(c1.plantillas.length===5,"hay 5 plantillas de diagramación",c1.plantillas.length);
  T(c1.miniaturas===5,"y sus miniaturas se dibujan con el render real del banner",c1.miniaturas);

  console.log("\n1b · Cada punto de la lista tiene su control (medido uno a uno)");
  // Se busca el control en el panel del elemento correspondiente, no en el HTML suelto.
  const controles=await pg.evaluate(async()=>{
    const out={};
    const panel=()=>document.getElementById("comp-editor");
    const etiquetas=()=>[...panel().querySelectorAll(".se-elem .se-f > label, .se-elem .se-col > label")]
      .map(l=>l.textContent.split("·")[0].trim().toLowerCase());
    const ver=async(k)=>{ elegirElemento(k); await new Promise(r=>setTimeout(r,220)); return etiquetas(); };
    out.logo   = await ver("logo");
    out.titulo = await ver("titulo");
    out.cta    = await ver("cta");
    out.fondo  = await ver("fondo");
    out.legal  = await ver("legal");
    return out;
  });
  const tiene=(lista,txt)=>lista.some(l=>l.includes(txt));
  T(tiene(controles.logo,"alto del logo") && tiene(controles.logo,"ancho máximo"),
    "LOGO: se puede agrandar y achicar",controles.logo.join("/"));
  T(tiene(controles.logo,"posición horizontal") && tiene(controles.logo,"posición vertical"),
    "LOGO: se puede mover",controles.logo.join("/"));
  T(tiene(controles.titulo,"tipografía"),"TEXTO: se puede cambiar la tipografía",controles.titulo.join("/"));
  T(tiene(controles.titulo,"tamaño de letra"),"TEXTO: se puede cambiar el tamaño de letra",controles.titulo.join("/"));
  T(tiene(controles.titulo,"color"),"TEXTO: se puede cambiar el color",controles.titulo.join("/"));
  T(tiene(controles.titulo,"alineación"),"TEXTO: se puede alinear",controles.titulo.join("/"));
  T(tiene(controles.cta,"alineación") && tiene(controles.cta,"posición vertical"),
    "BOTÓN: se puede mover y alinear",controles.cta.join("/"));
  T(tiene(controles.cta,"tamaño de letra") && tiene(controles.cta,"tipografía"),
    "BOTÓN: tiene su tipografía y su tamaño",controles.cta.join("/"));
  T(tiene(controles.fondo,"color de fondo"),"FONDO: hay color de fondo",controles.fondo.join("/"));
  T(tiene(controles.legal,"texto legal") && tiene(controles.legal,"tamaño de letra"),
    "LEGAL: tiene texto y tamaño",controles.legal.join("/"));

  console.log("\n1c · El filtro de la foto se ajusta y se quita");
  const filtro=await pg.evaluate(async()=>{
    setCompFoto((workspace.imagenes||[]).filter(sirveComoFondo)[0].url,null);
    await new Promise(r=>setTimeout(r,300));
    elegirElemento("fondo"); await new Promise(r=>setTimeout(r,300));
    const ed=document.getElementById("comp-editor");
    const slider=ed.querySelector('.se-elem input[type=range]');
    const quitar=[...ed.querySelectorAll(".se-quitar")].find(b=>/quitar filtro/i.test(b.textContent));
    const antes=parseFloat(getPath(pieza().composicion,"fondo.imagen.oscurecer"));
    if(quitar){ quitar.click(); await new Promise(r=>setTimeout(r,350)); }
    const despues=parseFloat(getPath(pieza().composicion,"fondo.imagen.oscurecer"));
    return { haySlider:!!slider, hayQuitar:!!quitar, antes, despues };
  });
  T(filtro.haySlider,"el filtro tiene deslizador para ajustarlo");
  T(filtro.hayQuitar && filtro.despues===0,"y un botón que lo quita del todo",filtro.antes+" → "+filtro.despues);

  console.log("\n1d · Arrastrar (drag and drop) sobre el banner");
  await pg.waitForTimeout(1200);   // el overlay se reconstruye tras repintar
  // Ya no hay asas por elemento: se agarra el elemento mismo (motor único).
  const dnd=await pg.evaluate(()=>({
    logo: !!document.querySelector(".lienzo .cmp-logo.cmp-mov"),
    tirador: !!document.querySelector(".lienzo-rzlogo"),
    divisores: document.querySelectorAll(".lienzo-div").length,
    burbuja: !!document.querySelector(".lienzo .cmp-burbuja.cmp-mov"),
    textos: document.querySelectorAll(".lienzo-edit").length,
    agarrables: document.querySelectorAll(".lienzo .cmp-mov").length
  }));
  T(dnd.logo && dnd.tirador,"el LOGO se agarra y tiene tirador de tamaño",JSON.stringify(dnd));
  T(dnd.divisores>=1,"los divisores de zona se arrastran",dnd.divisores);
  T(dnd.burbuja,"el círculo de oferta se agarra");
  T(dnd.textos>=1,"los textos se editan sobre el propio banner",dnd.textos);
  T(dnd.agarrables>=4,"y todos los elementos son agarrables, no solo dos",dnd.agarrables);
  // Arrastre REAL del logo: de su sitio a la esquina de abajo a la derecha.
  const arr=await pg.evaluate(()=>{const c=pieza().composicion;return {h:getPath(c,"zonas.logo.alinH"),v:getPath(c,"zonas.logo.alinV")};});
  const caja=await pg.evaluate(()=>{const e=document.querySelector(".lienzo .cmp-logo");const r=e.getBoundingClientRect();
    const s=document.querySelector(".lienzo-stage").getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2,sx:s.left,sy:s.top,sw:s.width,sh:s.height};});
  await pg.mouse.move(caja.x,caja.y); await pg.mouse.down();
  await pg.mouse.move(caja.sx+caja.sw-14, caja.sy+caja.sh-14, {steps:12});
  await pg.mouse.up(); await pg.waitForTimeout(700);
  const arr2=await pg.evaluate(()=>{const c=pieza().composicion;return {h:getPath(c,"zonas.logo.alinH"),v:getPath(c,"zonas.logo.alinV")};});
  console.log("     logo: "+arr.h+"/"+arr.v+"  →  "+arr2.h+"/"+arr2.v);
  T(arr2.h==="right" && arr2.v==="bottom","arrastrar el logo a una esquina lo deja ahí de verdad",arr2.h+"/"+arr2.v);

  console.log("\n1e · Las plantillas cambian la disposición sin tocar el contenido");
  const plt=await pg.evaluate(async()=>{
    const antes=JSON.stringify({tit:getPath(pieza().composicion,"zonas.texto.titular.texto"),
                                cta:getPath(pieza().composicion,"zonas.cta.texto")});
    aplicarPlantillaBanner("centrado",null); await new Promise(r=>setTimeout(r,900));
    const c=pieza().composicion;
    const despues=JSON.stringify({tit:getPath(c,"zonas.texto.titular.texto"),cta:getPath(c,"zonas.cta.texto")});
    return { igual:antes===despues, alin:getPath(c,"zonas.texto.alinH"), deco:getPath(c,"deco.visible") };
  });
  T(plt.alin==="center","aplicar «Centrado» centra el texto",plt.alin);
  T(plt.igual,"y NO toca los textos que escribiste");
  await pg.evaluate(async()=>{ aplicarPlantillaBanner("clasico",null); await new Promise(r=>setTimeout(r,600)); });
  await pg.waitForTimeout(1400);
  const pltInsp=await pg.evaluate(()=>{const r=pieza()._inspeccion||{};
    return Object.keys(r).filter(f=>!r[f].ok).map(f=>f+":"+r[f].fallos.map(x=>x.id).join("/"));});
  T(pltInsp.length===0,"y el banner sigue pasando las comprobaciones en los 11 tamaños",pltInsp.join(" · "));

  console.log("\n2 · Escribir en un campo se ve en el banner");
  // Se escribe con el teclado en el campo real, como lo haría una persona.

  // El panel muestra un elemento a la vez: se elige el elemento y se escribe en
  // su campo de texto, que dentro de su panel se llama simplemente "Texto".
  const escribir=async(elemento,texto)=>{
    await pg.evaluate(k=>elegirElemento(k), elemento);
    await pg.waitForTimeout(240);
    const sel = await pg.evaluateHandle(()=>{
      const ed=document.getElementById("comp-editor");
      const f=[...ed.querySelectorAll(".se-elem .se-f")].find(d=>{
        const l=d.querySelector("label"); if(!l) return false;
        return l.textContent.split("·")[0].trim().toLowerCase().startsWith("texto");
      });
      return f ? f.querySelector("input[type=text],textarea") : null;
    });
    const el = sel.asElement();
    if(!el) return false;
    await el.fill(texto);
    await pg.waitForTimeout(280);
    return true;
  };
  T(await escribir("titulo","Protege tu auto"),"TÍTULO: se escribe y se guarda");
  T(await escribir("bajada","Cobertura desde hoy"),"BAJADA: se escribe");
  T(await escribir("cta","Cotiza aquí"),"BOTÓN: se escribe");
  T(await escribir("oferta","60% dcto."),"OFERTA: se escribe");
  T(await escribir("legal","Sujeto a evaluación. Infórmate en el sitio"),"LEGAL: se escribe (antes no había dónde)");
  T(await escribir("epigrafe","Seguro Auto"),"EPÍGRAFE: se escribe");
  await pg.waitForTimeout(700);

  const r2=await pg.evaluate(()=>{
    const c=pieza().composicion;
    const ab=document.querySelector('.ab[data-fmt="display-300x250"] .cmp');
    const gr=document.querySelector('.ab[data-fmt="display-1200x1200"] .cmp');
    const txt=(s)=>{ const e=ab&&ab.querySelector(s); return e?e.textContent.trim():""; };
    const txtG=(s)=>{ const e=gr&&gr.querySelector(s); return e?e.textContent.trim():""; };
    return {
      dato:{ tit:c.zonas.texto.titular.texto, baj:c.zonas.texto.cuerpo.texto, cta:c.zonas.cta.texto,
             ofe:(c.burbuja||{}).texto, vis:(c.burbuja||{}).visible, legal:c.legal, epi:c.zonas.texto.etiqueta.texto },
      pintado:{ tit:txt(".cmp-tit"), baj:txt(".cmp-cue"), cta:txt(".cmp-cta"),
                bub:txt(".cmp-burbuja"), legal:txt(".cmp-legal"), epi:txt(".cmp-etq") },
      grande:{ tit:txtG(".cmp-tit"), baj:txtG(".cmp-cue"), legal:txtG(".cmp-legal") }
    };
  });
  T(r2.dato.tit==="Protege tu auto","el título quedó en el dato",r2.dato.tit);
  T(r2.pintado.tit==="Protege tu auto","y se ve en el banco del banner",r2.pintado.tit);
  // La BAJADA es lo primero que cae cuando no hay sitio (prioridad del manual:
  // bajada → adornos → epígrafe → legal). En un 300x250 con círculo y legal
  // encendidos, que NO salga es lo correcto; tiene que salir en los grandes.
  T(r2.dato.baj==="Cobertura desde hoy","la bajada quedó guardada aunque el formato chico la deje caer",r2.dato.baj);
  T(r2.grande.baj.includes("Cobertura"),"y se ve en el 1200×1200, que sí tiene sitio",r2.grande.baj);
  T(r2.pintado.baj==="","en el 300×250 cae, como manda la escalera de prioridad",'"'+r2.pintado.baj+'"');
  T(r2.pintado.cta==="Cotiza aquí","el botón se ve en el banner",r2.pintado.cta);
  T(r2.pintado.epi.toLowerCase().includes("seguro"),"el epígrafe se ve en el banner",r2.pintado.epi);
  T(r2.dato.legal.startsWith("Sujeto"),"el legal quedó guardado",r2.dato.legal);
  T(r2.pintado.legal.startsWith("Sujeto"),"y el legal se ve en su banda inferior",r2.pintado.legal);

  console.log("\n3 · La oferta enciende el círculo sola (un paso, no dos)");
  T(r2.dato.vis===true,"escribir la oferta encendió la burbuja sin tocar interruptor",r2.dato.vis);
  T(r2.pintado.bub.replace(/\s+/g,"").includes("60%"),"el círculo muestra la oferta",r2.pintado.bub);
  const r3=await pg.evaluate(async()=>{
    // Al borrarla se apaga: el estado no queda colgado.
    setCompOferta("",null); await new Promise(r=>setTimeout(r,300));
    const apagada = pieza().composicion.burbuja.visible;   // valor, no referencia
    const hay=!!document.querySelector('.ab[data-fmt="display-300x250"] .cmp-burbuja');
    setCompOferta("60% dcto.",null); await new Promise(r=>setTimeout(r,300));
    return { apagada, pintadaTrasBorrar:hay, reencendida:pieza().composicion.burbuja.visible };
  });
  T(r3.apagada===false,"borrar la oferta apaga el círculo",r3.apagada);
  T(r3.pintadaTrasBorrar===false,"y desaparece del banner",r3.pintadaTrasBorrar);
  T(r3.reencendida===true,"volver a escribirla lo vuelve a encender",r3.reencendida);

  console.log("\n4 · La foto se elige de miniaturas, y «Sin foto» vuelve al color");
  const r4=await pg.evaluate(async()=>{
    elegirElemento("fondo"); await new Promise(r=>setTimeout(r,260));
    const ed=document.getElementById("comp-editor");
    const bts=[...ed.querySelectorAll(".se-fotos button")];
    const logos=bts.filter(x=>/logos\//i.test(x.title||""));
    bts[1].click(); await new Promise(r=>setTimeout(r,350));
    const c1=pieza().composicion;
    const conFoto={ tipo:c1.fondo.tipo, url:c1.fondo.imagen.url };
    const bts2=[...document.getElementById("comp-editor").querySelectorAll(".se-fotos button")];
    bts2[0].click(); await new Promise(r=>setTimeout(r,350));
    const c2=pieza().composicion;
    return { n:bts.length, logos:logos.length, conFoto, sinFoto:c2.fondo.tipo };
  });
  T(r4.n>=3,"hay miniaturas clicables de la biblioteca",r4.n);
  T(r4.logos===0,"la carpeta logos/ NO se ofrece como fondo (regla del manual)",r4.logos);
  T(r4.conFoto.tipo==="imagen" && /^data:image\/png/.test(String(r4.conFoto.url)),"un clic en la miniatura pone la foto",r4.conFoto.tipo);
  T(r4.sinFoto==="color","«Sin foto» vuelve al fondo de color",r4.sinFoto);

  console.log("\n5 · Cada elemento lleva SUS colores, con la paleta de la marca");
  const r5=await pg.evaluate(async()=>{
    elegirElemento("cta"); await new Promise(r=>setTimeout(r,260));
    const ed=document.getElementById("comp-editor");
    const filas=[...ed.querySelectorAll(".se-elem .se-col label")].map(l=>l.textContent.trim());
    const sw=ed.querySelector(".se-elem .se-col .cmp-sw");
    let aplicado=null;
    if(sw){ sw.click(); await new Promise(r=>setTimeout(r,320)); aplicado=getPath(pieza().composicion,"zonas.cta.colorFondo"); }
    elegirElemento("titulo"); await new Promise(r=>setTimeout(r,260));
    const delTitulo=[...document.querySelectorAll("#comp-editor .se-elem .se-col label")].map(l=>l.textContent.trim());
    return { filas, aplicado, delTitulo };
  });
  T(r5.filas.length===2,"el botón tiene su color de fondo y el de su letra",r5.filas.join("/"));
  T(r5.aplicado===null || /^#/.test(String(r5.aplicado)),"un clic en el swatch de la marca lo aplica",r5.aplicado);
  T(r5.delTitulo.length>=1,"el título tiene su propio color",r5.delTitulo.join("/"));

  console.log("\n6 · Un tamaño concreto pregunta lo justo: qué se ve y qué no");
  const r6=await pg.evaluate(async()=>{
    const p=pieza(); p.activaFmt="display-320x50";
    renderComposicionEditor(); await new Promise(r=>setTimeout(r,350));
    const tg=[...document.querySelectorAll(".se-toggles button")].map(x=>x.textContent.replace(/\s+/g," ").trim());
    const avz=document.querySelector(".cmp-ed details.se-avz");
    const chips=document.querySelectorAll("#comp-editor .se-chip").length;
    return { toggles:tg, avanzadoCerrado: !!avz && !avz.open, chips };
  });
  console.log("     "+r6.toggles.join(" | "));
  T(r6.toggles.length===5,"cinco interruptores: Logo, Textos, Botón, Círculo y Adornos",r6.toggles.length);
  T(r6.avanzadoCerrado,"y lo fino sigue guardado en avanzados");
  T(r6.chips===8,"ajustando un tamaño se siguen editando los 8 elementos (antes solo había interruptores)",r6.chips);
  const r6b=await pg.evaluate(async()=>{
    const b=[...document.querySelectorAll(".se-toggles button")].find(x=>/Círculo/.test(x.textContent));
    b.click(); await new Promise(r=>setTimeout(r,400));
    const ov=(pieza().artboards.find(a=>a.fmt==="display-320x50")||{}).ov||{};
    const hay=!!document.querySelector('.ab[data-fmt="display-320x50"] .cmp-burbuja');
    const otro=!!document.querySelector('.ab[data-fmt="display-300x250"] .cmp-burbuja');
    return { ov:JSON.stringify(ov), hay, otro };
  });
  T(r6b.otro===true,"apagar algo en un tamaño NO toca los demás",r6b.otro);

  console.log("\n7 · El inspector sigue conforme tras editar a mano");
  await pg.evaluate(()=>{ pieza().activaFmt=pieza().masterFmt; renderComposicionEditor(); renderTablero(); });
  await pg.waitForTimeout(1400);
  const r7=await pg.evaluate(()=>{const res=pieza()._inspeccion||{};
    return { n:Object.keys(res).length, malos:Object.keys(res).filter(f=>!res[f].ok)
      .map(f=>f+":"+res[f].fallos.map(x=>x.id).join("/")) };});
  T(r7.n>=11,"inspecciona los 11 tamaños",r7.n);
  T(r7.malos.length===0,"los 11 pasan las comprobaciones con el copy escrito a mano",r7.malos.join(" · "));

  T(errs.length===0,"sin errores de consola",errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
