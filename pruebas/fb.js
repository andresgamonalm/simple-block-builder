// Facebook Ads: master propio 1080x1350, tres piezas, textos del anuncio FUERA
// de la imagen con limites visibles, y el inspector midiendo igual que Display.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  pg.on("console",m=>{if(m.type()==="error"&&!/ERR_CERT|ERR_CONNECTION|favicon/.test(m.text()))errs.push("console: "+m.text());});
  await pg.goto((process.env.SBB_URL || "http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.crearComposicion==="function");

  console.log("\n1 · Escala con máster propio");
  const g=await pg.evaluate(()=>SET_FACEBOOK.map(f=>{const x=geomDe(f);
    return {f, k:Math.round(x.k*100)/100, tit:x.cuerpo.titulo, baj:x.cuerpo.bajada, cta:x.cuerpo.cta,
      epi:x.cuerpo.epigrafe, leg:x.cuerpo.legal, mar:x.margen, circ:x.circuloK};}));
  g.forEach(x=>console.log("     "+x.f+"  k="+x.k+"  tit="+x.tit+"  baj="+x.baj+"  cta="+x.cta+"  epi="+x.epi+"  margen="+x.mar+"  ⌀="+x.circ));
  const m=g[0];
  T(m.k===1,"1080×1350 es el máster (k=1)",m.k);
  T(m.tit===94 && m.baj===47 && m.cta===47 && m.epi===40 && m.leg===32,
    "medidas base del manual: 94/47/47/40/32", `${m.tit}/${m.baj}/${m.cta}/${m.epi}/${m.leg}`);
  T(m.mar===59,"margen 59 en el máster",m.mar);
  T(g[1].mar===47,"margen 47 en el cuadrado (tabla de Facebook)",g[1].mar);
  T(g[1].k===0.8,"1080×1080 → k=0,80",g[1].k);
  T(g[2].k>0.46&&g[2].k<0.48,"1200×628 → k≈0,47",g[2].k);
  T(m.circ>0,"el 4:5 admite círculo de oferta (diagramación A)",m.circ);

  console.log("\n2 · La colección se crea con sus tres piezas");
  const r2=await pg.evaluate(async ()=>{
    const pr={id:uid(),nombre:"FB",creado:Date.now(),piezas:[],activa:null};
    workspace.proyectos=[pr]; proyectoVistoId=pr.id; proyecto=pr;
    crearComposicion("facebook");
    const p=pieza();
    setComp("zonas.texto.etiqueta.texto","Seguro");
    setComp("zonas.texto.titular.texto","Tu auto listo");
    setComp("zonas.texto.cuerpo.texto","Cobertura desde hoy");
    setComp("zonas.cta.texto","Cotiza aquí");
    setComp("zonas.logo.url","/logo.svg");
    setComp("burbuja.texto","2 Cuotas Gratis"); setComp("burbuja.visible",true);
    setComp("fondo.color","#23366F");
    setComp("legal","Bases legales en www.ejemplo.cl");
    renderTablero();
    return { tipo:p.setTipo, master:p.masterFmt, n:(p.artboards||[]).length, ruta:rutaDeProducto(p), cat:categoriaDe("fb-1080x1350") };
  });
  T(r2.n===3,"tres artboards",r2.n);
  T(r2.master==="fb-1080x1350","el máster es el 1080×1350",r2.master);
  T(r2.ruta==="/fb-ia","tiene su propia ruta",r2.ruta);
  T(r2.cat==="Facebook","categoría propia (no cae en Post)",r2.cat);

  console.log("\n3 · El inspector mide las tres");
  await pg.waitForTimeout(900);
  const r3=await pg.evaluate(()=>{const res=pieza()._inspeccion||{};
    return { n:Object.keys(res).length, malos:Object.keys(res).filter(f=>!res[f].ok),
      det:Object.keys(res).map(f=>f+":"+res[f].fallos.map(x=>x.id).join("/")) };});
  T(r3.n===3,"inspecciona los tres tamaños",r3.n);
  T(r3.malos.length===0,"las tres pasan las 6 comprobaciones",r3.det.join(" · "));

  console.log("\n4 · Textos del anuncio, fuera de la imagen");
  const r4=await pg.evaluate(()=>{
    renderComposicionEditor();
    const panel=document.querySelector(".fb-panel");
    setFbTexto("titular","Un titular de más de cuarenta caracteres para probar el corte");
    setFbTexto("principal","corto");
    const c=document.querySelector('[data-fbcount="titular"]');
    const c2=document.querySelector('[data-fbcount="principal"]');
    return { panel:!!panel, campos:panel?panel.querySelectorAll(".fb-campo").length:0,
      titClase:c?c.className:"", titTexto:c?c.textContent:"", priClase:c2?c2.className:"",
      guardado:(pieza().fbTextos||{}).titular||"" };
  });
  T(r4.panel && r4.campos===3,"el panel trae los tres campos del anuncio","campos="+r4.campos);
  T(/aviso|mal/.test(r4.titClase),"avisa cuando el titular pasa del límite visible",r4.titClase+" · "+r4.titTexto);
  T(/ok/.test(r4.priClase),"en verde cuando cabe",r4.priClase);
  T(r4.guardado.length>10,"el texto queda guardado en la pieza");

  console.log("\n5 · Que la colección de Display siga intacta");
  const r5=await pg.evaluate(async ()=>{
    crearComposicion("display-desktop");
    const p=pieza();
    return { n:(p.artboards||[]).length, master:p.masterFmt, ruta:rutaDeProducto(p) };
  });
  T(r5.n===11 && r5.master==="display-300x250" && r5.ruta==="/gdn-ia","Display sigue con sus 11 y su ruta",JSON.stringify(r5));

  console.log("\n"+(mal||errs.length?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  if(errs.length) [...new Set(errs)].forEach(e=>console.log("  err "+e));
  await b.close(); process.exit(mal||errs.length?1:0);
})();
