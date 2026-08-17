// El asistente en UNA ventana: todos los campos a la vista, limpiar a la
// izquierda, generar a la derecha, sin pasos.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1500,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.abrirIA==="function");
  await pg.evaluate(()=>{ workspace.marcas=[{id:"m1",nombre:"Zurich"}]; abrirIA(); });
  await pg.waitForTimeout(400);
  const r=await pg.evaluate(()=>{
    const vis=id=>{const e=document.getElementById(id);return !!e && e.offsetParent!==null;};
    return { p1:vis("ia-paso-1"), p2:vis("ia-paso-2"), p3:vis("ia-paso-3"),
      pasos:!!document.getElementById("ia-pasos"),
      sig:!!document.getElementById("ia-sig"),
      limpiar:vis("ia-limpiar"), generar:vis("ia-btn"),
      textoGen:(document.getElementById("ia-btn")||{}).textContent||"",
      campos:["ia-marca","ia-que","ia-objetivo","ia-gancho","ia-ctaurl","ia-ref1","ia-ref2","ia-notas"].filter(vis).length };
  });
  T(r.p1&&r.p2,"marca/piezas y el brief se ven a la vez");
  T(!r.p3,"el estado de generación está oculto hasta generar");
  T(!r.pasos,"el indicador de pasos ya no existe");
  T(!r.sig,"no hay botón «Siguiente»");
  T(r.limpiar,"«Limpiar» a la izquierda");
  T(r.generar && /Generar/.test(r.textoGen),"«Generar» a la derecha", r.textoGen);
  T(r.campos===8,"los 8 campos del brief están visibles a la vez","visibles="+r.campos);

  // Generar sin encargo: avisa y no genera
  const r2=await pg.evaluate(()=>{ iaGenerar(); const e=document.getElementById("ia-paso-3");
    return { p3vis: !!e && e.offsetParent!==null }; });
  T(!r2.p3vis,"sin encargo no arranca la generación");

  // Limpiar deja los campos en blanco
  const r3=await pg.evaluate(()=>{
    document.getElementById("ia-que").value="algo"; document.getElementById("ia-gancho").value="40% dcto";
    iaLimpiar();
    return { que:document.getElementById("ia-que").value, gan:document.getElementById("ia-gancho").value };
  });
  T(r3.que==="" && r3.gan==="","«Limpiar» vacía el formulario");

  await pg.screenshot({path:"asistente.png", clip:await pg.evaluate(()=>{const m=document.querySelector("#modal-ia .modal").getBoundingClientRect();return {x:m.x,y:m.y,width:m.width,height:m.height};})});
  console.log("\n"+(mal||errs.length?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  if(errs.length) errs.forEach(e=>console.log("  err "+e));
  await b.close(); process.exit(mal||errs.length?1:0);
})();
