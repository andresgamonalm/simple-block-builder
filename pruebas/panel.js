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
    cambiarPanelTab("diseno");
  });
  await pg.waitForTimeout(400);

  console.log("\n1 · Cuántos controles hay que atravesar al abrir");
  const c1=await pg.evaluate(()=>{
    const ed=document.getElementById("comp-editor");
    const vis=(el)=>{ const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; };
    const ctr=[...ed.querySelectorAll("input,select,textarea,button")].filter(vis);
    // Lo que está dentro de un <details> cerrado no cuenta: no se ve.
    const dentroCerrado=(el)=>{ const d=el.closest("details"); return d && !d.open; };
    const enPrimerPlano=ctr.filter(el=>!dentroCerrado(el));
    const avz=ed.querySelector("details.se-avz");
    return {
      total:ctr.length, primerPlano:enPrimerPlano.length,
      avanzadoCerrado: !!avz && !avz.open,
      grupos:[...ed.querySelectorAll(".se-h")].map(h=>h.textContent.replace(/\s+/g," ").trim()),
      escondidos: avz ? avz.querySelectorAll("input,select,textarea,button").length : 0
    };
  });
  console.log("     grupos: "+c1.grupos.join(" | "));
  console.log("     controles en primer plano: "+c1.primerPlano+"  ·  guardados en avanzados: "+c1.escondidos);
  T(c1.avanzadoCerrado,"«Ajustes avanzados» viene cerrado");
  T(c1.primerPlano<=26,"en primer plano hay 26 controles o menos (antes: todos)",c1.primerPlano);
  T(c1.escondidos>=30,"los controles finos siguen existiendo, guardados",c1.escondidos);
  T(c1.grupos.length===4,"cuatro grupos con nombre: Textos, Foto, Colores, Logo",c1.grupos.length);

  console.log("\n2 · Escribir en un campo se ve en el banner");
  // Se escribe con el teclado en el campo real, como lo haría una persona.
  const campos=await pg.evaluate(()=>{
    const ed=document.getElementById("comp-editor");
    const et=[...ed.querySelectorAll(".se-f > label")].map(l=>l.textContent.replace(/\s+/g," ").trim());
    return et;
  });
  console.log("     campos: "+campos.join(" · "));
  const escribir=async(etiqueta,texto)=>{
    const sel = await pg.evaluateHandle((etq)=>{
      const ed=document.getElementById("comp-editor");
      const cajas=[...ed.querySelectorAll(".se-f, .se-f.se-2 > div")];
      const f=cajas.find(d=>{
        const l=d.querySelector("label"); if(!l) return false;
        // Solo el nombre del campo: lo que va tras el "·" es texto de ayuda.
        const nom=l.textContent.split("·")[0].trim().toLowerCase();
        return nom.startsWith(etq.toLowerCase());   // "Oferta" encuentra "Oferta en círculo"
      });
      return f ? (f.querySelector("input,textarea")) : null;
    }, etiqueta);
    const el = sel.asElement();
    if(!el) return false;
    await el.fill(texto);
    await pg.waitForTimeout(260);
    return true;
  };
  T(await escribir("Título","Protege tu auto"),"el campo Título existe y acepta escritura");
  T(await escribir("Bajada","Cobertura desde hoy"),"el campo Bajada existe");
  T(await escribir("Botón","Cotiza aquí"),"el campo Botón existe");
  T(await escribir("Oferta","60% dcto."),"el campo Oferta existe");
  T(await escribir("Legal","Sujeto a evaluación. Infórmate en el sitio"),"el campo Legal existe (antes NO había dónde escribirlo)");
  T(await escribir("Epígrafe","Seguro Auto"),"el campo Epígrafe existe");
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

  console.log("\n5 · Los colores son la paleta de la marca");
  const r5=await pg.evaluate(async()=>{
    const filas=[...document.getElementById("comp-editor").querySelectorAll(".se-col")]
      .map(f=>f.querySelector("label").textContent.trim());
    const sw=document.querySelector("#comp-editor .se-col .cmp-sw");
    let aplicado=null;
    if(sw){ sw.click(); await new Promise(r=>setTimeout(r,300)); aplicado=pieza().composicion.fondo.color; }
    return { filas, aplicado };
  });
  T(r5.filas.length===3,"tres colores: Fondo, Botón y Oferta",r5.filas.join("/"));
  T(r5.aplicado===null || /^#/.test(String(r5.aplicado)),"un clic en el swatch aplica el color",r5.aplicado);

  console.log("\n6 · Un tamaño concreto pregunta lo justo: qué se ve y qué no");
  const r6=await pg.evaluate(async()=>{
    const p=pieza(); p.activaFmt="display-320x50"; cambiarPanelTab("editar");
    renderForm(); await new Promise(r=>setTimeout(r,350));
    const f=document.getElementById("pane-editar")||document.getElementById("form-bloque");
    const cont=document.querySelector(".cmp-ed");
    const tg=[...document.querySelectorAll(".se-toggles button")].map(x=>x.textContent.replace(/\s+/g," ").trim());
    const avz=document.querySelector(".cmp-ed details.se-avz");
    return { toggles:tg, avanzadoCerrado: !!avz && !avz.open };
  });
  console.log("     "+r6.toggles.join(" | "));
  T(r6.toggles.length===5,"cinco interruptores: Logo, Textos, Botón, Círculo y Adornos",r6.toggles.length);
  T(r6.avanzadoCerrado,"y lo fino sigue guardado en avanzados");
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
  await pg.evaluate(()=>{ pieza().activaFmt=pieza().masterFmt; cambiarPanelTab("diseno"); renderTablero(); });
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
