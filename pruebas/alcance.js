// ALCANCE DEL MANUAL (§01) y PÁGINAS DEL §05.
//
// §01, literal: "el producto es publicidad pagada en las tres plataformas de
// arriba" (Google Display · Facebook Ads · Google Search), "sin email
// marketing" y "sin lienzo en blanco: toda pieza nace de una generación de la
// IA". Esta prueba comprueba las tres cosas en la interfaz REAL, y además que
// quitar el email NO destruyó nada: una pieza de email ya guardada tiene que
// seguir abriéndose, editándose y exportándose.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  pg.on("console",m=>{if(m.type()==="error"&&!/ERR_CERT|ERR_CONNECTION|ERR_TUNNEL|ERR_BLOCKED|favicon|fonts\.googleapis/.test(m.text()))errs.push("console: "+m.text());});
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.crearConIA==="function");

  console.log("\n1 · Las superficies de CREACIÓN ofrecen las tres plataformas, y solo esas");
  const s1=await pg.evaluate(()=>{
    const vis=(el)=>{ const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const home=[...document.querySelectorAll("#pg-home .crear-cards .crc")].map(x=>({
      t:(x.querySelector(".crc-t")||{}).textContent||"", on:(x.getAttribute("onclick")||"") }));
    const menu=[...document.querySelectorAll("#menu-nueva button")].map(x=>({
      t:x.textContent.replace(/\s+/g," ").trim(), on:(x.getAttribute("onclick")||"") }));
    const asis=[...document.querySelectorAll("#ia-piezas-seg button")].map(x=>({
      p:x.dataset.p, t:x.textContent.replace(/\s+/g," ").trim() }));
    return { home, menu, asis };
  });
  console.log("     Home:      "+s1.home.map(x=>x.t).join(" | "));
  console.log("     + Nueva:   "+s1.menu.map(x=>x.t).join(" | "));
  console.log("     Asistente: "+s1.asis.map(x=>x.t).join(" | "));
  const textoTodo = JSON.stringify(s1).toLowerCase();
  T(!/email/.test(textoTodo),"NO se ofrece crear email en ninguna superficie (§01)",
    (s1.home.concat(s1.menu).filter(x=>/email/i.test(x.t)).map(x=>x.t).join("/")||"—"));
  T(s1.asis.length===3 && s1.asis.map(x=>x.p).join(",")==="banner,facebook,ads",
    "el asistente ofrece Display, Facebook y Search",s1.asis.map(x=>x.p).join(","));
  T(s1.asis.some(x=>x.p==="facebook"),"Facebook Ads YA aparece en el asistente (faltaba)");
  T(s1.home.length===4 && s1.home.every(x=>/crearConIA/.test(x.on)),
    "las cuatro tarjetas del Home generan con IA, ninguna abre un lienzo vacío (§01)",
    s1.home.map(x=>x.on).join(" "));
  T(!/crearTrabajoHome/.test(textoTodo),"ya no queda ningún acceso a «crear vacío»");

  console.log("\n2 · «Sin lienzo en blanco»: el acceso abre el asistente");
  const s2=await pg.evaluate(async()=>{
    workspace.marcas=[{id:"m1",nombre:"Marca Prueba",primary:"#2167ae",secondary:"#23366f",cta:"#2167ae",ctaText:"#fff",accent1:"#fff773",accent2:"#91bfe3"}];
    crearConIA("facebook");
    await new Promise(r=>setTimeout(r,300));
    const abierto=document.getElementById("modal-ia").classList.contains("show");
    const marcadas=IA_PLATAFORMAS.filter(k=>iaPiezas[k]);
    const piezas=(workspace.proyectos||[]).reduce((n,p)=>n+(p.piezas||[]).length,0);
    cerrarModal("ia");
    return { abierto, marcadas, piezas };
  });
  T(s2.abierto,"se abre el asistente, no el editor");
  T(s2.marcadas.join(",")==="facebook","con la plataforma ya marcada",s2.marcadas.join(","));
  T(s2.piezas===0,"y no se creó ninguna pieza vacía por el camino",s2.piezas);
  const s2b=await pg.evaluate(async()=>{
    crearConIA("todas"); await new Promise(r=>setTimeout(r,250));
    const m=IA_PLATAFORMAS.filter(k=>iaPiezas[k]); cerrarModal("ia"); return m;
  });
  T(s2b.length===3,"«Campaña completa» marca las tres plataformas",s2b.join(","));

  console.log("\n3 · Facebook genera SU colección, no la de Display");
  const s3=await pg.evaluate(()=>{
    const pr={id:uid(),nombre:"Camp",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos=[pr]; proyecto=pr; proyectoVistoId=pr.id;
    const marca={id:"m1",nombre:"Marca Prueba",primary:"#2167ae",secondary:"#23366f",cta:"#2167ae",ctaText:"#ffffff",accent1:"#fff773",accent2:"#91bfe3",disclaimer:"Infórmate en el sitio."};
    const data={nombre:"Promo",zonas:{titular:"Protege tu auto",cuerpo:"Cobertura hoy",cta:"Cotiza",etiqueta:"Seguro"},burbuja:"60% dcto.",imagen:""};
    insertarBannerIA(data, marca, "facebook");
    const fb=pieza();
    insertarBannerIA(data, marca, "display-desktop");
    const gd=pieza();
    return {
      fb:{ tipo:fb.setTipo, master:fb.masterFmt, n:(fb.artboards||[]).length, ruta:rutaDeProducto(fb) },
      gd:{ tipo:gd.setTipo, master:gd.masterFmt, n:(gd.artboards||[]).length, ruta:rutaDeProducto(gd) },
      legalFb: fb.composicion.legal, legalGd: gd.composicion.legal,
      enMismoProyecto: (proyecto.piezas||[]).length
    };
  });
  T(s3.fb.tipo==="facebook" && s3.fb.master==="fb-1080x1350" && s3.fb.n===3,
    "Facebook → 3 tamaños con máster 1080×1350",JSON.stringify(s3.fb));
  T(s3.gd.tipo==="display-desktop" && s3.gd.n===11,
    "Display → 11 tamaños con su máster",JSON.stringify(s3.gd));
  T(s3.fb.ruta==="/fb-ia" && s3.gd.ruta==="/gdn-ia","cada una en su sección",s3.fb.ruta+" / "+s3.gd.ruta);
  T(s3.legalFb==="Infórmate en el sitio." && s3.legalGd==="Infórmate en el sitio.",
    "el legal de la marca entra solo en las dos (el manual lo pide en cada banner)",s3.legalFb);
  T(s3.enMismoProyecto===2,"las dos plataformas caen en el MISMO proyecto (campaña)",s3.enMismoProyecto);

  console.log("\n4 · Los límites que se le pasan a la IA salen del set correcto");
  const s4=await pg.evaluate(()=>({
    gd:limitesParaIA("display-300x250",false), gdOf:limitesParaIA("display-300x250",true),
    fb:limitesParaIA("fb-1080x1350",false),   fbOf:limitesParaIA("fb-1080x1350",true) }));
  console.log("     Display  sin oferta: "+JSON.stringify(s4.gd));
  console.log("     Display  con oferta: "+JSON.stringify(s4.gdOf));
  console.log("     Facebook sin oferta: "+JSON.stringify(s4.fb));
  console.log("     Facebook con oferta: "+JSON.stringify(s4.fbOf));
  T(s4.gd.titulo>s4.gdOf.titulo,"sin oferta el titular dispone de más sitio que con círculo",
    s4.gd.titulo+" vs "+s4.gdOf.titulo);
  T(s4.gd.titulo>=50,"una campaña SIN oferta ya no se recorta a 27 caracteres",s4.gd.titulo);
  T(s4.fb.titulo>=30,"y en Facebook deja de pedir titulares de 12 caracteres",s4.fb.titulo);
  T(s4.fb.palabra>s4.gd.palabra,"la palabra más larga se mide contra su propio set, no contra un 160×600",
    s4.fb.palabra+" vs "+s4.gd.palabra);

  console.log("\n5 · Quitar el email NO destruyó nada: una pieza guardada sigue viva");
  const s5=await pg.evaluate(async()=>{
    const pr={id:uid(),nombre:"Viejo",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos.push(pr); proyecto=pr; proyectoVistoId=pr.id;
    // Una pieza de email como las que ya existen guardadas.
    const p=crearPieza("email","Newsletter de marzo");
    p.asunto="Asunto de prueba";
    p.canvas=[ mk("hero",{titulo:"Hola",sub:"Texto"}), mk("texto",{contenido:"Cuerpo del correo"}), mk("cta",{texto:"Ver más",url:"https://ejemplo.cl"}) ];
    activarPieza(p.id);
    await new Promise(r=>setTimeout(r,400));
    const html=generarHTMLDePieza(p);
    return {
      abre: !!document.querySelector("#canvas .bw, #canvas .sbb-hero, #canvas [data-id]"),
      bloques: p.canvas.length,
      ruta: rutaDeProducto(p),
      exporta: html.length>300 && /Cuerpo del correo/.test(html),
      asuntoEnExport: /Asunto de prueba/.test(html),
      cat: categoriaDe("email")
    };
  });
  T(s5.abre,"la pieza de email se abre y se pinta en el lienzo");
  T(s5.bloques===3,"conserva sus bloques",s5.bloques);
  T(s5.ruta==="/email-ia","su ruta sigue existiendo para el deep-link",s5.ruta);
  T(s5.exporta,"y sigue exportando su HTML");
  T(s5.asuntoEnExport,"con su asunto");
  const s5b=await pg.evaluate(async()=>{
    // Editar: cambiar un dato y ver que se guarda.
    const p=pieza(); seleccionado=p.canvas[1].id; renderForm();
    actualizarDato("contenido","Cuerpo editado hoy");
    await new Promise(r=>setTimeout(r,300));
    return pieza().canvas[1].datos.contenido;
  });
  T(s5b==="Cuerpo editado hoy","y se sigue editando",s5b);

  console.log("\n6 · Páginas del §05: en curso · realizados · historial");
  const s6=await pg.evaluate(async()=>{
    const salida={};
    for(const v of ["en-curso","realizados","historial"]){
      dashIr(v); await new Promise(r=>setTimeout(r,260));
      const id=DASH_VIEWS[v]; const el=document.getElementById(id);
      salida[v]={ existe:!!el, visible: !!el && el.style.display!=="none",
                  url:location.pathname, texto:(el?el.textContent:"").replace(/\s+/g," ").trim().slice(0,60) };
    }
    return salida;
  });
  ["en-curso","realizados","historial"].forEach(v=>{
    T(s6[v].existe && s6[v].visible, `la página «${v}» existe y se muestra`, JSON.stringify(s6[v]));
    T(s6[v].url==="/"+v, `y tiene su propia ruta /${v}`, s6[v].url);
  });

  console.log("\n7 · Cerrar y reabrir una campaña (proyecto = campaña)");
  const s7=await pg.evaluate(async()=>{
    const id=workspace.proyectos[0].id;
    dashIr("en-curso"); await new Promise(r=>setTimeout(r,250));
    const antes=document.querySelectorAll("#ec-lista .cm-card").length;
    cerrarProyecto(id); await new Promise(r=>setTimeout(r,250));
    const enCursoDespues=document.querySelectorAll("#ec-lista .cm-card").length;
    dashIr("realizados"); await new Promise(r=>setTimeout(r,250));
    const realizados=document.querySelectorAll("#rz-lista .cm-card").length;
    const sello=!!document.querySelector("#rz-lista .cm-sello");
    reabrirProyecto(id); await new Promise(r=>setTimeout(r,250));
    const realizadosTrasReabrir=document.querySelectorAll("#rz-lista .cm-card").length;
    dashIr("en-curso"); await new Promise(r=>setTimeout(r,250));
    const vuelta=document.querySelectorAll("#ec-lista .cm-card").length;
    const piezasIntactas=(workspace.proyectos.find(p=>p.id===id).piezas||[]).length;
    return { antes, enCursoDespues, realizados, sello, realizadosTrasReabrir, vuelta, piezasIntactas };
  });
  T(s7.antes>=1,"hay campañas en curso",s7.antes);
  T(s7.enCursoDespues===s7.antes-1,"al marcarla realizada sale de «en curso»",s7.enCursoDespues+" de "+s7.antes);
  T(s7.realizados>=1 && s7.sello,"aparece en «realizados» con su sello",s7.realizados);
  T(s7.realizadosTrasReabrir===s7.realizados-1,"reabrirla la saca de realizados",s7.realizadosTrasReabrir);
  T(s7.vuelta===s7.antes,"y vuelve a «en curso»",s7.vuelta);
  T(s7.piezasIntactas>=1,"cerrar/reabrir NO toca sus piezas",s7.piezasIntactas);

  console.log("\n8 · El historial muestra horas reales y respeta la zona horaria");
  const s8=await pg.evaluate(async()=>{
    workspace.perfil=workspace.perfil||{};
    const T0=Date.UTC(2026,7,17,23,30);   // 17-ago-2026 23:30 UTC: cruza el dia en Chile
    workspace.perfil.tz="America/Santiago"; const scl=fechaHora(T0);
    workspace.perfil.tz="Europe/Madrid";    const mad=fechaHora(T0);
    workspace.perfil.tz="America/Santiago";
    dashIr("historial"); await new Promise(r=>setTimeout(r,300));
    const filas=document.querySelectorAll("#hi-cont tbody tr").length;
    const cabeceras=[...document.querySelectorAll("#hi-cont thead th")].map(t=>t.textContent.trim());
    return { scl, mad, filas, cabeceras, distintas: scl!==mad };
  });
  console.log("     misma hora en dos zonas: "+s8.scl+"  ·  "+s8.mad);
  T(s8.distintas,"la zona horaria de Configuración cambia lo que se muestra");
  T(s8.filas>=1,"el historial lista los trabajos con su hora",s8.filas);
  T(s8.cabeceras.join(",").includes("Creado"),"con columna de hora de creación",s8.cabeceras.join("/"));

  T(errs.length===0,"sin errores de consola",errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
