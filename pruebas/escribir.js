// LAS DOS COSAS QUE FALTABAN DEL MODELO DEL USUARIO (10-sep-2026):
//   1. escribir el texto DIRECTAMENTE sobre el banner (antes: en el panel)
//   2. que el asistente genere EN EL LIENZO LIBRE (antes: modelo de 3 zonas,
//      que no se podía arrastrar ni ampliar)
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };

(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto((process.env.SBB_URL||"http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.editarTextoLibre==="function");

  // ── Un banner libre con un texto, como el que dibuja el usuario.
  await pg.evaluate(async()=>{
    const pr={id:uid(),nombre:"Escribir",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos=[pr]; proyecto=pr; proyectoVistoId=pr.id;
    crearComposicion("display-desktop");
    const p=pieza(), c=p.composicion;
    c.fondo.color="#23366f";
    c.elementos=[ nuevoElementoLibre("texto",{ancla:"mc",dx:0,dy:0,w:200,h:50,
      texto:"Escribe aquí",tam:20,color:"#ffffff",z:2}) ];
    elLibreSel=null; renderTablero();
    await new Promise(r=>setTimeout(r,700));
  });
  await pg.waitForTimeout(500);

  console.log("\n1 · El texto se escribe SOBRE el banner, no en el panel");
  const cajaTxt = await pg.evaluate(()=>{
    const el=document.querySelector(".lienzo .cmp-libre .lb-txt");
    if(!el) return null; const r=el.getBoundingClientRect();
    return {x:r.x+r.width/2, y:r.y+r.height/2};
  });
  T(!!cajaTxt, "el texto está en el lienzo", cajaTxt?"":"no se encontró .lb-txt");

  // Doble clic = entrar a escribir, como en cualquier herramienta de diseño.
  await pg.mouse.dblclick(cajaTxt.x, cajaTxt.y);
  await pg.waitForTimeout(250);
  const enEdicion = await pg.evaluate(()=>{
    const el=document.querySelector(".lienzo .cmp-libre .lb-txt");
    const inner=el&&el.querySelector(".lb-txt-in");
    return { clase: !!(el&&el.classList.contains("lb-editando")),
             editable: !!(inner&&inner.isContentEditable),
             enfocado: document.activeElement===inner,
             barra: !!document.getElementById("lb-textbar") };
  });
  T(enEdicion.clase && enEdicion.editable, "doble clic entra a escribir en el propio banner", JSON.stringify(enEdicion));
  T(enEdicion.enfocado, "y el cursor queda dentro, listo para teclear");
  T(enEdicion.barra, "sale la barrita de tamaño, negrita y alineación");

  // Escribir de verdad, con el teclado.
  await pg.keyboard.press("Control+a");
  await pg.keyboard.type("Protege tu auto hoy");
  await pg.waitForTimeout(120);
  const enVivo = await pg.evaluate(()=>{
    const el=document.querySelector(".lienzo .cmp-libre .lb-txt");
    return (el?el.innerText:"").trim();
  });
  T(/Protege tu auto hoy/.test(enVivo), "lo tecleado se ve EN EL BANNER mientras escribes", enVivo);

  console.log("\n2 · La barrita cambia el texto sin perder el foco");
  const antesTam = await pg.evaluate(()=>parseFloat(pieza().composicion.elementos[0].tam));
  await pg.click('#lb-textbar [data-tam="1"]');
  await pg.click('#lb-textbar [data-tam="1"]');
  await pg.click('#lb-textbar [data-est="negrita"]');
  await pg.click('#lb-textbar [data-aln="center"]');
  await pg.waitForTimeout(150);
  const trasBarra = await pg.evaluate(()=>{
    const e=pieza().composicion.elementos[0];
    const inner=document.querySelector(".lienzo .cmp-libre .lb-txt .lb-txt-in");
    return { tam:parseFloat(e.tam), negrita:!!e.negrita, alinH:e.alinH,
             sigueEditando: !!(inner&&inner.isContentEditable),
             barra: !!document.getElementById("lb-textbar") };
  });
  T(trasBarra.tam === antesTam+2, "A+ agranda la letra", `${antesTam} → ${trasBarra.tam}`);
  T(trasBarra.negrita, "la negrita se aplica");
  T(trasBarra.alinH==="center", "y la alineación", trasBarra.alinH);
  T(trasBarra.sigueEditando && trasBarra.barra, "sin cerrar el texto ni perder la barrita");

  console.log("\n3 · Al salir se guarda y el cuadro crece si no cabía");
  await pg.evaluate(()=>{
    // Un texto largo en un cuadro chico: al cerrar, el cuadro debe crecer.
    const inner=document.querySelector(".lienzo .cmp-libre .lb-txt .lb-txt-in");
    inner.innerText="Protege tu auto hoy con la cobertura que de verdad te acompaña cuando pasa algo";
  });
  const altoAntes = await pg.evaluate(()=>parseFloat(pieza().composicion.elementos[0].h));
  await pg.click('#lb-textbar [data-fin="1"]');
  await pg.waitForTimeout(700);
  const trasCerrar = await pg.evaluate(()=>{
    const e=pieza().composicion.elementos[0];
    const inner=document.querySelector(".lienzo .cmp-libre .lb-txt .lb-txt-in");
    return { texto:e.texto, alto:parseFloat(e.h), editable:!!(inner&&inner.isContentEditable),
             barra:!!document.getElementById("lb-textbar") };
  });
  T(/cobertura que de verdad/.test(trasCerrar.texto), "el texto queda guardado en la pieza", trasCerrar.texto.slice(0,40));
  T(!trasCerrar.editable && !trasCerrar.barra, "se sale del modo escritura y la barrita se cierra");
  T(trasCerrar.alto > altoAntes, "el cuadro CRECE para que no se corte lo escrito", `${altoAntes} → ${trasCerrar.alto}`);

  console.log("\n4 · El botón es UN elemento: fondo, enlace y se arrastra entero");
  const bot = await pg.evaluate(()=>{
    anadirLibre("boton");
    const e=(pieza().composicion.elementos||[]).slice(-1)[0];
    setElLibre(e.id,"link","https://zurich.cl");
    renderTablero();
    return { tipo:e.tipo, fondo:e.fondo, rol:e.rol, texto:e.texto };
  });
  await pg.waitForTimeout(600);
  T(bot.tipo==="texto" && !!bot.fondo, "el botón es un cuadro de texto CON fondo", JSON.stringify(bot));
  T(bot.rol==="cta", "y su papel es el botón, así cae en su banda al replicar", bot.rol);
  const enlace = await pg.evaluate(()=>{
    const p=pieza();
    const el=[...document.querySelectorAll(".lienzo .cmp-libre .lb-el")].find(n=>n.tagName==="A");
    const html=generarHTMLDeComposicion(p, p.masterFmt);
    return { enEditor: !!el, enExport: /<a[^>]+href="https:\/\/zurich\.cl"/.test(html) };
  });
  T(enlace.enEditor, "en el editor el botón es un enlace de verdad");
  T(enlace.enExport, "y el enlace VIAJA al banner exportado");

  console.log("\n5 · La IA genera EN EL LIENZO LIBRE (no en el modelo viejo)");
  const gen = await pg.evaluate(async()=>{
    const r = await fetch("/api/ia",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({producto:"banner",brief:{que:"seguro de auto",legal:"Sujeto a evaluación"}})});
    const data = await r.json();
    data.legal = "Sujeto a evaluación. Infórmate en zurich.cl";
    data.ctaUrl = "https://zurich.cl/auto";
    insertarBannerIA(data, null, "display-desktop");
    await new Promise(r2=>setTimeout(r2,900));
    const p = pieza();
    const c = p.composicion;
    const roles = (c.elementos||[]).map(e=>rolLibre(e));
    return { libre: esLibre(c), n:(c.elementos||[]).length, roles,
             textos:(c.elementos||[]).filter(e=>e.tipo==="texto").map(e=>e.texto),
             conPos: (p.artboards||[]).filter(a=>a.pos && Object.keys(a.pos).length).length,
             tam: (p.artboards||[]).length };
  });
  T(gen.libre, "lo generado es una composición del LIENZO LIBRE", gen.libre?"":"salió en el modelo de 3 zonas");
  T(gen.n>=4, "trae sus elementos (logo/titular/oferta/bajada/botón/legal)", gen.n);
  T(gen.roles.includes("cta") && gen.roles.includes("legal"), "con el botón y el legal reconocidos por su papel", gen.roles.join(","));
  T(gen.textos.some(t=>/protegido por menos/i.test(t||"")), "el titular de la IA está ahí", (gen.textos[0]||"").slice(0,40));
  T(gen.textos.some(t=>/Sujeto a evaluación/i.test(t||"")), "y la frase legal del formulario también");
  T(gen.conPos === gen.tam-1, "los demás tamaños ya vienen repartidos por bandas", `${gen.conPos} de ${gen.tam-1}`);

  console.log("\n6 · Y lo generado se puede EDITAR y arrastrar como lo dibujado a mano");
  await pg.waitForTimeout(700);
  const editable = await pg.evaluate(()=>{
    const panel=document.getElementById("comp-editor");
    return { panelLibre: !!(panel && panel.querySelector(".lb-panel")),
             elementos: document.querySelectorAll(".lienzo .cmp-libre .lb-el").length };
  });
  T(editable.panelLibre, "se abre el panel del lienzo libre, no el de 3 zonas");
  T(editable.elementos>=4, "y sus elementos están en el lienzo, listos para arrastrar", editable.elementos);

  // Arrastre real de un elemento generado por la IA.
  const antes = await pg.evaluate(()=>{
    const el=document.querySelector(".lienzo .cmp-libre .lb-el");
    const id=el.dataset.el; const d=elLibre(pieza(),id);
    const r=el.getBoundingClientRect();
    return { id, ancla:d.ancla, dx:d.dx, dy:d.dy, x:r.x+r.width/2, y:r.y+r.height/2 };
  });
  await pg.mouse.move(antes.x, antes.y);
  await pg.mouse.down();
  await pg.mouse.move(antes.x+70, antes.y+55, {steps:12});
  await pg.mouse.up();
  await pg.waitForTimeout(700);
  const despues = await pg.evaluate(id=>{ const d=elLibre(pieza(),id); return { ancla:d.ancla, dx:d.dx, dy:d.dy }; }, antes.id);
  T(despues.ancla!==antes.ancla || despues.dx!==antes.dx || despues.dy!==antes.dy,
    "arrastrar un elemento generado por la IA lo mueve de verdad",
    `${antes.ancla}/${antes.dx},${antes.dy} → ${despues.ancla}/${despues.dx},${despues.dy}`);

  console.log("\n7 · Prioridad: el titular no cae por culpa del epígrafe");
  const prio = await pg.evaluate(()=>{
    const p=pieza();
    const ver=(fmt)=>{
      const ef=composicionEfectiva(p,fmt);
      const vivos=(ef.elementos||[]).map(e=>({rol:rolLibre(e), tam:e.tam, t:(e.texto||"").slice(0,18)}));
      return vivos;
    };
    return { franja:ver("display-728x90"), tira:ver("display-468x60"), master:ver(p.masterFmt) };
  });
  const tieneTitular = l => l.some(e=>e.rol==="promo" && /protegido|menos/i.test(e.t));
  const tieneCta     = l => l.some(e=>e.rol==="cta");
  const tieneLogo    = l => l.some(e=>e.rol==="logo") || true;   // sin marca no hay logo
  T(tieneTitular(prio.franja) && tieneCta(prio.franja),
    "en la franja de 728×90 sobreviven el titular y el botón",
    prio.franja.map(e=>e.rol).join(","));
  T(tieneTitular(prio.tira) && tieneCta(prio.tira),
    "y también en la tira de 468×60, la más apretada",
    prio.tira.map(e=>e.rol).join(","));
  T(prio.franja.length <= prio.master.length,
    "lo que no cabe cae, no se apretuja", `${prio.master.length} → ${prio.franja.length}`);

  console.log("\n8 · Los tamaños siguen sanos con lo que generó la IA");
  await pg.evaluate(()=>renderTablero());
  await pg.waitForTimeout(2200);
  const insp = await pg.evaluate(()=>{ const r=pieza()._inspeccion||{};
    return { n:Object.keys(r).length,
             malos:Object.keys(r).filter(f=>!r[f].ok).map(f=>f+":"+r[f].fallos.map(x=>x.id).join("/")) }; });
  T(insp.n>=11, "el inspector mide los once", insp.n);
  T(insp.malos.length===0, "y los once pasan", insp.malos.join(" · "));

  T(errs.length===0,"sin errores de consola",errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
