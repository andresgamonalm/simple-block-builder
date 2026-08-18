// LIENZO LIBRE: el modelo del usuario. Se comprueba lo esencial antes de
// construir encima: que un elemento colocado en el 300x250 caiga donde
// corresponde en los otros diez, respetando su ancla y su proporción.
const { chromium } = require("playwright");
let ok=0, mal=0;
const T=(c,n,e)=>{ if(c){ok++;console.log("  ok   "+n);} else {mal++;console.log("  MAL  "+n+(e!==undefined?" → "+e:""));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.SBB_CHROMIUM || undefined});
  const pg=await b.newPage({viewport:{width:1600,height:1100}});
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto((process.env.SBB_URL||"http://127.0.0.1:8099")+"/editor.html",{waitUntil:"load"});
  await pg.waitForFunction(()=>typeof window.libreDefault==="function");

  console.log("\n1 · Anclas: cada esquina se mantiene al replicar");
  const r1 = await pg.evaluate(()=>{
    const casos = [
      { n:"logo arriba-izq",  el:{ancla:"tl",dx:14,dy:14,w:90,h:32} },
      { n:"sello abajo-der",  el:{ancla:"br",dx:10,dy:10,w:60,h:60} },
      { n:"texto centrado",   el:{ancla:"mc",dx:0, dy:0, w:200,h:60} },
      { n:"franja abajo-izq", el:{ancla:"bl",dx:8, dy:8, w:120,h:20} }
    ];
    const fmts = ["display-300x250","display-1200x1200","display-160x600","display-728x90"];
    return casos.map(c=>({ n:c.n, cajas: fmts.map(f=>{
      const q = cajaLibre(c.el, f); const F = FORMATOS[f];
      return { f, ...q, W:F.ancho, H:F.alto,
               dIzq:q.left, dDer:F.ancho-(q.left+q.w), dArr:q.top, dAba:F.alto-(q.top+q.h) };
    })}));
  });
  r1.forEach(c=>{
    console.log("     "+c.n);
    c.cajas.forEach(q=>console.log(`        ${q.f.padEnd(20)} ${q.w}×${q.h} en ${q.left},${q.top}   (izq ${q.dIzq} · der ${q.dDer} · arr ${q.dArr} · aba ${q.dAba})`));
  });
  const logo = r1[0].cajas, sello = r1[1].cajas, centro = r1[2].cajas;
  T(logo.every(q=>q.left>=0 && q.top>=0), "el logo anclado arriba-izquierda nunca se sale", JSON.stringify(logo.map(q=>q.left+","+q.top)));
  T(logo.every(q=>Math.abs(q.dIzq/q.k - 14) < 1.5), "y mantiene su distancia al borde, proporcional",
    logo.map(q=>Math.round(q.dIzq/q.k)).join("/"));
  T(sello.every(q=>Math.abs(q.dDer/q.k - 10) < 1.5 && Math.abs(q.dAba/q.k - 10) < 1.5),
    "el sello anclado abajo-derecha se queda abajo a la derecha en todos",
    sello.map(q=>Math.round(q.dDer/q.k)+","+Math.round(q.dAba/q.k)).join(" "));
  T(centro.every(q=>Math.abs((q.left+q.w/2) - q.W/2) <= 1 && Math.abs((q.top+q.h/2) - q.H/2) <= 1),
    "lo centrado sigue centrado en todos", centro.map(q=>Math.round(q.left+q.w/2)+"/"+Math.round(q.W/2)).join(" "));
  T(logo[1].w > logo[0].w && logo[2].w < logo[0].w, "el tamaño escala con cada formato",
    logo.map(q=>q.w).join("/"));

  console.log("\n2 · Colocar con el ratón y volver a leerlo da lo mismo (ida y vuelta)");
  const r2 = await pg.evaluate(()=>{
    const fmt="display-300x250";
    const pruebas=[
      {w:90,h:32,left:14,top:14},     // arriba izquierda
      {w:60,h:60,left:230,top:180},   // abajo derecha
      {w:200,h:60,left:50,top:95},    // centro
      {w:120,h:20,left:8,top:222}     // abajo izquierda
    ];
    return pruebas.map(p=>{
      const el={w:p.w,h:p.h};
      const a=anclarLibre(el, fmt, p.left, p.top);
      const q=cajaLibre(Object.assign({},el,a), fmt);
      return { puesto:p.left+","+p.top, ancla:a.ancla, leido:q.left+","+q.top,
               dif:Math.abs(q.left-p.left)+Math.abs(q.top-p.top) };
    });
  });
  r2.forEach(x=>console.log(`     puesto en ${x.puesto.padEnd(9)} → ancla ${x.ancla} → releído en ${x.leido}`));
  T(r2.every(x=>x.dif<=1), "lo que sueltas es exactamente donde queda", r2.map(x=>x.dif).join(","));

  console.log("\n3 · El banner se dibuja de verdad");
  const r3 = await pg.evaluate(()=>{
    const c = libreDefault({bg:"#ffffff"});
    c.fondo.color = "#23366F";
    c.elementos = [
      nuevoElementoLibre("figura",{ancla:"br",dx:0,dy:0,w:140,h:70,relleno:"#fff773",radio:8,z:1}),
      nuevoElementoLibre("texto",{ancla:"tl",dx:16,dy:60,w:200,h:70,texto:"Protege lo que más quieres",tam:22,color:"#ffffff",z:2}),
      nuevoElementoLibre("logo",{ancla:"tl",dx:14,dy:14,w:90,h:28,url:"/logo.svg",z:3})
    ];
    const html = renderComposicion(c, "display-300x250");
    const d = document.createElement("div"); d.innerHTML = html; document.body.appendChild(d);
    const cmp = d.querySelector(".cmp-libre");
    const r = { libre: !!cmp, n: cmp?cmp.querySelectorAll(".lb-el").length:0,
                txt: cmp?(cmp.querySelector(".lb-txt")||{}).textContent:"",
                orden: cmp?[...cmp.querySelectorAll(".lb-el")].map(e=>e.className.split(" ")[1]).join(">"):"" };
    d.remove(); return r;
  });
  T(r3.libre, "usa el render libre, no el de tres zonas");
  T(r3.n===3, "dibuja los tres elementos", r3.n);
  T(String(r3.txt).includes("Protege"), "con su texto", r3.txt);
  T(r3.orden==="lb-fig>lb-txt>lb-logo", "y en el orden de capas que pediste (delante/detrás)", r3.orden);

  console.log("\n4 · El modelo de 3 zonas sigue intacto para lo ya guardado");
  const r4 = await pg.evaluate(()=>{
    const vieja = composicionDefault({bg:"#0e2748"});
    const html = renderComposicion(vieja, "display-300x250");
    return { esLibre: html.indexOf("cmp-libre")>=0, tieneZonas: html.indexOf("cmp-zona")>=0 };
  });
  T(!r4.esLibre && r4.tieneZonas, "una composición antigua se sigue dibujando por zonas", JSON.stringify(r4));

  T(errs.length===0, "sin errores de consola", errs.slice(0,3).join(" | "));
  console.log("\n"+(mal?"FALLA":"TODO OK")+` — ${ok} ok · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})().catch(e=>{ console.log("ERROR: "+e.message); process.exit(1); });
